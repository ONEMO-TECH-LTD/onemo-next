'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { ComponentCanvas } from './ComponentCanvas'

export function PersistentCanvasHost({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<string | null>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      if (event.data?.type === 'onemo-authoring-enter' && typeof event.data.file === 'string') setFile(event.data.file)
      if (event.data?.type === 'onemo-authoring-exit') setFile(null)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'onemo-canvas-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return file ? <ComponentCanvas file={file} /> : children
}
