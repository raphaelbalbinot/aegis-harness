#!/usr/bin/env node
// @ts-check
/**
 * scripts/audit-verify.mjs (Aegis Harness Polyglot Gate Runner — GF-11)
 *
 * Executa os portões determinísticos definidos em `harness.config.json` na raiz do projeto,
 * diagnostica bloqueios por Issues paralelas via `.git/active-plans.json` sem ignorar testes,
 * valida o orçamento de 22 KB das Rules e grava `auditVerifyPassedAt`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  checkRuleFilesBudget,
  diagnoseParallelIssueBlocker,
  recordGateStamp,
} from './aegis-hook-guard.mjs';

/** @param {string} msg */
function writeOut(msg) {
  process.stdout.write(`${msg}\n`);
}

/** @param {string} msg */
function writeErr(msg) {
  process.stderr.write(`${msg}\n`);
}

const configPath = path.resolve(process.cwd(), 'harness.config.json');

if (!fs.existsSync(configPath)) {
  writeErr('❌ [audit-verify] Arquivo harness.config.json não encontrado na raiz do projeto.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const gates = Array.isArray(config.gates) ? config.gates : [];
const issueArgIdx = process.argv.indexOf('--issue');
const currentIssueId = issueArgIdx >= 0 ? String(process.argv[issueArgIdx + 1] ?? '') : '';

writeOut(`\n🛡️  [Aegis Harness] Iniciando Esteira Determinística (${config.language.toUpperCase()} — ${gates.length} Portões)...\n`);

for (let i = 0; i < gates.length; i++) {
  const gate = gates[i];
  const stepNum = String(i + 1).padStart(2, '0');
  if (!gate.command) continue;

  writeOut(`▶ [Portão ${stepNum}/${String(gates.length).padStart(2, '0')}] ${gate.name}: ${gate.command}`);
  try {
    const out = execSync(gate.command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    if (out) process.stdout.write(out);
    writeOut(`✅ [Portão ${stepNum}] APROVADO\n`);
  } catch (err) {
    const errObj = /** @type {{ stdout?: string; stderr?: string; message?: string }} */ (err);
    const combinedErr = `${errObj.stdout ?? ''}\n${errObj.stderr ?? ''}\n${errObj.message ?? ''}`;
    writeErr(combinedErr);
    const parallelDiag = diagnoseParallelIssueBlocker(process.cwd(), combinedErr, currentIssueId);
    if (parallelDiag.blockedByParallelIssue) {
      writeErr(`\n${parallelDiag.banner}`);
    }
    writeErr(`\n❌ [Portão ${stepNum}] REPROVADO em "${gate.name}". Corrija o desvio antes de prosseguir.`);
    process.exit(1);
  }
}

const budgetResult = checkRuleFilesBudget(process.cwd());
if (!budgetResult.ok) {
  writeErr(`❌ [audit-verify] Arquivo(s) de regra acima do limite de 22 KB: ${JSON.stringify(budgetResult.violations)}`);
  process.exit(1);
}
recordGateStamp(process.cwd(), 'auditVerifyPassedAt');

writeOut('🟢 [Aegis Harness] Todos os portões determinísticos passaram com sucesso (exit code 0)!\n');
