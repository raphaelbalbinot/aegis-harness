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
  evaluatePreToolUseHook,
  recordGateStamp,
} from '../../templates/scripts/aegis-hook-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function createTempWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-hook-guard-'));
  fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
  return tmpDir;
}

describe('aegis-hook-guard.mjs — Guardrail Determinístico Nativo (GF-01, GF-02, GF-03, GF-04)', () => {
  it('Cenário 1: valida orçamento estrito (< 22.000 bytes) de templates/AGENTS.template.md e README Multi-Agente com AWS Kiro', () => {
    const tplPath = path.join(REPO_ROOT, 'templates', 'AGENTS.template.md');
    const tplBytes = fs.statSync(tplPath).size;
    assert.ok(
      tplBytes <= MAX_RULE_FILE_BYTES,
      `templates/AGENTS.template.md (${tplBytes} B) deve ter <= ${MAX_RULE_FILE_BYTES} B`
    );
    const tplText = fs.readFileSync(tplPath, 'utf8');
    assert.match(tplText, /## 🧭 0\. Índice de Regras Modulares por Domínio/);
    assert.match(tplText, /AWS Kiro/i);
    assert.match(tplText, /RequestFeedback:\s*false/);
    assert.doesNotMatch(tplText, /Cloud Run/i);
    assert.doesNotMatch(tplText, /Firestore/i);

    const readmeText = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
    assert.match(readmeText, /AWS Kiro/i, 'README.md deve documentar uso no AWS Kiro');
    assert.match(readmeText, /Amazon Q/i, 'README.md deve documentar uso no Amazon Q Developer');
    assert.match(readmeText, /aegis-hook-guard\.mjs/, 'README.md deve documentar o fiscal aegis-hook-guard.mjs');
  });

  it('Cenário 1b: checkRuleFilesBudget reprova arquivo AGENTS.md ou .agents/rules/*.md > 22.000 bytes', () => {
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
});
