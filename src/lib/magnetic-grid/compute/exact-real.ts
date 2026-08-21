import type { AlgebraicGeneratorProof, AlgebraicReal, CertifiedExpressionReal, ExactReal, Rational } from '../spec'

type Q = { n: bigint; d: bigint }

const abs = (value: bigint) => (value < BigInt(0) ? -value : value)

const gcd = (a: bigint, b: bigint): bigint => {
  let x = abs(a),
    y = abs(b)
  while (y !== BigInt(0)) {
    const next = x % y
    x = y
    y = next
  }
  return x || BigInt(1)
}

const q = (n: bigint, d = BigInt(1)): Q => {
  if (d === BigInt(0)) throw new RangeError('zero denominator')
  const sign = d < BigInt(0) ? -BigInt(1) : BigInt(1)
  const divisor = gcd(n, d)
  return { n: (sign * n) / divisor, d: (sign * d) / divisor }
}

const fromPublic = (value: Rational): Q =>
  q(BigInt(value.numerator), BigInt(value.denominator))
const toPublic = (value: Q): Rational => ({
  numerator: value.n.toString(),
  denominator: value.d.toString(),
})

export const rational = (
  numerator: bigint | number | string,
  denominator: bigint | number | string = 1,
): Rational => toPublic(q(BigInt(numerator), BigInt(denominator)))

/** Exact IEEE-754 binary rational; no decimal or policy rounding. */
export function rationalFromNumber(value: number): Rational {
  if (!Number.isFinite(value))
    throw new RangeError('exact value must be finite')
  if (Object.is(value, -0) || value === 0) return rational(0)
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value, false)
  const bits = view.getBigUint64(0, false)
  const sign = bits >> BigInt(63) === BigInt(0) ? BigInt(1) : -BigInt(1)
  const exponentBits = Number((bits >> BigInt(52)) & BigInt(0x7ff))
  const fraction = bits & ((BigInt(1) << BigInt(52)) - BigInt(1))
  const mantissa =
    exponentBits === 0 ? fraction : (BigInt(1) << BigInt(52)) + fraction
  const exponent = (exponentBits === 0 ? 1 - 1023 : exponentBits - 1023) - 52
  return exponent >= 0
    ? rational(sign * (mantissa << BigInt(exponent)))
    : rational(sign * mantissa, BigInt(1) << BigInt(-exponent))
}

export const addRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.d + y.n * x.d, x.d * y.d))
}

export const subtractRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.d - y.n * x.d, x.d * y.d))
}

export const multiplyRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.n, x.d * y.d))
}

export const divideRational = (a: Rational, b: Rational): Rational => {
  const x = fromPublic(a),
    y = fromPublic(b)
  return toPublic(q(x.n * y.d, x.d * y.n))
}

export const squareRational = (value: Rational): Rational =>
  multiplyRational(value, value)

export const compareRational = (a: Rational, b: Rational): -1 | 0 | 1 => {
  const x = fromPublic(a),
    y = fromPublic(b)
  const delta = x.n * y.d - y.n * x.d
  return delta < BigInt(0) ? -1 : delta > BigInt(0) ? 1 : 0
}

const integerSqrt = (value: bigint): bigint => {
  if (value < BigInt(0)) throw new RangeError('square root of negative value')
  if (value < BigInt(2)) return value
  let x = BigInt(1) << BigInt((value.toString(2).length + 1) >> 1)
  for (;;) {
    const next = (x + value / x) >> BigInt(1)
    if (next >= x) return x
    x = next
  }
}

const exactSquareRoot = (value: Rational): Rational | null => {
  const x = fromPublic(value)
  if (x.n < BigInt(0)) return null
  const sn = integerSqrt(x.n),
    sd = integerSqrt(x.d)
  return sn * sn === x.n && sd * sd === x.d ? rational(sn, sd) : null
}

export function sqrtRationalBounds(value: Rational, bits = 192): readonly [Rational, Rational] {
  const input = fromPublic(value)
  if (input.n < BigInt(0)) throw new RangeError('square root of negative value')
  const scale = BigInt(1) << BigInt(bits)
  const scaledFloor = (input.n << BigInt(bits * 2)) / input.d
  const root = integerSqrt(scaledFloor)
  const lo = rational(root, scale)
  return [lo, compareRational(squareRational(lo), value) === 0 ? lo : rational(root + BigInt(1), scale)]
}

const primitivePolynomial = (coefficients: bigint[]): string[] => {
  let divisor = BigInt(0)
  for (const coefficient of coefficients) divisor = gcd(divisor, coefficient)
  const normalized = coefficients.map((coefficient) => coefficient / divisor)
  if (normalized[0] < BigInt(0))
    return normalized.map((coefficient) => (-coefficient).toString())
  return normalized.map((coefficient) => coefficient.toString())
}
export const normalizedPrimitivePolynomial=(coefficients:readonly string[]):string[]=>primitivePolynomial(coefficients.map(BigInt))
export function normalizedSquareFreePrimitivePolynomial(coefficients:readonly string[]):string[]{const normalized=normalizedPrimitivePolynomial(coefficients),polynomial=normalized.map(value=>rational(value)),gcdValue=polynomialGcd(polynomial,polynomialDerivative(polynomial));if(!polynomialIsOne(gcdValue))throw new RangeError('algebraic defining polynomial must be square-free');return normalized}

export function allowancePolynomial(
  squaredDistance: Rational,
  radius: Rational,
): string[] {
  const distance = fromPublic(squaredDistance)
  const r = fromPublic(radius)
  return primitivePolynomial([
    distance.d * r.d * r.d,
    BigInt(2) * distance.d * r.n * r.d,
    distance.d * r.n * r.n - distance.n * r.d * r.d,
  ])
}

/** Exact `sqrt(squaredDistance) - radius`; irrational results carry a certified dyadic isolating interval. */
export function sqrtMinusRational(
  squaredDistance: Rational,
  radius: Rational,
): ExactReal {
  const exactRoot = exactSquareRoot(squaredDistance)
  if (exactRoot) return subtractRational(exactRoot, radius)
  const distance = fromPublic(squaredDistance)
  if (distance.n < BigInt(0)) throw new RangeError('negative squared distance')
  const bits = 128
  const scale = BigInt(1) << BigInt(bits)
  const scaledFloor = (distance.n << BigInt(bits * 2)) / distance.d
  const lowerRoot = rational(integerSqrt(scaledFloor), scale)
  const upperRoot = addRational(lowerRoot, rational(1, scale))
  return {
    polynomial: allowancePolynomial(squaredDistance, radius),
    isolating: [
      subtractRational(lowerRoot, radius),
      subtractRational(upperRoot, radius),
    ],
    rootIndex: 1,
  }
}

export const isRational = (value: ExactReal): value is Rational => 'numerator' in value
export const isAlgebraic = (value: ExactReal): value is AlgebraicReal => 'polynomial' in value

const evaluatePolynomial = (
  polynomial: readonly string[],
  at: Rational,
): Rational => {
  let value = rational(0)
  for (const coefficient of polynomial)
    value = addRational(multiplyRational(value, at), rational(coefficient))
  return value
}

const normalizedAlgebraicKey = (value: AlgebraicReal): string => {
  if (value.polynomial.length !== 3 || (value.rootIndex !== 0 && value.rootIndex !== 1)) {
    throw new RangeError('unsupported algebraic comparison')
  }
  return `${primitiveQuadratic(value.polynomial.map(BigInt)).join(',')}#${value.rootIndex}`
}

const validateAlgebraic = (value: AlgebraicReal): void => {
  const [lo, hi] = value.isolating
  if (compareRational(lo, hi) >= 0) throw new RangeError('unsupported algebraic comparison')
  const polynomial = primitiveQuadratic(value.polynomial.map(BigInt)).map(String)
  const loSign = compareRational(evaluatePolynomial(polynomial, lo), rational(0))
  const hiSign = compareRational(evaluatePolynomial(polynomial, hi), rational(0))
  const bracketed = value.rootIndex === 0
    ? loSign >= 0 && hiSign <= 0
    : loSign <= 0 && hiSign >= 0
  if (!bracketed) throw new RangeError('unsupported algebraic comparison')
}

