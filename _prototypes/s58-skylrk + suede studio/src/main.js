import Stats from 'stats.js';

// ---------- FPS meter ----------
const stats = new Stats(); stats.showPanel(0);
stats.dom.style.cssText = 'position:fixed;right:8px;top:48px;z-index:6;';
document.body.appendChild(stats.dom);

// ---------- state — defaults are skylrk's EXACT captured config (copper PDP) ----------
const state = {
  mode: 'skylrk',
  // default palette: neutral greyscale + ONE dusty-blue spot (band order dark->bottom->accent->top)
  top:    [0.95, 0.95, 0.96],  // white
  accent: [0.45, 0.55, 0.65],  // dusty blue (the single colour spot)
  bottom: [0.50, 0.50, 0.52],  // grey
  dark:   [0.06, 0.06, 0.07],  // near-black (also the background)
  intensity: 0.05,                  // uIntensity — skylrk's EXACT grain strength
  focusStrength: 0.0,               // uFocusStrength
  size: 1.5, gradScale: 1.0, gradRot: 0, gradOffX: 0, gradOffY: 0, softness: 0.85,
  gradSpeed: 1.0, grainSpeed: 1.0, glass: false,
  load: 1, // GPU LOAD — supersample area multiplier (simulate a weaker device by making every engine do N× the fragment work)
  nativeDpr: false, // false = dpr capped at 2 (exactly what skylrk.com does) · true = full device dpr (sharper grain, ~2.25× cost)
  grainAnim: 1,     // WebGL grain motion: 0 static · 1 animated · 2 jittered-static
  colorSafe: false, // zero-mean grain — preserves the average colour (vs skylrk's brightening hash)
  lumaOnly: false,  // apply grain to luminance only — hue/chroma stay exact
  pattern: 0, // 0 = skylrk lava-lamp (WebGL) · 1-7 = Paper shapes (wave/dots/truchet/corners/ripple/blob/sphere)
};

// ---------- WebGL renderer (skylrk-exact + mattdesl grain swap) ----------
const canvas = document.getElementById('surface');
const gl = canvas.getContext('webgl', { antialias:false, powerPreference:'high-performance' });

const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;

// Ashima simplex-3D (only for the mattdesl "expensive upstream" comparison)
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

// ===== skylrk's EXACT gradient + grain (verbatim from their live bundle) =====
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uGrainTime, uIntensity, uMode, uGrainSize, uFocusStrength, uGradScale, uGradRot, uPattern, uSoftness, uGrainAnim, uColorSafe, uLumaOnly, uMeasure; // uTime=gradient (speed-scaled) · uGrainTime=grain (independent) · uMeasure: 0=both 1=gradient-only 2=grain-only (perf isolation)
uniform vec2 uPxRes, uFocusPoint, uGradOff;
uniform vec3 uTopColor, uBottomColor, uAccentColor, uDarkColor;
${SNOISE}
mat2 Rot(float a){ float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
vec2 hash(vec2 p){ p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37))); return fract(sin(p)*43758.5453); }
float vnoise(in vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
 float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)), dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),
             mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)), dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);
 return 0.5+0.5*n; }
