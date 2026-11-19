#!/usr/bin/env node
/**
 * bin/init-harness.mjs — Aegis Harness Polyglot Bootstrapper
 *
 * Detecta a stack do projeto alvo, sincroniza Agent Skills, instala os scripts
 * determinísticos Multi-OS (`review.mjs`, `audit-repo.mjs`, `blast-radius.mjs`,
 * `plan-collision.mjs`, `scan-clean-code.mjs`) e gera a governança Multi-Agente
 * (`AGENTS.md`, `CLAUDE.md`, `.claude/agents/` e Tríade `docs/`).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HARNESS_ROOT = path.resolve(__dirname, '..');
const GIT_CLONE_TIMEOUT_MS = 12000;
const MAX_TEST_DOMAINS = 8;

function cliPrint(message) {
  process.stdout.write(`${message}\n`);
}

const VALID_AGENT_HOSTS = new Set(['antigravity', 'claude', 'codex', 'all']);

function parseArgs(argv) {
  let target = process.cwd();
  let offline = false;
  let force = false;
  let updateCache = false;
  let agent = 'auto';
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target' && argv[i + 1]) target = path.resolve(argv[++i]);
    else if (arg === '--agent' && argv[i + 1]) agent = String(argv[++i]).toLowerCase();
    else if (arg === '--offline') offline = true;
    else if (arg === '--force') force = true;
    else if (arg === '--update-cache') updateCache = true;
  }
  return { target, offline, force, updateCache, agent };
}

/**
 * Resolve o host agêntico do projeto alvo ('antigravity' | 'claude' | 'codex' | 'all').
 * Exemplo: detectAgentHost(targetDir, 'antigravity') === 'antigravity'
 */
export function detectAgentHost(targetDir, requestedAgent = 'auto', env = process.env) {
  const normalized = String(requestedAgent || 'auto').toLowerCase();
  if (VALID_AGENT_HOSTS.has(normalized)) return normalized;
  const hasMarker = (rel) => fs.existsSync(path.join(targetDir, rel));
  if (hasMarker('.claude') || hasMarker('CLAUDE.md') || Boolean(env.CLAUDE_CODE)) return 'claude';
  if (hasMarker('.gemini') || hasMarker('.agents') || hasMarker('.agent')) return 'antigravity';
  if (Boolean(env.CODEX_CLI)) return 'codex';
  return 'all';
}

function copyFileIfAllowed(srcFile, destFile, force) {
  if (!fs.existsSync(srcFile)) return;
  if (!fs.existsSync(destFile) || force) fs.copyFileSync(srcFile, destFile);
}

function copyFlatFiles(srcDir, destDir, { force = false, extFilter = null } = {}) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    if (extFilter && !file.endsWith(extFilter)) continue;
    const srcFile = path.join(srcDir, file);
    if (fs.statSync(srcFile).isFile()) copyFileIfAllowed(srcFile, path.join(destDir, file), force);
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function renderTemplate(rawText, stack) {
  return rawText
    .replace(/\{\{PROJECT_NAME\}\}/g, stack.projectName)
    .replace(/\{\{LANGUAGE\}\}/g, stack.language)
    .replace(/\{\{STACK_SUMMARY\}\}/g, stack.stackSummary)
    .replace(/\{\{TEST_DOMAINS\}\}/g, stack.testDomains.join(', '));
}

function detectJsFrameworks(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const map = [
    ['next', 'Next.js'], ['react', 'React'], ['vue', 'Vue'], ['express', 'Express'],
    ['fastify', 'Fastify'], ['vitest', 'Vitest'], ['playwright', 'Playwright'], ['firebase', 'Firebase']
  ];
  return map.filter(([dep]) => Boolean(deps[dep])).map(([, label]) => label);
}

