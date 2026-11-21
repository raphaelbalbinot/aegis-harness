# 📜 Constituição de Governança, Regras de Atuação & Agent Skills — {{PROJECT_NAME}} (Aegis Harness)

Antes de planejar, refatorar ou escrever qualquer código neste repositório, você DEVE ler e obedecer integralmente a este documento (`AGENTS.md`), aos módulos em `.agents/rules/` (ou `.agent/rules/`) e à **Tríade Constitucional de Documentação** em `docs/`:

1. **`docs/PRD.md`** — Constituição do produto, modelo de negócio, jornadas críticas (`RF-01..N`), cotas/SLAs e privacidade (LGPD/GDPR).
2. **`docs/ARCHITECTURE.md`** — Decisões técnicas imutáveis (`{{STACK_SUMMARY}}`), fronteiras de módulos, separação de estado, contratos de API, telemetria e diagramas sincronizados (`Archify`).
3. **`docs/DIRETRIZES_DOMINIO.md`** *(ou `DIRETRIZES_CRIATIVAS.md` / `DIRETRIZES_EDITORIAIS.md`)* — Invariantes especialistas do domínio de negócio e glossário oficial da Linguagem Ubíqua (DDD).

---

## 🧭 0. Índice de Regras Modulares por Domínio (Universal Multi-Agent Routing — `< 22 KB` / Arquivo)

Para impedir o truncamento de contexto (como o limite físico de `24.000 bytes` por arquivo do Google Antigravity) e manter **100% de compatibilidade agnóstica** entre **Google Antigravity**, **AWS Kiro**, **Amazon Q Developer**, **Anthropic Claude Code**, **OpenAI Codex CLI**, **Cursor**, **Windsurf**, **GitHub Copilot** e **Cline/Roo Code**, este repositório adota o padrão **Hub & Spoke**:
- O `AGENTS.md` na raiz (`< 16 KB`) contém as **20 Leis Universais de Governança** e a árvore de decisão de Skills;
- As invariantes específicas de infraestrutura/nuvem e de subdomínios técnicos residem em arquivos modulares curtos (`< 6 KB` cada) dentro de `.agents/rules/*.md` (ou `.agent/rules/*.md`).
- **Obrigação Universal de Leitura Sob Demanda:** Qualquer agente de IA DEVE ler obrigatoriamente os arquivos modulares de `.agents/rules/` (ou `.agent/rules/`) aplicáveis ao escopo da tarefa antes de elaborar o `implementation_plan.md` ou editar código:

| Domínio Técnico / Escopo da Tarefa | Caminho do Módulo de Regras (`< 6 KB`) | Quando Carregar |
| :--- | :--- | :--- |
| **Infraestrutura, Runtime & Persistência** | `.agents/rules/runtime-infra.md` *(ou `.agent/rules/cloud-run-gcp.md`)* | Sempre que tocar em rotas de API, workers, banco de dados, storage ou telemetria. |
| **Regras Especialistas do Domínio / Produto** | `.agents/rules/<dominio>.md` *(conforme arquivos presentes na pasta)* | Sempre que tocar em motores de domínio, pipelines de IA, compiladores ou suítes E2E. |

---

## 🛑 1. Regras Críticas de Operação e Governança (20 Leis Inegociáveis)

### 1.1 Proibição Estrita de Proatividade em Commits no GitHub
- **O agente NUNCA deve fazer commits proativamente nem executar `git push` sem comando expresso e inequívoco do usuário.**

### 1.1.1 Rastreabilidade Obrigatória de Issues nos Commits e Staging Cirúrgico por Issue
- Referencie sempre a(s) issue(s) no título do commit: `<type>(<scope>): <descrição> (closes #<ID>)` ou `(#<ID>)`.
- **Proibição de `git add .` / `git add -A`:** Faça staging cirúrgico (`git add <arq1> <arq2> ...`) listando apenas os arquivos do plano da issue e, após o commit, libere o registro via `node scripts/plan-collision.mjs release --issue <ID>` (ou `python scripts/plan-collision.py release --issue <ID>`).

### 1.2 Proibição Estrita de Desenvolvimento Prematuro (Implementação Apenas Sob Demanda Expressa)
- **O agente NUNCA deve iniciar a fase `BUILD` sem autorização expressa do usuário.** Enquanto estiver alinhando requisitos, atue exclusivamente em `DEFINE` e `PLAN`.

