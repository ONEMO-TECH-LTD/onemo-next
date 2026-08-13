import { NonTierableOrderingError } from "./errors.js";
import { compareCandidates } from "./compare.js";
import type { RankedTierJson, TierBoundaryJson } from "./types.js";
import type { ValidatedCandidate, ValidatedRules } from "./validate.js";

class UnionFind {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(value: number): number {
    const parent = this.parent[value];
    if (parent === undefined) {
      throw new Error("internal invariant: union-find index exists");
    }
    if (parent !== value) {
      this.parent[value] = this.find(parent);
    }
    return this.parent[value]!;
  }

  union(left: number, right: number): void {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) {
      return;
    }
    const leftRank = this.rank[leftRoot]!;
    const rightRank = this.rank[rightRoot]!;
    if (leftRank < rightRank) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    this.parent[rightRoot] = leftRoot;
    if (leftRank === rightRank) {
      this.rank[leftRoot] = leftRank + 1;
    }
  }
}

interface TierGroup {
  readonly candidates: readonly ValidatedCandidate[];
  readonly representative: ValidatedCandidate;
  readonly sourceMinIndex: number;
  wins: number;
}

export function buildOrdering(
  candidates: readonly ValidatedCandidate[],
  rules: ValidatedRules,
): {
  readonly tiers: readonly RankedTierJson[];
  readonly boundaries: readonly TierBoundaryJson[];
} {
  if (candidates.length === 0) {
    return { tiers: [], boundaries: [] };
  }

  const union = new UnionFind(candidates.length);
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex]!;
      const right = candidates[rightIndex]!;
      if (compareCandidates(left, right, rules).relation === "tie") {
        union.union(leftIndex, rightIndex);
      }
    }
  }

  const grouped = new Map<number, ValidatedCandidate[]>();
  candidates.forEach((candidate, index) => {
    const root = union.find(index);
    const list = grouped.get(root) ?? [];
    list.push(candidate);
    grouped.set(root, list);
  });

  const groups: TierGroup[] = [...grouped.values()].map((members) => {
    members.sort((left, right) => left.index - right.index);
    return {
      candidates: members,
      representative: members[0]!,
      sourceMinIndex: members[0]!.index,
      wins: 0,
    };
  });

  // Ties must form equivalence classes. A~B and B~C may not conceal A>C.
  for (const group of groups) {
    for (let leftIndex = 0; leftIndex < group.candidates.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < group.candidates.length;
        rightIndex += 1
      ) {
        const left = group.candidates[leftIndex]!;
        const right = group.candidates[rightIndex]!;
        if (compareCandidates(left, right, rules).relation !== "tie") {
          throw new NonTierableOrderingError(
            group.candidates.map((candidate) => candidate.ref),
            "pairwise unresolved comparisons are not transitive, so no honest disjoint tier can contain the group",
          );
        }
      }
    }
  }

  // Every distinct group must be strictly separable in one consistent direction.
  for (let leftGroupIndex = 0; leftGroupIndex < groups.length; leftGroupIndex += 1) {
    for (
      let rightGroupIndex = leftGroupIndex + 1;
      rightGroupIndex < groups.length;
      rightGroupIndex += 1
    ) {
      const leftGroup = groups[leftGroupIndex]!;
      const rightGroup = groups[rightGroupIndex]!;
      const representativeComparison = compareCandidates(
        leftGroup.representative,
        rightGroup.representative,
        rules,
      );
      if (representativeComparison.relation === "tie") {
        throw new NonTierableOrderingError(
          [leftGroup.representative.ref, rightGroup.representative.ref],
          "distinct tie components remain unresolved",
        );
      }
      for (const left of leftGroup.candidates) {
        for (const right of rightGroup.candidates) {
          const comparison = compareCandidates(left, right, rules);
          if (comparison.relation !== representativeComparison.relation) {
            throw new NonTierableOrderingError(
              [left.ref, right.ref],
              "members of proposed tiers do not have one consistent cross-tier order",
            );
          }
        }
      }
      if (representativeComparison.relation === "left-higher") {
        leftGroup.wins += 1;
      } else {
        rightGroup.wins += 1;
      }
    }
  }

  groups.sort((left, right) => {
    if (left.wins !== right.wins) {
      return right.wins - left.wins;
    }
    return left.sourceMinIndex - right.sourceMinIndex;
  });

  // A transitive complete tier order has every earlier group above every later group.
  for (let higherIndex = 0; higherIndex < groups.length; higherIndex += 1) {
    for (let lowerIndex = higherIndex + 1; lowerIndex < groups.length; lowerIndex += 1) {
      const higher = groups[higherIndex]!.representative;
      const lower = groups[lowerIndex]!.representative;
      if (compareCandidates(higher, lower, rules).relation !== "left-higher") {
        throw new NonTierableOrderingError(
          [higher.ref, lower.ref],
          "supplied rule inputs form a cycle or a non-transitive comparison and cannot be represented as ranked tiers without invention",
        );
      }
    }
  }

  const tiers: RankedTierJson[] = groups.map((group, index) => ({
    tierIndex: index.toString(),
    candidateRefs: group.candidates.map((candidate) => candidate.ref),
    sharedMeaning: "unresolved-by-supplied-ordering-rules",
  }));

  const boundaries: TierBoundaryJson[] = [];
  for (let index = 0; index + 1 < groups.length; index += 1) {
    const higherGroup = groups[index]!;
    const lowerGroup = groups[index + 1]!;
    const decisions = [];
    for (const higher of higherGroup.candidates) {
      for (const lower of lowerGroup.candidates) {
        const comparison = compareCandidates(higher, lower, rules);
        if (comparison.relation !== "left-higher") {
          throw new Error("internal invariant: adjacent tiers are ordered higher to lower");
        }
        decisions.push(comparison.decision);
      }
    }
    boundaries.push({
      higherTierIndex: index.toString(),
      lowerTierIndex: (index + 1).toString(),
      decisions,
    });
  }

  return { tiers, boundaries };
}
