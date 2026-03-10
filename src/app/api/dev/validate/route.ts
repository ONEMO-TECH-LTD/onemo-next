import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

const SCRIPTS_DIR = join(process.cwd(), 'scripts');

export async function POST(req: NextRequest): Promise<NextResponse> {
  let tempPath: string | null = null;
  try {
    const body = await req.json() as { figmaJson?: unknown };
    if (!body.figmaJson) {
      return NextResponse.json({ error: 'Missing figmaJson in request body' }, { status: 400 });
    }

    // Write the JSON content to a temp file
    const timestamp = Date.now();
    tempPath = join(os.tmpdir(), `figma-upload-${timestamp}.json`);
    await writeFile(tempPath, JSON.stringify(body.figmaJson), 'utf-8');

    // Spawn blueprint-validator.mjs with the temp path
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn('node', [join(SCRIPTS_DIR, 'blueprint-validator.mjs'), tempPath!], {
          cwd: join(SCRIPTS_DIR, '..'),
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
        child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
      }
    );

    if (result.exitCode !== 0) {
      return NextResponse.json(
        { error: 'Validator failed', stderr: result.stderr },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(result.stdout) as unknown;
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}
