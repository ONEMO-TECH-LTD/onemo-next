import type { Meta, StoryObj } from '@storybook/nextjs'
import React from 'react'
import {
  ArrowCounterClockwise,
  CompassTool,
  Crop,
  Faders,
  IntersectThree,
  MagicWand,
  PlusCircle,
  Shapes,
  Sparkle,
  VectorTwo,
} from '@phosphor-icons/react'

const TEST_ICONS = [
  MagicWand,
  CompassTool,
  IntersectThree,
  Shapes,
  Faders,
  VectorTwo,
  Sparkle,
  Crop,
  PlusCircle,
  ArrowCounterClockwise,
]

function IconsOnly() {
  return (
    <main style={pageStyle} aria-label="ONEMO v3 current icon test set">
      <section style={gridStyle}>
        {TEST_ICONS.map((Icon, index) => (
          <Icon
            key={index}
            size={56}
            weight="light"
            color="#071013"
            style={iconStyle}
          />
        ))}
      </section>
    </main>
  )
}

const meta = {
  title: 'Icons/V3 Current/Icons Only',
  component: IconsOnly,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof IconsOnly>

export default meta

type Story = StoryObj<typeof meta>

export const TestSet: Story = {}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'grid',
  placeItems: 'center',
  background: '#ffffff',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 96px)',
  gap: 40,
  alignItems: 'center',
  justifyItems: 'center',
}

const iconStyle: React.CSSProperties = {
  display: 'block',
}
