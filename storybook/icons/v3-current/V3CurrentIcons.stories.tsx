/**
 * Effect Creator v3 - current build icon map.
 *
 * Source of truth read live from:
 * onemo-next/.claude/worktrees/s57-v3-layera
 * src/app/(dev)/effect-creator/v3/user/icons.tsx
 *
 * Shape chip paths were generated from the live ShapeChipIcon helpers in the
 * same worktree so this Storybook view matches the current 3006 build.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import React from 'react'
import {
  Angle,
  ArrowArcLeft,
  ArrowArcRight,
  ArrowCounterClockwise,
  BezierCurve,
  BoundingBox,
  Check,
  CircleHalf,
  CompassTool,
  CornersOut,
  Crop,
  DiceFive,
  DownloadSimple,
  Drop,
  Eye,
  EyeSlash,
  Faders,
  Gradient,
  ImageSquare,
  IntersectThree,
  LineSegment,
  MagicWand,
  Magnet,
  Minus,
  Palette,
  PencilSimple,
  Plus,
  PlusCircle,
  Shapes,
  Sparkle,
  Sun,
  Thermometer,
  Trash,
  VectorTwo,
  Waveform,
  WaveSine,
  X,
} from '@phosphor-icons/react'

type IconRow = {
  exportName: string
  glyphName: string
  label: string
  stateName: string
  usedIn: string
  icon: React.ReactNode
  status?: 'live' | 'exported-only'
  note?: string
}

type ShapeRow = {
  kind: string
  label: string
  d: string
}

const SZ = 24
const phosphor = (C: React.ElementType) => <C size={SZ} />

const CURRENT_ROWS: IconRow[] = [
  { exportName: 'UndoIcon', glyphName: 'ArrowArcLeft', label: 'Undo', stateName: 'globalUndo / editor undo', usedIn: 'Hero top bar + editor top bar', icon: phosphor(ArrowArcLeft) },
  { exportName: 'RedoIcon', glyphName: 'ArrowArcRight', label: 'Redo', stateName: 'globalRedo / editor redo', usedIn: 'Hero top bar + editor top bar', icon: phosphor(ArrowArcRight) },
  { exportName: 'ResetIcon', glyphName: 'ArrowCounterClockwise', label: 'Reset', stateName: 'dirty reset', usedIn: 'Centered top-bar reset, only when dirty', icon: phosphor(ArrowCounterClockwise) },
  { exportName: 'ExportIcon', glyphName: 'DownloadSimple', label: 'Export', stateName: 'internalTools export', usedIn: 'Hero top bar, internal-only', icon: phosphor(DownloadSimple) },
  { exportName: 'CloseIcon', glyphName: 'X', label: 'Close / Cancel trim', stateName: 'close editor / cancel trim', usedIn: 'Editor leading control + Trim carousel cancel', icon: phosphor(X) },
  { exportName: 'CheckIcon', glyphName: 'Check', label: 'Done', stateName: 'commit editor / commit trim', usedIn: 'Editor done + Trim carousel done', icon: phosphor(Check) },
  { exportName: 'PreviewIcon', glyphName: 'Eye', label: 'Preview', stateName: 'preview=false -> enter preview', usedIn: 'Editor top bar preview toggle', icon: phosphor(Eye) },
  { exportName: 'PreviewOffIcon', glyphName: 'EyeSlash', label: 'Edit', stateName: 'preview=true -> leave preview', usedIn: 'Editor top bar preview toggle', icon: phosphor(EyeSlash) },
  { exportName: 'PointsIcon', glyphName: 'VectorTwo', label: 'Points', stateName: 'showAnchors', usedIn: 'Editor top bar points toggle', icon: phosphor(VectorTwo) },

  { exportName: 'UploadIcon', glyphName: 'ImageSquare', label: 'Image', stateName: 'fileInputRef click', usedIn: 'Hero dock + empty-state upload ring', icon: phosphor(ImageSquare) },
  { exportName: 'MagicIcon', glyphName: 'MagicWand', label: 'Magic', stateName: 'auto cut / onMagic', usedIn: 'Hero dock, editor dock, generate shimmer', icon: phosphor(MagicWand) },
  { exportName: 'ColorsIcon', glyphName: 'Palette', label: 'Trim', stateName: 'showColors', usedIn: 'Hero dock material-color takeover', icon: phosphor(Palette) },
  { exportName: 'FiltersIcon', glyphName: 'IntersectThree', label: 'Filters', stateName: 'onFilters / image mode entry', usedIn: 'Hero dock photo-editing entry', icon: phosphor(IntersectThree) },
  { exportName: 'EditorIcon', glyphName: 'CompassTool', label: 'Editor', stateName: 'onEditor', usedIn: 'Hero dock editor entry', icon: phosphor(CompassTool) },

  { exportName: 'ShapeIcon', glyphName: 'Shapes', label: 'Shape', stateName: "activeAdjust === 'shape'", usedIn: 'Editor bottom dock', icon: phosphor(Shapes) },
  { exportName: 'TuneIcon', glyphName: 'Faders', label: 'Adjust', stateName: "activeAdjust === 'adjust'", usedIn: 'Editor bottom dock', icon: phosphor(Faders) },
  { exportName: 'OutlineIcon', glyphName: 'BoundingBox', label: 'Smooth / Sharpen', stateName: 'anchor corner toggle', usedIn: 'Node bar selected-anchor toggle', icon: phosphor(BoundingBox) },
  { exportName: 'AddPointIcon', glyphName: 'PlusCircle', label: 'Add point / Add point here', stateName: 'selected anchor or selected segment', usedIn: 'Node bar', icon: phosphor(PlusCircle) },
  { exportName: 'DeleteIcon', glyphName: 'Trash', label: 'Delete point', stateName: 'selected anchor delete', usedIn: 'Node bar', icon: phosphor(Trash) },

  { exportName: 'CornerIcon', glyphName: 'CornersOut', label: 'Radius / Corner', stateName: "adjustSub === 'radius'", usedIn: 'Adjust sheet chip', icon: phosphor(CornersOut) },
  { exportName: 'RoundIcon', glyphName: 'BezierCurve', label: 'Curve', stateName: "adjustSub === 'curve'", usedIn: 'Adjust sheet chip', icon: phosphor(BezierCurve) },
  { exportName: 'DetailIcon', glyphName: 'Waveform', label: 'Detail', stateName: "adjustSub === 'detail'", usedIn: 'Adjust sheet chip', icon: phosphor(Waveform) },
  { exportName: 'SmoothIcon', glyphName: 'WaveSine', label: 'Smooth', stateName: "adjustSub === 'smooth'", usedIn: 'Adjust sheet chip', icon: phosphor(WaveSine) },
  { exportName: 'SnapIcon', glyphName: 'Magnet', label: 'Snap', stateName: "adjustSub === 'snap'", usedIn: 'Adjust sheet chip', icon: phosphor(Magnet) },
  { exportName: 'AngleIcon', glyphName: 'Angle', label: 'Angle', stateName: "adjustSub === 'angle'", usedIn: 'Adjust sheet chip', icon: phosphor(Angle) },
  { exportName: 'LineIcon', glyphName: 'LineSegment', label: 'Line', stateName: "adjustSub === 'line'", usedIn: 'Adjust sheet chip', icon: phosphor(LineSegment) },

  { exportName: 'BrightnessIcon', glyphName: 'Sun', label: 'Bright', stateName: "imageSub === 'brightness'", usedIn: 'Image sheet chip', icon: phosphor(Sun) },
  { exportName: 'ContrastIcon', glyphName: 'CircleHalf', label: 'Contrast', stateName: "imageSub === 'contrast'", usedIn: 'Image sheet chip', icon: phosphor(CircleHalf) },
  { exportName: 'SaturationIcon', glyphName: 'Drop', label: 'Color', stateName: "imageSub === 'saturate'", usedIn: 'Image sheet chip', icon: phosphor(Drop) },
  { exportName: 'WarmthIcon', glyphName: 'Thermometer', label: 'Warmth', stateName: "imageSub === 'warmth'", usedIn: 'Image sheet chip', icon: phosphor(Thermometer) },
  { exportName: 'BlurIcon', glyphName: 'Gradient', label: 'Blend', stateName: "imageSub === 'blend'", usedIn: 'Image sheet chip; blend blur dial', icon: phosphor(Gradient), note: 'KAI-9030: Blend is represented by Gradient/blur, not Sparkle.' },

  { exportName: 'PlusIcon', glyphName: 'Plus', label: 'Upload / More sides / More points / More petals / More blades / More lobes', stateName: 'shape upload + param increment', usedIn: 'Shape sheet upload chip and plus steppers', icon: phosphor(Plus) },
  { exportName: 'MinusIcon', glyphName: 'Minus', label: 'Fewer sides / Fewer points / Fewer petals / Fewer blades / Fewer lobes', stateName: 'param decrement', usedIn: 'Shape sheet minus steppers', icon: phosphor(Minus) },
  { exportName: 'DiceIcon', glyphName: 'DiceFive', label: 'New blob', stateName: 'rerollBlob', usedIn: 'Shape sheet blob generator', icon: phosphor(DiceFive) },

  { exportName: 'EditIcon', glyphName: 'PencilSimple', label: 'Edit', stateName: 'export only', usedIn: 'Exported from icons.tsx but not referenced by current v3 code', icon: phosphor(PencilSimple), status: 'exported-only' },
  { exportName: 'BlendIcon', glyphName: 'Sparkle', label: 'Blend legacy', stateName: 'export only', usedIn: 'Exported from icons.tsx but not referenced by current v3 code', icon: phosphor(Sparkle), status: 'exported-only', note: 'Current live Blend chip uses BlurIcon / Gradient.' },
  { exportName: 'ImageToolIcon', glyphName: 'Crop', label: 'Image mode legacy', stateName: 'export only', usedIn: 'Exported from icons.tsx but not referenced by current v3 code', icon: phosphor(Crop), status: 'exported-only', note: 'Crop export exists in live source; image entry is now Filters / IntersectThree.' },
]

const SHAPE_ROWS: ShapeRow[] = [
  { kind: 'square', label: 'Square', d: 'M 3.6 3.6 L 22.4 3.6 L 22.4 22.4 L 3.6 22.4 Z' },
  { kind: 'circle', label: 'Circle', d: 'M 13.0 3.6 C 18.2 3.6 22.4 7.8 22.4 13.0 C 22.4 18.2 18.2 22.4 13.0 22.4 C 7.8 22.4 3.6 18.2 3.6 13.0 C 3.6 7.8 7.8 3.6 13.0 3.6 Z' },
  { kind: 'squircle', label: 'Squircle', d: 'M 22.4 13.0 C 22.4 13.7 22.4 14.3 22.4 15.0 C 22.4 15.5 22.4 15.9 22.3 16.4 C 22.3 17.9 22.3 20.1 21.1 21.2 C 19.8 22.4 17.3 22.3 15.7 22.4 C 15.1 22.4 14.5 22.4 13.9 22.4 C 12.6 22.4 11.3 22.4 10.1 22.4 C 9.2 22.3 8.4 22.3 7.6 22.2 C 7.0 22.2 6.5 22.1 5.9 21.9 C 4.3 21.2 3.9 19.6 3.7 18.0 C 3.7 17.2 3.6 16.4 3.6 15.6 C 3.6 14.7 3.6 13.9 3.6 13.0 C 3.6 12.3 3.6 11.7 3.6 11.0 C 3.6 10.5 3.6 10.1 3.7 9.6 C 3.7 8.1 3.7 6.1 4.7 5.0 C 6.0 3.6 8.7 3.7 10.3 3.6 C 10.9 3.6 11.5 3.6 12.1 3.6 C 13.4 3.6 14.7 3.6 16.0 3.6 C 16.9 3.7 17.8 3.7 18.8 3.8 C 19.4 3.9 20.0 4.1 20.5 4.4 C 22.3 5.4 22.3 7.9 22.3 9.7 C 22.4 10.1 22.4 10.5 22.4 11.0 C 22.4 11.7 22.4 12.3 22.4 13.0 Z' },
  { kind: 'polygon', label: 'Polygon', d: 'M 13.0 3.6 L 21.1 8.3 L 21.1 17.7 L 13.0 22.4 L 4.9 17.7 L 4.9 8.3 Z' },
  { kind: 'star', label: 'Star', d: 'M 13.0 3.6 L 15.5 9.6 L 21.9 10.1 L 17.0 14.3 L 18.5 20.6 L 13.0 17.2 L 7.5 20.6 L 9.0 14.3 L 4.1 10.1 L 10.5 9.6 Z' },
  { kind: 'heart', label: 'Heart', d: 'M 17.4 3.6 C 15.5 3.6 13.8 5.3 13.0 7.2 C 12.2 5.3 10.5 3.6 8.6 3.6 C 5.9 3.6 3.6 6.0 3.6 9.0 C 3.6 14.9 9.2 16.5 13.0 22.4 C 16.6 16.5 22.4 14.7 22.4 9.0 C 22.4 6.0 20.1 3.6 17.4 3.6 Z' },
  { kind: 'diamond', label: 'Diamond', d: 'M 13.0 3.6 L 20.3 13.0 L 13.0 22.4 L 5.7 13.0 Z' },
  { kind: 'plus', label: 'Plus', d: 'M 9.6 3.6 L 16.4 3.6 L 16.4 9.6 L 22.4 9.6 L 22.4 16.4 L 16.4 16.4 L 16.4 22.4 L 9.6 22.4 L 9.6 16.4 L 3.6 16.4 L 3.6 9.6 L 9.6 9.6 Z' },
  { kind: 'teardrop', label: 'Drop', d: 'M 13.0 3.6 C 13.0 4.1 13.2 4.7 13.3 5.1 C 13.6 6.0 14.0 7.0 14.4 7.9 C 15.3 9.7 16.2 11.5 16.9 13.5 C 17.4 14.7 17.8 16.0 17.9 17.4 C 17.9 17.9 17.8 18.4 17.8 18.8 C 17.2 21.7 14.3 22.6 12.3 22.3 C 11.9 22.3 11.5 22.2 11.1 22.0 C 9.8 21.6 8.7 20.6 8.3 19.0 C 7.9 17.6 8.2 16.0 8.7 14.6 C 9.5 12.0 10.8 9.8 11.8 7.3 C 12.2 6.5 12.5 5.7 12.7 4.9 C 12.9 4.5 13.0 4.1 13.0 3.6 Z' },
  { kind: 'leaf', label: 'Leaf', d: 'M 3.6 3.6 L 15.6 3.6 C 19.3 3.6 22.4 6.7 22.4 10.4 L 22.4 15.6 C 22.4 19.3 19.3 22.4 15.6 22.4 L 10.4 22.4 C 6.7 22.4 3.6 19.3 3.6 15.6 Z' },
  { kind: 'lens', label: 'Lens', d: 'M 3.6 13.0 C 5.6 10.9 9.1 9.6 13.0 9.6 C 16.9 9.6 20.4 10.9 22.4 13.0 C 20.4 15.1 16.9 16.4 13.0 16.4 C 9.1 16.4 5.6 15.1 3.6 13.0 Z' },
  { kind: 'bolt', label: 'Bolt', d: 'M 11.9 3.6 L 17.7 3.6 L 14.5 10.9 L 17.9 10.9 L 9.8 22.4 L 12.3 13.9 L 8.3 13.9 Z' },
  { kind: 'sparkle', label: 'Sparkle', d: 'M 22.4 13.0 C 22.1 13.0 21.9 13.1 21.7 13.1 C 20.9 13.3 20.2 13.6 19.6 13.9 C 17.3 15.1 15.3 17.0 14.1 19.2 C 13.7 20.0 13.3 20.8 13.1 21.6 C 13.1 21.9 13.0 22.1 13.0 22.4 C 13.0 22.1 12.9 21.9 12.9 21.7 C 12.7 20.9 12.4 20.2 12.1 19.6 C 10.9 17.3 9.0 15.3 6.8 14.1 C 6.0 13.7 5.2 13.3 4.4 13.1 C 4.1 13.1 3.9 13.0 3.6 13.0 C 3.9 13.0 4.1 12.9 4.3 12.9 C 5.1 12.7 5.8 12.4 6.4 12.1 C 8.7 10.9 10.7 9.0 11.9 6.8 C 12.3 6.0 12.7 5.2 12.9 4.4 C 12.9 4.1 13.0 3.9 13.0 3.6 C 13.0 3.9 13.1 4.1 13.1 4.4 C 13.3 5.2 13.7 6.0 14.1 6.8 C 15.3 9.0 17.3 10.9 19.6 12.1 C 20.2 12.4 20.9 12.7 21.7 12.9 C 21.9 12.9 22.1 13.0 22.4 13.0 Z' },
  { kind: 'asterisk', label: 'Asterisk', d: 'M 15.8 14.6 C 16.1 14.9 16.4 15.2 16.7 15.5 C 17.6 16.6 18.4 18.0 18.4 19.4 C 18.5 20.4 17.9 21.4 16.8 21.3 C 16.6 21.2 16.4 21.2 16.2 21.1 C 15.2 20.7 14.5 19.8 14.0 18.9 C 13.7 18.3 13.4 17.7 13.2 17.0 C 13.1 16.7 13.1 16.5 13.0 16.2 C 12.9 16.5 12.9 16.7 12.8 17.0 C 12.6 17.7 12.3 18.3 12.0 18.9 C 11.5 19.8 10.8 20.7 9.8 21.1 C 9.6 21.2 9.4 21.2 9.2 21.3 C 8.1 21.4 7.5 20.4 7.6 19.4 C 7.6 18.0 8.4 16.6 9.3 15.5 C 9.6 15.2 9.9 14.9 10.2 14.6 C 10.2 14.6 10.0 14.7 9.9 14.7 C 9.6 14.8 9.3 14.8 9.1 14.9 C 8.2 15.1 7.4 15.1 6.6 15.0 C 6.3 15.0 6.1 15.0 5.8 14.9 C 5.4 14.8 5.0 14.7 4.6 14.4 C 3.9 14.0 3.3 13.1 3.8 12.3 C 4.0 12.1 4.1 11.9 4.3 11.8 C 4.5 11.6 4.8 11.4 5.1 11.3 C 6.2 10.9 7.5 10.8 8.7 11.0 C 9.0 11.1 9.4 11.2 9.8 11.3 C 9.9 11.3 10.2 11.4 10.2 11.4 C 9.9 11.1 9.6 10.8 9.3 10.5 C 8.4 9.4 7.6 8.0 7.6 6.6 C 7.5 5.6 8.1 4.6 9.2 4.7 C 9.4 4.8 9.6 4.8 9.8 4.9 C 10.8 5.3 11.5 6.2 12.0 7.1 C 12.3 7.7 12.6 8.3 12.8 9.0 C 12.9 9.3 12.9 9.5 13.0 9.8 C 13.1 9.5 13.1 9.3 13.2 9.0 C 13.4 8.3 13.7 7.7 14.0 7.1 C 14.5 6.2 15.2 5.3 16.2 4.9 C 16.4 4.8 16.6 4.8 16.8 4.7 C 17.9 4.6 18.5 5.6 18.4 6.6 C 18.4 8.0 17.6 9.4 16.7 10.5 C 16.4 10.8 16.1 11.1 15.8 11.4 C 15.8 11.4 16.1 11.3 16.2 11.3 C 16.6 11.2 17.0 11.1 17.3 11.0 C 18.5 10.8 19.8 10.9 20.9 11.3 C 21.2 11.4 21.5 11.6 21.7 11.8 C 21.9 11.9 22.0 12.1 22.2 12.3 C 22.7 13.1 22.1 14.0 21.4 14.4 C 21.0 14.7 20.6 14.8 20.2 14.9 C 19.9 15.0 19.7 15.0 19.4 15.0 C 18.6 15.1 17.8 15.1 16.9 14.9 C 16.7 14.8 16.4 14.8 16.1 14.7 C 16.0 14.7 15.8 14.6 15.8 14.6 Z' },
  { kind: 'bowtie', label: 'Bowtie', d: 'M 22.4 13.0 C 22.4 13.7 22.1 14.4 21.7 15.0 C 20.5 16.8 17.9 17.4 15.6 16.9 C 15.0 16.7 14.4 16.5 13.8 16.1 C 13.6 16.0 13.4 15.8 13.2 15.7 C 13.2 15.7 13.1 15.6 13.0 15.6 C 12.9 15.6 12.8 15.7 12.8 15.7 C 12.6 15.8 12.4 16.0 12.2 16.1 C 11.6 16.5 11.0 16.7 10.4 16.9 C 8.1 17.4 5.5 16.8 4.3 15.0 C 3.9 14.4 3.6 13.7 3.6 13.0 C 3.6 12.3 3.9 11.6 4.3 11.0 C 5.5 9.2 8.1 8.6 10.4 9.1 C 11.0 9.3 11.6 9.5 12.2 9.9 C 12.4 10.0 12.6 10.2 12.8 10.3 C 12.8 10.3 12.9 10.4 13.0 10.4 C 13.1 10.4 13.2 10.3 13.2 10.3 C 13.4 10.2 13.6 10.0 13.8 9.9 C 14.4 9.5 15.0 9.3 15.6 9.1 C 17.9 8.6 20.5 9.2 21.7 11.0 C 22.1 11.6 22.4 12.3 22.4 13.0 Z' },
  { kind: 'pinched', label: 'Pinched', d: 'M 13.0 20.6 C 12.9 20.9 12.6 21.2 12.3 21.4 C 11.7 21.9 10.8 22.2 10.0 22.3 C 7.0 22.7 4.1 20.6 3.7 17.5 C 3.5 16.3 3.8 15.0 4.4 14.0 C 4.6 13.6 5.0 13.2 5.4 13.0 C 5.1 12.9 4.8 12.6 4.6 12.3 C 4.1 11.7 3.8 10.8 3.7 10.0 C 3.3 7.0 5.4 4.1 8.5 3.7 C 9.7 3.5 11.0 3.8 12.0 4.4 C 12.4 4.6 12.8 5.0 13.0 5.4 C 13.1 5.1 13.4 4.8 13.7 4.6 C 14.3 4.1 15.2 3.8 16.0 3.7 C 19.0 3.3 21.9 5.4 22.3 8.5 C 22.5 9.7 22.2 11.0 21.6 12.0 C 21.4 12.4 21.0 12.8 20.6 13.0 C 21.0 13.2 21.4 13.6 21.6 14.0 C 22.2 15.0 22.5 16.3 22.3 17.5 C 21.9 20.6 19.0 22.7 16.0 22.3 C 15.2 22.2 14.3 21.9 13.7 21.4 C 13.4 21.2 13.1 20.9 13.0 20.6 Z' },
  { kind: 'daisy', label: 'Daisy ✦', d: 'M 22.1 13.0 L 22.0 13.4 L 21.7 13.7 L 21.3 14.0 L 20.7 14.2 L 20.1 14.4 L 19.5 14.6 L 18.9 14.7 L 18.5 14.8 L 18.2 14.9 L 18.0 15.1 L 18.0 15.3 L 18.1 15.6 L 18.4 16.0 L 18.7 16.5 L 19.0 17.0 L 19.3 17.6 L 19.5 18.2 L 19.7 18.7 L 19.6 19.1 L 19.4 19.4 L 19.1 19.6 L 18.7 19.7 L 18.2 19.5 L 17.6 19.3 L 17.0 19.0 L 16.5 18.7 L 16.0 18.4 L 15.6 18.1 L 15.3 18.0 L 15.1 18.0 L 14.9 18.2 L 14.8 18.5 L 14.7 18.9 L 14.6 19.5 L 14.4 20.1 L 14.2 20.7 L 14.0 21.3 L 13.7 21.7 L 13.4 22.0 L 13.0 22.1 L 12.6 22.0 L 12.3 21.7 L 12.0 21.3 L 11.8 20.7 L 11.6 20.1 L 11.4 19.5 L 11.3 18.9 L 11.2 18.5 L 11.1 18.2 L 10.9 18.0 L 10.7 18.0 L 10.4 18.1 L 10.0 18.4 L 9.5 18.7 L 9.0 19.0 L 8.4 19.3 L 7.8 19.5 L 7.3 19.7 L 6.9 19.6 L 6.6 19.4 L 6.4 19.1 L 6.3 18.7 L 6.5 18.2 L 6.7 17.6 L 7.0 17.0 L 7.3 16.5 L 7.6 16.0 L 7.9 15.6 L 8.0 15.3 L 8.0 15.1 L 7.8 14.9 L 7.5 14.8 L 7.1 14.7 L 6.5 14.6 L 5.9 14.4 L 5.3 14.2 L 4.7 14.0 L 4.3 13.7 L 4.0 13.4 L 3.9 13.0 L 4.0 12.6 L 4.3 12.3 L 4.7 12.0 L 5.3 11.8 L 5.9 11.6 L 6.5 11.4 L 7.1 11.3 L 7.5 11.2 L 7.8 11.1 L 8.0 10.9 L 8.0 10.7 L 7.9 10.4 L 7.6 10.0 L 7.3 9.5 L 7.0 9.0 L 6.7 8.4 L 6.5 7.8 L 6.3 7.3 L 6.4 6.9 L 6.6 6.6 L 6.9 6.4 L 7.3 6.3 L 7.8 6.5 L 8.4 6.7 L 9.0 7.0 L 9.5 7.3 L 10.0 7.6 L 10.4 7.9 L 10.7 8.0 L 10.9 8.0 L 11.1 7.8 L 11.2 7.5 L 11.3 7.1 L 11.4 6.5 L 11.6 5.9 L 11.8 5.3 L 12.0 4.7 L 12.3 4.3 L 12.6 4.0 L 13.0 3.9 L 13.4 4.0 L 13.7 4.3 L 14.0 4.7 L 14.2 5.3 L 14.4 5.9 L 14.6 6.5 L 14.7 7.1 L 14.8 7.5 L 14.9 7.8 L 15.1 8.0 L 15.3 8.0 L 15.6 7.9 L 16.0 7.6 L 16.5 7.3 L 17.0 7.0 L 17.6 6.7 L 18.2 6.5 L 18.7 6.3 L 19.1 6.4 L 19.4 6.6 L 19.6 6.9 L 19.7 7.3 L 19.5 7.8 L 19.3 8.4 L 19.0 9.0 L 18.7 9.5 L 18.4 10.0 L 18.1 10.4 L 18.0 10.7 L 18.0 10.9 L 18.2 11.1 L 18.5 11.2 L 18.9 11.3 L 19.5 11.4 L 20.1 11.6 L 20.7 11.8 L 21.3 12.0 L 21.7 12.3 L 22.0 12.6 Z' },
  { kind: 'pinwheel', label: 'Pinwheel ✦', d: 'M 21.8 13.0 L 21.8 13.3 L 21.6 13.8 L 21.4 14.3 L 21.1 14.8 L 20.6 15.3 L 20.1 15.8 L 19.4 16.3 L 18.7 16.7 L 18.0 17.0 L 17.3 17.2 L 16.6 17.3 L 15.9 17.3 L 15.3 17.2 L 14.8 17.2 L 14.3 17.0 L 13.9 16.9 L 13.7 16.8 L 13.4 16.8 L 13.3 16.7 L 13.2 16.8 L 13.1 16.9 L 13.1 17.1 L 13.1 17.3 L 13.2 17.6 L 13.3 17.9 L 13.5 18.3 L 13.7 18.7 L 13.9 19.1 L 14.2 19.5 L 14.5 19.9 L 14.8 20.3 L 15.1 20.6 L 15.3 20.9 L 15.5 21.2 L 15.6 21.4 L 15.6 21.7 L 15.6 21.8 L 15.4 22.0 L 15.1 22.1 L 14.6 22.1 L 14.1 22.1 L 13.5 21.9 L 12.9 21.7 L 12.3 21.4 L 11.6 21.0 L 11.0 20.5 L 10.5 19.9 L 10.0 19.3 L 9.7 18.6 L 9.4 18.0 L 9.2 17.4 L 9.1 16.8 L 9.1 16.3 L 9.1 15.9 L 9.1 15.6 L 9.1 15.3 L 9.0 15.1 L 9.0 15.0 L 8.9 14.9 L 8.7 15.0 L 8.5 15.0 L 8.3 15.2 L 8.0 15.4 L 7.7 15.6 L 7.4 15.9 L 7.1 16.3 L 6.8 16.6 L 6.5 17.0 L 6.3 17.4 L 6.0 17.8 L 5.8 18.2 L 5.6 18.5 L 5.4 18.7 L 5.2 18.8 L 5.0 18.8 L 4.8 18.7 L 4.6 18.5 L 4.4 18.2 L 4.3 17.7 L 4.2 17.2 L 4.2 16.5 L 4.2 15.8 L 4.4 15.1 L 4.7 14.3 L 5.0 13.6 L 5.4 13.0 L 5.9 12.4 L 6.4 11.9 L 7.0 11.5 L 7.5 11.2 L 8.0 11.0 L 8.4 10.9 L 8.7 10.7 L 9.0 10.7 L 9.2 10.6 L 9.3 10.5 L 9.4 10.4 L 9.4 10.2 L 9.2 10.1 L 9.1 9.9 L 8.8 9.7 L 8.5 9.5 L 8.2 9.3 L 7.8 9.1 L 7.3 8.9 L 6.9 8.8 L 6.4 8.7 L 5.9 8.5 L 5.5 8.4 L 5.1 8.3 L 4.8 8.2 L 4.6 8.0 L 4.5 7.9 L 4.5 7.7 L 4.6 7.4 L 4.8 7.2 L 5.1 6.9 L 5.6 6.7 L 6.2 6.4 L 6.8 6.2 L 7.6 6.1 L 8.3 6.1 L 9.1 6.2 L 9.9 6.3 L 10.6 6.6 L 11.3 6.9 L 11.8 7.3 L 12.3 7.7 L 12.7 8.1 L 13.0 8.5 L 13.3 8.8 L 13.4 9.0 L 13.6 9.2 L 13.7 9.4 L 13.8 9.4 L 14.0 9.4 L 14.1 9.2 L 14.2 9.0 L 14.3 8.8 L 14.4 8.5 L 14.5 8.1 L 14.6 7.6 L 14.6 7.2 L 14.6 6.7 L 14.6 6.2 L 14.6 5.7 L 14.6 5.3 L 14.5 4.9 L 14.5 4.5 L 14.6 4.2 L 14.7 4.0 L 14.9 3.9 L 15.1 3.9 L 15.4 4.0 L 15.7 4.2 L 16.1 4.5 L 16.5 4.9 L 16.9 5.4 L 17.2 6.1 L 17.5 6.8 L 17.7 7.5 L 17.9 8.3 L 17.9 9.1 L 17.8 9.8 L 17.6 10.5 L 17.4 11.1 L 17.2 11.7 L 16.9 12.1 L 16.7 12.5 L 16.5 12.7 L 16.3 13.0 L 16.2 13.1 L 16.2 13.3 L 16.2 13.4 L 16.3 13.5 L 16.5 13.5 L 16.8 13.6 L 17.1 13.6 L 17.5 13.5 L 17.9 13.5 L 18.4 13.4 L 18.8 13.3 L 19.3 13.1 L 19.7 13.0 L 20.2 12.8 L 20.6 12.6 L 20.9 12.5 L 21.2 12.5 L 21.5 12.5 L 21.7 12.5 L 21.8 12.7 Z' },
  { kind: 'form', label: 'Form ✦', d: 'M 22.1 13.0 L 22.1 13.2 L 22.1 13.4 L 22.1 13.7 L 22.0 13.9 L 22.0 14.1 L 21.9 14.3 L 21.8 14.5 L 21.8 14.7 L 21.7 15.0 L 21.6 15.2 L 21.5 15.3 L 21.4 15.5 L 21.3 15.7 L 21.1 15.9 L 21.0 16.1 L 20.8 16.2 L 20.7 16.4 L 20.5 16.6 L 20.4 16.7 L 20.2 16.8 L 20.0 17.0 L 19.8 17.1 L 19.6 17.2 L 19.4 17.3 L 19.2 17.4 L 19.0 17.5 L 18.8 17.6 L 18.6 17.6 L 18.4 17.7 L 18.2 17.7 L 18.0 17.8 L 17.9 17.9 L 17.8 18.0 L 17.7 18.2 L 17.7 18.4 L 17.6 18.6 L 17.6 18.8 L 17.5 19.0 L 17.4 19.2 L 17.3 19.4 L 17.2 19.6 L 17.1 19.8 L 17.0 20.0 L 16.8 20.2 L 16.7 20.4 L 16.6 20.5 L 16.4 20.7 L 16.2 20.8 L 16.1 21.0 L 15.9 21.1 L 15.7 21.3 L 15.5 21.4 L 15.3 21.5 L 15.2 21.6 L 15.0 21.7 L 14.7 21.8 L 14.5 21.8 L 14.3 21.9 L 14.1 22.0 L 13.9 22.0 L 13.7 22.1 L 13.4 22.1 L 13.2 22.1 L 13.0 22.1 L 12.8 22.1 L 12.6 22.1 L 12.3 22.1 L 12.1 22.0 L 11.9 22.0 L 11.7 21.9 L 11.5 21.8 L 11.3 21.8 L 11.0 21.7 L 10.8 21.6 L 10.7 21.5 L 10.5 21.4 L 10.3 21.3 L 10.1 21.1 L 9.9 21.0 L 9.8 20.8 L 9.6 20.7 L 9.4 20.5 L 9.3 20.4 L 9.2 20.2 L 9.0 20.0 L 8.9 19.8 L 8.8 19.6 L 8.7 19.4 L 8.6 19.2 L 8.5 19.0 L 8.4 18.8 L 8.4 18.6 L 8.3 18.4 L 8.3 18.2 L 8.2 18.0 L 8.1 17.9 L 8.0 17.8 L 7.8 17.7 L 7.6 17.7 L 7.4 17.6 L 7.2 17.6 L 7.0 17.5 L 6.8 17.4 L 6.6 17.3 L 6.4 17.2 L 6.2 17.1 L 6.0 17.0 L 5.8 16.8 L 5.6 16.7 L 5.5 16.6 L 5.3 16.4 L 5.2 16.2 L 5.0 16.1 L 4.9 15.9 L 4.7 15.7 L 4.6 15.5 L 4.5 15.3 L 4.4 15.2 L 4.3 15.0 L 4.2 14.7 L 4.2 14.5 L 4.1 14.3 L 4.0 14.1 L 4.0 13.9 L 3.9 13.7 L 3.9 13.4 L 3.9 13.2 L 3.9 13.0 L 3.9 12.8 L 3.9 12.6 L 3.9 12.3 L 4.0 12.1 L 4.0 11.9 L 4.1 11.7 L 4.2 11.5 L 4.2 11.3 L 4.3 11.0 L 4.4 10.8 L 4.5 10.7 L 4.6 10.5 L 4.7 10.3 L 4.9 10.1 L 5.0 9.9 L 5.2 9.8 L 5.3 9.6 L 5.5 9.4 L 5.6 9.3 L 5.8 9.2 L 6.0 9.0 L 6.2 8.9 L 6.4 8.8 L 6.6 8.7 L 6.8 8.6 L 7.0 8.5 L 7.2 8.4 L 7.4 8.4 L 7.6 8.3 L 7.8 8.3 L 8.0 8.2 L 8.1 8.1 L 8.2 8.0 L 8.3 7.8 L 8.3 7.6 L 8.4 7.4 L 8.4 7.2 L 8.5 7.0 L 8.6 6.8 L 8.7 6.6 L 8.8 6.4 L 8.9 6.2 L 9.0 6.0 L 9.2 5.8 L 9.3 5.6 L 9.4 5.5 L 9.6 5.3 L 9.8 5.2 L 9.9 5.0 L 10.1 4.9 L 10.3 4.7 L 10.5 4.6 L 10.7 4.5 L 10.8 4.4 L 11.0 4.3 L 11.3 4.2 L 11.5 4.2 L 11.7 4.1 L 11.9 4.0 L 12.1 4.0 L 12.3 3.9 L 12.6 3.9 L 12.8 3.9 L 13.0 3.9 L 13.2 3.9 L 13.4 3.9 L 13.7 3.9 L 13.9 4.0 L 14.1 4.0 L 14.3 4.1 L 14.5 4.2 L 14.7 4.2 L 15.0 4.3 L 15.2 4.4 L 15.3 4.5 L 15.5 4.6 L 15.7 4.7 L 15.9 4.9 L 16.1 5.0 L 16.2 5.2 L 16.4 5.3 L 16.6 5.5 L 16.7 5.6 L 16.8 5.8 L 17.0 6.0 L 17.1 6.2 L 17.2 6.4 L 17.3 6.6 L 17.4 6.8 L 17.5 7.0 L 17.6 7.2 L 17.6 7.4 L 17.7 7.6 L 17.7 7.8 L 17.8 8.0 L 17.9 8.1 L 18.0 8.2 L 18.2 8.3 L 18.4 8.3 L 18.6 8.4 L 18.8 8.4 L 19.0 8.5 L 19.2 8.6 L 19.4 8.7 L 19.6 8.8 L 19.8 8.9 L 20.0 9.0 L 20.2 9.2 L 20.4 9.3 L 20.5 9.4 L 20.7 9.6 L 20.8 9.8 L 21.0 9.9 L 21.1 10.1 L 21.3 10.3 L 21.4 10.5 L 21.5 10.7 L 21.6 10.8 L 21.7 11.0 L 21.8 11.3 L 21.8 11.5 L 21.9 11.7 L 22.0 11.9 L 22.0 12.1 L 22.1 12.3 L 22.1 12.6 L 22.1 12.8 Z' },
  { kind: 'blob', label: 'Blob ✦', d: 'M 21.5 13.2 L 21.7 13.8 L 21.8 14.4 L 21.8 15.0 L 21.7 15.6 L 21.5 16.2 L 21.3 16.8 L 21.1 17.4 L 20.8 18.0 L 20.5 18.5 L 20.2 19.0 L 19.8 19.6 L 19.5 20.1 L 19.0 20.6 L 18.6 21.1 L 18.0 21.5 L 17.5 21.8 L 16.9 22.0 L 16.2 22.1 L 15.5 22.1 L 14.9 22.0 L 14.2 21.8 L 13.6 21.5 L 13.0 21.1 L 12.5 20.7 L 12.0 20.4 L 11.6 20.1 L 11.2 19.8 L 10.8 19.6 L 10.4 19.4 L 9.9 19.4 L 9.5 19.3 L 9.0 19.3 L 8.4 19.3 L 7.8 19.3 L 7.3 19.2 L 6.7 19.0 L 6.2 18.7 L 5.7 18.4 L 5.3 18.0 L 5.0 17.5 L 4.8 17.0 L 4.7 16.4 L 4.7 15.8 L 4.6 15.3 L 4.6 14.7 L 4.6 14.2 L 4.6 13.7 L 4.6 13.2 L 4.5 12.6 L 4.4 12.1 L 4.3 11.5 L 4.3 11.0 L 4.2 10.4 L 4.2 9.7 L 4.3 9.1 L 4.4 8.5 L 4.7 7.9 L 5.0 7.4 L 5.4 6.9 L 5.9 6.5 L 6.4 6.2 L 6.9 5.9 L 7.5 5.7 L 8.0 5.4 L 8.6 5.2 L 9.1 5.0 L 9.7 4.8 L 10.2 4.6 L 10.8 4.4 L 11.3 4.2 L 11.9 4.0 L 12.5 3.9 L 13.1 3.9 L 13.7 4.0 L 14.3 4.2 L 14.8 4.5 L 15.3 4.9 L 15.8 5.3 L 16.1 5.9 L 16.4 6.5 L 16.6 7.1 L 16.7 7.7 L 16.8 8.2 L 17.0 8.7 L 17.1 9.1 L 17.3 9.5 L 17.6 9.8 L 17.9 10.0 L 18.3 10.3 L 18.8 10.6 L 19.3 10.9 L 19.8 11.2 L 20.3 11.6 L 20.8 12.1 L 21.2 12.6 Z' },
]

function V3CurrentIcons() {
  return (
    <div style={page}>
      <header style={header}>
        <p style={eyebrow}>Effect Creator v3 / current 3006 build</p>
        <h1 style={title}>Current Icon Map</h1>
        <p style={intro}>
          Exact export-name to glyph-name map from the live v3 build. This is the canonical
          current-state sheet before brand-specific replacement work.
        </p>
      </header>

      <section style={section}>
        <h2 style={sectionTitle}>Phosphor exports from user/icons.tsx</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Icon</th>
              <th style={th}>Export</th>
              <th style={th}>Live glyph</th>
              <th style={th}>UI label</th>
              <th style={th}>State name</th>
              <th style={th}>Used in</th>
              <th style={th}>Note</th>
            </tr>
          </thead>
          <tbody>
            {CURRENT_ROWS.map((row) => (
              <tr key={row.exportName} style={row.status === 'exported-only' ? mutedRow : undefined}>
                <td style={{ ...td, textAlign: 'center' }}><span style={iconBox}>{row.icon}</span></td>
                <td style={{ ...td, fontWeight: 700 }}>{row.exportName}</td>
                <td style={td}>{row.glyphName}</td>
                <td style={td}>{row.label}</td>
                <td style={monoTd}>{row.stateName}</td>
                <td style={td}>{row.usedIn}</td>
                <td style={{ ...td, color: row.note ? '#925800' : '#8a8a8a' }}>{row.note ?? (row.status === 'exported-only' ? 'Exported, not live-referenced.' : '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Inline shape-source glyphs from ShapeChipIcon</h2>
        <p style={caption}>
          These are not library icons. Each chip renders from the same current shape geometry as the editor.
        </p>
        <div style={shapeGrid}>
          {SHAPE_ROWS.map((shape) => (
            <div key={shape.kind} style={shapeCard}>
              <svg width={32} height={32} viewBox="0 0 26 26" aria-hidden>
                <path d={shape.d} fill="currentColor" fillRule="evenodd" />
              </svg>
              <strong>{shape.label}</strong>
              <span style={monoSmall}>{shape.kind}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const page: React.CSSProperties = {
  background: '#f5f1e9',
  color: '#1b1a18',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  minHeight: '100vh',
  padding: 24,
}

const header: React.CSSProperties = { maxWidth: 980, marginBottom: 24 }
const eyebrow: React.CSSProperties = { color: '#827568', fontSize: 12, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }
const title: React.CSSProperties = { fontSize: 40, lineHeight: 1.05, margin: '8px 0 10px', letterSpacing: '-0.04em' }
const intro: React.CSSProperties = { color: '#5d554d', fontSize: 15, lineHeight: 1.45, margin: 0, maxWidth: 720 }
const section: React.CSSProperties = { background: '#fffaf2', border: '1px solid #ded4c4', borderRadius: 18, marginBottom: 20, padding: 18 }
const sectionTitle: React.CSSProperties = { fontSize: 18, margin: '0 0 12px', letterSpacing: '-0.02em' }
const caption: React.CSSProperties = { color: '#6a6259', fontSize: 13, margin: '0 0 14px' }
const table: React.CSSProperties = { borderCollapse: 'collapse', fontSize: 12, width: '100%' }
const th: React.CSSProperties = { borderBottom: '1px solid #d8cdbb', color: '#6a6259', fontSize: 11, padding: '8px 10px', textAlign: 'left', textTransform: 'uppercase' }
const td: React.CSSProperties = { borderTop: '1px solid #eee5d8', padding: '8px 10px', verticalAlign: 'middle' }
const monoTd: React.CSSProperties = { ...td, color: '#514b45', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }
const iconBox: React.CSSProperties = { alignItems: 'center', display: 'inline-flex', height: 32, justifyContent: 'center', width: 32 }
const mutedRow: React.CSSProperties = { color: '#7d776f', opacity: 0.68 }
const shapeGrid: React.CSSProperties = { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }
const shapeCard: React.CSSProperties = {
  alignItems: 'center',
  background: '#1b1a18',
  borderRadius: 14,
  color: '#f7f1e7',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 92,
  padding: 12,
}
const monoSmall: React.CSSProperties = { color: '#c6baaa', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10 }

const meta: Meta<typeof V3CurrentIcons> = { title: 'Icons/V3 Current/Icon Map', component: V3CurrentIcons }
export default meta
export const CurrentBuild: StoryObj<typeof V3CurrentIcons> = {}
