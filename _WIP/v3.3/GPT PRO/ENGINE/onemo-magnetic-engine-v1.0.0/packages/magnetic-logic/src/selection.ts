import type { CandidateHypothesis } from './contracts.js';
import { candidateDiscreteKey } from './mechanics.js';

export function canonicalCodeUnitCompare(a:string,b:string):number{return a<b?-1:a>b?1:0;}

function compareKey(a:readonly (string|number)[],b:readonly (string|number)[]):number{
  const length=Math.max(a.length,b.length);
  for(let i=0;i<length;i++){
    const x=a[i],y=b[i];if(x===y)continue;
    if(x===undefined)return-1;if(y===undefined)return 1;
    if(typeof x==='number'&&typeof y==='number')return x-y;
    return canonicalCodeUnitCompare(String(x),String(y));
  }
  return 0;
}

export function selectDiscreteIdentity<T extends CandidateHypothesis>(candidates:readonly T[]):T{
  if(candidates.length===0)throw new Error('cannot select from an empty candidate set');
  return [...candidates].sort((a,b)=>compareKey(candidateDiscreteKey(a),candidateDiscreteKey(b)))[0]!;
}
