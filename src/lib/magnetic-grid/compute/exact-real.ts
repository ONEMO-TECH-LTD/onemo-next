import type { AlgebraicReal, CertifiedExpressionReal, ExactReal, Rational } from '../spec'

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
): ExactReal[] {
  const polynomial = primitiveQuadratic(lcmDenominatorPolynomial(a, b, c))
  if (polynomial[0] === BigInt(0)) throw new RangeError('quadratic coefficient must be nonzero')
  const discriminant = polynomial[1] * polynomial[1] - BigInt(4) * polynomial[0] * polynomial[2]
  if (discriminant < BigInt(0)) return []
  const vertex = rational(-polynomial[1], BigInt(2) * polynomial[0])
  const roots: ExactReal[] = []
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
