'use client';
import { useMemo, useState } from 'react';
import { createReferenceProfile } from '@onemo/magnetic-logic';
import { ShapeSolutionOverlay, useMagneticSolutions } from '@onemo/magnetic-next';

const initial=[{x:0,y:0},{x:120,y:0},{x:120,y:120},{x:0,y:120}];
export default function MagneticStudioPage(){
  const [outline]=useState(initial);const profile=useMemo(()=>createReferenceProfile(),[]);const state=useMagneticSolutions(outline,profile);
  return <main><h1>ONEMO Effects Studio — magnetic sizing</h1><p>Replace the example outline with the editor's validated millimetre contour.</p>
    {state.status==='loading'&&<p>Calculating…</p>}{state.error&&<pre>{state.error.message}</pre>}
    {state.options.map(option=><section key={option.band}><h2>{option.label}</h2>{state.result?.offers.find(o=>o.band===option.band)?.solution&&<ShapeSolutionOverlay solution={state.result.offers.find(o=>o.band===option.band)!.solution!}/>}</section>)}
  </main>;
}
