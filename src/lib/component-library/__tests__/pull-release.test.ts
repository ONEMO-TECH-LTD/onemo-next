import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// @ts-ignore — the production transaction is deliberately import-safe ESM.
import { pullComponentRelease } from '../../../../scripts/components/pull-release.mjs';
// @ts-ignore — independent verifier is plain ESM shared with the CLI.
import { verifyPulledGenerated } from '../../../../scripts/components/verify-release.mjs';
// @ts-ignore — API compatibility is independently derived by the app verifier.
import { compareApi } from '../../../../scripts/components/verify-release.mjs';

const roots: string[] = [];
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082',
  'hex',
);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function filesOf(root: string, dir = root): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesOf(root, target));
    else if (entry.isFile()) out.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return out.sort();
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'pull-release-'));
  roots.push(root);
  const app = path.join(root, 'app');
  await fs.mkdir(path.join(app, 'src', 'app', 'tokens'), { recursive: true });
  await fs.mkdir(path.join(app, 'src', 'components', 'ds'), { recursive: true });
  const tokens = ':root {\n  --sem-col-fg: var(--al-col-fg);\n  --al-col-fg: #111111;\n}\n';
  await fs.writeFile(path.join(app, 'src', 'app', 'tokens', 'tokens.css'), tokens);
  const wrapper = path.join(app, 'src', 'components', 'ds', 'ThingWrapper.tsx');
  const wrapperBytes = "import Thing from '@/components/generated/Thing/Thing';\nexport default function ThingWrapper() { return <Thing label=\"App\" />; }\n";
  await fs.writeFile(wrapper, wrapperBytes);
  execFileSync('git', ['init', '-q'], { cwd: app });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: app });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: app });
  execFileSync('git', ['add', '.'], { cwd: app });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: app });
  return { root, app, wrapper, wrapperBytes, tokens };
}

async function release(root: string, tokens: string, {
  labelType = 'string',
  marker = 'one',
} = {}) {
  const stage = path.join(root, `.release-${marker}`);
  const dir = stage;
  const component = path.join(dir, 'components', 'Thing');
  const evidence = path.join(component, 'evidence');
  await fs.mkdir(evidence, { recursive: true });
  await fs.mkdir(path.join(dir, 'authority'), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(component, 'Thing.tsx'), `import styles from './thing.module.css';
export type ThingProps = {
  label?: ${labelType};
};
export default function Thing({ label = 'Default' }: ThingProps) {
  return <span className={styles.thing} data-marker="${marker}">{label}</span>;
}
`),
    fs.writeFile(path.join(component, 'thing.module.css'), '.thing {\n  color: var(--sem-col-fg);\n}\n'),
    fs.writeFile(path.join(evidence, 'fidelity.json'),
      '{"masterId":"master:1","status":"pass","mismatchPct":0.2,"deltaThreshold":32}\n'),
    fs.writeFile(path.join(evidence, 'light.png'), png),
    fs.writeFile(path.join(evidence, 'dark.png'), png),
    fs.writeFile(path.join(dir, 'authority', 'tokens.css'), tokens),
  ]);
  const files = (await filesOf(dir)).filter((file) => file !== 'manifest.json');
  const artifacts = Object.fromEntries(await Promise.all(files.map(async (file) => {
    const bytes = await fs.readFile(path.join(dir, file));
    return [file, { bytes: bytes.length, sha256: sha256(bytes) }];
  })));
  const componentRecord = {
    figmaId: 'thing:1',
    sourceName: 'Thing',
    codeName: 'Thing',
    artifactRoot: 'components/Thing',
    api: [{
      authoredKey: 'Label#1:1',
      propName: 'label',
      type: 'TEXT',
      defaultValue: 'Default',
      variantOptions: null,
      bindingScope: [{
        masterId: 'master:1',
        sites: [{ nodeId: 'label:1', field: 'characters' }],
      }],
      emitted: true,
      emittedType: labelType,
    }],
    masters: [{
      figmaId: 'master:1',
      fidelity: {
        json: 'components/Thing/evidence/fidelity.json',
        light: 'components/Thing/evidence/light.png',
        dark: 'components/Thing/evidence/dark.png',
      },
    }],
    tokenDependencies: {
      roots: ['--sem-col-fg'],
      closure: [
        { token: '--al-col-fg', value: '#111111' },
        { token: '--sem-col-fg', value: 'var(--al-col-fg)' },
      ],
    },
  };
  const manifest = {
    schemaVersion: 1,
    authority: {
      fileKey: 'file',
      fileVersion: 'version',
      boardId: 'board',
      boardContentHash: 'board-hash',
      converterSha: 'converter',
      tokensHash: sha256(tokens),
    },
    counts: { artifacts: 1, masters: 1 },
    components: [componentRecord],
    artifacts,
  };
  const releaseId = sha256(canonical(manifest));
  Object.assign(manifest, { releaseId });
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const destination = path.join(root, releaseId);
  await fs.rename(stage, destination);
  return destination;
}

