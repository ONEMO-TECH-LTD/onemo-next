/**
 * Design System / Variables Panel
 *
 * A Figma-Variables-panel analogue + editor over ONEMO's real token export.
 * The data is read DYNAMICALLY from the actual artifacts JSON
 * (DS-V2.1--22-JUNE-2026.json — the same file the scan-driven converter
 * consumes). Nothing is hardcoded: change the export and the panel reflects it.
 *
 * Editing persists back to that source via the `/__variables-save` dev endpoint
 * under `npm run storybook`; the static build offers "Download JSON" instead.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { VariablesPanel } from './VariablesPanel'
import type { RawExport } from './resolver'
import figmaExport from './figma-export.json'

const meta = {
  title: 'Design System/Variables/Panel',
  component: VariablesPanel,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof VariablesPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // tsc reads the JSON's exact literal type (under bundler resolveJsonModule),
    // so `$type` widens to `string`; cast through `unknown` to our token model.
    data: figmaExport as unknown as RawExport,
  },
}
