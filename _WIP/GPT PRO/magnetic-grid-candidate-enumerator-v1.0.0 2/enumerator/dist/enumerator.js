import { MissingKernelFactError } from "./errors.js";
import { absolute, compareBigInt, coordinateKey } from "./integer.js";
import { makeCandidateId } from "./id.js";
import { validateGrammar, validateMeasurement, } from "./validate.js";
/**
 * Enumerates only the four supplied arrangement families from exact kernel facts.
 * No geometric predicate, selection, score, ranking, pruning or winner exists here.
 */
export function enumerateCandidates(input) {
    const sizes = validateMeasurement(input.measurement);
    const grammar = validateGrammar(input.grammar);
    const candidates = [];
    for (const size of sizes) {
        const perSize = new Map();
        for (const population of grammar.populations) {
            const context = buildPopulationContext(size, population);
            enumerateRuns(size, context, grammar, perSize);
            enumerateRectangleCorners(size, context, perSize);
            enumerateCornerTriangles(size, context, perSize);
            enumerateFullWindows(size, context, grammar, perSize);
        }
        const ordered = [...perSize.values()].sort((left, right) => compareText(left.id, right.id));
        candidates.push(...ordered);
    }
    return {
        schema: "magnetic-grid-candidate-enumerator/candidates/v1",
        sourceMeasurementSchema: "magnetic-grid-measurement-kernel/lattice/v1",
        candidates,
    };
}
function buildPopulationContext(size, population) {
    const allPoints = [];
    const heldPoints = [];
    const allByPopulationIndex = new Map();
    const heldByPopulationIndex = new Map();
    const uSet = new Set();
    const vSet = new Set();
    for (const fact of size.facts) {
        const columnDelta = fact.column - population.originColumn;
        const rowDelta = fact.row - population.originRow;
        if (columnDelta % population.indexStep !== 0n || rowDelta % population.indexStep !== 0n) {
            continue;
        }
        const point = {
            u: columnDelta / population.indexStep,
            v: rowDelta / population.indexStep,
            fact,
        };
        const key = populationKey(point.u, point.v);
        allPoints.push(point);
        allByPopulationIndex.set(key, point);
        uSet.add(point.u);
        vSet.add(point.v);
        if (fact.fits) {
            heldPoints.push(point);
            heldByPopulationIndex.set(key, point);
        }
    }
    allPoints.sort(comparePopulationPoint);
    heldPoints.sort(comparePopulationPoint);
    const uValues = [...uSet].sort(compareBigInt);
    const vValues = [...vSet].sort(compareBigInt);
    for (const v of vValues) {
        for (const u of uValues) {
            if (!allByPopulationIndex.has(populationKey(u, v))) {
                const column = population.originColumn + u * population.indexStep;
                const row = population.originRow + v * population.indexStep;
                throw new MissingKernelFactError(size.sourceSizeIndex, column, row);
            }
        }
    }
    return {
        definition: population,
        allPoints,
        heldPoints,
        allByPopulationIndex,
        heldByPopulationIndex,
        uValues,
        vValues,
    };
}
function enumerateRuns(size, population, grammar, output) {
    const held = population.heldPoints;
    for (const first of held) {
        for (const second of held) {
            const columnStep = second.u - first.u;
            const rowStep = second.v - first.v;
            if (!isCanonicalRunStep(columnStep, rowStep, grammar.runStepDomain)) {
                continue;
            }
            const members = [first, second];
            addCandidate(size, "run", population.definition.id, columnStep, rowStep, members.map((point) => point.fact), output);
            let nextU = second.u + columnStep;
            let nextV = second.v + rowStep;
            while (true) {
                const next = population.heldByPopulationIndex.get(populationKey(nextU, nextV));
                if (next === undefined) {
                    break;
                }
                members.push(next);
                addCandidate(size, "run", population.definition.id, columnStep, rowStep, members.map((point) => point.fact), output);
                nextU += columnStep;
                nextV += rowStep;
            }
        }
    }
}
function isCanonicalRunStep(columnStep, rowStep, domain) {
    const horizontal = columnStep > 0n && rowStep === 0n;
    const vertical = columnStep === 0n && rowStep > 0n;
    const diagonal = columnStep > 0n && absolute(rowStep) === columnStep;
    if (!horizontal && !vertical && !diagonal) {
        return false;
    }
    if (domain === "any-positive-whole-population-step") {
        return true;
    }
    if (horizontal) {
        return columnStep === 1n;
    }
    if (vertical) {
        return rowStep === 1n;
    }
    return columnStep === 1n;
}
function enumerateRectangleCorners(size, population, output) {
    const uValues = uniqueHeldAxisValues(population.heldPoints, "u");
    const vValues = uniqueHeldAxisValues(population.heldPoints, "v");
    for (const firstU of uValues) {
        for (const secondU of uValues) {
            if (secondU <= firstU) {
                continue;
            }
            for (const firstV of vValues) {
                for (const secondV of vValues) {
                    if (secondV <= firstV) {
                        continue;
                    }
                    const corners = rectangleCornerFacts(population.heldByPopulationIndex, firstU, secondU, firstV, secondV);
                    if (corners.every((corner) => corner !== undefined)) {
                        addCandidate(size, "rectangle-corners", population.definition.id, secondU - firstU, secondV - firstV, corners, output);
                    }
                }
            }
        }
    }
}
function enumerateCornerTriangles(size, population, output) {
    const uValues = uniqueHeldAxisValues(population.heldPoints, "u");
    const vValues = uniqueHeldAxisValues(population.heldPoints, "v");
    for (const firstU of uValues) {
        for (const secondU of uValues) {
            if (secondU <= firstU) {
                continue;
            }
            for (const firstV of vValues) {
                for (const secondV of vValues) {
                    if (secondV <= firstV) {
                        continue;
                    }
                    const corners = rectangleCornerFacts(population.heldByPopulationIndex, firstU, secondU, firstV, secondV);
                    const selections = [
                        [corners[0], corners[1], corners[2]],
                        [corners[0], corners[1], corners[3]],
                        [corners[0], corners[2], corners[3]],
                        [corners[1], corners[2], corners[3]],
                    ];
                    for (const selection of selections) {
                        if (selection.every((fact) => fact !== undefined)) {
                            addCandidate(size, "corner-triangle", population.definition.id, secondU - firstU, secondV - firstV, selection, output);
                        }
                    }
                }
            }
        }
    }
}
function enumerateFullWindows(size, population, grammar, output) {
    const uValues = population.uValues;
    const vValues = population.vValues;
    for (const firstU of uValues) {
        for (const secondU of uValues) {
            if (secondU < firstU) {
                continue;
            }
            for (const firstV of vValues) {
                for (const secondV of vValues) {
                    if (secondV < firstV) {
                        continue;
                    }
                    if (grammar.oneByOneFullWindow === "exclude" &&
                        firstU === secondU &&
                        firstV === secondV) {
                        continue;
                    }
                    const selected = [];
                    let complete = true;
                    for (let v = firstV; v <= secondV && complete; v += 1n) {
                        for (let u = firstU; u <= secondU; u += 1n) {
                            const point = population.allByPopulationIndex.get(populationKey(u, v));
                            if (point === undefined) {
                                const column = population.definition.originColumn + u * population.definition.indexStep;
                                const row = population.definition.originRow + v * population.definition.indexStep;
                                throw new MissingKernelFactError(size.sourceSizeIndex, column, row);
                            }
                            if (!point.fact.fits) {
                                complete = false;
                                break;
                            }
                            selected.push(point.fact);
                        }
                    }
                    if (complete) {
                        addCandidate(size, "full-window", population.definition.id, secondU - firstU, secondV - firstV, selected, output);
                    }
                }
            }
        }
    }
}
function rectangleCornerFacts(held, firstU, secondU, firstV, secondV) {
    return [
        held.get(populationKey(firstU, firstV))?.fact,
        held.get(populationKey(secondU, firstV))?.fact,
        held.get(populationKey(firstU, secondV))?.fact,
        held.get(populationKey(secondU, secondV))?.fact,
    ];
}
function addCandidate(size, family, population, columnStep, rowStep, facts, output) {
    const orderedFacts = [...facts].sort(comparePositionFact);
    const steps = {
        column: columnStep.toString(),
        row: rowStep.toString(),
    };
    const identityPositions = orderedFacts.map((fact) => ({
        column: fact.columnText,
        row: fact.rowText,
    }));
    const id = makeCandidateId({
        family,
        population,
        steps,
        positions: identityPositions,
    });
    if (output.has(id)) {
        return;
    }
    const positions = orderedFacts.map((fact) => ({
        column: fact.columnText,
        row: fact.rowText,
        center: copyRationalPoint(fact.center),
        kernelFactRef: fact.kernelFactRef,
    }));
    output.set(id, {
        id,
        size: {
            kernelSizeIndex: size.sourceSizeIndexText,
            value: size.sizeText,
            kernelFactRef: size.kernelFactRef,
        },
        family,
        population,
        steps,
        positions,
    });
}
function uniqueHeldAxisValues(points, axis) {
    const values = new Set();
    for (const point of points) {
        values.add(point[axis]);
    }
    return [...values].sort(compareBigInt);
}
function copyRationalPoint(point) {
    return {
        x: {
            numerator: point.x.numerator,
            denominator: point.x.denominator,
        },
        y: {
            numerator: point.y.numerator,
            denominator: point.y.denominator,
        },
    };
}
function comparePopulationPoint(left, right) {
    const row = compareBigInt(left.v, right.v);
    return row !== 0 ? row : compareBigInt(left.u, right.u);
}
function comparePositionFact(left, right) {
    const row = compareBigInt(left.row, right.row);
    return row !== 0 ? row : compareBigInt(left.column, right.column);
}
function populationKey(u, v) {
    return coordinateKey(u, v);
}
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