describe('component release pull transaction', () => {
  it('classifies removed components, defaults, required props and variants as breaking', () => {
    const prop = {
      authoredKey: 'State#1:1',
      propName: 'state',
      type: 'VARIANT',
      defaultValue: 'Default',
      variantOptions: ['Default', 'Active'],
      bindingScope: [],
      emitted: true,
      emittedType: "'Default' | 'Active'",
    };
    const previous = {
      components: [
        { figmaId: 'thing:1', codeName: 'Thing', api: [prop] },
        { figmaId: 'gone:1', codeName: 'Gone', api: [] },
      ],
    };
    const next = {
      components: [{
        figmaId: 'thing:1',
        codeName: 'Thing',
        api: [{
          ...prop,
          defaultValue: 'Active',
          required: true,
          variantOptions: ['Active'],
        }],
      }],
    };
    expect(compareApi(previous, next)).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'Gone', reason: 'component-removed' }),
      expect.objectContaining({ component: 'Thing', reason: 'default-changed' }),
      expect.objectContaining({ component: 'Thing', reason: 'new-required' }),
      expect.objectContaining({ component: 'Thing', reason: 'variant-removed' }),
    ]));
  });

  it('treats declared-unbound props as metadata, additive binding as compatible and binding removal as breaking', () => {
    const unbound = {
      authoredKey: 'Icons#8050:5',
      propName: 'icons',
      type: 'INSTANCE_SWAP',
      defaultValue: '6110:54836',
      bindingScope: [],
      emitted: false,
      emittedType: null,
    };
    const bound = {
      ...unbound,
      bindingScope: [{
        masterId: '8018:28194',
        sites: [{ nodeId: 'slot:1', field: 'mainComponent' }],
      }],
      emitted: true,
      emittedType: 'typeof IconHexagon',
    };
    const component = (api: Array<Record<string, unknown>>) => ({
      components: [{ figmaId: '8050:6894', codeName: 'Dial_8050_6894', api }],
    });
    expect(compareApi(component([unbound]), component([bound]))).toEqual([]);
    expect(compareApi(component([unbound]), component([]))).toEqual([]);
    expect(compareApi(component([unbound]), component([{ ...bound, required: true }]))).toEqual([
      expect.objectContaining({ reason: 'new-required' }),
    ]);
    expect(compareApi(component([bound]), component([unbound]))).toEqual([
      expect.objectContaining({
        component: 'Dial_8050_6894',
        prop: 'Icons#8050:5',
        reason: 'removed',
      }),
    ]);

    const narrowed = {
      ...bound,
      bindingScope: [],
      emitted: true,
    };
    expect(compareApi(component([bound]), component([narrowed]))).toEqual([
      expect.objectContaining({ reason: 'binding-scope-removed' }),
    ]);
  });

  it('pulls atomically with a real wrapper and preserves its bytes', async () => {
    const { root, app, wrapper, wrapperBytes, tokens } = await fixture();
    const releaseDir = await release(root, tokens);
    const result = await pullComponentRelease({ releaseDir, appRoot: app });
    expect(result.provenance.releaseId).toBe(path.basename(releaseDir));
    expect(await fs.readFile(wrapper, 'utf8')).toBe(wrapperBytes);
    expect((await verifyPulledGenerated({
      generatedDir: path.join(app, 'src', 'components', 'generated'),
      appTokensPath: path.join(app, 'src', 'app', 'tokens', 'tokens.css'),
      appRoot: app,
    })).status).toBe('pass');

    const nextRelease = await release(root, tokens, { marker: 'two' });
    const nextResult = await pullComponentRelease({ releaseDir: nextRelease, appRoot: app });
    expect(nextResult.provenance.releaseId).toBe(path.basename(nextRelease));
    expect(await fs.readFile(wrapper, 'utf8')).toBe(wrapperBytes);
    expect(await fs.readFile(
      path.join(app, 'src', 'components', 'generated', 'Thing', 'Thing.tsx'),
      'utf8',
    )).toContain('data-marker="two"');
  });

  it('accepts the app-owned proof route as a non-vacuous generated-barrel consumer', async () => {
    const { root, app, wrapper, tokens } = await fixture();
    await fs.writeFile(
      wrapper,
      "import { Thing } from '@/components/generated';\nexport default function Proof() { return <Thing label=\"Proof\" />; }\n",
    );
    await expect(pullComponentRelease({
      releaseDir: await release(root, tokens),
      appRoot: app,
    })).resolves.toBeDefined();
  });

  it('refuses an incompatible token closure before writes but ignores unrelated token additions', async () => {
    const { root, app, tokens } = await fixture();
    const releaseDir = await release(root, tokens);
    const tokensPath = path.join(app, 'src', 'app', 'tokens', 'tokens.css');
    await fs.writeFile(tokensPath, `${tokens}\n:root { --unrelated-token: 1px; }\n`);
    await expect(pullComponentRelease({ releaseDir, appRoot: app })).resolves.toBeDefined();

    const generated = path.join(app, 'src', 'components', 'generated');
    const before = await fs.readFile(path.join(generated, 'provenance.json'), 'utf8');
    await fs.writeFile(tokensPath, ':root { --sem-col-fg: var(--al-col-fg); --al-col-fg: 1px; }\n');
    await expect(pullComponentRelease({ releaseDir, appRoot: app }))
      .rejects.toThrow(/token incompatibility.*syntax-changed/);
    expect(await fs.readFile(path.join(generated, 'provenance.json'), 'utf8')).toBe(before);
  });

  it('refuses a breaking API before writes and names the wrapper', async () => {
    const { root, app, wrapper, wrapperBytes, tokens } = await fixture();
    await pullComponentRelease({ releaseDir: await release(root, tokens), appRoot: app });
    const before = await fs.readFile(path.join(app, 'src', 'components', 'generated', 'provenance.json'), 'utf8');
    const changed = await release(root, tokens, {
      labelType: 'number',
      marker: 'two',
    });
    await expect(pullComponentRelease({ releaseDir: changed, appRoot: app }))
      .rejects.toThrow(/Thing\.Label#1:1:type-changed.*ThingWrapper\.tsx/);
    expect(await fs.readFile(path.join(app, 'src', 'components', 'generated', 'provenance.json'), 'utf8')).toBe(before);
    expect(await fs.readFile(wrapper, 'utf8')).toBe(wrapperBytes);
  });

  it('restores generated bytes and wrapper bytes after an injected mid-transaction failure', async () => {
    const { root, app, wrapper, wrapperBytes, tokens } = await fixture();
    await pullComponentRelease({ releaseDir: await release(root, tokens), appRoot: app });
    const generated = path.join(app, 'src', 'components', 'generated');
    const before = Object.fromEntries(await Promise.all((await filesOf(generated)).map(async (file) => [
      file,
      sha256(await fs.readFile(path.join(generated, file))),
    ])));
    const next = await release(root, tokens, {
      marker: 'three',
    });
    await expect(pullComponentRelease({ releaseDir: next, appRoot: app, failAt: 'after-swap' }))
      .rejects.toThrow(/injected component pull failure/);
    const after = Object.fromEntries(await Promise.all((await filesOf(generated)).map(async (file) => [
      file,
      sha256(await fs.readFile(path.join(generated, file))),
    ])));
    expect(after).toEqual(before);
    expect(await fs.readFile(wrapper, 'utf8')).toBe(wrapperBytes);
  });

  it('leaves no generated tree when failure is injected before the first swap', async () => {
    const { root, app, tokens } = await fixture();
    const releaseDir = await release(root, tokens);
    await expect(pullComponentRelease({ releaseDir, appRoot: app, failAt: 'before-swap' }))
      .rejects.toThrow(/injected component pull failure before swap/);
    await expect(fs.access(path.join(app, 'src', 'components', 'generated'))).rejects.toThrow();
  });

  it('marks incomplete generated provenance unverified', async () => {
    const { root, app, tokens } = await fixture();
    await pullComponentRelease({ releaseDir: await release(root, tokens), appRoot: app });
    const generatedDir = path.join(app, 'src', 'components', 'generated');
    const provenancePath = path.join(generatedDir, 'provenance.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8'));
    delete provenance.source;
    await fs.writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
    expect((await verifyPulledGenerated({
      generatedDir,
      appTokensPath: path.join(app, 'src', 'app', 'tokens', 'tokens.css'),
      appRoot: app,
    })).status).toBe('unverified');
  });

  it('refuses direct app imports of generated internal render entries', async () => {
    const { root, app, wrapper, tokens } = await fixture();
    await fs.appendFile(
      wrapper,
      "\nimport Secret from '@/components/generated/Thing/internal/Secret';\n",
    );
    const releaseDir = await release(root, tokens);
    await expect(pullComponentRelease({ releaseDir, appRoot: app }))
      .rejects.toThrow(/direct generated-internal import.*ThingWrapper\.tsx/);
    await expect(fs.access(path.join(app, 'src', 'components', 'generated'))).rejects.toThrow();
  });

  it('refuses a vacuous zero-consumer app before writes', async () => {
    const { root, app, wrapper, tokens } = await fixture();
    await fs.rm(wrapper);
    const releaseDir = await release(root, tokens);
    await expect(pullComponentRelease({ releaseDir, appRoot: app }))
      .rejects.toThrow(/no app-owned generated-component consumer/);
    await expect(fs.access(path.join(app, 'src', 'components', 'generated'))).rejects.toThrow();
  });
});
