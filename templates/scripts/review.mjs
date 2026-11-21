#!/usr/bin/env node
/**
 * scripts/review.mjs
 *
 * Motor universal Multi-OS (Windows, Linux, macOS, Containers) do 2º Portão EGM Goldfish.
 * Extrai especificações BDD Gherkin (via GitHub Issue `--issue` ou plano local `--plan`),
 * diff git com contexto de função (`execFileSync`, CWE-78 safe) e pré-injeta telemetria
 * determinística (`scan-clean-code.mjs`) em `scratch/review_prompt.md`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { computeIssueFinOpsMarkdown } from './aegis-finops-telemetry.mjs';

const BDD_LINE_REGEX =
  /^\s*(?:#{1,6}\s+|\d+\.\s+|[-*]\s+)?(?:\*\*|__)?(?:Cen[aá]rio|Dado|Quando|Ent[aã]o|E\s)(?:\*\*|__|:|\b)/i;

const DEFAULT_DIFF_EXCLUDES = [
  ':/',
  ':(exclude):/package-lock.json',
  ':(exclude):/*/package-lock.json',
  ':(exclude):/skills-lock.json',
  ':(exclude):/docs/architecture/*',
  ':(exclude):/node_modules/*',
  ':(exclude):/workspace/*',
  ':(exclude):/scratch/*',
];

/**
 * Extrai cláusulas BDD Gherkin (Cenário, Dado, Quando, Então, E) de um texto Markdown.
 * @param {string} rawText
 * @param {string} emptyMessage
 * @returns {string}
 */
export function extractBddClauses(rawText, emptyMessage) {
  const bddLines = String(rawText ?? '')
    .split(/\r?\n/)
    .filter((line) => BDD_LINE_REGEX.test(line));
  return bddLines.length > 0 ? bddLines.join('\n') : emptyMessage;
}

/**
 * Carrega requisitos da GitHub Issue (`gh issue view`) ou do arquivo de plano local (`--plan`).
 * @param {{ issueId?: string | number; planPath?: string; root: string }} params
 */
