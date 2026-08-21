import type {
  BoundaryElement, ContactWitness, Contour, ExactReal, ExactScale, PreparedContour,
  Pt, Rational, WrapMeasurement,
} from '../spec'
import {
  addRational, allowancePolynomial, approximateExact, compareRational,
  divideRational, multiplyRational, rational, rationalFromNumber, sqrtMinusRational,
  squareRational, subtractRational,
} from './exact-real'

type ExactPoint = readonly [Rational, Rational]
type UncertifiedWrapMeasurement=Omit<WrapMeasurement,'witnesses'>&{witnesses:Array<Omit<ContactWitness,'certificateId'>>}

const exactPoint = ([x,y]: Pt): ExactPoint => [rationalFromNumber(x), rationalFromNumber(y)]
const dot = (a: ExactPoint,b: ExactPoint) => addRational(multiplyRational(a[0],b[0]),multiplyRational(a[1],b[1]))
const minus = (a: ExactPoint,b: ExactPoint): ExactPoint => [subtractRational(a[0],b[0]),subtractRational(a[1],b[1])]
const plus = (a: ExactPoint,b: ExactPoint): ExactPoint => [addRational(a[0],b[0]),addRational(a[1],b[1])]
const times = (p: ExactPoint,s: Rational): ExactPoint => [multiplyRational(p[0],s),multiplyRational(p[1],s)]
const squaredLength = (p: ExactPoint) => addRational(squareRational(p[0]),squareRational(p[1]))
const cross = (a: ExactPoint,b: ExactPoint) => subtractRational(multiplyRational(a[0],b[1]),multiplyRational(a[1],b[0]))

const locateInRing = (point: ExactPoint,ring:ReadonlyArray<Pt>):'IN'|'OUT'|'ON' => {
  const points=ring.map(exactPoint);let winding=0
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],ap=minus(point,a),ab=minus(b,a),turn=compareRational(cross(ab,ap),rational(0))
    const withinX=compareRational(point[0],compareRational(a[0],b[0])<=0?a[0]:b[0])>=0&&compareRational(point[0],compareRational(a[0],b[0])>=0?a[0]:b[0])<=0
    const withinY=compareRational(point[1],compareRational(a[1],b[1])<=0?a[1]:b[1])>=0&&compareRational(point[1],compareRational(a[1],b[1])>=0?a[1]:b[1])<=0
    if(turn===0&&withinX&&withinY)return'ON'
    const ay=compareRational(a[1],point[1]),by=compareRational(b[1],point[1])
    if(ay<=0&&by>0&&turn>0)winding++
    else if(ay>0&&by<=0&&turn<0)winding--
  }
  return winding===0?'OUT':'IN'
}

const insideMaterial = (point: ExactPoint,contour:Contour) =>
  locateInRing(point,contour.outer.pts)==='IN'&&contour.holes.every(hole=>locateInRing(point,hole.pts)==='OUT')

const pointToElement = (point: ExactPoint, element: BoundaryElement) => {
  const segment = minus(element.b,element.a), relative = minus(point,element.a)
  const projection = dot(relative,segment), lengthSquared = squaredLength(segment)
  let tangency: ExactPoint
  if (compareRational(lengthSquared,rational(0))===0 || compareRational(projection,rational(0))<=0) tangency=element.a
  else if (compareRational(projection,lengthSquared)>=0) tangency=element.b
  else tangency=plus(element.a,times(segment,divideRational(projection,lengthSquared)))
  return { squaredDistance:squaredLength(minus(point,tangency)), tangency }
}

