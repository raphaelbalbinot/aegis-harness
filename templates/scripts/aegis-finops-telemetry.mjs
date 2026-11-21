#!/usr/bin/env node
// @ts-check
/**
 * scripts/aegis-finops-telemetry.mjs — Motor de Telemetria FinOps por Fase & Modelo (GF-13, GF-14)
 *
 * Gera duas tabelas enxutas para o fechamento da Issue:
 * 1. Tabela 1 — Consumo por Fase (`DEFINE & PLAN` | `BUILD` | `REVIEW` | `TOTAL DESTA ISSUE`)
 * 2. Tabela 2 — Breakdown por Modelo Efetivamente Utilizado (`calls > 0`, omitindo modelos com 0 chamadas)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

const TOKENS_PER_MILLION = 1000000;
const TOKENS_PER_THOUSAND = 1000;
const PERCENT_SCALE = 100;
const RATE_HYDROGEN_INPUT_USD = 0.15;
const RATE_HYDROGEN_CACHE_USD = 0.0375;
const RATE_HYDROGEN_OUTPUT_USD = 0.6;
const RATE_ARGON_INPUT_USD = 1.25;
const RATE_ARGON_CACHE_USD = 0.3125;
const RATE_ARGON_OUTPUT_USD = 5.0;
const RATE_CARBON_INPUT_USD = 2.5;
const RATE_CARBON_CACHE_USD = 0.625;
const RATE_CARBON_OUTPUT_USD = 15.0;

const PHASE_NAMES = ['DEFINE & PLAN', 'BUILD', 'REVIEW'];

/**
 * Retorna a tabela de tarifas por 1M tokens e rótulo de Tier para o modelo informado.
 * @param {string} modelName
 */
function resolveModelPricing(modelName) {
  const lower = String(modelName || 'gemini-4-argon-low').toLowerCase();
  if (
    lower.includes('hydrogen') ||
    lower.includes('flash') ||
    lower.includes('haiku') ||
    lower.includes('codex-mini')
  ) {
    return {
      tierLabel: '🟢 Tier 1 (Fast)',
      inRate: RATE_HYDROGEN_INPUT_USD,
      cacheRate: RATE_HYDROGEN_CACHE_USD,
      outRate: RATE_HYDROGEN_OUTPUT_USD,
    };
  }
  if (lower.includes('carbon') || lower.includes('opus') || lower.includes('o3-pro') || lower.endsWith('-pro')) {
    return {
      tierLabel: '🟣 Tier 3 (Pro)',
      inRate: RATE_CARBON_INPUT_USD,
      cacheRate: RATE_CARBON_CACHE_USD,
      outRate: RATE_CARBON_OUTPUT_USD,
    };
  }
  return {
    tierLabel: '🔵 Tier 2 (Inherit)',
    inRate: RATE_ARGON_INPUT_USD,
    cacheRate: RATE_ARGON_CACHE_USD,
    outRate: RATE_ARGON_OUTPUT_USD,
  };
}

/**
 * Calcula o custo real (com cache) e o custo cheio (sem cache) de um passo em US$.
 * @param {{ model: string; inputTokens: number; cacheReadTokens: number; outputTokens: number }} metric
 */
function computeStepUsdCosts(metric) {
  const pricing = resolveModelPricing(metric.model);
  const inputUsd = (metric.inputTokens / TOKENS_PER_MILLION) * pricing.inRate;
  const cacheUsd = (metric.cacheReadTokens / TOKENS_PER_MILLION) * pricing.cacheRate;
  const fullCacheAsInputUsd = (metric.cacheReadTokens / TOKENS_PER_MILLION) * pricing.inRate;
  const outputUsd = (metric.outputTokens / TOKENS_PER_MILLION) * pricing.outRate;
  return {
    realUsd: inputUsd + cacheUsd + outputUsd,
    noCacheUsd: inputUsd + fullCacheAsInputUsd + outputUsd,
  };
}

/**
 * Classifica a fase de cada passo (`DEFINE & PLAN`, `BUILD` ou `REVIEW`) (GF-14).
 * @param {Record<string, any>} step
 * @param {string} currentPhase
 * @returns {string}
 */
