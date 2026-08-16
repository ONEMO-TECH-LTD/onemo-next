import type { Point } from '@onemo/magnetic-logic';

export interface StudioPoint {readonly x:number;readonly y:number;}
export interface OutlineAdapterOptions {readonly inputYAxis:'UP'|'DOWN';readonly centreOnBounds?:boolean;}

export function adaptStudioOutline(points:readonly StudioPoint[],options:OutlineAdapterOptions={inputYAxis:'DOWN',centreOnBounds:true}):Point[]{
  if(points.length<3)throw new Error('outline requires at least three points');
  const converted=points.map(p=>({x:p.x,y:options.inputYAxis==='DOWN'?-p.y:p.y}));
  if(options.centreOnBounds===false)return converted;
  const xs=converted.map(p=>p.x),ys=converted.map(p=>p.y);const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  return converted.map(p=>({x:p.x-cx,y:p.y-cy}));
}
