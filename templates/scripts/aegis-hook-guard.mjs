#!/usr/bin/env node
// @ts-check
/**
 * scripts/aegis-hook-guard.mjs — Fiscal Determinístico Nativo do Aegis Harness
 *
 * Responsabilidades:
 * 1. PreToolUse (write_file | edit_file | multi_edit_file): Bloqueia `RequestFeedback: true`
 *    em `implementation_plan.md` caso a seção `## 🐠 Relatório Cold Spec Review` e `GF-01`
 *    ainda não estejam presentes no documento resultante (GF-01, GF-02).
 * 2. PreToolUse (run_command com `git commit`): Bloqueia o commit caso `.git/aegis-gate-stamp.json`
 *    não contenha ambos os carimbos (`auditVerifyPassedAt` e `reviewDossierGeneratedAt`) válidos (GF-03).
 * 3. CLI (`--check-rules` / `--stamp-verify` / `--stamp-review`): Valida que `AGENTS.md` e
 *    `.agent(s)/rules/*.md` respeitam o teto de 22.000 bytes (< 24 KB limite do Antigravity).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_RULE_FILE_BYTES = 22000;
const STAMP_MAX_AGE_MS = 2700000;
const GOLDFISH_HEADER_RE = /##\s+.*Cold Spec Review/i;
const GOLDFISH_ROW_RE = /\|\s*\*{0,2}GF-01\*{0,2}\s*\|/i;
const GIT_COMMIT_CMD_RE = /(?:^|[;&|]\s*)git\s+commit\b/i;

/**
 * Resolve o diretório raiz do repositório a partir de `cwd` do payload ou da posição do script (GF-01).
 * @param {string} [candidateCwd]
 * @returns {string}
 */
export function resolveRepoRoot(candidateCwd) {
  if (candidateCwd && fs.existsSync(path.join(candidateCwd, '.git'))) {
    return candidateCwd;
  }
  const parentFromScript = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(parentFromScript, '.git'))) {
    return parentFromScript;
  }
  return candidateCwd ?? process.cwd();
}

/**
 * Grava com merge JSON um carimbo determinístico em `.git/aegis-gate-stamp.json` (GF-03).
 * @param {string} repoRoot
 * @param {'auditVerifyPassedAt' | 'reviewDossierGeneratedAt'} fieldName
 */
export function recordGateStamp(repoRoot, fieldName) {
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) return;
  const stampPath = path.join(gitDir, 'aegis-gate-stamp.json');
  let current = {};
  if (fs.existsSync(stampPath)) {
    try {
      current = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
    } catch {
      current = {};
    }
  }
  const updated = { ...current, [fieldName]: Date.now() };
  fs.writeFileSync(stampPath, JSON.stringify(updated, null, 2), 'utf8');
}

/**
 * Coleta os caminhos de arquivos de regras (`AGENTS.md`, `.agents/rules/*.md`, `.agent/rules/*.md`).
 * @param {string} repoRoot
 * @returns {string[]}
 */
function listRuleFiles(repoRoot) {
  const found = [];
  for (const rootCandidate of ['AGENTS.md', 'templates/AGENTS.template.md']) {
    const abs = path.join(repoRoot, rootCandidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) found.push(abs);
  }
  for (const dirRel of ['.agents/rules', '.agent/rules']) {
    const absDir = path.join(repoRoot, dirRel);
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) continue;
    for (const entry of fs.readdirSync(absDir)) {
      if (entry.endsWith('.md')) found.push(path.join(absDir, entry));
    }
  }
  return found;
}

/**
 * Verifica se todos os arquivos de regra respeitam `MAX_RULE_FILE_BYTES` (22.000 bytes).
 * @param {string} repoRoot
 * @returns {{ ok: boolean; violations: Array<{ file: string; bytes: number }> }}
 */
