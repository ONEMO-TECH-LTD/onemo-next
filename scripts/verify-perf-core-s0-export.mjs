import { readFileSync } from 'node:fs'

const SENTINEL = 'ONEMO_PERF_CORE_S0_SENTINEL_v1'
const MAX_EXPORT_BYTES = 4096
const exportPath = process.argv[2]

if (!exportPath) {
  throw new Error('Usage: node scripts/verify-perf-core-s0-export.mjs <export.json>')
}

const raw = readFileSync(exportPath, 'utf8').trim()
const bytes = Buffer.byteLength(raw, 'utf8')
if (bytes > MAX_EXPORT_BYTES) {
  throw new Error(`Probe export is ${bytes} bytes; maximum is ${MAX_EXPORT_BYTES}.`)
}

const payload = JSON.parse(raw)
if (!Buffer.from(payload.sentinel ?? '').equals(Buffer.from(SENTINEL))) {
  throw new Error('Probe sentinel bytes do not match.')
}
if (raw !== JSON.stringify(payload)) {
  throw new Error('Probe export changed during JSON retrieval.')
}
for (const capability of ['timestamps', 'correlation', 'commitDetection', 'export']) {
  if (payload.capabilities?.[capability] !== true) {
    throw new Error(`Probe capability failed: ${capability}.`)
  }
}
for (const field of ['device', 'os', 'browser', 'surface', 'userAgent']) {
  if (typeof payload.metadata?.[field] !== 'string' || payload.metadata[field].trim() === '') {
    throw new Error(`Probe metadata is missing: ${field}.`)
  }
}

console.error(JSON.stringify({
  status: 'PASS',
  bytes,
  sentinel: payload.sentinel,
  metadata: payload.metadata,
}, null, 2))