const exactScale = (contour: Contour): ExactScale => {
  const points = contour.outer.pts.map(exactPoint)
  if(!points.length)return{exact:rational(0),approximateMM:0}
  let minX=points[0][0],maxX=points[0][0],minY=points[0][1],maxY=points[0][1]
  for(const [x,y] of points){if(compareRational(x,minX)<0)minX=x;if(compareRational(x,maxX)>0)maxX=x;if(compareRational(y,minY)<0)minY=y;if(compareRational(y,maxY)>0)maxY=y}
  const width=subtractRational(maxX,minX),height=subtractRational(maxY,minY)
  const exact=compareRational(width,height)>=0?width:height
  return { exact, approximateMM:approximateExact(exact) }
}

export function prepareContour(contour: Contour,truth:PreparedContour['truth']): PreparedContour {
  const elements: BoundaryElement[]=[]
  type RingId='outer'|`hole:${number}`
  const rings:Array<readonly [RingId,ReadonlyArray<Pt>]>=[['outer',contour.outer.pts],...contour.holes.map((hole,index)=>[`hole:${index}` as const,hole.pts] as const)]
  for(const [ringId,points] of rings){
    for(let i=0,j=points.length-1;i<points.length;j=i++) elements.push({kind:'segment',id:`${ringId}:segment:${i}`,a:exactPoint(points[j]),b:exactPoint(points[i])})
  }
  return {source:contour,boundary:elements,truth,identity:truth.contourIdentity}
}

export function measureWrap(prepared:PreparedContour,belt:ReadonlyArray<Pt>,spotRadiusMM:number):UncertifiedWrapMeasurement{
  const contour=prepared.source,scale=exactScale(contour),radius=rationalFromNumber(spotRadiusMM)
  if(contour.outer.pts.length<3||prepared.boundary.length===0)return{scale,boundaryTruth:prepared.truth,requiredFlap:rational(0),requiredFlapApproxMM:0,witnesses:[] as Array<Omit<ContactWitness,'certificateId'>>,refusal:{code:'NO_WRAPPED_LAYOUT_IN_BAND' as const,reason:'invalid-boundary' as const}}
  if(belt.length===0)return{scale,boundaryTruth:prepared.truth,requiredFlap:rational(0),requiredFlapApproxMM:0,witnesses:[] as Array<Omit<ContactWitness,'certificateId'>>,refusal:{code:'NO_WRAPPED_LAYOUT_IN_BAND' as const,reason:'empty-belt' as const}}
  let bindingDistance:Rational|undefined,bindingAllowance:ExactReal=rational(0)
  const witnesses:Array<Omit<ContactWitness,'certificateId'>>=[]
  let validSeat=true
  belt.forEach((anchor)=>{
    const point=exactPoint(anchor),measured=prepared.boundary.map(element=>({element,...pointToElement(point,element)}))
    let nearest=measured[0].squaredDistance
    for(const item of measured)if(compareRational(item.squaredDistance,nearest)<0)nearest=item.squaredDistance
    const allowance=sqrtMinusRational(nearest,radius),anchorId=`belt:${JSON.stringify(point)}`
    if(!insideMaterial(point,contour)||compareRational(nearest,squareRational(radius))<0)validSeat=false
    for(const item of measured.filter(candidate=>compareRational(candidate.squaredDistance,nearest)===0)){
      const equation={kind:'polynomial' as const,polynomial:allowancePolynomial(nearest,radius),rootIndex:1}
      const tangency={x:item.tangency[0],y:item.tangency[1]}
      const core={scale,boundaryTruth:prepared.truth,beltAnchorId:anchorId,outlineElementId:item.element.id,outlineElementKind:'segment' as const,allowance,equation,tangency,regimeId:'fixed-size'}
      witnesses.push(core)
    }
    if(!bindingDistance||compareRational(nearest,bindingDistance)>0){bindingDistance=nearest;bindingAllowance=allowance}
  })
  return {scale,boundaryTruth:prepared.truth,requiredFlap:bindingAllowance,requiredFlapApproxMM:approximateExact(bindingAllowance),witnesses,refusal:validSeat?null:{code:'WRAP_EXCEEDS_ALLOWANCE',reason:'invalid-seat'}}
}
