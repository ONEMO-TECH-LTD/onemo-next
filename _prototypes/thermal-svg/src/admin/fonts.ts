// Brand font catalogue, named by the design-token roles in onemo-next/src/app/tokens/tokens.css:
//   --al-type-family-brand / -primary / -tertiary → Chillax,  -secondary → Satoshi,  prim → Nippo.
// Files come from onemo-next/asset-library/fonts (web builds), copied into public/fonts.
//
// The engine only knows a CSS family name. Embedding the actual font into an SVG is the host's job:
// fontCss() returns @font-face rules with the font inlined, which the engine places inside the SVG so
// exports and the GPU preview (which renders the SVG as an image) show the real font.

export interface FontFamily {
  id: string
  label: string
  /** CSS font-family value written into the config. */
  css: string
  /** weight → file in public/fonts; empty for system fonts. */
  files: Record<number, string>
}

export const FONTS: FontFamily[] = [
  {
    id: 'chillax',
    label: 'Brand / Primary — Chillax',
    css: "Chillax, 'Arial Black', sans-serif",
    files: { 200: 'Chillax-Extralight', 300: 'Chillax-Light', 400: 'Chillax-Regular', 500: 'Chillax-Medium', 600: 'Chillax-Semibold', 700: 'Chillax-Bold' },
  },
  {
    id: 'satoshi',
    label: 'Secondary — Satoshi',
    css: "Satoshi, 'Arial Black', sans-serif",
    files: { 300: 'Satoshi-Light', 400: 'Satoshi-Regular', 500: 'Satoshi-Medium', 700: 'Satoshi-Bold', 900: 'Satoshi-Black' },
  },
  {
    id: 'nippo',
    label: 'Nippo',
    css: "Nippo, 'Arial Black', sans-serif",
    files: { 200: 'Nippo-Extralight', 300: 'Nippo-Light', 400: 'Nippo-Regular', 500: 'Nippo-Medium', 700: 'Nippo-Bold' },
  },
  { id: 'system-heavy', label: 'System — Arial Black', css: "'Arial Black', 'Helvetica Neue', Arial, sans-serif", files: {} },
  { id: 'system', label: 'System — Helvetica', css: "'Helvetica Neue', Arial, sans-serif", files: {} },
]

const SYSTEM_WEIGHTS = [400, 700, 900]

export function familyOf(css: string): FontFamily | undefined {
  return FONTS.find((f) => f.css === css)
}

export function weightsOf(css: string): number[] {
  const f = familyOf(css)
  return f && Object.keys(f.files).length ? Object.keys(f.files).map(Number) : SYSTEM_WEIGHTS
}

/** The available weight closest to the wanted one. */
export function nearestWeight(css: string, want: number): number {
  return weightsOf(css).reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best))
}

/** Page-level @font-face rules, so the fonts also show in the dashboard itself. */
export function installPageFonts(): void {
  const rules = FONTS.flatMap((f) =>
    Object.entries(f.files).map(
      ([w, file]) => `@font-face{font-family:'${f.css.split(',')[0]}';src:url('/fonts/${file}.woff2') format('woff2');font-weight:${w};font-display:block}`,
    ),
  )
  const style = document.createElement('style')
  style.textContent = rules.join('\n')
  document.head.append(style)
}

const cache = new Map<string, Promise<string>>()

function dataUrl(file: string): Promise<string> {
  let p = cache.get(file)
  if (!p) {
    p = fetch(`/fonts/${file}.woff2`)
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((resolve) => {
            const fr = new FileReader()
            fr.onload = () => resolve(String(fr.result).replace(/^data:[^;]*;/, 'data:font/woff2;'))
            fr.readAsDataURL(b)
          }),
      )
    cache.set(file, p)
  }
  return p
}

/** @font-face with the font inlined, for the family/weight the config uses. Empty for system fonts. */
export async function fontCss(css: string, weight: number): Promise<string> {
  const f = familyOf(css)
  if (!f) return ''
  const file = f.files[weight]
  if (!file) return ''
  return `@font-face{font-family:'${css.split(',')[0]}';src:url(${await dataUrl(file)}) format('woff2');font-weight:${weight}}`
}
