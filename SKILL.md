---
name: aegis-harness
description: Instala e configura automaticamente o Aegis Engineering Harness (AGENTS.md Unificado de 20 regras + Tríade Constitucional docs/, Padrão EGM Elephant-Goldfish em Duplo Portão via egm-goldfish-review, review.ps1, plan-collision, blast-radius, clean-code-audit 22 regras, suíte Mantis de 19 skills e Agent Skills do Addy Osmani com busca online + fallback local) em qualquer projeto e linguagem de programação. Use quando o usuário pedir "instale o aegis-harness", "inicialize meu harness neste projeto" ou "configure o engineering harness aqui".
---

# 🛡️ Aegis Harness — Inicializador Políglota de Governança & Skills

Esta skill instala o **Aegis Engineering Harness** em qualquer repositório (TypeScript/JavaScript, Python, Go, Rust, Java/Kotlin ou C#).

## Como Executar a Instalação Automática

1. **Executar o Bootstrapper Políglota (com Auto-Detecção ou Flag `--agent`):**
   Rode o comando abaixo apontando `--target` para a raiz do projeto atual do usuário e informando a ferramenta agêntica (`--agent antigravity`, `--agent claude`, `--agent codex` ou `--agent all`; se omitido, o bootstrapper auto-detecta pela pasta `.gemini`/`.agents`/`.claude`):
   ```powershell
   node "C:\Users\s023319089\Documents\Projetos\aegis-harness\bin\init-harness.mjs" --target "." --agent antigravity
   ```
   *(Se o repositório estiver clonado em `~/.gemini/config/skills/aegis-harness`, use `~/.gemini/config/skills/aegis-harness/bin/init-harness.mjs`).*

2. **O que o Bootstrapper faz sozinho:**
   - **Auto-Detecção Cirúrgica de Host Agêntico (`detectAgentHost`):** Quando `--agent antigravity` (ou `--agent codex`) é utilizado ou auto-detectado via `.gemini`/`.agents`/`.agent`, cria apenas `AGENTS.md`, `.agents/skills/` e `scripts/` — **sem poluir o repositório com `CLAUDE.md` nem `.claude/agents/`**. Quando `--agent claude` ou `--agent all` é solicitado, instala também a ponte `CLAUDE.md` + `.claude/agents/{goldfish-auditor,slice-executor}.md`.
   - **Detecção Automática de Stack:** Inspeciona `package.json`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml` ou `pom.xml`, além das pastas de código (`src/`, `app/`, `pkg/`) para inferir a linguagem, frameworks e domínios de teste semânticos.
   - **Upstream-First com Local Snapshot Fallback:** Tenta baixar a versão mais recente das skills públicas no GitHub (`addyosmani/agent-skills`, `addyosmani/web-quality-skills`, `tt-a1i/archify`, `google/mantis`) e cai automaticamente para o cache local (`skills/fallback-cache/`) se estiver offline ou sob proxy restrito.
   - **Instalação das 55 Skills (Upstream + Soberanas):** Instala `using-agent-skills`, `egm-goldfish-review` (Duplo Portão EGM), `dag-slice-orchestrator` (Orquestração Reativa por Grafo DAG de Fatias com 5 Travas Anti-Drift, Hard Sandbox `snapshot-slice`/`verify-slice` e Roteamento de 3 Tiers `flash`/`inherit`/`pro`), `clean-code-audit` (22 regras + scanner AST), `archify` (5 abas 3D), `mcp-ecosystem-guide` e todas as **19 skills da campanha defensiva Mantis (`mantis-*`)**.
   - **Geração da Constituição Dupla (`AGENTS.md` Unificado + Tríade `docs/`) e Motores (`scripts/`):** Cria `AGENTS.md` na raiz (com todas as regras unificadas, sem `.agents/rules/` fragmentadas), gera os modelos de `docs/PRD.md`, `docs/ARCHITECTURE.md` e `docs/DIRETRIZES_DOMINIO.md` (se ausentes), gera `harness.config.json` (incluindo `agentHost`) e instala `review.mjs`, `audit-repo.mjs`, `plan-collision`, `blast-radius`, `audit-verify` e `check-test-naming-governance` (em Node.js e Python).

3. **Se o Diretório Alvo Estiver Vazio (Projeto do Zero):**
   - Faça apenas **1 pergunta** ao usuário (estilo `/grill-me`): qual será a linguagem/framework principal, os módulos de domínio do novo sistema e qual ferramenta agêntica o projeto utiliza (`antigravity` por padrão no Antigravity, ou `claude`/`codex`/`all`), e em seguida rode o `init-harness.mjs --target "." --agent <escolha>`.
