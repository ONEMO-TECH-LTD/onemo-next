import type { Meta, StoryObj } from '@storybook/nextjs';
import { TokenFamilyDoc } from './TokenFamilyDoc';

/**
 * DS token documentation — generated-style, data-driven.
 * Pilot: the text/ family in its FINAL decided shape (DS v2.3.2 rebuild).
 * At DS lock the dataset becomes ds-pipeline converter output; the doc
 * component stays as-is.
 */
const meta: Meta<typeof TokenFamilyDoc> = {
  title: 'Design System/Tokens/Colour — text (FINAL)',
  component: TokenFamilyDoc,
  parameters: { layout: 'padded', backgrounds: { default: 'white' } },
};
export default meta;

type Story = StoryObj<typeof TokenFamilyDoc>;

export const TextFamily: Story = { name: 'text/ — 21 tokens' };
