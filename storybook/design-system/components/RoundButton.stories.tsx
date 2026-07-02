import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { RoundButton } from '../../../src/components/ds/RoundButton';

// 20px Phosphor-light-style glyphs (stroke 1.5, currentColor → inherits the tone ink token).
const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const Close = <svg width={20} height={20} viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" {...s} /></svg>;
const Check = <svg width={20} height={20} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 6.5" {...s} /></svg>;
const Undo = <svg width={20} height={20} viewBox="0 0 24 24"><path d="M9 7L4.5 11.5 9 16M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-2" {...s} /></svg>;
const Redo = <svg width={20} height={20} viewBox="0 0 24 24"><path d="M15 7l4.5 4.5L15 16M19.5 11.5H9a4.5 4.5 0 0 0 0 9h2" {...s} /></svg>;

// Stage the white control on a distinct (greyer) surface so it reads — not the white control bg.
const Stage = ({ children }: { children: ReactNode }) => (
  <div style={{ background: 'var(--sem-col-bg-secondary)', padding: 28, borderRadius: 16, display: 'inline-flex', gap: 8 }}>
    {children}
  </div>
);

const meta = {
  title: 'Design System/Components/RoundButton',
  component: RoundButton,
  args: { icon: Close, 'aria-label': 'Close', surface: 'solid', tone: 'neutral' },
  argTypes: {
    surface: { control: 'inline-radio', options: ['solid', 'glass', 'ghost'] },
    tone: { control: 'inline-radio', options: ['neutral', 'brand', 'disabled'] },
  },
  decorators: [(Story) => <Stage><Story /></Stage>],
} satisfies Meta<typeof RoundButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 44 container · 20 icon (0.45×) · solid/neutral · v2.3 tokens, white control on the stage. */
export const Default: Story = {};

// ── Surface axis ──
export const Solid: Story = { args: { surface: 'solid' } };
export const Glass: Story = { args: { surface: 'glass' } };
export const Ghost: Story = { args: { surface: 'ghost' } };

// ── Tone axis ──
export const Neutral: Story = { args: { tone: 'neutral', icon: Close, 'aria-label': 'Close' } };
export const Brand: Story = { args: { tone: 'brand', icon: Check, 'aria-label': 'Confirm' } };
export const Disabled: Story = { args: { tone: 'disabled', icon: Redo, 'aria-label': 'Redo (nothing to redo)' } };

/** The golden top-control row: undo · redo(disabled) · close · confirm(brand). */
export const ControlRow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <RoundButton icon={Undo} aria-label="Undo" />
      <RoundButton icon={Redo} aria-label="Redo" tone="disabled" />
      <RoundButton icon={Close} aria-label="Close" />
      <RoundButton icon={Check} aria-label="Confirm" tone="brand" />
    </div>
  ),
};

/** Full matrix — surface × tone. */
export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {(['solid', 'glass', 'ghost'] as const).map((surface) => (
        <div key={surface} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <RoundButton icon={Close} aria-label={`${surface} neutral`} surface={surface} tone="neutral" />
          <RoundButton icon={Check} aria-label={`${surface} brand`} surface={surface} tone="brand" />
          <RoundButton icon={Redo} aria-label={`${surface} disabled`} surface={surface} tone="disabled" />
          <span style={{ font: '500 11px var(--al-type-family-secondary)', color: 'var(--sem-col-text-secondary)' }}>{surface}</span>
        </div>
      ))}
    </div>
  ),
};