### 1.3 Apresentação Obrigatória de Implementation Plan, Obrigatoriedade Universal do 🐠 Goldfish e Protocolo Semáforo (`RequestFeedback: false -> true`)
- **Isolamento Total na Conversa:** Crie o plano exclusivamente no artefato da conversa (`<appDataDir>/brain/<conversation-id>/implementation_plan.md`). Nunca grave `tasks/todo.md` ou `tasks/plan.md` no repositório.
- **Obrigatoriedade Incondicional dos 2 Portões 🐠 Goldfish (`goldfishRequired: true`):**
  - **Não existe dispensa de Goldfish por "risco baixo":** Todo `implementation_plan.md` exige **obrigatoriamente** o **1º Portão 🐠 Goldfish (`Cold Spec Review`)** na Fase `PLAN` e o **2º Portão 🐠 Goldfish (`review.mjs` / `review.ps1`)** na Fase `REVIEW`.
  - O campo `ceremonyTier` (`"XS_EXPRESS"` vs. `"FULL_EGM_DAG"`) calculado por `node scripts/blast-radius.mjs <arquivos> --json` determina apenas se a execução na Fase `BUILD` será sequencial na sessão principal ou despachada em ondas paralelas via subagentes `slice-executor`.
- **Protocolo Semáforo em 2 Passos na Fase `PLAN` (Bloqueio Físico via `aegis-hook-guard.mjs`):**
  1. **Passo 1 — Rascunho Frio (`RequestFeedback: false`):** Elabore o rascunho de `implementation_plan.md` contendo (1) Objetivo, (2) Blast Radius + `plan-collision register`, (3) Fatias preliminares, (4) Critérios TDD, (5) **Boost Trade-off Matrix (`Opção A vs. Opção B`)** e (6) **Cenários BDD Gherkin (`Dado / Quando / Então`)**. Grave o arquivo obrigatoriamente com **`RequestFeedback: false`** (sem exibir o botão *Proceed*), invoque o subagente **🐠 Goldfish Cold Spec Auditor** (`egm-goldfish-review`) e **encerre o turno** aguardando a resposta reativa do subagente.
  2. **Passo 2 — Plano Auditado (`RequestFeedback: true`):** Após o retorno do Goldfish, incorpore no `implementation_plan.md` a tabela **`## 🐠 Relatório Cold Spec Review (EGM Goldfish)` (`GF-01..N`)** (*Default Approve on Proceed*) e a seção **`## 🕸️ Grafo de Dependências entre Fatias — DAG Execution Plan`** (`dag-slice-orchestrator`, alocando `100%` dos `GF-01..N` nas Slices com `Allowed Files Whitelist` disjunta $\text{Files}(A) \cap \text{Files}(B) = \emptyset$), e **somente nessa edição final** defina **`RequestFeedback: true`** para habilitar o botão *Proceed*.

### 1.4 Atualização Mandatória da Tríade Constitucional (`docs/`) Antes da Implementação
- Atualize `docs/PRD.md`, `docs/ARCHITECTURE.md` e `docs/DIRETRIZES_DOMINIO.md` ANTES de codificar mudanças funcionais ou arquiteturais (exceção estrita: correções puras de bugs).

### 1.5 Travas Inegociáveis de Runtime, Estado e Ciclo de Vida de Processos
- **1.5.1 Zero Processamento Fantasma Pós-Resposta:** Nunca dispare tarefas em background sem `await` (*fire-and-forget*) que sobrevivam ao ciclo da requisição sem orquestrador/fila dedicada.
- **1.5.2 Arquitetura Stateless:** Proibido armazenar estado de sessão, jobs ou locks concorrentes em memória global do processo; externalize todo estado nas camadas de persistência definidas em `docs/ARCHITECTURE.md`.
- **1.5.3 Limpeza Determinística de Temporários e Desligamento Gracioso:** Remova arquivos temporários em bloco `finally` e trate sinais `SIGTERM`/`SIGINT`.

### 1.6 Desenvolvimento Estritamente Orientado a Testes (TDD Mandatório em Cada Fatia)
- Execute o ciclo estrito **🔴 RED** (teste falhando) → **🟢 GREEN** (código mínimo) → **🔵 REFACTOR** antes de marcar `[x]` no checklist da conversa.

### 1.7 Prevenção Ativa de Alucinação, Blast Radius Único na Fase `PLAN` e Mini-Auditoria Consolidada no Portão Final
- **1.7.1 Pré-Voo Único (`Blast Radius` — Fase `PLAN`):** Execute `node scripts/blast-radius.mjs <arquivos> --json` (ou `python scripts/blast-radius.py <arquivo> --json`) **1 única vez na Fase `PLAN`**. Proibido re-executar durante a Fase `BUILD` ou dentro de `slice-executor`.
- **1.7.2 Pós-Voo Consolidado (`Audit Verify` — Portão Final):** Execute `node scripts/audit-verify.mjs` (ou `python scripts/audit-verify.py`) **1 única vez ao finalizar todas as fatias da entrega (Trava 5)** (exit code `0`).