function readIssueOrPlanRequirements({ issueId, planPath, root }) {
  let issueContent = '';
  let planContent = '';
  let bddChecklistContent = '';

  if (issueId) {
    try {
      issueContent = execFileSync('gh', ['issue', 'view', String(issueId)], { cwd: root, encoding: 'utf8' });
      bddChecklistContent = extractBddClauses(
        issueContent,
        'Nenhuma cláusula BDD formal detectada automaticamente; valide os Critérios de Aceite da Issue.',
      );
    } catch (err) {
      process.stderr.write(`[WARN] Falha ao consultar issue #${issueId}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }
  if (planPath) {
    const fullPlanPath = path.resolve(root, planPath);
    if (fs.existsSync(fullPlanPath)) {
      planContent = fs.readFileSync(fullPlanPath, 'utf8');
      bddChecklistContent = extractBddClauses(planContent, 'Nenhuma cláusula BDD detectada no plano.');
    } else {
      process.stderr.write(`[WARN] Plano não encontrado: ${planPath}\n`);
    }
  }
  return { issueContent, planContent, bddChecklistContent };
}

/**
 * Lista até 30 issues abertas no repositório para blindagem contra alucinação de escopo.
 * @param {string} root
 * @returns {string}
 */
function fetchOpenIssuesList(root) {
  try {
    const issuesRaw = execFileSync('gh', ['issue', 'list', '--state', 'open', '--limit', '30'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return issuesRaw.trim() !== '' ? issuesRaw.trim() : 'Nenhuma outra issue aberta listada.';
  } catch {
    return 'Nenhuma outra issue aberta listada.';
  }
}

/**
 * Executa `git add -N` silencioso para incluir arquivos novos no diff sem alterar o stage real.
 * @param {string} root
 * @param {string[]} fileArray
 */
function markIntentToAdd(root, fileArray) {
  const targetArgs =
    fileArray.length > 0
      ? fileArray
      : [':/', ':(exclude):/node_modules/*', ':(exclude):/workspace/*', ':(exclude):/scratch/*'];
  try {
    execFileSync('git', ['add', '-N', '--', ...targetArgs], { cwd: root, encoding: 'utf8', stdio: 'ignore' });
  } catch {
    // Repositório sem git inicializado ou caminho fora do índice: ignorado com segurança
  }
}

/**
 * Executa um subcomando `git` silenciosamente retornando `stdout` ou string vazia.
 * @param {string} root
 * @param {string[]} gitArgs
 * @returns {string}
 */
function runSilentGit(root, gitArgs) {
  try {
    return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

/**
 * Coleta `git status --short` e `git diff HEAD --function-context` de forma segura (CWE-78 safe).
 * @param {string} root
 * @param {string[]} fileArray
 */
function collectGitStatusAndDiff(root, fileArray) {
  markIntentToAdd(root, fileArray);
  const statusTargets =
    fileArray.length > 0
      ? fileArray
      : [':/', ':(exclude):/node_modules/*', ':(exclude):/workspace/*', ':(exclude):/scratch/*'];
  const diffTargets = fileArray.length > 0 ? fileArray : DEFAULT_DIFF_EXCLUDES;

  const statusContent = runSilentGit(root, ['status', '--short', '--', ...statusTargets]).trim();
  const headDiff = runSilentGit(root, ['diff', 'HEAD', '--function-context', '--', ...diffTargets]).trim();
  const workingDiff = headDiff !== '' ? headDiff : runSilentGit(root, ['diff', '--function-context', '--', ...diffTargets]).trim();
  return {
    statusContent,
    diffContent: workingDiff !== '' ? workingDiff : 'Nenhum diff encontrado.',
  };
}

/**
 * Localiza o script `scan-clean-code.mjs` no projeto ou nos templates do harness.
 * @param {string} root
 * @returns {string | undefined}
 */
function findCleanCodeScannerPath(root) {
  const candidates = [
    path.join(root, 'scripts', 'scan-clean-code.mjs'),
    path.join(root, 'templates', 'scripts', 'scan-clean-code.mjs'),
    path.join(root, 'skills', 'sovereign', 'clean-code-audit', 'scripts', 'scan-clean-code.mjs'),
    path.join(root, '.agents', 'skills', 'clean-code-audit', 'scripts', 'scan-clean-code.mjs'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

/**
 * Verifica se o cache `scratch/clean_code_telemetry.json` está atualizado em relação aos arquivos-alvo (GF-02).
 * @param {string} root
 * @param {string} cachePath
 * @param {string[]} codeFiles
 * @returns {string | null}
 */
function readCachedCleanCodeTelemetry(root, cachePath, codeFiles) {
  if (!fs.existsSync(cachePath) || codeFiles.length === 0) return null;
  try {
    const cacheMtime = fs.statSync(cachePath).mtimeMs;
    const allOlderOrEqual = codeFiles.every((relFile) => {
      const absFile = path.resolve(root, relFile);
      return fs.existsSync(absFile) && fs.statSync(absFile).mtimeMs <= cacheMtime;
    });
    if (!allOlderOrEqual) return null;
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cached && cached.targetKey === codeFiles.join(',')) return String(cached.reportJson ?? '');
  } catch {
    return null;
  }
  return null;
}

/**
 * Executa um único arquivo/alvo no `scan-clean-code.mjs --json` retornando o objeto parseado.
 * @param {string} root
 * @param {string} scannerPath
 * @param {string} targetArg
 * @returns {Record<string, any> | null}
 */
function executeSingleScannerTarget(root, scannerPath, targetArg) {
  try {
    const out = execFileSync(process.execPath, [scannerPath, '--json', targetArg], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
  } catch (err) {
    const stdout = err && typeof err === 'object' && 'stdout' in err ? String(err.stdout ?? '') : '';
    return stdout.trim().startsWith('{') ? JSON.parse(stdout) : null;
  }
}

/**
 * Executa o scanner determinístico das 22 regras com cache por `mtimeMs` em `scratch/clean_code_telemetry.json` (GF-02).
 * @param {string} root
 * @param {string[]} fileArray
 * @returns {string}
 */
function runPreInjectedCleanCodeScan(root, fileArray) {
  const scannerPath = findCleanCodeScannerPath(root);
  if (!scannerPath) return 'Não executado';

  const codeFiles = fileArray.filter((f) => /\.(m?js|cjs|tsx?|py|rb)$/i.test(f));
  const scratchDir = path.join(root, 'scratch');
  const cachePath = path.join(scratchDir, 'clean_code_telemetry.json');
  const cachedJson = readCachedCleanCodeTelemetry(root, cachePath, codeFiles);
  if (cachedJson) return cachedJson;

  const targetsToRun = codeFiles.length > 0 ? codeFiles : ['--changed'];
  const combinedReports = targetsToRun
    .map((targetArg) => executeSingleScannerTarget(root, scannerPath, targetArg))
    .filter(Boolean);
  if (combinedReports.length === 0) return 'Não executado';

  const reportJson = JSON.stringify(combinedReports.length === 1 ? combinedReports[0] : combinedReports, null, 2);
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ targetKey: codeFiles.join(','), reportJson }, null, 2), 'utf8');
  return reportJson;
}

/**
 * Lê um resumo enxuto do modelo de ameaças vivo `workspace/kb/THREAT_MODEL.md` (GF-01, GF-07).
 * @param {string} root
 * @returns {string}
 */
export function readThreatModelSummary(root) {
  const tmPath = path.join(root, 'workspace', 'kb', 'THREAT_MODEL.md');
  if (!fs.existsSync(tmPath)) {
    return 'AUSENTE (workspace/kb/THREAT_MODEL.md não encontrado no repositório).';
  }
  const lines = fs
    .readFileSync(tmPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('KB_SNAPSHOT:') || l.startsWith('<!-- aegis-surface-hash:') || l.startsWith('| TM-'));
  return lines.length > 0 ? lines.join('\n') : 'PRESENTE (sem linhas TM-* sumarizadas).';
}

/**
 * Monta o texto Markdown completo do dossiê para o 2º Portão EGM Goldfish.
 * @param {Record<string, string>} sections
 * @returns {string}
 */
function buildReviewPromptText(sections) {
  return [
    'Papel: Revisor Técnico Sênior (Aegis Engineering Harness (2º Portão EGM Goldfish)).',
    'Contexto:',
    sections.issueOrPlanHeader,
    sections.issueOrPlanContent,
    '- Checklist Extraído de Cláusulas BDD Gherkin (Rastreabilidade 1:1 Obrigatória):',
    sections.bddChecklistContent,
    '- Modelo de Ameaças Vivo (workspace/kb/THREAT_MODEL.md - Regra 1.8):',
    sections.threatModelContent,
    '- Roadmap / Outras Issues da Sequência (Fora do Escopo Desta Revisão):',
    sections.openIssuesContent,
    '- Arquivos Alterados / Removidos (git status --short):\n```text',
    `${sections.statusContent}\n\`\`\``,
    '- Diff da Implementação Atual com Contexto Completo de Função:\n```diff',
    `${sections.diffContent}\n\`\`\``,
    '## 🔬 TELEMETRIA DETERMINÍSTICA PRÉ-INJETADA (AST / CRAP / 22 Regras)\n```json',
    `${sections.telemetryContent}\n\`\`\``,
    'Objetivo e Matriz de Avaliação nos 4 Eixos Inegociáveis:',
    '1. [Eixo 1 - Rastreabilidade BDD 1:1 e Anti-Mock Oco]: Cada cláusula "Então" possui asserção real nos testes?',
    '2. [Eixo 2 - Zero Spec Drift e Regra 1.12]: A implementação segue 100% os contratos sem código zumbi?',
    '3. [Eixo 3 - Segurança Serverless, Subprocessos e Tipagem]: Zero CWE-78, zero fire-and-forget e uso de "??" sobre "||".',
    '4. [Eixo 4 - Simulação de Execução Mental]: Existem bugs lógicos, race conditions ou quebras de borda?',
    'Diretriz: Seja conciso. Categorize apontamentos reais com arquivo/linha. Se íntegro, responda apenas "APROVADO".',
  ].join('\n');
}

/**
 * Persiste os arquivos determinísticos de revisão em `scratch/` (GF-06).
 * @param {{ root: string; prompt: string; issueId?: string | number; planPath?: string }} params
 */
function writeReviewScratchFiles({ root, prompt, issueId, planPath }) {
  const scratchDir = path.join(root, 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  fs.writeFileSync(path.join(scratchDir, 'review_prompt.md'), prompt, 'utf8');
  if (issueId) {
    fs.writeFileSync(path.join(scratchDir, `review_prompt_issue_${issueId}.md`), prompt, 'utf8');
  }
  if (planPath) {
    fs.writeFileSync(path.join(scratchDir, 'review_prompt_plan.md'), prompt, 'utf8');
  }
}

/**
 * Gera o dossiê cirúrgico para o 2º Portão EGM Goldfish (GF-02, GF-06).
 * Exemplo: generateReviewDossier({ planPath: 'implementation_plan.md', files: 'src/a.mjs' });
 *
 * @param {{ issueId?: string | number; planPath?: string; files?: string; rootDir?: string }} options
 * @returns {string} Conteúdo Markdown do dossiê gerado
 */
export function generateReviewDossier({ issueId, planPath, files, rootDir }) {
  const root = rootDir ?? process.cwd();
  const fileArray = files
    ? files.split(',').map((f) => f.trim()).filter(Boolean)
    : [];
  const { issueContent, planContent, bddChecklistContent } = readIssueOrPlanRequirements({
    issueId,
    planPath,
    root,
  });
  const openIssuesContent = fetchOpenIssuesList(root);
  const { statusContent, diffContent } = collectGitStatusAndDiff(root, fileArray);
  const telemetryContent = runPreInjectedCleanCodeScan(root, fileArray);

  const prompt = `${buildReviewPromptText({
    issueOrPlanHeader: issueId
      ? `- Requisitos Exclusivos da Issue #${issueId}:`
      : '- Requisitos Extraídos do Plano de Implementação:',
    issueOrPlanContent: issueId ? issueContent : planContent,
    bddChecklistContent,
    threatModelContent: readThreatModelSummary(root),
    openIssuesContent,
    statusContent,
    diffContent,
    telemetryContent,
  })}\n\n${computeIssueFinOpsMarkdown()}`;

  writeReviewScratchFiles({ root, prompt, issueId, planPath });
  recordReviewGateStamp(root);
  return prompt;
}

/**
 * Atualiza o carimbo determinístico `reviewDossierGeneratedAt` em `.git/aegis-gate-stamp.json` (GF-03).
 * @param {string} root
 */
function recordReviewGateStamp(root) {
  const gitDir = path.join(root, '.git');
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
  const updated = { ...current, reviewDossierGeneratedAt: Date.now() };
  fs.writeFileSync(stampPath, JSON.stringify(updated, null, 2), 'utf8');
}

/**
 * Faz o parsing dos argumentos de linha de comando do `review.mjs`.
 * @param {string[]} argv
 */
function parseCliArgs(argv) {
  let issueId;
  let planPath;
  let files;
  let rootDir;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--issue' || flag === '-IssueNumber') issueId = argv[++i];
    else if (flag === '--plan' || flag === '-PlanPath') planPath = argv[++i];
    else if (flag === '--files' || flag === '-Files') files = argv[++i];
    else if (flag === '--root') rootDir = argv[++i];
  }
  return { issueId, planPath, files, rootDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    generateReviewDossier(parseCliArgs(process.argv.slice(2)));
    process.stdout.write('[OK] Dossiê de revisão gerado com sucesso.\n');
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
