declare module 'react' {
  export type ReactNode = unknown;
  export function useState<T>(initial:T):[T,(value:T|((previous:T)=>T))=>void];
  export function useEffect(effect:()=>void|(()=>void),dependencies:readonly unknown[]):void;
  export function useMemo<T>(factory:()=>T,dependencies:readonly unknown[]):T;
  export interface SVGProps<T>{[key:string]:unknown}
}
declare module 'react/jsx-runtime' { export const jsx:unknown; export const jsxs:unknown; export const Fragment:unknown; }
declare namespace JSX { interface IntrinsicElements {[elementName:string]:Record<string,unknown>} }
