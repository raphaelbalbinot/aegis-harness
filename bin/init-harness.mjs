#!/usr/bin/env node
/**
 * bin/init-harness.mjs — Aegis Harness Polyglot Bootstrapper
 *
 * 1. Detecta automaticamente a linguagem, frameworks e domínios de teste do projeto alvo.
 * 2. Busca a versão mais recente das Agent Skills nos repositórios oficiais do GitHub
 *    (ex.: addyosmani/agent-skills, addyosmani/web-quality-skills) com fallback transparente
 *    para o snapshot local embarcado em `skills/fallback-cache/` e `skills/sovereign/`.
 * 3. Gera `harness.config.json`, `AGENTS.md` (sem acoplamento a projetos específicos) e
 *    instala os scripts universais (`review.ps1`, `audit-repo.ps1`, `plan-collision.mjs`,
 *    `blast-radius.mjs`, `audit-verify.mjs`, `check-test-naming-governance.mjs`).
 *
 * Uso:
 *   node <caminho-do-aegis-harness>/bin/init-harness.mjs [--target <dir>] [--offline] [--force]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HARNESS_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  let target = process.cwd();
  let offline = false;
  let force = false;
  let updateCache = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target' && argv[i + 1]) {
      target = path.resolve(argv[++i]);
    } else if (arg === '--offline') {
      offline = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--update-cache') {
      updateCache = true;
    }
  }
  return { target, offline, force, updateCache };
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Detecta automaticamente a linguagem, stack e pastas de domínio do projeto alvo.
 */
