import { NextRequest } from 'next/server';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const customInput = searchParams.get('input');

  const args = [join(SCRIPTS_DIR, 'build-tokens.mjs')];
  if (customInput) {
    args.push('--input', customInput);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn('node', args, { cwd: PROJECT_ROOT });

      const sendLine = (line: string, type: 'stdout' | 'stderr') => {
        const payload = `data: ${JSON.stringify({ line, type })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) sendLine(line, 'stdout');
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) sendLine(line, 'stderr');
        }
      });

      child.on('close', (code) => {
        const payload = `data: ${JSON.stringify({ done: true, exitCode: code ?? 1 })}\n\n`;
        controller.enqueue(encoder.encode(payload));
        controller.close();
      });

      child.on('error', (err) => {
        const payload = `data: ${JSON.stringify({ line: err.message, type: 'stderr' })}\n\n`;
        controller.enqueue(encoder.encode(payload));
        const donePayload = `data: ${JSON.stringify({ done: true, exitCode: 1 })}\n\n`;
        controller.enqueue(encoder.encode(donePayload));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
