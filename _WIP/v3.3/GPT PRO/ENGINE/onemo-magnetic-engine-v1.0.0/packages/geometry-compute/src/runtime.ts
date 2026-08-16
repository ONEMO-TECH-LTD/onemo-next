import { COMPUTE_ARTIFACT_HASH, COMPUTE_ARTIFACT_ID } from './artifact-manifest.js';
let initialised=false;
export interface ComputeRuntimeInfo {readonly backend:string;readonly artifactHash:string;readonly initialised:boolean;}
export async function initialiseCompute():Promise<ComputeRuntimeInfo>{initialised=true;return{backend:COMPUTE_ARTIFACT_ID,artifactHash:COMPUTE_ARTIFACT_HASH,initialised};}
export function computeRuntimeInfo():ComputeRuntimeInfo{return{backend:COMPUTE_ARTIFACT_ID,artifactHash:COMPUTE_ARTIFACT_HASH,initialised};}
export function disposeCompute():void{initialised=false;}
