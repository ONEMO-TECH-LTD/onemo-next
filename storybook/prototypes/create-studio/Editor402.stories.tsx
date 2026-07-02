import type { Meta, StoryObj } from '@storybook/nextjs';
import { Editor402 } from './Editor402';

/**
 * Editor402 — verbatim replica of Figma frame 4084:25997 ("Editor 402 iphone - apple blur glass").
 * Every dimension wired to the token its Figma layer binds; Figma's baked background image.
 */
const meta = {
  title: 'Prototypes/Editor 402',
  component: Editor402,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', background: '#0c0d0f', padding: 20 }}>
      <div style={{ width: 402, height: 871, borderRadius: 44, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
        <Story />
      </div>
    </div>
  )],
} satisfies Meta<typeof Editor402>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppleBlurGlass: Story = {};
