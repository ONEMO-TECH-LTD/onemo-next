import type { LatticePoint, Point } from './contracts.js';
import { ComputeError } from './contracts.js';

export function generateLattice(
  origin:Point,
  basisX:Point,
  basisY:Point,
  range:{minI:number;maxI:number;minJ:number;maxJ:number}
):LatticePoint[]{
  const determinant=basisX.x*basisY.y-basisX.y*basisY.x;
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)throw new ComputeError('INVALID_LATTICE_BASIS','lattice bases must be finite and independent',{basisX,basisY});
  for(const n of [range.minI,range.maxI,range.minJ,range.maxJ])if(!Number.isInteger(n))throw new ComputeError('INVALID_LATTICE_BASIS','lattice index bounds must be integers',{range});
  const result:LatticePoint[]=[];
  for(let j=range.minJ;j<=range.maxJ;j++)for(let i=range.minI;i<=range.maxI;i++)result.push({i,j,x:origin.x+i*basisX.x+j*basisY.x,y:origin.y+i*basisX.y+j*basisY.y});
  return result;
}
