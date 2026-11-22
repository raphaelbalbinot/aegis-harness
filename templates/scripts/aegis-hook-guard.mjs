#!/usr/bin/env node
// @ts-check
/**
 * scripts/aegis-hook-guard.mjs — Fiscal Determinístico Nativo do Aegis Harness
 *
 * Responsabilidades:
 * 1. PreToolUse (write_file | edit_file | multi_edit_file): Bloqueia `RequestFeedback: true`
 *    em `implementation_plan.md` sem `## 🐠 Relatório Cold Spec Review` e `GF-01` (GF-01, GF-02).
 * 2. PreToolUse (run_command com `git commit`): Bloqueia commit sem `.git/aegis-gate-stamp.json` (GF-03).
 * 3. Diagnóstico de Colisão Paralela (`diagnoseParallelIssueBlocker` — GF-09, GF-10, GF-12).
 * 4. CLI (`--check-rules` / `--stamp-verify` / `--stamp-review` / `--diagnose-blocker`).
 */

import { execFileSync } from 'node:child_process';
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
const GIT_COMMIT_ALL_FLAG_RE = /(?:^|[;&|]\s*)git\s+commit\b[^;&|]*(?:\s-(?:[a-zA-Z]*a[a-zA-Z]*)|--all)\b/i;

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
 * Extrai entradas de planos ativos suportando tanto `state.plans` (Node) quanto chaves de topo (Python) (GF-09).
 * @param {Record<string, any>} rawState
 * @returns {Array<{ issueId: string; files: string[] }>}
 */
function extractActiveIssueEntries(rawState) {
  const entries = [];
  const plansObj = rawState?.plans && typeof rawState.plans === 'object' ? rawState.plans : {};
  for (const [key, item] of Object.entries(plansObj)) {
    if (item && Array.isArray(item.files)) {
      entries.push({ issueId: String(item.issue ?? key), files: item.files });
    }
  }
  for (const [key, item] of Object.entries(rawState ?? {})) {
    if (key === 'plans' || key === 'slices') continue;
    if (item && typeof item === 'object' && Array.isArray(item.files)) {
      entries.push({ issueId: String(item.issue ?? key), files: item.files });
    }
  }
  return entries;
}

/**
 * Filtra os arquivos de uma entrada de Issue que aparecem mencionados na saída de erro.
 * @param {string[]} rawFiles
 * @param {string} normError
 * @returns {string[]}
 */
