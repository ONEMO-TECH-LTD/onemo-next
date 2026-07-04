/**
 * react-figma canvas host — mounts a build screen 1:1 for the editor iframe.
 * Same-origin by design: tagging, read-bridge, overrides and writes all work.
 * Currently hosts Editor402 — the apple-blur-glass screen (verbatim replica of
 * Figma 4084:25997, every dimension bound to live v2.3 tokens).
 */
import { Editor402 } from '../../../../../storybook/prototypes/create-studio/Editor402'

export default function CanvasHost() {
  return (
    <div style={{ width: 402, height: 871, overflow: 'hidden' }}>
      <Editor402 />
    </div>
  )
}
