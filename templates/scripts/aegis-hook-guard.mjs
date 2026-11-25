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
const MIN_CONFIDENCE_PERCENT = 95;
const CONFIDENCE_HEADER_RE = /^##\s+.*(?:Confidence Gate|Gate de Certeza)/im;
const CONFIDENCE_LT_95_RE = /<\s*95\s*%/i;
const CONFIDENCE_PCT_RE = /(\d+(?:[.,]\d+)?)\s*%/g;
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
 * Retorna o SHA atual de `HEAD` (ou string vazia se o repositório ainda não tiver commits).
 * @param {string} repoRoot
 * @returns {string}
 */
function resolveCurrentHeadSha(repoRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Grava com merge JSON um carimbo determinístico em `.git/aegis-gate-stamp.json` (GF-03).
 * Vinculado ao `HEAD` atual (sem expiração por relógio/TTL).
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
  const headSha = resolveCurrentHeadSha(repoRoot);
  const updated = { ...current, [fieldName]: Date.now(), ...(headSha ? { headSha } : {}) };
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
 * Valida a seção obrigatória `## 🎯 Confidence Gate (≥ 95%)` em `implementation_plan.md` (Regra 1.2).
 * @param {string} planText
 * @returns {{ ok: boolean; reason?: string }}
 */
function evaluateConfidenceGate(planText) {
  const headerMatch = CONFIDENCE_HEADER_RE.exec(planText);
  if (!headerMatch) {
    return {
      ok: false,
      reason:
        'BLOQUEADO PELA REGRA 1.2 (Confidence Gate ≥ 95%): Proibido usar RequestFeedback: true em implementation_plan.md sem a seção "## 🎯 Confidence Gate (≥ 95%)" declarando certeza >= 95% em todos os pontos críticos (inclusive em XS_EXPRESS).',
    };
  }
  const afterHeader = planText.slice(headerMatch.index + headerMatch[0].length);
  const nextSectionIdx = afterHeader.search(/\r?\n##\s+/);
  const sectionBody = nextSectionIdx === -1 ? afterHeader : afterHeader.slice(0, nextSectionIdx);

  if (CONFIDENCE_LT_95_RE.test(sectionBody)) {
    return {
      ok: false,
      reason:
        'BLOQUEADO PELA REGRA 1.2 (Confidence Gate ≥ 95%): Detectado item com certeza "< 95%" na seção Confidence Gate. Pare e alinhe a decisão com o usuário (via interview-me / ask_question) antes de pedir Proceed.',
    };
  }

  const percentages = Array.from(sectionBody.matchAll(CONFIDENCE_PCT_RE), (m) =>
    Number.parseFloat(m[1].replace(',', '.'))
  ).filter((n) => Number.isFinite(n));

  if (percentages.length === 0) {
    return {
      ok: false,
      reason:
        'BLOQUEADO PELA REGRA 1.2 (Confidence Gate ≥ 95%): A seção "## 🎯 Confidence Gate (≥ 95%)" deve declarar explicitamente o percentual de certeza (>= 95%) para os pontos críticos.',
    };
  }

  const lowScore = percentages.find((pct) => pct < MIN_CONFIDENCE_PERCENT);
  if (lowScore !== undefined) {
    return {
      ok: false,
      reason: `BLOQUEADO PELA REGRA 1.2 (Confidence Gate ≥ 95%): Detectado ponto com ${lowScore}% de certeza (< ${MIN_CONFIDENCE_PERCENT}%). Resolva a ambiguidade com o usuário antes de pedir Proceed.`,
    };
  }
  return { ok: true };
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

  const resultingText = simulatePlanContent(args);
  const confidenceCheck = evaluateConfidenceGate(resultingText);
  if (!confidenceCheck.ok) {
    return { decision: 'deny', reason: confidenceCheck.reason };
  }

  const stamp = readGateStamp(repoRoot);
  if (stamp?.blastRadiusEvaluation?.planGoldfishRequired === false) {
    return { decision: 'allow' };
  }

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
 * Avalia chamadas `run_command` que disparam `git commit` contra `.git/aegis-gate-stamp.json` (GF-03).
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
  const currentHead = resolveCurrentHeadSha(repoRoot);
  const headChanged = Boolean(stamp.headSha && currentHead && stamp.headSha !== currentHead);
  const missingVerify = Number(stamp.auditVerifyPassedAt ?? 0) <= 0;
  const missingReview = Number(stamp.reviewDossierGeneratedAt ?? 0) <= 0;
  if (headChanged || missingVerify || (!isDocsOnlyCommit(stamp?.blastRadiusEvaluation, stagedFiles) && missingReview)) {
    return {
      decision: 'deny',
      reason: 'BLOQUEADO PELAS REGRAS 1.3 e 1.4: Carimbo de pré-commit ausente ou desatualizado para o HEAD atual. Execute audit-verify e review (+ 2º Goldfish) antes de commitar.',
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
  if (argv.includes('--pre-commit')) {
    const res = evaluateGitCommitGuard(repoRoot, { CommandLine: 'git commit' });
    if (res.decision === 'deny') {
      process.stderr.write(`❌ [aegis-hook-guard] ${res.reason}\n`);
      process.exit(1);
    }
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
