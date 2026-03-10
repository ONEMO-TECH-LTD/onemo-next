import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const GENERATED_DIR = join(process.cwd(), 'src/app/tokens');

const ALLOWED_FILES = new Set([
  'primitives.css',
  'aliases.css',
  'semantic.css',
  'semantic-inline.css',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('file');

  if (!filename || !ALLOWED_FILES.has(filename)) {
    return NextResponse.json({ error: 'Invalid file parameter' }, { status: 400 });
  }

  try {
    const content = await readFile(join(GENERATED_DIR, filename), 'utf-8');
    return NextResponse.json({ filename, content });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
