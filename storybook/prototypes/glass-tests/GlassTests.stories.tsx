import type { Meta, StoryObj } from '@storybook/nextjs';

/**
 * Prototypes / Glass Tests.
 *
 * The ONEMO Glass effect component (Dan-approved recipe: diagonal white rims + dark
 * contact + doubled edge refraction + micro chromatic aberration; .round dials with
 * the light, .pill stays static; pressed = brighten + squeeze).
 *
 * EXACT COPIES — the component (`glass.css`) and its test pages are byte-identical
 * copies of the 07-01 proof suite, served from `public/glass-tests/` and embedded
 * verbatim. Nothing re-authored.
 *
 *   glass.css          — the effect component itself
 *   glass-surface.html — glass on the editor screen mock (noise surface, dock pill, controls)
 *   glass-anim.html    — gyro / idle-spin light animation test
 *   glass-proof.html   — SVG-refraction experiment (historical)
 *   glass-webgl.html   — WebGL transmission experiment (historical)
 */
const page = (src: string, title: string) =>
  function GlassPage() {
    return (
      <iframe
        src={src}
        title={title}
        style={{ width: '100%', height: '92vh', border: 'none', background: '#e9ebee' }}
      />
    );
  };

const meta: Meta = {
  title: 'Prototypes/Glass Tests',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

/** Glass on the real editor-screen mock — noise surface, dock pill, round controls. */
export const OnSurface: Story = { render: page('/glass-tests/glass-surface.html', 'Glass on Surface') };
/** Light-play animation — idle spin (gyro needs a real device). */
export const Animation: Story = { render: page('/glass-tests/glass-anim.html', 'Glass Animation') };
/** Historical: SVG displacement refraction experiment. */
export const SvgRefraction: Story = { render: page('/glass-tests/glass-proof.html', 'SVG Refraction (historical)') };
/** Historical: WebGL transmission experiment. */
export const WebglTransmission: Story = { render: page('/glass-tests/glass-webgl.html', 'WebGL Transmission (historical)') };
