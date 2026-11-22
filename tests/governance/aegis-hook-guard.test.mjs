// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MAX_RULE_FILE_BYTES,
  checkRuleFilesBudget,
  diagnoseParallelIssueBlocker,
  evaluatePreToolUseHook,
  recordGateStamp,
} from '../../templates/scripts/aegis-hook-guard.mjs';
import { computeIssueFinOpsMarkdown } from '../../templates/scripts/aegis-finops-telemetry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function createTempWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-hook-guard-'));
  fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
  return tmpDir;
}

describe('aegis-hook-guard.mjs — Guardrail Determinístico Nativo (GF-01, GF-02, GF-03, GF-04)', () => {
  it('Cenário 1: valida orçamento estrito (< 22 KB) de templates/AGENTS.template.md e README Multi-Agente com AWS Kiro', () => {
    const tplPath = path.join(REPO_ROOT, 'templates', 'AGENTS.template.md');
    const tplBytes = fs.statSync(tplPath).size;
    assert.ok(
      tplBytes <= MAX_RULE_FILE_BYTES,
      `templates/AGENTS.template.md (${tplBytes} B) deve ter <= ${MAX_RULE_FILE_BYTES} B`
    );
    const tplText = fs.readFileSync(tplPath, 'utf8');
    assert.ok(tplBytes <= 6000, `templates/AGENTS.template.md v2 (${tplBytes} B) deve ser enxuto (<= 6000 B)`);
    assert.match(tplText, /## 🧭 0\. Roteamento Modular/);
    assert.match(tplText, /RequestFeedback:\s*false/);
    assert.match(tplText, /BDD Gherkin/i);
    assert.doesNotMatch(tplText, /Cloud Run/i);
    assert.doesNotMatch(tplText, /Firestore/i);

    const readmeText = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
    assert.match(readmeText, /AWS Kiro/i, 'README.md deve documentar uso no AWS Kiro');
    assert.match(readmeText, /Amazon Q/i, 'README.md deve documentar uso no Amazon Q Developer');
    assert.match(readmeText, /aegis-hook-guard\.mjs/, 'README.md deve documentar o fiscal aegis-hook-guard.mjs');
  });

  it('Cenário 1b: checkRuleFilesBudget reprova arquivo AGENTS.md ou .agents/rules/*.md acima de 22 KB', () => {
    const tmpDir = createTempWorkspace();
    try {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Curto\n', 'utf8');
      const okCheck = checkRuleFilesBudget(tmpDir);
      assert.equal(okCheck.ok, true);

      const rulesDir = path.join(tmpDir, '.agents', 'rules');
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(path.join(rulesDir, 'oversized.md'), 'A'.repeat(MAX_RULE_FILE_BYTES + 100), 'utf8');
      const failCheck = checkRuleFilesBudget(tmpDir);
      assert.equal(failCheck.ok, false);
      assert.equal(failCheck.violations.length, 1);
      assert.match(failCheck.violations[0].file, /oversized\.md/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Cenário 4a: write_file em implementation_plan.md com RequestFeedback: false (rascunho frio) é permitido', () => {
    const res = evaluatePreToolUseHook({
      cwd: REPO_ROOT,
      toolCall: {
        name: 'write_file',
        args: {
          Path: 'C:/tmp/brain/123/implementation_plan.md',
          Content: '# Rascunho Frio\nSem Goldfish ainda.',
          ArtifactMetadata: { RequestFeedback: false, Summary: 'Draft', UserFacing: true },
        },
      },
    });
    assert.equal(res.decision, 'allow');
  });

  it('Cenário 4b: write_file em implementation_plan.md com RequestFeedback: true SEM tabela Goldfish é BLOQUEADO (deny)', () => {
    const res = evaluatePreToolUseHook({
      cwd: REPO_ROOT,
      toolCall: {
        name: 'write_file',
        args: {
          Path: 'C:/tmp/brain/123/implementation_plan.md',
          Content: '# Plano Sem Goldfish\n## Objetivo\nTeste.',
          ArtifactMetadata: { RequestFeedback: true, Summary: 'Ready', UserFacing: true },
        },
      },
    });
    assert.equal(res.decision, 'deny');
    assert.match(res.reason ?? '', /Cold Spec Review/i);
  });

  it('Cenário 4c: edit_file parcial em implementation_plan.md com RequestFeedback: true simula arquivo no disco (GF-02)', () => {
    const tmpDir = createTempWorkspace();
    const planFile = path.join(tmpDir, 'implementation_plan.md');
    try {
      // Caso 1: Arquivo no disco já tem o relatório Goldfish e o edit_file só altera o topo
      fs.writeFileSync(
        planFile,
        '# Plano\nStatus: DRAFT\n\n## 🐠 Relatório Cold Spec Review (EGM Goldfish)\n| **GF-01** | Cat | Achado | OK | Proceed |\n',
        'utf8'
      );
      const allowRes = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: {
          name: 'edit_file',
          args: {
            Path: planFile,
            Target: 'Status: DRAFT',
            Replacement: 'Status: APPROVED',
            ArtifactMetadata: { RequestFeedback: true, Summary: 'Approved', UserFacing: true },
          },
        },
      });
      assert.equal(allowRes.decision, 'allow', 'Deve permitir edit_file quando o arquivo resultante contém GF-01');

      // Caso 2: Arquivo no disco NÃO tem relatório Goldfish e o edit_file também não o adiciona
      fs.writeFileSync(planFile, '# Plano\nStatus: DRAFT\n', 'utf8');
      const denyRes = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: {
          name: 'edit_file',
          args: {
            Path: planFile,
            Target: 'Status: DRAFT',
            Replacement: 'Status: READY_WITHOUT_GF',
            ArtifactMetadata: { RequestFeedback: true, Summary: 'Bad', UserFacing: true },
          },
        },
      });
      assert.equal(denyRes.decision, 'deny', 'Deve bloquear edit_file quando o arquivo resultante não contém GF-01');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Cenário 5: run_command com git commit exige carimbos merged auditVerifyPassedAt e reviewDossierGeneratedAt (GF-03)', () => {
    const tmpDir = createTempWorkspace();
    try {
      // 1. Sem carimbo algum -> deny
      const noStampRes = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: {
          name: 'run_command',
          args: { CommandLine: 'git commit -m "feat(core): test (#1)"' },
        },
      });
      assert.equal(noStampRes.decision, 'deny');

      // 2. Apenas auditVerifyPassedAt gravado (sem review) -> deny
      recordGateStamp(tmpDir, 'auditVerifyPassedAt');
      const halfStampRes = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: {
          name: 'run_command',
          args: { CommandLine: 'git commit -m "feat(core): test (#1)"' },
        },
      });
      assert.equal(halfStampRes.decision, 'deny');

      // 3. Merge JSON com reviewDossierGeneratedAt -> allow!
      recordGateStamp(tmpDir, 'reviewDossierGeneratedAt');
      const fullStampRes = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: {
          name: 'run_command',
          args: { CommandLine: 'git commit -m "feat(core): test (#1)"' },
        },
      });
      assert.equal(fullStampRes.decision, 'allow');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Cenário 6: v2 exige Gherkin + interview-me + resumo enxuto, bloqueia git commit -a e libera Fast-Path Tier 0 no plano', () => {
    const tplText = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'AGENTS.template.md'), 'utf8');
    assert.match(tplText, /interview-me/i, 'AGENTS.template.md deve acionar interview-me para dúvidas de requisito');
    assert.match(tplText, /BDD Gherkin/i, 'AGENTS.template.md deve exigir Gherkin em 100% dos planos');
    assert.match(tplText, /resumo executivo compacto/i, 'AGENTS.template.md deve exigir resumo compacto no chat');
    assert.doesNotMatch(tplText, /CONFIDENCE.*95%/i, 'v2 remove cálculo artificial CONFIDENCE >= 95%');

    const tmpDir = createTempWorkspace();
    try {
      const commitAllDeny = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: { name: 'run_command', args: { CommandLine: 'git commit -am "feat: bypass"' } },
      });
      assert.equal(commitAllDeny.decision, 'deny', 'git commit -a deve ser bloqueado');

      fs.writeFileSync(
        path.join(tmpDir, '.git', 'aegis-gate-stamp.json'),
        JSON.stringify({
          blastRadiusEvaluation: {
            planGoldfishRequired: false,
            codeGoldfishRequired: true,
            ceremonyTier: 'XS_EXPRESS',
            evaluatedFiles: ['src/utils/math.ts'],
            evaluatedAt: Date.now(),
          },
        }),
        'utf8'
      );
      const fastPathPlanAllow = evaluatePreToolUseHook({
        cwd: tmpDir,
        toolCall: {
          name: 'write_file',
          args: {
            Path: path.join(tmpDir, 'implementation_plan.md'),
            Content: '# Plano Tier 0\n## Cenários Gherkin\nDado X Quando Y Então Z',
            ArtifactMetadata: { RequestFeedback: true, Summary: 'Tier 0', UserFacing: true },
          },
        },
      });
      assert.equal(fastPathPlanAllow.decision, 'allow', 'Tier 0 XS_EXPRESS deve liberar RequestFeedback: true sem GF-01');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Cenário 7: diagnoseParallelIssueBlocker detecta arquivo de outra Issue paralela em schemas Node e Python sem auto-colisão (GF-09, GF-10)', () => {
    const tmpDir = createTempWorkspace();
    const plansPath = path.join(tmpDir, '.git', 'active-plans.json');
    try {
      // 1. Apenas 1 issue ativa e currentIssueId vazio -> NÃO deve acusar falso positivo (GF-10)
      fs.writeFileSync(
        plansPath,
        JSON.stringify({ plans: { '29': { issue: '29', files: ['src/my-file.ts'] } } }),
        'utf8'
      );
      const singleNoId = diagnoseParallelIssueBlocker(tmpDir, 'FAIL src/my-file.ts', '');
      assert.equal(singleNoId.blockedByParallelIssue, false);

      // 2. Duas issues no schema Node (plans) -> detecta bloqueio pela Issue #30
      fs.writeFileSync(
        plansPath,
        JSON.stringify({
          plans: {
            '29': { issue: '29', files: ['src/issue29.ts'] },
            '30': { issue: '30', files: ['tests/audio/test_production_acoustic_auditor.py'] },
          },
        }),
        'utf8'
      );
      const nodeCol = diagnoseParallelIssueBlocker(
        tmpDir,
        'AssertionError in tests/audio/test_production_acoustic_auditor.py:42',
        '29'
      );
      assert.equal(nodeCol.blockedByParallelIssue, true);
      assert.deepEqual(nodeCol.conflictingIssues, ['30']);
      assert.match(nodeCol.banner, /BLOQUEIO POR ISSUE PARALELA EM ANDAMENTO/);

      // 3. Schema Python top-level (awencanto GF-09) -> detecta bloqueio pela Issue #31
      fs.writeFileSync(
        plansPath,
        JSON.stringify({
          slices: {},
          '29': { issue: '29', files: ['AGENTS.md'] },
          '31': { issue: '31', files: ['app/services/localized_acoustic_auditor.py'] },
        }),
        'utf8'
      );
      const pyCol = diagnoseParallelIssueBlocker(
        tmpDir,
        '[R14] app\\services\\localized_acoustic_auditor.py:129',
        '29'
      );
      assert.equal(pyCol.blockedByParallelIssue, true);
      assert.deepEqual(pyCol.conflictingIssues, ['31']);
      assert.deepEqual(pyCol.matchedFiles, ['app/services/localized_acoustic_auditor.py']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Cenário 8: computeIssueFinOpsMarkdown gera Tabela 1 por Fase e Tabela 2 filtrando apenas modelos utilizados (calls > 0, sem Tabela 3 — GF-13, GF-14)', () => {
    const sampleSteps = [
      {
        type: 'PLANNER_RESPONSE',
        phase: 'DEFINE & PLAN',
        model: 'gemini-4-argon-low',
        input_tokens: 10000,
        cache_read_tokens: 200000,
        output_tokens: 2000,
      },
      {
        type: 'PLANNER_RESPONSE',
        phase: 'BUILD',
        model: 'gemini-4-hydrogen',
        input_tokens: 20000,
        cache_read_tokens: 400000,
        output_tokens: 5000,
      },
      {
        type: 'PLANNER_RESPONSE',
        phase: 'REVIEW',
        model: 'gemini-4-argon-low',
        input_tokens: 5000,
        cache_read_tokens: 100000,
        output_tokens: 1000,
      },
    ];

    const markdown = computeIssueFinOpsMarkdown(sampleSteps);
    assert.match(markdown, /## 💰 Telemetria FinOps da Entrega/);
    assert.match(markdown, /DEFINE & PLAN/);
    assert.match(markdown, /BUILD/);
    assert.match(markdown, /REVIEW/);
    assert.match(markdown, /TOTAL DESTA ISSUE/);
    assert.match(markdown, /gemini-4-hydrogen/);
    assert.match(markdown, /gemini-4-argon-low/);
    assert.doesNotMatch(
      markdown,
      /gemini-4-carbon/,
      'Modelos com 0 chamadas (gemini-4-carbon) NÃO devem aparecer na Tabela 2 (GF-14)'
    );
    assert.doesNotMatch(markdown, /Últimas 5 Horas/i, 'Não deve existir Tabela 3 de janela renovável');
  });
});
