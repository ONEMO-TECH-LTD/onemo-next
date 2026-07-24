// Minimal ambient declaration — culori ships no bundled types; we use converter/parse/formatHex8.
declare module 'culori' {
  export function parse(value: string): unknown;
  export function converter(mode: string): (color: unknown) => { l?: number; c?: number; h?: number; alpha?: number } | undefined;
  export function formatHex8(color: unknown): string | undefined;
}
