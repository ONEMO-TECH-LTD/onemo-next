/**
 * ONEMO Icon Comparison Matrix — KAI-9036 (VA34)
 *
 * Rows: every icon in the v3 effect-creator build (source of truth:
 * onemo-next .../effect-creator/v3/user/icons.tsx) — semantic name + purpose.
 * Columns: the current set (Phosphor) vs every alternative that ships a code
 * distribution. Sets with NO code distribution (Iconstica, Nucleo — Figma/app
 * only) cannot appear here; they need a Figma-side pass or purchase.
 * "—" = the set has no usable equivalent. Coverage gaps are data.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import React from 'react'

// 1 · Phosphor — current build set (MIT, 6 weights)
import {
  ArrowArcLeft, ArrowArcRight, ArrowsOutCardinal, DiceFive, WaveSine,
  ArrowClockwise, Check, X, DownloadSimple, Eye, EyeSlash, ArrowsOut,
  PlusCircle, Trash, Sparkle, ImageSquare, PencilSimple, BoundingBox,
  Palette, MagicWand, BezierCurve, Shapes, Faders, Crop, Sun, CircleHalf,
  Drop, Thermometer, Ruler, LineSegment, Angle, Polygon, Star, Circle,
  Square, Pill, Heart, ChatTeardrop, Seal, Shield,
} from '@phosphor-icons/react'

// 2 · Untitled UI — OWNED full design system (React Aria vendor), line style on npm
import {
  ReverseLeft, ReverseRight, Move as UMove, Dice5 as UDice, Activity as UActivity,
  RefreshCw01, Check as UCheck, X as UX, Download01 as UDownload, Eye as UEye,
  EyeOff as UEyeOff, Maximize02, PlusCircle as UPlusCircle, Trash01, Star06,
  Image01, Pencil01, Scan as UScan, Palette as UPalette, MagicWand01,
  BezierCurve01, Pentagon as UPentagon, Sliders01, Crop01, Sun as USun,
  Contrast01, Droplets01, Thermometer01, Ruler as URuler, Minus as UMinus,
  Triangle as UTriangle, Star01 as UStar, Circle as UCircle, Square as USquare,
  Heart as UHeart, MessageCircle01, Certificate01, Shield01,
} from '@untitledui/icons'

// 3 · Pikaicons — boutique "charming" set; free npm tier = 100 generic icons only
import {
  CheckTick, CrossCross, Download01 as PDownload, EditPencil,
  DeleteDustbin, PhotoPhoto, Settings01 as PSettings, Heart as PHeart,
  MessageDefault, ShieldShield,
} from 'pikaicons'

// 4 · Iconoir — open-source, editor/3D vocabulary (MIT)
import {
  Undo as IUndo, Redo as IRedo, Drag, DiceFive as IDice, SineWave,
  Refresh as IRefresh, Check as ICheck, Xmark, Download as IDownload,
  Eye as IEye, EyeClosed, Maximize as IMax, PlusCircle as IPlusCircle,
  Trash as ITrash, Sparks, MediaImage, Edit as IEdit, Frame as IFrame,
  Palette as IPalette, MagicWand as IMagicWand, Pentagon as IPentagon,
  Settings as ISettings, Crop as ICrop, SunLight, HalfMoon,
  Droplet as IDroplet, TemperatureUp, Ruler as IRuler, Minus as IMinus,
  AngleTool, Star as IStar, Circle as ICircle, Square as ISquare,
  Heart as IHeart, Message as IMessage, BadgeCheck, Shield as IShield,
} from 'iconoir-react'

// 5 · MynaUI — hidden-gem MIT set, 24×24 1.5px
import {
  Undo as MUndo, Redo as MRedo, Move as MMove, Dice5 as MDice,
  Activity as MActivity, Refresh as MRefresh, Check as MCheck, X as MX,
  Download as MDownload, Eye as MEye, EyeOff as MEyeOff, Maximize as MMax,
  PlusCircle as MPlusCircle, Trash as MTrash, Sparkles as MSparkles,
  Image as MImage, Pencil as MPencil, BoundingBox as MBoundingBox,
  Crop as MCrop, Sun as MSun, CircleHalf as MCircleHalf, Droplet as MDroplet,
  Thermometer as MThermometer, Ruler as MRuler, Minus as MMinus,
  Triangle as MTriangle, Hexagon as MHexagon, Star as MStar,
  Circle as MCircle, Square as MSquare, Heart as MHeart,
  Message as MMessage, Badge as MBadge, Shield as MShield,
} from '@mynaui/icons-react'

// 6 · Hugeicons (free core) — huge modern set, free tier
import { HugeiconsIcon } from '@hugeicons/react'
import {
  UndoIcon as HUndo, RedoIcon as HRedo, MoveIcon as HMove, DiceIcon as HDice,
  AudioWaveIcon as HWave, RotateIcon as HRotate, CheckIcon as HCheck,
  Cancel01Icon as HCross, DownloadIcon as HDownload, EyeIcon as HEye,
  EyeOffIcon as HEyeOff, ExpandIcon as HExpand, PlusSignCircleIcon as HPlusCircle,
  Delete02Icon as HDelete, SparklesIcon as HSparkles, ImageIcon as HImage,
  PencilEdit02Icon as HPencil, FrameIcon as HFrame, PaintBoardIcon as HPaint,
  MagicWand01Icon as HMagic, ShapesIcon as HShapes, SlidersHorizontalIcon as HSliders,
  CropIcon as HCrop, SunIcon as HSun, ContrastIcon as HContrast,
  DropletIcon as HDroplet, TemperatureIcon as HTemp, RulerIcon as HRuler,
  LineIcon as HLine, AngleIcon as HAngle, HexagonIcon as HHexagon,
  StarIcon as HStar, CircleIcon as HCircle, SquareIcon as HSquare,
  PillIcon as HPill, HeartIcon as HHeart, ChatIcon as HChat,
  SealIcon as HSeal, ShieldIcon as HShield,
} from '@hugeicons/core-free-icons'

// 6b · Atlas Icons (research round 2 — "coverage safety net", MIT, 1.5px)
import {
  RotateLeft as ARotL, RotateArrowRight as ARotR, Move as AMove, RotateRight as AReset,
  CheckCircle as ACheck, Cross as ACross, DownloadArrowDown as ADown, Eye as AEye,
  PlusCircle as APlus, Trash as ATrash, Image as AImage, Pencil as APencil,
  ColorSwatches as ASwatch, MagicWand as AMagic, Shape as AShape, Sliders as ASliders,
  Crop as ACrop, Sunny as ASun, WaterDrop as ADrop, Thermometer as AThermo,
  Ruler as ARuler, Stop as AStop, Record as ARecord, CapsuleMedicine as APill,
  Star as AStar, Heart as AHeart, ChatDots as AChat, Medal as AMedal, Waveform as AWave,
} from '@vectopus/atlas-icons-react'

// 6c · Solar (research round 1 — CC BY 4.0: attribution required! comparison only)
import {
  UndoLeft as SUndo, UndoRight as SRedo, Refresh as SReset, CheckCircle as SCheck,
  CloseCircle as SClose, Download as SDown, Eye as SEye, EyeClosed as SEyeOff,
  Maximize as SMax, AddCircle as SPlus, TrashBin2 as STrash, Gallery as SGallery,
  Pen as SPen, Scanner as SScan, Palette as SPalette, MagicStick as SMagic,
  Tuning as STune, Crop as SCrop, Sun as SSun, Waterdrop as SDrop,
  Temperature as STemp, Ruler as SRuler, RulerAngular as SAngle, Stop as SStop,
  Record as SRecord, Pill as SPill, Star as SStar, Heart as SHeart,
  ChatDots as SChat, MedalRibbonStar as SMedal, Shield as SShield, Soundwave as SWave,
} from '@solar-icons/react'

// 7 · Lucide — shadcn default (MIT) — the "generic SaaS" control group
import {
  Undo as LUndo, Redo as LRedo, Move as LMove, Dice5 as LDice,
  AudioWaveform as LWave, RotateCw as LRotate, Check as LCheck, X as LX,
  Download as LDownload, Eye as LEye, EyeOff as LEyeOff, Maximize as LMax,
  PlusCircle as LPlusCircle, Trash as LTrash, Sparkle as LSparkle,
  Image as LImage, Pencil as LPencil, Frame as LFrame, Palette as LPalette,
  Wand as LWand, Spline as LSpline, Shapes as LShapes, Sliders as LSliders,
  Crop as LCrop, Sun as LSun, Contrast as LContrast, Droplet as LDroplet,
  Thermometer as LThermometer, Ruler as LRuler, Minus as LMinus,
  TriangleRight as LTriangleRight, Pentagon as LPentagon, Star as LStar,
  Circle as LCircle, Square as LSquare, Pill as LPill, Heart as LHeart,
  MessageCircle as LMessage, Badge as LBadge, Shield as LShield,
} from 'lucide-react'

// 8 · Tabler — dense tooling set (MIT)
import {
  IconArrowBackUp, IconArrowForwardUp, IconArrowsMove, IconDice5,
  IconWaveSine, IconRotateClockwise, IconCheck, IconX, IconDownload,
  IconEye, IconEyeOff, IconMaximize, IconCirclePlus, IconTrash, IconSparkles,
  IconPhoto, IconPencil, IconFrame, IconPalette, IconWand, IconVectorBezier,
  IconCategory, IconAdjustments, IconCrop, IconSun, IconContrast,
  IconDroplet, IconThermometer, IconRuler, IconLine, IconAngle, IconPolygon,
  IconStar, IconCircle, IconSquare, IconPill, IconHeart, IconMessage,
  IconRosette, IconShield,
} from '@tabler/icons-react'

const SZ = 24
// WEIGHT + DIMENSION NORMALIZATION — like-for-like comparison:
// weight: every set rendered in its 1.5px class (phosphor light, lucide/tabler/untitled 2->1.5).
// optical size: sets draw different live areas inside the 24px box (measured on the Square glyph
// via getBBox: phosphor 17.63, hugeicons 19, all others 18). Per-set render size compensates so a
// square is 18px in every column: phosphor 24*18/17.63=24.5, hugeicons 24*18/19=22.7.
const PH_SZ = 24.5
const HU_SZ = 22.7
const huge = (icon: object) => <HugeiconsIcon icon={icon as never} size={HU_SZ} strokeWidth={1.5 * 24 / HU_SZ} />
const NA = null // set has no usable equivalent

type Row = {
  name: string; purpose: string;
  phosphor: React.ReactNode; untitled: React.ReactNode; pika: React.ReactNode;
  iconoir: React.ReactNode; myna: React.ReactNode; huge: React.ReactNode;
  atlas: React.ReactNode; solar: React.ReactNode;
  lucide: React.ReactNode; tabler: React.ReactNode;
  note?: string;
}

type AnyIcon = React.ComponentType<Record<string, unknown>>
const I = (C: AnyIcon) => <C size={SZ} width={SZ} height={SZ} />            // native-1.5 sets: untitled, pika, iconoir, myna
const IP = (C: AnyIcon) => <C size={PH_SZ} weight="light" />                 // phosphor 2 -> 1.5; size 24.5 -> live 18
const IU = (C: AnyIcon) => <C size={SZ} strokeWidth={1.5} />                 // untitled 2 -> 1.5
const IM = (C: AnyIcon) => <C size={SZ} stroke={1.5} />                      // myna -> explicit 1.5
const IL = (C: AnyIcon) => <C size={SZ} strokeWidth={1.5} />                 // lucide 2 -> 1.5
const IT = (C: AnyIcon) => <C size={SZ} stroke={1.5} />                      // tabler 2 -> 1.5
const IA = (C: AnyIcon) => <C size={20.57} strokeWidth={1.75} />             // atlas square 21 -> 18; stroke compensated
const IS = (C: AnyIcon) => <span className="solar-sw"><C size={21.6} weight="Linear" /></span> // solar square 20 -> 18; stroke comp via CSS rule (path hardcodes the attr)

const ROWS: Row[] = [
  { name: 'Undo', purpose: 'Global history back (top-left pill)', phosphor: IP(ArrowArcLeft), untitled: IU(ReverseLeft), pika: NA, iconoir: I(IUndo), myna: IM(MUndo), huge: huge(HUndo), atlas: IA(ARotL), solar: IS(SUndo), lucide: IL(LUndo), tabler: IT(IconArrowBackUp) },
  { name: 'Redo', purpose: 'Global history forward', phosphor: IP(ArrowArcRight), untitled: IU(ReverseRight), pika: NA, iconoir: I(IRedo), myna: IM(MRedo), huge: huge(HRedo), atlas: IA(ARotR), solar: IS(SRedo), lucide: IL(LRedo), tabler: IT(IconArrowForwardUp) },
  { name: 'Reset', purpose: 'Top-center, only-when-dirty', phosphor: IP(ArrowClockwise), untitled: IU(RefreshCw01), pika: NA, iconoir: I(IRefresh), myna: IM(MRefresh), huge: huge(HRotate), atlas: IA(AReset), solar: IS(SReset), lucide: IL(LRotate), tabler: IT(IconRotateClockwise) },
  { name: 'Check / Done', purpose: 'Commit the editor session', phosphor: IP(Check), untitled: IU(UCheck), pika: I(CheckTick), iconoir: I(ICheck), myna: IM(MCheck), huge: huge(HCheck), atlas: IA(ACheck), solar: IS(SCheck), lucide: IL(LCheck), tabler: IT(IconCheck) },
  { name: 'Close ✕', purpose: 'Exit / cancel takeover', phosphor: IP(X), untitled: IU(UX), pika: I(CrossCross), iconoir: I(Xmark), myna: IM(MX), huge: huge(HCross), atlas: IA(ACross), solar: IS(SClose), lucide: IL(LX), tabler: IT(IconX) },
  { name: 'Export', purpose: 'mm-true SVG cutline download', phosphor: IP(DownloadSimple), untitled: IU(UDownload), pika: I(PDownload), iconoir: I(IDownload), myna: IM(MDownload), huge: huge(HDownload), atlas: IA(ADown), solar: IS(SDown), lucide: IL(LDownload), tabler: IT(IconDownload) },
  { name: 'Edit', purpose: 'Hero top bar — enter editor', phosphor: IP(PencilSimple), untitled: IU(Pencil01), pika: I(EditPencil), iconoir: I(IEdit), myna: IM(MPencil), huge: huge(HPencil), atlas: IA(APencil), solar: IS(SPen), lucide: IL(LPencil), tabler: IT(IconPencil) },
  { name: 'Magic ✦', purpose: 'Auto cut-out (BEN) — hero + AUTO chip', phosphor: IP(MagicWand), untitled: IU(MagicWand01), pika: NA, iconoir: I(IMagicWand), myna: NA, huge: huge(HMagic), atlas: IA(AMagic), solar: IS(SMagic), lucide: IL(LWand), tabler: IT(IconWand) },
  { name: 'Upload / Image', purpose: 'Hero creation row — artwork in', phosphor: IP(ImageSquare), untitled: IU(Image01), pika: I(PhotoPhoto), iconoir: I(MediaImage), myna: IM(MImage), huge: huge(HImage), atlas: IA(AImage), solar: IS(SGallery), lucide: IL(LImage), tabler: IT(IconPhoto) },
  { name: 'Trim / Colors', purpose: 'Material color carousel', phosphor: IP(Palette), untitled: IU(UPalette), pika: NA, iconoir: I(IPalette), myna: NA, huge: huge(HPaint), atlas: IA(ASwatch), solar: IS(SPalette), lucide: IL(LPalette), tabler: IT(IconPalette) },
  { name: 'Preview', purpose: 'Clean result, hide anchors', phosphor: IP(Eye), untitled: IU(UEye), pika: NA, iconoir: I(IEye), myna: IM(MEye), huge: huge(HEye), atlas: IA(AEye), solar: IS(SEye), lucide: IL(LEye), tabler: IT(IconEye) },
  { name: 'Preview off', purpose: 'Back to editing chrome', phosphor: IP(EyeSlash), untitled: IU(UEyeOff), pika: NA, iconoir: I(EyeClosed), myna: IM(MEyeOff), huge: huge(HEyeOff), atlas: NA, solar: IS(SEyeOff), lucide: IL(LEyeOff), tabler: IT(IconEyeOff) },
  { name: 'Add point', purpose: 'Node bar + (selected segment)', phosphor: IP(PlusCircle), untitled: IU(UPlusCircle), pika: NA, iconoir: I(IPlusCircle), myna: IM(MPlusCircle), huge: huge(HPlusCircle), atlas: IA(APlus), solar: IS(SPlus), lucide: IL(LPlusCircle), tabler: IT(IconCirclePlus) },
  { name: 'Delete point', purpose: 'Node bar – (selected anchor)', phosphor: IP(Trash), untitled: IU(Trash01), pika: I(DeleteDustbin), iconoir: I(ITrash), myna: IM(MTrash), huge: huge(HDelete), atlas: IA(ATrash), solar: IS(STrash), lucide: IL(LTrash), tabler: IT(IconTrash) },
  { name: 'Bend / Curve', purpose: 'Node bar ⌒ corner⇄smooth + tension', phosphor: IP(BezierCurve), untitled: IU(BezierCurve01), pika: NA, iconoir: NA, myna: NA, huge: NA, atlas: NA, solar: NA, lucide: IL(LSpline), tabler: IT(IconVectorBezier), note: 'Vector vocabulary — thin everywhere except Untitled/Tabler' },
  { name: 'Frame / Outline', purpose: 'Frame state, bounding grips', phosphor: IP(BoundingBox), untitled: IU(UScan), pika: NA, iconoir: I(IFrame), myna: IM(MBoundingBox), huge: huge(HFrame), atlas: NA, solar: IS(SScan), lucide: IL(LFrame), tabler: IT(IconFrame) },
  { name: 'Position', purpose: 'Drag photo inside outline (gesture mode)', phosphor: IP(ArrowsOutCardinal), untitled: IU(UMove), pika: NA, iconoir: I(Drag), myna: IM(MMove), huge: huge(HMove), atlas: IA(AMove), solar: NA, lucide: IL(LMove), tabler: IT(IconArrowsMove) },
  { name: 'Scale', purpose: '(dies in rebuild — frame owns it)', phosphor: IP(ArrowsOut), untitled: IU(Maximize02), pika: NA, iconoir: I(IMax), myna: IM(MMax), huge: huge(HExpand), atlas: NA, solar: IS(SMax), lucide: IL(LMax), tabler: IT(IconMaximize) },
  { name: 'Shape mode', purpose: 'Editor mode pill — sources', phosphor: IP(Shapes), untitled: NA, pika: NA, iconoir: NA, myna: NA, huge: huge(HShapes), atlas: IA(AShape), solar: NA, lucide: IL(LShapes), tabler: IT(IconCategory) },
  { name: 'Adjust / Tune ✦', purpose: 'Fine-tune takeover (Detail·Smooth·Snap)', phosphor: IP(Faders), untitled: IU(Sliders01), pika: I(PSettings), iconoir: I(ISettings), myna: NA, huge: huge(HSliders), atlas: IA(ASliders), solar: IS(STune), lucide: IL(LSliders), tabler: IT(IconAdjustments) },
  { name: 'Image mode', purpose: 'Pixel ops mode (crop-like)', phosphor: IP(Crop), untitled: IU(Crop01), pika: NA, iconoir: I(ICrop), myna: IM(MCrop), huge: huge(HCrop), atlas: IA(ACrop), solar: IS(SCrop), lucide: IL(LCrop), tabler: IT(IconCrop) },
  { name: 'Smooth', purpose: 'Fine-tune dial — path smoothing', phosphor: IP(WaveSine), untitled: IU(UActivity), pika: NA, iconoir: I(SineWave), myna: IM(MActivity), huge: huge(HWave), atlas: IA(AWave), solar: IS(SWave), lucide: IL(LWave), tabler: IT(IconWaveSine) },
  { name: 'Snap', purpose: 'Fine-tune dial — straighten/snap', phosphor: IP(Ruler), untitled: IU(URuler), pika: NA, iconoir: I(IRuler), myna: IM(MRuler), huge: huge(HRuler), atlas: IA(ARuler), solar: IS(SRuler), lucide: IL(LRuler), tabler: IT(IconRuler) },
  { name: 'Blend ✦', purpose: 'Image mode — soft background blend', phosphor: IP(Sparkle), untitled: IU(Star06), pika: NA, iconoir: I(Sparks), myna: IM(MSparkles), huge: huge(HSparkles), atlas: NA, solar: NA, lucide: IL(LSparkle), tabler: IT(IconSparkles) },
  { name: 'Brightness', purpose: 'Image dial', phosphor: IP(Sun), untitled: IU(USun), pika: NA, iconoir: I(SunLight), myna: IM(MSun), huge: huge(HSun), atlas: IA(ASun), solar: IS(SSun), lucide: IL(LSun), tabler: IT(IconSun) },
  { name: 'Contrast', purpose: 'Image dial', phosphor: IP(CircleHalf), untitled: IU(Contrast01), pika: NA, iconoir: I(HalfMoon), myna: IM(MCircleHalf), huge: huge(HContrast), atlas: NA, solar: NA, lucide: IL(LContrast), tabler: IT(IconContrast) },
  { name: 'Color / Saturation', purpose: 'Image dial', phosphor: IP(Drop), untitled: IU(Droplets01), pika: NA, iconoir: I(IDroplet), myna: IM(MDroplet), huge: huge(HDroplet), atlas: IA(ADrop), solar: IS(SDrop), lucide: IL(LDroplet), tabler: IT(IconDroplet) },
  { name: 'Warmth', purpose: 'Image dial', phosphor: IP(Thermometer), untitled: IU(Thermometer01), pika: NA, iconoir: I(TemperatureUp), myna: IM(MThermometer), huge: huge(HTemp), atlas: IA(AThermo), solar: IS(STemp), lucide: IL(LThermometer), tabler: IT(IconThermometer) },
  { name: 'Dice (reroll)', purpose: 'Blob generator reroll', phosphor: IP(DiceFive), untitled: IU(UDice), pika: NA, iconoir: I(IDice), myna: IM(MDice), huge: huge(HDice), atlas: NA, solar: NA, lucide: IL(LDice), tabler: IT(IconDice5) },
  { name: 'Min-line', purpose: '(dropped in rebuild)', phosphor: IP(LineSegment), untitled: IU(UMinus), pika: NA, iconoir: I(IMinus), myna: IM(MMinus), huge: huge(HLine), atlas: NA, solar: NA, lucide: IL(LMinus), tabler: IT(IconLine) },
  { name: 'Angle', purpose: '(dropped in rebuild)', phosphor: IP(Angle), untitled: IU(UTriangle), pika: NA, iconoir: I(AngleTool), myna: IM(MTriangle), huge: huge(HAngle), atlas: NA, solar: IS(SAngle), lucide: IL(LTriangleRight), tabler: IT(IconAngle) },
  // ── Shape chips ──
  { name: 'Square chip', purpose: 'Shape source — leads the row', phosphor: IP(Square), untitled: IU(USquare), pika: NA, iconoir: I(ISquare), myna: IM(MSquare), huge: huge(HSquare), atlas: IA(AStop), solar: IS(SStop), lucide: IL(LSquare), tabler: IT(IconSquare) },
  { name: 'Circle chip', purpose: 'Shape source', phosphor: IP(Circle), untitled: IU(UCircle), pika: NA, iconoir: I(ICircle), myna: IM(MCircle), huge: huge(HCircle), atlas: IA(ARecord), solar: IS(SRecord), lucide: IL(LCircle), tabler: IT(IconCircle) },
  { name: 'Pill chip', purpose: 'Shape source — THE brand primitive', phosphor: IP(Pill), untitled: NA, pika: NA, iconoir: NA, myna: NA, huge: huge(HPill), atlas: IA(APill), solar: IS(SPill), lucide: IL(LPill), tabler: IT(IconPill), note: 'Most sets read "pill" as medicine — custom candidate' },
  { name: 'Star chip', purpose: 'Shape source', phosphor: IP(Star), untitled: IU(UStar), pika: NA, iconoir: I(IStar), myna: IM(MStar), huge: huge(HStar), atlas: IA(AStar), solar: IS(SStar), lucide: IL(LStar), tabler: IT(IconStar) },
  { name: 'Heart chip', purpose: 'Shape source', phosphor: IP(Heart), untitled: IU(UHeart), pika: I(PHeart), iconoir: I(IHeart), myna: IM(MHeart), huge: huge(HHeart), atlas: IA(AHeart), solar: IS(SHeart), lucide: IL(LHeart), tabler: IT(IconHeart) },
  { name: 'Polygon chip', purpose: 'Shape source', phosphor: IP(Polygon), untitled: IU(UPentagon), pika: NA, iconoir: I(IPentagon), myna: IM(MHexagon), huge: huge(HHexagon), atlas: NA, solar: NA, lucide: IL(LPentagon), tabler: IT(IconPolygon) },
  { name: 'Speech chip', purpose: 'Shape source', phosphor: IP(ChatTeardrop), untitled: IU(MessageCircle01), pika: I(MessageDefault), iconoir: I(IMessage), myna: IM(MMessage), huge: huge(HChat), atlas: IA(AChat), solar: IS(SChat), lucide: IL(LMessage), tabler: IT(IconMessage) },
  { name: 'Badge chip', purpose: 'Shape source', phosphor: IP(Seal), untitled: IU(Certificate01), pika: NA, iconoir: I(BadgeCheck), myna: IM(MBadge), huge: huge(HSeal), atlas: IA(AMedal), solar: IS(SMedal), lucide: IL(LBadge), tabler: IT(IconRosette) },
  { name: 'Shield chip', purpose: 'Shape source', phosphor: IP(Shield), untitled: IU(Shield01), pika: I(ShieldShield), iconoir: I(IShield), myna: IM(MShield), huge: huge(HShield), atlas: NA, solar: IS(SShield), lucide: IL(LShield), tabler: IT(IconShield) },
]

const SETS: { key: keyof Row; label: string; sub: string }[] = [
  { key: 'phosphor', label: 'Phosphor', sub: 'CURRENT · light = 1.5px' },
  { key: 'untitled', label: 'Untitled UI', sub: 'OWNED · 2 → 1.5px' },
  { key: 'pika', label: 'Pikaicons', sub: 'free 100 · 1.5px class' },
  { key: 'iconoir', label: 'Iconoir', sub: 'MIT · 1.5px native' },
  { key: 'myna', label: 'MynaUI', sub: 'MIT · 1.5px native' },
  { key: 'huge', label: 'Hugeicons', sub: 'free · → 1.5px' },
  { key: 'atlas', label: 'Atlas', sub: 'MIT · 1.5px native' },
  { key: 'solar', label: 'Solar', sub: '⚠ CC BY · Linear 1.5px' },
  { key: 'lucide', label: 'Lucide', sub: 'MIT · 2 → 1.5px' },
  { key: 'tabler', label: 'Tabler', sub: 'MIT · 2 → 1.5px' },
]

function Matrix() {
  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', color: '#1a1a1a', padding: 16 }}>
      <style>{'.solar-sw path { stroke-width: 1.667 }'}</style>
      <h2 style={{ fontWeight: 600 }}>ONEMO icon matrix — v3 build icons × candidate sets</h2>
      <p style={{ maxWidth: 760, fontSize: 13, color: '#555' }}>
        Rows are the real icons in the v3 effect-creator (name + what it does). “—” = no usable
        equivalent in that set. Iconstica and Nucleo ship no code package (Figma/app only) and are
        evaluated separately. Custom inline glyphs in the build (squircle, blob, arch) are listed at
        the bottom — no library covers them.
      </p>
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>icon</th>
            <th style={{ ...th, minWidth: 150 }}>purpose</th>
            {SETS.map(s => (
              <th key={s.key as string} style={th}>
                {s.label}
                <div style={{ fontWeight: 400, color: '#888', fontSize: 10 }}>{s.sub}</div>
              </th>
            ))}
            <th style={th}>notes</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(r => (
            <tr key={r.name} style={{ borderTop: '1px solid #e5e5e5' }}>
              <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
              <td style={{ ...td, color: '#666' }}>{r.purpose}</td>
              {SETS.map(s => (
                <td key={s.key as string} style={{ ...td, textAlign: 'center' }}>
                  {(r[s.key] as React.ReactNode) ?? <span style={{ color: '#ccc' }}>—</span>}
                </td>
              ))}
              <td style={{ ...td, color: '#a06000', fontSize: 11, maxWidth: 160 }}>{r.note ?? ''}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #ccc' }}>
            <td style={{ ...td, fontWeight: 600 }}>Squircle · Blob · Arch chips</td>
            <td style={{ ...td, color: '#666' }}>Shape sources — custom inline SVG today</td>
            <td colSpan={SETS.length} style={{ ...td, textAlign: 'center', color: '#a06000' }}>
              no library ships these — stay custom (ONEMO mini-set) under every scenario
            </td>
            <td style={td}></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, verticalAlign: 'bottom' }
const td: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'middle' }

const meta: Meta<typeof Matrix> = { title: 'Icons/Icon Matrix', component: Matrix }
export default meta
export const AllSets: StoryObj<typeof Matrix> = {}
