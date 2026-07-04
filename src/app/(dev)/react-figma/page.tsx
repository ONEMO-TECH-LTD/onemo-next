'use client'

/**
 * React × Figma — full Figma editor-chrome clone (left rail + panels + infinite canvas + Design inspector)
 * on the real React build. DEV-ONLY shell; product inherits only the Screen. NO engine wiring yet —
 * the complete Figma UI must be cloned first (Dan). Cloned controls use SVG paths from Figma's live DOM.
 *
 * Inventory replicated 1:1 from Figma's live DOM (file 4084:25997):
 *  · icon rail: File · Agents · Assets · Tools · Variables  (rail switches the left panel)
 *  · left/File: file selector + Drafts · Pages (search/add) · Layers tree (type glyphs · lock · select)
 *  · left/Assets & Variables: expandable side panels
 *  · center: bottom insert island + infinite pan/zoom canvas, device frame floating in a dotted field
 *  · right: Frame preset + Position (CSS position/z-index extension) · Auto layout
 *           · Appearance · Fill · Stroke · Effects · Selection colors · Layout guide
 *  Spec: Inter 11px; headers 550/~0.5px near-black; fields 24px/5px radius; every value field raw-OR-token (◆).
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ListDashes, MagnifyingGlass, Plus, Minus, Sidebar, CaretDown, GearSix, Palette,
  type Icon as PIcon,
} from '@phosphor-icons/react'

const INK = 'rgba(0,0,0,0.9)', MUTE = 'rgba(0,0,0,0.45)', FAINT = 'rgba(0,0,0,0.3)'
const LINE = '#e6e7e9', FIELD = '#f5f5f5', SEL = '#0d99ff', TOKEN = '#7a3fb0', RAIL = '#fff'
const FONT = 'Inter, -apple-system, system-ui, sans-serif'
const hdr = { font: `550 11px/16px ${FONT}`, letterSpacing: '0.4px', color: INK } as const

/* ── icon button ── */
function IB({ I, title, active, on, w = 'regular', s = 16 }: { I: PIcon; title?: string; active?: boolean; on?: () => void; w?: 'thin' | 'light' | 'regular' | 'bold'; s?: number }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" title={title} onClick={on} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 24, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center', flex: 'none', background: active ? '#e5f4ff' : h ? '#f0f1f3' : 'transparent', color: active ? SEL : INK }}>
      <I size={s} weight={w} />
    </button>
  )
}

/* segmented group: Figma uses an 88px group at 240px inspector width; inner 1px seams divide the 3 controls. */
const Seg = ({ children, fill }: { children: React.ReactNode; fill?: boolean }) => <div style={{ display: 'flex', gap: 1, flex: fill ? '1 1 0' : 'none', width: fill ? 'auto' : 88 }}>{children}</div>

/* ── Figma-exact icons — SVG paths copied verbatim from Figma's Design panel DOM.
   Two-tone: tone 1 = content bars rgba(0,0,0,.898); tone 3 = alignment edge-bar rgba(0,0,0,.3). Active → Figma blue. ── */
const FI: Record<string, [number, string][]> = {
  alignLeft: [[1, 'M17.25 10a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75zm-4 5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75z'], [3, 'M6 17.5a.5.5 0 0 1-1 0v-12a.5.5 0 0 1 1 0z']],
  alignCenterH: [[1, 'M17.25 10a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-9.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75zm-2 5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75z'], [3, 'M13 17.5a.5.5 0 0 1-1 0V15h1zm0-4.5v-3h-1v3zm0-7.5V8h-1V5.5a.5.5 0 0 1 1 0']],
  alignRight: [[1, 'M6.75 10A.75.75 0 0 1 6 9.25v-.5A.75.75 0 0 1 6.75 8h8.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-.75.75zm4 5a.75.75 0 0 1-.75-.75v-.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-.75.75z'], [3, 'M18 17.5a.5.5 0 0 0 1 0v-12a.5.5 0 0 0-1 0z']],
  alignTop: [[1, 'M10 17.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-8.5A.75.75 0 0 1 8.75 8h.5a.75.75 0 0 1 .75.75zm5-4a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75z'], [3, 'M17.5 6a.5.5 0 0 0 0-1h-12a.5.5 0 0 0 0 1z']],
  alignCenterV: [[1, 'M10 6.75A.75.75 0 0 0 9.25 6h-.5a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75zm5 2a.75.75 0 0 0-.75-.75h-.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75z'], [3, 'M17.5 11a.5.5 0 0 1 0 1H15v-1zM13 11h-3v1h3zm-7.5 0H8v1H5.5a.5.5 0 0 1 0-1']],
  alignBottom: [[1, 'M10 6.75A.75.75 0 0 0 9.25 6h-.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75zm5 4a.75.75 0 0 0-.75-.75h-.5a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75z'], [3, 'M17.5 18a.5.5 0 0 1 0 1h-12a.5.5 0 0 1 0-1z']],
  more: [[1, 'M9 12.25c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75z'], [3, 'M19 6.5a.5.5 0 0 0-.5-.5h-12a.5.5 0 0 0 0 1h12a.5.5 0 0 0 .5-.5m0 11a.5.5 0 0 0-.5-.5h-12a.5.5 0 0 0 0 1h12a.5.5 0 0 0 .5-.5']],
  rotate: [[1, 'M11.054 9.543a1.5 1.5 0 0 1 2.007.103l3.293 3.293a1.5 1.5 0 0 1 0 2.121l-3.293 3.293a1.5 1.5 0 0 1-2.121 0L7.647 15.06a1.5 1.5 0 0 1 0-2.121l3.293-3.293zm1.3.81a.5.5 0 0 0-.707 0l-3.293 3.293a.5.5 0 0 0 0 .707l3.293 3.293a.5.5 0 0 0 .629.064l.078-.064 3.293-3.293a.5.5 0 0 0 .064-.629l-.064-.078zM9.526 5.767a3.5 3.5 0 0 1 4.949 0L16 7.292V6a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-.5.5H14a.5.5 0 0 1 0-1h1.293l-1.525-1.526a2.5 2.5 0 0 0-3.535 0l-2.38 2.379a.5.5 0 0 1-.706-.707z']],
  flipH: [[1, 'M12.5 6.5a.5.5 0 0 0-1 0v11a.5.5 0 0 0 1 0zM6 9.104a.75.75 0 0 1 1.28-.53L10 11.292a1 1 0 0 1 0 1.414l-2.72 2.72a.75.75 0 0 1-1.28-.53zm1 .603v4.586L9.293 12zm11-.603a.75.75 0 0 0-1.28-.53L14 11.292a1 1 0 0 0 0 1.414l2.72 2.72a.75.75 0 0 0 1.28-.53zm-1 .603v4.586L14.707 12z']],
  flipV: [[1, 'M17.5 12.5a.5.5 0 0 0 0-1h-11a.5.5 0 0 0 0 1zM14.896 18a.75.75 0 0 0 .53-1.28L12.708 14a1 1 0 0 0-1.414 0l-2.72 2.72a.75.75 0 0 0 .53 1.28zm-.603-1H9.707L12 14.707zm.603-11a.75.75 0 0 1 .53 1.28L12.708 10a1 1 0 0 1-1.414 0l-2.72-2.72A.75.75 0 0 1 9.103 6zm-.603 1H9.707L12 9.293z']],
}
function FIcon({ name, active, size = 24 }: { name: keyof typeof FI; active?: boolean; size?: number }) {
  const c1 = active ? SEL : 'rgba(0,0,0,0.898)'
  const c3 = active ? SEL : 'rgba(0,0,0,0.3)'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      {FI[name].map(([tone, d], i) => <path key={i} d={d} fill={tone === 3 ? c3 : c1} fillRule="evenodd" clipRule="evenodd" />)}
    </svg>
  )
}
/* segmented button carrying a Figma-exact icon (align/flip): 31×24 · grey #f5f5f5 · per-position radii */
function FSegBtn({ name, pos, active, title, fill }: { name: keyof typeof FI; pos: 'l' | 'm' | 'r'; active?: boolean; title?: string; fill?: boolean }) {
  const [h, setH] = useState(false)
  const radius = pos === 'l' ? '5px 0 0 5px' : pos === 'r' ? '0 5px 5px 0' : '0'
  return (
    <button type="button" title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: fill ? 'auto' : 31, height: 24, borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: fill ? '1 1 0' : 'none', background: h ? '#ededed' : FIELD }}>
      <FIcon name={name} active={active} />
    </button>
  )
}
/* bare 24×24 icon button carrying a Figma-exact icon (e.g. More actions) */
function FIB({ name, title }: { name: keyof typeof FI; title?: string }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 24, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center', flex: 'none', background: h ? '#f0f1f3' : 'transparent' }}>
      <FIcon name={name} />
    </button>
  )
}

