// tool-grabcut-provider/maxflow.ts — max-flow / min-cut by DINIC'S ALGORITHM.
//
// The cut engine GrabCut is built on, implemented directly so the lab needs NO 13MB OpenCV build
// (Dan 2026-08-07: "grab cut goes in only if we strip it to grab cut only… no 13mb").
//
// WHY DINIC AND NOT BOYKOV–KOLMOGOROV: BK is faster on vision grids, but its orphan-adoption step
// maintains a parent forest that is easy to corrupt — a candidate parent whose chain runs back
// through the orphan closes a CYCLE, and the search then walks it forever. That defect froze the
// browser on real photo data while every clean synthetic fixture passed (ERRORS.md 2026-08-07).
// Dinic TERMINATES BY CONSTRUCTION: each phase strictly increases the shortest source→sink distance
// (so at most V phases), and within a phase the current-arc pointer advances monotonically, so each
// edge is saturated at most once. No parent forest, no adoption, no cycle class.
//
// Terminal capacities are modelled as real edges to an explicit SOURCE (n) and SINK (n+1) node.

export class MaxFlow {
  private n: number          // pixel nodes
  private S: number          // source id
  private T: number          // sink id
  private total: number      // n + 2
  private eTo: Int32Array
  private eCap: Float64Array
  private eNext: Int32Array
  private eHead: Int32Array
  private eCount = 0
  private level: Int32Array
  private iter: Int32Array
  private queue: Int32Array

  constructor(nodes: number, maxEdges: number) {
    this.n = nodes
    this.S = nodes
    this.T = nodes + 1
    this.total = nodes + 2
    const cap = (maxEdges + nodes * 2 + 8) * 2
    this.eTo = new Int32Array(cap)
    this.eCap = new Float64Array(cap)
    this.eNext = new Int32Array(cap).fill(-1)
    this.eHead = new Int32Array(this.total).fill(-1)
    this.level = new Int32Array(this.total)
    this.iter = new Int32Array(this.total)
    this.queue = new Int32Array(this.total)
  }

  private link(a: number, b: number, capAB: number, capBA: number): void {
    const e = this.eCount * 2
    this.eCount++
    this.eTo[e] = b; this.eCap[e] = capAB; this.eNext[e] = this.eHead[a]; this.eHead[a] = e
    this.eTo[e + 1] = a; this.eCap[e + 1] = capBA; this.eNext[e + 1] = this.eHead[b]; this.eHead[b] = e + 1
  }

  /** Terminal capacities for a pixel: source→node and node→sink (both non-negative). */
  addTerminal(node: number, srcCap: number, sinkCap: number): void {
    if (srcCap > 0) this.link(this.S, node, srcCap, 0)
    if (sinkCap > 0) this.link(node, this.T, sinkCap, 0)
  }

  /** Neighbour edge with capacity in both directions. */
  addEdge(a: number, b: number, capAB: number, capBA: number): void {
    this.link(a, b, capAB, capBA)
  }

  /** Level graph from the source over residual edges; false when the sink is unreachable. */
  private bfs(): boolean {
    this.level.fill(-1)
    let head = 0, tail = 0
    this.level[this.S] = 0
    this.queue[tail++] = this.S
    while (head < tail) {
      const v = this.queue[head++]
      for (let e = this.eHead[v]; e !== -1; e = this.eNext[e]) {
        if (this.eCap[e] <= 0) continue
        const u = this.eTo[e]
        if (this.level[u] !== -1) continue
        this.level[u] = this.level[v] + 1
        this.queue[tail++] = u
      }
    }
    return this.level[this.T] !== -1
  }

  /** Blocking-flow DFS with the current-arc optimisation (iterative — no recursion depth limit). */
  private dfs(limit: number): number {
    const path = this.queue // reuse: stack of edge ids on the current path
    let sp = 0
    let v = this.S
    let flow = 0
    for (;;) {
      if (v === this.T) {
        // augment along the stacked path by its bottleneck
        let bottleneck = limit
        for (let i = 0; i < sp; i++) bottleneck = Math.min(bottleneck, this.eCap[path[i]])
        for (let i = 0; i < sp; i++) { this.eCap[path[i]] -= bottleneck; this.eCap[path[i] ^ 1] += bottleneck }
        flow += bottleneck
        // retreat to the first saturated edge (its tail becomes the new frontier)
        let cut = 0
        while (cut < sp && this.eCap[path[cut]] > 0) cut++
        sp = cut
        v = sp === 0 ? this.S : this.eTo[path[sp - 1]]
        continue
      }
      let advanced = false
      for (let e = this.iter[v]; e !== -1; e = this.eNext[e]) {
        this.iter[v] = e
        if (this.eCap[e] <= 0) continue
        const u = this.eTo[e]
        if (this.level[u] !== this.level[v] + 1) continue
        path[sp++] = e
        v = u
        advanced = true
        break
      }
      if (advanced) continue
      // dead end: drop this node out of the level graph and back up
      this.iter[v] = -1
      this.level[v] = -1
      if (v === this.S) break
      sp--
      v = sp === 0 ? this.S : this.eTo[path[sp - 1]]
    }
    return flow
  }

  /** Max flow; afterwards inSource(node) gives the min-cut side. Terminates in ≤ V phases. */
  compute(): number {
    let flow = 0
    let phases = 0
    const maxPhases = this.total + 1 // Dinic's bound; a hard stop that can never be reached
    while (this.bfs() && phases++ < maxPhases) {
      for (let i = 0; i < this.total; i++) this.iter[i] = this.eHead[i]
      flow += this.dfs(Number.MAX_VALUE)
    }
    // final residual reachability = the min cut (bfs() above left `level` from the last, failed pass)
    return flow
  }

  /** After compute(): true when the node is reachable from the source in the residual graph. */
  inSource(node: number): boolean {
    return this.level[node] !== -1
  }
}
