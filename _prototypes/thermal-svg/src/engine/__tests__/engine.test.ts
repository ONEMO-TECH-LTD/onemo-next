import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, normalizeConfig, paletteTables, renderThermal, sanitizeSvg } from '../index'

describe('normalizeConfig', () => {
  it('fills a bare call with the defaults, so an empty API request still renders the reference look', () => {
    expect(normalizeConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('clamps out-of-range numbers instead of rejecting them, so a bad request degrades, never breaks', () => {
    const c = normalizeConfig({ output: { width: 999999 }, finish: { grain: 5, blur: -3 }, palette: { steps: 1 } })
    expect(c.output.width).toBe(4096)
    expect(c.finish.grain).toBe(1)
    expect(c.finish.blur).toBe(0)
    expect(c.palette.steps).toBe(2)
  })

  it('drops invalid colour stops and sorts the rest, keeping the palette well-formed', () => {
    const c = normalizeConfig({ palette: { stops: [{ offset: 1, color: '#000' }, { offset: 0.2, color: 'red' }, { offset: 0, color: '#FFF' }] } })
    expect(c.palette.stops).toEqual([{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }])
  })

  it('switching source kind starts from that kind’s defaults', () => {
    const c = normalizeConfig({ source: { kind: 'image' } })
    expect(c.source).toEqual({ kind: 'image', href: '', mode: 'alpha' })
  })
})

describe('paletteTables', () => {
  it('maps grey 0 to the first stop and grey 1 to the last, so outside and hottest point get the chosen colours', () => {
    const t = paletteTables([{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }], 3)
    expect(t.r).toBe('1 0.5 0')
    expect(t.b).toBe('1 0.5 0')
  })
})

describe('sanitizeSvg', () => {
  it('removes scripts, event handlers and external links from dropped SVG', () => {
    const out = sanitizeSvg('<svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><path d="M0 0" onclick="y()"/><use href="https://evil/x"/></svg>')
    expect(out?.viewBox).toBe('0 0 10 10')
    expect(out?.inner).not.toMatch(/script|onclick|evil/)
    expect(out?.inner).toContain('<path d="M0 0"/>')
  })

  it('derives a viewBox from width/height when none is given', () => {
    expect(sanitizeSvg('<svg width="20" height="8"><rect/></svg>')?.viewBox).toBe('0 0 20 8')
  })

  it('refuses markup that is not SVG', () => {
    expect(sanitizeSvg('<div>hi</div>')).toBeNull()
  })
})

describe('renderThermal', () => {
  it('produces one self-contained SVG with the effect filter applied to the shape', () => {
    const { svg, width, height } = renderThermal({ output: { width: 300, height: 100 } }, { id: 'a' })
    expect(width).toBe(300)
    expect(height).toBe(100)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('filter="url(#a-heat)"')
    expect(svg).toContain('mask="url(#a-shape)"')
    expect(svg).toContain('<feComponentTransfer')
  })

  it('animates only while playing — a paused config is a still frame with no animation element', () => {
    expect(renderThermal({ stripe: { playing: true } }).svg).toContain('<animateTransform')
    expect(renderThermal({ stripe: { playing: false } }).svg).not.toContain('<animateTransform')
  })

  it('escapes user text so it cannot break out of the SVG', () => {
    const { svg } = renderThermal({ source: { kind: 'text', text: '<b>&"x' } })
    expect(svg).toContain('&lt;b&gt;&amp;&quot;x')
  })

  it('leaves out optional stages that are switched off, keeping the output minimal', () => {
    const { svg } = renderThermal({ finish: { grain: 0, blur: 0 }, material: { depth: 0 } })
    expect(svg).not.toContain('feTurbulence')
    expect(svg).not.toContain('result="soft"')
  })

  it('keeps separate renders on one page from colliding by prefixing every id', () => {
    const a = renderThermal({}, { id: 'one' }).svg
    expect(a).not.toMatch(/id="thermal-/)
    expect(a).toContain('id="one-heat"')
  })

  it('only accepts image data URLs or http(s) links as image sources', () => {
    expect(renderThermal({ source: { kind: 'image', href: 'javascript:alert(1)' } }).svg).not.toContain('<image')
    expect(renderThermal({ source: { kind: 'image', href: 'data:image/png;base64,AAAA' } }).svg).toContain('<image href="data:image/png;base64,AAAA"')
  })

  it('stays small — the reference claims about 3 KB for the whole file', () => {
    expect(renderThermal({ palette: { steps: 32 } }).svg.length).toBeLessThan(4096)
  })
})