const UI_ICON = {
  present: { viewBox: '0 0 24 24', paths: ['M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z'] },
  railFile: { viewBox: '0 0 24 24', paths: ['M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z'] },
  railAgents: { viewBox: '0 0 24 24', paths: ['M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z'] },
  railAssets: { viewBox: '0 0 24 24', paths: ['M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z'] },
  railTools: { viewBox: '0 0 24 24', paths: ['M13.5 5A1.5 1.5 0 0 1 15 6.5V7h1.086a1.5 1.5 0 0 1 1.06.44l1.414 1.414a1.5 1.5 0 0 1 .44 1.06V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16.5V9.914c0-.398.158-.78.44-1.06l1.413-1.415A1.5 1.5 0 0 1 7.913 7H9v-.5A1.5 1.5 0 0 1 10.5 5zM6 16.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V13h-3v1a.5.5 0 0 1-1 0v-1h-4v1a.5.5 0 0 1-1 0v-1H6zM7.914 8a.5.5 0 0 0-.354.146L6.146 9.561A.5.5 0 0 0 6 9.914V12h3v-1a.5.5 0 0 1 1 0v1h4v-1a.5.5 0 0 1 1 0v1h3V9.914a.5.5 0 0 0-.147-.353L16.44 8.146A.5.5 0 0 0 16.086 8zM10.5 6a.5.5 0 0 0-.5.5V7h4v-.5a.5.5 0 0 0-.5-.5z'] },
  railVariables: { viewBox: '0 0 24 24', paths: ['M11.117 5.586A2 2 0 0 1 13 5.649l4 2.31.113.07A2 2 0 0 1 18 9.69v4.62a2 2 0 0 1-.887 1.66l-.113.072-4 2.309a2 2 0 0 1-1.883.063L11 18.351l-4-2.309a2 2 0 0 1-1-1.732V9.69a2 2 0 0 1 1-1.73l4-2.31zm1.383.93a1 1 0 0 0-1 0l-4 2.308-.11.074A1 1 0 0 0 7 9.69v4.62l.009.132c.04.305.22.578.491.734l4 2.31c.27.155.597.175.88.058l.12-.059 4-2.31a1 1 0 0 0 .491-.733L17 14.31V9.69a1 1 0 0 0-.39-.792l-.11-.074zM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2'] },
  insertPointer: { viewBox: '0 0 24 24', paths: ['M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z'] },
  insertFrame: { viewBox: '0 0 24 24', paths: ['M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z'] },
  insertText: { viewBox: '0 0 24 24', paths: ['M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z'] },
  insertComment: { viewBox: '0 0 24 24', paths: ['M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15'] },
  insertActions: { viewBox: '0 0 24 24', paths: ['M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5'] },
  modeDraw: { viewBox: '0 0 24 24', paths: ['M13.407 5.06c.61-.123 1.227-.079 1.657.343l.135.15c.277.361.316.79.208 1.204-.115.44-.397.887-.734 1.314-.68.86-1.74 1.829-2.748 2.76-1.031.952-2.01 1.867-2.606 2.662-.3.4-.466.724-.517.97-.044.21-.003.34.12.46l.065.052c.072.044.167.062.313.039.217-.034.505-.155.866-.378.72-.445 1.561-1.183 2.445-1.966.862-.763 1.768-1.571 2.57-2.076.4-.252.817-.457 1.221-.527.427-.074.87.002 1.223.346l.102.112c.22.271.296.593.266.918-.032.344-.183.684-.364.993-.363.617-.963 1.296-1.515 1.922-.574.651-1.1 1.251-1.403 1.767-.151.257-.218.449-.23.581-.01.106.012.163.072.22l.054.04c.074.038.214.062.474-.031.356-.128.853-.456 1.465-1.1a.5.5 0 0 1 .725.687c-.666.702-1.291 1.153-1.853 1.354-.535.192-1.08.173-1.485-.163l-.08-.071a1.23 1.23 0 0 1-.369-1.03c.033-.344.183-.684.364-.993.363-.617.964-1.297 1.516-1.923.574-.651 1.1-1.25 1.402-1.766.152-.258.22-.449.232-.581.007-.08-.004-.132-.035-.177l-.038-.045c-.07-.068-.162-.108-.353-.075-.213.037-.5.161-.858.388-.717.451-1.555 1.194-2.44 1.978-.862.764-1.774 1.57-2.584 2.07-.404.249-.826.45-1.237.514-.38.06-.767 0-1.095-.247l-.136-.118c-.402-.394-.502-.887-.399-1.38.097-.46.367-.923.696-1.363.663-.885 1.718-1.865 2.728-2.798 1.033-.954 2.023-1.862 2.642-2.645.31-.393.489-.71.55-.946.04-.152.028-.246-.017-.32l-.057-.069c-.082-.08-.284-.172-.76-.076-.468.094-1.091.352-1.863.803-1.537.898-3.552 2.496-5.893 4.786a.5.5 0 0 1-.699-.715c2.37-2.319 4.45-3.98 6.087-4.935.815-.476 1.55-.794 2.17-.92'] },
  modeDesign: { viewBox: '0 0 24 24', paths: ['M12.11 13.956c-.44-1.121.618-2.23 1.738-1.885l.108.038 4.15 1.63.115.051c1.136.556 1.027 2.254-.218 2.637l-1.205.372-.37 1.205c-.397 1.29-2.196 1.356-2.689.102zm1.48-.916a.425.425 0 0 0-.55.55l1.63 4.15c.138.35.618.356.775.038l.027-.068.526-1.711 1.711-.527a.425.425 0 0 0 .031-.802zM16.5 6A1.5 1.5 0 0 1 18 7.5v1a1.5 1.5 0 0 1-1.5 1.5H10v6.5A1.5 1.5 0 0 1 8.5 18h-1A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zM7 16.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V15h-.5a.5.5 0 0 1 0-1H9v-1h-.5a.5.5 0 0 1 0-1H9v-2H7zM7.5 7a.5.5 0 0 0-.5.5V9h2V7zM10 9h2v-.5a.5.5 0 0 1 1 0V9h1v-.5a.5.5 0 0 1 1 0V9h1.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H10z'] },
  modeMotion: { viewBox: '0 0 24 24', paths: ['M10.94 5.44a1.5 1.5 0 0 1 2.12 0l5.502 5.5a1.5 1.5 0 0 1 0 2.121l-5.501 5.502a1.5 1.5 0 0 1-2.121 0l-5.502-5.502a1.5 1.5 0 0 1 0-2.121zm1.414.706a.5.5 0 0 0-.707 0l-5.501 5.501a.5.5 0 0 0 0 .707l5.5 5.502a.5.5 0 0 0 .707 0l5.502-5.502a.5.5 0 0 0 0-.707zm-1.207 2.001a.5.5 0 0 1 .707 0l3.5 3.5a.5.5 0 0 1 0 .707l-3.5 3.5a.5.5 0 1 1-.707-.707l3.146-3.146-3.146-3.147a.5.5 0 0 1 0-.707m-2 2a.5.5 0 0 1 .707 0l1.5 1.5a.5.5 0 0 1 0 .707l-1.5 1.5a.5.5 0 1 1-.707-.707l1.146-1.146-1.146-1.147a.5.5 0 0 1 0-.707'] },
  modeDev: { viewBox: '0 0 24 24', paths: ['M13.631 6.018a.5.5 0 0 1 .367.513l-.016.1-3 11-.036.095a.5.5 0 0 1-.93-.358l3-11 .037-.095a.5.5 0 0 1 .578-.255M8.224 8.582a.501.501 0 0 1 .693.693l-.064.079L6.206 12l2.647 2.646a.5.5 0 1 1-.707.707l-3-3a.5.5 0 0 1 0-.707l3-3zm6.922.064a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1 0 .707l-3 3-.078.065a.5.5 0 0 1-.694-.693l.065-.079L17.792 12l-2.646-2.646a.5.5 0 0 1 0-.707'] },
  minimizeUI: { viewBox: '0 0 24 24', paths: ['M17.653 7.008A1.5 1.5 0 0 1 19 8.5v7a1.5 1.5 0 0 1-1.347 1.492L17.5 17h-11a1.5 1.5 0 0 1-1.492-1.347L5 15.5v-7A1.5 1.5 0 0 1 6.5 7h11zM6.5 8a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5H9V8zm3.5 8h7.5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H10z'] },
  find: { viewBox: '0 0 24 24', paths: ['M11.5 6a5.5 5.5 0 0 1 4.226 9.019l2.127 2.127a.5.5 0 1 1-.707.707l-2.127-2.127A5.5 5.5 0 1 1 11.5 6m0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9'] },
  collapseLayers: { viewBox: '0 0 24 24', paths: ['M6.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM6 13.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm6.646.146 2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L15.5 15.207l-1.646 1.647a.5.5 0 0 1-.708-.708m2.708-6.292a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L15.5 8.793l1.646-1.647a.5.5 0 0 1 .708.708z'] },
  caretRight16: { viewBox: '0 0 16 16', paths: ['M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707'] },
  layerFrame: { viewBox: '0 0 16 16', paths: ['M9 4h2.5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5V7h4.5a.5.5 0 0 0 .5-.5zM8 4H4.5a.5.5 0 0 0-.5.5V6h4zm-5 .5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 11.5z'] },
  layerImage: { viewBox: '0 0 16 16', paths: ['M11.5 3A1.5 1.5 0 0 1 13 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-7l-.153-.008A1.5 1.5 0 0 1 3 11.5v-7A1.5 1.5 0 0 1 4.5 3zm-7 1a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5zm1.725 3.082a.5.5 0 0 1 .629.064l3 3a.5.5 0 1 1-.708.707L6.5 8.208l-.646.647a.5.5 0 1 1-.708-.708l1-1zM9.5 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2'] },
  layerAuto: { viewBox: '0 0 16 16', paths: ['M4 4v2h8V4zm0-1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm2 7v2h4v-2zm0-1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z'] },
  layerSection: { viewBox: '0 0 16 16', paths: ['M4 4h2v8H4zM3 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm7 0h2v4h-2zM9 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z'] },
  layerToolbar: { viewBox: '0 0 16 16', paths: ['M4 4h2v8H4zM3 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm7 2h2v4h-2zM9 6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z'] },
  layerComponent: { viewBox: '0 0 16 16', paths: ['M7.293 2.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414zM3.707 8.707 3 8l.707-.707 3.586-3.586L8 3l.707.707 3.586 3.586L13 8l-.707.707-3.586 3.586L8 13l-.707-.707z'] },
  layerLock: { viewBox: '0 0 16 16', paths: ['M10.776 8H5.224l-.025.005A.25.25 0 0 0 5 8.25v3.5c0 .138.112.25.25.25h5.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.199-.245zM7 7H6V6a2 2 0 1 1 4 0v1zM5 6a3 3 0 0 1 6 0v1.025c.57.116 1 .62 1 1.225v3.5c0 .69-.56 1.25-1.25 1.25h-5.5C4.56 13 4 12.44 4 11.75v-3.5c0-.605.43-1.11 1-1.225z'] },
  caret16: { viewBox: '0 0 16 16', paths: ['M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z'] },
  caret24: { viewBox: '0 0 24 24', paths: ['M9.646 11.146a.5.5 0 0 1 .708 0L12 12.793l1.646-1.647a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 0-.708'] },
  devCode: { viewBox: '0 0 24 24', paths: ['M13.631 6.018a.5.5 0 0 1 .35.614l-3 10.999a.5.5 0 0 1-.964-.263l3-11a.5.5 0 0 1 .614-.35M8.146 8.646a.5.5 0 0 1 .707.708L6.207 12l2.646 2.646a.5.5 0 0 1-.707.707l-3-3a.5.5 0 0 1 0-.707zm7 0a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1 0 .707l-3 3a.5.5 0 0 1-.707-.707L17.792 12l-2.646-2.646a.5.5 0 0 1 0-.708'] },
  createComponent: { viewBox: '0 0 24 24', paths: ['M11.116 13.592a1.25 1.25 0 0 1 1.768 0l1.637 1.637a1.25 1.25 0 0 1 0 1.768l-1.637 1.638-.095.085a1.25 1.25 0 0 1-1.578 0l-.095-.085-1.638-1.64a1.25 1.25 0 0 1-.085-1.672l.085-.095zm1.06.707a.25.25 0 0 0-.353 0l-1.638 1.636a.25.25 0 0 0 0 .354l1.638 1.639a.25.25 0 0 0 .354 0l1.637-1.638a.25.25 0 0 0 0-.354zm3.053-4.82a1.25 1.25 0 0 1 1.767 0l1.639 1.637a1.25 1.25 0 0 1 0 1.768l-1.639 1.638-.095.086a1.25 1.25 0 0 1-1.578 0l-.095-.086-1.637-1.637a1.25 1.25 0 0 1-.086-1.673l.086-.095zm-8.226 0a1.25 1.25 0 0 1 1.767 0l1.64 1.638a1.25 1.25 0 0 1 0 1.768L8.77 14.52a1.25 1.25 0 0 1-1.672.086l-.095-.086-1.638-1.637a1.25 1.25 0 0 1-.086-1.673l.086-.095zm9.286.706a.25.25 0 0 0-.354 0l-1.637 1.64a.25.25 0 0 0 0 .353l1.637 1.637a.25.25 0 0 0 .354 0l1.639-1.638a.25.25 0 0 0 0-.354zm-8.226 0a.25.25 0 0 0-.353 0l-1.637 1.638a.25.25 0 0 0 0 .354l1.638 1.637a.25.25 0 0 0 .353 0l1.638-1.636a.25.25 0 0 0 0-.354zm3.053-4.819a1.25 1.25 0 0 1 1.768 0l1.637 1.638a1.25 1.25 0 0 1 0 1.767l-1.637 1.639-.095.085a1.25 1.25 0 0 1-1.578 0l-.095-.085-1.639-1.639a1.25 1.25 0 0 1-.085-1.673l.085-.094zm1.06.707a.25.25 0 0 0-.353 0l-1.639 1.638a.25.25 0 0 0 0 .353l1.64 1.639a.25.25 0 0 0 .353 0l1.637-1.639a.25.25 0 0 0 0-.353z'] },
  overflowDots: { viewBox: '0 0 24 24', paths: ['M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3'] },
  rotationField: { viewBox: '0 0 24 24', paths: ['M9 8.5a.5.5 0 0 0-1 0v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1H13a4 4 0 0 0-4-4zM9 12v3h3a3 3 0 0 0-3-3'] },
  absolutePosition: { viewBox: '0 0 24 24', paths: ['M6 7a1 1 0 0 1 1-1h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0zm12 0a1 1 0 0 0-1-1h-2.5a.5.5 0 0 0 0 1H17v2.5a.5.5 0 0 0 1 0zM7 18a1 1 0 0 1-1-1v-2.5a.5.5 0 0 1 1 0V17h2.5a.5.5 0 0 1 0 1zm11-1a1 1 0 0 1-1 1h-2.5a.5.5 0 0 1 0-1H17v-2.5a.5.5 0 0 1 1 0zm-8-7h4v4h-4zm-1 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z'] },
  variable: { viewBox: '0 0 12 12', paths: ['m2 3.693 4-2.31 4 2.31v4.619l-4 2.31-4-2.31zM6 .23l5 2.887V8.89l-5 2.887L1 8.89V3.116zM7 6c0 .553-.448 1-1 1-.552 0-1-.447-1-1 0-.552.448-1 1-1 .552 0 1 .448 1 1'] },
  autoLayoutToggle: { viewBox: '0 0 24 24', paths: ['M9.5 7h-2a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5m-2-1A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18h2a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 9.5 6zm9 1h-2a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5m-2-1A1.5 1.5 0 0 0 13 7.5v2a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 18 9.5v-2A1.5 1.5 0 0 0 16.5 6zm3.384 8.32a.5.5 0 0 0-.768-.64l-2.15 2.58-1.112-1.114a.5.5 0 0 0-.708.708l1.5 1.5a.5.5 0 0 0 .738-.034z'] },
  autoLayoutFreeform: { viewBox: '0 0 24 24', paths: ['M11.653 13.008A1.5 1.5 0 0 1 13 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L11.5 18h-2l-.153-.008a1.5 1.5 0 0 1-1.34-1.339L8 16.5v-2a1.5 1.5 0 0 1 1.347-1.492L9.5 13h2zM9.5 14a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7.153-5.992A1.5 1.5 0 0 1 18 9.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 13h-2l-.153-.008a1.5 1.5 0 0 1-1.34-1.339L13 11.5v-2a1.5 1.5 0 0 1 1.347-1.492L14.5 8h2zM14.5 9a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM9.653 6.008A1.5 1.5 0 0 1 11 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 11h-2l-.153-.008a1.5 1.5 0 0 1-1.34-1.339L6 9.5v-2a1.5 1.5 0 0 1 1.347-1.492L7.5 6h2zM7.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z'] },
  autoLayoutVertical: { viewBox: '0 0 24 24', paths: ['M9.654 13.008A1.5 1.5 0 0 1 11 14.5v2l-.008.153a1.5 1.5 0 0 1-1.338 1.34L9.5 18h-2l-.153-.008a1.5 1.5 0 0 1-1.339-1.339L6 16.5v-2a1.5 1.5 0 0 1 1.347-1.492L7.5 13h2zM15.5 6a.5.5 0 0 1 .49.4l.01.1v9.794l1.146-1.146a.501.501 0 0 1 .708.707l-2 2a.5.5 0 0 1-.707 0l-2-2a.5.5 0 0 1 .707-.707L15 16.294V6.5l.01-.1a.5.5 0 0 1 .49-.4m-8 8a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm2.154-7.992A1.5 1.5 0 0 1 11 7.5v2l-.008.153a1.5 1.5 0 0 1-1.338 1.34L9.5 11h-2l-.153-.008a1.5 1.5 0 0 1-1.339-1.339L6 9.5v-2a1.5 1.5 0 0 1 1.347-1.492L7.5 6h2zM7.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z'] },
  autoLayoutHorizontal: { viewBox: '0 0 24 24', paths: ['M15.147 13.147a.5.5 0 0 1 .707 0l2 2a.5.5 0 0 1 0 .707l-2 2a.5.5 0 0 1-.707-.707L16.293 16H6.5l-.101-.01a.5.5 0 0 1 0-.98L6.5 15h9.793l-1.146-1.146a.5.5 0 0 1 0-.707m-5.493-7.14A1.5 1.5 0 0 1 11 7.5v2l-.007.153a1.5 1.5 0 0 1-1.34 1.34L9.5 11h-2l-.153-.008a1.5 1.5 0 0 1-1.339-1.339L6 9.5v-2a1.5 1.5 0 0 1 1.347-1.492L7.5 6h2zm7 0A1.5 1.5 0 0 1 18 7.5v2l-.007.153a1.5 1.5 0 0 1-1.34 1.34L16.5 11h-2l-.153-.008a1.5 1.5 0 0 1-1.339-1.339L13 9.5v-2a1.5 1.5 0 0 1 1.347-1.492L14.5 6h2zM14.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm-7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z'] },
  autoLayoutGrid: { viewBox: '0 0 24 24', paths: ['M9.653 13.008A1.5 1.5 0 0 1 11 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L6 16.5v-2A1.5 1.5 0 0 1 7.5 13h2zm7 0A1.5 1.5 0 0 1 18 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L13 16.5v-2a1.5 1.5 0 0 1 1.5-1.5h2zM7.5 14a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM9.653 6.008A1.5 1.5 0 0 1 11 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L6 9.5v-2A1.5 1.5 0 0 1 7.5 6h2zm7 0A1.5 1.5 0 0 1 18 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L13 9.5v-2A1.5 1.5 0 0 1 14.5 6h2zM7.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z'] },
  autoLayoutWrap: { viewBox: '0 0 16 16', paths: ['M8 3h2c1.933 0 3.5 1.567 3.5 3.5 0 1.933-1.567 3.5-3.5 3.5H4.707l2.147 2.146-.708.708-3-3-.353-.354.353-.354 3-3 .708.708L4.707 9H10c1.38 0 2.5-1.12 2.5-2.5C12.5 5.12 11.38 4 10 4H8z'] },
  resizeW: { viewBox: '0 0 24 24', paths: ['M5.5 18a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 1 0v11a.5.5 0 0 1-.5.5m13 0a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 1 0v11a.5.5 0 0 1-.5.5M7.604 8l1.882 8h1.03L12 10.062 13.485 16h1.029l1.882-8h-1.027l-1.384 5.88L12.515 8h-1.03l-1.47 5.88L8.63 8z'] },
  lockAspect: { viewBox: '0 0 24 24', paths: ['M7.5 7h9a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5M6 7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5zM9.5 9a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0V10h1.5a.5.5 0 0 0 0-1zm5.5 3.5a.5.5 0 0 0-1 0V14h-1.5a.5.5 0 0 0 0 1h2a.5.5 0 0 0 .5-.5z'] },
  gapVertical: { viewBox: '0 0 24 24', paths: ['M15.5 15a1.5 1.5 0 0 1 1.5 1.5.5.5 0 0 1-.99.1l-.02-.2a.5.5 0 0 0-.49-.4h-7a.5.5 0 0 0-.49.4l-.02.2a.5.5 0 0 1-.99-.1A1.5 1.5 0 0 1 8.5 15zM12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2m4.5-4a.5.5 0 0 1 .5.5A1.5 1.5 0 0 1 15.5 9h-7A1.5 1.5 0 0 1 7 7.5a.5.5 0 0 1 .99-.1l.02.2a.5.5 0 0 0 .49.4h7a.5.5 0 0 0 .49-.4l.02-.2a.5.5 0 0 1 .49-.4'] },
  autoLayoutSettings: { viewBox: '0 0 24 24', paths: ['M8.5 18a.5.5 0 0 0 .5-.5v-1.55a2.5 2.5 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v4.55a2.501 2.501 0 0 0 0 4.9v1.55a.5.5 0 0 0 .5.5m7 0a.5.5 0 0 0 .5-.5v-4.55a2.501 2.501 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v1.55a2.5 2.5 0 0 0 0 4.9v4.55a.5.5 0 0 0 .5.5m0-6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-7 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3'] },
  paddingHorizontal: { viewBox: '0 0 24 24', paths: ['M16.5 6A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zm-9 1a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5zm2 2a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5a.5.5 0 0 1 .5-.5m5 0a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5a.5.5 0 0 1 .5-.5'] },
  paddingVertical: { viewBox: '0 0 24 24', paths: ['M6 7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5zm1 9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm2-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5'] },
  paddingIndividual: { viewBox: '0 0 24 24', paths: ['M6 7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5zm1 9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm8-6.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0zm-5.5 5.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5m0-7A.5.5 0 0 1 10 8h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5M8 10a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0z'] },
  visibility: { viewBox: '0 0 24 24', paths: ['M6 12c0-.066.054-.358.313-.825a5.9 5.9 0 0 1 1.12-1.414C8.443 8.816 9.956 8 12 8s3.558.816 4.566 1.76c.508.477.88.98 1.121 1.415.258.467.313.76.313.825 0 .066-.055.358-.313.825-.24.435-.613.938-1.12 1.414C15.557 15.184 14.044 16 12 16s-3.558-.816-4.566-1.76a5.9 5.9 0 0 1-1.121-1.415C6.055 12.358 6 12.065 6 12m-1 0c0-1.25 2.333-5 7-5s7 3.75 7 5-2.333 5-7 5-7-3.75-7-5m8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m1 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0'] },
  blendMode: { viewBox: '0 0 24 24', paths: ['M11.353 5.623a.91.91 0 0 1 1.295 0C14 6.978 17 10.29 17 13.001c0 3.5-2.5 5-5 5s-5-1.5-5-5c0-2.711 3-6.023 4.352-7.378m.647.77c-.658.663-1.663 1.75-2.507 2.977C8.597 10.673 8 11.965 8 13.001c0 1.49.522 2.453 1.218 3.057.72.623 1.72.943 2.782.943s2.063-.32 2.782-.943C15.478 15.454 16 14.492 16 13c0-1.036-.597-2.328-1.493-3.63-.844-1.227-1.85-2.315-2.507-2.978'] },
  opacity: { viewBox: '0 0 24 24', paths: ['M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm9 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1M13.5 11a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-2 2a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-2 2a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m1.5.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m2-2a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m.5 1.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m2-4a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-.5 2.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m.5 1.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0'] },
  cornerRadius: { viewBox: '0 0 24 24', paths: ['M6.5 14a.5.5 0 0 1 .5.5v.6c0 .428 0 .72.019.945.017.219.05.331.09.41.096.187.249.34.437.436.078.04.19.073.41.09.224.019.516.019.944.019h.6a.5.5 0 0 1 0 1h-.621c-.402 0-.734 0-1.005-.023-.281-.022-.54-.071-.782-.195a2 2 0 0 1-.874-.874c-.124-.242-.173-.501-.196-.782A13 13 0 0 1 6 15.121V14.5a.5.5 0 0 1 .5-.5m11 0a.5.5 0 0 1 .5.5v.621c0 .402 0 .734-.023 1.005-.022.281-.071.54-.195.782a2 2 0 0 1-.874.874c-.242.124-.501.173-.782.195-.27.023-.603.023-1.005.023H14.5a.5.5 0 0 1 0-1h.6c.428 0 .72 0 .945-.019.219-.018.331-.05.41-.09a1 1 0 0 0 .436-.437c.04-.078.073-.19.09-.41.019-.224.019-.516.019-.944v-.6a.5.5 0 0 1 .5-.5m-8-8a.5.5 0 0 1 0 1h-.6c-.428 0-.719 0-.944.019-.22.017-.332.05-.41.09a1 1 0 0 0-.437.437c-.04.078-.073.19-.09.41C7 8.18 7 8.471 7 8.9v.6a.5.5 0 0 1-1 0v-.621c0-.402 0-.734.022-1.005.023-.281.072-.54.196-.782a2 2 0 0 1 .874-.874c.242-.124.501-.173.782-.196C8.144 6 8.477 6 8.88 6zm5.621 0c.402 0 .734 0 1.005.022.281.023.54.072.782.196a2 2 0 0 1 .874.874c.124.242.173.501.195.782.023.27.023.603.023 1.005V9.5a.5.5 0 0 1-1 0v-.6c0-.428 0-.72-.019-.945-.018-.219-.05-.33-.09-.41a1 1 0 0 0-.437-.436c-.078-.04-.19-.073-.41-.09A13 13 0 0 0 15.1 7h-.6a.5.5 0 0 1 0-1z'] },
  styleDots: { viewBox: '0 0 24 24', paths: ['M8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m0 1a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m7-1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m0 1a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5M14 15.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0m-1 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0M8.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m0 1a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5'] },
  plus: { viewBox: '0 0 24 24', paths: ['M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6'] },
  minus: { viewBox: '0 0 24 24', paths: ['M6 12a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 6 12'] },
  strokeWeight: { viewBox: '0 0 24 24', paths: ['M6 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5M7 10v1h10v-1zm-.25-1a.75.75 0 0 0-.75.75v1.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75zM7 17v-2h10v2zm-1-2.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75z'] },
  individualStroke: { viewBox: '0 0 24 24', paths: ['M6 7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm3 2v6h6V9zM7.5 7H7v10h10V7zM8 9V8h8v8H8z'] },
  dropShadow: { viewBox: '0 0 24 24', paths: ['M16.204 6.01A2 2 0 0 1 18 8v8l-.01.204a2 2 0 0 1-1.786 1.785L16 18H8l-.204-.01a2 2 0 0 1-1.785-1.786L6 16V8a2 2 0 0 1 1.796-1.99L8 6h8zM8 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z', 'M18 19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2z'] },
  layoutGrid: { viewBox: '0 0 24 24', paths: ['M8 6.5a.5.5 0 0 0-1 0V7h-.5a.5.5 0 0 0 0 1H7v3.5h-.5a.5.5 0 0 0 0 1H7V16h-.5a.5.5 0 0 0 0 1H7v.5a.5.5 0 0 0 1 0V17h3.5v.5a.5.5 0 0 0 1 0V17H16v.5a.5.5 0 0 0 1 0V17h.5a.5.5 0 0 0 0-1H17v-3.5h.5a.5.5 0 0 0 0-1H17V8h.5a.5.5 0 0 0 0-1H17v-.5a.5.5 0 0 0-1 0V7h-3.5v-.5a.5.5 0 0 0-1 0V7H8zm8 9.5v-3.5h-3.5V16zm-4.5 0v-3.5H8V16zM8 11.5V8h3.5v3.5zm4.5 0V8H16v3.5z'] },
} as const
function UiIcon({ name, size = 24 }: { name: keyof typeof UI_ICON; size?: number }) {
  const icon = UI_ICON[name]
  return (
    <svg width={size} height={size} viewBox={icon.viewBox} fill="none" style={{ display: 'block', flex: 'none' }}>
      {icon.paths.map((d, i) => <path key={i} d={d} fill="currentColor" fillOpacity={name === 'dropShadow' && i === 1 ? 0.3 : 1} fillRule="evenodd" clipRule="evenodd" />)}
    </svg>
  )
}
function UiIB({ name, title, active, size = 24 }: { name: keyof typeof UI_ICON; title?: string; active?: boolean; size?: number }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 24, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center', flex: 'none', background: active ? '#e5f4ff' : h ? '#f0f1f3' : 'transparent', color: INK }}>
      <UiIcon name={name} size={size} />
    </button>
  )
}