export function detectProjectStack(targetDir) {
  const has = (rel) => fs.existsSync(path.join(targetDir, rel));
  const projectName = path.basename(targetDir);

  let language = 'polyglot';
  const frameworks = [];
  let gates = [];

  if (has('package.json')) {
    language = has('tsconfig.json') ? 'typescript' : 'javascript';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf-8'));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (deps.next) frameworks.push('Next.js');
      if (deps.react) frameworks.push('React');
      if (deps.vue) frameworks.push('Vue');
      if (deps.express) frameworks.push('Express');
      if (deps.fastify) frameworks.push('Fastify');
      if (deps.vitest) frameworks.push('Vitest');
      if (deps.playwright || deps['@playwright/test']) frameworks.push('Playwright');
      if (deps.firebase || deps['firebase-admin']) frameworks.push('Firebase');
    } catch {
      // ignora package.json inválido
    }
    gates = [
      { name: 'Lockfile Sync Check', command: 'node scripts/check-lockfile-sync.mjs' },
      { name: 'AST Guardrails (ast-grep)', command: 'npx @ast-grep/cli scan' },
      { name: 'Dead Code & Orphans (knip)', command: 'npx knip' },
      { name: 'Module Boundaries (dependency-cruiser)', command: 'npx depcruise --config .dependency-cruiser.js .' },
      ...(has('tsconfig.json') ? [{ name: 'TypeScript Strict Typecheck', command: 'npx tsc --noEmit' }] : []),
      { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' },
      { name: 'Clean Code 22 Rules Scan', command: 'node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --enforce-zero-rules' },
      { name: 'Automated Test Suite', command: 'npm test' }
    ];
  } else if (has('pyproject.toml') || has('requirements.txt')) {
    language = 'python';
    frameworks.push('Python');
    gates = [
      { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' },
      { name: 'Ruff Linter & Complexity', command: 'ruff check .' },
      { name: 'Mypy Strict Typecheck', command: 'mypy .' },
      { name: 'Pytest Suite', command: 'pytest' }
    ];
  } else if (has('go.mod')) {
    language = 'go';
    frameworks.push('Go');
    gates = [
      { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' },
      { name: 'Go Vet', command: 'go vet ./...' },
      { name: 'Go Test Suite', command: 'go test ./...' }
    ];
  } else if (has('Cargo.toml')) {
    language = 'rust';
    frameworks.push('Rust / Cargo');
    gates = [
      { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' },
      { name: 'Cargo Clippy', command: 'cargo clippy -- -D warnings' },
      { name: 'Cargo Test Suite', command: 'cargo test' }
    ];
  } else if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    language = 'java';
    frameworks.push(has('pom.xml') ? 'Java / Maven' : 'Java / Gradle');
    gates = [
      { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' },
      { name: 'JVM Test Suite', command: has('pom.xml') ? 'mvn test' : './gradlew test' }
    ];
  } else {
    gates = [
      { name: 'Test Naming Governance', command: 'node scripts/check-test-naming-governance.mjs' }
    ];
  }

  // Descobre domínios candidatos olhando src/ ou tests/
  const candidateRoots = ['src', 'frontend/src', 'backend/src', 'app', 'pkg', 'internal'];
  const discoveredDomains = new Set();
  for (const r of candidateRoots) {
    const full = path.join(targetDir, r);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        if (entry.isDirectory() && !['tests', '__tests__', 'node_modules', 'types', 'utils'].includes(entry.name)) {
          discoveredDomains.add(`tests/${entry.name}/`);
        }
      }
    }
  }
  if (discoveredDomains.size === 0) {
    ['tests/core/', 'tests/api/', 'tests/storage/', 'tests/governance/'].forEach((d) => discoveredDomains.add(d));
  } else {
    discoveredDomains.add('tests/governance/');
  }

  return {
    projectName,
    language,
    stackSummary: frameworks.length > 0 ? frameworks.join(', ') : language.toUpperCase(),
    testDomains: Array.from(discoveredDomains).slice(0, 8),
    gates
  };
}

/**
 * Tenta baixar a versão mais recente de um repositório upstream no GitHub com timeout curto.
 * Em caso de sucesso, atualiza o fallback cache local; em caso de falha, usa o fallback local.
 */
function syncUpstreamSkills(upstream, targetSkillsDir, { offline, updateCache }) {
  const fallbackBase = path.join(HARNESS_ROOT, upstream.fallbackDir);
  let sourceBase = fallbackBase;
  let usedRemote = false;
  let tempCloneDir = null;

  if (upstream.repo && !offline) {
    try {
      tempCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), `aegis-${upstream.id}-`));
      console.log(`🌐 [Upstream] Buscando versão mais recente de ${upstream.id} (${upstream.repo})...`);
      execSync(
        `git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=8 clone --depth 1 --branch ${upstream.branch ?? 'main'} ${upstream.repo} "${tempCloneDir}"`,
        { stdio: 'pipe', timeout: 12000 }
      );
      const remoteSkillsPath = upstream.remoteSubdir
        ? path.join(tempCloneDir, upstream.remoteSubdir)
        : tempCloneDir;

      if (fs.existsSync(remoteSkillsPath)) {
        sourceBase = remoteSkillsPath;
        usedRemote = true;
      } else if (fs.existsSync(path.join(tempCloneDir, 'SKILL.md'))) {
        // Repositório de skill única na raiz (ex.: tt-a1i/archify)
        sourceBase = tempCloneDir;
        usedRemote = true;
      }

      if (usedRemote && updateCache) {
        for (const skillName of upstream.skills) {
          const candidate = fs.existsSync(path.join(sourceBase, skillName))
            ? path.join(sourceBase, skillName)
            : (fs.existsSync(path.join(sourceBase, 'SKILL.md')) ? sourceBase : null);
          if (candidate) {
            copyDirRecursive(candidate, path.join(fallbackBase, skillName));
          }
        }
      }
    } catch {
      console.log(`⚠️  [Fallback Local] Sem acesso externo ou timeout em ${upstream.id}; usando snapshot local embarcado.`);
    }
  }

  let installedCount = 0;
  for (const skillName of upstream.skills) {
    let srcSkill = path.join(sourceBase, skillName);
    if (!fs.existsSync(srcSkill) && usedRemote && fs.existsSync(path.join(sourceBase, 'SKILL.md'))) {
      srcSkill = sourceBase;
    }
    const fallbackSkill = path.join(fallbackBase, skillName);
    const finalSrc = fs.existsSync(srcSkill) ? srcSkill : fallbackSkill;

    if (fs.existsSync(finalSrc)) {
      copyDirRecursive(finalSrc, path.join(targetSkillsDir, skillName));
      installedCount++;
    }
  }

  if (tempCloneDir && fs.existsSync(tempCloneDir)) {
    try {
      fs.rmSync(tempCloneDir, { recursive: true, force: true });
    } catch {
      // ignora limpeza de temp
    }
  }

  const originLabel = usedRemote ? 'GitHub Oficial (Latest)' : 'Snapshot Local (Fallback)';
  console.log(`✅ [${upstream.id}] ${installedCount} skill(s) instaladas via ${originLabel}.`);
}

