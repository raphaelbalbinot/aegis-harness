# 🌉 Ponte Oficial Multi-Agente — {{PROJECT_NAME}} (Aegis Engineering Harness)

@AGENTS.md

---

## 🤝 Mapeamento Nativo de Ferramentas & Subagentes (`Antigravity` $\leftrightarrow$ `Claude Code` $\leftrightarrow$ `OpenAI Codex CLI`)

Este repositório utiliza **Fonte Única da Verdade** em `@AGENTS.md` + Tríade Constitucional em `docs/` (`PRD.md`, `ARCHITECTURE.md`, `DIRETRIZES_DOMINIO.md` e contratos associados `docs/{architecture,database_schema,standards}.md`). Use a tabela abaixo para traduzir os protocolos do **Aegis Engineering Harness** (Duplo Portão **EGM Goldfish** e Orquestração por Ondas **DAG**) para o seu ambiente agêntico nativo:

| Capacidade do Harness | **Google Antigravity** | **Anthropic Claude Code** | **OpenAI Codex CLI** |
| :--- | :--- | :--- | :--- |
| **Leitura / Constituição Soberana** | `AGENTS.md` + `docs/{PRD,ARCHITECTURE,DIRETRIZES_DOMINIO}.md` (`docs/{architecture,database_schema,standards}.md`) | `@AGENTS.md` (importado automaticamente via `CLAUDE.md`) + `docs/` | `AGENTS.md` (lido nativamente na raiz) + `docs/` |
| **Subagente Auditor Frio (`🐠 Goldfish` — Portões 1 e 2)** | `invoke_subagent(TypeName: "research", Model: "inherit", Role: "Goldfish Auditor")` (zero histórico da conversa) | Subagente nativo `.claude/agents/goldfish-auditor.md` invocado via ferramenta `Task` / `Agent` (`subagent_type: "goldfish-auditor"`, somente-leitura) | Processo isolado sem contexto via `codex exec --sandbox read-only "Leia scratch/review_prompt.md e audite nos 4 Eixos EGM Goldfish"` |
| **Subagente Executor de Fatia DAG (`slice-executor`)** | `define_subagent(Name: "slice-executor")` + `invoke_subagent(TypeName: "slice-executor", Model: "flash" \| "inherit" \| "pro")` | Subagente nativo `.claude/agents/slice-executor.md` invocado via ferramenta `Task` / `Agent` (`subagent_type: "slice-executor"`) | Processo isolado confinado à fatia via `codex exec --full-auto "Implemente exclusivamente a Fatia N conforme implementation_plan.md"` |
| **Fast-Track Determinístico (`ceremonyTier`)** | `node scripts/blast-radius.mjs <arquivos> --json` (`"XS_EXPRESS"` vs. `"FULL_EGM_DAG"`) | `node scripts/blast-radius.mjs <arquivos> --json` | `node scripts/blast-radius.mjs <arquivos> --json` |
| **Hard Sandbox de Whitelist DAG (`snapshot-slice` / `verify-slice`)** | `node scripts/plan-collision.mjs snapshot-slice --slice <ID> --files "<csv>"` e `verify-slice --slice <ID> --revert-unauthorized` | `node scripts/plan-collision.mjs snapshot-slice --slice <ID> --files "<csv>"` e `verify-slice --slice <ID> --revert-unauthorized` | `node scripts/plan-collision.mjs snapshot-slice --slice <ID> --files "<csv>"` e `verify-slice --slice <ID> --revert-unauthorized` |
| **Extrator Multi-OS do 2º Portão Goldfish** | `node scripts/review.mjs --issue <ID> --files "<csv>"` ou `node scripts/review.mjs --plan <path> --files "<csv>"` | `node scripts/review.mjs --issue <ID> --files "<csv>"` ou `node scripts/review.mjs --plan <path> --files "<csv>"` | `node scripts/review.mjs --issue <ID> --files "<csv>"` ou `node scripts/review.mjs --plan <path> --files "<csv>"` |
| **Auditoria Estrutural & Clean Code (22 Regras + CRAP)** | `node scripts/scan-clean-code.mjs --changed`, `node scripts/audit-verify.mjs` e `node scripts/audit-repo.mjs` | `node scripts/scan-clean-code.mjs --changed`, `node scripts/audit-verify.mjs` e `node scripts/audit-repo.mjs` | `node scripts/scan-clean-code.mjs --changed`, `node scripts/audit-verify.mjs` e `node scripts/audit-repo.mjs` |

### Equivalência de Modelos por Tier (`dag-slice-orchestrator`)

- **🟢 Tier 1 (Rápido / `XS-S`):** Antigravity `"flash"` (`gemini-4-hydrogen`) $\leftrightarrow$ Claude Code `haiku` $\leftrightarrow$ Codex CLI `codex-mini`
- **🔵 Tier 2 (Padrão / `M`):** Antigravity `"inherit"` (`Argon` / `Neon`) $\leftrightarrow$ Claude Code `sonnet` $\leftrightarrow$ Codex CLI `codex-default`
- **🟣 Tier 3 (Frontier / Segurança / `HIGH` / Retry Escalation):** Antigravity `"pro"` (`gemini-4-carbon`) $\leftrightarrow$ Claude Code `opus` $\leftrightarrow$ Codex CLI `o3-pro`
