import { handleAdminGridJob, type AdminGridJob } from './grid-admin'

const ctx: {
  onmessage: ((event: MessageEvent<{ id: number; job: AdminGridJob }>) => void) | null
  postMessage(message: unknown): void
} = self as unknown as typeof ctx

ctx.onmessage = (event) => {
  const { id, job } = event.data
  try {
    ctx.postMessage({ id, ok: true, result: handleAdminGridJob(job) })
  } catch (error) {
    ctx.postMessage({ id, ok: false, error: String((error as Error)?.message ?? error) })
  }
}

export {}
