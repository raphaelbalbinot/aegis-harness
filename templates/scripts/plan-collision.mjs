#!/usr/bin/env node
/**
 * scripts/plan-collision.mjs
 *
 * Radar determinístico de colisão de arquivos entre Implementation Plans paralelos.
 * Persiste o estado local em `.git/active-plans.json` (fora da árvore de working tree,
 * nunca poluindo `git status`), permitindo que múltiplas conversas detectem se outro
 * plano ativo reservou os mesmos arquivos antes do início do BUILD.
 *
 * Exemplos de uso:
 *   node scripts/plan-collision.mjs register --issue 50 --files frontend/src/a.ts,frontend/src/b.ts
 *   node scripts/plan-collision.mjs check --issue 51 --files frontend/src/a.ts
 *   node scripts/plan-collision.mjs release --issue 50
 *   node scripts/plan-collision.mjs list
 */

import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_PATH = path.resolve(process.cwd(), '.git', 'active-plans.json');

/**
 * Normaliza caminhos de arquivo para barras POSIX relativas à raiz do repositório.
 * Exemplo: normalizeFilePath('frontend\\src\\a.ts') === 'frontend/src/a.ts'
 *
 * @param {string} rawPath Caminho informado na CLI
 * @returns {string} Caminho POSIX relativo normalizado
 */
export function normalizeFilePath(rawPath) {
  const rel = path.isAbsolute(rawPath) ? path.relative(process.cwd(), rawPath) : rawPath;
  return rel.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

/**
 * Carrega o registro de planos ativos de `.git/active-plans.json`.
 * Exemplo: const state = loadActivePlans();
 *
 * @param {string} [registryFile] Caminho customizado opcional
 * @returns {{ plans: Record<string, { issue: string; files: string[]; updatedAt: string }> }}
 */
export function loadActivePlans(registryFile = REGISTRY_PATH) {
  if (!fs.existsSync(registryFile)) {
    return { plans: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    return parsed && typeof parsed.plans === 'object' ? parsed : { plans: {} };
  } catch {
    return { plans: {} };
  }
}

/**
 * Salva o registro de planos ativos em `.git/active-plans.json`.
 * Exemplo: saveActivePlans({ plans: {} });
 *
 * @param {{ plans: Record<string, { issue: string; files: string[]; updatedAt: string }> }} state
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
  const normalizedTarget = new Set(files.map(normalizeFilePath).filter(Boolean));
  const collisions = [];

  for (const [otherIssue, plan] of Object.entries(state.plans)) {
    if (String(otherIssue) === String(issueId)) continue;
    const overlappingFiles = (plan.files ?? []).filter((f) => normalizedTarget.has(normalizeFilePath(f)));
    if (overlappingFiles.length > 0) {
      collisions.push({ otherIssue, overlappingFiles });
    }
  }

  return {
    hasCollision: collisions.length > 0,
    collisions,
  };
}

function parseArgs(argv) {
  const action = argv[2] ?? 'list';
  let issue = '';
  const files = [];

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--issue' && argv[i + 1]) {
      issue = String(argv[++i]).replace(/^#/, '');
    } else if (arg === '--files' && argv[i + 1]) {
      const rawList = argv[++i];
      for (const part of rawList.split(',')) {
        const cleaned = normalizeFilePath(part);
        if (cleaned) files.push(cleaned);
      }
    }
  }
  return { action, issue, files: Array.from(new Set(files)) };
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

function handleRegisterOrCheck(params) {
  const { action, issue, files, state } = params;
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
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function runCli() {
  const { action, issue, files } = parseArgs(process.argv);
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
    process.stdout.write(JSON.stringify({ action: 'release', issue, released: true }, null, 2) + '\n');
    return;
  }

  process.stdout.write(JSON.stringify(state, null, 2) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))) {
  runCli();
}
