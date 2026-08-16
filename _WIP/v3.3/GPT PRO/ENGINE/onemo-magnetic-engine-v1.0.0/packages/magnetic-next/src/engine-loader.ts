type MagneticEngine=Pick<typeof import('@onemo/magnetic-logic'),'solveOutline'>;
let enginePromise:Promise<MagneticEngine>|undefined;
export function loadMagneticEngine():Promise<MagneticEngine>{
  enginePromise??=import('@onemo/magnetic-logic/solver');return enginePromise;
}
export function resetMagneticEngineLoaderForTests():void{enginePromise=undefined;}