function inferStepPhase(step, currentPhase) {
  if (typeof step.phase === 'string' && PHASE_NAMES.includes(step.phase)) {
    return step.phase;
  }
  const toolBlob = JSON.stringify(step.tool_calls ?? '');
  if (/review\.mjs|review\.ps1|Revisor Tecnico Senior/i.test(toolBlob)) {
    return 'REVIEW';
  }
  if (/snapshot-slice|verify-slice|slice-executor/i.test(toolBlob)) {
    return 'BUILD';
  }
  return currentPhase;
}

/**
 * Cria um acumulador zerado de métricas de tokens e custos.
 * @param {string} label
 * @param {string} [tierLabel]
 */
function createEmptyBucket(label, tierLabel = '') {
  return {
    label,
    tierLabel,
    calls: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    realUsd: 0,
    noCacheUsd: 0,
  };
}

/**
 * Soma os tokens e custos de um passo dentro do acumulador alvo.
 * @param {ReturnType<typeof createEmptyBucket>} bucket
 * @param {{ model: string; inputTokens: number; cacheReadTokens: number; outputTokens: number }} metric
 */
function addMetricToBucket(bucket, metric) {
  const costs = computeStepUsdCosts(metric);
  bucket.calls += 1;
  bucket.inputTokens += metric.inputTokens;
  bucket.cacheReadTokens += metric.cacheReadTokens;
  bucket.outputTokens += metric.outputTokens;
  bucket.realUsd += costs.realUsd;
  bucket.noCacheUsd += costs.noCacheUsd;
}

/**
 * Formata uma contagem de tokens de forma legível (`12.4k` ou `1.42M`).
 * @param {number} count
 * @returns {string}
 */
function formatTokensCompact(count) {
  if (count >= TOKENS_PER_MILLION) {
    return `${(count / TOKENS_PER_MILLION).toFixed(2)}M`;
  }
  if (count >= TOKENS_PER_THOUSAND) {
    return `${(count / TOKENS_PER_THOUSAND).toFixed(1)}k`;
  }
  return String(count);
}

/**
 * Formata uma linha da Tabela 1 (por Fase).
 * @param {ReturnType<typeof createEmptyBucket>} bucket
 * @param {boolean} isTotal
 */
function formatPhaseTableRow(bucket, isTotal = false) {
  const totalIn = bucket.inputTokens + bucket.cacheReadTokens;
  const hitPct = totalIn > 0 ? ((bucket.cacheReadTokens / totalIn) * PERCENT_SCALE).toFixed(1) : '0.0';
  const title = isTotal ? `**🏆 ${bucket.label}**` : `**${bucket.label}**`;
  const costCell = isTotal
    ? `**\`US$ ${bucket.realUsd.toFixed(2)}\`** *(Sem cache: \`US$ ${bucket.noCacheUsd.toFixed(2)}\`)*`
    : `\`US$ ${bucket.realUsd.toFixed(2)}\``;
  return `| ${title} | \`${bucket.calls}\` | \`${formatTokensCompact(bucket.inputTokens)}\` | \`${formatTokensCompact(bucket.cacheReadTokens)} (${hitPct}%)\` | \`${formatTokensCompact(bucket.outputTokens)}\` | ${costCell} |`;
}

/**
 * Formata uma linha da Tabela 2 (por Modelo Utilizado).
 * @param {ReturnType<typeof createEmptyBucket>} bucket
 */
function formatModelTableRow(bucket) {
  return `| \`${bucket.label}\` | ${bucket.tierLabel} | \`${bucket.calls}\` | \`${formatTokensCompact(bucket.inputTokens)}\` | \`${formatTokensCompact(bucket.cacheReadTokens)}\` | \`${formatTokensCompact(bucket.outputTokens)}\` | **\`US$ ${bucket.realUsd.toFixed(2)}\`** |`;
}

/**
 * Localiza o `transcript.jsonl` mais recente em `~/.gemini/antigravity/brain/` quando `steps` não é fornecido.
 * @returns {Array<Record<string, any>>}
 */
