import { useEffect, useState } from 'react'
import { GridWorkerRequestCoalescer } from '@/lib/effect/grid-worker-client'

const SLIDER_JOB_COALESCE_MS = 80

interface KeyedResult {
  key: string
}

interface Settled<Result> {
  key: string
  result: Result | null
  error: string | null
}

/** Publish only the result matching the current exact key. Prior results disappear during resolution. */
export function useGridWorkerJob<Job, Result extends KeyedResult>(
  job: Job | null,
  key: string | null,
  request: (job: Job) => Promise<Result>,
  peek: (job: Job) => Result | undefined,
  transient = false,
): { result: Result | null; pending: boolean; error: string | null } {
  const [settled, setSettled] = useState<Settled<Result> | null>(null)
  const [coalescer] = useState(
    () => new GridWorkerRequestCoalescer<Job, Result>({ delayMS: SLIDER_JOB_COALESCE_MS }),
  )
  const cached = job && key ? peek(job) : null
  const exactCached = cached?.key === key ? cached : null

  useEffect(() => {
    if (!job || !key) {
      coalescer.cancel()
      return
    }
    let current = true
    const pending = transient
      ? coalescer.request(job, key, request)
      : coalescer.flush(job, key, request)
    pending.then((result) => {
      if (current && result.key === key) {
        setSettled({ key, result, error: null })
      }
    }).catch((error) => {
      const errorName = (error as Error)?.name
      if (
        !current
        || errorName === 'GridWorkerSupersededError'
        || errorName === 'GridWorkerInactiveError'
      ) return
      setSettled({ key, result: null, error: String((error as Error)?.message ?? error) })
    })
    return () => {
      current = false
      if (transient) coalescer.cancel(key)
    }
  }, [job, key, request, transient, coalescer])

  const exact = key && settled?.key === key ? settled : null
  return {
    result: exactCached ?? exact?.result ?? null,
    pending: Boolean(job && key && !exactCached && !exact?.result && !exact?.error),
    error: exactCached ? null : exact?.error ?? null,
  }
}
