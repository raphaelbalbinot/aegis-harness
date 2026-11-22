#!/usr/bin/env node
// @ts-check
/**
 * scripts/simulate-efficacy.mjs — Simulação Executável de Eficácia do Aegis Harness v2
 *
 * Executa 6 cenários adversariais determinísticos (incluindo Spec Drift e Scope Drift)
 * em um repositório Git temporário isolado, sem chamadas de API externas.
 *
 * Uso: node scripts/simulate-efficacy.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildGraph,
  calculateBlastRadius,
  recordBlastRadiusStamp,
} from '../templates/scripts/blast-radius.mjs';
import {
  checkRuleFilesBudget,
  evaluatePreToolUseHook,
  recordGateStamp,
} from '../templates/scripts/aegis-hook-guard.mjs';
import { consolidateMantisHubSkill } from '../bin/init-harness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Cria um repositório Git temporário isolado com arquivos iniciais commitados.
 * @param {Record<string, string>} files
 */
function createTempGitRepo(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-eval-'));
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'eval@aegis.local'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Aegis Eval'], { cwd: tmpDir, stdio: 'ignore' });
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  execFileSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'chore: initial fixture'], { cwd: tmpDir, stdio: 'ignore' });
  return tmpDir;
}

/** @param {string} name @param {() => { ok: boolean; detail: string }} fn */
function runScenario(name, fn) {
  const start = Date.now();
  try {
    const res = fn();
    return { name, ok: res.ok, detail: res.detail, ms: Date.now() - start };
  } catch (err) {
    return { name, ok: false, detail: `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`, ms: Date.now() - start };
  }
}

