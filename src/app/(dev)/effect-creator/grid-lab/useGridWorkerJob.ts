import { useEffect, useState } from 'react'

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
): { result: Result | null; pending: boolean; error: string | null } {
  const [settled, setSettled] = useState<Settled<Result> | null>(null)
  const cached = job && key ? peek(job) : null
  const exactCached = cached?.key === key ? cached : null

  useEffect(() => {
    if (!job || !key) return
    let current = true
    request(job).then((result) => {
      if (current && result.key === key) setSettled({ key, result, error: null })
    }).catch((error) => {
      const errorName = (error as Error)?.name
      if (
        !current
        || errorName === 'GridWorkerSupersededError'
        || errorName === 'GridWorkerInactiveError'
      ) return
      setSettled({ key, result: null, error: String((error as Error)?.message ?? error) })
    })
    return () => { current = false }
  }, [job, key, request])

  const exact = key && settled?.key === key ? settled : null
  return {
    result: exactCached ?? exact?.result ?? null,
    pending: Boolean(job && key && !exactCached && !exact?.result && !exact?.error),
    error: exactCached ? null : exact?.error ?? null,
  }
}
