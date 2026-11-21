import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INIT_SCRIPT = path.join(REPO_ROOT, 'bin', 'init-harness.mjs');

describe('Aegis Harness v2.0 — Multi-Agent & Multi-OS Bootstrapper (Fatia 4)', () => {
  it('Cenário 4: deve instalar AGENTS.md, CLAUDE.md, .claude/agents/* e scripts Multi-OS sem lock-in cloud', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-init-test-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'sample-polyglot-app', version: '1.0.0' }, null, 2),
        'utf-8'
      );

      execFileSync(process.execPath, [INIT_SCRIPT, '--target', tmpDir, '--offline'], {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      // 1. Verifica arquivos fundamentais de governança Multi-Agente
      const agentsPath = path.join(tmpDir, 'AGENTS.md');
      const claudePath = path.join(tmpDir, 'CLAUDE.md');
      const goldfishAgentPath = path.join(tmpDir, '.claude', 'agents', 'goldfish-auditor.md');
      const sliceExecutorPath = path.join(tmpDir, '.claude', 'agents', 'slice-executor.md');

      assert.equal(fs.existsSync(agentsPath), true, 'AGENTS.md deve ser criado');
      assert.equal(fs.existsSync(claudePath), true, 'CLAUDE.md deve ser criado');
      assert.equal(fs.existsSync(goldfishAgentPath), true, '.claude/agents/goldfish-auditor.md deve ser criado');
      assert.equal(fs.existsSync(sliceExecutorPath), true, '.claude/agents/slice-executor.md deve ser criado');

      // 2. Verifica presença dos scripts Multi-OS em scripts/ e .agents/hooks.json (GF-08)
      const expectedScripts = [
        'aegis-finops-telemetry.mjs',
        'aegis-hook-guard.mjs',
        'review.mjs',
        'audit-repo.mjs',
        'blast-radius.mjs',
        'plan-collision.mjs',
        'scan-clean-code.mjs'
      ];
      for (const scriptName of expectedScripts) {
        const scriptFull = path.join(tmpDir, 'scripts', scriptName);
        assert.equal(
          fs.existsSync(scriptFull),
          true,
          `Script Multi-OS scripts/${scriptName} deve estar presente no projeto alvo`
        );
      }
      const hooksJsonPath = path.join(tmpDir, '.agents', 'hooks.json');
      assert.equal(fs.existsSync(hooksJsonPath), true, '.agents/hooks.json deve ser criado pelo init-harness.mjs');
      const hooksCfg = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8'));
      assert.match(
        JSON.stringify(hooksCfg),
        /\.\.\/scripts\/aegis-hook-guard\.mjs/,
        'hooks.json deve invocar ../scripts/aegis-hook-guard.mjs (GF-01)'
      );

      // 3. Verifica conteúdo de CLAUDE.md e subagentes .claude/agents/
      const claudeContent = fs.readFileSync(claudePath, 'utf-8');
      assert.match(claudeContent, /@AGENTS\.md/, 'CLAUDE.md deve importar @AGENTS.md');
      assert.match(claudeContent, /goldfish-auditor/, 'CLAUDE.md deve mapear goldfish-auditor');
      assert.match(claudeContent, /slice-executor/, 'CLAUDE.md deve mapear slice-executor');
      assert.match(claudeContent, /codex exec/, 'CLAUDE.md deve mapear OpenAI Codex CLI');

      const goldfishContent = fs.readFileSync(goldfishAgentPath, 'utf-8');
      assert.match(goldfishContent, /name:\s*goldfish-auditor/);
      assert.match(goldfishContent, /tools:\s*Read,\s*Grep,\s*Glob,\s*Bash/);
      assert.doesNotMatch(goldfishContent, /Write|Edit/, 'goldfish-auditor deve ser estritamente somente-leitura');

      const sliceExecContent = fs.readFileSync(sliceExecutorPath, 'utf-8');
      assert.match(sliceExecContent, /name:\s*slice-executor/);
      assert.match(sliceExecContent, /tools:\s*Read,\s*Write,\s*Edit,\s*Grep,\s*Glob,\s*Bash/);
      assert.match(sliceExecContent, /PROIBIDO ler.*AGENTS\.md/i);
      assert.match(sliceExecContent, /PROIBIDO rodar.*blast-radius/i);

      const dagSkillPath = path.join(tmpDir, '.agents', 'skills', 'dag-slice-orchestrator', 'SKILL.md');
      const dagSkillContent = fs.readFileSync(dagSkillPath, 'utf-8');
      assert.match(dagSkillContent, /EnableMCPTools:\s*false/, 'dag-slice-orchestrator deve definir EnableMCPTools: false (GF-05)');
      assert.match(dagSkillContent, /Single-Execution Gate/i, 'dag-slice-orchestrator deve conter o protocolo Single-Execution Gate');

      // 4. Verifica AGENTS.md: ceremonyTier (XS_EXPRESS / FULL_EGM_DAG) e ausência de lock-in (Heldora / Firestore / Cloud Run)
      const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
      assert.match(agentsContent, /ceremonyTier/);
      assert.match(agentsContent, /XS_EXPRESS/);
      assert.match(agentsContent, /FULL_EGM_DAG/);
      assert.match(agentsContent, /scripts\/review\.mjs/);
      assert.match(agentsContent, /snapshot-slice/);
      assert.match(agentsContent, /verify-slice/);
      assert.doesNotMatch(agentsContent, /Heldora/i, 'AGENTS.md não deve conter referência residual a Heldora');
      assert.doesNotMatch(agentsContent, /Firestore/i, 'AGENTS.md não deve conter lock-in a Firestore');
      assert.doesNotMatch(agentsContent, /Cloud Run/i, 'AGENTS.md não deve conter lock-in a Cloud Run');
      assert.match(
        agentsContent,
        /\[Mantis-Advise\]: ✔ THREAT_MODEL\.md Consultado \(<TM-ID: CWE-XX>\) \| ✔ Padrões Defensivos Aplicados/,
        'AGENTS.md deve exigir citação nominal de TM-ID no selo [Mantis-Advise]'
      );
      assert.match(agentsContent, /aegis-surface-hash/, 'AGENTS.md deve exigir sincronização do aegis-surface-hash');

      // 5. Verifica criação do modelo de ameaças vivo workspace/kb/THREAT_MODEL.md
      const threatModelPath = path.join(tmpDir, 'workspace', 'kb', 'THREAT_MODEL.md');
      assert.equal(fs.existsSync(threatModelPath), true, 'workspace/kb/THREAT_MODEL.md deve ser criado pelo init-harness.mjs');
      const threatModelContent = fs.readFileSync(threatModelPath, 'utf-8');
      assert.match(threatModelContent, /^KB_SNAPSHOT:\s*UNPINNED/m);
      assert.match(threatModelContent, /<!-- aegis-surface-hash: bootstrap -->/);
      assert.match(threatModelContent, /TM-CORE-01/);
      assert.match(threatModelContent, /TM-CORE-05/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Cenário 5: quando executado com --agent antigravity ou em projeto com pasta .gemini/.agents, NÃO deve criar CLAUDE.md nem .claude/agents/*', () => {
    const tmpDirFlag = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-init-antigravity-flag-'));
    const tmpDirAuto = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-init-antigravity-auto-'));
    try {
      fs.writeFileSync(
        path.join(tmpDirFlag, 'package.json'),
        JSON.stringify({ name: 'antigravity-flag-app', version: '1.0.0' }, null, 2),
        'utf-8'
      );

      execFileSync(
        process.execPath,
        [INIT_SCRIPT, '--target', tmpDirFlag, '--agent', 'antigravity', '--offline'],
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      assert.equal(fs.existsSync(path.join(tmpDirFlag, 'AGENTS.md')), true, 'AGENTS.md deve ser criado');
      assert.equal(
        fs.existsSync(path.join(tmpDirFlag, '.agents', 'skills', 'dag-slice-orchestrator', 'SKILL.md')),
        true,
        'Skill dag-slice-orchestrator deve ser instalada'
      );
      const harnessCfgFlag = JSON.parse(fs.readFileSync(path.join(tmpDirFlag, 'harness.config.json'), 'utf-8'));
      assert.equal(harnessCfgFlag.agentHost, 'antigravity');
      assert.equal(fs.existsSync(path.join(tmpDirFlag, 'CLAUDE.md')), false, 'CLAUDE.md NÃO deve ser criado');
      assert.equal(fs.existsSync(path.join(tmpDirFlag, '.claude')), false, '.claude/ NÃO deve ser criado');

      // Auto-detecção por presença de pasta .gemini no projeto alvo
      fs.mkdirSync(path.join(tmpDirAuto, '.gemini'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDirAuto, 'package.json'),
        JSON.stringify({ name: 'antigravity-auto-app', version: '1.0.0' }, null, 2),
        'utf-8'
      );

      execFileSync(process.execPath, [INIT_SCRIPT, '--target', tmpDirAuto, '--offline'], {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const harnessCfgAuto = JSON.parse(fs.readFileSync(path.join(tmpDirAuto, 'harness.config.json'), 'utf-8'));
      assert.equal(harnessCfgAuto.agentHost, 'antigravity');
      assert.equal(fs.existsSync(path.join(tmpDirAuto, 'CLAUDE.md')), false, 'CLAUDE.md NÃO deve ser criado em auto-detect antigravity');
      assert.equal(fs.existsSync(path.join(tmpDirAuto, '.claude')), false, '.claude/ NÃO deve ser criado em auto-detect antigravity');
    } finally {
      fs.rmSync(tmpDirFlag, { recursive: true, force: true });
      fs.rmSync(tmpDirAuto, { recursive: true, force: true });
    }
  });
});