function buildJsGates(hasTsConfig) {
  return [
    { name: 'Lockfile Sync Check', command: 'node scripts/check-lockfile-sync.mjs' },
    { name: 'AST Guardrails (ast-grep)', command: 'npx @ast-grep/cli scan' },
    { name: 'Dead Code & Orphans (knip)', command: 'npx knip' },
    { name: 'Module Boundaries (dependency-cruiser)', command: 'npx depcruise --config .dependency-cruiser.js .' },
    ...(hasTsConfig ? [{ name: 'TypeScript Strict Typecheck', command: 'npx tsc --noEmit' }] : []),
    { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' },
    { name: 'Clean Code 22 Rules Scan', command: 'node scripts/scan-clean-code.mjs --enforce-zero-rules' },
    { name: 'Automated Test Suite', command: 'npm test' }
  ];
}

function discoverTestDomains(targetDir) {
  const candidateRoots = ['src', 'frontend/src', 'backend/src', 'app', 'pkg', 'internal'];
  const ignored = new Set(['tests', '__tests__', 'node_modules', 'types', 'utils']);
  const discovered = new Set();
  for (const rel of candidateRoots) {
    const full = path.join(targetDir, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (entry.isDirectory() && !ignored.has(entry.name)) discovered.add(`tests/${entry.name}/`);
    }
  }
  if (discovered.size === 0) return ['tests/core/', 'tests/api/', 'tests/storage/', 'tests/governance/'];
  discovered.add('tests/governance/');
  return Array.from(discovered).slice(0, MAX_TEST_DOMAINS);
}

/**
 * Detecta automaticamente a linguagem, frameworks, domínios de teste e gates do projeto alvo.
 */
export function detectProjectStack(targetDir) {
  const has = (rel) => fs.existsSync(path.join(targetDir, rel));
  const projectName = path.basename(targetDir);
  if (has('package.json')) {
    const language = has('tsconfig.json') ? 'typescript' : 'javascript';
    const frameworks = detectJsFrameworks(targetDir);
    return {
      projectName,
      language,
      stackSummary: frameworks.length > 0 ? frameworks.join(', ') : language.toUpperCase(),
      testDomains: discoverTestDomains(targetDir),
      gates: buildJsGates(has('tsconfig.json'))
    };
  }
  let language = 'polyglot';
  if (has('pyproject.toml') || has('requirements.txt')) language = 'python';
  else if (has('go.mod')) language = 'go';
  return {
    projectName,
    language,
    stackSummary: language.toUpperCase(),
    testDomains: discoverTestDomains(targetDir),
    gates: [{ name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' }]
  };
}

function resolveRemoteSkillsDir(upstream, offline) {
  if (!upstream.repo || offline) return { remoteDir: null, tempCloneDir: null };
  const tempCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), `aegis-${upstream.id}-`));
  try {
    execFileSync(
      'git',
      ['-c', 'http.lowSpeedLimit=1000', '-c', 'http.lowSpeedTime=8', 'clone', '--depth', '1', '--branch', upstream.branch ?? 'main', upstream.repo, tempCloneDir],
      { stdio: 'pipe', timeout: GIT_CLONE_TIMEOUT_MS }
    );
    const subPath = upstream.remoteSubdir ? path.join(tempCloneDir, upstream.remoteSubdir) : tempCloneDir;
    if (fs.existsSync(subPath)) return { remoteDir: subPath, tempCloneDir };
  } catch {
    cliPrint(`⚠️  [Fallback Local] Usando snapshot local para ${upstream.id}.`);
  }
  return { remoteDir: null, tempCloneDir };
}

function syncUpstreamSkills(upstream, targetSkillsDir, { offline, updateCache }) {
  const fallbackBase = path.join(HARNESS_ROOT, upstream.fallbackDir);
  const { remoteDir, tempCloneDir } = resolveRemoteSkillsDir(upstream, offline);
  const sourceBase = remoteDir ?? fallbackBase;
  const usedRemote = Boolean(remoteDir);
  for (const skillName of upstream.skills) {
    const candidate = path.join(sourceBase, skillName);
    const singleRoot = usedRemote && fs.existsSync(path.join(sourceBase, 'SKILL.md')) ? sourceBase : null;
    const srcSkill = fs.existsSync(candidate) ? candidate : (singleRoot ?? path.join(fallbackBase, skillName));
    if (fs.existsSync(srcSkill)) {
      if (usedRemote && updateCache) copyDirRecursive(srcSkill, path.join(fallbackBase, skillName));
      copyDirRecursive(srcSkill, path.join(targetSkillsDir, skillName));
    }
  }
  if (tempCloneDir && fs.existsSync(tempCloneDir)) fs.rmSync(tempCloneDir, { recursive: true, force: true });
}

/**
 * Copia os scripts determinísticos universais (templates/scripts/ + scan-clean-code.mjs) para scripts/.
 */
export function copyTemplateScripts(targetDir, { force = false } = {}) {
  const targetScriptsDir = path.join(targetDir, 'scripts');
  copyFlatFiles(path.join(HARNESS_ROOT, 'templates', 'scripts'), targetScriptsDir, { force });
  const cleanCodeScannerSrc = path.join(
    HARNESS_ROOT, 'skills', 'sovereign', 'clean-code-audit', 'scripts', 'scan-clean-code.mjs'
  );
  copyFileIfAllowed(cleanCodeScannerSrc, path.join(targetScriptsDir, 'scan-clean-code.mjs'), force);
}

