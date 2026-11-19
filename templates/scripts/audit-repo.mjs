#!/usr/bin/env node
/**
 * scripts/audit-repo.mjs
 *
 * Motor universal Multi-OS (Windows, Linux, macOS, Containers) de auditoria
 * estrutural e arquitetural do repositório (Aegis Engineering Harness).
 * Gera `scratch/repo_audit_prompt.md` com uso exclusivo de `execFileSync` (CWE-78 safe).
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const EXCLUDED_TREE_REGEX = /node_modules|\.git|dist|build|\.next|^workspace\/|^scratch\//;

/**
 * Executa um comando externo via `execFileSync` retornando stdout ou mensagem de fallback.
 * @param {{ cmd: string; args: string[]; cwd: string; fallbackMessage: string }} execSpec
 * @returns {string}
 */
function runSafeCommand({ cmd, args, cwd, fallbackMessage }) {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim() !== '' ? out.trim() : fallbackMessage;
  } catch (err) {
    const stdout = err && typeof err === 'object' && 'stdout' in err ? String(err.stdout ?? '').trim() : '';
    return stdout !== '' ? stdout : fallbackMessage;
  }
}

/**
 * Coleta a árvore de arquivos rastreados pelo Git filtrando diretórios efêmeros.
 * @param {string} root
 * @returns {string}
 */
function collectRepoTree(root) {
  const raw = runSafeCommand({ cmd: 'git', args: ['ls-files'], cwd: root, fallbackMessage: '' });
  if (raw === '') return 'Git não inicializado ou falha ao listar arquivos.';
  return raw
    .split(/\r?\n/)
    .filter((f) => f && !EXCLUDED_TREE_REGEX.test(f))
    .join('\n');
}

/**
 * Lê os manifestos `package.json` existentes na raiz e em subpacotes padrão.
 * @param {string} root
 * @returns {string}
 */
function readWorkspacePackageManifests(root) {
  const relCandidates = ['package.json', 'frontend/package.json', 'backend/package.json'];
  const chunks = [];
  for (const rel of relCandidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) {
      chunks.push(`// ${rel}\n${fs.readFileSync(abs, 'utf8')}`);
    }
  }
  return chunks.length > 0 ? chunks.join('\n') : '// Nenhum package.json encontrado';
}

/**
 * Executa checagens opcionais de Dependency-Cruiser, TypeScript e Guardrails.
 * @param {string} root
 */
function runRepoGuardrailChecks(root) {
  const depCruiserContent = fs.existsSync(path.join(root, '.dependency-cruiser.js'))
    ? runSafeCommand({
        cmd: 'npx',
        args: ['depcruise', '--config', '.dependency-cruiser.js', 'frontend/src', 'backend/src'],
        cwd: root,
        fallbackMessage: 'Sem violações reportadas.',
      })
    : 'Não executado';

  const tscFront = runSafeCommand({ cmd: 'npm', args: ['run', 'typecheck', '--prefix', 'frontend'], cwd: root, fallbackMessage: 'Não aplicável' });
  const tscBack = runSafeCommand({ cmd: 'npm', args: ['run', 'typecheck', '--prefix', 'backend'], cwd: root, fallbackMessage: 'Não aplicável' });
  const astOut = runSafeCommand({ cmd: 'npm', args: ['run', 'ast:scan'], cwd: root, fallbackMessage: 'Não aplicável' });
  const knipOut = runSafeCommand({ cmd: 'npm', args: ['run', 'audit:dead-code'], cwd: root, fallbackMessage: 'Não aplicável' });

  return {
    depCruiserContent,
    tscContent: `// Frontend typecheck:\n${tscFront}\n\n// Backend typecheck:\n${tscBack}`,
    guardrailsContent: `// ast-grep:\n${astOut}\n\n// knip:\n${knipOut}`,
  };
}

/**
 * Extrai os cabeçalhos Markdown (`#`, `##`, `###`) do documento de arquitetura do projeto.
 * @param {string} root
 * @returns {string}
 */
