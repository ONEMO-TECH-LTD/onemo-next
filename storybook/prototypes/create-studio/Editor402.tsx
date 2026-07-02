import * as React from 'react';

/**
 * Editor402 — a verbatim replica of Figma frame 4084:25997 ("Editor 402 iphone - apple blur glass").
 * Structure from get_design_context; every dimension wired to the EXACT token its Figma layer binds
 * (read from node.boundVariables via the console, not guessed). Raw values are kept raw only where the
 * Figma layer itself emits a raw value (Apple status-bar / Safari furniture, control shadows).
 * Background = Figma's own baked frame image (carries the apple-glass surfaces).
 *
 * Bound-variable map (Figma var → emitted token), verified against tokens.css:
 *   standard/m→--sem-dim-fluid-standard-m · standard/s→…-standard-s · standard/xl→…-standard-xl
 *   nano/xl→…-nano-xl · nano/m→--sem-dim-static-nano-m · nano/xs→--sem-dim-static-nano-xs
 *   full→--sem-radii-full · big/2xl→--sem-dim-fluid-big-2xl · xs→--sem-border-xs · md→--sem-breakpoints-md
 *   TabBar/icon→--com-tabbar-icon · TabBar/surface→--com-tabbar-surface · Controls/icon→--com-controls-icon
 *   fg/quaternary→--sem-col-fg-quaternary · grey/12→--prim-col-grey-12
 *   title/headline/*→--sem-type-fluid-title-headline-* · label/s/*→--sem-type-fluid-label-s-*
 */

const T = {
  standardM: 'var(--sem-dim-fluid-standard-m)',
  standardS: 'var(--sem-dim-fluid-standard-s)',
  standardXl: 'var(--sem-dim-fluid-standard-xl)',
  standardXs: 'var(--sem-dim-fluid-standard-xs)',
  nanoXl: 'var(--sem-dim-fluid-nano-xl)',
  nanoM: 'var(--sem-dim-static-nano-m)',
  nanoXs: 'var(--sem-dim-static-nano-xs)',
  full: 'var(--sem-radii-full)',
  big2xl: 'var(--sem-dim-fluid-big-2xl)',
  borderXs: 'var(--sem-border-xs)',
  md: 'var(--sem-breakpoints-md)',
  tabbarIcon: 'var(--com-tabbar-icon)',
  tabbarSurface: 'var(--com-tabbar-surface)',
  controlsIcon: 'var(--com-controls-icon)',
  fgQuaternary: 'var(--sem-col-fg-quaternary)',
  grey12: 'var(--prim-col-grey-12)',
};
const headline = {
  fontFamily: 'var(--sem-type-fluid-title-headline-font)', fontStyle: 'normal', fontWeight: 500,
  fontSize: 'var(--sem-type-fluid-title-headline-size)', lineHeight: 'var(--sem-type-fluid-title-headline-line-height)',
  letterSpacing: 'var(--sem-type-fluid-title-headline-letter-spacing)',
} as const;
const labelS = {
  fontFamily: 'var(--sem-type-fluid-label-s-font)', fontStyle: 'normal', fontWeight: 500,
  fontSize: 'var(--sem-type-fluid-label-s-size)', lineHeight: 'var(--sem-type-fluid-label-s-line-height)',
  letterSpacing: 'var(--sem-type-fluid-label-s-letter-spacing)',
} as const;
const sf = { fontFamily: '"SF Pro", "SF Pro Text", -apple-system, system-ui, sans-serif' } as const;

const DOCK = [
  { icon: '/screen/dock-add.svg', label: 'Add' },
  { icon: '/screen/dock-shape.svg', label: 'Shape' },
  { icon: '/screen/dock-effect.svg', label: 'Effect' },
  { icon: '/screen/dock-tune.svg', label: 'Tune' },
  { icon: '/screen/dock-edit.svg', label: 'Edit' },
];

