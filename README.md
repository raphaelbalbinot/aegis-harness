# 🛡️ Aegis Harness (`aegis-harness`)

**Adversarial Engineering Governance & Intelligent Skills** — Um *Engineering Harness* determinístico, adversarial, políglota e **100% agnóstico de nuvem e de ferramenta agêntica** para transformar agentes de IA em engenheiros de software seniores auditáveis em qualquer linguagem (TypeScript/Node.js, Python, Go, Rust, Java, C#).

---

## 🏛️ 1. Arquitetura Constitucional *Hub & Spoke* (`< 22 KB` Anti-Truncamento) + A Tríade `docs/`

Para impedir o truncamento silencioso de regras (como o limite físico de `24.000 bytes` por arquivo de regra do Google Antigravity) e manter o repositório enxuto e agnóstico, o `aegis-harness` estrutura a governança sobre o padrão **Hub & Spoke**:

1. **`AGENTS.md` (O Hub Constitucional Universal — `< 16 KB`):**
   - Contém na **Seção 0 (`Universal Multi-Agent Routing`)** a tabela imperativa de carregamento sob demanda de regras modulares por domínio (`.agents/rules/*.md` ou `.agent/rules/*.md`, cada uma com `< 6 KB`), seguida das **20 Leis Inegociáveis**, da árvore de decisão `/using-agent-skills` e dos **7 Core Behaviors**.
   - **Protocolo Semáforo Goldfish (`RequestFeedback: false -> true`) & Fiscal Determinístico (`scripts/aegis-hook-guard.mjs`):**
     - **Obrigatoriedade Universal dos 2 Portões 🐠 Goldfish (`goldfishRequired: true`):** Todo `implementation_plan.md` passa obrigatoriamente pelo **1º Portão 🐠 Goldfish (`Cold Spec Review`)** na Fase `PLAN` e pelo **2º Portão 🐠 Goldfish (`review.mjs` / `review.ps1`)** na Fase `REVIEW`, sem exceção por risco baixo.
     - **Trava Física `PreToolUse` (`.agents/hooks.json`):** O script `scripts/aegis-hook-guard.mjs` bloqueia fisicamente (`decision: "deny"`) qualquer tentativa de exibir o botão *Proceed* (`RequestFeedback: true`) em `implementation_plan.md` antes de a seção `## 🐠 Relatório Cold Spec Review` (`GF-01..N`) existir no plano, e bloqueia qualquer `git commit` se `.git/aegis-gate-stamp.json` não comprovar a execução recente de `audit-verify` e `review.mjs`.
2. **A Tríade Constitucional em `docs/` (`templates/docs/`):**
   - **`docs/PRD.md`**: Constituição do produto, modelo de negócio, jornadas críticas (`RF-01..N`), SLAs e privacidade (LGPD/GDPR).
   - **`docs/ARCHITECTURE.md`**: Decisões técnicas imutáveis da stack detectada, fronteiras de módulos, separação de estado, telemetria nos 3 níveis (`invoice_total`, `production`, `failed_and_retries`, `dev_and_test`) e diagramas vivos sincronizados (`archify`).
   - **`docs/DIRETRIZES_DOMINIO.md`**: Invariantes especialistas do domínio de negócio e glossário oficial da **Linguagem Ubíqua (DDD — Regra 1.19)**.
3. **Modelo de Ameaças Vivo Shift-Left (`workspace/kb/THREAT_MODEL.md`):**
   - Bootstrap automático com controles `TM-*` e hash criptográfico `<!-- aegis-surface-hash: ... -->`, exigindo citação nominal dos `TM-IDs` no selo `[Mantis-Advise]` (`Regra 1.8`).

---

## 🤝 2. Compatibilidade Universal com as 8+ Ferramentas Agênticas do Mercado (Incluindo AWS Kiro & Amazon Q)

Graças à **Seção 0 (Universal Multi-Agent Routing)** no topo do `AGENTS.md` (`< 16 KB`), o `aegis-harness` funciona sem *vendor lock-in* nas principais ferramentas e IDEs agênticas do mercado:

| Ferramenta / IDE Agêntica | Como Lê a Constituição e os Módulos `.agent(s)/rules/*.md` | Como Executa o Duplo Portão 🐠 Goldfish & Guardrails |
| :--- | :--- | :--- |
| **1. Google Antigravity / Gemini CLI** | Lê `AGENTS.md` e descobre automaticamente `.agents/rules/*.md` (ou `.agent/rules/*.md`). | Executa `.agents/hooks.json` (`aegis-hook-guard.mjs` em `PreToolUse`) e despacha subagentes nativos via `invoke_subagent` (`research` e `slice-executor`). |
| **2. AWS Kiro (Amazon Spec-Driven IDE)** | Lê `AGENTS.md` nativamente na raiz e segue a tabela de roteamento da **Seção 0** para carregar `.agents/rules/*.md`. *(Opcionalmente, crie `.kiro/steering/aegis.md` contendo `#[[file:AGENTS.md]]` para fixar no Steering nativo do Kiro).* | Durante as fases *Requirements / Design / Tasks* do Kiro, executa `node scripts/blast-radius.mjs`, `node scripts/audit-verify.mjs` e `node scripts/review.mjs` (que carimbam `.git/aegis-gate-stamp.json`). |
| **3. Amazon Q Developer (IDE & CLI)** | Lê `AGENTS.md` e `.amazonq/rules/*.md` (basta apontar para `AGENTS.md` e seguir a Seção 0). | Executa `node scripts/audit-verify.mjs`, `node scripts/review.mjs` e `node scripts/aegis-hook-guard.mjs --check-rules`. |
| **4. Anthropic Claude Code** | Instalado com `--agent claude`: gera `CLAUDE.md` (que importa `@AGENTS.md`) e lê os módulos da Seção 0. | Despacha os subagentes nativos `.claude/agents/goldfish-auditor.md` (somente-leitura) e `.claude/agents/slice-executor.md`. |
| **5. OpenAI Codex CLI & Web** | Lê `AGENTS.md` nativamente na raiz e carrega os módulos da Seção 0 sob demanda. | Despacha `codex exec --sandbox read-only` (para `🐠 Goldfish`) e `codex exec --full-auto` (para fatias DAG). |
| **6. Cursor (Anysphere)** | Lê `AGENTS.md` nativamente na raiz e navega pelos módulos listados na Seção 0. | Executa os scripts Multi-OS (`blast-radius.mjs`, `plan-collision.mjs`, `audit-verify.mjs`, `review.mjs`). |
| **7. Windsurf (Codeium)** | Lê `AGENTS.md` nativamente na raiz e carrega `.agents/rules/*.md` via Seção 0. | Executa os scripts determinísticos Multi-OS em `scripts/`. |
| **8. GitHub Copilot Coding Agent & Cline / Roo Code** | Leem `AGENTS.md` nativamente na raiz do repositório. | Executam a esteira determinística (`node scripts/audit-verify.mjs`) e o verificador `aegis-hook-guard.mjs`. |

---

## ✨ 3. Catálogo de 55 Agent Skills & Motores Determinísticos Políglotas

1. **55 Agent Skills (Upstream GitHub + Fallback Offline):**
   - **25 Skills de Engenharia (`addyosmani/agent-skills`):** `using-agent-skills`, `interview-me` (`/grill-me`), `doubt-driven-development`, `idea-refine`, `constraint-driven-development`, `source-driven-development`, `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `code-review-and-quality`, `security-and-hardening`, etc.
   - **6 Skills de Qualidade Web (`addyosmani/web-quality-skills`):** `accessibility`, `core-web-vitals`, `performance`, `seo`, `best-practices`, `web-quality-audit`.
   - **1 Skill de Arquitetura Interativa (`tt-a1i/archify`):** `archify` (diagramas interativos HTML/SVG e grafo JSON tipado verificados contra o código-fonte).
   - **19 Skills de Segurança Defensiva (`google/mantis`):** `mantis-advise`, `mantis-threat-model`, `mantis-meta-agent` e todo o pipeline de 15 estágios.
   - **4 Skills Soberanas do Aegis (`skills/sovereign/`):**
     - `egm-goldfish-review`: Protocolo completo de Duplo Portão do Padrão EGM com Protocolo Semáforo (`RequestFeedback: false -> true`).
     - `dag-slice-orchestrator`: Orquestração Reativa por Ondas DAG com `Single-Execution Gate Protocol` e Hard Sandbox de Whitelist.
     - `clean-code-audit`: 22 regras universais + scanner AST determinístico + índice $\text{CRAP}(m) < 10$.
     - `mcp-ecosystem-guide`: Orquestração de `sequential-thinking`, `repomix`, `chrome-devtools-mcp` e busca externa.
2. **Motores Determinísticos Multi-OS (`templates/scripts/` e `templates/scripts-python/`):**
   - `aegis-hook-guard.mjs`: Fiscal `PreToolUse` (`hooks.json`) + validador de orçamento `< 22.000 bytes` (`--check-rules`) + carimbo `.git/aegis-gate-stamp.json` (`--stamp-verify` / `--stamp-review`).
   - `review.mjs` / `review.ps1` e `audit-repo.mjs` / `audit-repo.ps1`.
   - `plan-collision.mjs` / `plan-collision.py` (`register`, `release`, `snapshot-slice`, `verify-slice --revert-unauthorized`).
   - `blast-radius.mjs` / `blast-radius.py` (`goldfishRequired: true`, `securitySurfaceTouched`, `ceremonyTier`).
   - `audit-verify.mjs` / `audit-verify.py` e `check-test-naming-governance.mjs` / `.py`.

---

## 🚀 4. Como Instalar em Qualquer Projeto e Hospedeiro Agêntico

```bash
# Auto-detecção do agente hospedeiro (Antigravity, Claude Code, Codex, Kiro, Cursor, etc.):
node ~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs --target /caminho/do/seu/projeto

# Forçar modo específico de hospedeiro (--agent antigravity | claude | codex | all) e modo 100% offline:
node ~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs --target /caminho/do/seu/projeto --agent antigravity --offline
```
