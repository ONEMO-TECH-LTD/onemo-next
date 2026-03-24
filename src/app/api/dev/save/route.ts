import { NextResponse } from 'next/server';
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const GENERATED_DIR = join(PROJECT_ROOT, 'src/app/tokens');

// Dynamic import of config to get the outputs array
async function getOutputs(): Promise<{ name: string; path: string }[]> {
  const configPath = join(PROJECT_ROOT, 'scripts/tokens/tokens.config.mjs');
  const mod = await import(/* webpackIgnore: true */ configPath) as {
    CONFIG: { outputs: { name: string; path: string }[] };
  };
  return mod.CONFIG.outputs;
}

export async function POST(): Promise<NextResponse> {
  try {
    // Check generated files exist
    let generatedFiles: string[];
    try {
      generatedFiles = (await readdir(GENERATED_DIR)).filter((f) => f.endsWith('.css'));
    } catch {
      return NextResponse.json({ error: 'Generate first' }, { status: 400 });
    }

    if (generatedFiles.length === 0) {
      return NextResponse.json({ error: 'Generate first' }, { status: 400 });
    }

    const outputs = await getOutputs();
    const results = [];

    for (const output of outputs) {
      // Ensure directory exists
      await mkdir(output.path, { recursive: true });

      const fileResults = [];
      for (const filename of generatedFiles) {
        const srcPath = join(GENERATED_DIR, filename);
        const destPath = join(output.path, filename);

        try {
          const content = await readFile(srcPath);
          await writeFile(destPath, content);
          const fileStat = await stat(destPath);
          fileResults.push({ filename, bytes: fileStat.size, written: true });
        } catch {
          fileResults.push({ filename, bytes: 0, written: false });
        }
      }

      results.push({ name: output.name, path: output.path, files: fileResults });
    }

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