function readArchitectureHeadings(root) {
  const candidates = [path.join(root, 'docs', 'ARCHITECTURE.md'), path.join(root, 'docs', 'architecture.md')];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return 'Arquivo docs/architecture.md não encontrado.';
  const headings = fs
    .readFileSync(found, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^#{1,3}\s+/.test(line));
  return headings.length > 0 ? headings.join('\n') : 'Sem cabeçalhos detectados.';
}

/**
 * Monta o texto Markdown do dossiê de auditoria estrutural do repositório.
 * @param {Record<string, string>} auditSections
 * @returns {string}
 */
function buildRepoAuditPromptText(auditSections) {
  return [
    'Papel: Arquiteto de Software e Auditor de Segurança Sênior.',
    'Contexto:',
    'Auditoria estrutural e arquitetural do repositório (Aegis Engineering Harness).',
    '',
    '0. Panorama Incremental (Issues Abertas e Índice Arquitetural):',
    '```text',
    auditSections.openIssuesContent,
    '```',
    '```text',
    auditSections.archOutlineContent,
    '```',
    '',
    '1. Árvore de arquivos do repositório:',
    '```text',
    auditSections.treeContent,
    '```',
    '',
    '2. Manifestos package.json:',
    '```json',
    auditSections.packageJsonContent,
    '```',
    '',
    '3. Relatório de Fronteiras / Dependency-Cruiser:',
    '```text',
    auditSections.depCruiserContent,
    '```',
    '',
    '4. Verificação de Tipos nos Workspaces:',
    '```text',
    auditSections.tscContent,
    '```',
    '',
    '5. Guardrails Sintáticos (ast-grep) e Código Morto (Knip):',
    '```text',
    auditSections.guardrailsContent,
    '```',
    '',
    'Objetivo:',
    '1. [Fronteiras, Estrutura e Drift Arquitetural]: Há violações de camadas ou divergência com docs/architecture.md?',
    '2. [Saúde de Dependências]: Há dependências obsoletas, duplicadas ou órfãs?',
    '3. [Tipagem e Governança]: Há falhas críticas de tipagem ou guardrails?',
    '',
    'Diretriz: Seja conciso. Agrupe problemas como "Propostas de Novas Issues Atômicas". Se íntegro, responda "APROVADO".',
  ].join('\n');
}

/**
 * Gera o dossiê completo de auditoria estrutural do repositório em `scratch/repo_audit_prompt.md`.
 * Exemplo: generateRepoAuditDossier({ root: process.cwd() });
 *
 * @param {{ root?: string; scope?: string; maxFiles?: string | number; maxLinesPerFile?: string | number }} [options]
 * @returns {string}
 */
export function generateRepoAuditDossier(options = {}) {
  const root = options.root ?? process.cwd();
  const checks = runRepoGuardrailChecks(root);
  const prompt = buildRepoAuditPromptText({
    openIssuesContent: runSafeCommand({
      cmd: 'gh',
      args: ['issue', 'list', '--state', 'open', '--limit', '30'],
      cwd: root,
      fallbackMessage: 'Nenhuma issue aberta listada no momento.',
    }),
    archOutlineContent: readArchitectureHeadings(root),
    treeContent: collectRepoTree(root),
    packageJsonContent: readWorkspacePackageManifests(root),
    depCruiserContent: checks.depCruiserContent,
    tscContent: checks.tscContent,
    guardrailsContent: checks.guardrailsContent,
  });

  const scratchDir = path.join(root, 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  fs.writeFileSync(path.join(scratchDir, 'repo_audit_prompt.md'), prompt, 'utf8');
  return prompt;
}

/**
 * Faz o parsing dos argumentos CLI do `audit-repo.mjs`.
 * @param {string[]} argv
 */
function parseAuditCliArgs(argv) {
  /** @type {Record<string, string>} */
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') options.root = argv[++i];
    else if (argv[i] === '--scope') options.scope = argv[++i];
    else if (argv[i] === '--max-files') options.maxFiles = argv[++i];
    else if (argv[i] === '--max-lines-per-file') options.maxLinesPerFile = argv[++i];
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateRepoAuditDossier(parseAuditCliArgs(process.argv.slice(2)));
  process.stdout.write('[OK] Auditoria estrutural gerada com sucesso.\n');
}
