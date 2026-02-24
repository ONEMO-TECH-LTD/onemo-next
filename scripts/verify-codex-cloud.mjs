#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opts = {
  workspaceRoot: process.cwd(),
  siblingRoot: path.resolve(process.cwd(), '..'),
  busDir: '',
  installSdk: false,
  runSdkSmoke: false,
};

for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--sibling-root') opts.siblingRoot = path.resolve(args[++i]);
  else if (a === '--bus-dir') opts.busDir = path.resolve(args[++i]);
  else if (a === '--install-sdk') opts.installSdk = true;
  else if (a === '--run-sdk-smoke') opts.runSdkSmoke = true;
}

const repos = ['kai-solo-brain', 'onemo-next', 'onemo-ssot-global', 'onemo-theme'];

function run(cmd, cwd = opts.workspaceRoot) {
  try {
    const stdout = execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    return { ok: true, stdout };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString().trim() || '',
      stderr: error.stderr?.toString().trim() || error.message,
    };
  }
}

function checkRepo(repoName) {
  const repoPath = path.join(opts.siblingRoot, repoName);
  if (!fs.existsSync(repoPath)) {
    return { repoName, repoPath, ok: false, reason: 'missing directory' };
  }

  const gitTop = run('git rev-parse --show-toplevel', repoPath);
  if (!gitTop.ok) {
    return { repoName, repoPath, ok: false, reason: 'not a git repository' };
  }

  const remote = run('git remote get-url origin', repoPath);
  const branch = run('git branch --show-current', repoPath);

  return {
    repoName,
    repoPath,
    ok: true,
    remote: remote.ok ? remote.stdout : '(no origin remote)',
    branch: branch.ok ? branch.stdout : '(unknown branch)',
    hasClaude: fs.existsSync(path.join(repoPath, 'CLAUDE.md')),
    hasAgents: fs.existsSync(path.join(repoPath, 'AGENTS.md')),
  };
}

const report = {
  timestamp: new Date().toISOString(),
  siblingRoot: opts.siblingRoot,
  repos: repos.map(checkRepo),
  codex: {
    version: run('codex --version'),
    execHelp: run('codex exec --help'),
    mcpServerHelp: run('codex mcp-server --help'),
  },
  sdk: {
    packageVersion: run('npm view @openai/codex-sdk version'),
    busDir: opts.busDir || '(not provided)',
  },
};

if (opts.busDir) {
  const hasPkg = fs.existsSync(path.join(opts.busDir, 'package.json'));
  report.sdk.busDirHasPackageJson = hasPkg;

  if (hasPkg) {
    report.sdk.installedVersion = run('npm ls @openai/codex-sdk --depth=0', opts.busDir);

    if (opts.installSdk) {
      report.sdk.installResult = run('npm install @openai/codex-sdk', opts.busDir);
      report.sdk.installedVersionAfterInstall = run('npm ls @openai/codex-sdk --depth=0', opts.busDir);
    }

    if (opts.runSdkSmoke) {
      const smokePath = path.join(opts.busDir, '.codex-sdk-smoke.mjs');
      const smokeScript = `
import { Codex } from '@openai/codex-sdk';

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required for SDK smoke test');
  process.exit(2);
}

const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
const task = await codex.tasks.create({
  prompt: 'Reply with exactly: codex-sdk-smoke-ok',
  model: 'gpt-5.2',
});
console.log(JSON.stringify({ id: task.id, status: task.status }, null, 2));
`;
      fs.writeFileSync(smokePath, smokeScript, 'utf8');
      report.sdk.smokeResult = run(`node ${smokePath}`, opts.busDir);
      fs.rmSync(smokePath, { force: true });
    }
  }
}

console.log(JSON.stringify(report, null, 2));