export function checkRuleFilesBudget(repoRoot) {
  const violations = [];
  for (const absPath of listRuleFiles(repoRoot)) {
    const bytes = fs.statSync(absPath).size;
    if (bytes > MAX_RULE_FILE_BYTES) {
      violations.push({
        file: path.relative(repoRoot, absPath).replace(/\\/g, '/'),
        bytes,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Simula em memória o conteúdo resultante de `write_file`, `edit_file` ou `multi_edit_file` (GF-02).
 * @param {Record<string, any>} args
 * @returns {string}
 */
function simulatePlanContent(args) {
  if (typeof args.Content === 'string') return args.Content;
  const targetPath = String(args.Path ?? args.TargetFile ?? '');
  let baseText = targetPath && fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
  const oldStr = args.Target ?? args.OldString;
  const newStr = args.Replacement ?? args.NewString;
  if (typeof oldStr === 'string' && typeof newStr === 'string') {
    baseText = baseText.includes(oldStr) ? baseText.replace(oldStr, newStr) : `${baseText}\n${newStr}`;
  }
  if (Array.isArray(args.Edits)) {
    for (const edit of args.Edits) {
      const eOld = edit.Target ?? edit.OldString ?? '';
      const eNew = edit.Replacement ?? edit.NewString ?? '';
      baseText = eOld && baseText.includes(eOld) ? baseText.replace(eOld, eNew) : `${baseText}\n${eNew}`;
    }
  }
  return baseText;
}

/**
 * Avalia chamadas `write_file` / `edit_file` / `multi_edit_file` sobre `implementation_plan.md`.
 * @param {Record<string, any>} args
 * @returns {{ decision: 'allow' | 'deny'; reason?: string }}
 */
function evaluatePlanWriteGuard(args) {
  const targetPath = String(args.Path ?? args.TargetFile ?? '').replace(/\\/g, '/');
  if (!targetPath.endsWith('/implementation_plan.md') && targetPath !== 'implementation_plan.md') {
    return { decision: 'allow' };
  }
  const reqFeedback = Boolean(args.ArtifactMetadata?.RequestFeedback);
  if (!reqFeedback) return { decision: 'allow' };

  const resultingText = simulatePlanContent(args);
  const hasGoldfishSection = GOLDFISH_HEADER_RE.test(resultingText) && GOLDFISH_ROW_RE.test(resultingText);
  if (!hasGoldfishSection) {
    return {
      decision: 'deny',
      reason:
        'BLOQUEADO PELA REGRA 1.3.7 (Protocolo Semáforo Goldfish): Proibido usar RequestFeedback: true em implementation_plan.md antes de executar o 1º Portão Goldfish (Cold Spec Review) e incluir a tabela "## 🐠 Relatório Cold Spec Review" com GF-01. Grave o rascunho com RequestFeedback: false, invoque o subagente Goldfish e só habilite RequestFeedback: true após consolidar os achados.',
    };
  }
  return { decision: 'allow' };
}

/**
 * Avalia chamadas `run_command` que disparam `git commit` contra `.git/aegis-gate-stamp.json` (GF-03).
 * @param {string} repoRoot
 * @param {Record<string, any>} args
 * @returns {{ decision: 'allow' | 'deny'; reason?: string }}
 */
function evaluateGitCommitGuard(repoRoot, args) {
  const cmdLine = String(args.CommandLine ?? args.command ?? '');
  if (!GIT_COMMIT_CMD_RE.test(cmdLine)) return { decision: 'allow' };

  const stampPath = path.join(repoRoot, '.git', 'aegis-gate-stamp.json');
  if (!fs.existsSync(stampPath)) {
    return {
      decision: 'deny',
      reason:
        'BLOQUEADO PELAS REGRAS 1.16 e 1.18: Nenhum carimbo de validação final (.git/aegis-gate-stamp.json) encontrado. Execute audit-verify e review.mjs/review.ps1 (+ 2º Portão Goldfish) antes de fazer git commit.',
    };
  }
  let stamp = {};
  try {
    stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  } catch {
    stamp = {};
  }
  const now = Date.now();
  const verifyAge = now - Number(stamp.auditVerifyPassedAt ?? 0);
  const reviewAge = now - Number(stamp.reviewDossierGeneratedAt ?? 0);
  if (verifyAge > STAMP_MAX_AGE_MS || reviewAge > STAMP_MAX_AGE_MS) {
    return {
      decision: 'deny',
      reason:
        'BLOQUEADO PELAS REGRAS 1.16 e 1.18: Carimbo de pré-commit incompleto ou expirado em .git/aegis-gate-stamp.json. Execute ambos os portões finais (audit-verify e review.mjs/review.ps1 + 2º Goldfish) antes de executar git commit.',
    };
  }
  return { decision: 'allow' };
}

/**
 * Avalia o payload `PreToolUse` do Antigravity / Claude Code (GF-01, GF-02, GF-03).
 * @param {Record<string, any>} payload
 * @returns {{ decision: 'allow' | 'deny'; reason?: string }}
 */
export function evaluatePreToolUseHook(payload) {
  const toolName = String(payload?.toolCall?.name ?? '').toLowerCase();
  const args = payload?.toolCall?.args ?? {};
  const repoRoot = resolveRepoRoot(payload?.cwd);

  if (toolName === 'write_file' || toolName === 'edit_file' || toolName === 'multi_edit_file') {
    return evaluatePlanWriteGuard(args);
  }
  if (toolName === 'run_command' || toolName === 'bash') {
    return evaluateGitCommitGuard(repoRoot, args);
  }
  return { decision: 'allow' };
}

/**
 * Executa os modos CLI (`--check-rules`, `--stamp-verify`, `--stamp-review`) ou o modo Hook stdin.
 * @param {string[]} argv
 */
function runCliOrHook(argv) {
  const repoRoot = resolveRepoRoot(process.cwd());
  if (argv.includes('--stamp-verify')) {
    recordGateStamp(repoRoot, 'auditVerifyPassedAt');
    return;
  }
  if (argv.includes('--stamp-review')) {
    recordGateStamp(repoRoot, 'reviewDossierGeneratedAt');
    return;
  }
  if (argv.includes('--check-rules')) {
    const res = checkRuleFilesBudget(repoRoot);
    if (!res.ok) {
      const details = res.violations.map((v) => `${v.file} (${v.bytes} B > ${MAX_RULE_FILE_BYTES} B)`).join(', ');
      process.stderr.write(`❌ [aegis-hook-guard] Violação de limite de 22 KB nas Rules: ${details}\n`);
      process.exit(1);
    }
    process.stdout.write(`✅ [aegis-hook-guard] Todas as Rules respeitam o teto de ${MAX_RULE_FILE_BYTES} bytes.\n`);
    return;
  }
  const rawStdin = fs.readFileSync(0, 'utf8').trim();
  const payload = rawStdin ? JSON.parse(rawStdin) : {};
  const out = evaluatePreToolUseHook(payload);
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runCliOrHook(process.argv.slice(2));
  } catch {
    process.stdout.write(`${JSON.stringify({ decision: 'allow' })}\n`);
  }
}