const compareAlgebraicToRational = (
  algebraic: AlgebraicReal,
  value: Rational,
): -1 | 0 | 1 => {
  validateAlgebraic(algebraic)
  const [lo, hi] = algebraic.isolating
  if (compareRational(hi, value) <= 0) return -1
  if (compareRational(lo, value) >= 0) return 1
  const sign = compareRational(
    evaluatePolynomial(algebraic.polynomial, value),
    rational(0),
  )
  if (sign === 0) return 0
  return algebraic.rootIndex === 0
    ? (sign > 0 ? 1 : -1)
    : (sign < 0 ? 1 : -1)
}

const certifiedSqrtQuadraticParts = (value: CertifiedExpressionReal) => {
  const [kind, scaleToken, aToken, bToken, cToken, subtractToken] = value.expression
  if (kind !== 'sqrt-quadratic-minus' || value.expression.length !== 6) {
    throw new RangeError('unsupported certified expression')
  }
  const scale = JSON.parse(String(scaleToken)) as ExactReal
  if (!isRational(scale) && !isAlgebraic(scale)) throw new RangeError('unsupported certified scale')
  return {
    scale,
    a: JSON.parse(String(aToken)) as Rational,
    b: JSON.parse(String(bToken)) as Rational,
    c: JSON.parse(String(cToken)) as Rational,
    subtract: JSON.parse(String(subtractToken)) as Rational,
  }
}

const compareCertifiedToRational = (value: CertifiedExpressionReal, limit: Rational): -1 | 0 | 1 => {
  const expression = certifiedSqrtQuadraticParts(value)
  const threshold = addRational(expression.subtract, limit)
  if (compareRational(threshold, rational(0)) < 0) return 1
  return signQuadraticAtExact(
    expression.a,
    expression.b,
    subtractRational(expression.c, squareRational(threshold)),
    expression.scale,
  )
}

export const validateCertifiedExpressionBounds = (value: CertifiedExpressionReal): void => {
  const [lo, hi] = value.isolating
  if (compareRational(lo, hi) > 0
    || compareCertifiedToRational(value, lo) < 0
    || compareCertifiedToRational(value, hi) > 0) {
    throw new RangeError('certified expression bounds do not contain the value')
  }
}

/** Total for the only comparison Wrap admits: a segment-distance root against a rational dial/cap. */
export function compareExactToRational(
  value: ExactReal,
  limit: Rational,
): -1 | 0 | 1 {
  if (isRational(value)) return compareRational(value, limit)
  return isAlgebraic(value)
    ? compareAlgebraicToRational(value, limit)
    : (validateCertifiedExpressionBounds(value), compareCertifiedToRational(value, limit))
}

const refineAlgebraic = (value: AlgebraicReal): AlgebraicReal => {
  const [lo, hi] = value.isolating
  const middle = midpoint(lo, hi)
  const sign = compareRational(evaluatePolynomial(value.polynomial, middle), rational(0))
  if (sign === 0) return { ...value, isolating: [middle, middle] }
  const keepRight = value.rootIndex === 0 ? sign > 0 : sign < 0
  return { ...value, isolating: keepRight ? [middle, hi] : [lo, middle] }
}

const refineCertified = (value: CertifiedExpressionReal): CertifiedExpressionReal => {
  const [lo, hi] = value.isolating
  const middle = midpoint(lo, hi)
  const comparison = compareCertifiedToRational(value, middle)
  if (comparison === 0) return { ...value, isolating: [middle, middle] }
  return { ...value, isolating: comparison > 0 ? [middle, hi] : [lo, middle] }
}

/** Exact ordering for the rational/quadratic real values admitted by current T3. */
export function compareExact(a: ExactReal, b: ExactReal): -1 | 0 | 1 {
  if (isRational(a)) return isRational(b) ? compareRational(a, b) : -compareExactToRational(b, a) as -1 | 0 | 1
  if (isRational(b)) return compareExactToRational(a, b)
  if (isAlgebraic(a) && isAlgebraic(b)) {
    validateAlgebraic(a)
    validateAlgebraic(b)
    if (normalizedAlgebraicKey(a) === normalizedAlgebraicKey(b)) return 0
  }
  if (!isAlgebraic(a) && !isAlgebraic(b)
    && a.expressionHash === b.expressionHash
    && JSON.stringify(a.expression) === JSON.stringify(b.expression)) return 0
  let left = a, right = b
  for (;;) {
    if (compareRational(left.isolating[1], right.isolating[0]) < 0) return -1
    if (compareRational(left.isolating[0], right.isolating[1]) > 0) return 1
    left = isAlgebraic(left) ? refineAlgebraic(left) : refineCertified(left)
    right = isAlgebraic(right) ? refineAlgebraic(right) : refineCertified(right)
  }
}

const affinePolynomial = (scale: AlgebraicReal, factor: Rational, offset: Rational): string[] => {
  const [pa, pb, pc] = scale.polynomial.map((coefficient) => rational(coefficient))
  const a = pa
  const b = addRational(
    multiplyRational(rational(-2), multiplyRational(pa, offset)),
    multiplyRational(pb, factor),
  )
  const c = addRational(
    subtractRational(
      multiplyRational(pa, squareRational(offset)),
      multiplyRational(multiplyRational(pb, factor), offset),
    ),
    multiplyRational(pc, squareRational(factor)),
  )
  return primitiveQuadratic(lcmDenominatorPolynomial(a, b, c)).map(String)
}

/** Exact affine image `factor·value+offset`; used for scale-parametric points/tangencies. */
export function affineExact(value: ExactReal, factor: Rational, offset: Rational): ExactReal {
  if (isRational(value)) return addRational(multiplyRational(factor, value), offset)
  if (!isAlgebraic(value)) throw new RangeError('certified affine transform is not implemented')
  if (compareRational(factor, rational(0)) === 0) return offset
  const map = (endpoint: Rational) => addRational(multiplyRational(factor, endpoint), offset)
  const a = map(value.isolating[0]), b = map(value.isolating[1])
  return {
    polynomial: affinePolynomial(value, factor, offset),
    isolating: compareRational(a, b) <= 0 ? [a, b] : [b, a],
    rootIndex: compareRational(factor, rational(0)) > 0 ? value.rootIndex : 1 - value.rootIndex,
  }
}

/** Exact sign of a rational quadratic evaluated at an admitted rational/quadratic real. */
export function signQuadraticAtExact(
  a: Rational,
  b: Rational,
  c: Rational,
  value: ExactReal,
): -1 | 0 | 1 {
  if (isRational(value)) {
    return compareRational(
      addRational(multiplyRational(addRational(multiplyRational(a, value), b), value), c),
      rational(0),
    )
  }
  if (!isAlgebraic(value)) throw new RangeError('certified quadratic evaluation is not implemented')
  const [pa, pb, pc] = value.polynomial.map((coefficient) => rational(coefficient))
  const quotient = divideRational(a, pa)
  const linear = subtractRational(b, multiplyRational(quotient, pb))
  const constant = subtractRational(c, multiplyRational(quotient, pc))
  if (compareRational(linear, rational(0)) === 0) return compareRational(constant, rational(0))
  return compareExact(affineExact(value, linear, constant), rational(0))
}

const lcmDenominatorPolynomial = (a: Rational, b: Rational, c: Rational): bigint[] => {
  const qa = fromPublic(a), qb = fromPublic(b), qc = fromPublic(c)
  return [
    qa.n * qb.d * qc.d,
    qb.n * qa.d * qc.d,
    qc.n * qa.d * qb.d,
  ]
}

const primitiveQuadratic = (coefficients: bigint[]): bigint[] => {
  let divisor = BigInt(0)
  for (const coefficient of coefficients) divisor = gcd(divisor, coefficient)
  const normalized = coefficients.map((coefficient) => coefficient / divisor)
  return normalized[0] < BigInt(0)
    ? normalized.map((coefficient) => -coefficient)
    : normalized
}

const evaluateIntegerQuadratic = (polynomial: readonly bigint[], at: Rational): Rational =>
  addRational(
    multiplyRational(
      addRational(multiplyRational(rational(polynomial[0]), at), rational(polynomial[1])),
      at,
    ),
    rational(polynomial[2]),
  )

