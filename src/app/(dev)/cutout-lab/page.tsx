'use client'

import { useEffect, useState } from 'react'
import { CutoutLabMount } from './CutoutLabMount'

export default function CutoutLabPage() {
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    const query = new URL(location.href).searchParams
    if (query.get('debug') === '1') void import('eruda').then((module) => module.default.init())
    setAdmin(query.get('admin') === '1')
  }, [])

  return <CutoutLabMount admin={admin} />
}