/** Top glass round control (Button Group - Leading → BG Fill+Shadow + Trailing-Button, rotated ∓90°). */
function GlassControl({ icon }: { icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: 296, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 1000, background: 'rgba(255,255,255,0.01)',
          boxShadow: '1.25px 0px 0px -0.75px #d0d0d0, -1.25px 0px 0px -0.75px #d0d0d0, 0px 0px 0px 0.5px #e8e8e8, 0px 8px 15px 0px rgba(0,0,0,0.02)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, position: 'relative' }}>
        <div style={{ transform: 'rotate(-90deg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', padding: T.standardXs, position: 'relative', borderRadius: T.full,
            boxShadow: '-1px -1px 1px 0px rgba(255,255,255,0.5), 1px 1px 1px 0px rgba(255,255,255,0.5)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: T.full, backdropFilter: 'blur(0.4px)', WebkitBackdropFilter: 'blur(0.4px)' }} />
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: T.controlsIcon, height: T.controlsIcon, position: 'relative', flexShrink: 0 }}>
              <span style={{ transform: 'rotate(90deg)', width: T.controlsIcon, height: T.controlsIcon, position: 'relative', display: 'block' }}>
                <img src={icon} alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
              </span>
            </span>
            <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
              boxShadow: 'inset 0.8px 0.8px 0.2px 0px white, inset -1px -1px 1px 0px white' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Safari-bar glass pill (History / Address / More) — Blur-mask + Fill gradient + Glass Effect. */
function SafariGlass({ children, grow }: { children: React.ReactNode; grow?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, height: 48, alignItems: 'center', justifyContent: 'center', padding: grow ? '0 14px' : '0 6px', position: 'relative', borderRadius: 296, flexShrink: grow ? undefined : 0, flex: grow ? '1 0 0' : undefined, minWidth: grow ? 1 : undefined }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 296, overflow: 'hidden', pointerEvents: 'none',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        background: 'rgba(247,247,247,0.55)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 4px rgba(0,0,0,0.06)' }} />
      {children}
    </div>
  );
}

