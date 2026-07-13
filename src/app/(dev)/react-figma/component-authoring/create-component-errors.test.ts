import { describe, expect, it } from 'vitest'

import { presentCreateComponentFailure } from './create-component-errors'

describe('create-component error presentation', () => {
  it.each([
    [
      'CREATE_COMPONENT_SOURCE_UNSUPPORTED',
      'This selection can’t become a component yet. Choose a self-contained page element and try again.',
    ],
    [
      'SOURCE_PREIMAGE_STALE',
      'The page changed while the component was being created. Review the latest page and try again.',
    ],
  ])('keeps %s diagnostic while presenting product language', (code, message) => {
    expect(presentCreateComponentFailure(Object.assign(new Error('raw internal detail'), { code }), 'execute'))
      .toEqual({ message, diagnosticCode: code })
  })

  it('never promotes an unknown internal message into primary copy', () => {
    expect(presentCreateComponentFailure(new Error('raw internal detail'), 'preview')).toEqual({
      message: 'We couldn’t prepare this component. Check the selection and try again.',
      diagnosticCode: null,
    })
  })
})
