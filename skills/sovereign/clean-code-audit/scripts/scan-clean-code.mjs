#!/usr/bin/env node
/**
 * scan-clean-code.mjs
 *
 * Motor determinístico híbrido da skill `clean-code-audit` (Issue #121).
 * Audita código-fonte (TypeScript/JavaScript, Python, Ruby) contra as 22 Regras
 * de Clean Code, AI-Friendly Engineering & Serverless Anti-Freeze, classificando
 * cada desvio por Severidade e Facilidade / Risco de Regressão (🟢 Quick Win,
 * 🟡 Refatoração Local, 🔴 Estrutural) e emitindo o Ranking Top 5 Hotspots.
 *
 * Exemplos de uso:
 *   node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs backend/src --markdown
 *   node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --changed
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES_CATALOG = [
  { id: 'R1', title: 'Funções pequenas (4–25 linhas) e arquivos pequenos', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R2', title: 'Single Responsibility Principle (SRP)', defaultEaseAndRisk: '🔴 Estrutural (Alto Blast Radius)' },
  { id: 'R3', title: 'Nomes significativos e únicos', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R4', title: 'Comentários com contexto e proveniência', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
  { id: 'R5', title: 'Disciplina de Tipos & Estados Ilegais Irrepresentáveis', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R6', title: "DRY (Don't Repeat Yourself)", defaultEaseAndRisk: '🔴 Estrutural (Alto Blast Radius)' },
  { id: 'R7', title: 'Estrutura de diretório previsível', defaultEaseAndRisk: '🔴 Estrutural (Alto Blast Radius)' },
  { id: 'R8', title: 'Dependency Injection & Testes Comportamentais de Domínio (Anti-Stage/Teatral)', defaultEaseAndRisk: '🔴 Estrutural (Alto Blast Radius)' },
  { id: 'R9', title: 'Aninhamento Raso, Complexidade Ciclomática & Índice CRAP (CRAP < 10)', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R10', title: 'Erro com contexto (recebido vs. esperado)', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
  { id: 'R11', title: 'Zero comentário que descreve o óbvio', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
  { id: 'R12', title: 'Logging estruturado (JSON com campos nomeados)', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
  { id: 'R13', title: 'Proibição de Exceções Engolidas (Silent Catch / Sem Cause)', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
  { id: 'R14', title: 'Zero Números/Strings Mágicas (Constantes com Unidade)', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
  { id: 'R15', title: 'Limite de Parâmetros (≤ 3 posicionais) e Zero Boolean Flags', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R16', title: 'Imutabilidade de Parâmetros (No Parameter Mutation)', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R17', title: 'Assincronismo Seguro & Anti-Freeze Serverless (Cloud Run)', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R18', title: 'Fail-Fast & Zero Compatibilidade Zumbi / Código Morto', defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R19', title: 'Servidor 100% Stateless (Zero Estado Mutável Global)', defaultEaseAndRisk: '🔴 Estrutural (Alto Blast Radius)' },
  { id: 'R20', title: "Validação de Schema na Fronteira (Parse, Don't Validate)", defaultEaseAndRisk: '🟡 Refatoração Local (Risco Baixo)' },
  { id: 'R21', title: 'Zero Dependências Circulares (A ↔ B)', defaultEaseAndRisk: '🔴 Estrutural (Alto Blast Radius)' },
  { id: 'R22', title: 'Zero Ternários Aninhados e Condições Criptográficas', defaultEaseAndRisk: '🟢 Quick Win (Risco Zero)' },
];

/**
 * Conjunto canônico das 22 regras de tolerância zero (22/22) que possuem 0 desvios em produção
 * e atuam como gate determinístico bloqueante no `npm run audit:verify` (--enforce-zero-rules),
 * eliminando tetos numéricos arbitrários por meio de regras semânticas de coesão.
 * Exemplo: ZERO_TOLERANCE_RULE_IDS.length === 22
 */
export const ZERO_TOLERANCE_RULE_IDS = [
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'R9',
  'R10',
  'R11',
  'R12',
  'R13',
  'R14',
  'R15',
  'R16',
  'R17',
  'R18',
  'R19',
  'R20',
  'R21',
  'R22',
];

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.rb']);
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git', '.firebase', 'playwright-report', 'test-results', 'scratch', '.agents']);
const VAGUE_DIRECTORY_NAMES = new Set(['misc', 'helpers2', 'util2', 'utils2', 'stuff', 'temp', 'tmp', 'dump', 'old']);
const GENERIC_IDENTIFIER_NAMES = new Set(['data', 'temp', 'tmp', 'info', 'obj', 'val', 'stuff']);
const ALLOWED_NUMERIC_LITERALS = new Set([0, 1, 2, 3, -1, 10, 16, 36, 60, 100, 200, 201, 204, 300, 500, 400, 401, 403, 404, 409, 422, 429, 502, 503, 504]);
const COMMENT_PREFIXES = ['//', '#', '*', '/*'];

function isCommentText(trimmed) {
  return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}
const MAX_IDEAL_FN_LINES = 25;
const MAX_IDEAL_MULTILINE_SIG_FN_LINES = 38;
const MAX_IDEAL_TSX_FN_LINES = 45;
const MAX_IDEAL_DECLARATIVE_BUILDER_FN_LINES = 65;
const CRITICAL_FN_LINES = 40;
const CRITICAL_TSX_FN_LINES = 60;
const WARN_FILE_LINES = 300;
const CRITICAL_FILE_LINES = 500;
const MAX_EXPORTED_FUNCTIONS_SRP = 15;
const MAX_POSITIONAL_PARAMS = 3;
const DRY_WINDOW_SIZE = 6;
const MIN_MEANINGFUL_LINE_CHARS = 18;
const MAX_HOTSPOTS_COUNT = 5;
const MAX_CATALOG_FINDINGS = 50;
const CRAP_WARN_THRESHOLD = 10;
const CYCLOMATIC_NO_COV_WARN_THRESHOLD = 15;
const CRAP_CRITICAL_THRESHOLD = 30;
const FORBIDDEN_TEST_FILE_PATTERNS = [
  /issue-?\d+/i,
  /pr-?\d+/i,
  /task-?\d+/i,
  /clean-code-phase/i,
  /fase-?\d+[a-z]?/i,
  /fatia-?\d+/i,
  /stage-?[a-z0-9]/i,
  /cluster-?s?/i,
  /etapa-?[a-z0-9]/i,
  /clean-code-convergence/i,
  /-clean-code\.test\./i,
  /-srp\.test\./i,
  /-guard-clauses/i,
];
const LIFECYCLE_BOOLEAN_FLAGS = new Set([
  'isLoading',
  'isSuccess',
  'isError',
  'isPending',
  'isCompleted',
  'isFailed',
  'isFetching',
  'isIdle',
  'isRejected',
  'isResolved',
  'loading',
  'error',
  'success',
]);

/**
 * Calcula o índice CRAP (Change Risk Anti-Patterns) combinando complexidade ciclomática
 * e razão de cobertura de testes (0.0 a 1.0): CRAP(m) = comp(m)^2 * (1 - cov(m))^3 + comp(m).
 * Exemplo: computeCrapScore(5, 0.0) === 30
 *
 * @param {number} complexity Complexidade ciclomática da função (>= 1)
 * @param {number} [coverageRatio=1.0] Cobertura de testes entre 0.0 e 1.0
 * @returns {number} Índice CRAP arredondado para 2 casas decimais
 */
export function computeCrapScore(complexity, coverageRatio = 1.0) {
  const comp = Math.max(1, Number(complexity) || 1);
  const cov = Math.min(1, Math.max(0, Number.isFinite(coverageRatio) ? Number(coverageRatio) : 1.0));
  const raw = Math.pow(comp, 2) * Math.pow(1 - cov, 3) + comp;
  return Math.round(raw * 100) / 100;
}