function main() {
  const startedAt = Date.now();
  const results = [];

  // Cenário 1: Fast-Path legítimo (Tier 0) — dispensa 1º Goldfish, mas exige 2º Goldfish no commit
  results.push(runScenario('1. Fast-Path Tier 0 (Baixa Fricção + 2º Goldfish Obrigatório)', () => {
    const tmp = createTempGitRepo({ 'src/utils/math.ts': 'export const add = (a: number, b: number) => a + b;\n' });
    try {
      const report = calculateBlastRadius('src/utils/math.ts', buildGraph(tmp));
      recordBlastRadiusStamp(tmp, {
        planGoldfishRequired: report.planGoldfishRequired,
        codeGoldfishRequired: report.codeGoldfishRequired,
        ceremonyTier: report.ceremonyTier,
        evaluatedFiles: ['src/utils/math.ts'],
      });
      const planRes = evaluatePreToolUseHook({
        cwd: tmp,
        toolCall: {
          name: 'write_file',
          args: {
            Path: path.join(tmp, 'implementation_plan.md'),
            Content: '# Plano Tier 0\nDado add(1,2) Quando executo Então retorna 3',
            ArtifactMetadata: { RequestFeedback: true, Summary: 'Tier 0', UserFacing: true },
          },
        },
      });
      recordGateStamp(tmp, 'auditVerifyPassedAt');
      const commitWithoutReview = evaluatePreToolUseHook({
        cwd: tmp,
        toolCall: { name: 'run_command', args: { CommandLine: 'git commit -m "feat: add (#1)"' } },
      });
      const ok = report.ceremonyTier === 'XS_EXPRESS'
        && report.planGoldfishRequired === false
        && report.codeGoldfishRequired === true
        && planRes.decision === 'allow'
        && commitWithoutReview.decision === 'deny';
      return { ok, detail: 'Tier 0 liberou plano sem 1º Goldfish e bloqueou commit sem 2º Goldfish.' };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }));

  // Cenário 2: Spec Drift (Scope Drift / Burla de Fast-Path no git diff --cached)
  results.push(runScenario('2. Spec Drift — Burla de Escopo no Commit (Anti-Bypass)', () => {
    const tmp = createTempGitRepo({
      'src/utils/math.ts': 'export const add = (a: number, b: number) => a + b;\n',
      'src/auth/login.ts': 'export const login = () => true;\n',
    });
    try {
      recordBlastRadiusStamp(tmp, {
        planGoldfishRequired: false,
        codeGoldfishRequired: true,
        ceremonyTier: 'XS_EXPRESS',
        evaluatedFiles: ['src/utils/math.ts'],
      });
      recordGateStamp(tmp, 'auditVerifyPassedAt');
      recordGateStamp(tmp, 'reviewDossierGeneratedAt');
      fs.writeFileSync(path.join(tmp, 'src/auth/login.ts'), 'export const login = () => false;\n', 'utf8');
      execFileSync('git', ['add', 'src/auth/login.ts'], { cwd: tmp, stdio: 'ignore' });

      const res = evaluatePreToolUseHook({
        cwd: tmp,
        toolCall: { name: 'run_command', args: { CommandLine: 'git commit -m "feat: sneaky auth change (#2)"' } },
      });
      const ok = res.decision === 'deny' && /Anti-Burla/i.test(res.reason ?? '');
      return { ok, detail: 'Hook detectou src/auth/login.ts fora da spec Tier 0 e bloqueou o commit.' };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }));

  // Cenário 3: Spec Drift — Plano Tier 1+ (Segurança) tentando pular 1º Goldfish
  results.push(runScenario('3. Spec Drift — Plano de Segurança Sem Cold Spec Review (GF-01)', () => {
    const tmp = createTempGitRepo({ 'src/auth/token.ts': 'export const verify = (t: string) => Boolean(t);\n' });
    try {
      const report = calculateBlastRadius('src/auth/token.ts', buildGraph(tmp));
      recordBlastRadiusStamp(tmp, {
        planGoldfishRequired: report.planGoldfishRequired,
        codeGoldfishRequired: report.codeGoldfishRequired,
        ceremonyTier: report.ceremonyTier,
        evaluatedFiles: ['src/auth/token.ts'],
      });
      const planRes = evaluatePreToolUseHook({
        cwd: tmp,
        toolCall: {
          name: 'write_file',
          args: {
            Path: path.join(tmp, 'implementation_plan.md'),
            Content: '# Plano Auth\nSem auditoria Goldfish.',
            ArtifactMetadata: { RequestFeedback: true, Summary: 'Auth', UserFacing: true },
          },
        },
      });
      const ok = report.securitySurfaceTouched === true
        && report.planGoldfishRequired === true
        && report.recommendedSkills.includes('mantis-advise')
        && planRes.decision === 'deny';
      return { ok, detail: 'Forçou FULL_EGM_DAG + mantis-advise e bloqueou Proceed sem GF-01.' };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }));

  // Cenário 4: Bypass de Staging Cirúrgico (`git commit -a`)
  results.push(runScenario('4. Bypass de Staging Cirúrgico (`git commit -a`)', () => {
    const tmp = createTempGitRepo({ 'src/app.ts': 'export const ok = true;\n' });
    try {
      const res = evaluatePreToolUseHook({
        cwd: tmp,
        toolCall: { name: 'run_command', args: { CommandLine: 'git commit -am "feat: bypass all"' } },
      });
      const ok = res.decision === 'deny' && /git commit -a/i.test(res.reason ?? '');
      return { ok, detail: 'Bloqueou `git commit -am` exigindo staging cirúrgico.' };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }));

  // Cenário 5: Estouro de Orçamento de Contexto (`> 22 KB` em `.agents/rules/`)
  results.push(runScenario('5. Proteção Contra Context Bloat (> 22 KB nas Rules)', () => {
    const tmp = createTempGitRepo({ 'AGENTS.md': '# Enxuto\n' });
    try {
      const rulesDir = path.join(tmp, '.agents', 'rules');
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(path.join(rulesDir, 'bloated.md'), 'X'.repeat(23000), 'utf8');
      const check = checkRuleFilesBudget(tmp);
      const ok = check.ok === false && check.violations.length === 1;
      return { ok, detail: 'Detectou arquivo de regra acima de 22 KB antes de truncar o contexto.' };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }));

  // Cenário 6: Consolidação Mantis Hub-Skill (19 -> 2 slots no topo, 0 capacidades perdidas)
  results.push(runScenario('6. Consolidação Mantis Hub-Skill (0 Perdas, Menos Ruído)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-mantis-eval-'));
    try {
      const skillsDir = path.join(tmp, '.agents', 'skills');
      for (const s of ['mantis-meta-agent', 'mantis-advise', 'mantis-threat-model', 'mantis-patch', 'mantis-report']) {
        fs.mkdirSync(path.join(skillsDir, s), { recursive: true });
        fs.writeFileSync(path.join(skillsDir, s, 'SKILL.md'), `# ${s}\n`, 'utf8');
      }
      const moved = consolidateMantisHubSkill(skillsDir);
      const top = fs.readdirSync(skillsDir).filter((d) => d.startsWith('mantis-')).sort();
      const refs = fs.readdirSync(path.join(skillsDir, 'mantis-meta-agent', 'references')).sort();
      const ok = moved.length === 3
        && JSON.stringify(top) === JSON.stringify(['mantis-advise', 'mantis-meta-agent'])
        && refs.length === 3;
      return { ok, detail: `Consolidou ${moved.length} estágios em references/ mantendo apenas ${top.join(' + ')} no topo.` };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }));

  const passed = results.filter((r) => r.ok).length;
  const totalMs = Date.now() - startedAt;

  process.stdout.write('\n🛡️  AEGIS HARNESS v2 — SCORECARD DE EFICÁCIA (SIMULAÇÃO DETERMINÍSTICA)\n');
  process.stdout.write('════════════════════════════════════════════════════════════════════════\n');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    process.stdout.write(`${icon} ${r.name} (${r.ms}ms)\n   └─ ${r.detail}\n`);
  }
  process.stdout.write('════════════════════════════════════════════════════════════════════════\n');
  process.stdout.write(`📊 Resultado: ${passed}/${results.length} cenários adversariais mitigados | Tempo total: ${totalMs}ms\n\n`);

  if (passed !== results.length) process.exit(1);
}

main();
