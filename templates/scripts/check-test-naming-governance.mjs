#!/usr/bin/env node
/**
 * scripts/check-test-naming-governance.mjs (Aegis Harness Polyglot Test Governance)
 *
 * Bloqueia arquivos de teste nomeados com números de issue/PR/task e garante organização por domínio.
 */

import fs from 'node:fs';
import path from 'node:path';

const BANNED_NAME_REGEX = /(issue[-_]?\d+|pr[-_]?\d+|task[-_]?\d+|fatia[-_]?\d+|stage[-_][a-z]|cluster[-_]|clean[-_]code|guard[-_]clauses)/i;
const TEST_FILE_REGEX = /(\.test\.|\.spec\.|_test\.|^test_).+\.(ts|tsx|js|jsx|py|go|rs|java|cs)$/i;

function walk(dir, collected = []) {
  if (!fs.existsSync(dir)) return collected;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.next', 'target', 'venv', '.venv'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, collected);
    } else if (TEST_FILE_REGEX.test(entry.name)) {
      collected.push(full);
    }
  }
  return collected;
}

const files = walk(process.cwd());
const violations = [];

for (const file of files) {
  const base = path.basename(file);
  if (BANNED_NAME_REGEX.test(base)) {
    violations.push(`Arquivo com nome efêmero banido (Regra 1.14): ${path.relative(process.cwd(), file)}`);
  }
}

if (violations.length > 0) {
  console.error('❌ [Test Naming Governance] Violações encontradas:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`✅ [Test Naming Governance] ${files.length} arquivo(s) de teste verificados com 0 violações semânticas.`);
