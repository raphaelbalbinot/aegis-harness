#!/usr/bin/env node
/**
 * scripts/plan-collision.mjs
 *
 * Radar determinístico de colisão de arquivos entre Implementation Plans paralelos
 * e Hard Sandbox de Whitelist (GF-01) para fatias concorrentes do Grafo DAG.
 * Persiste o estado local em `.git/active-plans.json` (fora da árvore de working tree).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const REGISTRY_PATH = path.resolve(process.cwd(), '.git', 'active-plans.json');

/**
 * Resolve o caminho do registro `.git/active-plans.json` para um diretório raiz.
 * @param {string} [rootDir]
 * @returns {string}
 */
function resolveRegistryPath(rootDir) {
  return rootDir ? path.resolve(rootDir, '.git', 'active-plans.json') : REGISTRY_PATH;
}

/**
 * Normaliza caminhos de arquivo para barras POSIX relativas à raiz do repositório.
 * Exemplo: normalizeFilePath('frontend\\src\\a.ts') === 'frontend/src/a.ts'
 *
 * @param {string} rawPath Caminho informado na CLI
 * @param {string} [rootDir] Diretório base opcional
 * @returns {string} Caminho POSIX relativo normalizado
 */
export function normalizeFilePath(rawPath, rootDir = process.cwd()) {
  const cleanedRaw = String(rawPath).replace(/^"+|"+$/g, '').trim();
  const rel = path.isAbsolute(cleanedRaw) ? path.relative(rootDir, cleanedRaw) : cleanedRaw;
  return rel.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

/**
 * Carrega o registro de planos e fatias ativos de `.git/active-plans.json`.
 * Exemplo: const state = loadActivePlans();
 *
 * @param {string} [registryFile] Caminho customizado opcional
 * @returns {{ plans: Record<string, any>; slices: Record<string, any> }}
 */
export function loadActivePlans(registryFile = REGISTRY_PATH) {
  if (!fs.existsSync(registryFile)) {
    return { plans: {}, slices: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    return {
      plans: parsed && typeof parsed.plans === 'object' ? parsed.plans : {},
      slices: parsed && typeof parsed.slices === 'object' ? parsed.slices : {},
    };
  } catch {
    return { plans: {}, slices: {} };
  }
}

/**
 * Salva o registro de planos e fatias ativos em `.git/active-plans.json`.
 * Exemplo: saveActivePlans({ plans: {}, slices: {} });
 *
 * @param {{ plans: Record<string, any>; slices?: Record<string, any> }} state
 * @param {string} [registryFile] Caminho customizado opcional
 */
export function saveActivePlans(state, registryFile = REGISTRY_PATH) {
  const dir = path.dirname(registryFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(registryFile, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Detecta colisões de arquivos entre a issue atual e os demais planos ativos.
 * Exemplo: const result = detectCollisions('51', ['frontend/src/a.ts'], state);
 *
 * @param {string} issueId ID da issue atual
 * @param {string[]} files Lista de arquivos impactados pelo plano
 * @param {{ plans: Record<string, { issue: string; files: string[]; updatedAt: string }> }} state
 * @returns {{ hasCollision: boolean; collisions: Array<{ otherIssue: string; overlappingFiles: string[] }> }}
 */
export function detectCollisions(issueId, files, state) {
  const normalizedTarget = new Set(files.map((f) => normalizeFilePath(f)).filter(Boolean));
  const collisions = [];

  for (const [otherIssue, plan] of Object.entries(state.plans)) {
    if (String(otherIssue) === String(issueId)) continue;
    const overlappingFiles = (plan.files ?? []).filter((f) => normalizedTarget.has(normalizeFilePath(f)));
    if (overlappingFiles.length > 0) {
      collisions.push({ otherIssue, overlappingFiles });
    }
  }

  return { hasCollision: collisions.length > 0, collisions };
}

/**
 * Extrai o caminho relativo de uma linha do `git status --porcelain`.
 * @param {string} line
 * @param {string} rootDir
 * @returns {string}
 */
function parsePorcelainLinePath(line, rootDir) {
  const rawEntry = line.slice(3).trim();
  const arrowIdx = rawEntry.indexOf(' -> ');
  const targetEntry = arrowIdx !== -1 ? rawEntry.slice(arrowIdx + 4) : rawEntry;
  return normalizeFilePath(targetEntry, rootDir);
}

/**
 * Lista arquivos modificados ou untracked no working tree via `git status --porcelain -uall`.
 * @param {string} rootDir
 * @returns {string[]}
 */
function getDirtyFiles(rootDir) {
  try {
    const status = execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: rootDir, encoding: 'utf8' });
    return status
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => parsePorcelainLinePath(line, rootDir))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Constrói o registro de snapshot de um único arquivo relativo ao `rootDir`.
 * @param {string} rootDir
 * @param {string} relPath
 */
function buildSingleFileSnapshot(rootDir, relPath) {
  const absPath = path.resolve(rootDir, relPath);
  if (!fs.existsSync(absPath)) {
    return { existed: false, sha256: null, contentBase64: null };
  }
  const buf = fs.readFileSync(absPath);
  return {
    existed: true,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    contentBase64: buf.toString('base64'),
  };
}

/**
 * Registra o baseline criptográfico (SHA-256 + Base64) antes da execução de uma fatia DAG (GF-01).
 * Exemplo: snapshotSliceBaseline({ sliceId: 'F1', allowedFiles: ['src/a.ts'] });
 *
 * @param {{ sliceId: string; allowedFiles?: string[]; rootDir?: string }} options
 */
export function snapshotSliceBaseline({ sliceId, allowedFiles = [], rootDir = process.cwd() }) {
  const registryFile = resolveRegistryPath(rootDir);
  const state = loadActivePlans(registryFile);
  const normalizedAllowed = allowedFiles.map((f) => normalizeFilePath(f, rootDir)).filter(Boolean);
  const relevantFiles = Array.from(new Set([...getDirtyFiles(rootDir), ...normalizedAllowed]));

  /** @type {Record<string, { existed: boolean; sha256: string | null; contentBase64: string | null }>} */
  const baselineFiles = {};
  for (const relPath of relevantFiles) {
    baselineFiles[relPath] = buildSingleFileSnapshot(rootDir, relPath);
  }

  state.slices[sliceId] = {
    sliceId,
    allowedFiles: normalizedAllowed,
    baselineFiles,
    createdAt: new Date().toISOString(),
  };
  saveActivePlans(state, registryFile);
  return state.slices[sliceId];
}

/**
 * Constrói a união de arquivos permitidos somando a fatia atual com todas as fatias paralelas ativas (GF-01).
 * @param {Record<string, any>} slicesMap
 * @param {string} sliceId
 * @param {string[]} currentAllowed
 * @returns {Set<string>}
 */
function buildUnionAllowedSet(state, sliceId, currentAllowed) {
  const slicesMap = state.slices ?? {};
  const sliceEntry = slicesMap[sliceId];
  const unionAllowed = new Set([...(sliceEntry?.allowedFiles ?? []), ...currentAllowed]);
  for (const [otherId, otherSlice] of Object.entries(slicesMap)) {
    if (otherId === sliceId) continue;
    for (const file of otherSlice.allowedFiles ?? []) {
      unionAllowed.add(file);
    }
  }
  for (const plan of Object.values(state.plans ?? {})) {
    for (const file of plan.files ?? []) {
      unionAllowed.add(normalizeFilePath(file));
    }
  }
  return unionAllowed;
}

/**
 * Verifica se um arquivo sofreu mutação em relação ao snapshot pré-fatia.
 * @param {{ rootDir: string; relPath: string; baselineFiles: Record<string, any>; dirtySet: Set<string> }} checkCtx
 * @returns {boolean}
 */
function isFileModifiedSinceBaseline({ rootDir, relPath, baselineFiles, dirtySet }) {
  const baseEntry = baselineFiles[relPath];
  if (!baseEntry) {
    return dirtySet.has(relPath);
  }
  const absPath = path.resolve(rootDir, relPath);
  if (!fs.existsSync(absPath)) {
    return Boolean(baseEntry.existed);
  }
  const currentSha = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
  return currentSha !== baseEntry.sha256;
}

/**
 * Restaura um arquivo modificado sem autorização para o estado exato pré-fatia (Zero Data Loss - GF-01).
 * @param {string} rootDir
 * @param {string} relPath
 * @param {{ existed: boolean; sha256: string | null; contentBase64: string | null } | undefined} baseEntry
 */
function revertSingleUnauthorizedFile(rootDir, relPath, baseEntry) {
  const absPath = path.resolve(rootDir, relPath);
  if (baseEntry) {
    if (baseEntry.existed && baseEntry.contentBase64 !== null) {
      fs.writeFileSync(absPath, Buffer.from(baseEntry.contentBase64, 'base64'));
    } else if (!baseEntry.existed && fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
    return;
  }
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relPath], { cwd: rootDir, stdio: 'ignore' });
    execFileSync('git', ['checkout', 'HEAD', '--', relPath], { cwd: rootDir });
  } catch {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  }
}

/**
 * Verifica o confinamento de arquivos pós-execução de uma fatia DAG e reverte intrusos se solicitado (GF-01).
 * Exemplo: verifySliceWhitelist({ sliceId: 'F1', revertUnauthorized: true });
 *
 * @param {{ sliceId: string; allowedFiles?: string[]; revertUnauthorized?: boolean; rootDir?: string }} options
 */
export function verifySliceWhitelist({ sliceId, allowedFiles = [], revertUnauthorized = false, rootDir = process.cwd() }) {
  const registryFile = resolveRegistryPath(rootDir);
  const state = loadActivePlans(registryFile);
  const sliceEntry = state.slices[sliceId];
  if (!sliceEntry) {
    return { ok: false, sliceId, unauthorizedFiles: [], reverted: [], error: 'Slice not found' };
  }

  const normalizedExtra = allowedFiles.map((f) => normalizeFilePath(f, rootDir)).filter(Boolean);
  const unionAllowed = buildUnionAllowedSet(state, sliceId, normalizedExtra);
  const dirtyFiles = getDirtyFiles(rootDir);
  const dirtySet = new Set(dirtyFiles);
  const baselineFiles = sliceEntry.baselineFiles ?? {};
  const filesToCheck = Array.from(new Set([...dirtyFiles, ...Object.keys(baselineFiles)]));

  const unauthorizedFiles = filesToCheck.filter(
    (relPath) => isFileModifiedSinceBaseline({ rootDir, relPath, baselineFiles, dirtySet }) && !unionAllowed.has(relPath),
  );
  const reverted = [];
  if (revertUnauthorized) {
    for (const relPath of unauthorizedFiles) {
      revertSingleUnauthorizedFile(rootDir, relPath, baselineFiles[relPath]);
      reverted.push(relPath);
    }
  }

  const ok = unauthorizedFiles.length === 0;
  if (ok || revertUnauthorized) {
    delete state.slices[sliceId];
    saveActivePlans(state, registryFile);
  }
  return { ok, sliceId, unauthorizedFiles, reverted };
}

function parseArgs(argv) {
  const action = argv[2] ?? 'list';
  let issue = '';
  let slice = '';
  let revertUnauthorized = false;
  const files = [];

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--issue' && argv[i + 1]) issue = String(argv[++i]).replace(/^#/, '');
    else if (arg === '--slice' && argv[i + 1]) slice = String(argv[++i]);
    else if (arg === '--revert-unauthorized') revertUnauthorized = true;
    else if (arg === '--files' && argv[i + 1]) {
      const parts = argv[++i].split(',').map((p) => normalizeFilePath(p)).filter(Boolean);
      files.push(...parts);
    }
  }
  return { action, issue, slice, revertUnauthorized, files: Array.from(new Set(files)) };
}

function formatCollisionBanner(report) {
  if (!report.hasCollision) {
    return '🟢 ZERO COLISÃO PARALELA: Nenhum arquivo deste plano colide com planos ativos em outras conversas.';
  }
  const summary = report.collisions
    .map((c) => `Issue #${c.otherIssue} (${c.overlappingFiles.join(', ')})`)
    .join('; ');
  return `⚠️ ALERTA DE COLISÃO PARALELA: Conflito com ${summary}`;
}

function handleRegisterOrCheck({ action, issue, files, state }) {
  if (!issue) {
    process.stderr.write('Erro: informe --issue <ID>\n');
    process.exit(1);
  }
  const report = detectCollisions(issue, files, state);
  if (action === 'register') {
    state.plans[issue] = { issue, files, updatedAt: new Date().toISOString() };
    saveActivePlans(state);
  }
  const payload = {
    action,
    issue,
    registeredFiles: files,
    hasCollision: report.hasCollision,
    collisions: report.collisions,
    statusBanner: formatCollisionBanner(report),
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function handleSliceCliAction({ action, slice, files, revertUnauthorized }) {
  if (!slice) {
    process.stderr.write('Erro: informe --slice <ID>\n');
    process.exit(1);
  }
  if (action === 'snapshot-slice') {
    const res = snapshotSliceBaseline({ sliceId: slice, allowedFiles: files });
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return;
  }
  const res = verifySliceWhitelist({ sliceId: slice, allowedFiles: files, revertUnauthorized });
  process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  if (!res.ok) process.exit(1);
}

function runCli() {
  const { action, issue, slice, revertUnauthorized, files } = parseArgs(process.argv);
  const state = loadActivePlans();

  if (action === 'register' || action === 'check') {
    handleRegisterOrCheck({ action, issue, files, state });
    return;
  }
  if (action === 'release') {
    if (!issue) {
      process.stderr.write('Erro: informe --issue <ID>\n');
      process.exit(1);
    }
    delete state.plans[issue];
    saveActivePlans(state);
    process.stdout.write(`${JSON.stringify({ action: 'release', issue, released: true }, null, 2)}\n`);
    return;
  }
  if (action === 'snapshot-slice' || action === 'verify-slice') {
    handleSliceCliAction({ action, slice, files, revertUnauthorized });
    return;
  }
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))) {
  runCli();
}
