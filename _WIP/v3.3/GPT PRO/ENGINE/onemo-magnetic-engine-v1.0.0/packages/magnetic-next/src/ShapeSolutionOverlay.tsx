'use client';
import type { SizeSolution } from '@onemo/magnetic-logic';
export interface ShapeSolutionOverlayProps {readonly solution:SizeSolution;readonly coordinateQuantumMm:number;readonly discRadiusMm?:number;readonly className?:string;}
export function ShapeSolutionOverlay({solution,coordinateQuantumMm,discRadiusMm=12,className}:ShapeSolutionOverlayProps){
  const ring=solution.finalRingInt.map(([x,y])=>({x:x*coordinateQuantumMm,y:y*coordinateQuantumMm}));
  const xs=ring.map(point=>point.x),ys=ring.map(point=>point.y);const pad=discRadiusMm+4;
  const minX=Math.min(...xs)-pad,maxX=Math.max(...xs)+pad,minY=Math.min(...ys)-pad,maxY=Math.max(...ys)+pad;
  return <svg className={className} viewBox={`${minX} ${-maxY} ${maxX-minX} ${maxY-minY}`} role="img" aria-label={`${solution.band} ${solution.patternId} magnetic layout`}>
    <polygon data-final-geometry-hash={solution.geometryHash} points={ring.map(point=>`${point.x},${-point.y}`).join(' ')} fill="none" stroke="currentColor" />
    {solution.centres.map((centre,index)=><g key={`${centre.cell[0]}:${centre.cell[1]}:${index}`} transform={`translate(${centre.xMm} ${-centre.yMm})`}>
      <circle r={discRadiusMm} fill="none" stroke="currentColor" opacity={0.55}/><circle r={2} fill="currentColor"/><text x={3} y={-3} fontSize={6}>{`${centre.cell[0]},${centre.cell[1]}`}</text>
    </g>)}
  </svg>;
}
