# 🛡️ Aegis Harness (`aegis-harness`)

**Adversarial Engineering Governance & Intelligent Skills** — Um *Engineering Harness* determinístico, adversarial e políglota para transformar agentes de IA em engenheiros de software seniores auditáveis em qualquer linguagem (TypeScript/Node.js, Python, Go, Rust, Java, C#).

---

## 🏛️ A Arquitetura Constitucional: `AGENTS.md` Unificado + A Tríade `docs/`

O `aegis-harness` elimina a dispersão de arquivos soltos de regras (`.agents/rules/*`) e estrutura a governança de qualquer projeto sobre **4 Documentos Constitucionais Obrigatórios** que o agente deve ler antes de planejar ou escrever uma única linha de código:

1. **`AGENTS.md` (Constituição Operacional Unificada — 20 Leis + 7 Core Behaviors):**
   - Concentra em **um único arquivo na raiz** todas as regras de engenharia, travas serverless/Cloud Run (perfis de memória/concorrência, `SIGTERM`, anti-freeze, `/tmp`), segurança preventiva Shift-Left (`mantis-advise` + `THREAT_MODEL.md`), integridade física 1:1 de prompts (`fs.existsSync`), qualidade web moderna (`modern-web-guidance` + uso seletivo de `/hallmark`) e o protocolo adversarial **EGM (Elephant-Goldfish Model)** em Duplo Portão.
2. **`docs/PRD.md` (Constituição do Produto & Negócio):**
   - Define o propósito do sistema, personas, modelo de negócio, cotas/limites operacionais, jornadas E2E (`RF-01..N`), SLAs de latência e regras de privacidade/expiração de dados (LGPD/GDPR).
3. **`docs/ARCHITECTURE.md` (Constituição Técnica & Topologia Imutável):**
   - Define a stack oficial detectada, fronteiras de módulos, separação estrita de estado (Banco Estruturado vs. Object Storage vs. Estado Local), máquinas de estado, telemetria nos 3 níveis (`invoice_total`, `production`, `failed_and_retries`, `dev_and_test`) e diagramas vivos sincronizados com o código (`archify`).
4. **`docs/DIRETRIZES_DOMINIO.md` *(ou `DIRETRIZES_CRIATIVAS.md` / `DIRETRIZES_EDITORIAIS.md`)* (Constituição Especialista & Linguagem Ubíqua):**
   - Codifica as invariantes especialistas do negócio (seja engenharia editorial KDP, acústica Solfeggio/RVC, regras fiscais ou saúde), rubricas de qualidade de saída e o glossário oficial da **Linguagem Ubíqua (DDD — Regra 1.19)**.

> **Trava Anti-Drift (`Regra 1.4`):** Nenhuma alteração funcional, mudança de contrato ou evolução de regra de domínio pode ir para o código (`BUILD`) sem antes atualizar a Tríade Constitucional em `docs/` (com exceção estrita para correções puras de bugs). Se o projeto alvo ainda não possuir esses arquivos em `docs/`, o `init-harness.mjs` gera automaticamente os 3 modelos parametrizados a partir de `templates/docs/`.

---

## ✨ O que vem dentro do `aegis-harness`?

1. **Constituição `AGENTS.md` Unificada + Templates da Tríade `docs/` (`templates/docs/`):**
   - Zero commit proativo e Staging Cirúrgico por Issue (`Regra 1.1` e `1.1.1`).
   - Planos isolados por conversa com **Boost Trade-off Matrix (Opção A vs. B)** e cenários **BDD Gherkin 1:1** (`Regra 1.3`).
   - **Padrão Adversarial EGM (Elephant-Goldfish Model)** em Duplo Portão (documentado na skill `egm-goldfish-review`):
     - **1º Portão (Fase Plan):** *Cold Spec Review* a frio com **Pre-Mortem de Produção** e **Navalha de Occam** (`Regra 1.3.7`).
     - **2º Portão (Fase Review):** Auditoria cirúrgica do diff por lista de arquivos (`scripts/review.ps1 -Issue <ID> -Files "..."`) nos 4 Eixos com resolução autônoma (`ACCEPT & FIX via TDD` vs. `CONTEST WITH EVIDENCE`) até obter `APROVADO` (`Regra 1.18`).
   - Classificação nos **5 Eixos de Escopo** com gatilho *Stop-and-Warn* (`Regra 1.11`) e proibição de compatibilidade zumbi / dual-schema (`Regra 1.12`).
2. **Catálogo Completo de 54 Agent Skills (Upstream GitHub + Fallback Offline):**
   - **25 Skills de Engenharia (`addyosmani/agent-skills`):** `using-agent-skills`, `interview-me` (`/grill-me`), `doubt-driven-development`, `idea-refine`, `constraint-driven-development`, `source-driven-development`, `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `code-review-and-quality`, `security-and-hardening`, etc.
   - **6 Skills de Qualidade Web (`addyosmani/web-quality-skills`):** `accessibility`, `core-web-vitals`, `performance`, `seo`, `best-practices`, `web-quality-audit`.
   - **1 Skill de Arquitetura Interativa (`tt-a1i/archify`):** `archify` (diagramas interativos HTML/SVG e grafo JSON tipado verificados contra o código-fonte).
   - **19 Skills de Segurança Defensiva (`google/mantis`):** `mantis-summarize`, `mantis-structural-index`, `mantis-history`, `mantis-architecture`, `mantis-threat-model`, `mantis-plan`, `mantis-researcher`, `mantis-dedupe`, `mantis-review`, `mantis-critic`, `mantis-reproduce`, `mantis-chain`, `mantis-calibrate`, `mantis-patch`, `mantis-report`, `mantis-reflect`, `mantis-advise`, `mantis-meta-agent`, `mantis-pipeline-adapter`.
   - **3 Skills Soberanas do Aegis:**
     - `egm-goldfish-review`: Protocolo completo de Duplo Portão do Padrão EGM (1º Portão Cold Spec Review + 2º Portão `review.ps1`).
     - `clean-code-audit`: 22 regras universais + scanner AST determinístico + índice `CRAP < 10`.
     - `mcp-ecosystem-guide`: Orquestração de `sequential-thinking` em 5 fases, `repomix`, `chrome-devtools-mcp` e busca externa (`brave-search` / `search_web` nativo) com trava de confrontação local.
3. **Motores Determinísticos Políglotas (`templates/scripts/` e `templates/scripts-python/`):**
   - `review.ps1` (com isolamento `-Files` e gravação em `scratch/review_prompt_issue_<ID>.md`) e `audit-repo.ps1`.
   - `plan-collision.mjs` / `plan-collision.py` (reserva de arquivos em `.git/active-plans.json` para paralelismo sem conflitos).
   - `blast-radius.mjs` / `blast-radius.py` (cálculo de impacto reverso e seleção de testes).
   - `audit-verify.mjs` / `audit-verify.py` (executor políglota de portões orientado por `harness.config.json`).
   - `check-test-naming-governance.mjs` / `check-test-naming-governance.py` (guardião semântico de testes).
   - Configurações prontas em `templates/configs/` (`sgconfig.yml` + 3 regras AST, `knip.jsonc`, `.dependency-cruiser.js`, `repomix.config.json`, `mcp-servers.template.json`) e `templates/github/` (Issue Templates BDD + GitHub Actions `audit.yml`).
4. **Apresentação Keynote Interativa de 21 Slides (`docs/keynote/index.html`):**
   - Deck completo em tela cheia (`100dvh`), navegação horizontal e tema Hallmark Console auditado com `0 FAIL, 0 REFLEX, 0 WARN` no `sloplint.mjs`.

---

## 🚀 Como Instalar em Qualquer Máquina

Clone este repositório diretamente na pasta global de skills do Antigravity:

```bash
git clone https://github.com/<seu-usuario>/aegis-harness ~/.gemini/config/skills/aegis-harness
```

Depois, abra qualquer projeto (em qualquer linguagem) e peça no chat do Antigravity:

> **"Use a skill `aegis-harness` para instalar o Engineering Harness neste projeto."**

Ou rode diretamente via CLI:

```bash
# Busca a versão mais recente no GitHub com fallback automático para o snapshot local:
node ~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs --target /caminho/do/seu/projeto

# Forçar instalação 100% offline (usando apenas o cache local embarcado):
node ~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs --target /caminho/do/seu/projeto --offline
```