export function loadLatestConversationSteps() {
  const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  if (!fs.existsSync(brainDir)) return [];
  const candidates = [];
  for (const entry of fs.readdirSync(brainDir)) {
    const transcriptFile = path.join(brainDir, entry, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(transcriptFile)) {
      candidates.push({ file: transcriptFile, mtimeMs: fs.statSync(transcriptFile).mtimeMs });
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (candidates.length === 0) return [];
  return fs
    .readFileSync(candidates[0].file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Agrega os passos de `transcript.jsonl` nos acumuladores por Fase, por Modelo e Total.
 * @param {Array<Record<string, any>>} steps
 */
function aggregateStepsIntoBuckets(steps) {
  const phaseMap = new Map(PHASE_NAMES.map((p) => [p, createEmptyBucket(p)]));
  const modelMap = new Map();
  const totalBucket = createEmptyBucket('TOTAL DESTA ISSUE');
  let activePhase = 'DEFINE & PLAN';

  for (const step of steps) {
    activePhase = inferStepPhase(step, activePhase);
    if (step?.type && step.type !== 'PLANNER_RESPONSE') continue;
    const modelName = String(step?.model || 'gemini-4-argon-low');
    const metric = {
      model: modelName,
      inputTokens: Number(step?.input_tokens ?? 0),
      cacheReadTokens: Number(step?.cache_read_tokens ?? 0),
      outputTokens: Number(step?.output_tokens ?? 0),
    };
    if (!modelMap.has(modelName)) {
      modelMap.set(modelName, createEmptyBucket(modelName, resolveModelPricing(modelName).tierLabel));
    }
    addMetricToBucket(phaseMap.get(activePhase) ?? phaseMap.get('BUILD'), metric);
    addMetricToBucket(modelMap.get(modelName), metric);
    addMetricToBucket(totalBucket, metric);
  }
  return { phaseMap, modelMap, totalBucket };
}

/**
 * Gera o bloco Markdown com a Tabela 1 (por Fase) e a Tabela 2 (apenas modelos utilizados com `calls > 0`) (GF-13, GF-14).
 * Exemplo: const md = computeIssueFinOpsMarkdown(steps);
 *
 * @param {Array<Record<string, any>>} [rawSteps]
 * @returns {string}
 */
export function computeIssueFinOpsMarkdown(rawSteps) {
  const steps = Array.isArray(rawSteps) ? rawSteps : loadLatestConversationSteps();
  const { phaseMap, modelMap, totalBucket } = aggregateStepsIntoBuckets(steps);
  const usedModels = Array.from(modelMap.values()).filter((row) => row.calls > 0);
  const savedUsd = Math.max(0, totalBucket.noCacheUsd - totalBucket.realUsd);
  const savedPct = totalBucket.noCacheUsd > 0 ? ((savedUsd / totalBucket.noCacheUsd) * PERCENT_SCALE).toFixed(1) : '0.0';

  return [
    '## 💰 Telemetria FinOps da Entrega (`review.mjs`)',
    `- **Economia Real do Prompt Cache & Tiers DAG:** **\`US$ ${savedUsd.toFixed(2)} (-${savedPct}%)\`**`,
    '',
    '#### 1. Consumo por Fase do Ciclo Aegis (Issue Atual)',
    '| Fase da Entrega | Chamadas (`Steps`) | Input Novo | Cache Lido (`Hit %`) | Output | Custo Equiv. API (US$) |',
    '| :--- | :---: | :---: | :---: | :---: | :---: |',
    ...PHASE_NAMES.map((p) => formatPhaseTableRow(phaseMap.get(p), false)),
    formatPhaseTableRow(totalBucket, true),
    '',
    '#### 2. Breakdown por Modelo Efetivamente Utilizado nesta Issue (`calls > 0`)',
    '| Modelo (`transcript.jsonl`) | Tier DAG | Chamadas | Input Novo | Cache Lido | Output | Custo Equiv. API (US$) |',
    '| :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
    ...usedModels.map((row) => formatModelTableRow(row)),
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.stdout.write(`${computeIssueFinOpsMarkdown()}\n`);
}
