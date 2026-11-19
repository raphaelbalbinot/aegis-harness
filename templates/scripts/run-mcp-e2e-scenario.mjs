#!/usr/bin/env node
// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MCP_DIR = path.join(REPO_ROOT, 'frontend/e2e/mcp');

/**
 * Carrega declarativamente todos os roteiros MCP de frontend/e2e/mcp/*.mcp.ts
 * @returns {Record<string, any>}
 */
function loadScenarioRegistry() {
  /** @type {Record<string, any>} */
  const registry = {};

  if (!fs.existsSync(MCP_DIR)) {
    return registry;
  }

  const files = fs.readdirSync(MCP_DIR).filter(file => file.endsWith('.mcp.ts'));

  for (const file of files) {
    const fullPath = path.join(MCP_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf-8');

    try {
      // Remove imports (incluindo multi-linha) e anotações TypeScript para carregar como objeto JS puro
      const sanitized = content
        .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
        .replace(/:\s*McpScenarioDefinition/g, '')
        .replace(/export\s+const\s+\w+\s*=\s*/, 'return ');

      const fn = new Function('MASTER_MANUSCRIPT_PROJECT', 'MASTER_MANUSCRIPT_SECTIONS', sanitized);
      const scenario = fn({}, []);

      if (scenario && scenario.id) {
        registry[scenario.id] = scenario;
      }
    } catch (err) {
      process.stderr.write(`[run-mcp-e2e-scenario] Aviso ao carregar roteiro ${file}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  return registry;
}

/**
 * Registro de Roteiros MCP E2E (Dual E2E)
 */
export const mcpScenarioRegistry = loadScenarioRegistry();

/**
 * Escreve uma linha na saída padrão.
 * @param {string} text
 */
function printLine(text = '') {
  process.stdout.write(`${text}\n`);
}

function printHelp() {
  printLine(`
Uso: node scripts/run-mcp-e2e-scenario.mjs [opções]

Opções:
  --list               Lista todos os roteiros MCP E2E disponíveis
  --scenario=<id>      Exibe os passos detalhados do roteiro para execução via Chrome DevTools MCP
  --scenario all       Exibe todos os roteiros em sequência
  --help               Exibe esta mensagem de ajuda
  `);
}

function listScenarios() {
  const ids = Object.keys(mcpScenarioRegistry);
  printLine('\n\x1b[1m\x1b[36m🎭 ROTEIROS DUAL E2E DISPONÍVEIS (Chrome DevTools MCP & Playwright)\x1b[0m');
  printLine('\x1b[36m────────────────────────────────────────────────────────────────────────────\x1b[0m');

  if (ids.length === 0) {
    printLine('Nenhum roteiro MCP encontrado em frontend/e2e/mcp/*.mcp.ts');
    return;
  }

  for (const id of ids) {
    const s = mcpScenarioRegistry[id];
    const playwrightSpec = `frontend/e2e/${id}.spec.ts`;
    printLine(`  \x1b[1m\x1b[32m✔ ${id.padEnd(25)}\x1b[0m \x1b[90m| Rota: ${s.route.padEnd(38)} | Passos: ${s.steps?.length ?? 0}\x1b[0m`);
    printLine(`    \x1b[90mTítulo: ${s.title}\x1b[0m`);
    printLine(`    \x1b[90mParidade Playwright: ${playwrightSpec}\x1b[0m\n`);
  }
}

function showScenario(id) {
  const scenario = mcpScenarioRegistry[id];
  if (!scenario) {
    process.stderr.write(`\x1b[31mErro: Roteiro '${id}' não encontrado.\x1b[0m\n`);
    printLine(`Roteiros disponíveis: ${Object.keys(mcpScenarioRegistry).join(', ')}`);
    process.exit(1);
  }

  const playwrightSpec = `frontend/e2e/${scenario.id}.spec.ts`;

  printLine('\n\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════\x1b[0m');
  printLine(`\x1b[1m🎯 ROTEIRO MCP: ${scenario.title} (${scenario.id})\x1b[0m`);
  printLine(`\x1b[90mParidade Playwright: ${playwrightSpec}\x1b[0m`);
  printLine(`\x1b[90mRota Inicial:        ${scenario.route}\x1b[0m`);
  printLine('\x1b[35m════════════════════════════════════════════════════════════════════\x1b[0m\n');

  printLine('\x1b[1mPassos de Execução (Mapeados para Ferramentas Chrome DevTools MCP):\x1b[0m');
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const stepNum = i + 1;
    const selectorStr = step.selector ? ` -> [${step.selector}]` : '';
    const formattedValue = typeof step.value === 'object' ? JSON.stringify(step.value) : `"${step.value}"`;
    const valueStr = step.value ? ` (valor: ${formattedValue})` : '';

    printLine(`  \x1b[33m[Passo ${stepNum}]\x1b[0m \x1b[1m${step.action.toUpperCase()}\x1b[0m: ${step.description}${selectorStr}${valueStr}`);
  }
  printLine('\n\x1b[32m✔ Pronto para orquestração interativa via Chrome DevTools MCP.\x1b[0m\n');
}

/** @param {string[]} args */
function parseMcpCliArgs(args) {
  const listArg = args.includes('--list') || args.includes('-l');
  const helpArg = args.includes('--help') || args.includes('-h');
  const eqArg = args.find((a) => a.startsWith('--scenario='));
  if (eqArg) {
    return { scenarioArg: eqArg.split('=')[1] ?? null, listArg, helpArg };
  }
  const idx = args.indexOf('--scenario');
  const nextVal = idx !== -1 ? args[idx + 1] : undefined;
  const scenarioArg = nextVal && !nextVal.startsWith('--') ? nextVal : null;
  return { scenarioArg, listArg, helpArg };
}

function runCli() {
  const args = process.argv.slice(2);
  const { scenarioArg, listArg, helpArg } = parseMcpCliArgs(args);

  if (helpArg) {
    printHelp();
    process.exit(0);
  }
  if (listArg || (!scenarioArg && args.length === 0)) {
    listScenarios();
    return;
  }
  if (!scenarioArg) {
    printHelp();
    return;
  }
  const targetIds = scenarioArg === 'all' ? Object.keys(mcpScenarioRegistry) : [scenarioArg];
  for (const id of targetIds) {
    showScenario(id);
  }
}

runCli();
