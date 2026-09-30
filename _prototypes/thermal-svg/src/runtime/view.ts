// Live view of the effect for phones and anything that must animate smoothly.
//
// SVG filters are recomputed on the CPU every frame the stripe moves, which on an iPhone runs at a
// couple of frames per second. This view splits the work:
//   once per change  — the engine renders the still "field" (edge, blur) and the grain noise as images
//   every frame      — the GPU adds the moving stripe, looks up the palette colour, overlays the grain
// The look matches the engine's SVG output; exports still come from the engine.
//
// Browser-only (canvas + WebGL). Falls back to the plain animated SVG if WebGL is unavailable.

import { renderThermal, sampleStops, type ThermalConfig } from '../engine'

export interface ThermalView {
  update(config: ThermalConfig, fontCss?: string): void
  /** Measured frames per second over the last second (0 when paused). */
  readonly fps: number
  readonly gpu: boolean
  destroy(): void
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2((aPos.x + 1.0) * 0.5, (1.0 - aPos.y) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

// Stripe maths mirrors the SVG: a repeating hi–lo–hi gradient along the rotated x axis, rotated about
// the centre, sliding by one period per cycle.
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uLut;
uniform sampler2D uNoise;
uniform vec2 uSize;
uniform float uCos, uSin, uPeriod, uShift, uBase, uHalf, uStripe, uLum, uTransparent, uGrain;
void main() {
  vec4 f = texture2D(uField, vUv);
  vec2 p = vUv * uSize;
  vec2 c = uSize * 0.5;
  float x = c.x + (p.x - c.x) * uCos + (p.y - c.y) * uSin;
  float tri = abs(2.0 * fract((x - uShift) / uPeriod) - 1.0);
  float delta;
  if (uLum > 0.5) {
    delta = uHalf * (tri - f.r);
  } else {
    float lo = clamp(uBase - uHalf, 0.0, 1.0);
    float hi = clamp(uBase + uHalf, 0.0, 1.0);
    delta = lo + (hi - lo) * tri - uBase;
  }
  float h = clamp(f.r + uStripe * delta * f.g, 0.0, 1.0);
  vec3 col = texture2D(uLut, vec2(h * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
  // Film grain: grey noise overlaid (same formula as SVG feBlend overlay) in the blurred band only.
  vec3 n = texture2D(uNoise, vUv).rgb;
  vec3 ov = mix(2.0 * col * n, 1.0 - 2.0 * (1.0 - col) * (1.0 - n), step(0.5, col));
  col = mix(col, ov, uGrain * 4.0 * f.b * (1.0 - f.b));
  gl_FragColor = vec4(col, uTransparent > 0.5 ? min(1.0, 2.5 * f.b) : 1.0);
}`

function shader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

function texture(gl: WebGLRenderingContext): WebGLTexture {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return t
}

function lutPixels(config: ThermalConfig): Uint8Array {
  const px = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = sampleStops(config.palette.stops, i / 255)
    px.set([r * 255, g * 255, b * 255, 255], i * 4)
  }
  return px
}

async function rasterize(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return cv
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Mount a live view into `host` (it fills the host). */
export function createThermalView(host: HTMLElement): ThermalView {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  host.replaceChildren(canvas)
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false })

  if (!gl) {
    // No GPU: show the engine's animated SVG directly.
    let current: ThermalConfig | null = null
    return {
      gpu: false,
      fps: 0,
      update(config, fontCss) {
        current = config
        host.innerHTML = renderThermal(current, { id: 'view', fontCss }).svg
        const svg = host.querySelector('svg')
        if (svg) svg.style.cssText = 'display:block;width:100%;height:100%'
      },
      destroy() {
        host.replaceChildren()
      },
    }
  }

  const prog = gl.createProgram()!
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
  const u = (name: string) => gl.getUniformLocation(prog, name)
  const fieldTex = texture(gl)
  const lutTex = texture(gl)
  const noiseTex = texture(gl)
  gl.uniform1i(u('uField'), 0)
  gl.uniform1i(u('uLut'), 1)
  gl.uniform1i(u('uNoise'), 2)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)

  let config: ThermalConfig | null = null
  let fonts = ''
  let fieldKey = ''
  let noiseKey = ''
  let lutKey = ''
  let hasField = false
  let seq = 0
  let phase = 0 // stripe position in periods, kept across pause/play
  let last = 0
  let raf = 0
  let frames = 0
  let fpsWindow = 0
  const view = { gpu: true, fps: 0 }

  const pixelSize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = host.getBoundingClientRect()
    return [Math.max(1, Math.round(r.width * dpr)), Math.max(1, Math.round(r.height * dpr))]
  }

  const draw = () => {
    if (!config || !hasField) return
    const s = config.stripe
    const a = (s.angle * Math.PI) / 180
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(u('uSize'), config.output.width, config.output.height)
    gl.uniform1f(u('uCos'), Math.cos(a))
    gl.uniform1f(u('uSin'), Math.sin(a))
    gl.uniform1f(u('uPeriod'), s.period)
    gl.uniform1f(u('uShift'), s.period * (phase % 1))
    gl.uniform1f(u('uBase'), config.material.baseLevel)
    gl.uniform1f(u('uHalf'), s.contrast / 2)
    gl.uniform1f(u('uStripe'), s.enabled ? 1 : 0)
    gl.uniform1f(u('uLum'), config.source.kind === 'image' && config.source.mode === 'luminance' ? 1 : 0)
    gl.uniform1f(u('uTransparent'), config.output.background === 'transparent' ? 1 : 0)
    gl.uniform1f(u('uGrain'), config.finish.grain)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, noiseTex)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, fieldTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, lutTex)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const tick = (now: number) => {
    raf = 0
    if (!config) return
    const dt = last ? (now - last) / 1000 : 0
    last = now
    phase += dt / config.stripe.duration
    draw()
    frames++
    if (now - fpsWindow >= 1000) {
      view.fps = Math.round((frames * 1000) / (now - fpsWindow || 1))
      frames = 0
      fpsWindow = now
    }
    if (config.stripe.playing && config.stripe.enabled) raf = requestAnimationFrame(tick)
    else view.fps = 0
  }

  const schedule = () => {
    if (!raf && config?.stripe.playing && config.stripe.enabled) {
      last = 0
      fpsWindow = performance.now()
      frames = 0
      raf = requestAnimationFrame(tick)
    } else draw()
  }

  let fieldTimer = 0
  const refreshField = () => {
    if (!config) return
    const c = config
    const [w, h] = pixelSize()
    const key = JSON.stringify([c.source, c.output, c.material, c.finish.blur, w, h, fonts.length])
    // The grain noise is its own texture: re-made only when its size, seed or the frame size changes.
    const nk = JSON.stringify([c.finish.grainSize, c.finish.seed, c.output.width, c.output.height, w, h])
    if (nk !== noiseKey) {
      noiseKey = nk
      const { svg: noiseSvg } = renderThermal(c, { id: 'grain', layer: 'grain', pixelWidth: w, pixelHeight: h })
      rasterize(noiseSvg, w, h)
        .then((cv) => {
          gl.bindTexture(gl.TEXTURE_2D, noiseTex)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv)
          schedule()
        })
        .catch(() => {})
    }
    if (key === fieldKey) return
    fieldKey = key
    const mine = ++seq
    const { svg } = renderThermal(c, { id: 'field', layer: 'field', pixelWidth: w, pixelHeight: h, fontCss: fonts })
    rasterize(svg, w, h)
      .then((cv) => {
        if (mine !== seq) return
        // Resize only when the new frame is ready, so the old one stays up meanwhile (no flash).
        canvas.width = w
        canvas.height = h
        gl.bindTexture(gl.TEXTURE_2D, fieldTex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv)
        hasField = true
        schedule()
      })
      .catch(() => {
        /* a bad source (e.g. broken image) leaves the last good frame up */
      })
  }

  const ro = new ResizeObserver(() => {
    clearTimeout(fieldTimer)
    fieldTimer = window.setTimeout(refreshField, 120)
  })
  ro.observe(host)

  return {
    get gpu() {
      return view.gpu
    },
    get fps() {
      return view.fps
    },
    update(next, fontCss = '') {
      config = next
      fonts = fontCss
      const lk = JSON.stringify(next.palette.stops)
      if (lk !== lutKey) {
        lutKey = lk
        gl.bindTexture(gl.TEXTURE_2D, lutTex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutPixels(next))
      }
      // Field re-render is the only costly step — debounce it while a slider is being dragged.
      clearTimeout(fieldTimer)
      fieldTimer = window.setTimeout(refreshField, hasField ? 60 : 0)
      schedule()
    },
    destroy() {
      cancelAnimationFrame(raf)
      clearTimeout(fieldTimer)
      ro.disconnect()
      host.replaceChildren()
    },
  }
}