### 1.8 Raciocínio Sequencial Profundo (`sequential-thinking` MCP) e Segurança Shift-Left (`mantis-advise`)
- **Raciocínio Sequencial:** Acione `sequential-thinking` antes de algoritmos complexos, concorrência crítica, remediações CWE ou módulos com `riskLevel: "HIGH"`.
- **Segurança Shift-Left (`mantis-advise`):** Em APIs/Webhooks, Autenticação/Permissões, Persistência multi-tenant, Subprocessos (`CWE-78`: usar `execFileSync` / `shell=False`) ou Pipelines de IA/LLMs (`CWE-74`), consulte obrigatoriamente `workspace/kb/THREAT_MODEL.md`, mantenha o `<!-- aegis-surface-hash: ... -->` sincronizado e emita no fechamento o selo nominal citando os IDs `TM-*` reais: `[Mantis-Advise]: ✔ THREAT_MODEL.md Consultado (<TM-ID: CWE-XX>) | ✔ Padrões Defensivos Aplicados`.

### 1.9 Governança de Context Caching e Eficiência de Inferência IA
- Gerencie caches explícitos de LLMs exclusivamente no backend com TTL curto dinâmico e desalocação garantida em bloco `try ... finally`.

### 1.10 Fidelidade Estrutural 1:1 com o Sistema de Arquivos e Integridade de Prompts (Anti-Ghosting)
- Proibido usar identificadores fictícios ou aliases que não existam fisicamente no disco; valide nomes reais via `fs.existsSync`.

### 1.11 Alerta Preventivo de Heterogeneidade de Escopo & Desmembramento de Issues (5 Eixos)
- Classifique demandas nos Eixos **A (Infra/Runtime)**, **B (Segurança/CWE)**, **C (Domínio/IA)**, **D (UI/UX)** e **E (Persistência/Dados)**. Se cruzar $>2$ eixos não triviais ou misturar Infra (A) com UI/Domínio (`stopAndWarnTriggered: true`), pare e proponha issues atômicas (`gh issue create`).

### 1.12 Proibição Estrita de Compatibilidade Zumbi / Dual-Schema
- Ao evoluir um contrato ou schema, remova 100% do formato antigo do código de produção, atualize os testes e adicione regra no `ast-grep`.

### 1.13 Governança de Observabilidade, FinOps e Segregação `production` vs. `dev_and_test`
- Rastreie telemetria e custos nos 3 níveis (`Sistema`, `Usuário/Tenant`, `Recurso/Job`) segregados em `invoice_total`, `production`, `failed_and_retries` e `dev_and_test` com flag `is_test_account`.

### 1.14 Governança Semântica de Testes (Anti-Issue Naming)
- Proibido nomear testes com números de issue (`issue-47.test.*`). Organize por pastas de domínio (`{{TEST_DOMAINS}}`), validado por `check-test-naming-governance`.

### 1.15 Governança Dual E2E e Sincronização de Arquitetura Viva (`Archify`)
- Mantenha paridade entre suítes E2E automatizadas e fluxos MCP (`chrome-devtools-mcp`), sincronizando os diagramas arquiteturais (`archify`) com o código.

### 1.16 Governança de Dois Ciclos (Inner TDD vs. Outer Precommit) e Orquestração DAG `Single-Execution Gate` (`dag-slice-orchestrator`)
- **Execução Sequencial vs. Despacho Paralelo por Ondas:**
  - Se o plano tiver `ceremonyTier === "XS_EXPRESS"` ou for sequencial enxuto (`<= 4` arquivos de produção sem paralelismo real na mesma onda), o próprio **🐘 Elephant** executa as fatias na sessão principal (após aprovação no 1º Portão Goldfish).
  - Quando houver paralelismo real na mesma onda (`>= 2` fatias independentes na mesma Onda ou `5+` arquivos de código), o **🐘 Elephant** define `slice-executor` (`EnableMCPTools: false`, `EnableSubagentTools: false`), despacha as fatias por onda respeitando os **3 Tiers de Modelo** (`"flash"` para `XS/S`, `"inherit"` para `M`, `"pro"` para `HIGH`/Segurança ou *Retry Escalation* após 2 falhas) e aplica o **Hard Sandbox + `Single-Execution Gate`**:
    1. Antes de despachar cada fatia: `plan-collision snapshot-slice --slice <ID> --files "<whitelist>"`;
    2. Dentro da fatia (`Micro-Gate`): o `slice-executor` **NÃO lê `AGENTS.md`** e **NÃO roda `blast-radius`, `audit-verify`, `scan-clean-code` ou `review`** — executa **apenas 1 comando de teste unitário** do seu arquivo;
    3. Após o retorno do subagente: o Orquestrador roda **apenas** `plan-collision verify-slice --slice <ID> --revert-unauthorized`.
