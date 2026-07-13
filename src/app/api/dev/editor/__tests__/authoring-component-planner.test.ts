import { describe, expect, it } from 'vitest'

import { planMakeComponentFromSelection } from '../lib'

const sourceAbs = '/project/src/app/page.tsx'
const componentDir = '/project/src/app/(dev)/react-figma-components'

describe('create-component-from-selection staged planner', () => {
  it('plans exact component and consumer bytes without writing either file', () => {
    const source = Buffer.from(`import { Icon } from './Icon'

export function Page() {
  return (
    <main>
      <section data-name="Card">
        <Icon />
      </section>
    </main>
  )
}
`)

    const plan = planMakeComponentFromSelection({
      source, sourceAbs, componentDir, line: 6, col: 7, name: 'Card',
    })

    expect(plan).toEqual({
      name: 'Card',
      componentSource: `import { Icon } from '../../Icon'

export function Card() {
  return (
    <section data-name="Card">
        <Icon />
      </section>
  )
}
`,
      consumerSource: Buffer.from(`import { Icon } from './Icon'
import { Card } from '@/app/(dev)/react-figma-components/Card'

export function Page() {
  return (
    <main>
      <Card />
    </main>
  )
}
`),
      consumerExportName: 'Page',
      instanceLine: 7,
      instanceCol: 7,
    })
    expect(source.toString('utf8')).toContain('<section data-name="Card">')
  })

  it('refuses local-scope capture and invalid component identity before producing a plan', () => {
    const source = Buffer.from(`export function Page() {
  const label = 'local'
  return <span>{label}</span>
}
`)

    expect(() => planMakeComponentFromSelection({
      source, sourceAbs, componentDir, line: 3, col: 10, name: 'Label',
    })).toThrow(expect.objectContaining({ status: 422, code: 'SELECTION_LOCAL_CAPTURE' }))
    expect(() => planMakeComponentFromSelection({
      source, sourceAbs, componentDir, line: 3, col: 10, name: 'not valid',
    })).toThrow(expect.objectContaining({ status: 422 }))
  })

  it('does not let a nested parameter hide an outer capture with the same name', () => {
    const source = Buffer.from(`export function Page({ label }: { label: string }) {
  return (
    <section>
      {label}
      {[1].map((label) => <span>{label}</span>)}
    </section>
  )
}
`)

    expect(() => planMakeComponentFromSelection({
      source, sourceAbs, componentDir, line: 3, col: 5, name: 'Card',
    })).toThrow(expect.objectContaining({ status: 422, code: 'SELECTION_LOCAL_CAPTURE' }))
  })

  it('accepts bindings owned by nested functions, arrows, blocks, catches, and destructuring', () => {
    const source = Buffer.from(`export function Page() {
  return (
    <section>
      {(() => {
        function render(input: { label: string }) {
          const rows = [input]
          try {
            return rows.map(({ label }) => <span>{label}</span>)
          } catch (error) {
            return <span>{error.message}</span>
          }
        }
        return render({ label: 'local' })
      })()}
    </section>
  )
}
`)

    expect(planMakeComponentFromSelection({
      source, sourceAbs, componentDir, line: 3, col: 5, name: 'Card',
    }).componentSource).toContain('function render')
  })
})
