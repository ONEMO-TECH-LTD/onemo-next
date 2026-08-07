// bridge-save-flow — v1's Save/Preview RESOLUTION POLICY cloned clean: live edits compose at
// DISPLAY res; FULL res exists only on Save and Preview, requested through the ONE scheduler
// (never a second compose path — the memory-floor law born from the iPhone crashes). Cloned from
// v1 flow (awaitFullBake / setPreview / save), stripped of the lab compositor — the injected
// compose runner is the ENGINE's own op via the bridge. Adopt together with bridge-compose-policy,
// and ONLY if the clean bridge measurably lacks the floor (verification gate #4).

import type { ComposeScheduler } from '@/lib/bridge-compose-policy'

export type ComposeMode = 'display' | 'full'

/** Owns the display/full mode latch + full-res waiters over the ONE scheduler. The compose runner
 *  reads `mode()` each run; Save awaits the next COMMITTED full-res result, then returns to
 *  display res unless Preview holds it. */
export class SaveFlow {
  private modeRef: ComposeMode = 'display'
  private preview = false
  private waiters: (() => void)[] = []
  constructor(private scheduler: ComposeScheduler) {}

  mode(): ComposeMode { return this.modeRef }
  /** the compose runner calls this after a COMMITTED (non-superseded) full-res result lands */
  fullResLanded(): void { for (const w of this.waiters) w(); this.waiters = [] }

  /** 👁 Preview enter/exit: enter = full-res compose trigger (display bake may show as interim);
   *  exit = back to the display-res live compose. */
  setPreview(on: boolean): void {
    this.preview = on
    this.modeRef = on ? 'full' : 'display'
    this.scheduler.schedule(true)
  }

  /** Save: await the next committed full-res compose through the one scheduler, hand the result
   *  window to `emit` (blob/download — shell duty), then return to edit-res unless Preview holds. */
  async save(emit: () => void | Promise<void>): Promise<void> {
    await new Promise<void>((res) => { this.waiters.push(res); this.modeRef = 'full'; this.scheduler.schedule(true) })
    await emit()
    if (!this.preview) { this.modeRef = 'display'; this.scheduler.schedule() }
  }
}
