#!/usr/bin/env node
/**
 * scripts/audit-verify.mjs (Aegis Harness Polyglot Gate Runner)
 *
 * Executa os portões determinísticos definidos em `harness.config.json` na raiz do projeto.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const configPath = path.resolve(process.cwd(), 'harness.config.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ [audit-verify] Arquivo harness.config.json não encontrado na raiz do projeto.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const gates = Array.isArray(config.gates) ? config.gates : [];

console.log(`\n🛡️  [Aegis Harness] Iniciando Esteira Determinística (${config.language.toUpperCase()} — ${gates.length} Portões)...\n`);

for (let i = 0; i < gates.length; i++) {
  const gate = gates[i];
  const stepNum = String(i + 1).padStart(2, '0');
  if (!gate.command) continue;

  console.log(`▶ [Portão ${stepNum}/${String(gates.length).padStart(2, '0')}] ${gate.name}: ${gate.command}`);
  try {
    execSync(gate.command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ [Portão ${stepNum}] APROVADO\n`);
  } catch {
    console.error(`\n❌ [Portão ${stepNum}] REPROVADO em "${gate.name}". Corrija o desvio antes de prosseguir.`);
    process.exit(1);
  }
}

console.log('🟢 [Aegis Harness] Todos os portões determinísticos passaram com sucesso (exit code 0)!\n');
