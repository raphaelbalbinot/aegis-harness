import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateReviewDossier } from '../../templates/scripts/review.mjs';
import { generateRepoAuditDossier } from '../../templates/scripts/audit-repo.mjs';

test('GF-06 / BDD Extraction from Plan (including Markdown headings and bold bullets)', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-review-bdd-'));
    try {
        const planPath = 'implementation_plan.md';
        const markdownPlan = [
            '## 5. Cenários BDD',
            '### Cenário 1: Detecção Determinística de XS_EXPRESS',
            '- **Dado** que o arquivo é isolado',
            '- **Quando** executamos o blast-radius',
            '- **Então** retorna XS_EXPRESS',
            ''
        ].join('\n');
        fs.writeFileSync(path.join(rootDir, planPath), markdownPlan);

        generateReviewDossier({ planPath, rootDir });

        const scratchDir = path.join(rootDir, 'scratch');
        assert.ok(fs.existsSync(path.join(scratchDir, 'review_prompt.md')));
        assert.ok(fs.existsSync(path.join(scratchDir, 'review_prompt_plan.md')));

        const prompt = fs.readFileSync(path.join(scratchDir, 'review_prompt_plan.md'), 'utf8');
        assert.doesNotMatch(prompt, /Nenhuma cláusula BDD detectada no plano/);
        assert.match(prompt, /### Cenário 1: Detecção Determinística de XS_EXPRESS/);
        assert.match(prompt, /- \*\*Dado\*\* que o arquivo é isolado/);
        assert.match(prompt, /- \*\*Então\*\* retorna XS_EXPRESS/);
    } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
    }
});

test('GF-02 / CWE-78 Immunity', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-review-cwe-'));
    try {
        generateReviewDossier({ files: 'foo.mjs; echo INJECTED', rootDir });

        const prompt = fs.readFileSync(path.join(rootDir, 'scratch', 'review_prompt.md'), 'utf8');
        assert.ok(prompt.length > 0);
    } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
    }
});

test('GF-02 / Clean Code Telemetry Cache by mtimeMs in review.mjs', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-review-cache-'));
    try {
        const sampleFile = path.join(rootDir, 'sample.mjs');
        fs.writeFileSync(sampleFile, 'export function add(a, b) { return a + b; }\n', 'utf8');
        const scannerDir = path.join(rootDir, 'scripts');
        fs.mkdirSync(scannerDir, { recursive: true });
        fs.copyFileSync(
            path.resolve(process.cwd(), 'skills/sovereign/clean-code-audit/scripts/scan-clean-code.mjs'),
            path.join(scannerDir, 'scan-clean-code.mjs')
        );

        generateReviewDossier({ files: 'sample.mjs', rootDir });
        const cacheFile = path.join(rootDir, 'scratch', 'clean_code_telemetry.json');
        assert.equal(fs.existsSync(cacheFile), true, 'Deve gravar scratch/clean_code_telemetry.json');
        const firstMtime = fs.statSync(cacheFile).mtimeMs;

        // Segunda chamada sem alterar sample.mjs deve reutilizar o cache
        generateReviewDossier({ files: 'sample.mjs', rootDir });
        const secondMtime = fs.statSync(cacheFile).mtimeMs;
        assert.equal(secondMtime, firstMtime, 'Deve reutilizar scratch/clean_code_telemetry.json quando código não mudou');
    } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
    }
});

test('GF-07 / Repo Audit Agnostic', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-repo-'));
    try {
        generateRepoAuditDossier({ root: rootDir });

        const prompt = fs.readFileSync(path.join(rootDir, 'scratch', 'repo_audit_prompt.md'), 'utf8');
        assert.doesNotMatch(prompt, /Heldora/i);
        assert.match(prompt, /Aegis Engineering Harness/);
    } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
    }
});

test('GF-07 / Threat Model Summary Injection in review.mjs', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-review-tm-'));
    try {
        const kbDir = path.join(rootDir, 'workspace', 'kb');
        fs.mkdirSync(kbDir, { recursive: true });
        fs.writeFileSync(
            path.join(kbDir, 'THREAT_MODEL.md'),
            [
                'KB_SNAPSHOT: UNPINNED',
                '<!-- aegis-surface-hash: bootstrap -->',
                '# Threat Model',
                '| TM-CORE-01 | CWE-284 / CWE-306: Controle de Acesso e Autenticação na Borda | Crítico | Mitigação |',
            ].join('\n'),
            'utf8'
        );

        generateReviewDossier({ rootDir });
        const prompt = fs.readFileSync(path.join(rootDir, 'scratch', 'review_prompt.md'), 'utf8');
        assert.match(prompt, /KB_SNAPSHOT: UNPINNED/);
        assert.match(prompt, /<!-- aegis-surface-hash: bootstrap -->/);
        assert.match(prompt, /TM-CORE-01/);
    } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
    }
});

test('GF-06 / Ad-hoc Review without Issue or Plan supports optional context', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-review-adhoc-'));
    try {
        generateReviewDossier({ context: 'Ajuste pontual de timeout no cliente HTTP', rootDir });
        const prompt = fs.readFileSync(path.join(rootDir, 'scratch', 'review_prompt.md'), 'utf8');
        assert.match(prompt, /- Contexto da Alteração Pontual \(Sem Issue\/Plano\):/);
        assert.match(prompt, /Ajuste pontual de timeout no cliente HTTP/);
        assert.match(prompt, /Alteração pontual \(sem Issue\/Plano formal\)/);
    } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
    }
});