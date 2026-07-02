/**
 * Vite dev-server plugin: persist edited Figma Variables back to source.
 *
 * Adds a POST `/__variables-save` endpoint to the dev server. The body is the
 * full edited export (the same array shape as the source). On save it writes
 * BOTH:
 *   - the Storybook story copy  (src/variables/figma-export.json), and
 *   - the canonical artifacts file the converter consumes
 *     (11-design-system/artifacts/DS-V2.1--22-JUNE-2026.json),
 * so re-running build-scan.mjs picks up the edits.
 *
 * Only active under `vite dev` / `storybook dev` (configureServer). The static
 * `storybook build` output has no server, so the panel falls back to its
 * "Download JSON" button there — see VariablesPanel.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Plugin } from 'vite'

const execFileAsync = promisify(execFile)
const dirname = path.dirname(fileURLToPath(import.meta.url))

// dirname = <repo>/16-storybook/src/variables
//   ..            -> src
//   ../..         -> 16-storybook
//   ../../..      -> repo root (the worktree checkout)
const STORY_COPY = path.resolve(dirname, 'figma-export.json')
const ARTIFACTS_FILE = path.resolve(
  dirname,
  '../../../11-design-system/artifacts/DS-V2.1--22-JUNE-2026.json',
)
// The scan-driven, format-neutral DS converter engine (tools/ds-pipeline) + an
// isolated preview output dir. Running build-scan.mjs with --output-dir writes
// ONLY there — never the onemo-next / onemo-theme consumers or the SSOT.
const PIPELINE_DIR = path.resolve(dirname, '../../../tools/ds-pipeline')
const BUILD_PREVIEW_DIR = path.resolve(PIPELINE_DIR, 'scan-output')
// The five framework outputs the neutral emitter produces (one spec → all five).
const CSS_FILES = ['tokens.css', 'tokens.tailwind.css', 'tokens.ts', 'tokens.liquid', 'tokens.light.json', 'tokens.dark.json'] as const

export function variablesSavePlugin(): Plugin {
  return {
    name: 'onemo-variables-save',
    configureServer(server) {
      server.middlewares.use('/__variables-save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          void (async () => {
            try {
              const body = Buffer.concat(chunks).toString('utf8')
              // Validate it parses as an array before writing.
              const parsed = JSON.parse(body)
              if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.')
              const pretty = JSON.stringify(parsed, null, 2) + '\n'
              await writeFile(STORY_COPY, pretty, 'utf8')
              await writeFile(ARTIFACTS_FILE, pretty, 'utf8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  ok: true,
                  wrote: [STORY_COPY, ARTIFACTS_FILE],
                }),
              )
            } catch (err) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: String(err) }))
            }
          })()
        })
      })

      // ── Build: run the real DS converter against the saved SSOT artifact, ──
      // isolated to a preview dir so the onemo-next / onemo-theme consumers are
      // never written. Returns the generated CSS so the editor can display the
      // converter's OUTPUT (the built design system) — closing the
      // edit → save → convert → view loop entirely inside the SSOT repo.
      server.middlewares.use('/__variables-build', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          void (async () => {
            try {
              await mkdir(BUILD_PREVIEW_DIR, { recursive: true })
              // Build from the POSTed tokens (current editor state) when present —
              // written to an UNWATCHED temp input so it never touches the story's
              // figma-export.json (which would trigger an HMR remount and close the
              // viewer) nor the canonical artifact. Falls back to the on-disk
              // artifact if no body is sent.
              let inputPath = ARTIFACTS_FILE
              const body = Buffer.concat(chunks).toString('utf8')
              if (body.trim()) {
                const parsed = JSON.parse(body)
                if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of collections.')
                inputPath = path.join(BUILD_PREVIEW_DIR, '.input.json')
                await writeFile(inputPath, JSON.stringify(parsed, null, 2), 'utf8')
              }
              const { stdout, stderr } = await execFileAsync(
                'node',
                ['build-scan.mjs', '--input', inputPath, '--output-dir', BUILD_PREVIEW_DIR],
                { cwd: PIPELINE_DIR, maxBuffer: 16 * 1024 * 1024 },
              )
              const files: Record<string, string> = {}
              for (const f of CSS_FILES) {
                try {
                  files[f] = await readFile(path.join(BUILD_PREVIEW_DIR, f), 'utf8')
                } catch {
                  files[f] = ''
                }
              }
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, stdout, stderr, outputDir: BUILD_PREVIEW_DIR, files }))
            } catch (err) {
              const e = err as { message?: string; stdout?: string; stderr?: string }
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: e.message ?? String(err), stdout: e.stdout ?? '', stderr: e.stderr ?? '' }))
            }
          })()
        })
      })
    },
  }
}
