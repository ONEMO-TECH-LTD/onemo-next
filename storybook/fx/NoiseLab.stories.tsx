import type { Meta, StoryObj } from '@storybook/nextjs';

/**
 * FX / Suede Noise Lab.
 *
 * The suede noise generator is a standalone Vite module app (@paper-design/shaders)
 * that lives at `storybook/fx/noise-gen/` and runs on its own dev server. This story
 * embeds the LIVE lab so it surfaces inside the FX section of the storybook.
 *
 * Run the lab:  cd storybook/fx/noise-gen && npm install && npm run dev   → :5188
 */
const SuedeNoiseLab = () => (
  <iframe
    src="http://localhost:5188/suede-studio.html"
    title="Suede Noise Lab"
    style={{ width: '100%', height: '88vh', border: 'none', borderRadius: 12, background: '#e9ebee' }}
  />
);

const meta: Meta<typeof SuedeNoiseLab> = {
  title: 'FX/Suede Noise Lab',
  component: SuedeNoiseLab,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof SuedeNoiseLab>;

export const Live: Story = {};
