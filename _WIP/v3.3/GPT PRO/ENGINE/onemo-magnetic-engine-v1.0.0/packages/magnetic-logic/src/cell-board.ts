import type { Point, RegisteredProfile } from './contracts.js';

export function cellToMm(profile:RegisteredProfile,cell:readonly [number,number]):Point{
  return{x:cell[0]*profile.grid.cellMm,y:cell[1]*profile.grid.cellMm};
}

export function humanCellAddress(cell:readonly [number,number]):string{
  const column=cell[0]>=0?`P${cell[0]}`:`N${Math.abs(cell[0])}`;
  const row=cell[1]>=0?`P${cell[1]}`:`N${Math.abs(cell[1])}`;
  return`${column}:${row}`;
}
