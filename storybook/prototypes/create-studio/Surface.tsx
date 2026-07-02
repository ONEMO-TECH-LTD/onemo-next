'use client';
import * as React from 'react';

/**
 * Surface — the editor background: a flat brand colour + the REAL mattdesl
 * simplex-3D film grain, with the proto's grain controls (motion, speed, amount,
 * size, luma-lock). No gradient. Animated OR static.
 *
 * Grain = Ashima simplex-3D, domain-warped (verbatim from the surface comparator,
 * `_prototypes/s58-skylrk + suede studio/src/main.js`, mattdesl branch) — signed /
 * zero-mean, so it dithers around the brand colour instead of washing it lighter.
 *   motion: animated — grain flows through time (3D simplex glides on the time axis)
 *           static   — frozen single frame, ~zero GPU
 */

const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;

// Ashima simplex-3D (verbatim)
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
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;

const FRAG = `precision highp float;
varying vec2 vUv;
uniform vec2 uPxRes;
uniform vec3 uColor;
uniform float uGrainSize, uDensity, uIntensity, uSeed, uGrainTime, uGrainAnim, uLumaOnly;
${SNOISE}
void main(){
  vec3 col = uColor;
  float animOn = step(0.5, uGrainAnim);
  // grain maps to DEVICE pixels (uPxRes = backing res); size<1 = sub-pixel, density multiplies frequency.
  vec2 mult=(vUv*uPxRes)*uDensity/max(uGrainSize,0.05) + uSeed;
  float offset=snoise(vec3(mult*0.45, uGrainTime*0.6*animOn));
  float raw = snoise(vec3(mult, offset + uGrainTime*1.4*animOn));  // -1..1, mattdesl
  float amt = uIntensity;
  if(uLumaOnly>0.5){
    float L=dot(col,vec3(0.299,0.587,0.114));
    col *= clamp((L + raw*amt)/max(L,1e-3), 0.0, 4.0);   // brightness-only → hue locked
  } else {
    col += vec3(raw) * (1.0-col*0.5) * amt;              // mattdesl apply
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'compile failed');
  return sh;
}

export type GrainMotion = 'animated' | 'static';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Brand base colour. */
  base?: string;
  /** Grain amount (~0.15 ≈ the comparator; 0.05 ≈ skylrk's shipped subtle). */
  intensity?: number;
  /** Grain cell size in device px (1 = per-pixel; <1 = sub-pixel / finer). */
  grainSize?: number;
  /** Noise frequency multiplier — higher = denser/finer grain (compounds with size). */
  density?: number;
  /** Animation speed (motion = animated). */
  speed?: number;
  /** animated · static. */
  motion?: GrainMotion;
  /** Grain on brightness only → hue/chroma stay exact. */
  lumaOnly?: boolean;
  /** Shifts the noise field. */
  seed?: number;
  /** Render resolution multiplier. Defaults to the device pixel ratio (crisp). */
  quality?: number;
}

const MOTION: Record<GrainMotion, number> = { static: 0, animated: 1 };

export function Surface({
  base = '#3a4654',
  intensity = 0.15,
  grainSize = 1,
  density = 1,
  speed = 1,
  motion = 'animated',
  lumaOnly = false,
  seed = 0,
  quality,
  style,
  children,
  ...props
}: SurfaceProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uPxRes = U('uPxRes'), uColor = U('uColor'), uGrainSize = U('uGrainSize'),
      uDensity = U('uDensity'), uIntensity = U('uIntensity'), uSeed = U('uSeed'),
      uGrainTime = U('uGrainTime'), uGrainAnim = U('uGrainAnim'), uLumaOnly = U('uLumaOnly');

    const q = Math.max(1, quality ?? Math.min(3, window.devicePixelRatio || 1));
    const motionCode = MOTION[motion];
    const [r, g, b] = hexToRgb(base);

    const sizeCanvas = () => {
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      if (!cw || !ch) return false;
      const w = Math.min(2400, Math.round(cw * q)), h = Math.min(4800, Math.round(ch * q));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      return true;
    };

    const render = (tSec: number) => {
      gl.uniform2f(uPxRes, canvas.width, canvas.height);
      gl.uniform3f(uColor, r / 255, g / 255, b / 255);
      gl.uniform1f(uGrainSize, grainSize); // device-px grid (NOT ×q) → higher res = finer, not washed
      gl.uniform1f(uDensity, density);
      gl.uniform1f(uIntensity, intensity);
      gl.uniform1f(uSeed, seed);
      gl.uniform1f(uGrainTime, tSec);
      gl.uniform1f(uGrainAnim, motionCode);
      gl.uniform1f(uLumaOnly, lumaOnly ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    let raf = 0, start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      if (!sizeCanvas()) { raf = requestAnimationFrame(loop); return; }
      render(((now - start) / 1000) * speed);
      raf = requestAnimationFrame(loop);
    };

    if (motionCode === 0) {
      // static — draw once
      const drawOnce = () => { if (sizeCanvas()) render(0); else raf = requestAnimationFrame(drawOnce); };
      raf = requestAnimationFrame(drawOnce);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => { if (motionCode === 0 && sizeCanvas()) render(0); });
    ro.observe(wrap);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); gl.deleteProgram(prog); };
  }, [base, intensity, grainSize, density, speed, motion, lumaOnly, seed, quality]);

  return (
    <div ref={wrapRef} data-anat="surface" style={{ position: 'relative', overflow: 'hidden', background: base, ...style }} {...props}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      {children != null && <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>}
    </div>
  );
}
