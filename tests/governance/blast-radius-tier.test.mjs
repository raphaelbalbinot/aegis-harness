// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  buildGraph,
  calculateBlastRadius,
  calculateMultiTargetBlastRadius,
  computeCeremonyTier,
  resolveDefaultRootDir,
} from '../../templates/scripts/blast-radius.mjs';

/**
 * Cria um repositório temporário isolado com a árvore de arquivos fornecida.
 * @param {Record<string, string>} files
 */
function createTempRepo(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-blast-tier-'));
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }
  return tmpDir;
}

describe('blast-radius.mjs — Motor Políglota Universal & Fast-Track XS_EXPRESS (GF-03, GF-04, GF-05)', () => {
  it('1. classifica 1 arquivo de produção isolado (0 consumidores, LOW, fora do Eixo B) como XS_EXPRESS', () => {
    const tmpDir = createTempRepo({
      'src/utils/math-helper.ts': 'export function sum(a: number, b: number) { return a + b; }\n',
    });
    const fileMap = buildGraph(tmpDir);
    const singleReport = calculateBlastRadius('src/utils/math-helper.ts', fileMap);

    assert.equal(singleReport.error, undefined);
    assert.equal(singleReport.isTest, false);
    assert.equal(singleReport.riskLevel, 'LOW');
    assert.equal(singleReport.securitySurfaceTouched, false);
    assert.deepEqual(singleReport.relatedDocs, []);
    assert.equal(singleReport.ceremonyTier, 'XS_EXPRESS');
    assert.equal(singleReport.goldfishRequired, true, 'Goldfish deve ser sempre obrigatório (GF-07)');

    const multiReport = calculateMultiTargetBlastRadius(['src/utils/math-helper.ts'], fileMap);
    assert.equal(multiReport.securitySurfaceTouched, false);
    assert.deepEqual(multiReport.relatedDocs, []);
    assert.equal(multiReport.ceremonyTier, 'XS_EXPRESS');
    assert.equal(multiReport.goldfishRequired, true, 'Goldfish deve ser sempre obrigatório no multiReport (GF-07)');
  });

  it('1b. não gera falso positivo de superfície de segurança para src/utils/author-profile.ts (GF-02)', () => {
    const tmpDir = createTempRepo({
      'src/utils/author-profile.ts': 'export function getAuthorBio(name: string) { return name; }\n',
    });
    const fileMap = buildGraph(tmpDir);
    const singleReport = calculateBlastRadius('src/utils/author-profile.ts', fileMap);

    assert.equal(singleReport.securitySurfaceTouched, false);
    assert.deepEqual(singleReport.relatedDocs, []);
    assert.equal(singleReport.ceremonyTier, 'XS_EXPRESS');
  });

  it('2. classifica 1 arquivo de produção isolado + 1 arquivo de teste TDD (.test.mjs) como XS_EXPRESS (GF-03 TDD-safe)', () => {
    const tmpDir = createTempRepo({
      'lib/formatter.mjs': 'export function formatName(name) { return name.trim(); }\n',
      'tests/formatter.test.mjs':
        "import { formatName } from '../lib/formatter.mjs';\nconsole.log(formatName(' Aegis '));\n",
    });
    const fileMap = buildGraph(tmpDir);
    const multiReport = calculateMultiTargetBlastRadius(
      ['lib/formatter.mjs', 'tests/formatter.test.mjs'],
      fileMap
    );

    assert.equal(multiReport.targets.length, 2);
    assert.equal(multiReport.targets[0].isTest, false);
    assert.equal(multiReport.targets[1].isTest, true);
    assert.equal(multiReport.targets[0].metrics.directConsumersCount, 0);
    assert.equal(multiReport.targets[0].metrics.impactedTestsCount, 1);
    assert.equal(multiReport.ceremonyTier, 'XS_EXPRESS');
  });

  it('3. classifica 2 arquivos de produção como FULL_EGM_DAG', () => {
    const tmpDir = createTempRepo({
      'src/a.ts': 'export const A = 1;\n',
      'src/b.ts': 'export const B = 2;\n',
    });
    const fileMap = buildGraph(tmpDir);
    const multiReport = calculateMultiTargetBlastRadius(['src/a.ts', 'src/b.ts'], fileMap);

    assert.equal(multiReport.ceremonyTier, 'FULL_EGM_DAG');
  });

  it('4. classifica 1 arquivo com consumidores reversos (totalConsumers > 0) como FULL_EGM_DAG', () => {
    const tmpDir = createTempRepo({
      'src/shared/date.ts': 'export function nowIso() { return new Date().toISOString(); }\n',
      'src/services/report.ts': "import { nowIso } from '../shared/date';\nexport function run() { return nowIso(); }\n",
    });
    const fileMap = buildGraph(tmpDir);
    const singleReport = calculateBlastRadius('src/shared/date.ts', fileMap);

    assert.equal(singleReport.metrics.directConsumersCount, 1);
    assert.equal(singleReport.ceremonyTier, 'FULL_EGM_DAG');

    const multiReport = calculateMultiTargetBlastRadius(['src/shared/date.ts'], fileMap);
    assert.equal(multiReport.ceremonyTier, 'FULL_EGM_DAG');
  });

  it('5. classifica arquivos de superfície de segurança (src/auth/token-validator.ts e src/api/orders/route.ts) com securitySurfaceTouched=true, relatedDocs=[THREAT_MODEL.md] e FULL_EGM_DAG (GF-03)', () => {
    const tmpDir = createTempRepo({
      'src/auth/token-validator.ts': 'export function verifyToken(token: string) { return Boolean(token); }\n',
      'src/api/orders/route.ts': 'export async function POST() { return { ok: true }; }\n',
    });
    const fileMap = buildGraph(tmpDir);
    const singleReport = calculateBlastRadius('src/auth/token-validator.ts', fileMap);

    assert.equal(singleReport.governanceAxis, 'B_SECURITY_HARDENING');
    assert.equal(singleReport.metrics.directConsumersCount, 0);
    assert.equal(singleReport.securitySurfaceTouched, true);
    assert.deepEqual(singleReport.relatedDocs, ['workspace/kb/THREAT_MODEL.md']);
    assert.equal(singleReport.ceremonyTier, 'FULL_EGM_DAG');

    const apiRouteReport = calculateBlastRadius('src/api/orders/route.ts', fileMap);
    assert.equal(apiRouteReport.securitySurfaceTouched, true);
    assert.deepEqual(apiRouteReport.relatedDocs, ['workspace/kb/THREAT_MODEL.md']);
    assert.equal(apiRouteReport.ceremonyTier, 'FULL_EGM_DAG');

    const multiReport = calculateMultiTargetBlastRadius(['src/auth/token-validator.ts'], fileMap);
    assert.equal(multiReport.securitySurfaceTouched, true);
    assert.deepEqual(multiReport.relatedDocs, ['workspace/kb/THREAT_MODEL.md']);
    assert.equal(multiReport.ceremonyTier, 'FULL_EGM_DAG');
  });

  it('6. descobre universalmente arquivos em pastas arbitrárias (bin/, lib/, src/, templates/) ignorando IGNORED_DIRS (GF-04)', () => {
    const tmpDir = createTempRepo({
      'bin/cli.mjs': "import { runLib } from '../lib/core.mjs';\nrunLib();\n",
      'lib/core.mjs': "import { helper } from '../src/helper.mjs';\nexport function runLib() { return helper(); }\n",
      'src/helper.mjs': 'export function helper() { return 42; }\n',
      'templates/sample.mjs': 'export const TEMPLATE_VER = 1;\n',
      'node_modules/pkg/index.js': 'export const IGNORED = true;\n',
      '.claude/agents/ignored.md': '# Ignored\n',
    });
    const fileMap = buildGraph(tmpDir);

    assert.ok(fileMap.has('bin/cli.mjs'));
    assert.ok(fileMap.has('lib/core.mjs'));
    assert.ok(fileMap.has('src/helper.mjs'));
    assert.ok(fileMap.has('templates/sample.mjs'));
    assert.ok(!fileMap.has('node_modules/pkg/index.js'));
    assert.ok(!fileMap.has('.claude/agents/ignored.md'));

    const helperReport = calculateBlastRadius('src/helper.mjs', fileMap);
    assert.deepEqual(helperReport.directConsumers, ['lib/core.mjs']);
    assert.deepEqual(helperReport.transitiveConsumers, ['bin/cli.mjs']);
    assert.equal(helperReport.ceremonyTier, 'FULL_EGM_DAG');

    assert.equal(computeCeremonyTier([], { stopAndWarnTriggered: false }), 'FULL_EGM_DAG');
  });

  it('7. resolveDefaultRootDir() resolve a raiz do repositório mesmo quando o script reside em templates/scripts/ (GF-04)', () => {
    const resolvedRoot = resolveDefaultRootDir();
    assert.equal(path.basename(resolvedRoot), 'aegis-harness');
    const report = calculateBlastRadius('bin/init-harness.mjs');
    assert.equal(report.error, undefined, 'Deve encontrar bin/init-harness.mjs no grafo padrão sem erro');
  });
});