function installDocsAndConfigs(targetDir, stack, force) {
  const cfgDir = path.join(HARNESS_ROOT, 'templates', 'configs');
  copyFileIfAllowed(path.join(cfgDir, 'ast-grep', 'sgconfig.yml'), path.join(targetDir, 'sgconfig.yml'), force);
  copyDirRecursive(path.join(cfgDir, 'ast-grep', 'rules'), path.join(targetDir, 'rules'));
  if (stack.language === 'typescript' || stack.language === 'javascript') {
    copyFileIfAllowed(path.join(cfgDir, 'knip.jsonc'), path.join(targetDir, 'knip.jsonc'), force);
    copyFileIfAllowed(path.join(cfgDir, '.dependency-cruiser.js'), path.join(targetDir, '.dependency-cruiser.js'), force);
  }
  copyFileIfAllowed(path.join(cfgDir, 'repomix.config.json'), path.join(targetDir, 'repomix.config.json'), force);
  copyFileIfAllowed(path.join(cfgDir, 'mcp-servers.template.json'), path.join(targetDir, '.agents', 'mcp-servers.template.json'), true);
  copyDirRecursive(path.join(HARNESS_ROOT, 'templates', 'github'), path.join(targetDir, '.github'));

  const docsTplDir = path.join(HARNESS_ROOT, 'templates', 'docs');
  const targetDocsDir = path.join(targetDir, 'docs');
  fs.mkdirSync(targetDocsDir, { recursive: true });
  for (const [tpl, dest] of [['PRD.template.md', 'PRD.md'], ['ARCHITECTURE.template.md', 'ARCHITECTURE.md'], ['DIRETRIZES_DOMINIO.template.md', 'DIRETRIZES_DOMINIO.md']]) {
    const destDoc = path.join(targetDocsDir, dest);
    if (!fs.existsSync(destDoc) || force) {
      fs.writeFileSync(destDoc, renderTemplate(fs.readFileSync(path.join(docsTplDir, tpl), 'utf-8'), stack), 'utf-8');
    }
  }
}

/**
 * Gera CLAUDE.md na raiz do projeto alvo e instala os subagentes nativos em .claude/agents/*.md.
 */
export function installMultiAgentBridge(targetDir, stack, { force = false } = {}) {
  const claudeTplPath = path.join(HARNESS_ROOT, 'templates', 'CLAUDE.template.md');
  const claudeDestPath = path.join(targetDir, 'CLAUDE.md');
  if (fs.existsSync(claudeTplPath) && (!fs.existsSync(claudeDestPath) || force)) {
    const rawClaude = fs.readFileSync(claudeTplPath, 'utf-8');
    fs.writeFileSync(claudeDestPath, renderTemplate(rawClaude, stack), 'utf-8');
  }
  copyFlatFiles(
    path.join(HARNESS_ROOT, 'templates', 'claude-agents'),
    path.join(targetDir, '.claude', 'agents'),
    { force, extFilter: '.md' }
  );
}

function writeHarnessAndConstitution(targetDir, stack, { force = false, agentHost = 'all' } = {}) {
  const harnessConfigPath = path.join(targetDir, 'harness.config.json');
  if (!fs.existsSync(harnessConfigPath) || force) {
    const payload = {
      harness: 'aegis-harness', version: '2.0.0', agentHost, language: stack.language,
      stackSummary: stack.stackSummary, testDomains: stack.testDomains, gates: stack.gates
    };
    fs.writeFileSync(harnessConfigPath, JSON.stringify(payload, null, 2), 'utf-8');
  }
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath) || force) {
    const raw = fs.readFileSync(path.join(HARNESS_ROOT, 'templates', 'AGENTS.template.md'), 'utf-8');
    fs.writeFileSync(agentsPath, renderTemplate(raw, stack), 'utf-8');
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const agentHost = detectAgentHost(opts.target, opts.agent);
  const stack = detectProjectStack(opts.target);
  const manifest = JSON.parse(fs.readFileSync(path.join(HARNESS_ROOT, 'sources.manifest.json'), 'utf-8'));
  const targetSkillsDir = path.join(opts.target, '.agents', 'skills');
  fs.mkdirSync(targetSkillsDir, { recursive: true });
  for (const upstream of manifest.upstreams) syncUpstreamSkills(upstream, targetSkillsDir, opts);
  copyTemplateScripts(opts.target, opts);
  installDocsAndConfigs(opts.target, stack, opts.force);
  writeHarnessAndConstitution(opts.target, stack, { force: opts.force, agentHost });
  if (agentHost === 'claude' || agentHost === 'all') {
    installMultiAgentBridge(opts.target, stack, opts);
  }
  cliPrint(`🎉 [Aegis Harness v2.0 | host=${agentHost}] Instalação concluída em ${opts.target}!`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
