import type { Meta, StoryObj } from '@storybook/nextjs';

/**
 * FX / SKYLRK Surface Comparator.
 *
 * "Surface compare — skylrk vs mattdesl vs paper": three grain engines side by side
 * (skylrk hash · mattdesl simplex-3D · Paper) over a shared adaptive gradient, with
 * GPU-load device simulation and on-device measure. WebGL.
 *
 * Lives in the same Vite lab as the suede studio (`_prototypes/suede-engine/index.html`)
 * and is served from its dev server. This story embeds the LIVE comparator.
 *
 * Run the lab:  cd _prototypes/suede-engine && npm install && npm run dev   → :5188
 */
const SkylrkComparator = () => (
  <iframe
    src="http://localhost:5188/index.html"
    title="SKYLRK Surface Comparator"
    style={{ width: '100%', height: '88vh', border: 'none', borderRadius: 12, background: '#e9ebee' }}
  />
);

const meta: Meta<typeof SkylrkComparator> = {
  title: 'FX/SKYLRK Surface Comparator',
  component: SkylrkComparator,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof SkylrkComparator>;

export const Live: Story = {};
