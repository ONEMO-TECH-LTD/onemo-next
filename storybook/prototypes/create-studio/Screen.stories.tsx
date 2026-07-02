import type { Meta, StoryObj } from '@storybook/nextjs';
import { Surface } from './Surface';
import { EffectFrame } from './EffectFrame';
import { Glass } from './Glass';

const gs = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const Close = <svg width={20} height={20} viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" {...gs} /></svg>;
const Check = <svg width={20} height={20} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 6.5" {...gs} /></svg>;

/**
 * Screen — testbed for the app surface in context. Only real components live here
 * (Surface + EffectFrame); chrome is built as proper components from the Figma anatomy.
 */
interface ScreenArgs {
  base: string;
  intensity: number;
  grainSize: number;
  density: number;
  speed: number;
  motion: 'animated' | 'static';
  lumaOnly: boolean;
  quality: number;
  image?: string[];
}

// 402 × 874 — iPhone 16 Pro logical viewport
function Screen({ base, intensity, grainSize, density, speed, motion, lumaOnly, quality, image }: ScreenArgs) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', background: '#0c0d0f', padding: 20 }}>
      <Surface
        base={base}
        intensity={intensity}
        grainSize={grainSize}
        density={density}
        speed={speed}
        motion={motion}
        lumaOnly={lumaOnly}
        quality={quality}
        style={{ width: 402, height: 874, borderRadius: 44, boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}
      >
        {/* glass controls — Dan's refined glass, assembled onto the real surface */}
        <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Glass shape="round" style={{ width: 44, height: 44 }}>{Close}</Glass>
          <Glass shape="round" style={{ width: 44, height: 44 }}>{Check}</Glass>
        </div>

        {/* effect only — tap to flip (image front / colour back) */}
        <div style={{ position: 'absolute', top: 150, left: '50%', transform: 'translateX(-50%)' }}>
          <EffectFrame size={300} image={image?.[0]} />
        </div>
      </Surface>
    </div>
  );
}

const meta = {
  title: 'Prototypes/Create Studio',
  render: (args: ScreenArgs) => <Screen {...args} />,
  parameters: { layout: 'fullscreen' },
  args: { base: '#F5F7F9', intensity: 0.15, grainSize: 0.7, density: 0.5, speed: 0.5, motion: 'static', lumaOnly: true, quality: 2 },
  argTypes: {
    base: { control: 'color' },
    intensity: { control: { type: 'range', min: 0, max: 0.6, step: 0.01 } },
    grainSize: { control: { type: 'range', min: 0.1, max: 8, step: 0.1 } },
    density: { control: { type: 'range', min: 0.25, max: 4, step: 0.05 } },
    speed: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
    motion: { control: 'inline-radio', options: ['animated', 'static'] },
    lumaOnly: { control: 'boolean' },
    quality: { control: 'inline-radio', options: [1, 2, 3] },
    image: { control: { type: 'file', accept: 'image/*' }, description: 'Upload an image onto the frame front' },
  },
} satisfies Meta<ScreenArgs>;

export default meta;
type Story = StoryObj<ScreenArgs>;

/** The tuned light surface with the Effect Frame. */
export const LightSurface: Story = {};

/**
 * Pure background only — 430×932 (iPhone 14 Pro Max) at x2 retina = 860×1864 canvas,
 * static, no chrome. For exporting the surface PNG into Figma.
 */
export const BackgroundExport: Story = {
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <Surface
      base={args.base}
      intensity={args.intensity}
      grainSize={args.grainSize}
      density={args.density}
      motion="static"
      lumaOnly={args.lumaOnly}
      quality={2}
      style={{ width: 430, height: 932 }}
    />
  ),
};
