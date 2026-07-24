import { handleUserGridWorkerJob, type UserGridJob } from './grid-user'

const ctx: {
  onmessage: ((event: MessageEvent<{ id: number; job: UserGridJob }>) => void) | null
  postMessage(message: unknown): void
} = self as unknown as typeof ctx

ctx.onmessage = (event) => {
  const { id, job } = event.data
  try {
    ctx.postMessage({ id, ok: true, result: handleUserGridWorkerJob(job) })
  } catch (error) {
    ctx.postMessage({ id, ok: false, error: String((error as Error)?.message ?? error) })
  }
}

export {}
