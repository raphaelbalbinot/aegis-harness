// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const EXPECTED_SLIDE_COUNT = 27;
const EXPECTED_SVG_COUNT = 12;

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

describe('Keynote Interativo (27 Slides / 12 SVGs) & Documento Executivo (Iteração 7)', () => {
  it('Cenário 1: Slide 01 apresenta a definição executiva de Model vs. Engineering Harness, citação de Addy Osmani & Anthropic e matriz comparativa', () => {
    const html = readRepoFile('docs/keynote/index.html');
    const slide01Match = html.match(/<section[^>]*id="slide-01"[^>]*>([\s\S]*?)<\/section>/);
    assert.ok(slide01Match, 'Seção #slide-01 deve existir em docs/keynote/index.html');

    const slide01Body = slide01Match[1];
    assert.match(slide01Body, /Model\s+vs\.\s+Engineering\s+Harness/i);
    assert.match(slide01Body, /Addy Osmani/i);
    assert.match(slide01Body, /Anthropic/i);
    assert.match(slide01Body, /Prompt\s*\/\s*Rules\s*Pack/i);
    assert.match(slide01Body, /Agent\s+Framework/i);
    assert.match(slide01Body, /<svg\s+class="svg-canvas"/);
  });

  it('Cenário 2: valida integridade estrutural de 27 botões tab-01..27, 27 seções slide-01..27, 12 SVGs e calibração CSS 1080p/125% DPI (GF-03, GF-05)', () => {
    const html = readRepoFile('docs/keynote/index.html');
    const css = readRepoFile('docs/keynote/style.css');

    const tabMatches = html.match(/class="strip-btn"\s+role="tab"/g) ?? [];
    const slideMatches = html.match(/<section\s+class="slide"\s+role="tabpanel"/g) ?? [];
    const svgMatches = html.match(/<svg\s+class="svg-canvas"/g) ?? [];

    assert.equal(tabMatches.length, EXPECTED_SLIDE_COUNT, 'Deve conter exatamente 27 botões .strip-btn');
    assert.equal(slideMatches.length, EXPECTED_SLIDE_COUNT, 'Deve conter exatamente 27 seções .slide');
    assert.equal(svgMatches.length, EXPECTED_SVG_COUNT, 'Deve conter exatamente 12 diagramas <svg class="svg-canvas">');

    for (let idx = 1; idx <= EXPECTED_SLIDE_COUNT; idx++) {
      const num = String(idx).padStart(2, '0');
      assert.match(html, new RegExp(`id="tab-${num}"`), `Botão tab-${num} deve existir`);
      assert.match(html, new RegExp(`aria-controls="slide-${num}"`), `aria-controls="slide-${num}" deve existir`);
      assert.match(html, new RegExp(`id="slide-${num}"\\s+aria-labelledby="tab-${num}"`), `Seção slide-${num} deve estar vinculada a tab-${num}`);
      assert.match(html, new RegExp(`Slide ${num} de 27`), `Badge "Slide ${num} de 27" deve existir`);
    }

    assert.match(html, /id="slideCounterBadge">01 \/ 27</);
    assert.match(html, /Slide 01 \/ 27/);
    assert.match(css, /scaleX\(0\.037\)/, 'style.css deve calibrar progress-bar__fill inicial para 1/27 (0.037)');
  });

  it('Cenário 3: reflete os 6 avanços recentes da v2 (Hub & Spoke <22KB, Semáforo + Hook Guard, Living Threat Model + Mantis Hub-Skill, review.mjs Multi-OS, Single-Execution Gate e 8+ Agentes com AWS Kiro) sem links legados (GF-01..GF-08)', () => {
    const html = readRepoFile('docs/keynote/index.html');
    const md = readRepoFile('docs/APRESENTACAO_HARNESS_ENGENHARIA.md');
    const skillRoot = readRepoFile('SKILL.md');

    // 1. Hub & Spoke (< 22 KB) e remoção da afirmação obsoleta "Zero .agents/rules/ soltas"
    assert.match(html, /Hub\s*&amp;\s*Spoke|Hub\s*&\s*Spoke/i);
    assert.match(html, /22\.000\s*bytes|22\s*KB/i);
    assert.doesNotMatch(html, /Zero\s+\.agents\/rules\/\s+soltas/i);
    assert.doesNotMatch(skillRoot, /sem\s+\.agents\/rules\/\s+fragmentadas/i);

    // 2. Protocolo Semáforo Goldfish + aegis-hook-guard.mjs + .git/aegis-gate-stamp.json (GF-01)
    assert.match(html, /RequestFeedback:\s*false/i);
    assert.match(html, /aegis-hook-guard\.mjs/);
    assert.match(html, /aegis-gate-stamp\.json/);
    assert.match(html, /planGoldfishRequired|codeGoldfishRequired/);

    // 3. Living Threat Model + aegis-surface-hash + Mantis Hub-Skill (GF-02)
    assert.match(html, /THREAT_MODEL\.md/);
    assert.match(html, /aegis-surface-hash/);
    assert.match(html, /mantis-meta-agent/);

    // 4. Motor Multi-OS review.mjs + audit-repo.mjs (GF-04)
    assert.match(html, /review\.mjs/);
    assert.match(html, /audit-repo\.mjs/);

    // 5. Single-Execution Gate + snapshot-slice / verify-slice
    assert.match(html, /Single-Execution Gate/i);
    assert.match(html, /snapshot-slice/);
    assert.match(html, /verify-slice/);

    // 6. Portabilidade Multi-Agente (AWS Kiro, Amazon Q, Claude Code, Codex, Cursor, Windsurf, Copilot) e limpeza de links legados (GF-06)
    assert.match(html, /AWS Kiro/i);
    assert.match(html, /Amazon Q/i);
    assert.match(md, /Model\s+vs\.\s+Engineering\s+Harness/i);
    assert.match(md, /Addy Osmani/i);
    assert.match(md, /AWS Kiro/i);
    assert.match(md, /aegis-hook-guard\.mjs/);
    assert.doesNotMatch(md, /mesa-editorial-heldora/i, 'APRESENTACAO_HARNESS_ENGENHARIA.md não deve conter links hardcoded para mesa-editorial-heldora');
  });
});
