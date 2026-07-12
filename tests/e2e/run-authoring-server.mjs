import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { prepareAuthoringFixture, restoreAuthoringFixture } from './authoring-fixture.mjs'

const port = process.argv[2]
if (!port || !/^\d+$/.test(port)) throw new Error('Expected a numeric dev-server port')

await prepareAuthoringFixture()
const child = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', port, '--webpack'], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
  },
  stdio: 'inherit',
})

let finishing = false
async function finish(code, signal) {
  if (finishing) return
  finishing = true
  try {
    if (signal && child.exitCode === null) child.kill(signal)
    if (child.exitCode === null) await once(child, 'exit')
    await restoreAuthoringFixture()
    process.exit(code)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

child.once('error', () => void finish(1))
child.once('exit', (code) => void finish(code ?? 1))
process.once('SIGINT', () => void finish(130, 'SIGINT'))
process.once('SIGTERM', () => void finish(143, 'SIGTERM'))