const midpoint = (a: Rational, b: Rational): Rational =>
  divideRational(addRational(a, b), rational(2))

const isolateQuadraticRoot = (
  polynomial: readonly bigint[],
  rootIndex: 0 | 1,
  lo: Rational,
  hi: Rational,
): Rational | AlgebraicReal | null => {
  let left = lo, right = hi
  let leftSign = compareRational(evaluateIntegerQuadratic(polynomial, left), rational(0))
  let rightSign = compareRational(evaluateIntegerQuadratic(polynomial, right), rational(0))
  if (leftSign === 0) return left
  if (rightSign === 0) return right
  if (leftSign === rightSign) return null
  for (let iteration = 0; iteration < 192; iteration++) {
    const middle = midpoint(left, right)
    const middleSign = compareRational(evaluateIntegerQuadratic(polynomial, middle), rational(0))
    if (middleSign === 0) return middle
    if (middleSign === leftSign) {
      left = middle
      leftSign = middleSign
    } else {
      right = middle
      rightSign = middleSign
    }
  }
  void rightSign
  return {
    polynomial: polynomial.map(String),
    isolating: [left, right],
    rootIndex,
  }
}

/** Every exact real root of `a·s²+b·s+c=0` inside the closed rational interval. */
export function quadraticRootsWithin(
  a: Rational,
  b: Rational,
  c: Rational,
  lo: Rational,
  hi: Rational,
): Array<Rational | AlgebraicReal> {
  const polynomial = primitiveQuadratic(lcmDenominatorPolynomial(a, b, c))
  if (polynomial[0] === BigInt(0)) throw new RangeError('quadratic coefficient must be nonzero')
  const discriminant = polynomial[1] * polynomial[1] - BigInt(4) * polynomial[0] * polynomial[2]
  if (discriminant < BigInt(0)) return []
  const vertex = rational(-polynomial[1], BigInt(2) * polynomial[0])
  const roots: Array<Rational | AlgebraicReal> = []
  const leftHi = compareRational(vertex, hi) < 0 ? vertex : hi
  if (compareRational(lo, leftHi) <= 0) {
    const root = isolateQuadraticRoot(polynomial, 0, lo, leftHi)
    if (root) roots.push(root)
  }
  const rightLo = compareRational(vertex, lo) > 0 ? vertex : lo
  if (compareRational(rightLo, hi) <= 0) {
    const root = isolateQuadraticRoot(polynomial, 1, rightLo, hi)
    if (root && !roots.some((candidate) => canonicalExact(candidate) === canonicalExact(root))) roots.push(root)
  }
  return roots
}

export const approximateExact = (value: ExactReal): number => {
  if (isRational(value))
    return Number(value.numerator) / Number(value.denominator)
  const [lo, hi] = value.isolating
  return (approximateExact(lo) + approximateExact(hi)) / 2
}

export const canonicalExact = (value: ExactReal): string =>
  JSON.stringify(value)

type RationalPolynomial = Rational[]
const trimPolynomial=(value:RationalPolynomial):RationalPolynomial=>{let first=0;while(first<value.length-1&&compareRational(value[first],rational(0))===0)first++;return value.slice(first)}
const polynomialDerivative=(value:RationalPolynomial):RationalPolynomial=>{const degree=value.length-1;return trimPolynomial(value.slice(0,-1).map((coefficient,index)=>multiplyRational(coefficient,rational(degree-index))))}
const polynomialDivRem=(dividend:RationalPolynomial,divisor:RationalPolynomial):{quotient:RationalPolynomial;remainder:RationalPolynomial}=>{let value=trimPolynomial([...dividend]);const target=trimPolynomial(divisor),quotient=Array(Math.max(1,value.length-target.length+1)).fill(null).map(()=>rational(0));while(value.length>=target.length&&!(value.length===1&&compareRational(value[0],rational(0))===0)){const offset=quotient.length-(value.length-target.length)-1,factor=divideRational(value[0],target[0]);quotient[offset]=factor;for(let index=0;index<target.length;index++)value[index]=subtractRational(value[index],multiplyRational(factor,target[index]));value=trimPolynomial(value)}return{quotient:trimPolynomial(quotient),remainder:value}}
const polynomialRemainder=(dividend:RationalPolynomial,divisor:RationalPolynomial):RationalPolynomial=>{let value=trimPolynomial([...dividend]);const target=trimPolynomial(divisor);while(value.length>=target.length&&!(value.length===1&&compareRational(value[0],rational(0))===0)){const factor=divideRational(value[0],target[0]);for(let index=0;index<target.length;index++)value[index]=subtractRational(value[index],multiplyRational(factor,target[index]));value=trimPolynomial(value)}return value.map(coefficient=>multiplyRational(rational(-1),coefficient))}
const monicPolynomial=(value:RationalPolynomial)=>{const trimmed=trimPolynomial(value),leading=trimmed[0];return trimmed.map(coefficient=>divideRational(coefficient,leading))}
const polynomialGcd=(a:RationalPolynomial,b:RationalPolynomial):RationalPolynomial=>{let left=trimPolynomial(a),right=trimPolynomial(b);while(!(right.length===1&&compareRational(right[0],rational(0))===0)){const remainder=polynomialDivRem(left,right).remainder;left=right;right=remainder}return monicPolynomial(left)}
const polynomialIsOne=(value:RationalPolynomial)=>value.length===1&&compareRational(value[0],rational(1))===0
const squareFreeFactors=(value:RationalPolynomial):Array<{factor:RationalPolynomial;multiplicity:number}>=>{const derivative=polynomialDerivative(value);let c=polynomialGcd(value,derivative),w=polynomialDivRem(value,c).quotient,multiplicity=1;const factors:Array<{factor:RationalPolynomial;multiplicity:number}>=[];while(!polynomialIsOne(w)){const y=polynomialGcd(w,c),factor=polynomialDivRem(w,y).quotient;if(!polynomialIsOne(factor))factors.push({factor:monicPolynomial(factor),multiplicity});w=y;c=polynomialDivRem(c,y).quotient;multiplicity++}return factors}
const rationalPolynomialPrimitive=(value:RationalPolynomial):string[]=>{const denominators=value.map(coefficient=>BigInt(coefficient.denominator)),common=denominators.reduce((product,denominator)=>product*denominator,BigInt(1)),integers=value.map((coefficient,index)=>BigInt(coefficient.numerator)*(common/denominators[index]));return primitivePolynomial(integers)}
const sturmSequence=(polynomial:RationalPolynomial):RationalPolynomial[]=>{const sequence=[trimPolynomial(polynomial),polynomialDerivative(polynomial)];while(sequence.at(-1)!.length>1||compareRational(sequence.at(-1)![0],rational(0))!==0){const remainder=polynomialRemainder(sequence.at(-2)!,sequence.at(-1)!);if(remainder.length===1&&compareRational(remainder[0],rational(0))===0)break;sequence.push(remainder)}return sequence}
const polynomialSignAt=(polynomial:RationalPolynomial,value:Rational):-1|0|1=>{let result=rational(0);for(const coefficient of polynomial)result=addRational(multiplyRational(result,value),coefficient);return compareRational(result,rational(0))}
const signVariations=(sequence:RationalPolynomial[],value:Rational):number=>{let previous:0|-1|1=0,count=0;for(const polynomial of sequence){const sign=polynomialSignAt(polynomial,value);if(sign===0)continue;if(previous&&sign!==previous)count++;previous=sign}return count}
const rootCount=(sequence:RationalPolynomial[],lo:Rational,hi:Rational)=>signVariations(sequence,lo)-signVariations(sequence,hi)
export interface IsolatedPolynomialRoot{primitivePolynomial:readonly string[];rootIndex:number;isolating:readonly[Rational,Rational];multiplicity:number}
export function isolatePrimitiveIntegerRoots(coefficients:readonly string[],lo:Rational,hi:Rational):IsolatedPolynomialRoot[]{const original=primitivePolynomial(coefficients.map(BigInt)).map(value=>rational(value)),working:Array<{root:IsolatedPolynomialRoot;factor:RationalPolynomial;sequence:RationalPolynomial[]}>=[];for(const{factor,multiplicity}of squareFreeFactors(original)){const primitive=rationalPolynomialPrimitive(factor),sequence=sturmSequence(factor),total=rootCount(sequence,lo,hi);const isolate=(left:Rational,right:Rational,count:number)=>{if(!count)return;const middle=divideRational(addRational(left,right),rational(2));if(polynomialSignAt(factor,middle)===0){let nearLeft=divideRational(addRational(left,middle),rational(2)),nearRight=divideRational(addRational(middle,right),rational(2)),leftCount=rootCount(sequence,left,nearLeft),rightCount=rootCount(sequence,nearRight,right);while(leftCount+rightCount!==count-1){nearLeft=divideRational(addRational(nearLeft,middle),rational(2));nearRight=divideRational(addRational(middle,nearRight),rational(2));leftCount=rootCount(sequence,left,nearLeft);rightCount=rootCount(sequence,nearRight,right)}isolate(left,nearLeft,leftCount);working.push({root:{primitivePolynomial:primitive,rootIndex:0,isolating:[middle,middle],multiplicity},factor,sequence});isolate(nearRight,right,rightCount);return}if(count===1){working.push({root:{primitivePolynomial:primitive,rootIndex:0,isolating:[left,right],multiplicity},factor,sequence});return}const leftCount=rootCount(sequence,left,middle);isolate(left,middle,leftCount);isolate(middle,right,count-leftCount)};isolate(lo,hi,total)}const refine=(item:typeof working[number])=>{let[left,right]=item.root.isolating;if(compareRational(left,right)===0)return;const middle=divideRational(addRational(left,right),rational(2));if(polynomialSignAt(item.factor,middle)===0){item.root={...item.root,isolating:[middle,middle]};return}const leftCount=rootCount(item.sequence,left,middle);item.root={...item.root,isolating:leftCount>0?[left,middle]:[middle,right]}};for(;;){let changed=false;for(let i=0;i<working.length;i++)for(let j=i+1;j<working.length;j++){const a=working[i].root.isolating,b=working[j].root.isolating;if(compareRational(a[1],b[0])<0||compareRational(b[1],a[0])<0)continue;refine(working[i]);refine(working[j]);changed=true}if(!changed)break}working.sort((a,b)=>compareRational(a.root.isolating[0],b.root.isolating[0]));return working.map((item,rootIndex)=>({...item.root,rootIndex}))}