function InspectorField({ label, icon, value, bound, input, dimValue }: { label?: string; icon?: keyof typeof UI_ICON; value: string; bound?: boolean; input?: boolean; dimValue?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ minWidth: 0, height: 24, borderRadius: 5, background: h ? '#ededed' : input ? '#fff' : FIELD, border: `1px solid ${input ? '#e6e6e6' : 'transparent'}`, display: 'flex', alignItems: 'center', overflow: 'hidden', font: `450 11px/16px ${FONT}`, color: INK }}>
      <span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', flex: 'none', color: input ? INK : 'rgba(0,0,0,0.5)', font: `400 11px/24px ${FONT}` }}>{icon ? <UiIcon name={icon} /> : label}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: bound ? TOKEN : dimValue ? MUTE : INK }}>{value}</span>
      <span title="Apply variable" style={{ width: 16, height: 24, display: 'grid', placeItems: 'center', flex: 'none', color: bound ? TOKEN : FAINT, opacity: bound ? 1 : h ? 0.75 : 0 }}><UiIcon name="variable" size={12} /></span>
    </div>
  )
}
function PositionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height: 48, width: '100%' }}>
      <span style={{ position: 'absolute', left: 16, top: 3.5, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>{label}</span>
      <div style={{ position: 'absolute', left: 16, right: 8, top: 20, display: 'grid', gridTemplateColumns: '88px 88px 24px', gap: 8, alignItems: 'center' }}>{children}</div>
    </div>
  )
}
function InspectorRow({ label, height = 48, top = 20, children }: { label: string; height?: number; top?: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <span style={{ position: 'absolute', left: 16, top: 3.5, width: 88, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>{label}</span>
      <div style={{ position: 'absolute', left: 16, right: 8, top, display: 'grid', gridTemplateColumns: '88px 88px 24px', gap: 8, alignItems: 'start' }}>{children}</div>
    </div>
  )
}
function AutoFlowGroup() {
  const icons: [keyof typeof UI_ICON, string, boolean][] = [
    ['autoLayoutFreeform', 'Freeform', false],
    ['autoLayoutVertical', 'Vertical', true],
    ['autoLayoutHorizontal', 'Horizontal', false],
    ['autoLayoutGrid', 'Grid', false],
  ]
  return (
    <div style={{ width: 184, height: 24, borderRadius: 5, background: FIELD, display: 'flex', overflow: 'hidden' }}>
      {icons.map(([name, title, active]) => (
        <button key={name} type="button" title={title}
          style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 46, height: 24, borderRadius: active ? 5 : 0, display: 'grid', placeItems: 'center', background: active ? '#fff' : 'transparent', color: INK }}>
          <UiIcon name={name} />
        </button>
      ))}
    </div>
  )
}
function AutoValueField({ icon, label, value, mode, caret = true }: { icon?: keyof typeof UI_ICON; label?: string; value: string; mode?: string; caret?: boolean }) {
  return (
    <div style={{ height: 24, width: 88, borderRadius: 5, background: FIELD, display: 'flex', alignItems: 'center', overflow: 'hidden', font: `450 11px/16px ${FONT}`, color: INK }}>
      <span style={{ width: 24, height: 24, flex: 'none', display: 'grid', placeItems: 'center', color: 'rgba(0,0,0,0.5)', font: `450 11px/24px ${FONT}` }}>{icon ? <UiIcon name={icon} /> : label}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      {mode ? <span style={{ flex: 'none', marginRight: 7, color: INK }}>{mode}</span> : caret && <span style={{ width: 24, height: 24, flex: 'none', display: 'grid', placeItems: 'center', color: FAINT }}><UiIcon name="caret24" /></span>}
    </div>
  )
}
function TextSegGroup({ items, active = 0, width = 184 }: { items: string[]; active?: number; width?: number }) {
  return (
    <div style={{ width, height: 24, borderRadius: 5, background: FIELD, display: 'flex', overflow: 'hidden' }}>
      {items.map((item, i) => (
        <button key={item} type="button" title={item}
          style={{ appearance: 'none', border: 0, cursor: 'pointer', flex: '1 1 0', minWidth: 0, height: 24, borderRadius: i === active ? 5 : 0, display: 'grid', placeItems: 'center', background: i === active ? '#fff' : 'transparent', color: i === active ? INK : MUTE, font: `${i === active ? 550 : 450} 10px/14px ${FONT}`, padding: '0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item}
        </button>
      ))}
    </div>
  )
}
function CompactInspectorRow({ label, children, height = 48 }: { label: string; children: React.ReactNode; height?: number }) {
  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <span style={{ position: 'absolute', left: 16, top: 3.5, width: 180, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>{label}</span>
      <div style={{ position: 'absolute', left: 16, right: 8, top: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>{children}</div>
    </div>
  )
}
function Sec({ title, action, children, caret, bodyGap = 8, bodyPadding = '0 8px 0 16px', actionWidth = 24 }: { title: string; action?: React.ReactNode; children?: React.ReactNode; first?: boolean; caret?: boolean; bodyGap?: number; bodyPadding?: React.CSSProperties['padding']; actionWidth?: number }) {
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, padding: '0 0 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `1fr ${actionWidth}px`, alignItems: 'center', gap: 8, height: 40, padding: '0 8px 0 16px' }}>
        <span style={hdr}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, color: MUTE }}>{action}{caret && <CaretDown size={11} color={MUTE} />}</div>
      </div>
      {children && <div style={{ display: 'flex', flexDirection: 'column', gap: bodyGap, padding: bodyPadding }}>{children}</div>}
    </div>
  )
}
function AlignGrid({ sel = 1 }: { sel?: number }) {
  return (
    <div style={{ flex: 'none', width: 88, height: 56, background: FIELD, borderRadius: 5, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '5px 1px' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <span style={{ width: i === sel ? 9 : 3, height: 2, borderRadius: 2, background: i === sel ? SEL : FAINT }} />
        </div>
      ))}
    </div>
  )
}

/* ── ⚠️ MOCK CONTENT (layers · pages · variable collections/values) ──
   These lists are DATA, not UI — placeholders only. Wired live from the build next:
   layers ← the Screen's data-anat DOM (readWired) · pages ← app screens · variables ← the DS token graph. */
/* layers tree — MOCK */
type LayerIcon = 'frame' | 'image' | 'auto' | 'section' | 'toolbar' | 'component'
type Node = { name: string; icon: LayerIcon; depth: number; kids?: boolean; open?: boolean; locked?: boolean; visible?: boolean; sel?: boolean; comp?: boolean }
const TREE: Node[] = [
  { name: 'LOCKED OPTIONS', icon: 'frame', depth: 0, kids: true },
  { name: 'onemo-surface-bg-430×932@3× 1', icon: 'image', depth: 0 },
  { name: 'onemo-surface-bg-430×932@2× 1', icon: 'image', depth: 0 },
  { name: 'CANDIDATES', icon: 'frame', depth: 0, kids: true, open: true },
  { name: 'Editor 402 iphone', icon: 'auto', depth: 1, kids: true },
  { name: 'Top Section', icon: 'section', depth: 1, kids: true },
  { name: 'Editor 402 iphone - apple blur glass', icon: 'auto', depth: 1, kids: true },
  { name: 'Editor 402 iphone - apple blur glass', icon: 'auto', depth: 1, kids: true, open: true },
  { name: 'Status bar', icon: 'component', depth: 2, comp: true, locked: true, visible: true },
  { name: 'Top Section', icon: 'section', depth: 2, kids: true },
  { name: 'Canvas', icon: 'auto', depth: 2, kids: true, sel: true },
  { name: 'Bottom Section', icon: 'auto', depth: 2, kids: true },
  { name: 'Toolbar - Bottom - Safari', icon: 'toolbar', depth: 2, kids: true, locked: true, visible: true },
]
function LayerRow({ n }: { n: Node }) {
  const [h, setH] = useState(false)
  const iconName: keyof typeof UI_ICON = n.icon === 'image' ? 'layerImage' : n.icon === 'auto' ? 'layerAuto' : n.icon === 'section' ? 'layerSection' : n.icon === 'toolbar' ? 'layerToolbar' : n.icon === 'component' ? 'layerComponent' : 'layerFrame'
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'grid', gridTemplateColumns: `${16 + n.depth * 24}px 16px minmax(0,1fr) 40px`, alignItems: 'center', height: 32, paddingRight: 8, background: n.sel ? '#dff3ff' : h ? '#f4f5f6' : 'transparent', cursor: 'pointer' }}>
      <span style={{ width: 16, height: 16, marginLeft: n.depth * 24, display: 'grid', placeItems: 'center', color: INK }}>{n.kids && <UiIcon name={n.open ? 'caret16' : 'caretRight16'} size={16} />}</span>
      <span style={{ width: 16, height: 16, display: 'grid', placeItems: 'center', color: n.comp ? TOKEN : 'rgba(0,0,0,0.65)' }}><UiIcon name={iconName} size={16} /></span>
      <span style={{ minWidth: 0, paddingLeft: 8, font: `400 11px/16px ${FONT}`, color: n.comp ? TOKEN : INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
      <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, color: FAINT }}>
        {n.locked && <UiIcon name="layerLock" size={16} />}
        {n.visible && <UiIcon name="visibility" size={16} />}
      </span>
    </div>
  )
}