function findMatchingEntryFiles(rawFiles, normError) {
  return rawFiles
    .map((rawFile) => String(rawFile).replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter((normFile) => Boolean(normFile) && normError.includes(normFile));
}

/**
 * Diagnostica se uma falha do `audit-verify` ocorreu em arquivo pertencente a outra Issue paralela em `.git/active-plans.json` (GF-09, GF-10).
 * @param {string} repoRoot
 * @param {string} errorOutput
 * @param {string} [currentIssueId]
 */
export function diagnoseParallelIssueBlocker(repoRoot, errorOutput, currentIssueId = '') {
  const activePlansPath = path.join(repoRoot, '.git', 'active-plans.json');
  const emptyResult = { blockedByParallelIssue: false, conflictingIssues: [], matchedFiles: [], banner: '' };
  if (!fs.existsSync(activePlansPath) || !errorOutput) return emptyResult;

  let rawState = {};
  try {
    rawState = JSON.parse(fs.readFileSync(activePlansPath, 'utf8'));
  } catch {
    return emptyResult;
  }
  const allEntries = extractActiveIssueEntries(rawState);
  if (!currentIssueId && allEntries.length <= 1) return emptyResult;

  const normError = String(errorOutput).replace(/\\/g, '/');
  const conflictingIssues = new Set();
  const matchedFiles = new Set();

  for (const entry of allEntries) {
    if (currentIssueId && entry.issueId === String(currentIssueId)) continue;
    const hits = findMatchingEntryFiles(entry.files, normError);
    if (hits.length > 0) {
      conflictingIssues.add(entry.issueId);
      hits.forEach((f) => matchedFiles.add(f));
    }
  }
  if (conflictingIssues.size === 0) return emptyResult;
  const issuesList = Array.from(conflictingIssues);
  const filesList = Array.from(matchedFiles);
  const banner = `⏸️ [BLOQUEIO POR ISSUE PARALELA EM ANDAMENTO (#${issuesList.join(', #')})]: A falha ocorreu em arquivo(s) em edição ativa por outra conversa (${filesList.join(', ')}). Nenhum teste é ignorado: conclua o passo GREEN na outra aba antes de finalizar o audit-verify e o commit.`;
  return { blockedByParallelIssue: true, conflictingIssues: issuesList, matchedFiles: filesList, banner };
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
 * Verifica se todos os arquivos de regra respeitam `MAX_RULE_FILE_BYTES` (22 KB).
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
 * Lê `.git/aegis-gate-stamp.json` de forma segura.
 * @param {string} repoRoot
 * @returns {Record<string, any>}
 */
function readGateStamp(repoRoot) {
  const stampPath = path.join(repoRoot, '.git', 'aegis-gate-stamp.json');
  if (!fs.existsSync(stampPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Lista arquivos em staging (`git diff --cached --name-only`) sem interpolação de shell (CWE-78).
 * @param {string} repoRoot
 * @returns {string[] | null}
 */
function listStagedFiles(repoRoot) {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Avalia chamadas `write_file` / `edit_file` / `multi_edit_file` sobre `implementation_plan.md`.
 * @param {string} repoRoot
 * @param {Record<string, any>} args
 * @returns {{ decision: 'allow' | 'deny'; reason?: string }}
 */
function evaluatePlanWriteGuard(repoRoot, args) {
  const targetPath = String(args.Path ?? args.TargetFile ?? '').replace(/\\/g, '/');
  if (!targetPath.endsWith('/implementation_plan.md') && targetPath !== 'implementation_plan.md') {
    return { decision: 'allow' };
  }
  const reqFeedback = Boolean(args.ArtifactMetadata?.RequestFeedback);
  if (!reqFeedback) return { decision: 'allow' };

  const stamp = readGateStamp(repoRoot);
  const evalMeta = stamp?.blastRadiusEvaluation;
  const evalFresh = evalMeta && Date.now() - Number(evalMeta.evaluatedAt ?? 0) <= STAMP_MAX_AGE_MS;
  if (evalFresh && evalMeta.planGoldfishRequired === false) {
    return { decision: 'allow' };
  }

  const resultingText = simulatePlanContent(args);
  const hasGoldfishSection = GOLDFISH_HEADER_RE.test(resultingText) && GOLDFISH_ROW_RE.test(resultingText);
  if (!hasGoldfishSection) {
    return {
      decision: 'deny',
      reason:
        'BLOQUEADO PELA REGRA 1.3 (Protocolo Semáforo Goldfish): Proibido usar RequestFeedback: true em implementation_plan.md antes de executar o 1º Portão Goldfish (Cold Spec Review) e incluir a tabela "## 🐠 Relatório Cold Spec Review" com GF-01 (ou comprovar Tier 0 XS_EXPRESS via blast-radius).',
    };
  }
  return { decision: 'allow' };
}

/**
 * Valida se o staging no Fast-Path Tier 0 contém apenas arquivos avaliados pelo blast-radius.
 * @param {Record<string, any> | undefined} evalMeta
 * @param {string[] | null} stagedFiles
 * @returns {{ decision: 'allow' | 'deny'; reason?: string } | null}
 */
function checkFastPathStagedFiles(evalMeta, stagedFiles) {
  if (!evalMeta || evalMeta.planGoldfishRequired !== false) return null;
  if (!Array.isArray(stagedFiles) || stagedFiles.length === 0) return null;
  const allowedSet = new Set(
    (evalMeta.evaluatedFiles ?? []).map((/** @type {string} */ f) => String(f).replace(/\\/g, '/').replace(/^\.\//, ''))
  );
  const unauthorized = stagedFiles.filter((f) => !allowedSet.has(f));
  if (unauthorized.length === 0) return null;
  return {
    decision: 'deny',
    reason: `BLOQUEADO (Trava Anti-Burla Fast-Path): O staging contém arquivo(s) não avaliados no Tier 0 (${unauthorized.join(', ')}). Re-execute blast-radius.mjs e cumpra o portão FULL_EGM_DAG antes de fazer commit.`,
  };
}

/**
 * Verifica se o commit contém exclusivamente arquivos Markdown quando o blast-radius dispensou 2º Goldfish.
 * @param {Record<string, any> | undefined} evalMeta
 * @param {string[] | null} stagedFiles
 * @returns {boolean}
 */
function isDocsOnlyCommit(evalMeta, stagedFiles) {
  if (evalMeta?.codeGoldfishRequired !== false) return false;
  return Array.isArray(stagedFiles) && stagedFiles.length > 0 && stagedFiles.every((f) => f.endsWith('.md'));
}

/**
 * Avalia chamadas `run_command` que disparam `git commit` contra `.git/aegis-gate-stamp.json` e `git diff --cached` (GF-03).
 * @param {string} repoRoot
 * @param {Record<string, any>} args
 * @returns {{ decision: 'allow' | 'deny'; reason?: string }}
 */
function evaluateGitCommitGuard(repoRoot, args) {
  const cmdLine = String(args.CommandLine ?? args.command ?? '');
  if (!GIT_COMMIT_CMD_RE.test(cmdLine)) return { decision: 'allow' };
  if (GIT_COMMIT_ALL_FLAG_RE.test(cmdLine)) {
    return {
      decision: 'deny',
      reason: 'BLOQUEADO PELA REGRA 1.1: Proibido usar `git commit -a` / `--all`. Faça staging cirúrgico (`git add <arqs>`).',
    };
  }
  const stampPath = path.join(repoRoot, '.git', 'aegis-gate-stamp.json');
  if (!fs.existsSync(stampPath)) {
    return {
      decision: 'deny',
      reason: 'BLOQUEADO PELAS REGRAS 1.3 e 1.4: Nenhum carimbo (.git/aegis-gate-stamp.json) encontrado. Execute audit-verify e review antes de commitar.',
    };
  }
  const stamp = readGateStamp(repoRoot);
  const stagedFiles = listStagedFiles(repoRoot);
  const fastPathViolation = checkFastPathStagedFiles(stamp?.blastRadiusEvaluation, stagedFiles);
  if (fastPathViolation) return fastPathViolation;

  const now = Date.now();
  const verifyExpired = now - Number(stamp.auditVerifyPassedAt ?? 0) > STAMP_MAX_AGE_MS;
  const reviewExpired = now - Number(stamp.reviewDossierGeneratedAt ?? 0) > STAMP_MAX_AGE_MS;
  if (verifyExpired || (!isDocsOnlyCommit(stamp?.blastRadiusEvaluation, stagedFiles) && reviewExpired)) {
    return {
      decision: 'deny',
      reason: 'BLOQUEADO PELAS REGRAS 1.3 e 1.4: Carimbo de pré-commit incompleto ou expirado. Execute audit-verify e review (+ 2º Goldfish) antes de commitar.',
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
    return evaluatePlanWriteGuard(repoRoot, args);
  }
  if (toolName === 'run_command' || toolName === 'bash') {
    return evaluateGitCommitGuard(repoRoot, args);
  }
  return { decision: 'allow' };
}

/**
 * Executa os modos CLI (`--check-rules`, `--stamp-verify`, `--stamp-review`, `--diagnose-blocker`) ou o modo Hook stdin.
 * @param {string[]} argv
 */
function runCliOrHook(argv) {
  const repoRoot = resolveRepoRoot(process.cwd());
  if (argv.includes('--stamp-verify')) return recordGateStamp(repoRoot, 'auditVerifyPassedAt');
  if (argv.includes('--stamp-review')) return recordGateStamp(repoRoot, 'reviewDossierGeneratedAt');
  if (argv.includes('--diagnose-blocker')) {
    const diagIdx = argv.indexOf('--diagnose-blocker');
    const diag = diagnoseParallelIssueBlocker(repoRoot, String(argv[diagIdx + 1] ?? ''), String(argv[diagIdx + 2] ?? ''));
    if (diag.blockedByParallelIssue) process.stderr.write(`${diag.banner}\n`);
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
  process.stdout.write(`${JSON.stringify(evaluatePreToolUseHook(payload))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runCliOrHook(process.argv.slice(2));
  } catch {
    process.stdout.write(`${JSON.stringify({ decision: 'allow' })}\n`);
  }
}