const integerPolynomialAt = (coefficients: readonly bigint[], at: bigint): bigint => {
  let value = BigInt(0)
  for (const coefficient of coefficients) value = value * at + coefficient
  return value
}

const signedDivisors = (value: bigint): bigint[] => {
  const magnitude = abs(value)
  if (magnitude === BigInt(0)) throw new RangeError('Kronecker point must not be a root')
  const values: bigint[] = []
  for (let divisor = BigInt(1); divisor * divisor <= magnitude; divisor++) {
    if (magnitude % divisor !== BigInt(0)) continue
    const paired = magnitude / divisor
    values.push(divisor, -divisor)
    if (paired !== divisor) values.push(paired, -paired)
  }
  return values.sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
}

const interpolateIntegerPolynomial = (
  points: readonly (readonly [bigint, bigint])[],
): bigint[] | null => {
  let coefficients: Rational[] = [rational(0)]
  for (let index = 0; index < points.length; index++) {
    let basis: Rational[] = [rational(1)]
    let denominator = rational(1)
    for (let other = 0; other < points.length; other++) {
      if (other === index) continue
      const next = Array.from({ length: basis.length + 1 }, () => rational(0))
      for (let power = 0; power < basis.length; power++) {
        next[power] = subtractRational(
          next[power], multiplyRational(basis[power], rational(points[other][0])),
        )
        next[power + 1] = addRational(next[power + 1], basis[power])
      }
      basis = next
      denominator = multiplyRational(
        denominator, rational(points[index][0] - points[other][0]),
      )
    }
    const scale = divideRational(rational(points[index][1]), denominator)
    while (coefficients.length < basis.length) coefficients.push(rational(0))
    for (let power = 0; power < basis.length; power++) {
      coefficients[power] = addRational(
        coefficients[power], multiplyRational(basis[power], scale),
      )
    }
  }
  if (coefficients.some((coefficient) => coefficient.denominator !== '1')) return null
  while (coefficients.length > 1 && coefficients.at(-1)!.numerator === '0') coefficients.pop()
  return coefficients.map((coefficient) => BigInt(coefficient.numerator)).reverse()
}

const exactIntegerPolynomialQuotient = (
  dividend: readonly bigint[], divisor: readonly bigint[],
): bigint[] | null => {
  const divided = polynomialDivRem(
    dividend.map((coefficient) => rational(coefficient)),
    divisor.map((coefficient) => rational(coefficient)),
  )
  if (divided.remainder.some((coefficient) => compareRational(coefficient, rational(0)) !== 0)) return null
  if (divided.quotient.some((coefficient) => coefficient.denominator !== '1')) return null
  return primitivePolynomial(divided.quotient.map((coefficient) => BigInt(coefficient.numerator))).map(BigInt)
}

