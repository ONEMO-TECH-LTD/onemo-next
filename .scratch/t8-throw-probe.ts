import { computePreparedGrid } from "../src/lib/grid-engine/compute/grid-core"
import { prepareExactContour } from "../src/lib/grid-engine/compute/grid-prepared"
const prepared = prepareExactContour({ outer: { pts: [[0,0],[100,0],[100,100],[0,100]] }, holes: [] })
try {
  const r = computePreparedGrid(prepared, { attachment: "magnetic" })
  console.log("NO_THROW", r.ok, r.anchors.length, r.candidates.length)
} catch (e) {
  console.log(JSON.stringify({ threw: true, name: e.constructor.name, message: e.message }))
}
