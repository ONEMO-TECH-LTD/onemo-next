// cutout-lab — undo/redo snapshot stack. PURE state mechanics, no React, no canvas: the shell
// owns what a snapshot means; this module owns the stack discipline (cap, truncate-on-branch).

export class HistoryStack<T> {
  private items: T[] = []
  private idx = -1
  constructor(private cap = 30) {}

  push(snap: T): void {
    this.items = this.items.slice(0, this.idx + 1)
    this.items.push(snap)
    if (this.items.length > this.cap) this.items.shift()
    this.idx = this.items.length - 1
  }
  canUndo(): boolean { return this.idx > 0 }
  canRedo(): boolean { return this.idx < this.items.length - 1 }
  undo(): T | null { return this.canUndo() ? this.items[--this.idx] : null }
  redo(): T | null { return this.canRedo() ? this.items[++this.idx] : null }
}
