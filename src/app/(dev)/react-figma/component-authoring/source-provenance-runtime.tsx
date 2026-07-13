import { cloneElement, type ReactElement, type Ref } from 'react'

const runtimeSourceProvenance = new WeakMap<Element, string>()

export function readRuntimeSourceProvenance(element: Element): string | null {
  return runtimeSourceProvenance.get(element) ?? null
}

export function AuthoringSourceBoundary({ provenance, children }: {
  provenance: string
  children: ReactElement<{ ref?: Ref<Element> }>
}) {
  const authoredRef = children.props.ref
  let registered: Element | null = null
  let authoredCleanup: (() => void) | undefined

  const detach = () => {
    if (!registered) return
    if (runtimeSourceProvenance.get(registered) === provenance) runtimeSourceProvenance.delete(registered)
    if (authoredCleanup) authoredCleanup()
    else assignRef(authoredRef, null)
    authoredCleanup = undefined
    registered = null
  }

  const ref = (node: Element | null) => {
    detach()
    if (!node) return
    registered = node
    runtimeSourceProvenance.set(node, provenance)
    authoredCleanup = assignRef(authoredRef, node)
    return detach
  }

  return cloneElement(children, { ref })
}

function assignRef(ref: Ref<Element> | undefined, node: Element | null): (() => void) | undefined {
  if (typeof ref === 'function') {
    const cleanup = ref(node)
    return typeof cleanup === 'function' ? cleanup : undefined
  }
  if (ref) ref.current = node
  return undefined
}
