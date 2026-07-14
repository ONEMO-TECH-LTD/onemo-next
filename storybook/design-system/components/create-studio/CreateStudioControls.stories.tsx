/**
 * Create Studio · Controls — the first components factored from the golden Shape
 * (Figma v2.3.2, fresh live conversion). Token contracts verbatim; anatomy documented per story.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { ButtonRound, SpecPill, PillDone, Tab } from './Controls';
import { IconUndo, IconRedo, IconRotate } from './icons';

const meta: Meta = {
  title: 'Design System/Components/Create Studio/Controls',
  parameters: {
    docs: {
      description: {
        component:
          'Hand-authored to the golden Shape screen. Every value is a DS token (`--sem-*` / `--com-*`); ' +
          'size is content-driven (padding token + icon token — no fixed widths). ' +
          'Source of truth: the fresh v1 conversion of node 6075:53685; converter output is reference only.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** the DS ground the controls live on (bg/app/primary — the silver slab) */
const Ground = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: 'var(--sem-col-bg-app-primary)', padding: 'var(--sem-dim-fluid-standard-xl)', display: 'flex', gap: 'var(--sem-dim-fluid-standard-s)', alignItems: 'center', borderRadius: 8 }}>
    {children}
  </div>
);

export const Overview: Story = {
  render: () => (
    <Ground>
      <ButtonRound><IconUndo /></ButtonRound>
      <ButtonRound><IconRedo /></ButtonRound>
      <ButtonRound><IconRotate /></ButtonRound>
      <ButtonRound variant="spec"><IconRotate /></ButtonRound>
      <SpecPill><IconUndo /></SpecPill>
      <PillDone>Done</PillDone>
    </Ground>
  ),
};

export const ButtonRoundReg: Story = {
  name: 'Button-Round · reg',
  render: () => (
    <Ground>
      <ButtonRound><IconUndo /></ButtonRound>
      <ButtonRound><IconRedo /></ButtonRound>
      <ButtonRound><IconRotate /></ButtonRound>
    </Ground>
  ),
};

export const ButtonRoundSpec: Story = {
  name: 'Button-Round · spec (light drops from the top)',
  render: () => (
    <Ground>
      <ButtonRound variant="spec"><IconUndo /></ButtonRound>
      <ButtonRound variant="spec"><IconRedo /></ButtonRound>
      <SpecPill><IconRotate /></SpecPill>
    </Ground>
  ),
};

export const Tabs: Story = {
  name: 'Tab · active/inactive (token-bound opacity — E11 closed)',
  render: () => (
    <Ground>
      <Tab active label="Shape"><IconRotate /></Tab>
      <Tab label="Effect"><IconUndo /></Tab>
      <Tab label="Adjust"><IconRedo /></Tab>
    </Ground>
  ),
};