- **Outer Loop Consolidado Único (Trava 5):** Rode `audit-verify` **1 única vez** quando `100%` das ondas do grafo DAG estiverem concluídas.

### 1.17 Recomendação Proativa do Slash Command `/compact`
- Recomende proativamente o uso de `/compact` ao concluir fatias extensas ou entregas completas.

### 1.18 Revisão Técnica Sênior Adversarial Pré-Commit — 2º Portão EGM Goldfish Obrigatório (`scan-clean-code.mjs` + `review.mjs` / `review.ps1`)
- É **terminantemente proibido** pedir ou executar `git commit` (bloqueado fisicamente por `scripts/aegis-hook-guard.mjs` via `.git/aegis-gate-stamp.json`) sem cumprir integralmente os 3 passos finais:
  1. Executar `node scripts/scan-clean-code.mjs --changed` e `node scripts/audit-verify.mjs` (ou `python scripts/audit-verify.py`), corrigindo quaisquer desvios das 22 regras e gravando `auditVerifyPassedAt`;
  2. Extrair o dossiê cirúrgico (`node scripts/review.mjs --issue <ID> --files "<arqs>"`, `--plan <caminho>` ou `powershell -File .\scripts\review.ps1 -Issue <ID> -Files "<arqs>"`), gravando `reviewDossierGeneratedAt`;
  3. Invocar o subagente **🐠 Goldfish de Implementação** lendo `scratch/review_prompt.md` até obter o veredito estrito **`APROVADO`** (`ACCEPT & FIX via TDD` ou `CONTEST WITH EVIDENCE`), apresentando a tabela final `## 🐠 Relatório Goldfish de Implementação`.

### 1.19 Governança de Linguagem Ubíqua (DDD Ubiquitous Language) e Orçamento de Rules (`<= 22.000 bytes`)
- Mantenha terminologia canônica estrita conforme `docs/DIRETRIZES_DOMINIO.md` e garanta que `AGENTS.md` e cada arquivo em `.agent(s)/rules/*.md` nunca ultrapassem `22.000 bytes` (`node scripts/aegis-hook-guard.mjs --check-rules`).

### 1.20 Governança de Qualidade Web, `modern-web-guidance` e Critério de Uso Sob Demanda da `/hallmark`
- Em tarefas HTML/CSS/DOM/JS client-side, consulte `npx -y modern-web-guidance@latest search/retrieve`, mantendo `legacy-scan` com `0` achados, combine com `frontend-ui-engineering`, `accessibility`, `core-web-vitals`, `performance`, `seo` e `web-quality-audit`, e acione `/hallmark` (`sloplint.mjs`) apenas sob demanda explícita para páginas *greenfield*.

---

## 🧠 2. Ciclo Mandatório de `/using-agent-skills` em TODAS as Chamadas