function main() {
  const opts = parseArgs(process.argv);
  const targetDir = opts.target;

  console.log(`\n🛡️  ================================================================`);
  console.log(`🛡️  AEGIS HARNESS — Inicializador Políglota de Governança & Skills`);
  console.log(`🛡️  Diretório Alvo: ${targetDir}`);
  console.log(`🛡️  ================================================================\n`);

  const stack = detectProjectStack(targetDir);
  console.log(`🔍 Stack detectada automaticamente:`);
  console.log(`   • Projeto:   ${stack.projectName}`);
  console.log(`   • Linguagem: ${stack.language}`);
  console.log(`   • Stack:     ${stack.stackSummary}`);
  console.log(`   • Domínios:  ${stack.testDomains.join(', ')}\n`);

  // 1. Instalar Skills (.agents/skills/)
  const manifest = JSON.parse(fs.readFileSync(path.join(HARNESS_ROOT, 'sources.manifest.json'), 'utf-8'));
  const targetSkillsDir = path.join(targetDir, '.agents', 'skills');
  fs.mkdirSync(targetSkillsDir, { recursive: true });

  for (const upstream of manifest.upstreams) {
    syncUpstreamSkills(upstream, targetSkillsDir, opts);
  }

  // 2. Instalar Scripts Determinísticos (scripts/) e Configs de Guardrails (ast-grep, knip, dependency-cruiser, MCPs)
  const targetScriptsDir = path.join(targetDir, 'scripts');
  fs.mkdirSync(targetScriptsDir, { recursive: true });
  const templateScriptsDir = path.join(HARNESS_ROOT, 'templates', 'scripts');
  for (const file of fs.readdirSync(templateScriptsDir)) {
    const destFile = path.join(targetScriptsDir, file);
    if (!fs.existsSync(destFile) || opts.force) {
      fs.copyFileSync(path.join(templateScriptsDir, file), destFile);
    }
  }

  const templateConfigsDir = path.join(HARNESS_ROOT, 'templates', 'configs');
  if (fs.existsSync(templateConfigsDir)) {
    // Copia sgconfig.yml e rules/ do ast-grep
    const astGrepTpl = path.join(templateConfigsDir, 'ast-grep');
    if (fs.existsSync(astGrepTpl)) {
      const sgDest = path.join(targetDir, 'sgconfig.yml');
      if (!fs.existsSync(sgDest) || opts.force) {
        fs.copyFileSync(path.join(astGrepTpl, 'sgconfig.yml'), sgDest);
      }
      copyDirRecursive(path.join(astGrepTpl, 'rules'), path.join(targetDir, 'rules'));
    }

    // Se for JS/TS, copia knip.jsonc e .dependency-cruiser.js
    if (stack.language === 'typescript' || stack.language === 'javascript') {
      for (const cfgFile of ['knip.jsonc', '.dependency-cruiser.js']) {
        const destCfg = path.join(targetDir, cfgFile);
        if (!fs.existsSync(destCfg) || opts.force) {
          fs.copyFileSync(path.join(templateConfigsDir, cfgFile), destCfg);
        }
      }
    }

    // Se for Python, copia também os scripts Python nativos (templates/scripts-python)
    if (stack.language === 'python') {
      const pyScriptsTpl = path.join(HARNESS_ROOT, 'templates', 'scripts-python');
      if (fs.existsSync(pyScriptsTpl)) {
        for (const pyFile of fs.readdirSync(pyScriptsTpl)) {
          const destPy = path.join(targetScriptsDir, pyFile);
          if (!fs.existsSync(destPy) || opts.force) {
            fs.copyFileSync(path.join(pyScriptsTpl, pyFile), destPy);
          }
        }
      }
    }

    // Copia repomix.config.json na raiz
    const repomixTpl = path.join(templateConfigsDir, 'repomix.config.json');
    if (fs.existsSync(repomixTpl)) {
      const destRepomix = path.join(targetDir, 'repomix.config.json');
      if (!fs.existsSync(destRepomix) || opts.force) {
        fs.copyFileSync(repomixTpl, destRepomix);
      }
    }

    // Copia templates da Tríade Constitucional em docs/ (PRD.md, ARCHITECTURE.md, DIRETRIZES_DOMINIO.md) se não existirem
    const docsTplDir = path.join(HARNESS_ROOT, 'templates', 'docs');
    if (fs.existsSync(docsTplDir)) {
      const targetDocsDir = path.join(targetDir, 'docs');
      fs.mkdirSync(targetDocsDir, { recursive: true });
      const docMappings = [
        { tpl: 'PRD.template.md', dest: 'PRD.md' },
        { tpl: 'ARCHITECTURE.template.md', dest: 'ARCHITECTURE.md' },
        { tpl: 'DIRETRIZES_DOMINIO.template.md', dest: 'DIRETRIZES_DOMINIO.md', aliases: ['DIRETRIZES_CRIATIVAS.md', 'DIRETRIZES_EDITORIAIS.md'] }
      ];
      for (const docItem of docMappings) {
        const destDocPath = path.join(targetDocsDir, docItem.dest);
        const hasAlias = (docItem.aliases ?? []).some((alias) => fs.existsSync(path.join(targetDocsDir, alias)));
        if ((!fs.existsSync(destDocPath) && !hasAlias) || opts.force) {
          const rawDoc = fs.readFileSync(path.join(docsTplDir, docItem.tpl), 'utf-8');
          const renderedDoc = rawDoc
            .replace(/\{\{PROJECT_NAME\}\}/g, stack.projectName)
            .replace(/\{\{LANGUAGE\}\}/g, stack.language)
            .replace(/\{\{STACK_SUMMARY\}\}/g, stack.stackSummary)
            .replace(/\{\{TEST_DOMAINS\}\}/g, stack.testDomains.join(', '));
          fs.writeFileSync(destDocPath, renderedDoc, 'utf-8');
        }
      }
    }

    // Copia .github/ISSUE_TEMPLATE e .github/workflows/audit.yml
    const githubTpl = path.join(HARNESS_ROOT, 'templates', 'github');
    if (fs.existsSync(githubTpl)) {
      copyDirRecursive(githubTpl, path.join(targetDir, '.github'));
    }

    // Copia template de MCP servers para .agents/mcp-servers.template.json
    const mcpTpl = path.join(templateConfigsDir, 'mcp-servers.template.json');
    if (fs.existsSync(mcpTpl)) {
      fs.copyFileSync(mcpTpl, path.join(targetDir, '.agents', 'mcp-servers.template.json'));
    }
  }
  console.log(`\n✅ [Scripts, Tríade docs/, GitHub & Guardrails] Instalados em scripts/, docs/ (PRD.md, ARCHITECTURE.md, DIRETRIZES_DOMINIO.md), .github/ e raiz (review.ps1, audit-repo.ps1, plan-collision, blast-radius, audit-verify, check-lockfile-sync, check-test-naming-governance, run-mcp-e2e-scenario, sgconfig.yml + 3 rules AST, knip.jsonc, .dependency-cruiser.js, repomix.config.json e templates de Issue/Actions).`);

  // 3. Gerar harness.config.json
  const harnessConfigPath = path.join(targetDir, 'harness.config.json');
  if (!fs.existsSync(harnessConfigPath) || opts.force) {
    const configPayload = {
      harness: 'aegis-harness',
      version: '1.0.0',
      language: stack.language,
      stackSummary: stack.stackSummary,
      testDomains: stack.testDomains,
      gates: stack.gates
    };
    fs.writeFileSync(harnessConfigPath, JSON.stringify(configPayload, null, 2), 'utf-8');
    console.log(`✅ [Config] Arquivo harness.config.json gerado para ${stack.language}.`);
  }

  // 4. Gerar AGENTS.md parametrizado
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath) || opts.force) {
    const rawTemplate = fs.readFileSync(path.join(HARNESS_ROOT, 'templates', 'AGENTS.template.md'), 'utf-8');
    const rendered = rawTemplate
      .replace(/\{\{PROJECT_NAME\}\}/g, stack.projectName)
      .replace(/\{\{LANGUAGE\}\}/g, stack.language)
      .replace(/\{\{STACK_SUMMARY\}\}/g, stack.stackSummary)
      .replace(/\{\{TEST_DOMAINS\}\}/g, stack.testDomains.join(', '));
    fs.writeFileSync(agentsPath, rendered, 'utf-8');
    console.log(`✅ [Constituição] AGENTS.md gerado com 20 Regras + 7 Core Behaviors.`);
  } else {
    console.log(`ℹ️  [Constituição] AGENTS.md já existe no projeto (use --force para sobrescrever).`);
  }

  console.log(`\n🎉 [Aegis Harness] Instalação concluída com sucesso!\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
