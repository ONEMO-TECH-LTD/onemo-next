export type CreateComponentFailureStage = 'preview' | 'execute'

export type CreateComponentFailurePresentation = {
  message: string
  diagnosticCode: string | null
}

const PRODUCT_MESSAGES: Record<string, string> = {
  CREATE_COMPONENT_SOURCE_UNSUPPORTED: 'This selection can’t become a component yet. Choose a self-contained page element and try again.',
  SOURCE_PREIMAGE_STALE: 'The page changed while the component was being created. Review the latest page and try again.',
}

export function presentCreateComponentFailure(
  error: unknown,
  stage: CreateComponentFailureStage,
): CreateComponentFailurePresentation {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null
  return {
    message: code && PRODUCT_MESSAGES[code]
      ? PRODUCT_MESSAGES[code]
      : stage === 'preview'
        ? 'We couldn’t prepare this component. Check the selection and try again.'
        : 'We couldn’t create this component. Review the page and try again.',
    diagnosticCode: code,
  }
}