function countLineDecisionPoints(cleanLine) {
  const trimmed = cleanLine.trim();
  if (!trimmed) return 0;
  let points = 0;
  const branchMatches = trimmed.match(/\b(if|for|while|case|catch)\b/g);
  if (branchMatches) points += branchMatches.length;
  const logicalMatches = trimmed.match(/(&&|\|\|)/g);
  if (logicalMatches) points += logicalMatches.length;
  const withoutOptionalAndNullish = trimmed.replace(/\?\./g, '').replace(/\?\?/g, '').replace(/\?:/g, '');
  const ternaryMatches = withoutOptionalAndNullish.match(/\s\?\s/g);
  if (ternaryMatches) points += ternaryMatches.length;
  return points;
}

function isClosingPunctuationOnly(trimmed) {
  return /^[}\]);,]+$/.test(trimmed);
}

function stripStringsAndComments(line) {
  let stripped = line
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/^\s*\/(?![/*])(?:\\.|[^/\\])*\/[gimsuy]*/g, '""')
    .replace(/(?:=[=~]?|[(:[!,]|return)\s*\/(?![/*])(?:\\.|[^/\\])*\/[gimsuy]*/g, '""')
    .replace(/\/\/.*$/, '');
  return stripped;
}

function isTestFilePath(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return (
    norm.includes('/tests/') ||
    norm.includes('/e2e/fixtures/') ||
    /\.(test|spec|mcp)\.(ts|tsx|js|jsx|mjs)$/.test(norm)
  );
}

function isTestOrClientOnlyFile(filePath, lines) {
  if (isTestFilePath(filePath)) {
    return true;
  }
  const firstMeaningfulLines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isCommentText(l))
    .slice(0, 3);
  return firstMeaningfulLines.some((l) => /^['"]use client['"];?$/.test(l));
}

/**
 * Resolve a lista de arquivos de código-fonte modificados ou não rastreados no Git (`--changed`).
 * Exemplo: const changed = resolveChangedFiles(process.cwd());
 *
 * @param {string} cwd Diretório raiz do repositório Git
 * @returns {string[]} Lista de caminhos absolutos de arquivos modificados suportados
 */
export function resolveChangedFiles(cwd = process.cwd()) {
  try {
    const out = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out
      .split(/\r?\n/)
      .filter((rawLine) => rawLine.trim().length > 0)
      .map((rawLine) => path.resolve(cwd, rawLine.slice(3).trim().replace(/^"(.*)"$/, '$1')))
      .filter((fullPath) => {
        const relSegments = path.relative(cwd, fullPath).split(/[/\\]/);
        if (relSegments.some((seg) => IGNORED_DIRS.has(seg))) return false;
        return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && SUPPORTED_EXTENSIONS.has(path.extname(fullPath).toLowerCase());
      });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao consultar git status em resolveChangedFiles: recebido cwd=${cwd}, erro=${reason}`);
  }
}

/**
 * Coleta recursivamente os arquivos de código-fonte suportados a partir de um caminho alvo.
 * Exemplo: collectSourceFiles('./backend/src')
 *
 * @param {string} targetPath Caminho de arquivo ou diretório
 * @returns {string[]} Lista de caminhos absolutos de arquivos suportados
 */
export function collectSourceFiles(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Caminho alvo não encontrado: recebido ${JSON.stringify(targetPath)} (${resolved}), esperado arquivo ou diretório existente.`);
  }
  if (fs.statSync(resolved).isFile()) {
    return SUPPORTED_EXTENSIONS.has(path.extname(resolved)) ? [resolved] : [];
  }
  const collected = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(resolved, entry.name);
    if (entry.isDirectory()) collected.push(...collectSourceFiles(fullPath));
    else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) collected.push(fullPath);
  }
  return collected;
}

/**
 * Avalia regras estruturais de diretório (R7) e coesão de módulo (R2).
 */
function checkModuleStructureAndCohesion(fileCtx) {
  const { filePath, lines, rootDir } = fileCtx;
  const localFindings = [];
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  for (const seg of relPath.split('/').slice(0, -1)) {
    if (VAGUE_DIRECTORY_NAMES.has(seg.toLowerCase())) {
      localFindings.push({
        ruleId: 'R7',
        severity: 'warning',
        easeAndRisk: '🔴 Estrutural (Alto Blast Radius)',
        file: filePath,
        line: 1,
        message: `Diretório com nome vago/não-convencional ("${seg}/"). Mova o módulo para uma pasta semântica do framework.`,
        suggestion: `Mover "${relPath}" para diretório canônico da camada correspondente e atualizar imports.`,
      });
      break;
    }
  }

  const exportedFunctions = lines.filter((l) => /^\s*export\s+(async\s+)?function\b/.test(l));
  const hasIoImport = lines.some((l) => /^\s*import\b.*(firebase-admin|firestore|@google-cloud|axios|pg|mysql|smtp)/i.test(l));
  const hasUiMarkup = lines.some((l) => /(<button|<div|<span|React\.createElement)/i.test(l));
  const isPureContractOrCatalogPath = /\/(?:types|prompts|config)\//.test(`/${relPath}`);
  const mixesArchitecturalLayers = (hasIoImport && hasUiMarkup) || (isPureContractOrCatalogPath && hasIoImport);
  const exceedsExportLimit = exportedFunctions.length >= MAX_EXPORTED_FUNCTIONS_SRP;

  if (exceedsExportLimit || mixesArchitecturalLayers) {
    localFindings.push({
      ruleId: 'R2',
      severity: 'critical',
      easeAndRisk: '🔴 Estrutural (Alto Blast Radius)',
      file: filePath,
      line: 1,
      message: `Módulo viola o Single Responsibility Principle (SRP): ${exportedFunctions.length} funções exportadas e/ou mistura de I/O com UI.`,
      suggestion: 'Fatiar o módulo por responsabilidade única (separar I/O de infraestrutura, regra de negócio pura e UI).',
    });
  }
  return localFindings;
}

function extractCompleteParamSection(lines, startIdx) {
  let parenDepth = 0;
  let started = false;
  let buf = '';
  for (let k = startIdx; k < Math.min(lines.length, startIdx + 12); k++) {
    const clean = stripStringsAndComments(lines[k]);
    for (const ch of clean) {
      if (ch === '(') {
        if (started) buf += ch;
        parenDepth++;
        started = true;
      } else if (ch === ')') {
        parenDepth--;
        if (started && parenDepth === 0) return buf;
        if (started) buf += ch;
      } else if (started) {
        buf += ch;
      }
    }
    if (started) buf += ' ';
  }
  return buf;
}
function extractParamNames(rawParamSection) {
  if (!rawParamSection || !rawParamSection.trim()) return [];
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of rawParamSection) {
    if (ch === '<' || ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === '>' || ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts
    .map((p) => p.replace(/^\.\.\./, '').split(/[:=]/)[0].trim())
    .filter((name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name));
}

/**
 * Analisa tamanho e aninhamento de funções em arquivos Python por indentação.
 */
function checkPythonFunctions(fileCtx) {
  const { filePath, lines } = fileCtx;
  const localFindings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(->\s*[^:]+)?\s*:/);
    if (!match) continue;
    const [, indentStr, fnName, rawParams, returnAnnotation] = match;
    const baseIndent = indentStr.length;
    const params = rawParams.trim();
    const startLine = i + 1;

    if (!returnAnnotation || (params.length > 0 && !params.includes(':') && params !== 'self')) {
      localFindings.push({
        ruleId: 'R5',
        severity: 'warning',
        easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
        file: filePath,
        line: startLine,
        message: `Função Python "${fnName}" sem type hints explícitos nos parâmetros e/ou retorno.`,
        suggestion: `Adicionar anotações de tipo explícitas: def ${fnName}(param: Tipo) -> Retorno:`,
      });
    }

    let logicLines = 0;
    let maxNesting = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const trimmed = lines[j].trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const indent = (lines[j].match(/^(\s*)/)?.[1] ?? '').length;
      if (indent <= baseIndent) break;
      logicLines++;
      if (/^(if|for|while|try|with)\b/.test(trimmed)) {
        maxNesting = Math.max(maxNesting, Math.floor((indent - baseIndent) / 4));
      }
    }
    if (logicLines > MAX_IDEAL_FN_LINES) {
      localFindings.push({
        ruleId: 'R1',
        severity: logicLines > CRITICAL_FN_LINES ? 'critical' : 'warning',
        easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
        file: filePath,
        line: startLine,
        message: `Função Python "${fnName}" possui ${logicLines} linhas de lógica (ideal: 4 a ${MAX_IDEAL_FN_LINES} linhas).`,
        suggestion: `Decompor "${fnName}" em funções auxiliares menores de responsabilidade única.`,
      });
    }
    if (maxNesting >= 3) {
      localFindings.push({
        ruleId: 'R9',
        severity: 'warning',
        easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
        file: filePath,
        line: startLine,
        message: `Função Python "${fnName}" possui aninhamento profundo (nível ${maxNesting}).`,
        suggestion: 'Usar guard clauses (early return) para reduzir níveis de indentação.',
      });
    }
  }
  return localFindings;
}

/**
 * Avalia tamanho de funções/arquivos (R1), aninhamento (R9), limite de parâmetros (R15) e imutabilidade (R16).
 */
function checkFunctionSizeAndNesting(fileCtx) {
  const { filePath, lines, ext } = fileCtx;
  const localFindings = [];
  const effectiveFileLines = lines.filter((l) => {
    const t = l.trim();
    return t.length > 0 && !isCommentText(t);
  }).length;

  if (ext === '.py') return [...localFindings, ...checkPythonFunctions(fileCtx)];

  const fnStartRegex =
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)?\s*\(([^)]*)\)?|^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>\s*\{/;
  const singleLineFnRegex =
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)?\s*\((.*)\)|^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>\s*\{/;

  let inMultilineTemplate = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const backtickMatches = line.match(/(?<!\\)`/g) ?? [];
    const togglesTemplate = backtickMatches.length % 2 === 1;
    if (inMultilineTemplate) {
      if (togglesTemplate) inMultilineTemplate = false;
      continue;
    }
    if (togglesTemplate) {
      inMultilineTemplate = true;
    }

    const match = line.match(fnStartRegex);
    if (!match) continue;
    const isSingleLineSignature = singleLineFnRegex.test(line);
    if (!isSingleLineSignature && ext !== '.tsx') continue;
    const fnName = match[1] || match[3] || 'anonymous';
    const rawParams = match[1] !== undefined ? extractCompleteParamSection(lines, i) : (match[4] ?? '');
    const paramNames = extractParamNames(rawParams);
    const startLine = i + 1;

    if (paramNames.length > MAX_POSITIONAL_PARAMS) {
      localFindings.push({
        ruleId: 'R15',
        severity: 'warning',
        easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
        file: filePath,
        line: startLine,
        message: `Função "${fnName}" recebe ${paramNames.length} parâmetros posicionais (limite recomendado ≤ 3).`,
        suggestion: `Agrupar os parâmetros de "${fnName}" em um objeto de opções tipado.`,
      });
    }

    const bodyScan = scanBraceFunctionBody({
      lines,
      startIdx: i,
      paramNames,
      fnName,
      filePath,
      ext,
      coverageByFunction: fileCtx.coverageByFunction,
    });
    localFindings.push(...bodyScan);
  }

  const hasComplexOrBloatedFunction = localFindings.some((f) => f.ruleId === 'R1' || f.ruleId === 'R9');
  if (!isTestFilePath(filePath) && effectiveFileLines > WARN_FILE_LINES && hasComplexOrBloatedFunction) {
    localFindings.unshift({
      ruleId: 'R1',
      severity: effectiveFileLines > CRITICAL_FILE_LINES ? 'critical' : 'warning',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: 1,
      message: `Arquivo possui ${effectiveFileLines} linhas efetivas de código combinado com funções complexas/extensas (ideal ≤ 250, limite de alerta 300).`,
      suggestion: 'Extrair subfunções auxiliares coesas ou dividir responsabilidades em submódulos.',
    });
  }
  return localFindings;
}

/**
 * Inspeciona o corpo de uma função delimitada por chaves para aferir R1, R9, R16 e R24 (CRAP).
 */
function scanBraceFunctionBody(scanCtx) {
  const { lines, startIdx, paramNames, fnName, filePath, ext, coverageByFunction } = scanCtx;
  const bodyFindings = [];
  let parenDepth = 0;
  let seenOpenParen = false;
  let signatureComplete = false;
  const isClientFile = isTestOrClientOnlyFile(filePath, lines);
  const isTestFile = isTestFilePath(filePath);
  let braceDepth = 0;
  let startedBraces = false;
  let bodyStartIdx = startIdx;
  let logicLines = 0;
  let cyclomaticComplexity = 1;
  let maxControlNesting = 0;
  const controlBraceStack = [];
  let inDeclarativeJsxReturn = false;
  let inMultilineTemplate = false;

  for (let j = startIdx; j < lines.length; j++) {
    const current = lines[j];
    const trimmed = current.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/');
    const backtickMatches = isComment ? [] : (current.match(/(?<!\\)`/g) ?? []);
    const togglesTemplate = backtickMatches.length % 2 === 1;
    if (inMultilineTemplate) {
      if (togglesTemplate) inMultilineTemplate = false;
      continue;
    }
    const cleanLine = isComment ? '' : stripStringsAndComments(current);
    if (togglesTemplate) {
      inMultilineTemplate = true;
    }

    if (!startedBraces) {
      for (const ch of cleanLine) {
        if (ch === '(') {
          parenDepth++;
          seenOpenParen = true;
        } else if (ch === ')') {
          parenDepth = Math.max(0, parenDepth - 1);
          if (seenOpenParen && parenDepth === 0) {
            signatureComplete = true;
          }
        } else if (ch === '{' && signatureComplete) {
          braceDepth++;
          startedBraces = true;
          bodyStartIdx = j;
        } else if (ch === '}' && startedBraces) {
          braceDepth--;
        }
      }
      if (startedBraces && braceDepth <= 0) break;
      continue;
    }

    if (
      ext === '.tsx' &&
      !inDeclarativeJsxReturn &&
      braceDepth === 1 &&
      (/^return\s*\(\s*$/.test(trimmed) || /^return\s*</.test(trimmed) || /^return\s+new\s+ImageResponse\s*\(/.test(trimmed))
    ) {
      inDeclarativeJsxReturn = true;
    }

    const isDeclarativeJsxLine =
      ext === '.tsx' &&
      (inDeclarativeJsxReturn ||
        /^<\/?[A-Za-z]/.test(trimmed) ||
        /^(?:className|data-testid|aria-[a-z]+|role)=/.test(trimmed));

    if (!isComment && trimmed.length > 0 && !isClosingPunctuationOnly(trimmed) && !isDeclarativeJsxLine) {
      logicLines++;
      cyclomaticComplexity += countLineDecisionPoints(cleanLine);
      const isElseIf = /^(?:\}\s*)?else\s+if\b/.test(trimmed);
      const isTryBlock = /^try\b/.test(trimmed);
      const opensBlock = cleanLine.trimEnd().endsWith('{');
      if (
        opensBlock &&
        !isElseIf &&
        !isTryBlock &&
        /^(if|for|while|switch)\b/.test(trimmed)
      ) {
        controlBraceStack.push(braceDepth);
        maxControlNesting = Math.max(maxControlNesting, controlBraceStack.length);
      }
      if (j > bodyStartIdx && paramNames.length > 0) {
        for (const pName of paramNames) {
          if (pName.endsWith('Ref') && new RegExp(`^${pName}\\.current\\s*=[^=]`).test(trimmed)) continue;
          const mutationRegex = new RegExp(`^${pName}\\.[A-Za-z0-9_$]+\\s*=[^=]|^${pName}\\.(push|pop|shift|unshift|splice|sort|reverse)\\s*\\(|^delete\\s+${pName}\\.`);
          if (mutationRegex.test(trimmed)) {
            bodyFindings.push({
              ruleId: 'R16',
              severity: 'warning',
              easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
              file: filePath,
              line: j + 1,
              message: `Mutação direta do parâmetro "${pName}" dentro de "${fnName}".`,
              suggestion: `Retornar um novo objeto/array imutável sem alterar o parâmetro "${pName}".`,
            });
          }
        }
      }
    }

    for (const ch of cleanLine) {
      if (ch === '{') {
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
        while (controlBraceStack.length > 0 && braceDepth <= controlBraceStack[controlBraceStack.length - 1]) {
          controlBraceStack.pop();
        }
      }
    }

    if (startedBraces && braceDepth <= 0) {
      const isReactHook = /^use[A-Z]/.test(fnName) && isClientFile;
      const isReactOrchestratorComponent =
        ext === '.tsx' &&
        /^[A-Z]/.test(fnName) &&
        lines
          .slice(startIdx, j + 1)
          .some((l) => /\buse(State|Effect|Memo|Callback|Ref|I18n|Router|Editor)\s*\(/.test(l));
      if (isReactHook || isReactOrchestratorComponent) break;
      const hasMultiLineSignature = bodyStartIdx > startIdx;
      const isDeclarativeBuilderFn =
        cyclomaticComplexity <= 3 &&
        maxControlNesting <= 1 &&
        (/^(build|create|render|generate|extract|toCompact|OpenGraph)/i.test(fnName) || ext === '.tsx');
      const baseIdealLimit = isDeclarativeBuilderFn
        ? MAX_IDEAL_DECLARATIVE_BUILDER_FN_LINES
        : hasMultiLineSignature
          ? MAX_IDEAL_MULTILINE_SIG_FN_LINES
          : MAX_IDEAL_FN_LINES;
      const idealLimit = ext === '.tsx' && !isDeclarativeBuilderFn ? MAX_IDEAL_TSX_FN_LINES : baseIdealLimit;
      const criticalLimit = ext === '.tsx' ? CRITICAL_TSX_FN_LINES : CRITICAL_FN_LINES;
      if (!isTestFile && logicLines > idealLimit) {
        bodyFindings.push({
          ruleId: 'R1',
          severity: logicLines > criticalLimit ? 'critical' : 'warning',
          easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
          file: filePath,
          line: startIdx + 1,
          message: `Função "${fnName}" possui ${logicLines} linhas de lógica efetiva (ideal: 4 a ${idealLimit} linhas).`,
          suggestion: `Extrair blocos internos de "${fnName}" em subfunções privadas com nível único de abstração.`,
        });
      }
      const explicitCov = coverageByFunction?.[fnName];
      const hasExplicitCoverage = typeof explicitCov === 'number';
      const effectiveCov = hasExplicitCoverage ? explicitCov : 1.0;
      const crapScore = computeCrapScore(cyclomaticComplexity, effectiveCov);
      const triggersCrap = hasExplicitCoverage
        ? crapScore >= CRAP_WARN_THRESHOLD
        : cyclomaticComplexity >= CYCLOMATIC_NO_COV_WARN_THRESHOLD;
      if (maxControlNesting >= 3 || triggersCrap) {
        bodyFindings.push({
          ruleId: 'R9',
          severity: maxControlNesting >= 4 || crapScore >= CRAP_CRITICAL_THRESHOLD ? 'critical' : 'warning',
          easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
          file: filePath,
          line: startIdx + 1,
          message: triggersCrap
            ? `Função "${fnName}" apresenta índice CRAP = ${crapScore} (complexidade ciclomática = ${cyclomaticComplexity}, aninhamento = ${maxControlNesting}, cobertura = ${Math.round(effectiveCov * 100)}%, limite CRAP < ${CRAP_WARN_THRESHOLD}).`
            : `Função "${fnName}" atinge profundidade de aninhamento de controle = ${maxControlNesting} (CRAP = ${crapScore}).`,
          suggestion: `Aplicar guard clauses (early returns), reduzir CRAP de "${fnName}" (< 10) extraindo subfunções coesas e/ou elevar a cobertura comportamental.`,
        });
      }
      break;
    }
  }
  return bodyFindings;
}

