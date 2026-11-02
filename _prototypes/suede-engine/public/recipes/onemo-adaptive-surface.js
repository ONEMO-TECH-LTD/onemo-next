/* The shader. Source strings only — no GL, no DOM, no state.
 *
 * Gradient: the four-colour lava-lamp, ported from the s58 surface lab, which
 * took it verbatim from the reference bundle. Two layers mixed across a warped
 * space, plus a radial focus lift. It is the construction that makes a field
 * read as depth rather than as a blur.
 *
 * Grain: the mattdesl branch — Ashima simplex-3D, domain-warped, signed and
 * zero-mean, which is why it dithers around a colour instead of washing it
 * lighter the way a positive hash does.
 *
 * The 3x weight is not a taste choice. Zero-mean noise reads far weaker than a
 * brightening hash at the same amplitude, so the lab weights this branch by
 * three to make the two engines comparable at one intensity number. Porting the
 * construction without the weight — which is what happened first here — runs the
 * grain at a third of its intended strength and looks like it is missing. */

export const VERT = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* Ashima simplex-3D. */
const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
 vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 float a=fract(sin(dot(i,vec2(12.9898,78.233)))*43758.5453);
 float b=fract(sin(dot(i+vec2(1.0,0.0),vec2(12.9898,78.233)))*43758.5453);
 float c=fract(sin(dot(i+vec2(0.0,1.0),vec2(12.9898,78.233)))*43758.5453);
 float d=fract(sin(dot(i+vec2(1.0,1.0),vec2(12.9898,78.233)))*43758.5453);
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}`;

export const FRAG = `precision highp float;
varying vec2 vUv;
uniform vec2 uPxRes;
uniform vec3 uTopColor, uAccentColor, uBottomColor, uDarkColor;
uniform vec2 uFocusPoint;
uniform float uTime, uGrainTime, uIntensity, uGrainSize, uGrainAnim, uLumaOnly;
uniform float uFocusStrength, uGradScale, uGradRot;
${SNOISE}
void main(){
  float aspectRatio = uPxRes.x / uPxRes.y;
  vec2 uv = vUv;

  /* ── four-colour field ─────────────────────────────────────────────── */
  vec2 tuv = (uv - 0.5) / max(uGradScale, 0.05);
  tuv *= Rot(radians(uGradRot));
  float t = uTime * 0.5;
  float degree = vnoise(vec2(t * 0.05, tuv.x * tuv.y));
  tuv.y *= 1.0 / aspectRatio;
  tuv *= Rot(radians((degree - 0.5) * 720.0 + 180.0));
  tuv.y *= aspectRatio;
  float frequency = 5.0, amplitude = 30.0, speed = t * 2.0;
  tuv.x += sin(tuv.y * frequency + speed) / amplitude;
  tuv.y += sin(tuv.x * frequency * 1.5 + speed) / (amplitude * 0.5);

  vec3 layer1 = mix(uAccentColor, uDarkColor, smoothstep(-0.3, 0.2, (tuv * Rot(radians(-5.0))).x));
  vec3 layer2 = mix(uBottomColor, uTopColor, smoothstep(-0.3, 0.2, (tuv * Rot(radians(-5.0))).x));
  vec3 fieldColor = mix(layer1, layer2, smoothstep(0.5, -0.3, tuv.y));

  vec2 warp = tuv - (uv - 0.5);
  vec2 delta = (uv - 0.5) - (uFocusPoint - 0.5) + warp * 0.5;
  delta.x *= aspectRatio;
  float radialMask = smoothstep(0.6, 0.0, length(delta)) * uFocusStrength;
  vec3 col = mix(fieldColor, mix(fieldColor, uTopColor, 0.45), radialMask);

  /* ── grain ───────────────────────────────────────────────────────────
     Weighted x3: simplex is signed and zero-mean, so at a given intensity it
     reads far weaker than a brightening hash. The weight is what makes 0.05
     mean the same thing here as it does on the reference. */
  float animOn = step(0.5, uGrainAnim);
  vec2 mult = (vUv * uPxRes) / max(uGrainSize, 1.0);
  float offset = snoise(vec3(mult * 0.45, uGrainTime * 0.6 * animOn));
  float raw = snoise(vec3(mult, offset + uGrainTime * 1.4 * animOn));
  float amt = uIntensity * 3.0;

  if (uLumaOnly > 0.5) {
    float L = dot(col, vec3(0.299, 0.587, 0.114));
    col *= clamp((L + raw * amt) / max(L, 1e-3), 0.0, 4.0);
  } else {
    col += vec3(raw) * (1.0 - col * 0.5) * amt;
  }

  gl_FragColor = vec4(col, 1.0);
}`;

/* The resting palette, read from the design system rather than written here.
 *
 * This is what makes dark mode free: the surface never stores a colour, it reads
 * the tokens the page is already using. Flip `data-theme` and the resting field
 * inverts along with everything else, because it was never a separate decision.
 *
 * If a token is missing the fallback is a neutral, not a guess at brand colour —
 * a wrong grey is invisible, a wrong brand colour is a bug someone has to find. */

/* The neutral field's four stops, ordered lightest to darkest — taken from the
   design file's own gradient rather than picked here: app/primary,
   app/quaternary, control/vibrant, control/accent at 0 / 25 / 50 / 100%.

   These are a STARTING POINT, not a fixed set. Which tokens make the best ONEMO
   neutral is an open design question, so the dev panel offers every background
   token in the system and this is simply where it opens.

   An earlier version used the four app backgrounds and measured 252, 251, 249,
   232 of 255 — three within a point of each other, so the field had no range and
   rendered as flat white. These run 98.8 / 93.2 / 91.0 / 64.5 in lightness: a
   34-point range where that had 3. All four invert with the theme, so dark mode
   stays free rather than becoming a second decision. */
export const DEFAULT_STOPS = Object.freeze({
  top: '--sem-col-bg-app-primary',        // 0%   — lightest
  accent: '--sem-col-bg-app-quaternary',  // 25%
  bottom: '--sem-col-bg-control-vibrant', // 50%
  dark: '--sem-col-bg-control-accent',    // 100% — the ground
});

const FALLBACK = Object.freeze({
  top: [0.988, 0.988, 0.992],
  accent: [0.984, 0.984, 0.988],
  bottom: [0.976, 0.976, 0.984],
  dark: [0.910, 0.910, 0.925],
});

/* Painting the colour and reading the pixel back is the only conversion that is
   actually reliable. A computed-style probe is NOT: browsers preserve the author
   colour space, so an oklch token comes back as `oklch(0.988 0.0013 286.375)`,
   and parsing that as if it were rgb turns a near-white into saturated blue —
   the hue angle divided by 255 lands above 1 on the blue channel. Canvas always
   answers in sRGB bytes, whatever space the token was written in. */
const swatch = document.createElement('canvas');
swatch.width = swatch.height = 1;
const swatchCtx = swatch.getContext('2d', { willReadFrequently: true });

function toRgb(value) {
  if (!value || !swatchCtx) return null;
  swatchCtx.clearRect(0, 0, 1, 1);
  swatchCtx.fillStyle = '#000';
  swatchCtx.fillStyle = value.trim();          /* an invalid colour leaves #000 */
  swatchCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = swatchCtx.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r / 255, g / 255, b / 255];
}

/**
 * Resolve one stop. A `--token-name` is read from the page, so it follows the
 * theme; anything else is taken as a literal CSS colour and does not.
 */
function resolveStop(stop, style) {
  if (typeof stop !== 'string') return null;
  const value = stop.startsWith('--') ? style.getPropertyValue(stop) : stop;
  return toRgb(value);
}

/**
 * The neutral palette as the page currently renders it.
 *
 * Neutral is a mode a page chooses, not a state the surface falls back into —
 * the shop floor runs adaptive, a studio or admin page runs neutral. Stops are
 * normally token names, which is what makes a theme flip free; a literal colour
 * is accepted for trying something the system does not have yet, and is fixed
 * across themes by definition.
 *
 * @param stops  {top, accent, bottom, dark} — each a `--token-name` or CSS colour
 * @param element the element whose custom properties to read; defaults to :root
 */
export function neutralPalette(stops = DEFAULT_STOPS, element = document.documentElement) {
  const style = getComputedStyle(element);
  const palette = {};
  for (const band of Object.keys(FALLBACK)) {
    palette[band] = resolveStop(stops?.[band], style)
      ?? resolveStop(DEFAULT_STOPS[band], style)
      ?? FALLBACK[band];
  }
  return palette;
}

/**
 * Every background token the page defines, with what it currently resolves to.
 *
 * Read from the live stylesheets rather than a list written here, so it cannot
 * drift from the design system and so a token added tomorrow simply appears.
 * This exists because which tokens make the best ONEMO neutral is an open
 * design question — it is answered by looking at them, not by arguing.
 *
 * @returns [{ name, rgb }] sorted by name; empty where no stylesheet is readable
 */
export function backgroundTokens(element = document.documentElement) {
  const style = getComputedStyle(element);
  const names = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }  /* cross-origin — skip */
    for (const rule of rules ?? []) {
      if (!rule.style) continue;
      for (const property of rule.style) {
        if (property.startsWith('--sem-col-bg-')) names.add(property);
      }
    }
  }
  return [...names].sort().map((name) => ({ name, rgb: toRgb(style.getPropertyValue(name)) }))
    .filter((t) => t.rgb);
}

/**
 * Call `onChange` whenever the theme flips. Returns a function to stop watching.
 * Watches the attribute the token file switches on, plus the OS preference.
 */
export function watchTheme(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme', 'class'] });

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);

  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}

/* Palette extraction — four distinct colours from an image. Pure apart from the
 * offscreen canvas it needs to read pixels.
 *
 * k-means rather than an average or a dominant hue, because an average of a
 * photograph is grey and a single scaled hue throws away the neutrals that give
 * a field its depth. Four clusters keep the image's actual distinct colours —
 * contrasting hues *and* the blacks, greys and whites.
 *
 * Ported from the s58 surface lab (`onemo-next/_prototypes/suede-engine`), where
 * this was proven against real effect artwork. Same seeding, same iteration
 * count, same luminance ordering — brightest becomes the top band, darkest the
 * ground, so the field always reads light-above-dark. */

const K = 4;
const SAMPLE = 32;   /* 1024 pixels is ample for four clusters, and a quarter the work */
const ITERATIONS = 12;

const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const dist2 = (a, b) => {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return x * x + y * y + z * z;
};

/**
 * @param image a loaded HTMLImageElement
 * @returns { top, accent, bottom, dark } as [r,g,b] 0..1, or null if unreadable
 */
export function extractPalette(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let data;
  try {
    ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null;   /* cross-origin taint — the caller keeps its current palette */
  }

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 100) continue;
    pixels.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
  }
  if (pixels.length < 16) return null;

  /* Seed across the luminance range rather than randomly: the clusters come out
     distinct and, more usefully, the same image always yields the same palette. */
  const byLuma = [...pixels].sort((a, b) => luma(a) - luma(b));
  let centroids = Array.from({ length: K }, (_, k) =>
    byLuma[Math.floor(((k + 0.5) / K) * byLuma.length)].slice());

  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (const pixel of pixels) {
      let best = 0, bestDistance = Infinity;
      for (let k = 0; k < K; k++) {
        const d = dist2(pixel, centroids[k]);
        if (d < bestDistance) { bestDistance = d; best = k; }
      }
      const s = sums[best];
      s[0] += pixel[0]; s[1] += pixel[1]; s[2] += pixel[2]; s[3]++;
    }
    for (let k = 0; k < K; k++) {
      if (sums[k][3] > 0) {
        centroids[k] = [sums[k][0] / sums[k][3], sums[k][1] / sums[k][3], sums[k][2] / sums[k][3]];
      }
    }
  }

  centroids.sort((a, b) => luma(b) - luma(a));
  return { top: centroids[0], accent: centroids[1], bottom: centroids[2], dark: centroids[3] };
}

/* One palette per artwork, for the life of the page. Without this a scroll
   re-fetches, re-decodes and re-clusters every image it passes — measured in
   real Chrome, four scroll gestures cost twenty-one fetches and four main-thread
   blocks of 53-60ms, which is exactly what a freeze feels like. The in-flight
   map matters as much as the result one: a fast scroll asks for the same image
   several times before the first request has landed. */
const palettes = new Map();
const inFlight = new Map();

/** Load an image and extract from it. Resolves null rather than rejecting. */
export function paletteFrom(src) {
  if (palettes.has(src)) return Promise.resolve(palettes.get(src));
  if (inFlight.has(src)) return inFlight.get(src);

  const pending = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(extractPalette(image));
    image.onerror = () => resolve(null);
    image.src = src;
  }).then((palette) => {
    palettes.set(src, palette);
    inFlight.delete(src);
    return palette;
  });

  inFlight.set(src, pending);
  return pending;
}

/** Whether this artwork's palette is already known, without fetching it. */
export const paletteReady = (src) => palettes.has(src);

/** Mix two palettes. `t` of 0 is `a`, 1 is `b`. */
export const mixPalettes = (a, b, t) => {
  const lerp = (x, y) => [
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  ];
  return {
    top: lerp(a.top, b.top),
    accent: lerp(a.accent, b.accent),
    bottom: lerp(a.bottom, b.bottom),
    dark: lerp(a.dark, b.dark),
  };
};

/* ONEMO living surface — a background you connect a page to, and disconnect.
 *
 *   import { createSurface } from './engine/surface/index.js';
 *   const surface = createSurface();            // mounts its own canvas
 *   surface.adoptImage('art/01.jpg');           // field takes the artwork's colours
 *   surface.setMode('neutral');                 // brand stops instead, on purpose
 *   surface.disconnect();                       // GL released, page keeps its own
 *
 * It knows nothing about carousels, cards, products or pages. Give it an image,
 * or two and a number between them; it renders. That is the whole contract,
 * which is what lets the shop floor run it adaptive, a studio page run it
 * neutral, and a third page not run it at all.
 *
 * Two colour modes, never a blend of the two, and NEVER one falling back to the
 * other:
 *
 *   adaptive — artwork colours, applied as extracted
 *   neutral  — the chosen brand stops, and nothing else
 *
 * A page picks its mode. Neutral is not what adaptive shows when something has
 * gone wrong: an adaptive surface with artwork on screen must always be carrying
 * that artwork's colours. Treating neutral as a fallback once hid a real defect
 * for a day, because a failure looked exactly like a deliberate choice.
 *
 * Within adaptive a scroll blends one artwork's palette into the next one's —
 * image to image, never back through grey.
 *
 * Neutral stops are token names by default, never colours written here, so a
 * theme flip inverts the field for free — it was never a separate decision.
 *
 * Cost, measured: one fullscreen pass, no render target. Against the reference's
 * hash grain it is 1.07-1.22x depending on resolution. Device pixel ratio
 * dominates that difference, which is why it is capped at 2 by default. */


export const DEFAULTS = Object.freeze({
  intensity: 0.05,      // the reference's shipped grain strength
  grainSize: 1.5,
  grainSpeed: 1,
  gradientSpeed: 1,
  neutralSpeed: 0.5,    // neutral drifts slower than an adapting field; 1 matches
  neutralStops: null,   // four `--token-name`s or CSS colours; null uses DEFAULT_STOPS
  animated: true,
  lumaOnly: false,      // grain on luminance only — hue and chroma stay exact
  gradientScale: 1,
  gradientRotation: 0,
  focusStrength: 0,
  focusPoint: [0.5, 0.5],
  maxPixelRatio: 2,     // what the reference ships; 3 costs more than the engine choice
  mode: 'adaptive',     // 'adaptive' — artwork colours · 'neutral' — brand stops only
});

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

/**
 * @param options.canvas   an existing canvas; one is created and mounted if absent
 * @param options.mountTo  where to mount a created canvas (default document.body)
 * @returns a handle, or null where WebGL is unavailable — callers should treat
 *          null as "this page has a flat background", not as an error
 */
export function createSurface(options = {}) {
  /* The render target is not a setting. Keeping the canvas out of `config` is
     what makes the config safely serialisable: a control panel that saves it
     used to store the canvas too, which came back from storage as an empty
     object and replaced the real element on the next load. Settings persist;
     the thing being drawn into does not. */
  const { canvas: given, mountTo, readable = false, ...settings } = options;
  const config = { ...DEFAULTS, ...settings };

  const owned = !given;
  const canvas = given ?? document.createElement('canvas');
  if (owned) {
    canvas.className = 'onemo-surface';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:0';
    (mountTo ?? document.body).prepend(canvas);
  }

  /* `readable` keeps the drawn frame around so the field can be SAMPLED. Without
     it every read of this canvas — readPixels, drawImage, toDataURL — returns an
     empty buffer whether the field is rendering or not, so a check written
     against it passes on a black screen and fails on a working one. That is not
     a gap worth living with: an entire deleted gradient shipped looking healthy
     because nothing could see the pixels. Off by default, since it costs the
     driver a copy; the lab turns it on. */
  const gl = canvas.getContext('webgl', {
    antialias: false, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: readable,
  });
  if (!gl) {
    if (owned) canvas.remove();
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const at = (name) => gl.getUniformLocation(program, name);
  const u = {
    pxRes: at('uPxRes'),
    top: at('uTopColor'), accent: at('uAccentColor'),
    bottom: at('uBottomColor'), dark: at('uDarkColor'),
    focusPoint: at('uFocusPoint'), focusStrength: at('uFocusStrength'),
    time: at('uTime'), grainTime: at('uGrainTime'),
    intensity: at('uIntensity'), grainSize: at('uGrainSize'),
    grainAnim: at('uGrainAnim'), lumaOnly: at('uLumaOnly'),
    gradScale: at('uGradScale'), gradRot: at('uGradRot'),
  };

  /* ── palettes ─────────────────────────────────────────────────────── */

  /* Two colour modes, never a blend of the two, and never one falling back to
     the other:
       adaptive — the artwork's colours, applied as extracted
       neutral  — the chosen brand stops, and nothing else

     Neutral is a mode a PAGE PICKS, not a state the surface drops into when
     something goes wrong. The shop floor runs adaptive; a studio or admin page
     runs neutral. That distinction is load-bearing: while neutral was treated as
     a fallback, a failure to read an artwork was indistinguishable from a
     deliberate choice, and a real defect hid inside it for a day.

     Within adaptive the scroll blends ONE ARTWORK'S palette into the NEXT one's,
     so the field travels between images rather than washing back through grey. */
  let mode = config.mode === 'neutral' ? 'neutral' : 'adaptive';
  let stops = config.neutralStops ?? DEFAULT_STOPS;
  let neutral = neutralPalette(stops);
  let from = neutral;            // the artwork being left
  let to = neutral;              // the artwork being approached
  let fromSrc = null;            // which source currently OWNS each role
  let toSrc = null;
  let travel = 0;                // 0 sits on `from`, 1 on `to`
  let shown = neutral;

  const recompute = () => {
    shown = mode === 'neutral' ? neutral : mixPalettes(from, to, travel);
  };

  /* True while brand colour is on screen rather than an artwork's. In adaptive
     that is only the gap before the first artwork is read — the identity check
     is exact, because `from` and `to` hold the neutral object itself until an
     extraction replaces them. */
  const onNeutral = () => mode === 'neutral' || (from === neutral && to === neutral);

  const stopWatchingTheme = watchTheme(() => {
    const previous = neutral;
    neutral = neutralPalette(stops);
    /* Keep the identity relationship across a theme flip, or a field that had
       not yet adopted an artwork would look adapted to the stale stops. */
    if (from === previous) from = neutral;
    if (to === previous) to = neutral;
    recompute();
    if (!running) once();
  });

  /* ── loop ─────────────────────────────────────────────────────────── */

  let raf = 0, last = 0, running = false, disposed = false;

  /* Phase is integrated rather than derived from elapsed time, because the field
     drifts at one speed while it carries an artwork and another at rest. Elapsed
     seconds multiplied by a speed that changes makes the whole field jump the
     instant it changes — on every switch, and on every drag of a speed slider.
     Accumulating speed x dt keeps it continuous through both. */
  let gradPhase = 0, grainPhase = 0;

  /* Neutral is allowed its own pace — it is a background a page sits on rather
     than one that travels with a scroll. At 1 it matches adaptive. */
  const gradientSpeed = () =>
    config.gradientSpeed * (onNeutral() ? config.neutralSpeed : 1);

  function size() {
    const ratio = Math.min(config.maxPixelRatio, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * ratio);
    const h = Math.round(canvas.clientHeight * ratio);
    if (!w || !h) return false;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    return true;
  }

  function draw(dt) {
    gradPhase += dt * gradientSpeed();
    grainPhase += dt * config.grainSpeed;
    gl.uniform2f(u.pxRes, canvas.width, canvas.height);
    gl.uniform3fv(u.top, shown.top);
    gl.uniform3fv(u.accent, shown.accent);
    gl.uniform3fv(u.bottom, shown.bottom);
    gl.uniform3fv(u.dark, shown.dark);
    gl.uniform2fv(u.focusPoint, config.focusPoint);
    gl.uniform1f(u.focusStrength, config.focusStrength);
    gl.uniform1f(u.time, gradPhase);
    gl.uniform1f(u.grainTime, grainPhase);
    gl.uniform1f(u.intensity, config.intensity);
    gl.uniform1f(u.grainSize, config.grainSize);
    gl.uniform1f(u.grainAnim, config.animated ? 1 : 0);
    gl.uniform1f(u.lumaOnly, config.lumaOnly ? 1 : 0);
    gl.uniform1f(u.gradScale, config.gradientScale);
    gl.uniform1f(u.gradRot, config.gradientRotation);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function loop(now) {
    /* A first frame, a resumed tab or a stalled thread must not advance the
       field by however long the gap was — the clamp keeps a return to the page
       continuous instead of lurching. */
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
    last = now;
    if (size()) draw(dt);
    raf = requestAnimationFrame(loop);
  }

  function once() {
    if (disposed || document.hidden) return;
    cancelAnimationFrame(raf);
    /* A still frame holds the phase it stopped at rather than resetting to the
       start of the drift, so pausing motion no longer moves the field. */
    raf = requestAnimationFrame(() => { if (size()) draw(0); else once(); });
  }

  /* A still surface costs nothing: the loop stops rather than spinning. */
  function run() {
    cancelAnimationFrame(raf);
    running = config.animated;
    if (running) { last = 0; raf = requestAnimationFrame(loop); }
    else once();
  }

  /* Palettes are read once and remembered — without that a scroll refetched and
     re-clustered every image it passed, which is what a freeze feels like.

     The artwork ON SCREEN is read immediately rather than at idle: nested
     unfocused frames get almost no idle time, and gating the first read behind
     it meant 18 of 20 artworks were never analysed at all.

     Resolution checks the LATEST from/to intent rather than a closure captured
     when the request was made. Without that, a fast reversal lands a stale
     palette in the wrong role — the extraction that was in flight for the card
     you scrolled away from arrives and overwrites the one you scrolled back to.
     This is s60-pixel-qa's implementation; a wholesale file copy of mine
     overwrote it during the v3 convergence and it is restored here. */
  const known = new Map();
  const pending = new Map();
  function requestPalette(src) {
    if (!src || known.has(src) || pending.has(src)) return;
    const request = paletteFrom(src).then((palette) => {
      if (disposed) return;
      pending.delete(src);
      known.set(src, palette);
      if (!palette) return;
      if (fromSrc === src) from = palette;
      if (toSrc === src) to = palette;
      recompute();
      if (!running) once();
    });
    pending.set(src, request);
  }

  const applyKnown = () => {
    if (known.get(fromSrc)) from = known.get(fromSrc);
    if (known.get(toSrc)) to = known.get(toSrc);
  };

  /* A backgrounded tab should not cook someone's battery. */
  const onVisibility = () => { if (document.hidden) cancelAnimationFrame(raf); else run(); };
  document.addEventListener('visibilitychange', onVisibility);

  run();

  return {
    canvas,

    /** What the surface is currently running. Live object — a control panel
     *  reads it to show current values; write through `update`, not here. */
    config,

    /**
     * Sit the field on one artwork's colours.
     *
     * A known artwork applies at once and an unknown one is read immediately —
     * nested unfocused frames get almost no idle time, and deferring the first
     * read is what left 18 of 20 artworks unanalysed.
     */
    adoptImage(src) {
      fromSrc = src;
      toSrc = src;
      travel = 0;
      applyKnown();
      requestPalette(src);
      recompute();
      if (!running) once();
    },

    /**
     * Blend one artwork's palette into the next as a scroll travels between them.
     *
     * Both ends are image colours: the field never passes back through the brand
     * stops on its way from one artwork to the next, which is what made
     * mid-scroll look washed out. Safe to call every painted frame.
     */
    blendImages(srcFrom, srcTo, t) {
      fromSrc = srcFrom;
      toSrc = srcTo;
      travel = Math.min(Math.max(t, 0), 1);
      applyKnown();
      requestPalette(srcFrom);
      requestPalette(srcTo);
      recompute();
      if (!running) once();
    },

    /** 'adaptive' — artwork colours · 'neutral' — the brand stops alone. */
    setMode(next) {
      mode = next === 'neutral' ? 'neutral' : 'adaptive';
      recompute();
      if (!running) once();
    },

    /** Which mode is running. */
    mode: () => mode,

    /**
     * Choose the four neutral stops, lightest to darkest.
     *
     * Each is a `--token-name`, which follows the theme, or a literal CSS colour,
     * which does not. Which tokens make the best ONEMO neutral is an open design
     * question, so this exists to be answered by looking rather than arguing.
     *
     * @param next {top, accent, bottom, dark}; omit a band to keep it
     */
    setNeutralStops(next) {
      const previous = neutral;
      stops = { ...stops, ...next };
      config.neutralStops = stops;
      neutral = neutralPalette(stops);
      if (from === previous) from = neutral;
      if (to === previous) to = neutral;
      recompute();
      if (!running) once();
    },

    /** The four stops currently chosen, as given — token names or colours. */
    neutralStops: () => ({ ...stops }),



    /** Grain, gradient and motion settings. */
    update(patch) {
      Object.assign(config, patch);
      run();
    },


    resize() { if (!running) once(); },

    /** Release everything. The page keeps its own background from here. */
    disconnect() {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      stopWatchingTheme();
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (owned) canvas.remove();
    },
  };
}
