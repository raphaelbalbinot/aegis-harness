# 🛡️ Aegis Harness (`aegis-harness`)

**Adversarial Engineering Governance & Intelligent Skills** — Um *Engineering Harness* determinístico, adversarial, políglota e **100% agnóstico de nuvem e de ferramenta agêntica** para transformar agentes de IA em engenheiros de software seniores auditáveis em qualquer linguagem (TypeScript/Node.js, Python, Go, Rust, Java, C#).

> *"Um LLM de fronteira é um motor probabilístico de altíssima potência, mas sem freios nativos. Sem um **Harness** (arreio, sensores e trilhos determinísticos), ele corre rápido na direção errada. O **Engineering Harness** não reduz a potência do modelo — ele canaliza 100% dessa força bruta para dentro de barreiras físico-matemáticas onde alucinações, regressões e dívida técnica são fisicamente bloqueadas."*  
> — **Síntese da Tese de Engenharia Agêntica** *(inspirada em **Addy Osmani**, "AI-Assisted Engineering / Beyond Vibe Coding", & **Anthropic Engineering**, "Building Effective Agents" / SWE-bench Agent Harness)*

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
| **2. AWS Kiro (Amazon Spec-Driven IDE)** | Instalado com `--agent kiro` (ou `--agent all`): lê `AGENTS.md` nativamente e cria `.kiro/steering/aegis.md` (`#[[file:AGENTS.md]]` com `inclusion: always`). | Durante as fases *Requirements / Design / Tasks* do Kiro, executa `node scripts/blast-radius.mjs`, `node scripts/audit-verify.mjs` e `node scripts/review.mjs` (que carimbam `.git/aegis-gate-stamp.json`). |
| **3. Amazon Q Developer (IDE & CLI)** | Lê `AGENTS.md` e `.amazonq/rules/*.md` (basta apontar para `AGENTS.md` e seguir a Seção 0). | Executa `node scripts/audit-verify.mjs`, `node scripts/review.mjs` e `node scripts/aegis-hook-guard.mjs --check-rules`. |
| **4. Anthropic Claude Code** | Instalado com `--agent claude`: gera `CLAUDE.md` (importando `@AGENTS.md`), `.claude/settings.json` e lê os módulos da Seção 0. | Trava física `PreToolUse` via `.claude/settings.json` (`scripts/aegis-hook-guard.mjs`) + subagentes nativos `.claude/agents/goldfish-auditor.md` e `slice-executor.md`. |
| **5. OpenAI Codex CLI & Web** | Lê `AGENTS.md` nativamente na raiz e carrega os módulos da Seção 0 sob demanda. | Despacha `codex exec --sandbox read-only` (para `🐠 Goldfish`) e `codex exec --full-auto` (para fatias DAG). |
| **6. Cursor (Anysphere)** | Instalado com `--agent cursor` (ou `--agent all`): lê `AGENTS.md` nativamente na raiz e cria `.cursor/hooks.json`. | Trava física `beforeShellExecution` em `.cursor/hooks.json` (`scripts/aegis-hook-guard.mjs`) + scripts Multi-OS (`blast-radius`, `plan-collision`, `audit-verify`, `review`). |
| **7. Windsurf (Codeium)** | Lê `AGENTS.md` nativamente na raiz e carrega `.agents/rules/*.md` via Seção 0. | Executa os scripts determinísticos Multi-OS em `scripts/`. |
| **8. OpenCode (CLI / TUI)** | Instalado com `--agent opencode` (ou `--agent all`): lê `AGENTS.md` + `.agents/skills/` nativamente e instala `.opencode/agents/{goldfish-auditor,slice-executor}.md`. | **100% Nativo:** plugin `.opencode/plugins/aegis-hook-guard.mjs` (`tool.execute.before`) valida `implementation_plan.md` (libera `Status: DRAFT`, bloqueia plano final sem `Confidence Gate ≥ 95%` / 1º Goldfish) e bloqueia commits sem carimbo + `.git/hooks/pre-commit`. |
| **9. GitHub Copilot, Cline, Roo Code, Kilo Code & Windsurf / Codex** | Leem `AGENTS.md` nativamente na raiz do repositório. | **Máximo suportado pela ferramenta:** não oferecem hook `PreToolUse` local para interceptar escrita de `implementation_plan.md` em tempo real; a trava física de commit é garantida universalmente por **`.git/hooks/pre-commit`** (`node scripts/aegis-hook-guard.mjs --pre-commit`). |

> **Nota sobre roteadores, forks e ambientes em nuvem:**
> - **Roteadores de API (`OpenRouter`, `Claude Code Router`, `LiteLLM`, `Ollama`):** não precisam de adaptador próprio — usam exatamente o comando do cliente na ponta (ex.: `--agent opencode` com OpenRouter, ou `--agent claude` com Claude Code Router).
> - **Extensões VS Code (`Cline`, `Roo Code`, `Kilo Code`, `GitHub Copilot`):** funcionam com a instalação padrão (`AGENTS.md` + `.git/hooks/pre-commit`).
> - **Ambientes remotos (`AWS Cloud9`, `GitHub Codespaces`, `Dev Containers`):** qualquer CLI agêntica rodando no terminal (OpenCode, Claude Code, Codex, Gemini CLI) herda automaticamente `AGENTS.md`, `scripts/` e `.git/hooks/pre-commit`.

### 🤖 Modelos Recomendados por Fase & Adaptação para Outros Agentes

O `aegis-harness` é **100% agnóstico de provedor/modelo** (Gemini, Claude, GPT/Codex, DeepSeek, Llama/Qwen locais). Para equilibrar qualidade e FinOps:

| Fase do Ciclo | Perfil de Modelo Recomendado | Exemplos |
| :--- | :--- | :--- |
| **`DEFINE` / `PLAN` & 1º/2º 🐠 Goldfish** | **Reasoning / Frontier** (alta capacidade de crítica arquitetural e detecção de *edge cases*) | Gemini Pro / Argon, Claude Sonnet/Opus, GPT-5 / o3, DeepSeek-R1 |
| **`BUILD` (Fatias DAG isoladas)** | **Fast / Mid-tier** (baixa latência para ciclos curtos de TDD em arquivos delimitados) | Gemini Flash / Neon, Claude Sonnet/Haiku, GPT-4.1 / Codex-mini |
| **`AUDIT` (`blast-radius`, `audit-verify`, `scan-clean-code`)** | **0 tokens (100% determinístico local)** | Node.js / Python scripts em `scripts/` |

**Como adaptar para qualquer outro agente/IDE não listado:**
1. **Instruções:** aponte o arquivo de regras do seu agente para `AGENTS.md` na raiz (ex.: `@AGENTS.md`, `#[[file:AGENTS.md]]` ou cópia de referência) e mantenha `.agents/rules/*.md` sob demanda.
2. **Esteira determinística:** permita que o agente execute `node scripts/blast-radius.mjs`, `node scripts/audit-verify.mjs` e `node scripts/review.mjs` (ou os equivalentes em `scripts/*.py`).
3. **Trava física opcional (PreToolUse):** caso seu agente suporte hooks pré-execução de ferramenta, envolva `evaluatePreToolUseHook` de `scripts/aegis-hook-guard.mjs` (use `.opencode/plugins/aegis-hook-guard.mjs` como modelo de adaptador de ~50 linhas).

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
# Auto-detecção do agente hospedeiro (Antigravity, OpenCode, Claude Code, Codex, Kiro, Cursor, etc.):
node ~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs --target /caminho/do/seu/projeto

# Forçar modo específico de hospedeiro (--agent antigravity | opencode | claude | kiro | cursor | codex | all) e modo 100% offline:
node ~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs --target /caminho/do/seu/projeto --agent opencode --offline
```

---

## 🧪 5. Como Avaliar a Eficácia do Aegis (Simulação Determinística & Benchmark A/B)

Qualquer pessoa que baixar o repositório pode comprovar na prática o funcionamento dos guardrails anti-drift:

1. **Simulação Determinística de Guardrails (0 custo de API, ~6 cenários adversariais incluindo Spec Drift e Scope Drift):**
   ```bash
   node scripts/simulate-efficacy.mjs
   ```
2. **Benchmark A/B com LLM Real (`Sem Aegis` vs. `Com Aegis v2` em 6 tarefas-armadilha com juiz determinístico):**
   ```bash
   GEMINI_API_KEY="sua-chave" node scripts/benchmark-ab.mjs
   ```
3. **Suíte de Testes de Governança do Harness:**
   ```bash
   node --test tests/governance/*.test.mjs
   ```