/** Exact Kronecker factorization of one primitive square-free integer polynomial over Q. */
export function factorSquareFreePrimitivePolynomialOverQ(
  coefficients: readonly string[],
): string[][] {
  const normalized = normalizedSquareFreePrimitivePolynomial(coefficients).map(BigInt)
  const factor = (polynomial: bigint[]): bigint[][] => {
    const degree = polynomial.length - 1
    if (degree <= 1) return [polynomial]
    for (let factorDegree = 1; factorDegree <= Math.floor(degree / 2); factorDegree++) {
      const sample: bigint[] = []
      for (let magnitude = BigInt(0); sample.length < factorDegree + 1; magnitude++) {
        const candidates = magnitude === BigInt(0) ? [magnitude] : [magnitude, -magnitude]
        for (const value of candidates) {
          if (integerPolynomialAt(polynomial, value) !== BigInt(0)) sample.push(value)
          if (sample.length === factorDegree + 1) break
        }
      }
      const divisorSets = sample.map((value) => signedDivisors(integerPolynomialAt(polynomial, value)))
      const chosen: Array<readonly [bigint, bigint]> = []
      const search = (index: number): bigint[][] | null => {
        if (index < sample.length) {
          for (const divisor of divisorSets[index]) {
            chosen.push([sample[index], divisor])
            const found = search(index + 1)
            chosen.pop()
            if (found) return found
          }
          return null
        }
        const interpolated = interpolateIntegerPolynomial(chosen)
        if (!interpolated || interpolated.length - 1 !== factorDegree) return null
        const primitive = primitivePolynomial(interpolated).map(BigInt)
        if (primitive.length === 1 || primitive.length === polynomial.length) return null
        const quotient = exactIntegerPolynomialQuotient(polynomial, primitive)
        return quotient ? [...factor(primitive), ...factor(quotient)] : null
      }
      const found = search(0)
      if (found) return found
    }
    return [polynomial]
  }
  return factor(normalized)
    .map((value) => primitivePolynomial(value))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

export const polynomialRootCount = (
  coefficients: readonly string[], lo: Rational, hi: Rational,
): number => {
  const polynomial = coefficients.map((coefficient) => rational(coefficient))
  return rootCount(sturmSequence(polynomial), lo, hi)
}

export const allRealRootsOfSquareFreePolynomial = (
  coefficients: readonly string[],
): IsolatedPolynomialRoot[] => {
  const primitive = normalizedSquareFreePrimitivePolynomial(coefficients)
  const leading = abs(BigInt(primitive[0]))
  let maximum = BigInt(0)
  for (const coefficient of primitive.slice(1)) {
    const magnitude = abs(BigInt(coefficient))
    const ceiling = (magnitude + leading - BigInt(1)) / leading
    if (ceiling > maximum) maximum = ceiling
  }
  const bound = rational(maximum + BigInt(1))
  return isolatePrimitiveIntegerRoots(primitive, multiplyRational(rational(-1), bound), bound)
}

export interface RepresentedMinimalFactorProof {
  normalizedDefiningPolynomial: readonly string[]
  orderedIrreducibleFactors: readonly (readonly string[])[]
  representedMinimalPolynomial: readonly string[]
  representedRootIndex: number
  representedIsolating: readonly [Rational, Rational]
  rootCountsInIsolating: readonly number[]
}

export function proveRepresentedMinimalFactor(
  coefficients: readonly string[],
  isolating: readonly [Rational, Rational],
  representedRootIndex: number,
): RepresentedMinimalFactorProof {
  if (compareRational(isolating[0], isolating[1]) >= 0) {
    throw new RangeError('represented isolator must be ordered')
  }
  const normalizedDefiningPolynomial = normalizedSquareFreePrimitivePolynomial(coefficients)
  const orderedIrreducibleFactors = factorSquareFreePrimitivePolynomialOverQ(normalizedDefiningPolynomial)
  const rootCountsInIsolating = orderedIrreducibleFactors.map((factor) =>
    polynomialRootCount(factor, isolating[0], isolating[1]))
  const selected = rootCountsInIsolating
    .map((count, index) => ({ count, index }))
    .filter(({ count }) => count === 1)
  if (selected.length !== 1 || rootCountsInIsolating.some((count) => count > 1)) {
    throw new RangeError('represented isolator does not select exactly one irreducible factor root')
  }
  const representedMinimalPolynomial = orderedIrreducibleFactors[selected[0].index]
  const roots = allRealRootsOfSquareFreePolynomial(representedMinimalPolynomial)
  const matching = roots.filter((root) =>
    compareRational(root.isolating[1], isolating[0]) > 0
    && compareRational(root.isolating[0], isolating[1]) < 0)
  if (matching.length !== 1 || matching[0].rootIndex !== representedRootIndex) {
    throw new RangeError('represented root index does not match isolator')
  }
  return {
    normalizedDefiningPolynomial,
    orderedIrreducibleFactors,
    representedMinimalPolynomial,
    representedRootIndex,
    representedIsolating: matching[0].isolating,
    rootCountsInIsolating,
  }
}

export interface SparseIntegerTerm{coefficient:string;powers:readonly number[]}
export type SparseIntegerPolynomial=readonly SparseIntegerTerm[]
const sparseKey=(powers:readonly number[])=>powers.join(',')
export function normalizeSparseIntegerPolynomial(value:SparseIntegerPolynomial):SparseIntegerTerm[]{const terms=new Map<string,{coefficient:bigint;powers:number[]}>();for(const term of value){const key=sparseKey(term.powers),existing=terms.get(key);terms.set(key,{coefficient:(existing?.coefficient??BigInt(0))+BigInt(term.coefficient),powers:[...term.powers]})}const ordered=[...terms.values()].filter(term=>term.coefficient!==BigInt(0)).sort((a,b)=>{for(let i=0;i<Math.max(a.powers.length,b.powers.length);i++){const delta=(b.powers[i]??0)-(a.powers[i]??0);if(delta)return delta}return 0});return ordered.length?ordered.map(term=>({coefficient:term.coefficient.toString(),powers:term.powers})):[{coefficient:'0',powers:[]}]}
export function normalizeSparseEliminationStep(value:SparseIntegerPolynomial):{polynomial:SparseIntegerTerm[];removedIntegerContent:string[]}{const combined=normalizeSparseIntegerPolynomial(value);if(combined.length===1&&combined[0].coefficient==='0')return{polynomial:combined,removedIntegerContent:['0','1']};let content=BigInt(0);for(const term of combined)content=gcd(content,BigInt(term.coefficient));const sign=BigInt(combined[0].coefficient)<0?-BigInt(1):BigInt(1);return{polynomial:combined.map(term=>({coefficient:(sign*BigInt(term.coefficient)/content).toString(),powers:term.powers})),removedIntegerContent:[content.toString(),sign.toString()]}}
export function addSparseIntegerPolynomials(a:SparseIntegerPolynomial,b:SparseIntegerPolynomial):SparseIntegerTerm[]{return normalizeSparseIntegerPolynomial([...a,...b])}
export function multiplySparseIntegerPolynomials(a:SparseIntegerPolynomial,b:SparseIntegerPolynomial):SparseIntegerTerm[]{const terms:SparseIntegerTerm[]=[];for(const left of a)for(const right of b){const length=Math.max(left.powers.length,right.powers.length),powers=Array.from({length},(_,index)=>(left.powers[index]??0)+(right.powers[index]??0));terms.push({coefficient:(BigInt(left.coefficient)*BigInt(right.coefficient)).toString(),powers})}return normalizeSparseIntegerPolynomial(terms)}
export function encodeCanonicalMultivariatePolynomial(value:SparseIntegerPolynomial,arity:number):string[]{if(!Number.isInteger(arity)||arity<1)throw new RangeError('invalid polynomial arity');const combined=normalizeSparseIntegerPolynomial(value.map(term=>{if(term.powers.length!==arity)throw new RangeError('wrong exponent arity');return term}));if(combined.length===1&&combined[0].coefficient==='0')return[];return combined.map(term=>`${BigInt(term.coefficient).toString()}|${term.powers.join(',')}`)}
export function decodeCanonicalMultivariatePolynomial(tokens:readonly string[],arity:number):SparseIntegerTerm[]{if(tokens.length===1&&tokens[0]==='0')throw new RangeError('noncanonical zero polynomial');const terms:SparseIntegerTerm[]=tokens.map(token=>{const match=/^(-?(?:0|[1-9][0-9]*))\|([0-9]+(?:,[0-9]+)*)$/.exec(token);if(!match||match[1]==='-0'||match[1]==='0')throw new RangeError('noncanonical polynomial token');const powers=match[2].split(',').map(Number);if(powers.length!==arity||powers.some(power=>!Number.isSafeInteger(power)||power<0))throw new RangeError('wrong exponent arity');return{coefficient:match[1],powers}});const encoded=encodeCanonicalMultivariatePolynomial(terms,arity);if(JSON.stringify(encoded)!==JSON.stringify(tokens))throw new RangeError('noncanonical polynomial ordering');return terms}
export function encodeNormalizedSparseEliminationStep(value:SparseIntegerPolynomial,arity:number):{tokens:string[];removedIntegerContent:string[]}{const normalized=normalizeSparseEliminationStep(value);return{tokens:encodeCanonicalMultivariatePolynomial(normalized.polynomial,arity),removedIntegerContent:normalized.removedIntegerContent}}
export function projectFinalUnivariatePolynomial(tokens:readonly string[],arity:number):{coefficients:string[];removedExponentSlots:number[]}{const terms=decodeCanonicalMultivariatePolynomial(tokens,arity);if(terms.some(term=>term.powers.slice(1).some(power=>power!==0)))throw new RangeError('remaining algebraic generator in final projection');const degree=Math.max(...terms.map(term=>term.powers[0]),0),coefficients=Array.from({length:degree+1},()=>BigInt(0));for(const term of terms)coefficients[degree-term.powers[0]]+=BigInt(term.coefficient);return{coefficients:primitivePolynomial(coefficients).map(String),removedExponentSlots:Array.from({length:arity-1},(_,index)=>index+1)}}
const negateSparseIntegerPolynomial=(value:SparseIntegerPolynomial):SparseIntegerTerm[]=>value.map(term=>({coefficient:(-BigInt(term.coefficient)).toString(),powers:term.powers}))
const subtractSparseIntegerPolynomials=(a:SparseIntegerPolynomial,b:SparseIntegerPolynomial)=>addSparseIntegerPolynomials(a,negateSparseIntegerPolynomial(b))
const sparseDegree=(value:SparseIntegerPolynomial,variable:number)=>Math.max(...value.filter(term=>term.coefficient!=='0').map(term=>term.powers[variable]??0),-1)
const sparseLeadingCoefficient=(value:SparseIntegerPolynomial,variable:number):SparseIntegerTerm[]=>{const degree=sparseDegree(value,variable);return normalizeSparseIntegerPolynomial(value.filter(term=>(term.powers[variable]??0)===degree).map(term=>{const powers=[...term.powers];powers[variable]=0;return{coefficient:term.coefficient,powers}}))}
const shiftSparseVariable=(value:SparseIntegerPolynomial,variable:number,power:number):SparseIntegerTerm[]=>value.map(term=>{const powers=[...term.powers];powers[variable]=(powers[variable]??0)+power;return{coefficient:term.coefficient,powers}})
const powSparseIntegerPolynomial=(value:SparseIntegerPolynomial,power:number):SparseIntegerTerm[]=>{let out:SparseIntegerTerm[]=[{coefficient:'1',powers:Array(value[0]?.powers.length??1).fill(0)}];for(let index=0;index<power;index++)out=multiplySparseIntegerPolynomials(out,value);return out}
export function pseudoRemainderSparseIntegerPolynomial(dividend:SparseIntegerPolynomial,divisor:SparseIntegerPolynomial,variable:number):SparseIntegerTerm[]{let remainder=normalizeSparseIntegerPolynomial(dividend),divisorDegree=sparseDegree(divisor,variable);if(divisorDegree<0)throw new RangeError('zero pseudo-divisor');const leading=sparseLeadingCoefficient(divisor,variable);while(sparseDegree(remainder,variable)>=divisorDegree){const degree=sparseDegree(remainder,variable),delta=degree-divisorDegree,remainderLeading=sparseLeadingCoefficient(remainder,variable);remainder=subtractSparseIntegerPolynomials(multiplySparseIntegerPolynomials(leading,remainder),shiftSparseVariable(multiplySparseIntegerPolynomials(remainderLeading,divisor),variable,delta))}return normalizeSparseIntegerPolynomial(remainder)}
const sparseIsZero=(value:SparseIntegerPolynomial)=>value.length===0||(value.length===1&&value[0].coefficient==='0')
const divideSparseIntegerPolynomialExact=(dividend:SparseIntegerPolynomial,divisor:SparseIntegerPolynomial):SparseIntegerTerm[]=>{let remainder=normalizeSparseIntegerPolynomial(dividend);const target=normalizeSparseIntegerPolynomial(divisor);if(sparseIsZero(target))throw new RangeError('zero sparse divisor');const quotient:SparseIntegerTerm[]=[];while(!sparseIsZero(remainder)){const leadR=remainder[0],leadD=target[0],powers=leadR.powers.map((power,index)=>power-(leadD.powers[index]??0));if(powers.some(power=>power<0)||BigInt(leadR.coefficient)%BigInt(leadD.coefficient)!==BigInt(0))throw new RangeError('sparse division is not exact');const term={coefficient:(BigInt(leadR.coefficient)/BigInt(leadD.coefficient)).toString(),powers};quotient.push(term);remainder=subtractSparseIntegerPolynomials(remainder,multiplySparseIntegerPolynomials([term],target))}return normalizeSparseIntegerPolynomial(quotient)}
const sparseConstant=(value:bigint,arity:number):SparseIntegerTerm[]=>[{coefficient:value.toString(),powers:Array(arity).fill(0)}]
export interface SparseCommonComponentProof{
  gcd:string[]
  predicateCofactor:string[]
  definingCofactor:string[]
  backSubstitutionDisposition:'PENDING'|'REPRESENTED_ROOT_COMPONENT'|'EXTRANEOUS_COMPONENT_REJECTED'
  continuationResultant?:string[]
}
export interface SparseSubresultantElimination{normalizedSubresultants:string[][];normalizedResultant:string[]|null;removedIntegerContent:string[];commonFactorDisposition:'NONE'|'DECOMPOSED'|'IDENTICALLY_ZERO';commonComponentProofs:SparseCommonComponentProof[];zeroPolynomialProofSource:string[]|null;resolved:boolean;unresolved:boolean}
export function eliminateSparseGeneratorBySubresultants(predicate:SparseIntegerPolynomial,defining:SparseIntegerPolynomial,variable:number,arity:number):SparseSubresultantElimination{const empty={normalizedSubresultants:[]as string[][],normalizedResultant:null,removedIntegerContent:[]as string[],commonComponentProofs:[]as SparseCommonComponentProof[],zeroPolynomialProofSource:null as string[]|null};try{let previous=normalizeSparseIntegerPolynomial(predicate),current=normalizeSparseIntegerPolynomial(defining);if(sparseIsZero(previous))return{...empty,commonFactorDisposition:'IDENTICALLY_ZERO',zeroPolynomialProofSource:[],resolved:true,unresolved:false};const originalPredicate=previous,originalDefining=current;if(sparseDegree(previous,variable)<sparseDegree(current,variable))[previous,current]=[current,previous];let deltaPrevious=sparseDegree(previous,variable)-sparseDegree(current,variable),beta=sparseConstant((deltaPrevious+1)%2===0?BigInt(1):-BigInt(1),arity),psi=sparseConstant(-BigInt(1),arity);const records:string[][]=[],removed:string[]=[];for(;;){const prem=pseudoRemainderSparseIntegerPolynomial(previous,current,variable);if(sparseIsZero(prem)){const degree=sparseDegree(current,variable);if(degree===0)return{...empty,normalizedSubresultants:records,normalizedResultant:encodeNormalizedSparseEliminationStep(current,arity).tokens,removedIntegerContent:removed,commonFactorDisposition:'NONE',resolved:true,unresolved:false};const gcd=encodeNormalizedSparseEliminationStep(current,arity).tokens,predicateCofactor=encodeCanonicalMultivariatePolynomial(divideSparseIntegerPolynomialExact(originalPredicate,current),arity),definingCofactor=encodeCanonicalMultivariatePolynomial(divideSparseIntegerPolynomialExact(originalDefining,current),arity);return{...empty,normalizedSubresultants:records,removedIntegerContent:removed,commonFactorDisposition:'DECOMPOSED',commonComponentProofs:[{gcd,predicateCofactor,definingCofactor,backSubstitutionDisposition:'PENDING'}],resolved:false,unresolved:false}}const next=divideSparseIntegerPolynomialExact(negateSparseIntegerPolynomial(prem),beta),normalized=encodeNormalizedSparseEliminationStep(next,arity);records.push(normalized.tokens);removed.push(...normalized.removedIntegerContent);const degree=sparseDegree(next,variable);if(degree===0)return{...empty,normalizedSubresultants:records,normalizedResultant:normalized.tokens,removedIntegerContent:removed,commonFactorDisposition:'NONE',resolved:true,unresolved:false};const delta=sparseDegree(current,variable)-degree,negativeLeading=negateSparseIntegerPolynomial(sparseLeadingCoefficient(current,variable)),psiNumerator=powSparseIntegerPolynomial(negativeLeading,deltaPrevious),psiDenominator=powSparseIntegerPolynomial(psi,Math.max(0,deltaPrevious-1)),psiNext=divideSparseIntegerPolynomialExact(psiNumerator,psiDenominator),betaNext=negateSparseIntegerPolynomial(multiplySparseIntegerPolynomials(sparseLeadingCoefficient(current,variable),powSparseIntegerPolynomial(psiNext,delta)));previous=current;current=next;deltaPrevious=delta;psi=psiNext;beta=betaNext}}
catch{return{...empty,commonFactorDisposition:'NONE',resolved:false,unresolved:true}}}

const sparseDerivativeInParameter = (value: SparseIntegerPolynomial): SparseIntegerTerm[] =>
  normalizeSparseIntegerPolynomial(value.flatMap((term) => {
    const power = term.powers[0] ?? 0
    if (power === 0) return []
    const powers = [...term.powers]
    powers[0] = power - 1
    return [{ coefficient: (BigInt(term.coefficient) * BigInt(power)).toString(), powers }]
  }))

export const differentiateSparseParameter = sparseDerivativeInParameter

type RationalVector = Rational[]
type RationalMatrix = Rational[][]

const zeroVector = (length: number): RationalVector =>
  Array.from({ length }, () => rational(0))

const identityMatrix = (size: number): RationalMatrix =>
  Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => rational(row === column ? 1 : 0)))

