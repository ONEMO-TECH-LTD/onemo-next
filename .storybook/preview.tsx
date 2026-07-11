import type { Preview } from '@storybook/nextjs';
import '../src/app/globals.css'; // DS v2.3 tokens (Tailwind v4 @theme + :root cascade)

/**
 * Global preview — loads the v2.3 token layer so every story renders on the real
 * design system, and frames stories on the brand surface.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    options: {
      storySort: {
        order: [
          'Documentation',
          ['Overview', 'Colour', ['Primitives', 'Aliases', 'Semantic roles', 'Accessible text'], 'States & Interaction', 'Changelog'],
          'Design System',
        ],
      },
    },
    backgrounds: {
      default: 'surface',
      values: [
        { name: 'surface', value: 'var(--sem-col-bg-primary)' },
        { name: 'dark', value: 'var(--sem-col-bg-primary)' },
        { name: 'white', value: '#ffffff' },
      ],
    },
    controls: { matchers: { color: /(background|color)$/i } },
  },
  decorators: [
    (Story) => (
      <div style={{ fontFamily: 'var(--al-type-family-primary)' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