const PAGES = ['_DS Reference Components', 'DESIGN SYSTEM - full (current)', 'ONEMO BRAND IDENTITY', 'PROTOTYPING', 'Components +', 'ICONS']

/* ── Variables library (full-page, opened by the Variables rail item) ──
   Collections + counts are the REAL DS token collections (read live from Figma's variables editor). */
const COLLECTIONS: [string, number][] = [
  ['.0-Branding-Col', 600], ['.1.0-Prim-Col', 131], ['.1.1-Prim-Dim', 45], ['.1.2-Prim-Type', 28], ['.1.3-Prim-Track', 34], ['.1.4-Prim-Ratios', 21],
  ['.2.0-Al-Col', 79], ['.2.1-Al-Dim', 23], ['.2.2-Al-Type', 95], ['.2.3-Al-Radii', 11], ['.2.4-Al-Container', 12], ['.2.5-Al-Breakpoints', 8],
  ['3.0-Sem-Col', 86], ['3.1-Sem-Dim-Fluid', 23], ['3.2-Sem-Dim-Static', 23], ['3.3-Sem-Type-Fluid', 156], ['3.4-Sem-Border', 5], ['3.5-Sem-Radii', 11], ['3.6-Sem-Container', 13], ['3.7-Sem-Breakpoints', 8],
  ['5.0-Effects', 21], ['4.0-Com', 4],
]
const VGROUPS: [string, number, number][] = [['All', 600, 0], ['DUSTY', 288, 0], ['Royal Plum', 12, 1], ['Velvet Orchid', 12, 1], ['Blackberry Cream', 12, 1]]
const RAMPS: { group: string; rows: [number, string][] }[] = [
  { group: 'Royal Plum', rows: [[1, 'ED84D2'], [2, 'E869C7'], [3, 'E24EBB'], [4, 'DB33AF'], [5, 'C8259D'], [6, 'AB2286'], [7, '8E1E70'], [8, '72195A'], [9, '5F154B'], [10, '4D123C'], [11, '3A0E2D'], [12, '280A1F']] },
  { group: 'Velvet Orchid', rows: [[1, 'D4A8E2'], [2, 'C790D9'], [3, 'BB79CF'], [4, 'AE63C5'], [5, 'A14CBA'], [6, '8D41A4']] },
]
function VariablesLibrary() {
  const [colSel, setColSel] = useState(0)
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
      {/* collections + groups */}
      <div style={{ width: 300, flex: 'none', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
          <span style={{ flex: 1, minWidth: 0, font: `550 12px/1 ${FONT}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ONEMO DS v2.3.1 - 1 July +</span>
          <IB I={Sidebar} title="Toggle panel" s={15} />
        </div>
        <div style={{ padding: '10px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={hdr}>Collections</span><IB I={Plus} title="Create collection" s={14} /></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {COLLECTIONS.map(([n, c], i) => (
            <button key={n} type="button" onClick={() => setColSel(i)} style={{ appearance: 'none', border: 0, cursor: 'pointer', width: '100%', height: 30, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderRadius: 5, background: i === colSel ? '#f0f1f3' : 'transparent', color: INK }}>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `${i === colSel ? 550 : 400} 11px/1 ${FONT}` }}>{n}</span>
              <span style={{ flex: 'none', color: MUTE, font: `400 11px/1 ${FONT}` }}>{c}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${LINE}` }}><span style={hdr}>Groups</span><IB I={ListDashes} title="Sort" s={14} /></div>
        <div style={{ maxHeight: 150, overflowY: 'auto', padding: '0 6px 8px' }}>
          {VGROUPS.map(([n, c, d], i) => (
            <div key={n + i} style={{ height: 28, display: 'flex', alignItems: 'center', padding: `0 8px 0 ${8 + d * 16}px`, borderRadius: 5, background: i === 0 ? '#e5f4ff' : 'transparent', font: `${i === 0 ? 600 : 400} 11px/1 ${FONT}` }}>
              <span style={{ flex: 1, minWidth: 0 }}>{n}</span><span style={{ color: MUTE, fontWeight: 400 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
      {/* table */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
          <span style={{ font: `550 12px/1 ${FONT}` }}>{COLLECTIONS[colSel][0]}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 200, height: 26, background: FIELD, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', color: MUTE, font: `400 11px/1 ${FONT}` }}><MagnifyingGlass size={13} /> Search</div>
            <IB I={GearSix} title="Filter" s={14} /><IB I={Plus} title="New mode" s={14} />
          </div>
        </div>
        <div style={{ height: 32, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', font: `400 11px/1 ${FONT}`, color: MUTE }}>
          <span style={{ width: 280, padding: '0 16px' }}>Name</span><span style={{ flex: 1, padding: '0 16px' }}>Light</span><span style={{ flex: 'none', width: 40, display: 'grid', placeItems: 'center' }}><Plus size={13} color={MUTE} /></span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {RAMPS.map(r => (
            <div key={r.group}>
              <div style={{ padding: '12px 16px 6px', font: `400 11px/1 ${FONT}`, color: MUTE }}>DUSTY / <span style={{ color: INK, fontWeight: 600 }}>{r.group}</span></div>
              {r.rows.map(([num, hex]) => (
                <div key={num} style={{ height: 36, borderBottom: '1px solid #f2f2f3', display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 280, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, font: `400 11px/1 ${FONT}` }}><Palette size={14} color={MUTE} /> {num}</span>
                  <span style={{ flex: 1, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, font: `400 11px/1 ${FONT}` }}><span style={{ width: 14, height: 14, borderRadius: 3, background: '#' + hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} /> {hex}</span>
                  <span style={{ width: 40 }} />
                </div>
              ))}
            </div>
          ))}
          <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', color: MUTE, font: `400 11px/1 ${FONT}`, cursor: 'pointer' }}><Plus size={14} /> Create variable</div>
        </div>
      </div>
    </div>
  )
}

/* Paint/effect rows are cloned from the live Figma inspector DOM. */
function FigmaPaintRow({ hex, op }: { hex: string; op: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '156px 8px 24px 4px 24px', alignItems: 'center', height: 32, padding: '0 8px 0 16px' }}>
      <div style={{ height: 24, borderRadius: 5, background: FIELD, display: 'grid', gridTemplateColumns: '24px 1fr 38px 14px', alignItems: 'center', overflow: 'hidden', font: `450 11px/16px ${FONT}`, color: INK }}>
        <button type="button" aria-label={`Solid color hex: ${hex}`} style={{ appearance: 'none', border: 0, width: 14, height: 14, justifySelf: 'center', borderRadius: 2, background: `#${hex}`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)', padding: 0, cursor: 'pointer' }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hex}</span>
        <span style={{ textAlign: 'right', paddingRight: 7 }}>{op}</span>
        <span style={{ color: 'rgba(0,0,0,0.5)' }}>%</span>
      </div>
      <span />
      <UiIB name="visibility" title="Toggle visibility" />
      <span />
      <UiIB name="minus" title="Remove" />
    </div>
  )
}
function StrokeDetailRow({ position, weight }: { position: string; weight: number }) {
  return (
    <div style={{ position: 'relative', height: 50, width: '100%' }}>
      <span style={{ position: 'absolute', left: 16, top: 3.5, width: 84, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>Position</span>
      <span style={{ position: 'absolute', left: 100, top: 3.5, width: 80, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>Weight</span>
      <div style={{ position: 'absolute', left: 16, right: 8, top: 22, display: 'grid', gridTemplateColumns: '76px 8px 72px 8px 24px 4px 24px', alignItems: 'center' }}>
        <button type="button" role="combobox" aria-controls="stroke-position-options" aria-expanded={false} style={{ appearance: 'none', border: '1px solid #e6e6e6', background: '#fff', width: 76, height: 24, borderRadius: 5, padding: '0 0 0 9px', display: 'grid', gridTemplateColumns: '1fr 24px', alignItems: 'center', cursor: 'pointer', font: `450 11px/16px ${FONT}`, color: INK }}>
          <span style={{ textAlign: 'left' }}>{position}</span>
          <span style={{ color: FAINT, display: 'grid', placeItems: 'center' }}><UiIcon name="caret24" /></span>
        </button>
        <span />
        <div aria-label="Stroke weight" style={{ width: 72, height: 24, borderRadius: 5, background: FIELD, display: 'grid', gridTemplateColumns: '24px 1fr', alignItems: 'center', font: `450 11px/16px ${FONT}`, color: INK }}>
          <span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', color: 'rgba(0,0,0,0.5)' }}><UiIcon name="strokeWeight" /></span>
          <span>{weight}</span>
        </div>
        <span />
        <UiIB name="autoLayoutSettings" title="Advanced stroke settings" />
        <span />
        <UiIB name="individualStroke" title="Individual strokes" />
      </div>
    </div>
  )
}
function FigmaEffectRow({ type }: { type: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '156px 8px 24px 4px 24px', alignItems: 'center', height: 32, padding: '0 8px 0 16px' }}>
      <button type="button" style={{ appearance: 'none', border: '1px solid #e6e6e6', background: '#fff', width: 156, height: 26, borderRadius: 5, padding: 0, display: 'grid', gridTemplateColumns: '24px 1fr', alignItems: 'center', cursor: 'pointer', font: `450 11px/16px ${FONT}`, color: INK }}>
        <span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center' }}><UiIcon name="dropShadow" /></span>
        <span style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
      </button>
      <span />
      <UiIB name="visibility" title="Toggle visibility" />
      <span />
      <UiIB name="minus" title="Remove" />
    </div>
  )
}
function SelectionColorRow({ hex, name, op, grad }: { hex?: string; name?: string; op: number; grad?: boolean }) {
  const label = name || hex || ''
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '156px', alignItems: 'center', height: 32, padding: '0 8px 0 16px' }}>
      <div style={{ width: 156, height: 24, borderRadius: 5, background: FIELD, display: 'grid', gridTemplateColumns: '24px 1fr 38px 14px', alignItems: 'center', overflow: 'hidden', font: `450 11px/16px ${FONT}`, color: INK }}>
        {grad ? (
          <span aria-label="Linear gradient" style={{ width: 14, height: 14, justifySelf: 'center', borderRadius: 2, background: 'linear-gradient(0deg, #000 0%, #666 100%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' }} />
        ) : (
          <button type="button" aria-label={`Solid color hex: ${hex}`} style={{ appearance: 'none', border: 0, width: 14, height: 14, justifySelf: 'center', borderRadius: 2, background: `#${hex}`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)', padding: 0, cursor: 'pointer' }} />
        )}
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ textAlign: 'right', paddingRight: 7 }}>{op}</span>
        <span style={{ color: 'rgba(0,0,0,0.5)' }}>%</span>
      </div>
    </div>
  )
}
function LayoutGuideRow({ size }: { size: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '24px 8px 124px 8px 24px 4px 24px', alignItems: 'center', height: 32, padding: '0 8px 0 16px' }}>
      <UiIB name="layoutGrid" title="Layout guide settings" />
      <span />
      <button type="button" role="combobox" aria-controls="layout-guide-options" aria-expanded={false} style={{ appearance: 'none', border: '1px solid #e6e6e6', background: '#fff', width: 124, height: 24, borderRadius: 5, padding: '0 0 0 9px', display: 'grid', gridTemplateColumns: '1fr 24px', alignItems: 'center', cursor: 'pointer', font: `450 11px/16px ${FONT}`, color: INK }}>
        <span style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{size}</span>
        <span style={{ color: FAINT, display: 'grid', placeItems: 'center' }}><UiIcon name="caret24" /></span>
      </button>
      <span />
      <UiIB name="visibility" title="Toggle visibility" />
      <span />
      <UiIB name="minus" title="Remove layout guide" />
    </div>
  )
}
const FRAME_INSERT_OPTIONS = [
  { label: 'Frame', target: 'div', detail: 'freeform container' },
  { label: 'Section', target: 'section', detail: 'semantic block' },
  { label: 'Stack', target: 'div', detail: 'display: flex' },
  { label: 'Grid', target: 'div', detail: 'display: grid' },
]
function InsertIsland() {
  const [open, setOpen] = useState(false)
  return (
    <div aria-label="Insert tools" onPointerDown={e => e.stopPropagation()}
      style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 25, height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderRadius: 14, background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32 }}>
        <div role="group" aria-label="Move" style={{ display: 'grid', gridTemplateColumns: '32px 16px', width: 49, height: 32 }}>
          <button type="button" title="Move" aria-label="Move" style={{ appearance: 'none', border: 0, width: 32, height: 32, borderRadius: 7, background: SEL, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <UiIcon name="insertPointer" />
          </button>
          <button type="button" title="Move tools" aria-label="Move tools" style={{ appearance: 'none', border: 0, width: 16, height: 32, background: '#fff', color: FAINT, opacity: 0.55, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <UiIcon name="caret24" />
          </button>
        </div>
        <div role="group" aria-label="Frame" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '32px 16px', width: 49, height: 32 }}>
          <button type="button" aria-label="Frame" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}
            style={{ appearance: 'none', border: 0, width: 32, height: 32, borderRadius: 7, background: open ? FIELD : '#fff', color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <UiIcon name="insertFrame" />
          </button>
          <button type="button" title="Region tools" aria-label="Region tools" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}
            style={{ appearance: 'none', border: 0, width: 16, height: 32, background: '#fff', color: FAINT, opacity: 0.55, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <UiIcon name="caret24" />
          </button>
          {open && (
            <div role="menu" aria-label="React container types"
              style={{ position: 'absolute', bottom: 40, left: -6, width: 184, padding: 6, borderRadius: 12, background: '#1f1f1f', color: '#fff', boxShadow: '0 16px 36px rgba(0,0,0,.22)' }}>
              {FRAME_INSERT_OPTIONS.map(item => (
                <button key={item.label} type="button" role="menuitem" onClick={() => setOpen(false)}
                  style={{ appearance: 'none', border: 0, width: '100%', height: 34, borderRadius: 7, background: 'transparent', color: '#fff', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, padding: '0 9px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: `500 11px/12px ${FONT}` }}>{item.label}</span>
                    <span style={{ font: `400 9px/10px ${FONT}`, color: 'rgba(255,255,255,.58)' }}>{item.detail}</span>
                  </span>
                  <span style={{ font: `450 10px/12px ${FONT}`, color: 'rgba(255,255,255,.72)' }}>{item.target}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div role="group" aria-label="Text" style={{ display: 'grid', gridTemplateColumns: '32px 16px', width: 49, height: 32 }}>
          <button type="button" title="Text" aria-label="Text" style={{ appearance: 'none', border: 0, width: 32, height: 32, borderRadius: 7, background: '#fff', color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <UiIcon name="insertText" />
          </button>
          <button type="button" title="Type tools" aria-label="Type tools" style={{ appearance: 'none', border: 0, width: 16, height: 32, background: '#fff', color: FAINT, opacity: 0.55, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <UiIcon name="caret24" />
          </button>
        </div>
      </div>
      <span style={{ width: 1, height: 32, background: LINE }} />
      <div aria-label="Mode tools" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, padding: '0 2px', borderRadius: 9, background: FIELD, color: MUTE }}>
        <button type="button" title="Design mode" aria-label="Design mode" style={{ appearance: 'none', border: '1px solid #dadde1', width: 32, height: 32, borderRadius: 7, background: '#fff', color: SEL, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <UiIcon name="modeDesign" />
        </button>
        <button type="button" title="Code mode" aria-label="Code mode" style={{ appearance: 'none', border: 0, width: 32, height: 32, borderRadius: 7, background: 'transparent', color: MUTE, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <UiIcon name="modeDev" />
        </button>
      </div>
    </div>
  )
}

/* ⚠️ MOCK section content — DATA (read from the selected element's props via the reader later), NOT hardcoded UI.
   Empty array → the section renders its EMPTY state (header + Add only); non-empty → the content state. */
const MOCK = {
  fills: [{ hex: 'FFFFFF', op: 100 }],
  strokes: [{ hex: '000000', op: 100, position: 'Inside', weight: 1 }],
  effects: [{ type: 'Drop shadow' }],
  selectionColors: [{ name: 'Linear', op: 100, grad: true }, { hex: '000000', op: 100 }, { hex: 'FFFFFF', op: 100 }],
  layoutGuides: [{ size: 'Grid 10px' }],
}

export default function ReactFigmaPage() {
  type Rail = 'file' | 'assets' | 'variables'
  const [rail, setRail] = useState<Rail>('file')
  const [tab, setTab] = useState<'design' | 'prototype'>('design')
  const [view, setView] = useState({ x: 300, y: 70, z: 0.6 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top
        setView(v => { const nz = Math.min(4, Math.max(0.05, v.z * (1 - e.deltaY * 0.0016))); const k = nz / v.z; return { z: nz, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k } })
      } else setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const onDown = useCallback((e: React.PointerEvent) => { if (e.button !== 0 && e.button !== 1) return; pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; setIsPanning(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }, [view.x, view.y])
  const onMove = useCallback((e: React.PointerEvent) => { if (pan.current) setView(v => ({ ...v, x: pan.current!.vx + (e.clientX - pan.current!.x), y: pan.current!.vy + (e.clientY - pan.current!.y) })) }, [])
  const onUp = useCallback(() => { pan.current = null; setIsPanning(false) }, [])

  // resizable panels — edge drag handles + min/max (Figma canon). Document-level listeners = robust through the whole drag.
  const [leftW, setLeftW] = useState(240)
  const [rightW, setRightW] = useState(241)
  const startResize = (side: 'l' | 'r') => (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX, startW = side === 'l' ? leftW : rightW
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      if (side === 'l') setLeftW(Math.max(208, Math.min(400, startW + dx)))
      else setRightW(Math.max(232, Math.min(440, startW - dx)))
    }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }
  const handleStyle = (side: 'left' | 'right'): React.CSSProperties => ({ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 8, cursor: 'ew-resize', zIndex: 30 })

  const railItems: [keyof typeof UI_ICON, string, Rail | null][] = [
    ['railFile', 'File', 'file'], ['railAgents', 'Agents', null], ['railAssets', 'Assets', 'assets'], ['railTools', 'Tools', null], ['railVariables', 'Variables', 'variables'],
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#fff', fontFamily: FONT, color: INK, userSelect: 'none' }}>
      {/* ░░ ICON RAIL ░░ */}
      <nav style={{ width: 56, flex: 'none', borderRight: `1px solid ${LINE}`, background: RAIL, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 0' }}>
        {railItems.map(([icon, label, key]) => {
          const active = key !== null && rail === key
          return (
            <button key={label} type="button" title={label} onClick={() => key && setRail(key)}
              style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 56, height: 56, borderRadius: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 2, background: 'transparent', padding: '5px 0 0', marginTop: label === 'Variables' ? 16 : 0, color: active ? SEL : INK }}>
              <span style={{ width: 32, height: 28, borderRadius: 5, display: 'grid', placeItems: 'center', background: active ? '#e5f4ff' : 'transparent' }}><UiIcon name={icon} /></span>
              <span style={{ font: `450 9px/14px ${FONT}`, color: INK }}>{label}</span>
            </button>
          )
        })}
      </nav>

      {rail === 'variables' ? <VariablesLibrary /> : (<>
      {/* ░░ LEFT PANEL (rail-switched) ░░ */}
      <aside style={{ width: leftW, flex: 'none', position: 'relative', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* file selector */}
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'grid', gridTemplateColumns: '1fr 24px 32px', alignItems: 'center', gap: 4, padding: '0 8px 0 16px', flex: 'none' }}>
          <button type="button" aria-label="ONEMO DS v2.3.1 - 1 July +, file name" style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', minWidth: 0, padding: 0, textAlign: 'left', font: `550 12px/16px ${FONT}`, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ONEMO DS v2.3.1 - 1 July +</button>
          <UiIB name="caret16" title="Edit file menu" />
          <UiIB name="minimizeUI" title="Minimize UI" />
        </div>

        {rail === 'file' && (
          <>
            <div style={{ height: 25, display: 'flex', alignItems: 'center', padding: '0 16px', font: `400 11px/16px ${FONT}`, color: MUTE }}>Drafts ›</div>
            <div style={{ height: 40, padding: '0 8px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={hdr}>Pages</span>
              <span style={{ display: 'flex', gap: 4, color: MUTE }}><UiIB name="find" title="Find" /><UiIB name="plus" title="Add new page" /></span>
            </div>
            <div style={{ padding: '0 8px' }}>
              {PAGES.map((p, i) => (
                <div key={p} style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRadius: 5, background: i === 4 ? '#f0f1f3' : 'transparent', font: `400 11px/16px ${FONT}`, color: INK }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 49, padding: '9px 8px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${LINE}` }}>
              <span style={hdr}>Layers</span>
              <UiIB name="collapseLayers" title="Collapse layers" />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>{TREE.map((n, i) => <LayerRow key={i} n={n} />)}</div>
          </>
        )}
        {rail === 'assets' && (
          <>
            <div style={{ padding: '10px 12px' }}><div style={{ height: 28, background: FIELD, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', color: MUTE, font: `400 11px/1 ${FONT}` }}><MagnifyingGlass size={13} /> Search components…</div></div>
            <div style={{ padding: '4px 12px', font: `400 11px/1.6 ${FONT}`, color: FAINT }}>Local components + libraries expand here (Assets panel).</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '4px 12px' }}>
              {['RoundButton', 'Dock', 'Dial', 'Glass', 'Surface', 'Ruler'].map(c => (
                <div key={c} style={{ height: 56, borderRadius: 6, border: `1px solid ${LINE}`, display: 'grid', placeItems: 'center', font: `450 10px/1 ${FONT}`, color: MUTE }}>{c}</div>
              ))}
            </div>
          </>
        )}
        <div onPointerDown={startResize('l')} style={handleStyle('right')} />
      </aside>

      {/* ░░ INFINITE CANVAS ░░ */}
      <main ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ flex: 1, minWidth: 0, background: '#f0f0f0', position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'default' }}>
        <InsertIsland />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(0,0,0,.09) 1px, transparent 1px)', backgroundSize: `${24 * view.z}px ${24 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }} />
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.z})`, transformOrigin: '0 0' }}>
          <div style={{ font: `550 10px/1 ${FONT}`, color: SEL, marginBottom: 8, marginLeft: 2 }}>Editor 402 · 402 × 871</div>
          <div data-screen-host style={{ width: 402, height: 871, background: '#fff', borderRadius: 4, boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 12px 40px -8px rgba(0,0,0,.25)', display: 'grid', placeItems: 'center', color: FAINT, font: `400 12px/1.6 ${FONT}`, textAlign: 'center', padding: 24 }}>
            The real engine-connected Screen<br />mounts here — after the shell.
          </div>
        </div>
        <div style={{ position: 'absolute', left: 12, bottom: 12, height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', background: '#fff', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,.14)', font: `450 11px/1 ${FONT}` }}>
          <IB I={Minus} title="Zoom out" s={13} on={() => setView(v => ({ ...v, z: Math.max(0.05, v.z - 0.1) }))} />
          <span style={{ minWidth: 34, textAlign: 'center' }}>{Math.round(view.z * 100)}%</span>
          <IB I={Plus} title="Zoom in" s={13} on={() => setView(v => ({ ...v, z: Math.min(4, v.z + 0.1) }))} />
        </div>
      </main>

      {/* ░░ RIGHT — Design inspector ░░ */}
      <aside style={{ width: rightW, flex: 'none', position: 'relative', borderLeft: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div onPointerDown={startResize('r')} style={handleStyle('left')} />
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 8px 0 11px', flex: 'none' }}>
          <div style={{ marginLeft: 'auto', width: 107.5, display: 'flex', alignItems: 'center', gap: 1, height: 32 }}>
            <button type="button" aria-label="Present" style={{ appearance: 'none', border: 0, background: 'transparent', width: 32, height: 32, borderRadius: '5px 0 0 5px', display: 'grid', gridTemplateColumns: '24px', placeItems: 'center', padding: '0 4px', cursor: 'pointer', color: INK }}><UiIcon name="present" /></button>
            <button type="button" aria-label="Prototype view" style={{ appearance: 'none', border: 0, background: 'transparent', width: 16, height: 32, borderRadius: '0 5px 5px 0', display: 'grid', gridTemplateColumns: '20px', placeItems: 'center', padding: 0, cursor: 'pointer', color: INK }}><UiIcon name="caret24" /></button>
            <button type="button" style={{ appearance: 'none', border: 0, background: SEL, color: '#fff', height: 32, marginLeft: 3, borderRadius: 5, padding: '0 12px', cursor: 'pointer', font: `450 11px/16px ${FONT}`, letterSpacing: '0.055px' }}>Publish</button>
          </div>
        </div>
        <div style={{ height: 33, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'flex-start', padding: '0 8px', flex: 'none' }}>
          <div role="tablist" style={{ display: 'flex', gap: 4, height: 24 }}>
            {(['design', 'prototype'] as const).map(t => {
              const active = tab === t
              return (
                <button key={t} type="button" onClick={() => setTab(t)}
                  style={{ appearance: 'none', border: 0, cursor: 'pointer', width: t === 'design' ? 53 : 68.8, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center', background: active ? FIELD : '#fff', padding: '0 8px', font: `${active ? 550 : 450} 11px/16px ${FONT}`, letterSpacing: '0.055px', color: active ? INK : 'rgba(0,0,0,0.5)' }}>{t === 'design' ? 'Design' : 'Prototype'}</button>
              )
            })}
          </div>
          <button type="button" style={{ appearance: 'none', border: 0, background: '#fff', borderRadius: 5, marginLeft: 'auto', width: 54.5, height: 24, padding: '4px 4px 4px 12px', color: '#000', cursor: 'pointer', font: `400 11px/16px ${FONT}`, display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>92%</span><UiIcon name="caret16" size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Frame preset + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '4px 8px' }}>
            <button type="button" aria-label="Frame, Frame Dimension Presets" style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 72, height: 24, display: 'flex', alignItems: 'center', gap: 1, font: `550 13px/22px ${FONT}`, letterSpacing: '-0.032px', color: '#000', padding: '0 0 0 7px' }}>Frame <UiIcon name="caret24" /></button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <span aria-hidden style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', flex: 'none', color: INK }}><UiIcon name="devCode" /></span>
              <UiIB name="createComponent" title="Create component" />
              <UiIB name="overflowDots" title="More actions" />
            </div>
          </div>

          <Sec title="Position" first bodyGap={0} bodyPadding="0">
            <PositionRow label="Alignment">
              <Seg fill><FSegBtn name="alignLeft" pos="l" fill title="Align left" /><FSegBtn name="alignCenterH" pos="m" fill title="Align horizontal centers" /><FSegBtn name="alignRight" pos="r" fill title="Align right" /></Seg>
              <Seg fill><FSegBtn name="alignTop" pos="l" fill title="Align top" /><FSegBtn name="alignCenterV" pos="m" fill title="Align vertical centers" /><FSegBtn name="alignBottom" pos="r" fill title="Align bottom" /></Seg>
              <FIB name="more" title="More actions" />
            </PositionRow>
            <PositionRow label="Position">
              <InspectorField label="X" value="0" input dimValue />
              <InspectorField label="Y" value="122" input dimValue />
              <span />
            </PositionRow>
            <PositionRow label="Rotation">
              <InspectorField icon="rotationField" value="0°" />
              <div style={{ display: 'flex', gap: 1, width: '100%' }}><FSegBtn name="rotate" pos="l" fill title="Rotate 90° right" /><FSegBtn name="flipH" pos="m" fill title="Flip horizontal" /><FSegBtn name="flipV" pos="r" fill title="Flip vertical" /></div>
              <span />
            </PositionRow>
            <InspectorRow label="CSS position">
              <TextSegGroup items={['Auto', 'Rel', 'Abs', 'Fix', 'Sticky']} active={2} />
              <span />
              <span />
            </InspectorRow>
            <CompactInspectorRow label="Inset / z-index">
              <InspectorField label="T" value="auto" />
              <InspectorField label="L" value="auto" />
              <InspectorField label="Z" value="1" />
            </CompactInspectorRow>
          </Sec>

          <Sec title="Auto layout" bodyGap={0} bodyPadding="0">
            <InspectorRow label="Flow">
              <AutoFlowGroup />
              <span />
              <UiIB name="autoLayoutWrap" title="Wrap" size={16} />
            </InspectorRow>
            <InspectorRow label="Resizing">
              <AutoValueField icon="resizeW" value="402" mode="Fill" />
              <AutoValueField label="H" value="427" mode="Fill" />
              <UiIB name="lockAspect" title="Lock aspect ratio" />
            </InspectorRow>
            <div style={{ position: 'relative', height: 82, width: '100%' }}>
              <span style={{ position: 'absolute', left: 16, top: 3.5, width: 88, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>Alignment</span>
              <span style={{ position: 'absolute', left: 112, top: 3.5, width: 88, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>Gap</span>
              <div style={{ position: 'absolute', left: 16, right: 8, top: 22, display: 'grid', gridTemplateColumns: '88px 88px 24px', gap: 8, alignItems: 'start' }}>
                <AlignGrid sel={4} />
                <AutoValueField icon="gapVertical" value="0" />
                <UiIB name="autoLayoutSettings" title="Auto layout settings" />
              </div>
            </div>
            <InspectorRow label="Padding" height={50}>
              <AutoValueField icon="paddingHorizontal" value="0" caret={false} />
              <AutoValueField icon="paddingVertical" value="0" caret={false} />
              <UiIB name="paddingIndividual" title="Individual padding" />
            </InspectorRow>
            <div data-react-figma-clip-row style={{ height: 32, padding: '0 8px 0 16px', display: 'grid', gridTemplateColumns: '216px', alignItems: 'center' }}>
              <style>{'[data-react-figma-clip-row] input:not(:checked) + [data-react-figma-clip-box] svg{display:none}'}</style>
              <label style={{ position: 'relative', display: 'grid', gridTemplateColumns: '16px 200px', width: 216, height: 24, cursor: 'pointer', color: INK }}>
                <input type="checkbox" aria-label="Clip content" style={{ position: 'absolute', left: 0, top: 4, width: 16, height: 16, margin: 0, opacity: 0, pointerEvents: 'none' }} />
                <span data-react-figma-clip-box aria-hidden style={{ position: 'relative', width: 16, height: 16, margin: '4px 0', border: '1px solid rgba(0,0,0,0.2)', borderRadius: 2, background: FIELD, boxSizing: 'border-box', display: 'grid', color: INK }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ position: 'absolute', left: -1, top: -1 }}>
                    <path d="M5.00012 8.5L7.5 11L11.5 5" stroke="rgba(0,0,0,0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ position: 'relative', left: -1, top: -1 }}>
                    <path d="M5.00012 8.5L7.5 11L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision" />
                  </svg>
                </span>
                <span data-react-figma-clip-text style={{ height: 20, margin: '4px 0 0', padding: '0 0 0 8px', font: `400 11px/16px ${FONT}`, color: INK }}>Clip content</span>
              </label>
            </div>
          </Sec>

          <Sec title="Appearance" actionWidth={53} action={<><UiIB name="visibility" title="Hide" /><UiIB name="blendMode" title="Apply blend mode" /></>} bodyGap={0} bodyPadding="0">
            <div style={{ position: 'relative', height: 50, width: '100%' }}>
              <span style={{ position: 'absolute', left: 16, top: 3.5, width: 88, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>Opacity</span>
              <span style={{ position: 'absolute', left: 112, top: 3.5, width: 120, font: `500 9px/14px ${FONT}`, letterSpacing: '0.27px', color: 'rgba(0,0,0,0.5)' }}>Corner radius</span>
              <div style={{ position: 'absolute', left: 16, right: 8, top: 22, display: 'grid', gridTemplateColumns: '88px 88px 24px', gap: 8, alignItems: 'start' }}>
                <AutoValueField icon="opacity" value="100%" caret={false} />
                <AutoValueField icon="cornerRadius" value="0" caret={false} />
                <UiIB name="cornerRadius" title="Individual corners" />
              </div>
            </div>
          </Sec>

          <Sec title="Fill" actionWidth={52} action={<><UiIB name="styleDots" title="Fill, Apply styles and variables" /><UiIB name="plus" title="Add fill" /></>} bodyGap={0} bodyPadding="0">
            {MOCK.fills.map((f, i) => <FigmaPaintRow key={i} hex={f.hex} op={f.op} />)}
          </Sec>
          <Sec title="Stroke" actionWidth={52} action={<><UiIB name="styleDots" title="Stroke, Apply styles and variables" /><UiIB name="plus" title="Add stroke fill" /></>} bodyGap={0} bodyPadding="0">
            {MOCK.strokes.map((s, i) => (
              <div key={i}>
                <FigmaPaintRow hex={s.hex} op={s.op} />
                <StrokeDetailRow position={s.position} weight={s.weight} />
              </div>
            ))}
          </Sec>
          <Sec title="Effects" actionWidth={52} action={<><UiIB name="styleDots" title="Effects, Apply styles" /><UiIB name="plus" title="Add effect" /></>} bodyGap={0} bodyPadding="0">
            {MOCK.effects.map((e, i) => <FigmaEffectRow key={i} type={e.type} />)}
          </Sec>
          <Sec title="Selection colors" bodyGap={0} bodyPadding="0">
            {MOCK.selectionColors.map((c, i) => <SelectionColorRow key={i} hex={c.hex} name={c.name} op={c.op} grad={c.grad} />)}
          </Sec>
          <Sec title="Layout guide" actionWidth={52} action={<><UiIB name="styleDots" title="Layout guide, Apply styles" /><UiIB name="plus" title="Add layout guide" /></>} bodyGap={0} bodyPadding="0">
            {MOCK.layoutGuides.map((g, i) => <LayoutGuideRow key={i} size={g.size} />)}
          </Sec>
        </div>
      </aside>
      </>)}
    </div>
  )
}