const addMatrices = (left: RationalMatrix, right: RationalMatrix): RationalMatrix =>
  left.map((row, i) => row.map((value, j) => addRational(value, right[i][j])))

const multiplyMatrices = (left: RationalMatrix, right: RationalMatrix): RationalMatrix =>
  left.map((row) => right[0].map((_, column) => row.reduce(
    (sum, value, index) => addRational(sum, multiplyRational(value, right[index][column])),
    rational(0),
  )))

const scaleMatrix = (value: RationalMatrix, scale: Rational): RationalMatrix =>
  value.map((row) => row.map((entry) => multiplyRational(entry, scale)))

const matrixVector = (matrix: RationalMatrix, vector: RationalVector): RationalVector =>
  matrix.map((row) => row.reduce(
    (sum, entry, index) => addRational(sum, multiplyRational(entry, vector[index])),
    rational(0),
  ))

const characteristicPolynomial = (matrix: RationalMatrix): string[] => {
  const size = matrix.length
  let auxiliary = identityMatrix(size)
  const coefficients: Rational[] = [rational(1)]
  for (let order = 1; order <= size; order++) {
    const product = multiplyMatrices(matrix, auxiliary)
    const trace = product.reduce((sum, row, index) => addRational(sum, row[index]), rational(0))
    const coefficient = multiplyRational(rational(-1, order), trace)
    coefficients.push(coefficient)
    auxiliary = addMatrices(product, scaleMatrix(identityMatrix(size), coefficient))
  }
  return rationalPolynomialPrimitive(coefficients)
}