```text
Fluxo de Trabalho por Fase
    │
    ├── 1. DEFINE (Concepção e Alinhamento)
    │   ├── Dúvidas sobre o que o usuário quer? ──────→ interview-me (grill-me)
    │   ├── Conceito bruto precisando de variantes? ──→ idea-refine
    │   └── Requisitos e critérios de aceite? ────────→ spec-driven-development
    │
    ├── 2. PLAN (Planejamento com Protocolo Semáforo Goldfish)
    │   ├── Cálculo de Blast Radius (1x no PLAN)? ────→ scripts/blast-radius.{mjs,py} --json
    │   ├── Quebrar a especificação em fatias? ───────→ planning-and-task-breakdown + constraint-driven-development
    │   ├── Segurança preventiva e Threat Model? ─────→ mantis-advise (workspace/kb/THREAT_MODEL.md)
    │   ├── Passo 1: Rascunho Frio + 1º Goldfish? ────→ RequestFeedback: false + egm-goldfish-review
    │   └── Passo 2: Grafo DAG + Botão Proceed? ──────→ dag-slice-orchestrator + RequestFeedback: true
    │
    ├── 3. BUILD (Implementação Cirúrgica)
    │   ├── Hard Sandbox Whitelist por Fatia DAG? ────→ plan-collision snapshot-slice / verify-slice
    │   ├── Fatias verticais finas e verificáveis? ───→ incremental-implementation + dag-slice-orchestrator
    │   ├── Interface, HTML/CSS e JS Client-Side? ────→ modern-web-guidance + frontend-ui-engineering + accessibility
    │   └── Contratos de API e documentação oficial? ─→ api-and-interface-design + source-driven-development
    │
    ├── 4. VERIFY (Validação Rigorosa)
    │   ├── Ciclo red-green-refactor obrigatório? ────→ test-driven-development
    │   └── Validação em navegador real? ─────────────→ browser-testing-with-devtools
    │
    ├── 5. REVIEW & SHIP (Portão Final Obrigatório Antes do Commit)
    │   ├── 1. Esteira + 22 Regras Clean Code? ───────→ audit-verify + clean-code-audit (--stamp-verify)
    │   ├── 2. Dossiê + 2º Portão Goldfish? ──────────→ scripts/review.{mjs,ps1} + egm-goldfish-review (--stamp-review)
    │   └── 3. Commit Cirúrgico (quando ordenado)? ───→ git-workflow-and-versioning (validado por aegis-hook-guard.mjs)
```

---

## ⚖️ 3. Comportamentos Operacionais Inegociáveis (Core Behaviors)

1. **Explicitar Suposições (Surface Assumptions):** Declare premissas antes de trabalhos não-triviais e aguarde validação.
2. **Gerenciamento Ativo de Dúvidas (Manage Confusion Actively):** Ao encontrar inconsistências, pare, aponte o conflito e aguarde resolução.
3. **Discordância Técnica Justificada (Push Back When Warranted):** Aponte riscos técnicos, de latência ou custo excessivo com alternativas claras.
4. **Simplicidade Radical (Enforce Simplicity):** Evite abstrações prematuras. Se 100 linhas resolvem com clareza, 1.000 linhas são um fracasso.
5. **Disciplina de Escopo (Maintain Scope Discipline):** Toque apenas nos arquivos registrados para a fatia/issue aprovada.
6. **Verificar com Fatos (Verify, Don't Assume):** Respalde toda entrega com execução real de testes, `audit-verify` e `review` (2º Goldfish).
7. **Segurança Sintática e Coalescência Explícita:** Em TypeScript/JavaScript, nunca utilize `||` para fallbacks de valores potencialmente falsy — utilize sempre `??` (*Nullish Coalescing*); em qualquer linguagem, execute subprocessos com lista de argumentos (`execFileSync` / `shell=False`) sem interpolação de shell (`CWE-78`).

---

## 🤝 4. Portabilidade Multi-Agente Universal (`Antigravity` / `AWS Kiro` / `Amazon Q` / `Claude Code` / `Codex` / `Cursor` / `Windsurf` / `Copilot`)

- **Projeto:** `{{PROJECT_NAME}}` | **Linguagem Base:** `{{LANGUAGE}}` | **Stack Detectada:** `{{STACK_SUMMARY}}`
- **Domínios Semânticos de Teste:** `{{TEST_DOMAINS}}`
- **Esteira Determinística Multi-OS:** Definida em `harness.config.json` e executada via `node scripts/audit-verify.mjs`.
- **Ponte Nativa Multi-Host:**
  - **Google Antigravity:** Lê `AGENTS.md` + `.agent(s)/rules/*.md`, aplica `.agent(s)/hooks.json` (`aegis-hook-guard.mjs`) e despacha subagentes via `define_subagent` / `invoke_subagent` (`TypeName: "research"` para `🐠 Goldfish` e `TypeName: "slice-executor"` para fatias DAG).
  - **AWS Kiro & Amazon Q Developer:** Leem `AGENTS.md` nativamente na raiz (e opcionalmente `.kiro/steering/` ou `.amazonq/rules/` apontando para a **Seção 0** do `AGENTS.md`), seguindo os módulos `.agent(s)/rules/*.md` e o carimbo determinístico de `aegis-hook-guard.mjs`.
  - **Anthropic Claude Code:** Lê `CLAUDE.md` (que importa `@AGENTS.md`) e despacha `.claude/agents/goldfish-auditor.md` e `.claude/agents/slice-executor.md`.
  - **OpenAI Codex CLI, Cursor, Windsurf, GitHub Copilot & Cline/Roo:** Leem `AGENTS.md` nativamente na raiz, carregam sob demanda os módulos da **Seção 0** e validam os portões via `audit-verify` + `review.mjs`.
