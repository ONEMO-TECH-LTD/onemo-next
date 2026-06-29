import type { Meta, StoryObj } from '@storybook/nextjs';
import { RoundButton } from './RoundButton';

// 20px Phosphor-light-style glyphs (stroke 1.5, currentColor → inherits the button ink token).
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const Close = (
  <svg width={20} height={20} viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" {...stroke} /></svg>
);
const Check = (
  <svg width={20} height={20} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 6.5" {...stroke} /></svg>
);
const Undo = (
  <svg width={20} height={20} viewBox="0 0 24 24"><path d="M9 7L4.5 11.5 9 16M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-2" {...stroke} /></svg>
);

const meta = {
  title: 'DS/Atoms/RoundButton',
  component: RoundButton,
  parameters: { layout: 'centered' },
  args: { icon: Close, 'aria-label': 'Close' },
} satisfies Meta<typeof RoundButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 44px tap-floor container · 20px icon (0.45× ratio) · v2.3 tokens. */
export const Default: Story = {};

export const CloseButton: Story = { args: { icon: Close, 'aria-label': 'Close' } };
export const Confirm: Story = { args: { icon: Check, 'aria-label': 'Confirm' } };
export const UndoButton: Story = { args: { icon: Undo, 'aria-label': 'Undo' } };

/** The top-control row from the golden screen: undo · redo · close · confirm. */
export const ControlRow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <RoundButton icon={Undo} aria-label="Undo" />
      <RoundButton icon={<span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>{Undo}</span>} aria-label="Redo" />
      <RoundButton icon={Close} aria-label="Close" />
      <RoundButton icon={Check} aria-label="Confirm" />
    </div>
  ),
};