export function Editor402() {
  return (
    <div data-fluid="container" data-anat="editor-402" style={{ width: '100%', height: '100%', containerType: 'inline-size', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* baked Figma background (grain + apple-glass surfaces) */}
      <img src="/screen/editor-bg.png" alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100.04%', objectFit: 'cover', pointerEvents: 'none' }} />

      {/* Status bar - iPhone (62) */}
      <div data-anat="status-bar" style={{ display: 'flex', height: 62, alignItems: 'center', justifyContent: 'center', padding: '2.333px 9px 0', flexShrink: 0, width: '100%', position: 'relative' }}>
        <div style={{ flex: '1 0 0', height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 1, paddingRight: 6 }}>
          <p style={{ ...sf, fontWeight: 590, lineHeight: '22px', fontSize: 17, color: '#000', textAlign: 'center', whiteSpace: 'nowrap', margin: 0 }}>9:41</p>
        </div>
        <div style={{ background: '#000', height: 37, borderRadius: 100, flexShrink: 0, width: 125 }} />
        <div style={{ flex: '1 0 0', height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 1, paddingRight: 1 }}>
          <span style={{ height: 13, position: 'relative', flexShrink: 0, width: 85.329 }}>
            <img src="/screen/status-levels.svg" alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
          </span>
        </div>
      </div>

      {/* Top Section — px standard/m · py nano/xl · max-w md */}
      <div data-anat="top-section" style={{ display: 'flex', alignItems: 'flex-start', maxWidth: T.md, paddingLeft: T.standardM, paddingRight: T.standardM, paddingTop: T.nanoXl, paddingBottom: T.nanoXl, flexShrink: 0, width: '100%', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 1 }}>
          <GlassControl icon="/screen/ctrl-close.svg" />
          <p style={{ ...headline, color: T.grey12, textAlign: 'center', whiteSpace: 'nowrap', margin: 0 }}>Effect</p>
          <GlassControl icon="/screen/ctrl-check.svg" />
        </div>
      </div>

      {/* Canvas — flex-1 · max-w md */}
      <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: T.md, minHeight: 1, width: '100%', position: 'relative' }}>
        <div style={{ border: '10px solid #000', borderRadius: 40, boxShadow: '0px 4px 9.7px 2px rgba(0,0,0,0.25)', flexShrink: 0, width: 320, height: 320, position: 'relative', overflow: 'hidden' }}>
          <img src="/screen/product.png" alt="" style={{ position: 'absolute', height: '139.51%', left: '-2.22%', top: '-10.76%', width: '104.44%', maxWidth: 'none' }} />
        </div>
      </div>

      {/* Bottom Section — max-w md */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: T.md, flexShrink: 0, width: '100%', position: 'relative' }}>
        {/* Toolbox — gap standard/xl · py standard/xl */}
        <div data-anat="toolbox" style={{ display: 'flex', flexDirection: 'column', gap: T.standardXl, alignItems: 'center', justifyContent: 'flex-end', paddingTop: T.standardXl, paddingBottom: T.standardXl, flexShrink: 0, width: '100%' }}>
          {/* Tool — 9 Dials (gap standard/xl) */}
          <div style={{ display: 'flex', gap: T.standardXl, alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '100%' }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} data-anat="dial" style={{ border: `${T.nanoXs} solid ${T.fgQuaternary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: T.standardS, borderRadius: T.full, flexShrink: 0 }}>
                <span style={{ position: 'relative', flexShrink: 0, width: T.controlsIcon, height: T.controlsIcon }}>
                  <img src="/screen/dial.svg" alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
                </span>
              </div>
            ))}
          </div>
          {/* Tool — Ruller (320×24) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '100%' }}>
            <div style={{ height: 24, position: 'relative', flexShrink: 0, width: 320 }}>
              <img src="/screen/ruler.svg" alt="" style={{ position: 'absolute', inset: '-4.17% -0.31%', display: 'block', width: '100.62%', height: '108.34%', maxWidth: 'none' }} />
            </div>
          </div>
        </div>

        {/* Dock — pb standard/xl. Tab Bar: h big/2xl, pl standard/m, pr 16, radius full, border xs.
            Surface fill (TabBar/surface) is visible:false in this glass variant → apple-glass comes from the baked bg. */}
        <div data-anat="dock" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: T.standardXl, flexShrink: 0, width: '100%', boxSizing: 'border-box' }}>
          <div data-anat="tab-bar" style={{ display: 'flex', height: T.big2xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingLeft: T.standardM, paddingRight: 16, borderRadius: T.full, border: `${T.borderXs} solid transparent`, flexShrink: 0, width: '100%', boxSizing: 'border-box' }}>
            {DOCK.map((t) => (
              <div key={t.label} data-anat="tab" style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: T.nanoM, height: '100%', alignItems: 'center', justifyContent: 'center', minWidth: 1, position: 'relative' }}>
                <span style={{ position: 'relative', flexShrink: 0, width: T.tabbarIcon, height: T.tabbarIcon }}>
                  <img src={t.icon} alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
                </span>
                <p style={{ ...labelS, minWidth: '100%', textAlign: 'center', color: T.tabbarSurface, margin: 0, wordBreak: 'break-word' }}>{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar - Bottom - Safari (h86 · pb34 pt4 px34 · gap8) */}
      <div style={{ display: 'flex', gap: 8, height: 86, alignItems: 'center', justifyContent: 'center', padding: '4px 34px 34px', flexShrink: 0, width: '100%', boxSizing: 'border-box', position: 'relative' }}>
        <SafariGlass>
          <span style={{ ...sf, fontWeight: 400, fontSize: 17, color: '#404040', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>􀯶</span>
        </SafariGlass>
        <SafariGlass grow>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 1, width: 20, flexShrink: 0 }}>
            <span style={{ height: 18.001, width: 15.399, position: 'relative', flexShrink: 0 }}>
              <img src="/screen/reader.svg" alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
            </span>
          </span>
          <span style={{ ...sf, fontWeight: 590, fontSize: 16, color: '#404040', flex: '1 0 0', minWidth: 1, textAlign: 'center' }}>apple.com</span>
          <span style={{ ...sf, fontWeight: 510, fontSize: 17, color: '#404040', width: 20, textAlign: 'center', flexShrink: 0 }}>􀅈</span>
        </SafariGlass>
        <SafariGlass>
          <span style={{ ...sf, fontWeight: 400, fontSize: 17, color: '#404040', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>􀍠</span>
        </SafariGlass>
      </div>
    </div>
  );
}
