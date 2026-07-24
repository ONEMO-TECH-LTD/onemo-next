// Minimal ambient declaration — culori ships no bundled types; we use only converter/parse.
declare module 'culori' {
  export function parse(value: string): unknown;
  export function converter(mode: string): (color: unknown) => { l?: number; c?: number; h?: number } | undefined;
}