float gaussian(float z,float u,float o){ return (1.0/(o*sqrt(2.0*3.1415)))*exp(-(((z-u)*(z-u))/(2.0*(o*o)))); }
// ===== Paper-ported pattern helpers (procedural randomR -> hash21, no noise texture) =====
#define TWO_PI 6.28318530718
float hash21(vec2 p){ p=fract(p*vec2(0.3183099,0.3678794))+0.1; p+=dot(p,p+19.19); return fract(p.x*p.y); }
float hash11(float p){ p=fract(p*0.3183099)+0.1; p*=p+19.19; return fract(p*p); }
vec2 rotate(vec2 uv,float th){ return mat2(cos(th),sin(th),-sin(th),cos(th))*uv; }
float valueNoiseR(vec2 st){ vec2 i=floor(st),f=fract(st); float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbmR(vec2 n){ float total=0.0,amp=0.2; for(int i=0;i<3;i++){ n=rotate(n,0.3); total+=valueNoiseR(n)*amp; n*=1.99; amp*=0.6; } return total; }
vec2 truchet(vec2 uv,float idx){ idx=fract((idx-0.5)*2.0); if(idx>0.75)uv=vec2(1.0)-uv; else if(idx>0.5)uv=vec2(1.0-uv.x,uv.y); else if(idx>0.25)uv=1.0-vec2(1.0-uv.x,uv.y); return uv; }
// Paper's shape->4-band gradient (colors ordered dark,bottom,accent,top; black background)
vec3 bandColor(float s){
  float aa=0.008;
  s=clamp(s-0.5/4.0,0.0,1.0);
  float totalShape=smoothstep(0.0,uSoftness+2.0*aa,clamp(s*4.0,0.0,1.0));
  float mixer=s*3.0; vec3 grad=uDarkColor; float lt;
  lt=smoothstep(0.5-0.5*uSoftness-aa,0.5+0.5*uSoftness+aa,clamp(mixer-0.0,0.0,1.0)); grad=mix(grad,uBottomColor,lt);
  lt=smoothstep(0.5-0.5*uSoftness-aa,0.5+0.5*uSoftness+aa,clamp(mixer-1.0,0.0,1.0)); grad=mix(grad,uAccentColor,lt);
  lt=smoothstep(0.5-0.5*uSoftness-aa,0.5+0.5*uSoftness+aa,clamp(mixer-2.0,0.0,1.0)); grad=mix(grad,uTopColor,lt);
  return mix(uDarkColor, grad, totalShape); // background = dark swatch (no hardcoded black)
}
void main(){
  vec2 uv=vUv;
  float aspectRatio=uPxRes.x/uPxRes.y;
  vec3 col;
  if(uMeasure>1.5){ col=vec3(0.5); } else      // grain-only isolation: flat fill, skip the whole gradient/pattern compute
  if(uPattern<0.5){
    // ===== skylrk lava-lamp (verbatim 4-colour gradient) =====
    vec2 tuv=(uv-0.5)/max(uGradScale,0.05);
    tuv-=uGradOff; tuv*=Rot(radians(uGradRot));
    float t=uTime*0.5;
    float degree=vnoise(vec2(t*0.05, tuv.x*tuv.y));
    tuv.y*=1.0/aspectRatio;
    tuv*=Rot(radians((degree-0.5)*720.0+180.0));
    tuv.y*=aspectRatio;
    float frequency=5.0, amplitude=30.0, speed=t*2.0;
    tuv.x+=sin(tuv.y*frequency+speed)/amplitude;
    tuv.y+=sin(tuv.x*frequency*1.5+speed)/(amplitude*0.5);
    vec3 color1=uTopColor, color2=uDarkColor, color3=uAccentColor, color4=uBottomColor;
    vec3 layer1=mix(color3,color2,smoothstep(-0.3,0.2,(tuv*Rot(radians(-5.0))).x));
    vec3 layer2=mix(color4,color1,smoothstep(-0.3,0.2,(tuv*Rot(radians(-5.0))).x));
    vec3 flatColor=mix(layer1,layer2,smoothstep(0.5,-0.3,tuv.y));
    vec2 warp=tuv-(uv-0.5);
    vec2 focusPt=uFocusPoint-0.5;
    vec2 delta=(uv-0.5)-focusPt+warp*0.5; delta.x*=aspectRatio;
    float d=length(delta);
    float radialMask=smoothstep(0.6,0.0,d)*uFocusStrength;
    col=mix(flatColor, mix(flatColor,color1,0.45), radialMask);
  } else {
    // ===== Paper-ported shapes (wave/dots/truchet/corners/ripple/blob/sphere) -> 4-band gradient =====
    vec2 s=(uv-0.5); s.x*=aspectRatio;
    s/=max(uGradScale,0.05); s-=uGradOff; s=rotate(s,radians(uGradRot));
    float ts=uTime*0.1; float shape=0.0;
    if(uPattern<1.5){            // wave
      vec2 su=s*2.5;
      float wave=cos(0.5*su.x-4.0*ts)*sin(1.5*su.x+2.0*ts)*(0.75+0.25*cos(6.0*ts));
      shape=1.0-smoothstep(-1.0,1.0,su.y+wave);
    } else if(uPattern<2.5){     // dots
      vec2 su=s*10.0;
      float stripeIdx=floor(2.0*su.x/TWO_PI);
      float rnd=hash11(stripeIdx+2.0);
      shape=pow(abs(sin(su.x)*cos(su.y-5.0*rnd*ts)),4.0);
    } else if(uPattern<3.5){     // truchet
      vec2 su=s*12.0;
      float n2=valueNoiseR(su*0.4-3.75*ts);
      su.x+=10.0; su*=0.6;
      vec2 tile=truchet(fract(su),hash21(floor(su)));
      float d1=length(tile); float d2=length(tile-vec2(1.0));
      shape=smoothstep(0.2,0.55,d1+n2)*smoothstep(0.8,0.45,d1-n2);
      shape+=smoothstep(0.2,0.55,d2+n2)*smoothstep(0.8,0.45,d2-n2);
      shape=pow(shape,1.5);
    } else if(uPattern<4.5){     // corners
      vec2 su=s*0.6; vec2 outer=vec2(0.5);
      vec2 bl=smoothstep(vec2(0.0),outer,su+vec2(0.1+0.1*sin(3.0*ts),0.2-0.1*sin(5.25*ts)));
      vec2 tr=smoothstep(vec2(0.0),outer,1.0-su);
      shape=1.0-bl.x*bl.y*tr.x*tr.y;
      su=-su;
      bl=smoothstep(vec2(0.0),outer,su+vec2(0.1+0.1*sin(3.0*ts),0.2-0.1*cos(5.25*ts)));
      tr=smoothstep(vec2(0.0),outer,1.0-su);
      shape-=bl.x*bl.y*tr.x*tr.y;
      shape=1.0-smoothstep(0.0,1.0,shape);
    } else if(uPattern<5.5){     // ripple
      vec2 su=s*2.0;
      float dist=length(0.4*su);
      shape=sin(pow(dist,1.2)*5.0-3.0*ts)*0.5+0.5;
    } else if(uPattern<6.5){     // blob
      vec2 su=s;
      vec2 f1=0.25*vec2(1.3*sin(ts),0.2+1.3*cos(0.6*ts+4.0));
      vec2 f2=0.2*vec2(1.2*sin(-ts),1.3*sin(1.6*ts));
      vec2 f3=0.25*vec2(1.7*cos(-0.6*ts),cos(-1.6*ts));
      vec2 f4=0.3*vec2(1.4*cos(0.8*ts),1.2*sin(-0.6*ts-3.0));
      shape =0.5*pow(1.0-clamp(length(su+f1),0.0,1.0),5.0);
      shape+=0.5*pow(1.0-clamp(length(su+f2),0.0,1.0),5.0);
      shape+=0.5*pow(1.0-clamp(length(su+f3),0.0,1.0),5.0);
      shape+=0.5*pow(1.0-clamp(length(su+f4),0.0,1.0),5.0);
      shape=smoothstep(0.0,0.9,shape);
      float edge=smoothstep(0.25,0.3,shape);
      shape=mix(0.0,shape,edge);
    } else {                     // sphere
      vec2 su=s*2.0;
      float dd=1.0-pow(length(su),2.0);
      vec3 pos=vec3(su,sqrt(max(dd,0.0)));
      vec3 lightPos=normalize(vec3(cos(1.5*ts),0.8,sin(1.25*ts)));
      shape=0.5+0.5*dot(lightPos,pos);
      shape*=step(0.0,dd);
    }
    col=bandColor(shape);
  }
  // ---- grain ----  uGrainAnim: 0 static · 1 animated · 2 jittered-static | uColorSafe: zero-mean (preserves avg colour) | uLumaOnly: hue-preserving
  if(uMeasure<0.5 || uMeasure>1.5){                             // run grain unless gradient-only isolation (uMeasure==1)
  float animOn = step(0.5, uGrainAnim);                         // 0 when static
  vec2 jit = vec2(0.0);
  if(uGrainAnim>1.5){ float k=floor(uGrainTime*24.0); jit=(vec2(hash11(k),hash11(k+7.0))-0.5)*4.0/uPxRes; } // static field, cheap per-frame screen jitter -> shimmer w/o recompute
  float raw, wt;
  if(uMode<0.5){
    // skylrk hash — grain SIZE snaps the sample to a uGrainSize-px grid (1.0 = verbatim per-pixel)
    float tg=uGrainTime*2.0*animOn;
    float gs=max(uGrainSize,1.0);
    vec2 guv=(floor((uv+jit)*uPxRes/gs)+0.5)*gs/uPxRes;
    float h=fract(sin(dot(guv,vec2(12.9898,78.233)))*43758.5453+tg);
    // default = skylrk's positive gaussian (brightening) · colour-safe = signed zero-mean
    raw = (uColorSafe>0.5) ? (h-0.5)*1.7 : gaussian(h,0.0,0.5*0.5);
    wt = 1.0;
  } else {
    // mattdesl simplex-3D — already signed/zero-mean by nature (this is why it's the colour-accurate one)
    vec2 mult=((uv+jit)*uPxRes)/max(uGrainSize,1.0);
    float offset=snoise(vec3(mult*0.45, uGrainTime*0.6*animOn));
    raw = snoise(vec3(mult, offset + uGrainTime*1.4*animOn));   // -1..1
    wt = 3.0;
  }
  float amt = uIntensity*wt;
  if(uLumaOnly>0.5){
    // apply grain to luminance only -> hue/chroma stay exact, only brightness micro-dithers
    float L=dot(col,vec3(0.299,0.587,0.114));
    col *= clamp((L + raw*amt)/max(L,1e-3), 0.0, 4.0);
  } else {
    col += vec3(raw) * (uMode<0.5 ? (1.0-col) : (1.0-col*0.5)) * amt;
  }
  }
  gl_FragColor=vec4(col,1.0);
}`;

function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog=gl.createProgram();
gl.attachShader(prog,compile(gl.VERTEX_SHADER,VERT)); gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FRAG));
gl.linkProgram(prog); gl.useProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) console.error('link', gl.getProgramInfoLog(prog));
const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const aPos=gl.getAttribLocation(prog,'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);
const U=n=>gl.getUniformLocation(prog,n);
const uTime=U('uTime'),uGrainTime=U('uGrainTime'),uIntensity=U('uIntensity'),uMode=U('uMode'),uGrainSize=U('uGrainSize'),uFocusStrength=U('uFocusStrength'),uGradScale=U('uGradScale'),uGradRot=U('uGradRot'),uGradOff=U('uGradOff'),uPattern=U('uPattern'),uSoftness=U('uSoftness'),uGrainAnim=U('uGrainAnim'),uColorSafe=U('uColorSafe'),uLumaOnly=U('uLumaOnly'),uMeasure=U('uMeasure'),
      uPxRes=U('uPxRes'),uFocusPoint=U('uFocusPoint'),uTop=U('uTopColor'),uBottom=U('uBottomColor'),uAccent=U('uAccentColor'),uDark=U('uDarkColor');

function baseDpr(){ return Math.min(devicePixelRatio||1, state.nativeDpr?3:2); }  // ×2 = skylrk.com's exact cap · native = full device dpr
// device limits — clamp BOTH per-axis (texture/renderbuffer/viewport) AND total area (drawing-buffer memory).
// iOS runs out of memory on the AREA, not the axis → without this, native + high load = lost context = black screen.
const MAXD=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096);
const VPD=(()=>{ const v=gl.getParameter(gl.MAX_VIEWPORT_DIMS); return v?[v[0],v[1]]:[16384,16384]; })();
const AREA_BUDGET=32e6;  // ~32MP — proven safe on iPhone 14 Pro Max (×2·×20); keeps the buffer well under the ~115MP that black-screens
let renderCapped=false;
function resize(){ const dpr=baseDpr(), f=Math.sqrt(state.load||1);
  let w=Math.floor(innerWidth*dpr*f), h=Math.floor(innerHeight*dpr*f); const wantW=w, wantH=h;
  w=Math.min(w,MAXD,VPD[0]); h=Math.min(h,MAXD,VPD[1]);
  const area=w*h; if(area>AREA_BUDGET){ const s=Math.sqrt(AREA_BUDGET/area); w=Math.max(1,Math.floor(w*s)); h=Math.max(1,Math.floor(h*s)); }
  renderCapped=(w<wantW||h<wantH);
  canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h); }
addEventListener('resize',resize); resize();
// safety net — if a context loss ever still happens, don't leave a black screen
canvas.addEventListener('webglcontextlost', e=>{ e.preventDefault(); console.warn('[webgl] context lost — load too high for device; lower GPU LOAD'); }, false);

// ---------- Paper (lazy, vanilla ShaderMount — multiple shaders) ----------
// pattern 0-7 = grain-gradient (lava-lamp fallback + 7 shapes) · 8 = mesh-gradient · 9 = metaballs (both whole separate Paper shaders)
let paper=null, paperMod=null, paperKind=null;  // paperKind: 'grain' | 'mesh' | 'metaballs'
function rgbHex(c){ const h=x=>('0'+Math.max(0,Math.min(255,Math.round(x*255))).toString(16)).slice(-2); return '#'+h(c[0])+h(c[1])+h(c[2]); }
function paperKindForPattern(p){ return p===8?'mesh' : p===9?'metaballs' : 'grain'; }
async function ensurePaperMod(){ if(!paperMod){ paperMod=await import('@paper-design/shaders'); window.__paper=paperMod; } return paperMod; }
async function loadTex(tex){ await new Promise(r=>{ if(tex.complete&&tex.naturalWidth) r(); else { tex.onload=r; tex.onerror=r; } }); return tex; }
// (re)mount the Paper shader that matches `kind`, disposing any prior mount
async function mountPaper(kind){
  await ensurePaperMod();
  const { ShaderMount, grainGradientFragmentShader, meshGradientFragmentShader, metaballsFragmentShader, getShaderColorFromString, getShaderNoiseTexture } = paperMod;
  if(paper){ try{ paper.dispose(); }catch(_){} paper=null; }
  const parent=document.getElementById('paperParent'); while(parent.firstChild) parent.removeChild(parent.firstChild);
  const col=s=>getShaderColorFromString(s);
  const colors=[col(rgbHex(state.dark)),col(rgbHex(state.bottom)),col(rgbHex(state.accent)),col(rgbHex(state.top))];
  const sizing={ u_scale:state.gradScale,u_rotation:state.gradRot,u_offsetX:state.gradOffX,u_offsetY:state.gradOffY,u_originX:0.5,u_originY:0.45,u_fit:0,u_worldWidth:0,u_worldHeight:0 };
  let frag, uniforms;
  if(kind==='mesh'){
    frag=meshGradientFragmentShader;
    uniforms={ u_colors:colors, u_colorsCount:4, u_distortion:0.8, u_swirl:0.6, ...sizing };
  } else if(kind==='metaballs'){
    frag=metaballsFragmentShader;
    uniforms={ u_colors:colors, u_colorsCount:4, u_colorBack:col(rgbHex(state.dark)), u_count:6, u_size:1.0, u_sizeRange:0.6, ...sizing };
    if(getShaderNoiseTexture) uniforms.u_noiseTexture=await loadTex(getShaderNoiseTexture());
  } else {
    // grain-gradient — u_intensity kept 0 so the GRAIN slider (u_noise) is the sole grain control
    frag=grainGradientFragmentShader;
    uniforms={ u_colors:colors, u_colorsCount:4, u_colorBack:col(rgbHex(state.dark)), u_intensity:0.0, u_noise:state.intensity, u_softness:state.softness,
      u_shape:(state.pattern>=1&&state.pattern<=7?state.pattern:1), ...sizing };
    if(getShaderNoiseTexture) uniforms.u_noiseTexture=await loadTex(getShaderNoiseTexture());
  }
  try{ paper=new ShaderMount(parent,frag,uniforms,undefined,state.gradSpeed); paperKind=kind;
    const c2=parent.querySelector('canvas'); if(c2){ c2.style.width='100%'; c2.style.height='100%'; c2.style.display='block'; }
    window.__paperInst=paper; requestAnimationFrame(()=>dispatchEvent(new Event('resize'))); console.log('[paper] mounted',kind);
  }catch(e){ console.error('[paper] ShaderMount failed:',e.message); }
}
function paperSetColor(){ if(!paper||!paperMod) return; const c=paperMod.getShaderColorFromString;
  const u={ u_colorsCount:4, u_colors:[c(rgbHex(state.dark)),c(rgbHex(state.bottom)),c(rgbHex(state.accent)),c(rgbHex(state.top))] };
  if(paperKind!=='mesh') u.u_colorBack=c(rgbHex(state.dark));  // mesh-gradient has no background colour
  try{ paper.setUniforms(u); }catch(_){} }

// ---------- loop ----------
let t0=performance.now(), loopPaused=false;
// pause the render loop when the tab is hidden so a backgrounded surface stops cooking the GPU
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ t0=performance.now()-((performance.now()-t0)); requestAnimationFrame(frame); } });
function frame(now){
  if(document.hidden) return;                                // stop entirely when not visible (no rAF re-arm)
  if(loopPaused){ requestAnimationFrame(frame); return; }   // perf probe owns the context while measuring
  stats.begin();
  if(state.mode!=='paper'){
    const elapsed=(now-t0)/1000;
    gl.useProgram(prog);
    gl.uniform1f(uTime, elapsed*state.gradSpeed); gl.uniform1f(uGrainTime, elapsed*state.grainSpeed); // independent gradient + grain speeds
    gl.uniform1f(uIntensity,state.intensity); gl.uniform1f(uMode, state.mode==='mattdesl'?1:0);
    gl.uniform1f(uGrainSize, Math.max(1.0,state.size)); gl.uniform1f(uFocusStrength, state.focusStrength);
    gl.uniform1f(uGradScale, state.gradScale); gl.uniform1f(uGradRot, state.gradRot); gl.uniform2f(uGradOff, state.gradOffX, state.gradOffY);
    // patterns 8/9 are Paper-only (mesh-gradient/metaballs) — on WebGL show the nearest equivalent: lava-lamp / blob
    const wp = state.pattern===8?0 : state.pattern===9?6 : state.pattern;
    gl.uniform1f(uPattern, wp); gl.uniform1f(uSoftness, state.softness);
    gl.uniform1f(uGrainAnim, state.grainAnim); gl.uniform1f(uColorSafe, state.colorSafe?1:0); gl.uniform1f(uLumaOnly, state.lumaOnly?1:0); gl.uniform1f(uMeasure, 0);
    gl.uniform2f(uPxRes, canvas.width, canvas.height); gl.uniform2f(uFocusPoint, 0.5, 0.5);
    gl.uniform3f(uTop,state.top[0],state.top[1],state.top[2]); gl.uniform3f(uBottom,state.bottom[0],state.bottom[1],state.bottom[2]);
    gl.uniform3f(uAccent,state.accent[0],state.accent[1],state.accent[2]); gl.uniform3f(uDark,state.dark[0],state.dark[1],state.dark[2]);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  stats.end(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// GPU cost probe — WebGL engines only (Paper renders in its own context; measure it on-device via FPS-under-load).
// Times ms/draw at a fixed high resolution with gl.finish so the cheap-hash vs expensive-3D-noise gap actually registers.
function probeOne(mode,pattern,iters,measure){
  gl.useProgram(prog);
  gl.uniform1f(uMeasure, measure||0);
  gl.uniform1f(uMode,mode==='mattdesl'?1:0); gl.uniform1f(uPattern,pattern); gl.uniform1f(uSoftness,0.85);
  gl.uniform1f(uIntensity,0.05); gl.uniform1f(uGrainSize,1.5); gl.uniform1f(uFocusStrength,0.0);
  gl.uniform1f(uGradScale,1); gl.uniform1f(uGradRot,0); gl.uniform2f(uGradOff,0,0);
  gl.uniform2f(uPxRes,canvas.width,canvas.height); gl.uniform2f(uFocusPoint,.5,.5);
  gl.uniform3f(uTop,.95,.95,.96); gl.uniform3f(uBottom,.5,.5,.52); gl.uniform3f(uAccent,.45,.55,.65); gl.uniform3f(uDark,.06,.06,.07);
  const px=new Uint8Array(4);
  for(let i=0;i<30;i++){ gl.uniform1f(uTime,i*0.016); gl.uniform1f(uGrainTime,i*0.016); gl.drawArrays(gl.TRIANGLES,0,3); }
  gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); // warm-up + real GPU sync (gl.finish is a no-op stall under ANGLE-Metal)
  const a=performance.now();
  for(let i=0;i<iters;i++){ gl.uniform1f(uTime,i*0.016); gl.uniform1f(uGrainTime,i*0.016); gl.drawArrays(gl.TRIANGLES,0,3); }
  gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); // forces the GPU to finish all queued draws before returning
  return (performance.now()-a)/iters;
}
// __perf(width,height,iters) → ms/draw per config at the given internal resolution (fragment cost scales with pixel count)
window.__perf=(w=2560,h=1440,iters=240)=>{
  loopPaused=true;
  const ow=canvas.width, oh=canvas.height;
  canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h);
  const cfgs=[['skylrk',0,'skylrk lava-lamp (hash grain)'],['mattdesl',0,'mattdesl lava-lamp (3D-noise grain)'],
              ['skylrk',6,'skylrk blob'],['mattdesl',6,'mattdesl blob'],['skylrk',7,'skylrk sphere'],['skylrk',3,'skylrk truchet']];
  for(const [m,p] of cfgs) probeOne(m,p,80);  // full warm-up sweep so config[0] doesn't eat the post-resize cold-start cost
  const out={ resolution:`${w}x${h}`, mpx:+((w*h)/1e6).toFixed(2), iters, msPerDraw:{} };
  for(const [m,p,label] of cfgs){ out.msPerDraw[label]=+probeOne(m,p,iters).toFixed(4); }
  // restore
  canvas.width=ow; canvas.height=oh; gl.viewport(0,0,ow,oh); loopPaused=false;
  return out;
};
// __grainProbe → isolates grain cost: gradient-only, grain-only, grain+gradient (ms/draw) per WebGL engine, lava-lamp pattern
window.__grainProbe=(w=3000,h=3000,iters=300)=>{
  loopPaused=true;
  const ow=canvas.width, oh=canvas.height;
  canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h);
  for(const m of ['skylrk','mattdesl']) for(const meas of [1,2,0]) probeOne(m,0,80,meas); // full warm-up sweep (no cold-start bias)
  const ms={};
  for(const m of ['skylrk','mattdesl']){
    const gradientOnly=+probeOne(m,0,iters,1).toFixed(4);
    const grainOnly   =+probeOne(m,0,iters,2).toFixed(4);
    const both        =+probeOne(m,0,iters,0).toFixed(4);
    ms[m]={ gradientOnly, grainOnly, grainPlusGradient:both };
  }
  canvas.width=ow; canvas.height=oh; gl.viewport(0,0,ow,oh); loopPaused=false;
  return { resolution:`${w}x${h}`, mpx:+((w*h)/1e6).toFixed(2), iters, ms };
};

// ---------- controls ----------
function showPaper(on){ document.getElementById('paperParent').style.display=on?'block':'none'; canvas.style.display=on?'none':'block'; }
function setMode(m){ state.mode=m;
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  // pattern persists across engines (like-to-like); just mirror it to Paper if active
  if(m==='paper'){ showPaper(true); mountPaper(paperKindForPattern(state.pattern)).then(()=>{ showPaper(true); dispatchEvent(new Event('resize')); }); } else showPaper(false);
  syncEngineUI();
}
// controls must reflect what the SELECTED engine actually applies — disable + annotate the no-ops so the panel never claims a setting that isn't true for this engine
function setRowNA(rowId, na, msg){
  const row=document.getElementById(rowId); if(!row) return;
  const input=row.querySelector('input,select,button'); if(input) input.disabled=na;
  let note=row.querySelector('.na-note');
  if(na){ if(!note){ note=document.createElement('small'); note.className='na-note'; row.querySelector('span').appendChild(note); } note.textContent=msg; }
  else if(note){ note.remove(); }
}
function syncEngineUI(){
  const paper=state.mode==='paper';
  const kind = paper ? paperKindForPattern(state.pattern) : null;
  const paperWhole = paper && (kind==='mesh'||kind==='metaballs');  // separate Paper shaders: no film grain / softness
  const wholeName = kind==='mesh'?'mesh-gradient':'metaballs';
  const softnessLive = (paper && kind==='grain') || (!paper && state.pattern>=1 && state.pattern<=7);
  setRowNA('row-grain', paperWhole, 'n/a · '+wholeName);
  setRowNA('row-size', paper, 'n/a · paper');
  setRowNA('row-grainSpeed', paper, 'n/a · paper');
  setRowNA('row-grainMotion', paper, 'n/a · paper');   // grain motion/colour-safe/luma are WebGL-grain controls
  setRowNA('row-colorSafe', paper, 'n/a · paper');
  setRowNA('row-lumaOnly', paper, 'n/a · paper');
  setRowNA('row-softness', !softnessLive, paperWhole?('n/a · '+wholeName):'n/a · lava-lamp');
  const pn=document.getElementById('patternNote'); let note='';
  if(paper){ if(state.pattern===0) note='→ wave (use mesh-gradient for lava-lamp)'; }
  else { if(state.pattern===8) note='paper-only → lava-lamp'; else if(state.pattern===9) note='paper-only → blob'; }
  if(pn) pn.textContent=note;
}
document.querySelectorAll('[data-mode]').forEach(b=> b.onclick=()=>setMode(b.dataset.mode));
// category tabs (colour | gradient | noise) swap the control panel
document.querySelectorAll('[data-cat]').forEach(b=> b.onclick=()=>{
  document.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('active',x===b));
  ['colour','gradient','noise','perf'].forEach(p=>{ const el=document.getElementById('panel-'+p); if(el) el.style.display = b.dataset.cat===p?'flex':'none'; });
});
const hex2rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
[['cTop','top'],['cAccent','accent'],['cBottom','bottom'],['cDark','dark']].forEach(([id,key])=>{
  document.getElementById(id).oninput = e=>{ state[key]=hex2rgb(e.target.value); paperSetColor(); };
});
// grain SIZE — WebGL grain only (mattdesl). Paper grain is texture-based (no size uniform) -> no-op on Paper.
document.getElementById('size').oninput = e=>{ state.size=+e.target.value; };
// grain INTENSITY — Paper grain-gradient only (u_noise = film-grain overlay); mesh/metaballs have no film grain
document.getElementById('intensity').oninput = e=>{ state.intensity=+e.target.value; if(paper&&paperKind==='grain') try{paper.setUniforms({u_noise:state.intensity});}catch(_){} };
// gradient SCALE / ROTATION / OFFSET — apply to BOTH engines (Paper uniforms + WebGL uniforms in loop) for like-to-like
document.getElementById('gradScale').oninput = e=>{ state.gradScale=+e.target.value; if(paper) try{paper.setUniforms({u_scale:state.gradScale});}catch(_){} };
document.getElementById('gradRot').oninput  = e=>{ state.gradRot=+e.target.value;  if(paper) try{paper.setUniforms({u_rotation:state.gradRot});}catch(_){} };
document.getElementById('gradOffX').oninput = e=>{ state.gradOffX=+e.target.value; if(paper) try{paper.setUniforms({u_offsetX:state.gradOffX});}catch(_){} };
document.getElementById('gradOffY').oninput = e=>{ state.gradOffY=+e.target.value; if(paper) try{paper.setUniforms({u_offsetY:state.gradOffY});}catch(_){} };
document.getElementById('softness').oninput = e=>{ state.softness=+e.target.value; if(paper&&paperKind==='grain') try{paper.setUniforms({u_softness:state.softness});}catch(_){} };
document.getElementById('gradSpeed').oninput = e=>{ state.gradSpeed=+e.target.value; if(paper) try{paper.setSpeed(state.gradSpeed);}catch(_){} };
// gradient PATTERN — current engine (skylrk/mattdesl render it in WebGL; paper via u_shape, or a whole shader remount for mesh/metaballs). No mode switch — like-to-like.
document.getElementById('pattern').oninput = e=>{ state.pattern=+e.target.value;
  if(state.mode==='paper'){
    const want=paperKindForPattern(state.pattern);
    if(want!==paperKind){ mountPaper(want); }                                  // mesh/metaballs/grain are different shaders → remount
    else if(paper&&want==='grain'){ try{paper.setUniforms({u_shape:(state.pattern>=1&&state.pattern<=7?state.pattern:1)});}catch(_){} }
  }
  syncEngineUI();
};
document.getElementById('grainSpeed').oninput = e=>{ state.grainSpeed=+e.target.value; };
document.getElementById('grainAnim').oninput = e=>{ state.grainAnim=+e.target.value; };
const optToggle=(id,key)=>{ const b=document.getElementById(id); b.onclick=()=>{ state[key]=!state[key]; b.textContent=state[key]?'on':'off'; b.classList.toggle('on',state[key]); }; };
optToggle('colorSafeToggle','colorSafe'); optToggle('lumaToggle','lumaOnly');
document.getElementById('glassToggle').onclick = e=>{ state.glass=!state.glass; document.getElementById('glassPanel').style.display=state.glass?'block':'none'; e.target.classList.toggle('on',state.glass); };
// GPU LOAD — supersample all engines equally to simulate a weaker device; watch the FPS meter diverge
function applyLoad(){
  resize();  // WebGL canvas re-sizes with state.load + dpr mode
  if(paper){ try{ const prCap=Math.sqrt(AREA_BUDGET/Math.max(1,innerWidth*innerHeight)); // bound Paper's buffer by the same area budget
    paper.setMinPixelRatio(Math.min(16, prCap, baseDpr()*Math.sqrt(state.load))); }catch(_){} dispatchEvent(new Event('resize')); }
  const info=document.getElementById('loadInfo'); if(info) info.textContent='· '+(canvas.width*canvas.height/1e6).toFixed(1)+'MP ≈ '+state.load+'× weaker GPU'+(renderCapped?' · device max':'');
  const di=document.getElementById('dprInfo'); if(di) di.textContent='· '+canvas.width+'×'+canvas.height+(state.nativeDpr?' native':' (skylrk caps here)');
}
document.getElementById('load').oninput = e=>{ state.load=+e.target.value; applyLoad(); };
// RENDER DPR — ×2 matches skylrk.com exactly · native = full device dpr so you can see the grain crispness difference
document.getElementById('dprToggle').onclick = e=>{ state.nativeDpr=!state.nativeDpr;
  e.target.textContent = state.nativeDpr ? 'native · full dpr' : '×2 · skylrk-match';
  e.target.classList.toggle('on', state.nativeDpr); applyLoad();
};
// on-device measure — ms/draw skylrk(hash) vs mattdesl(3D-noise) at the CURRENT load, with the real ratio
document.getElementById('measureBtn').onclick = ()=>{
  const out=document.getElementById('measInfo'); out.textContent='· measuring…';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const r=window.__perf(canvas.width, canvas.height, 240);
    const s=r.msPerDraw['skylrk lava-lamp (hash grain)'], m=r.msPerDraw['mattdesl lava-lamp (3D-noise grain)'];
    out.textContent=`· skylrk ${s.toFixed(3)}ms · mattdesl ${m.toFixed(3)}ms (${(m/s).toFixed(2)}×)`;
  }));
};

// ---------- adaptive: extract 4 gradient colours FROM an uploaded effect image ----------
function toHex(c){ const h=x=>('0'+Math.max(0,Math.min(255,Math.round(x*255))).toString(16)).slice(-2); return '#'+h(c[0])+h(c[1])+h(c[2]); }
// swatches always reflect the live state colours (state = single source of truth, never hardcoded-divergent)
function syncSwatches(){ document.getElementById('cTop').value=toHex(state.top); document.getElementById('cAccent').value=toHex(state.accent); document.getElementById('cBottom').value=toHex(state.bottom); document.getElementById('cDark').value=toHex(state.dark); }
const _lum=c=>0.299*c[0]+0.587*c[1]+0.114*c[2];
const _d2=(a,b)=>{const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z;};
// 4-colour palette via k-means — captures the image's ACTUAL distinct colours (contrasting hues AND neutrals: greys/blacks/whites), not one hue scaled down.
function extractColors(img){
  const n=64,c=document.createElement('canvas'); c.width=c.height=n;
  const x=c.getContext('2d',{willReadFrequently:true}); x.clearRect(0,0,n,n);
  try{ x.drawImage(img,0,0,n,n); }catch(e){ console.warn('extract drawImage fail:',e.message); return null; }
  let data; try{ data=x.getImageData(0,0,n,n).data; }catch(e){ console.warn('extract tainted:',e.message); return null; }
  const px=[];
  for(let i=0;i<data.length;i+=4){ if(data[i+3]<100) continue; px.push([data[i]/255,data[i+1]/255,data[i+2]/255]); }
  if(px.length<16){ console.warn('extract: too few opaque pixels ('+px.length+') — iOS blank canvas?'); return null; }
  const K=4;
  // seed centroids by spreading across the luminance range (stable init -> distinct clusters)
  const byL=[...px].sort((a,b)=>_lum(a)-_lum(b));
  let cent=Array.from({length:K},(_,k)=> byL[Math.floor((k+0.5)/K*byL.length)].slice());
  for(let it=0; it<12; it++){
    const sum=cent.map(()=>[0,0,0,0]);
    for(const p of px){ let bi=0,bd=1e9; for(let k=0;k<K;k++){ const d=_d2(p,cent[k]); if(d<bd){bd=d;bi=k;} } const s=sum[bi]; s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++; }
    for(let k=0;k<K;k++){ if(sum[k][3]>0) cent[k]=[sum[k][0]/sum[k][3],sum[k][1]/sum[k][3],sum[k][2]/sum[k][3]]; }
  }
  // assign brightest->top ... darkest->dark, so the gradient runs light-at-top to dark-at-bottom
  cent.sort((a,b)=>_lum(b)-_lum(a));
  console.log('[extract] palette=', cent.map(c=>c.map(v=>+v.toFixed(2)).join(',')).join(' | '));
  return { top:cent[0], accent:cent[1], bottom:cent[2], dark:cent[3] };
}
function applyImageColors(img, el){
  const go=()=>{ const c=extractColors(img); if(!c) return; state.top=c.top; state.accent=c.accent; state.bottom=c.bottom; state.dark=c.dark;
    syncSwatches(); paperSetColor();
    document.querySelectorAll('.prod').forEach(p=>p.classList.toggle('active',p===el)); };
  (img.complete && img.naturalWidth) ? go() : img.addEventListener('load',go,{once:true});
}
document.getElementById('imgUpload').onchange = e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return; const url=URL.createObjectURL(file); const img=new Image(); img.onload=()=>{ const pv=document.getElementById('uploadPreview'); pv.src=url; pv.style.display='inline-block'; applyImageColors(img,pv); }; img.src=url; };

// live value badge on every slider (so settings are readable/memorable)
document.querySelectorAll('#dock input[type=range]').forEach(r=>{
  const out=document.createElement('output'); out.className='val'; r.after(out);
  const step=parseFloat(r.step)||1, dec=step<0.01?3:(step<1?2:0);
  const upd=()=>{ out.textContent=parseFloat(r.value).toFixed(dec); };
  r.addEventListener('input',upd); upd();
});
syncSwatches(); // swatches reflect live state on load
applyLoad();    // populate the PERF readouts (dpr/resolution) on load

// ---------- hide chrome on swipe (preview the surface full-screen) ----------
const stageEl=document.getElementById('stage');
const setUI=show=>stageEl.classList.toggle('ui-hidden', !show);
let _swipeY=null;
stageEl.addEventListener('touchstart', e=>{ _swipeY = e.target.closest('#dock,#topbar,#uiHandle') ? null : e.touches[0].clientY; }, {passive:true});
stageEl.addEventListener('touchmove', e=>{ if(_swipeY==null) return; const dy=e.touches[0].clientY-_swipeY;
  if(dy>45){ setUI(false); _swipeY=null; } else if(dy<-45){ setUI(true); _swipeY=null; } }, {passive:true});
addEventListener('wheel', e=>{ if(Math.abs(e.deltaY)>6) setUI(e.deltaY<0); }, {passive:true});  // scroll down hides, up shows
document.getElementById('uiHandle').onclick=()=>setUI(true);

window.__setMode=setMode; window.__state=state;
window.__uploadTest=(dataUrl)=>new Promise(res=>{ const img=new Image(); img.onload=()=>{ const pv=document.getElementById('uploadPreview'); pv.src=dataUrl; pv.style.display='inline-block'; applyImageColors(img,pv); res(true); }; img.onerror=()=>res(false); img.src=dataUrl; });
setMode('skylrk');