const polynomialExtendedGcd = (
  left: RationalPolynomial, right: RationalPolynomial,
): { gcd: RationalPolynomial; left: RationalPolynomial; right: RationalPolynomial } => {
  let oldR = trimPolynomial(left), r = trimPolynomial(right)
  let oldS: RationalPolynomial = [rational(1)], s: RationalPolynomial = [rational(0)]
  let oldT: RationalPolynomial = [rational(0)], t: RationalPolynomial = [rational(1)]
  const addPolynomial = (a: RationalPolynomial, b: RationalPolynomial, sign = 1) => {
    const length = Math.max(a.length, b.length)
    const padded = (value: RationalPolynomial) => [
      ...Array.from({ length: length - value.length }, () => rational(0)), ...value,
    ]
    const aa = padded(a), bb = padded(b)
    return trimPolynomial(aa.map((value, index) =>
      sign > 0 ? addRational(value, bb[index]) : subtractRational(value, bb[index])))
  }
  const multiplyPolynomial = (a: RationalPolynomial, b: RationalPolynomial) => {
    const out = Array.from({ length: a.length + b.length - 1 }, () => rational(0))
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
      out[i + j] = addRational(out[i + j], multiplyRational(a[i], b[j]))
    }
    return trimPolynomial(out)
  }
  while (!(r.length === 1 && compareRational(r[0], rational(0)) === 0)) {
    const divided = polynomialDivRem(oldR, r)
    ;[oldR, r] = [r, divided.remainder]
    ;[oldS, s] = [s, addPolynomial(oldS, multiplyPolynomial(divided.quotient, s), -1)]
    ;[oldT, t] = [t, addPolynomial(oldT, multiplyPolynomial(divided.quotient, t), -1)]
  }
  const leading = oldR[0]
  return {
    gcd: oldR.map((value) => divideRational(value, leading)),
    left: oldS.map((value) => divideRational(value, leading)),
    right: oldT.map((value) => divideRational(value, leading)),
  }
}

const polynomialMatrixValue = (coefficients: RationalPolynomial, matrix: RationalMatrix): RationalMatrix => {
  let value = scaleMatrix(identityMatrix(matrix.length), coefficients[0])
  for (const coefficient of coefficients.slice(1)) {
    value = addMatrices(
      multiplyMatrices(value, matrix),
      scaleMatrix(identityMatrix(matrix.length), coefficient),
    )
  }
  return value
}

const multiplyRationalPolynomials = (left: RationalPolynomial, right: RationalPolynomial) => {
  const product = Array.from({ length: left.length + right.length - 1 }, () => rational(0))
  for (let i = 0; i < left.length; i++) for (let j = 0; j < right.length; j++) {
    product[i + j] = addRational(product[i + j], multiplyRational(left[i], right[j]))
  }
  return trimPolynomial(product)
}

const rationalCoordinatePolynomials = (value: RationalPolynomial) => {
  const denominator = value.reduce(
    (product, coefficient) => product * BigInt(coefficient.denominator), BigInt(1),
  )
  return {
    numerator: value.map((coefficient) =>
      (BigInt(coefficient.numerator) * (denominator / BigInt(coefficient.denominator))).toString()),
    denominator: [denominator.toString()],
  }
}

const solveLinearColumns = (columns: RationalVector[], target: RationalVector): RationalVector | null => {
  const rows = target.length, width = columns.length
  const augmented = Array.from({ length: rows }, (_, row) => [
    ...columns.map((column) => column[row]), target[row],
  ])
  let pivotRow = 0
  const pivots: number[] = []
  for (let column = 0; column < width && pivotRow < rows; column++) {
    const found = augmented.findIndex((row, index) =>
      index >= pivotRow && compareRational(row[column], rational(0)) !== 0)
    if (found < 0) continue
    ;[augmented[pivotRow], augmented[found]] = [augmented[found], augmented[pivotRow]]
    const pivot = augmented[pivotRow][column]
    augmented[pivotRow] = augmented[pivotRow].map((value) => divideRational(value, pivot))
    for (let row = 0; row < rows; row++) {
      if (row === pivotRow) continue
      const scale = augmented[row][column]
      if (compareRational(scale, rational(0)) === 0) continue
      augmented[row] = augmented[row].map((value, index) =>
        subtractRational(value, multiplyRational(scale, augmented[pivotRow][index])))
    }
    pivots[pivotRow] = column
    pivotRow++
  }
  for (const row of augmented) {
    if (row.slice(0, width).every((value) => compareRational(value, rational(0)) === 0)
      && compareRational(row[width], rational(0)) !== 0) return null
  }
  const solution = zeroVector(width)
  for (let row = 0; row < pivotRow; row++) solution[pivots[row]] = augmented[row][width]
  return solution
}

export interface RawAlgebraicTupleValue {
  valueIdentity: string
  exact: ExactReal
  proof?: AlgebraicGeneratorProof
}

export interface RawAlgebraicTuple {
  orderedValues: readonly RawAlgebraicTupleValue[]
  primitiveCoefficients: readonly Rational[]
  primitiveMinimalPolynomial: readonly string[]
  primitiveRootIndex: number
  primitiveIsolating: readonly [Rational, Rational]
  coordinates: readonly { valueIdentity: string; numerator: readonly string[]; denominator: readonly string[] }[]
  rejectedCoefficientVectors: readonly (readonly Rational[])[]
}

const primitiveCoefficientVectors = function* (length: number): Generator<Rational[]> {
  for (let height = 1; ; height++) {
    const visit = function* (prefix: number[]): Generator<Rational[]> {
      if (prefix.length === length) {
        if (Math.max(...prefix.map(Math.abs)) === height) yield prefix.map((value) => rational(value))
        return
      }
      for (let value = -height; value <= height; value++) yield* visit([...prefix, value])
    }
    yield* visit([])
  }
}

