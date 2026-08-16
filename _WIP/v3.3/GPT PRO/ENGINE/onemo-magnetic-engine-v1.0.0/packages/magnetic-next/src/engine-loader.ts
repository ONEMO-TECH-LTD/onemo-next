let enginePromise:Promise<typeof import('@onemo/magnetic-logic')>|undefined;
export function loadMagneticEngine():Promise<typeof import('@onemo/magnetic-logic')>{
  enginePromise??=import('@onemo/magnetic-logic');return enginePromise;
}
export function resetMagneticEngineLoaderForTests():void{enginePromise=undefined;}
