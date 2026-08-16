'use client';
import type { SizeSolution } from '@onemo/magnetic-logic';
export interface ShapeSolutionOverlayProps {readonly solution:SizeSolution;readonly discRadiusMm?:number;readonly className?:string;}
export function ShapeSolutionOverlay({solution,discRadiusMm=12,className}:ShapeSolutionOverlayProps){
  const pad=discRadiusMm+4;const minX=-solution.widthMm/2-pad,minY=-solution.heightMm/2-pad,width=solution.widthMm+2*pad,height=solution.heightMm+2*pad;
  return <svg className={className} viewBox={`${minX} ${-minY-height} ${width} ${height}`} role="img" aria-label={`${solution.band} ${solution.patternId} magnetic layout`}>
    <rect x={-solution.widthMm/2} y={-solution.heightMm/2} width={solution.widthMm} height={solution.heightMm} fill="none" stroke="currentColor" strokeDasharray="2 2" />
    {solution.centres.map((centre,index)=><g key={`${centre.cell[0]}:${centre.cell[1]}:${index}`} transform={`translate(${centre.xMm} ${-centre.yMm})`}>
      <circle r={discRadiusMm} fill="none" stroke="currentColor" opacity={0.55}/><circle r={2} fill="currentColor"/><text x={3} y={-3} fontSize={6}>{`${centre.cell[0]},${centre.cell[1]}`}</text>
    </g>)}
  </svg>;
}
