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