function checkForbiddenTestFileName(filePath, baseName) {
  for (const pattern of FORBIDDEN_TEST_FILE_PATTERNS) {
    if (!pattern.test(baseName)) continue;
    return [{
      ruleId: 'R8',
      severity: 'critical',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: 1,
      message: `Arquivo de teste "${baseName}" usa nomenclatura proibida de etapa/cluster/issue (${pattern}). Testes devem ser nomeados pelo comportamento de domínio.`,
      suggestion: 'Renomear o arquivo para refletir o módulo/comportamento real de domínio e organizá-lo na pasta semântica correspondente.',
    }];
  }
  return [];
}

function checkStaticClusterScanInTest(filePath, baseName, lines) {
  if (baseName === 'clean-code-audit-skill.test.ts') return [];
  const joined = lines.join('\n');
  if (!/\bscanCodeQuality\s*\(/.test(joined) || !/\bCLUSTER_[A-Z0-9_]+\b/.test(joined)) return [];
  return [{
    ruleId: 'R8',
    severity: 'warning',
    easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
    file: filePath,
    line: 1,
    message: `Arquivo de teste "${baseName}" executa varredura estática em lote de clusters sem testar o comportamento real das funções de domínio.`,
    suggestion: 'Substituir testes de lote estático por testes unitários/integração que invoquem as funções do domínio e verifiquem entradas e saídas.',
  }];
}

function hasAssertionInTestBlock(lines, startIdx) {
  let braceDepth = 0;
  let started = false;
  let hasAssertion = false;
  for (let j = startIdx; j < lines.length; j++) {
    if (/\b(expect|expectTypeOf|assert\w*|verify\w*|should\w*|rejects|resolves)\b/.test(lines[j])) {
      hasAssertion = true;
    }
    for (const ch of stripStringsAndComments(lines[j])) {
      if (ch === '{') {
        braceDepth++;
        started = true;
      } else if (ch === '}') {
        braceDepth--;
      }
    }
    if (started && braceDepth <= 0) return hasAssertion;
  }
  return true;
}

/**
 * Avalia qualidade comportamental e nomenclatura semântica de arquivos de teste (R8).
 */
function checkTestBehaviorAndNamingQuality(fileCtx) {
  const { filePath, lines } = fileCtx;
  if (!isTestFilePath(filePath)) return [];
  const baseName = path.basename(filePath);
  const findings = [
    ...checkForbiddenTestFileName(filePath, baseName),
    ...checkStaticClusterScanInTest(filePath, baseName, lines),
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^(["'`]).*\1\s*,?$/.test(trimmed)) continue;
    if (/expect\s*\(\s*(true|false|1|0|['"][^'"]*['"])\s*\)\s*\.toBe\s*\(\s*\1\s*\)/.test(trimmed)) {
      findings.push({
        ruleId: 'R8',
        severity: 'warning',
        easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
        file: filePath,
        line: i + 1,
        message: 'Asserção tautológica/teatral detectada (ex.: expect(true).toBe(true)); o teste passaria mesmo se o código de produção não fizesse nada.',
        suggestion: 'Testar o comportamento real observável pela usuária/chamador (Test Behavior, Not Implementation).',
      });
    }
    const itMatch = trimmed.match(/^(?:it|test)\s*\(\s*(['"`])(.*?)\1/);
    if (itMatch && !hasAssertionInTestBlock(lines, i)) {
      findings.push({
        ruleId: 'R8',
        severity: 'warning',
        easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
        file: filePath,
        line: i + 1,
        message: `Caso de teste "${itMatch[2]}" sem asserção verificável (Test Behavior, Not Implementation).`,
        suggestion: 'Adicionar asserções explícitas verificando a saída ou mudança de estado observável.',
      });
    }
  }
  return findings;
}

function collectLifecycleBooleanFlagsInBlock(lines, startIdx) {
  const matchedFlags = [];
  let braceDepth = 0;
  for (let j = startIdx; j < Math.min(lines.length, startIdx + 40); j++) {
    const propMatch = lines[j].trim().match(/^([A-Za-z0-9_$]+)\??\s*:\s*boolean\b/);
    if (propMatch && LIFECYCLE_BOOLEAN_FLAGS.has(propMatch[1])) {
      matchedFlags.push(propMatch[1]);
    }
    for (const ch of stripStringsAndComments(lines[j])) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }
    if (braceDepth <= 0 && j > startIdx) break;
  }
  return matchedFlags;
}

/**
 * Detecta explosão de flags booleanas mutuamente exclusivas em interfaces/tipos de estado (R5).
 */
function checkDomainStateModeling(fileCtx) {
  const { filePath, lines, ext } = fileCtx;
  if (ext !== '.ts' && ext !== '.tsx') return [];
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const typeMatch = lines[i].match(/^\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_$]+).*\{/);
    if (!typeMatch) continue;
    const typeName = typeMatch[1];
    const matchedFlags = collectLifecycleBooleanFlagsInBlock(lines, i);
    if (matchedFlags.length >= 3) {
      findings.push({
        ruleId: 'R5',
        severity: 'warning',
        easeAndRisk: '🔴 Estrutural (Alto Blast Radius)',
        file: filePath,
        line: i + 1,
        message: `Tipo/Interface "${typeName}" combina ${matchedFlags.length} flags booleanas de estado (${matchedFlags.join(', ')}), permitindo estados ilegais simultâneos.`,
        suggestion: `Substituir flags booleanas soltas em "${typeName}" por uma união discriminada (ex.: status: 'idle' | 'loading' | 'success' | 'error').`,
      });
    }
  }
  return findings;
}

/**
 * Avalia uma única linha contra as regras R3, R4, R5, R8, R10..R14, R17..R20 e R22.
 */
function evaluateSingleLine(lineCtx) {
  const { filePath, line, prevLine, lineNum, ext, braceDepth, isClientOrTest } = lineCtx;
  const trimmed = line.trim();
  const isCommentLine = isCommentText(trimmed);
  const isStringLiteralLine = /^(["'`]).*\1\s*,?$/.test(trimmed);
  if (isStringLiteralLine) return [];
  const isRegexDetectorLine =
    /\.test\(/.test(trimmed) ||
    /\.match\(/.test(trimmed) ||
    /\.exec\(/.test(trimmed) ||
    /^\/.*\/[gimsuy]*;?$/.test(trimmed) ||
    /message:|suggestion:/.test(trimmed);
  const out = [];

  if (!isCommentLine && !isRegexDetectorLine && !isClientOrTest && braceDepth === 0) {
    if (/^\s*let\s+[A-Za-z0-9_$]+\s*=/.test(line) || /^\s*(?:const|let|var)\s+[a-z][A-Za-z0-9_$]*\s*=\s*new\s+(?:Map|Set)\b/.test(line)) {
      out.push({
        ruleId: 'R19',
        severity: 'critical',
        easeAndRisk: '🔴 Estrutural (Alto Blast Radius)',
        file: filePath,
        line: lineNum,
        message: 'Estado mutável ou cache em memória declarado no escopo global do módulo (viola arquitetura Stateless Cloud Run).',
        suggestion: 'Externalizar estado em Firestore/Storage/IndexedDB ou encapsular em escopo de requisição.',
      });
    }
  }

  const varMatch = trimmed.match(/^(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/) || trimmed.match(/^([a-zA-Z0-9_]+)\s*=/);
  if (varMatch && GENERIC_IDENTIFIER_NAMES.has(varMatch[1])) {
    out.push({
      ruleId: 'R3',
      severity: 'warning',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: lineNum,
      message: `Identificador genérico "${varMatch[1]}" não revela intenção de domínio.`,
      suggestion: `Renomear "${varMatch[1]}" para um substantivo específico de domínio.`,
    });
  }
  const paramGenericMatch = trimmed.match(/(?:function\s+\w+|def\s+\w+)\s*\(([^)]*)\)/);
  if (paramGenericMatch) {
    for (const pName of paramGenericMatch[1].split(',').map((p) => p.trim().split(/[:=]/)[0].trim())) {
      if (GENERIC_IDENTIFIER_NAMES.has(pName)) {
        out.push({
          ruleId: 'R3',
          severity: 'warning',
          easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
          file: filePath,
          line: lineNum,
          message: `Parâmetro "${pName}" usa nome vago sem semântica de domínio.`,
          suggestion: `Substituir "${pName}" por nome descritivo que revele a intenção do argumento.`,
        });
      }
    }
  }

  if (/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.test(trimmed) && !prevLine.endsWith('*/')) {
    out.push({
      ruleId: 'R4',
      severity: 'warning',
      easeAndRisk: '🟢 Quick Win (Risco Zero)',
      file: filePath,
      line: lineNum,
      message: 'Função pública exportada sem docstring/JSDoc descrevendo intenção, exemplo de uso e proveniência.',
      suggestion: 'Adicionar bloco /** ... */ com propósito, exemplo de chamada e restrições de negócio.',
    });
  }
  if (/^(\/\/|#)\s*.*\b(workaround|hack|temp fix|gambiarra)\b/i.test(trimmed) && !/(issue|#\d+|commit|bug|because|porque|motivo|constraint)/i.test(trimmed)) {
    out.push({
      ruleId: 'R4',
      severity: 'warning',
      easeAndRisk: '🟢 Quick Win (Risco Zero)',
      file: filePath,
      line: lineNum,
      message: 'Comentário de workaround/hack sem proveniência (falta citar issue #ID, commit, bug ou constraint).',
      suggestion: 'Documentar por que a abordagem óbvia não funcionou e referenciar a issue/commit/bug correspondente.',
    });
  }

  if (!isRegexDetectorLine && (ext === '.ts' || ext === '.tsx') && (/:\s*any\b/.test(line) || /\bas\s+any\b/.test(line))) {
    out.push({
      ruleId: 'R5',
      severity: 'warning',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: lineNum,
      message: 'Uso de tipo dinâmico "any" suprime a verificação estática de contratos.',
      suggestion: 'Substituir "any" por interface explícita, generic tipado ou "unknown" com type guard.',
    });
  }

  if (!isRegexDetectorLine && (/\bnew\s+(Firestore|Storage|PrismaClient|Pool|Redis)\s*\(/.test(line) || /\baxios\.create\s*\(/.test(line))) {
    out.push({
      ruleId: 'R8',
      severity: 'critical',
      easeAndRisk: '🔴 Estrutural (Alto Blast Radius)',
      file: filePath,
      line: lineNum,
      message: 'Dependência externa de I/O instanciada diretamente (hardcoded), dificultando testes unitários isolados.',
      suggestion: 'Injetar a dependência via parâmetro/construtor (Dependency Injection) com fallback opcional.',
    });
  }

  if (!isRegexDetectorLine) {
    const tsThrowStatic = trimmed.match(/throw\s+new\s+(?:Error|TypeError|RangeError)\s*\(\s*(["'])([^"']+)\1\s*\)/);
    const pyRaiseStatic = trimmed.match(/raise\s+(?:ValueError|TypeError|RuntimeError|Exception)\s*\(\s*(["'])([^"']+)\1\s*\)/);
    if (tsThrowStatic || pyRaiseStatic) {
      const rawMsg = (tsThrowStatic ? tsThrowStatic[2] : pyRaiseStatic[2]) ?? '';
      out.push({
        ruleId: 'R10',
        severity: 'warning',
        easeAndRisk: '🟢 Quick Win (Risco Zero)',
        file: filePath,
        line: lineNum,
        message: `Exceção lançada com mensagem estática ("${rawMsg}") sem informar o valor recebido nem a expectativa.`,
        suggestion: ext === '.py'
          ? `Usar f-string com contexto: raise ValueError(f"${rawMsg}: received {repr(x)}, expected ...")`
          : `Incluir contexto interpolado: throw new Error(\`${rawMsg}: received \${JSON.stringify(x)}, expected ...\`)`,
      });
    }
  }

  if (/^(\/\/|#)\s*(increment|decrement|return\s+\w+|loop\s+through|set\s+\w+\s+to|add\s+1\s+to)\b/i.test(trimmed)) {
    out.push({
      ruleId: 'R11',
      severity: 'nit',
      easeAndRisk: '🟢 Quick Win (Risco Zero)',
      file: filePath,
      line: lineNum,
      message: `Comentário óbvio ("${trimmed}") apenas repete o que a sintaxe do código já expressa e desperdiça tokens.`,
      suggestion: 'Remover o comentário redundante; manter apenas comentários que expliquem o "porquê" ou proveniência.',
    });
  }

  if (!isRegexDetectorLine) {
    const isConsoleCall = /\bconsole\.(log|info|warn|error)\s*\((.+)\)/.exec(trimmed);
    if (isConsoleCall && !isConsoleCall[2].trim().startsWith('{') && !isConsoleCall[2].includes('JSON.stringify')) {
      out.push({
        ruleId: 'R12',
        severity: 'warning',
        easeAndRisk: '🟢 Quick Win (Risco Zero)',
        file: filePath,
        line: lineNum,
        message: `Log não estruturado via console.${isConsoleCall[1]} sem objeto JSON de campos nomeados.`,
        suggestion: 'Emitir log estruturado em JSON com campos nomeados: logger.info({ event, context, ... }).',
      });
    } else if (ext === '.py' && /^print\s*\(/.test(trimmed)) {
      out.push({
        ruleId: 'R12',
        severity: 'warning',
        easeAndRisk: '🟢 Quick Win (Risco Zero)',
        file: filePath,
        line: lineNum,
        message: 'Uso de print() não estruturado em código Python.',
        suggestion: 'Utilizar logger estruturado em formato JSON com campos nomeados (event, extra={...}).',
      });
    }
  }

  if (!isRegexDetectorLine && (/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(trimmed) || (ext === '.py' && /^except\b.*:\s*pass\b/.test(trimmed)))) {
    out.push({
      ruleId: 'R13',
      severity: 'critical',
      easeAndRisk: '🟢 Quick Win (Risco Zero)',
      file: filePath,
      line: lineNum,
      message: 'Bloco catch vazio (Silent Catch) engole a exceção original e oculta falhas em produção.',
      suggestion: 'Registrar log estruturado com o erro ou relançar preservando a causa: throw new Error("...", { cause: err }).',
    });
  }

  if (!isCommentLine && !isRegexDetectorLine && !/^\s*(?:export\s+)?const\s+[A-Z0-9_]+\s*=/.test(line)) {
    const magicNumMatch = trimmed.match(/(?:[<>]=?|===|!==|\*)\s*(\d{3,}|\d+\.\d+)/);
    if (magicNumMatch && !ALLOWED_NUMERIC_LITERALS.has(Number(magicNumMatch[1]))) {
      out.push({
        ruleId: 'R14',
        severity: 'warning',
        easeAndRisk: '🟢 Quick Win (Risco Zero)',
        file: filePath,
        line: lineNum,
        message: `Número mágico (${magicNumMatch[1]}) usado diretamente na expressão sem constante nomeada com unidade.`,
        suggestion: `Extrair ${magicNumMatch[1]} para uma constante semântica (ex.: const MAX_THRESHOLD_MS = ${magicNumMatch[1]}).`,
      });
    }
  }

  if (!isCommentLine && !isRegexDetectorLine && !isClientOrTest && /\b(setTimeout|setInterval)\s*\(/.test(trimmed)) {
    out.push({
      ruleId: 'R17',
      severity: 'critical',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: lineNum,
      message: 'Uso de setTimeout/setInterval detectado (risco de CPU Freeze pós-resposta no Cloud Run / Regra 1.5.1).',
      suggestion: 'Aguardar todas as promessas com await antes da resposta HTTP ou delegar tarefas de background ao Cloud Tasks.',
    });
  }

  if (!isCommentLine && !isRegexDetectorLine && /process\.env\.[A-Za-z0-9_]+\s*\|\|/.test(trimmed)) {
    out.push({
      ruleId: 'R18',
      severity: 'warning',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: lineNum,
      message: 'Uso de operador "||" com variável de ambiente ou fallback zumbi que mascara valores vazios.',
      suggestion: 'Usar coalescência nula estrita (??) ou validar com Fail-Fast explícito no boot.',
    });
  }

  if (!isCommentLine && !isRegexDetectorLine && /(?:JSON\.parse\s*\([^)]*\)|\.json\s*\(\s*\))\s+as\s+[A-Za-z0-9_{<]/.test(trimmed)) {
    out.push({
      ruleId: 'R20',
      severity: 'warning',
      easeAndRisk: '🟡 Refatoração Local (Risco Baixo)',
      file: filePath,
      line: lineNum,
      message: 'Cast estático ("as Tipo") aplicado diretamente sobre JSON.parse / req.json() sem validação de schema em runtime.',
      suggestion: 'Validar na fronteira usando schema (ex.: Schema.parse( JSON.parse(...) )) antes de confiar no tipo.',
    });
  }

  if (!isCommentLine && !isRegexDetectorLine) {
    const cleanTernaryLine = trimmed.replace(/\?\./g, '').replace(/\?\?/g, '').replace(/\?:/g, '');
    const hasNestedTernary =
      /\s\?\s*[^;]+\s:\s*[^;]+\s\?\s*[^;]+\s:/.test(cleanTernaryLine) || /\?[^:;]+\?[^:;]+:/.test(cleanTernaryLine);
    const logicalOps = trimmed.match(/(&&|\|\|)/g) ?? [];
    if (hasNestedTernary || logicalOps.length >= 4) {
      out.push({
        ruleId: 'R22',
        severity: 'warning',
        easeAndRisk: '🟢 Quick Win (Risco Zero)',
        file: filePath,
        line: lineNum,
        message: hasNestedTernary
          ? 'Operador ternário aninhado dificulta a leitura e aumenta risco de erro lógico.'
          : `Condição booleana complexa com ${logicalOps.length} operadores lógicos inline.`,
        suggestion: 'Extrair para constante booleana nomeada (ex.: const isEligible = ...) ou converter em guard clauses.',
      });
    }
  }
  return out;
}

/**
 * Executa as verificações linha a linha para um arquivo.
 */
function checkLineLevelRules(fileCtx) {
  const { filePath, lines, ext } = fileCtx;
  const isClientOrTest = isTestOrClientOnlyFile(filePath, lines);
  const localFindings = [];
  let braceDepth = 0;
  let inMultilineTemplate = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const backtickMatches = line.match(/(?<!\\)`/g) ?? [];
    const togglesTemplate = backtickMatches.length % 2 === 1;

    if (!inMultilineTemplate) {
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const lineFindings = evaluateSingleLine({ filePath, line, prevLine, lineNum: i + 1, ext, braceDepth, isClientOrTest });
      localFindings.push(...lineFindings);
    }

    if (togglesTemplate) {
      inMultilineTemplate = !inMultilineTemplate;
    }

    const trimmed = line.trim();
    if (!inMultilineTemplate && !isCommentText(trimmed)) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      }
    }
  }
  return localFindings;
}

function isDryCandidateLine(trimmed) {
  if (
    trimmed.length < MIN_MEANINGFUL_LINE_CHARS ||
    isCommentText(trimmed) ||
    isClosingPunctuationOnly(trimmed) ||
    /^(["'`]).*\1\s*,?$/.test(trimmed) ||
    /^<\/?[A-Za-z]/.test(trimmed) ||
    /^\{dict\.[A-Za-z0-9_$.]+\}$/.test(trimmed) ||
    /^(?:className|data-testid|aria-[a-z]+|role|style|href|id|type|onClick|disabled)=/.test(trimmed) ||
    /^[A-Za-z0-9_$]+\s*=\s*(?:\{|true|false|\d+|["'`]).*,?$/.test(trimmed) ||
    /^[A-Za-z0-9_$-]+:\s*["'`#]/.test(trimmed)
  ) {
    return false;
  }
  return (
    !trimmed.startsWith('import ') &&
    !trimmed.startsWith('export interface') &&
    !trimmed.startsWith('interface ') &&
    !trimmed.startsWith('export type ') &&
    !trimmed.startsWith('type ')
  );
}

/**
 * Detecta duplicação de blocos de código (R6 - DRY) entre arquivos ou dentro do mesmo arquivo.
 */
function detectDryViolations(fileEntries) {
  const seenBlocks = new Map();
  const dryFindings = [];

  for (const entry of fileEntries) {
    const normPath = entry.filePath.replace(/\\/g, '/');
    if (
      isTestFilePath(entry.filePath) ||
      normPath.endsWith('/dictionaries.ts') ||
      normPath.endsWith('/tailwind.config.ts')
    ) {
      continue;
    }
    const scopePrefix = 'prod::';
    const meaningfulLines = [];
    for (let i = 0; i < entry.lines.length; i++) {
      const t = entry.lines[i].trim();
      if (isDryCandidateLine(t)) {
        meaningfulLines.push({ norm: t.replace(/\s+/g, ' '), line: i + 1 });
      }
    }

    for (let i = 0; i <= meaningfulLines.length - DRY_WINDOW_SIZE; i++) {
      const slice = meaningfulLines.slice(i, i + DRY_WINDOW_SIZE);
      const fingerprint = `${scopePrefix}${slice.map((s) => s.norm).join('\n')}`;
      const firstOccurrence = seenBlocks.get(fingerprint);

      if (firstOccurrence) {
        const isCrossFile = firstOccurrence.file !== entry.filePath;
        const alreadyReported = dryFindings.some((f) => f.file === entry.filePath && Math.abs(f.line - slice[0].line) < DRY_WINDOW_SIZE);
        if (!alreadyReported) {
          dryFindings.push({
            ruleId: 'R6',
            severity: 'warning',
            easeAndRisk: isCrossFile ? '🔴 Estrutural (Alto Blast Radius)' : '🟡 Refatoração Local (Risco Baixo)',
            file: entry.filePath,
            line: slice[0].line,
            message: `Bloco de código duplicado (DRY) com ${path.basename(firstOccurrence.file)}:${firstOccurrence.line}.`,
            suggestion: isCrossFile
              ? 'Extrair a lógica compartilhada para uma função utilitária canônica e reutilizá-la nos dois módulos.'
              : 'Extrair subfunção auxiliar dentro do próprio arquivo para eliminar a repetição.',
          });
        }
      } else {
        seenBlocks.set(fingerprint, { file: entry.filePath, line: slice[0].line });
      }
    }
  }
  return dryFindings;
}

/**
 * Detecta dependências circulares (R21) entre os arquivos analisados.
 */
function detectCircularDependencies(fileEntries) {
  const importGraph = new Map();
  const knownFiles = new Set(fileEntries.map((e) => path.normalize(e.filePath)));
  const cycleFindings = [];

  for (const entry of fileEntries) {
    const fromNorm = path.normalize(entry.filePath);
    const targets = new Set();
    for (const line of entry.lines) {
      const match = line.match(/^\s*import\s+.*from\s+['"](\.[^'"]+)['"]/);
      if (!match) continue;
      const base = path.resolve(path.dirname(fromNorm), match[1]);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts')]) {
        const norm = path.normalize(candidate);
        if (knownFiles.has(norm)) {
          targets.add(norm);
          break;
        }
      }
    }
    importGraph.set(fromNorm, targets);
  }

  const reportedPairs = new Set();
  for (const [fileA, targetsA] of importGraph.entries()) {
    for (const fileB of targetsA) {
      if (importGraph.get(fileB)?.has(fileA)) {
        const pairKey = [fileA, fileB].sort().join('<->');
        if (!reportedPairs.has(pairKey)) {
          reportedPairs.add(pairKey);
          cycleFindings.push({
            ruleId: 'R21',
            severity: 'critical',
            easeAndRisk: '🔴 Estrutural (Alto Blast Radius)',
            file: fileA,
            line: 1,
            message: `Dependência circular detectada entre ${path.basename(fileA)} ↔ ${path.basename(fileB)}.`,
            suggestion: 'Extrair contratos/tipos ou funções comuns para um terceiro módulo folha sem importação reversa.',
          });
        }
      }
    }
  }
  return cycleFindings;
}

/**
 * Calcula o Ranking Top 5 Arquivos Mais Críticos (Hotspots) a partir da lista de desvios.
 */
function buildHotspotsRanking(findings) {
  const byFile = new Map();
  for (const f of findings) {
    const prev = byFile.get(f.file) ?? { file: f.file, total: 0, quickWins: 0, localRefactors: 0, structural: 0 };
    const isQuick = f.easeAndRisk.includes('🟢');
    const isLocal = f.easeAndRisk.includes('🟡');
    byFile.set(f.file, {
      file: f.file,
      total: prev.total + 1,
      quickWins: prev.quickWins + (isQuick ? 1 : 0),
      localRefactors: prev.localRefactors + (isLocal ? 1 : 0),
      structural: prev.structural + (!isQuick && !isLocal ? 1 : 0),
    });
  }
  return Array.from(byFile.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_HOTSPOTS_COUNT);
}

function resolveRuleStatus(count, hasCritical) {
  if (count === 0) return '✅ Conformidade';
  if (hasCritical) return '❌ Desvio Crítico';
  return '⚠️ Alerta';
}

/**
 * Executa a auditoria determinística completa das 22 regras sobre um arquivo, diretório ou lista de arquivos.
 * Exemplo: const report = await scanCodeQuality('./backend/src');
 *
 * @param {string} targetPath Caminho do arquivo ou diretório a ser auditado
 * @param {{ explicitFiles?: string[] }} [options] Opções adicionais (ex.: arquivos filtrados via --changed)
 * @returns {Promise<{ targetPath: string; scannedFilesCount: number; findings: Array<any>; matrix: Array<any>; hotspots: Array<any> }>}
 */
export async function scanCodeQuality(targetPath, options = {}) {
  const resolvedTarget = path.resolve(targetPath);
  const rootDir = fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isDirectory() ? resolvedTarget : path.dirname(resolvedTarget);
  const files = options.explicitFiles ?? collectSourceFiles(resolvedTarget);
  const findings = [];
  const fileEntries = [];

  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const ext = path.extname(filePath).toLowerCase();
    const fileCtx = { filePath, lines, ext, rootDir, coverageByFunction: options.coverageByFunction };
    fileEntries.push({ filePath, lines });

    findings.push(
      ...checkModuleStructureAndCohesion(fileCtx),
      ...checkFunctionSizeAndNesting(fileCtx),
      ...checkLineLevelRules(fileCtx),
      ...checkTestBehaviorAndNamingQuality(fileCtx),
      ...checkDomainStateModeling(fileCtx)
    );
  }

  findings.push(...detectDryViolations(fileEntries), ...detectCircularDependencies(fileEntries));

  const matrix = RULES_CATALOG.map((rule) => {
    const ruleFindings = findings.filter((f) => f.ruleId === rule.id);
    const hasCritical = ruleFindings.some((f) => f.severity === 'critical');
    const status = resolveRuleStatus(ruleFindings.length, hasCritical);
    return {
      ruleId: rule.id,
      title: rule.title,
      status,
      count: ruleFindings.length,
      easeAndRisk: ruleFindings.length > 0 ? ruleFindings[0].easeAndRisk : rule.defaultEaseAndRisk,
      summary: ruleFindings.length === 0 ? 'Nenhum desvio detectado.' : `${ruleFindings.length} desvio(s) identificado(s).`,
    };
  });

  return {
    targetPath: resolvedTarget,
    scannedFilesCount: files.length,
    findings,
    matrix,
    hotspots: buildHotspotsRanking(findings),
  };
}

/**
 * Formata o resultado da auditoria em Markdown contendo a Matriz Resumo das 22 Regras,
 * Ranking Top 5 Hotspots, Catálogo de Desvios e Plano em 3 Fases.
 * Exemplo: const md = formatMarkdownReport(report);
 *
 * @param {{ targetPath: string; scannedFilesCount: number; findings: Array<any>; matrix: Array<any>; hotspots?: Array<any> }} report
 * @returns {string} Relatório completo em Markdown
 */
export function formatMarkdownReport(report) {
  const matrixRows = report.matrix.map(
    (row) => `| **${row.ruleId}** | ${row.title} | ${row.status} | ${row.count} | ${row.easeAndRisk} | ${row.summary} |`
  );
  const hotspots = report.hotspots ?? [];
  const hotspotRows =
    hotspots.length === 0
      ? [`| - | Nenhum hotspot identificado | 0 | 0 | 0 | 0 |`]
      : hotspots.map((h, idx) => {
          const normalized = h.file.replace(/\\/g, '/');
          return `| **#${idx + 1}** | [${path.basename(h.file)}](file:///${normalized}) | **${h.total}** | ${h.quickWins} | ${h.localRefactors} | ${h.structural} |`;
        });
  const catalogRows =
    report.findings.length === 0
      ? [`Nenhum desvio encontrado nos arquivos analisados.`]
      : report.findings.slice(0, MAX_CATALOG_FINDINGS).flatMap((f) => {
          const normalizedPath = f.file.replace(/\\/g, '/');
          const baseName = path.basename(f.file);
          return [
            `- **[${f.ruleId}] [${baseName}:${f.line}](file:///${normalizedPath}#L${f.line})** — *${f.easeAndRisk}*`,
            `  - **Desvio:** ${f.message}`,
            `  - **Como corrigir:** ${f.suggestion}`,
          ];
        });

  return [
    `# Relatório de Auditoria de Qualidade de Código (\`clean-code-audit\`)`,
    ``,
    `- **Escopo Auditado:** \`${report.targetPath}\``,
    `- **Arquivos Analisados:** ${report.scannedFilesCount}`,
    `- **Total de Desvios:** ${report.findings.length}`,
    ``,
    `## 1. Matriz Resumo das 22 Regras`,
    ``,
    `| # | Regra | Status | Desvios | Facilidade / Risco de Regressão | Diagnóstico Sintético |`,
    `| :-: | :--- | :-: | :-: | :--- | :--- |`,
    ...matrixRows,
    ``,
    `## 2. Top 5 Arquivos Mais Críticos (Hotspots)`,
    ``,
    `| Posição | Arquivo | Total de Desvios | 🟢 Quick Wins | 🟡 Refatorações Locais | 🔴 Estruturais |`,
    `| :-: | :--- | :-: | :-: | :-: | :-: |`,
    ...hotspotRows,
    ``,
    `## 3. Catálogo Acionável de Desvios`,
    ``,
    ...catalogRows,
    ``,
    `## 4. Plano de Ação Recomendado por Facilidade / Risco de Regressão`,
    ``,
    `- **Fase 1 — \`🟢 Quick Win (Risco Zero)\`:** Enriquecer mensagens de erro com contexto (R10), remover comentários óbvios (R11), documentar proveniência/docstrings (R4), estruturar logs em JSON (R12), eliminar silent catch (R13), extrair constantes para números mágicos (R14) e simplificar ternários aninhados (R22).`,
    `- **Fase 2 — \`🟡 Refatoração Local (Risco Baixo)\`:** Aplicar guard clauses / early returns e reduzir índice CRAP < 10 (R9), extrair subfunções privadas de 4–20 linhas (R1), renomear variáveis locais genéricas (R3), explicitar tipos (R5), substituir testes teatrais/de lote por testes comportamentais de domínio (R8), agrupar listas longas de parâmetros (R15), evitar mutação de argumentos (R16), garantir await/Anti-Freeze Cloud Run (R17), Fail-Fast (R18) e validar schemas na fronteira (R20).`,
    `- **Fase 3 — \`🔴 Estrutural (Alto Blast Radius)\`:** Desacoplar módulos por SRP (R2), substituir flags booleanas soltas de estado por uniões discriminadas (R5), unificar duplicações entre arquivos (R6), padronizar diretórios (R7), injetar dependências de I/O (R8), eliminar estado global em memória (R19) e quebrar ciclos de importação (R21).`,
  ].join('\n');
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const onlyChanged = args.includes('--changed');
  const enforceZeroRules = args.includes('--enforce-zero-rules');
  const positionalTarget = args.find((a) => !a.startsWith('--')) || '.';
  const explicitFiles = onlyChanged ? resolveChangedFiles(process.cwd()) : undefined;

  scanCodeQuality(positionalTarget, { explicitFiles })
    .then((report) => {
      if (enforceZeroRules) {
        const zeroSet = new Set(ZERO_TOLERANCE_RULE_IDS);
        const zeroViolations = report.findings.filter((f) => zeroSet.has(f.ruleId));
        if (zeroViolations.length > 0) {
          process.stderr.write(
            `✖ Falha no gate --enforce-zero-rules (${zeroViolations.length} violação(ões) nas ${ZERO_TOLERANCE_RULE_IDS.length} regras de Tolerância Zero):\n`
          );
          for (const v of zeroViolations) {
            process.stderr.write(`  - [${v.ruleId}] ${v.file}:${v.line} — ${v.message}\n`);
          }
          process.exit(1);
        }
        process.stdout.write(
          `✔ Gate --enforce-zero-rules aprovado: 0 violações nas ${ZERO_TOLERANCE_RULE_IDS.length}/22 regras de Tolerância Zero (${report.scannedFilesCount} arquivos analisados).\n`
        );
        return;
      }
      process.stdout.write((asJson ? JSON.stringify(report, null, 2) : formatMarkdownReport(report)) + '\n');
    })
    .catch((err) => {
      process.stderr.write(`Erro ao executar scan-clean-code: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