export function constructRawAlgebraicTuple(
  values: readonly RawAlgebraicTupleValue[],
): RawAlgebraicTuple | null {
  const orderedValues = [...values].sort((a, b) => a.valueIdentity.localeCompare(b.valueIdentity))
  const algebraic = orderedValues.filter((value) => !isRational(value.exact))
  if (algebraic.some((value) => !value.proof || !isAlgebraic(value.exact))) return null
  if (algebraic.length === 0) {
    return {
      orderedValues, primitiveCoefficients: [], primitiveMinimalPolynomial: ['1', '0'],
      primitiveRootIndex: 0, primitiveIsolating: [rational(0), rational(0)],
      coordinates: orderedValues.map((value) => ({
        valueIdentity: value.valueIdentity,
        numerator: [(value.exact as Rational).numerator],
        denominator: [(value.exact as Rational).denominator],
      })),
      rejectedCoefficientVectors: [],
    }
  }
  const degrees = algebraic.map((value) => value.proof!.representedMinimalPolynomial.length - 1)
  const dimension = degrees.reduce((product, degree) => product * degree, 1)
  const strides = degrees.map((_, index) => degrees.slice(index + 1).reduce((product, degree) => product * degree, 1))
  const coordinateMatrices = algebraic.map((value, coordinate) => {
    const matrix = Array.from({ length: dimension }, () => zeroVector(dimension))
    const polynomial = value.proof!.representedMinimalPolynomial.map((coefficient) => rational(coefficient))
    for (let basis = 0; basis < dimension; basis++) {
      const exponent = Math.floor(basis / strides[coordinate]) % degrees[coordinate]
      if (exponent + 1 < degrees[coordinate]) {
        matrix[basis + strides[coordinate]][basis] = rational(1)
      } else {
        for (let targetExponent = 0; targetExponent < degrees[coordinate]; targetExponent++) {
          const target = basis - exponent * strides[coordinate] + targetExponent * strides[coordinate]
          const coefficient = polynomial[polynomial.length - 1 - targetExponent]
          matrix[target][basis] = multiplyRational(
            rational(-1), divideRational(coefficient, polynomial[0]),
          )
        }
      }
    }
    return matrix
  })
  const rejectedCoefficientVectors: Rational[][] = []
  for (const coefficients of primitiveCoefficientVectors(algebraic.length)) {
    let alpha = scaleMatrix(identityMatrix(dimension), rational(0))
    let lower = rational(0), upper = rational(0)
    for (let index = 0; index < algebraic.length; index++) {
      alpha = addMatrices(alpha, scaleMatrix(coordinateMatrices[index], coefficients[index]))
      const proof = algebraic[index].proof!
      const products = proof.representedIsolating.map((bound) => multiplyRational(bound, coefficients[index]))
      lower = addRational(lower, compareRational(products[0], products[1]) <= 0 ? products[0] : products[1])
      upper = addRational(upper, compareRational(products[0], products[1]) <= 0 ? products[1] : products[0])
    }
    let characteristic: string[]
    let factors: string[][]
    try {
      characteristic = normalizedSquareFreePrimitivePolynomial(characteristicPolynomial(alpha))
      factors = factorSquareFreePrimitivePolynomialOverQ(characteristic)
    } catch {
      rejectedCoefficientVectors.push(coefficients)
      continue
    }
    const selected = factors.filter((factor) => polynomialRootCount(factor, lower, upper) === 1)
    if (selected.length !== 1) {
      rejectedCoefficientVectors.push(coefficients)
      continue
    }
    const primitiveMinimalPolynomial = selected[0]
    const roots = allRealRootsOfSquareFreePolynomial(primitiveMinimalPolynomial)
    const root = roots.find((candidate) =>
      compareRational(candidate.isolating[1], lower) > 0
      && compareRational(candidate.isolating[0], upper) < 0)
    if (!root) {
      rejectedCoefficientVectors.push(coefficients)
      continue
    }
    const characteristicQ = characteristic.map((coefficient) => rational(coefficient))
    const minimalQ = primitiveMinimalPolynomial.map((coefficient) => rational(coefficient))
    const cofactor = polynomialDivRem(characteristicQ, minimalQ).quotient
    const bezout = polynomialExtendedGcd(minimalQ, cofactor)
    if (!polynomialIsOne(bezout.gcd)) {
      rejectedCoefficientVectors.push(coefficients)
      continue
    }
    const projector = polynomialMatrixValue(
      polynomialDivRem(multiplyRationalPolynomials(bezout.right, cofactor), characteristicQ).remainder,
      alpha,
    )
    const projectedOne = matrixVector(projector, [rational(1), ...zeroVector(dimension - 1)])
    const degree = primitiveMinimalPolynomial.length - 1
    const alphaColumns: RationalVector[] = []
    let power = identityMatrix(dimension)
    for (let index = 0; index < degree; index++) {
      alphaColumns.push(matrixVector(projector, matrixVector(power, [rational(1), ...zeroVector(dimension - 1)])))
      power = multiplyMatrices(alpha, power)
    }
    const coordinates = orderedValues.map((value) => {
      if (isRational(value.exact)) return {
        valueIdentity: value.valueIdentity,
        ...rationalCoordinatePolynomials([value.exact]),
      }
      const coordinate = algebraic.findIndex((candidate) => candidate.valueIdentity === value.valueIdentity)
      const target = matrixVector(projector, matrixVector(
        coordinateMatrices[coordinate], [rational(1), ...zeroVector(dimension - 1)],
      ))
      const solved = solveLinearColumns(alphaColumns, target)
      if (!solved) throw new RangeError('primitive coordinate recovery unresolved')
      return {
        valueIdentity: value.valueIdentity,
        ...rationalCoordinatePolynomials([...solved].reverse()),
      }
    })
    void projectedOne
    return {
      orderedValues,
      primitiveCoefficients: coefficients,
      primitiveMinimalPolynomial,
      primitiveRootIndex: root.rootIndex,
      primitiveIsolating: root.isolating,
      coordinates,
      rejectedCoefficientVectors,
    }
  }
  return null
}

export interface RawAlgebraicTupleValueEvaluation {
  expressionIdentity: string
  reducedNumerator: readonly string[]
  reducedDenominator: readonly string[]
  disposition: 'ZERO' | 'NONZERO'
}

const powRationalPolynomial = (value: RationalPolynomial, power: number): RationalPolynomial => {
  let result: RationalPolynomial = [rational(1)]
  for (let index = 0; index < power; index++) result = multiplyRationalPolynomials(result, value)
  return result
}

export function evaluateRawAlgebraicTuplePolynomial(
  tuple: RawAlgebraicTuple,
  expressionIdentity: string,
  expression: SparseIntegerPolynomial,
  variableValueIdentities: readonly string[],
): RawAlgebraicTupleValueEvaluation | null {
  if (expression.some((term) => term.powers.length !== variableValueIdentities.length)) return null
  const coordinates = variableValueIdentities.map((identity) =>
    tuple.coordinates.find((coordinate) => coordinate.valueIdentity === identity))
  if (coordinates.some((coordinate) => !coordinate)) return null
  const numerators = coordinates.map((coordinate) => coordinate!.numerator.map((value) => rational(value)))
  const denominators = coordinates.map((coordinate) => coordinate!.denominator.map((value) => rational(value)))
  const maximumPowers = variableValueIdentities.map((_, variable) =>
    Math.max(...expression.map((term) => term.powers[variable] ?? 0), 0))
  let cleared: RationalPolynomial = [rational(0)]
  for (const term of expression) {
    let substituted: RationalPolynomial = [rational(term.coefficient)]
    for (let variable = 0; variable < variableValueIdentities.length; variable++) {
      substituted = multiplyRationalPolynomials(
        substituted,
        powRationalPolynomial(numerators[variable], term.powers[variable] ?? 0),
      )
      substituted = multiplyRationalPolynomials(
        substituted,
        powRationalPolynomial(
          denominators[variable], maximumPowers[variable] - (term.powers[variable] ?? 0),
        ),
      )
    }
    const length = Math.max(cleared.length, substituted.length)
    const pad = (value: RationalPolynomial) => [
      ...Array.from({ length: length - value.length }, () => rational(0)), ...value,
    ]
    const left = pad(cleared), right = pad(substituted)
    cleared = trimPolynomial(left.map((value, index) => addRational(value, right[index])))
  }
  const denominator = denominators.reduce(
    (product, value, index) => multiplyRationalPolynomials(
      product, powRationalPolynomial(value, maximumPowers[index]),
    ), [rational(1)] as RationalPolynomial,
  )
  const minimal = tuple.primitiveMinimalPolynomial.map((value) => rational(value))
  if (!polynomialIsOne(polynomialGcd(denominator, minimal))) return null
  const reducedNumeratorQ = polynomialDivRem(cleared, minimal).remainder
  const reducedDenominatorQ = polynomialDivRem(denominator, minimal).remainder
  const reducedNumerator = rationalCoordinatePolynomials(reducedNumeratorQ)
  const reducedDenominator = rationalCoordinatePolynomials(reducedDenominatorQ)
  const numeratorScale = BigInt(reducedDenominator.denominator[0])
  const denominatorScale = BigInt(reducedNumerator.denominator[0])
  return {
    expressionIdentity,
    reducedNumerator: reducedNumerator.numerator.map((value) =>
      (BigInt(value) * numeratorScale).toString()),
    reducedDenominator: reducedDenominator.numerator.map((value) =>
      (BigInt(value) * denominatorScale).toString()),
    disposition: reducedNumeratorQ.every((value) => compareRational(value, rational(0)) === 0)
      ? 'ZERO' : 'NONZERO',
  }
}
