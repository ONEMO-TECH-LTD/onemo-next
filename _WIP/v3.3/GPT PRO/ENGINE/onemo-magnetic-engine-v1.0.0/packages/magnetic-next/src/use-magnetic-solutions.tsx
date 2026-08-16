'use client';
import { useEffect, useMemo, useState } from 'react';
import type { ProductProfile, SolveResult } from '@onemo/magnetic-logic';
import type { StudioPoint } from './outline-adapter.js';
import { adaptStudioOutline } from './outline-adapter.js';
import { loadMagneticEngine } from './engine-loader.js';
import { solutionViewModels } from './solution-view-model.js';

export interface MagneticSolutionsState {readonly status:'idle'|'loading'|'ready'|'error';readonly result?:SolveResult;readonly error?:Error;readonly options:ReturnType<typeof solutionViewModels>;}

export function useMagneticSolutions(outline:readonly StudioPoint[]|null,profile:ProductProfile):MagneticSolutionsState{
  const [state,setState]=useState<MagneticSolutionsState>({status:'idle',options:[]});
  const outlineKey=useMemo(()=>outline?outline.map(p=>`${p.x},${p.y}`).join(';'):'',[outline]);
  useEffect(()=>{
    let cancelled=false;
    if(!outline||outline.length<3){setState({status:'idle',options:[]});return;}
    setState({status:'loading',options:[]});
    void loadMagneticEngine().then(engine=>engine.solveOutline({outlineMm:adaptStudioOutline(outline),profile,diagnosticLevel:'summary'})).then(result=>{
      if(!cancelled)setState({status:'ready',result,options:solutionViewModels(result)});
    }).catch((cause:unknown)=>{if(!cancelled)setState({status:'error',error:cause instanceof Error?cause:new Error(String(cause)),options:[]});});
    return()=>{cancelled=true;};
  },[outlineKey,profile]);
  return state;
}
