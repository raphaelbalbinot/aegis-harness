# 📜 Constituição de Governança & Skills — {{PROJECT_NAME}} (Aegis Harness v2)

Antes de planejar, refatorar ou codificar neste repositório, obedeça a este hub (`AGENTS.md`), aos módulos aplicáveis em `.agents/rules/` e à documentação viva em `docs/` (`PRD.md`, `ARCHITECTURE.md`, `DIRETRIZES_DOMINIO.md`).

---

## 🧭 0. Roteamento Modular (`.agents/rules/` — `< 6 KB` / Arquivo)

Carregue sob demanda apenas os módulos aplicáveis ao escopo da tarefa:

| Escopo / Domínio | Módulo | Quando Carregar |
| :--- | :--- | :--- |
| **Infra, Runtime & Persistência** | `.agents/rules/runtime-infra.md` | APIs, workers, subprocessos, banco/storage, containers/serverless. |
| **Segurança & Threat Model** | `.agents/rules/security-threat-model.md` | Sempre que `blast-radius` marcar `securitySurfaceTouched: true`. |
| **IA, LLMs & FinOps** | `.agents/rules/ai-finops.md` | Pipelines de IA, prompts, context caching ou telemetria de custo. |
| **Frontend & Qualidade Web** | `.agents/rules/web-frontend.md` | HTML/CSS/DOM/JS client-side, acessibilidade, CWV ou SEO. |

---

## 🛑 1. Invariantes Universais de Governança

### 1.1 Sem Commit Proativo & Staging Cirúrgico
- **NUNCA** execute `git commit` ou `git push` sem comando expresso do usuário.
- **Proibido `git add .`, `git add -A` e `git commit -a/--all`:** faça staging cirúrgico apenas dos arquivos da entrega, referenciando a issue (`<type>(<scope>): <descrição> (#<ID>)`), e libere o registro via `plan-collision release --issue <ID>`.

### 1.2 Alinhamento Antes de Codar & Gherkin Obrigatório
- **NUNCA** inicie `BUILD` sem autorização expressa do usuário.
- Se faltar qualquer decisão de regra de negócio, UX ou contrato que exija adivinhação, **pare e pergunte** (usando `interview-me`) antes de propor o plano.
- Todo plano (`<appDataDir>/brain/<conversation-id>/implementation_plan.md`) **DEVE** conter cenários **BDD Gherkin (`Dado / Quando / Então`)** — mesmo no Fast-Path Tier 0 — para validar o entendimento antes do código. Nunca grave planos em `tasks/todo.md` no repositório.

### 1.3 Portões Proporcionais ao Risco (`blast-radius` + Duplo Portão 🐠 Goldfish)
- Execute `node scripts/blast-radius.mjs <arquivos> --json` (ou `python scripts/blast-radius.py <arquivos> --json`) **1 única vez na Fase `PLAN`**. O script decide deterministicamente (em contexto limpo) e grava o carimbo em `.git/aegis-gate-stamp.json`:
  - **Tier 0 (`XS_EXPRESS` — `planGoldfishRequired: false`):** 1 arquivo de produção isolado (`0` consumidores, `LOW`, fora de segurança/infra). Apresente plano curto com **Gherkin** e `RequestFeedback: true` diretamente.
  - **Tier 1+ (`FULL_EGM_DAG` — `planGoldfishRequired: true`):** 2+ arquivos de produção, qualquer consumidor reverso ou superfície de segurança/infra. Siga o **Protocolo Semáforo**: (1) grave o rascunho com `RequestFeedback: false`, invoque o **1º Goldfish (`Cold Spec Review`)** e encerre o turno; (2) incorpore `## 🐠 Relatório Cold Spec Review` (`GF-01..N`) + DAG e só então defina `RequestFeedback: true`.
- **2º Portão 🐠 Goldfish (`codeGoldfishRequired: true`):** **SEMPRE obrigatório** antes do `git commit` para qualquer alteração de código (dispensado apenas para docs puros `*.md`). Rode `audit-verify` + `review.{mjs,ps1}` e obtenha veredito `APROVADO` do Goldfish de Implementação.

### 1.4 TDD, Verificação Real & Escopo Cirúrgico
- Siga **🔴 RED → 🟢 GREEN → 🔵 REFACTOR** (usando `test-driven-development` + `code-review-and-quality`).
- **Outer Loop Único:** execute `audit-verify` (exit code `0`) 1 vez ao concluir todas as fatias.
- **Trava Anti-Burla:** o `aegis-hook-guard.mjs` valida `git diff --cached --name-only` contra os arquivos avaliados pelo `blast-radius` no commit.
- **Simplicidade & Zero Compatibilidade Zumbi:** ao evoluir um contrato/schema, remova 100% do formato antigo. Não crie abstrações prematuras.

### 1.5 Segurança Básica Universal
- Em JS/TS, use sempre `??` (*Nullish Coalescing*) em vez de `||` para fallbacks de valores potencialmente falsy.
- Em qualquer linguagem, execute subprocessos com lista de argumentos (`execFileSync` / `shell=False`) sem interpolação de shell (`CWE-78`). Nunca vaze segredos ou dados sensíveis em logs.

### 1.6 Desambiguação Rápida de Skills
Use `recommendedSkills` do `blast-radius` como **piso mínimo garantido** (catálogo permanece aberto):
- **Dúvidas de requisito / alinhamento:** `interview-me`
- **Segurança no dia a dia (Shift-Left):** `mantis-advise` | **Auditoria de segurança completa:** `mantis-meta-agent`
- **Refactor interno no TDD:** `code-review-and-quality` + `clean-code-audit`
- **Revisão adversarial (1º e 2º Portão):** `egm-goldfish-review`
- **Paralelismo por ondas DAG (`>= 2` fatias independentes):** `dag-slice-orchestrator`

### 1.7 Transparência Enxuta no Chat
Ao concluir uma entrega, apresente um **resumo executivo compacto (3–5 linhas)**:
1. O que mudou e quais arquivos foram tocados;
2. Verificações determinísticas que passaram (`audit-verify`, testes, 2º Goldfish);
3. Suposições ou riscos residuais (se houver).
Detalhes completos (dossiê de review, telemetria, logs) ficam em `scratch/` ou artefatos.

---

## 🤝 2. Metadados do Repositório
- **Projeto:** `{{PROJECT_NAME}}` | **Linguagem:** `{{LANGUAGE}}` | **Stack:** `{{STACK_SUMMARY}}`
- **Domínios Semânticos de Teste:** `{{TEST_DOMAINS}}`
- **Esteira Determinística:** configurada em `harness.config.json` e executada via `audit-verify`.
