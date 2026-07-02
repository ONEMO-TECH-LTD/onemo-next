import type { StorybookConfig } from '@storybook/nextjs';

/**
 * Anatomy Storybook — the v2.3-native component library for the Create Studio UI (Phase 6).
 * Uses the Webpack-based @storybook/nextjs framework (onemo-next has a custom webpack
 * config — IgnorePlugin for paper-full/jsdom — which nextjs-vite cannot honour).
 */
const config: StorybookConfig = {
  stories: ['../storybook/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/nextjs', options: {} },
  staticDirs: ['../public'],
};

export default config;
