# 📜 Constituição de Governança, Regras de Atuação & Agent Skills — {{PROJECT_NAME}} (Aegis Harness)

Antes de planejar, refatorar ou escrever qualquer código neste repositório, você DEVE ler e obedecer integralmente a este documento (`AGENTS.md`) e à **Tríade Constitucional de Documentação** localizada na pasta `docs/`:

1. **`docs/PRD.md`** — Constituição do produto, modelo de negócio, jornadas críticas de usuário, cotas/limites operacionais, SLAs e regras de privacidade/segurança (LGPD/GDPR).
2. **`docs/ARCHITECTURE.md`** — Decisões técnicas imutáveis (`{{STACK_SUMMARY}}`), topologia de serviços serverless/containers, separação estrita de estado/persistência, contratos de API, telemetria e diagramas sincronizados com o código.
3. **`docs/DIRETRIZES_DOMINIO.md`** *(ou `DIRETRIZES_CRIATIVAS.md` / `DIRETRIZES_EDITORIAIS.md`)* — Regras especialistas do domínio de negócio, parâmetros criativos/estéticos/técnicos, invariantes de qualidade e glossário oficial da Linguagem Ubíqua (DDD).

*(Nota de Unificação Soberana: Todas as regras operacionais, de runtime Serverless & Containers, segurança preventiva Google Mantis, integridade 1:1 de prompts e qualidade web moderna estão unificadas diretamente neste `AGENTS.md`, eliminando a fragmentação em `.agents/rules/`).*

---

## 🛑 1. Regras Críticas de Operação e Governança (20 Leis Inegociáveis)

### 1.1 Proibição Estrita de Proatividade em Commits no GitHub
- **O agente NUNCA deve fazer commits proativamente nem executar `git push` sem comando expresso e inequívoco do usuário.**
- Toda ação de controle de versão (`git commit`, `git push`, criação de branches ou tags) **DEVE aguardar autorização formal do usuário**.

### 1.1.1 Rastreabilidade Obrigatória de Issues nos Commits e Staging Cirúrgico por Issue
- Sempre que o usuário autorizar commits (`git commit`), o agente **DEVE referenciar no assunto do commit a(s) issue(s) implementada(s)** (`<type>(<scope>): <descrição> (closes #<ID>)` ou `(#<ID>)`).
- **Staging Cirúrgico (Proibição de `git add .` / `git add -A`):**
  - Para permitir que conversas paralelas implementem issues diferentes na mesma pasta sem misturar commits, é **terminantemente proibido usar `git add .` ou `git add -A`**.
  - Execute `git add <arq1> <arq2> ...` listando exclusivamente os arquivos pertencentes ao `implementation_plan.md` daquela issue e, após o commit, libere o registro rodando `node scripts/plan-collision.mjs release --issue <ID>` (ou `python scripts/plan-collision.py release --issue <ID>`).

### 1.2 Proibição Estrita de Desenvolvimento Prematuro (Implementação Apenas Sob Demanda Expressa)
- **O agente NUNCA deve iniciar a fase de desenvolvimento (`BUILD`) sem comando expresso do usuário.**
- Enquanto o usuário estiver debatendo ou especificando requisitos, restrinja sua atuação às fases de **DEFINE e PLAN**.

### 1.3 Apresentação Obrigatória de Implementation Plan Antes de Codificar (Isolamento Total & Express Lane Determinística)
- **Isolamento Total na Conversa:** Crie o plano exclusivamente no artefato da conversa (`<appDataDir>/brain/<conversation-id>/implementation_plan.md` com `RequestFeedback: true`). Nunca grave listas transitórias em `tasks/todo.md` ou `tasks/plan.md` no repositório.
- **Cálculo Matemático de Cerimônia (`ceremonyTier: "XS_EXPRESS"` vs. `"FULL_EGM_DAG"` via `node scripts/blast-radius.mjs`):**
  - **Fast-Track Determinístico (`ceremonyTier === "XS_EXPRESS"`):** Quando o `node scripts/blast-radius.mjs <arquivos> --json` comprovar matematicamente `ceremonyTier === "XS_EXPRESS"` (`<= 1` arquivo de produção acompanhado de seus arquivos de teste TDD, `0` consumidores reversos, `riskLevel === "LOW"`, fora do Eixo `B_SECURITY_HARDENING` e sem heterogeneidade Stop-and-Warn), o agente fica **dispensado de invocar subagentes** (`🐠 Goldfish` e `DAG`), mas **mantém estritamente obrigatórios** o ciclo TDD local (Regra 1.6) e a esteira `node scripts/audit-verify.mjs` (Regra 1.7 / 1.16).
  - **Rito Completo (`ceremonyTier === "FULL_EGM_DAG"`):** Para qualquer tarefa fora de `XS_EXPRESS`, o plano deve conter obrigatoriamente os 8 elementos abaixo:
    1. **Objetivo da fatia/tarefa.**
    2. **Arquivos impactados e Radar de Colisão Paralela (`node scripts/plan-collision.mjs register --issue <ID> --files <arq1,arq2>`).**
    3. **Fatiamento vertical (Tasks S/M).**
    4. **Critérios de verificação e testes via TDD.**
    5. **Matriz de Trade-offs Arquiteturais (`## ⚖️ Alternativas Arquiteturais Consideradas — Boost Trade-off Matrix`):** Contrastar pelo menos 2 caminhos viáveis (Opção A vs. Opção B) avaliando Complexidade/Acoplamento, Latência/Performance, Custo Operacional e Risco de Regressão.
    6. **Critérios de Aceite em Formato BDD Gherkin (`Dado... Quando... Então...`) e Espelhamento 1:1 com a Issue do GitHub.**
    7. **Cold Spec Review Pré-Aprovação, Pre-Mortem de Produção & Navalha de Occam (1º Portão EGM Goldfish na Fase `PLAN` — skill `egm-goldfish-review`):**
       - Invocar o subagente **🐠 Goldfish** (`invoke_subagent` com `TypeName: "research"` no Antigravity, `.claude/agents/goldfish-auditor.md` no Claude Code ou `codex exec --sandbox read-only` no OpenAI Codex CLI) passando o caminho de `implementation_plan.md`, o JSON do `blast-radius.mjs` e os arquivos-alvo reais (sem o histórico da conversa).
       - O Goldfish deve responder ao **Pre-Mortem de Produção sob carga** e à **Navalha de Occam** e gerar a tabela `GF-01..N` para aprovação humana (*Default Approve on Proceed*).
    8. **Grafo de Dependências entre Fatias Construído APÓS a Análise Goldfish e Alocação de 100% dos `GF-01..N` nas Slices (`## 🕸️ Grafo de Dependências entre Fatias — DAG Execution Plan` via `dag-slice-orchestrator`):**
       - **Estritamente APÓS concluir o 1º Portão 🐠 Goldfish**, o **🐘 Elephant** DEVE alocar **100% dos achados aprovados `GF-01..N` dentro das fatias (`Slices`)** e consolidar ao final do `implementation_plan.md` o diagrama `mermaid` e a tabela de despacho especificando `Onda`, `depends_on`, `GF-IDs Vinculados`, `Model ("flash" | "inherit" | "pro")`, `Allowed Files Whitelist` (100% disjunta na mesma onda: $\text{Files}(A) \cap \text{Files}(B) = \emptyset$) e comando de teste cirúrgico, aplicando na fase `BUILD` as **5 Travas Anti-Drift** e o Hard Sandbox `plan-collision.mjs snapshot-slice / verify-slice`.

### 1.4 Atualização Mandatória da Tríade Constitucional (`docs/`) Antes da Implementação
- **Gatilho:** Alterações funcionais, novas decisões arquiteturais, mudanças de escopo ou evolução de regras de domínio.
- **Ação:** Atualizar `docs/PRD.md`, `docs/ARCHITECTURE.md` e `docs/DIRETRIZES_DOMINIO.md` ANTES de codificar. Exceção estrita: correções de bugs já especificados.

### 1.5 Travas Inegociáveis de Arquitetura Serverless & Containers e Runtime de Produção
- **1.5.1 Proibição de Processamento Pós-Resposta (Anti-Freeze / CPU Throttling):** Em ambientes Serverless & Containers orientados a requisição, a CPU é congelada após o envio da resposta HTTP. NUNCA execute promessas em background sem `await` (fire-and-forget) nem use `setTimeout`/`setInterval` pós-resposta; delegue tarefas longas a filas/jobs assíncronos dedicados.
- **1.5.2 Proibição de Estado em Memória do Servidor (Stateless & Multi-Instances):** Proibido armazenar estado de negócio, sessões, caches ou locks concorrentes em variáveis globais do processo. Externalize todo estado em Banco de Dados Estruturado/NoSQL, armazenamento local-first (IndexedDB) ou Object Storage.
- **1.5.3 Sistema de Arquivos Efêmero (`/tmp` em RAM):** Prefira streams/buffers em memória; se `/tmp` for indispensável, remova os arquivos obrigatoriamente em bloco `finally`.
- **1.5.4 Host Universal e Porta Dinâmica:** Escutar sempre em `0.0.0.0` e na porta `process.env.PORT ?? 8080`.
- **1.5.5 Tratamento de Desligamento Gracioso (`SIGTERM`):** Registrar handler `SIGTERM` para encerrar conexões e requisições em trânsito com segurança.

### 1.6 Desenvolvimento Estritamente Orientado a Testes (TDD Mandatório em Cada Fatia)
- **Comando:** Executar o ciclo estrito **🔴 RED** (teste falhando) → **🟢 GREEN** (código mínimo) → **🔵 REFACTOR** antes de marcar `[x]` no checklist da conversa (inclusive em tarefas `XS_EXPRESS`).

### 1.7 Prevenção Ativa de Alucinação, Blast Radius e Mini-Auditoria Mandatória
- **1.7.1 Pré-Voo (`Blast Radius`):** Executar `node scripts/blast-radius.mjs <arquivo> --json` antes de alterar contratos ou módulos.
- **1.7.2 Pós-Voo (`Audit Verify`):** Executar `node scripts/audit-verify.mjs` ao finalizar cada tarefa (código de saída deve ser `0`).

### 1.8 Raciocínio Sequencial Profundo (`sequential-thinking` MCP) e Segurança Shift-Left (`mantis-advise`)
- **Raciocínio Sequencial:** Acionar `sequential-thinking` antes de algoritmos complexos, concorrência serverless, remediações CWE ou módulos com `riskLevel: "HIGH"`.
- **Segurança Shift-Left (`mantis-advise`):** Em APIs/Webhooks, Autenticação/Permissões, Persistência multi-tenant, Subprocessos (`CWE-78`: usar `execFileSync` sem shell) ou Pipelines de IA/LLMs (`CWE-74`), acionar `mantis-advise`, consultar `workspace/kb/THREAT_MODEL.md`, validar schemas na borda e emitir o selo: `[Mantis-Advise]: ✔ Modelo de Ameaças Consultado | ✔ Padrões Defensivos Aplicados`.

### 1.9 Governança de Context Caching e Eficiência de Inferência IA
- **Regra:** Gerenciar caches explícitos de LLMs exclusivamente no backend com TTL curto dinâmico (+10 a +20 min) e desalocação garantida em bloco `try ... finally`.

### 1.10 Fidelidade Estrutural 1:1 com o Sistema de Arquivos e Integridade de Prompts (Anti-Ghosting)
- **Regra:** Proibido usar identificadores fictícios ou aliases que não existam fisicamente no disco; validar nomes reais via `fs.existsSync` sem concatenação mágica oculta.

### 1.11 Alerta Preventivo de Heterogeneidade de Escopo & Desmembramento de Issues (5 Eixos)
- **Regra:** Classificar demandas nos Eixos **A (Infra/Cloud)**, **B (Segurança/CWE)**, **C (Domínio/IA)**, **D (UI/UX)** e **E (Persistência/Dados)**. Se cruzar $>2$ eixos não triviais ou misturar Infra (A) com UI/Domínio (`stopAndWarnTriggered: true`), parar e propor issues atômicas (`gh issue create`).

### 1.12 Proibição Estrita de Compatibilidade Zumbi / Dual-Schema
- **Regra:** Ao evoluir um contrato ou schema, remover 100% do formato antigo do código de produção, atualizar os testes e adicionar regra no `ast-grep`.

### 1.13 Governança de Observabilidade, FinOps e Segregação `production` vs. `dev_and_test`
- **Regra:** Rastrear telemetria e custos nos 3 níveis (`Sistema`, `Usuário/Tenant`, `Recurso/Job`) segregados em `invoice_total`, `production`, `failed_and_retries` e `dev_and_test` com flag `is_test_account`.

### 1.14 Governança Semântica de Testes (Anti-Issue Naming)
- **Comando:** Proibido nomear testes com números de issue (`issue-47.test.*`). Organizar por pastas de domínio (`{{TEST_DOMAINS}}`), validado por `node scripts/check-test-naming-governance.mjs`.

### 1.15 Governança Dual E2E e Sincronização de Arquitetura Viva (`Archify`)
- **Regra:** Manter paridade entre suítes E2E automatizadas e fluxos MCP (`chrome-devtools-mcp`), sincronizando os diagramas arquiteturais (`archify`) com o código.

### 1.16 Governança de Dois Ciclos (Inner TDD vs. Outer Precommit), Express Lane (`XS_EXPRESS`) e Orquestração DAG com Hard Sandbox (`dag-slice-orchestrator`)
- **Fast-Track Determinístico (`ceremonyTier === "XS_EXPRESS"`):** Quando `node scripts/blast-radius.mjs <arquivos> --json` retornar `ceremonyTier: "XS_EXPRESS"`, o agente executa diretamente na sessão principal o **Inner Loop TDD** (Regra 1.6) + `node scripts/scan-clean-code.mjs --changed` + **Outer Loop** `node scripts/audit-verify.mjs`, dispensando subagentes `Goldfish` e `slice-executor`.
- **Orquestração DAG por Ondas (`ceremonyTier === "FULL_EGM_DAG"`):** Quando houver múltiplas fatias no grafo DAG, o **🐘 Elephant** despacha subagentes `slice-executor` respeitando a **Matriz de 3 Tiers de Modelo** (`"flash"` / `haiku` / `codex-mini` para `XS/S`; `"inherit"` / `sonnet` / `codex-default` para `M`; `"pro"` / `opus` / `o3-pro` para `HIGH`/Segurança ou *Retry Escalation* após 2 falhas) e aplicando obrigatoriamente o **Hard Sandbox de Whitelist**:
  1. Antes de despachar cada fatia: `node scripts/plan-collision.mjs snapshot-slice --slice <ID> --files "<whitelist>"`
  2. Imediatamente após o retorno do subagente: `node scripts/plan-collision.mjs verify-slice --slice <ID> --revert-unauthorized`
- **Outer Loop Completo:** Rodar `node scripts/audit-verify.mjs` ao concluir o conjunto de fatias da issue.

### 1.17 Recomendação Proativa do Slash Command `/compact`
- **Regra:** Recomendar proativamente o uso de `/compact` ao concluir fatias extensas para preservar a janela de contexto.

### 1.18 Revisão Técnica Sênior Adversarial Pré-Commit — 2º Portão EGM Goldfish (`scan-clean-code.mjs` + `node scripts/review.mjs`)
- Antes de encerrar qualquer implementação em `FULL_EGM_DAG` (seguindo a skill `egm-goldfish-review`):
  1. Executar a auditoria incremental das 22 regras de Clean Code e índice $\text{CRAP}(m) < 10$: `node scripts/scan-clean-code.mjs --changed` (ou `node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --changed`) e corrigir desvios locais;
  2. Extrair o dossiê cirúrgico Multi-OS (que já pré-injeta as cláusulas BDD, o `git diff HEAD --function-context` via `execFileSync` CWE-78-safe e a telemetria AST/CRAP):
     - Com GitHub Issue: `node scripts/review.mjs --issue <ID> --files "<arq1>,<arq2>,..."` (ou no Windows via wrapper `powershell -File .\scripts\review.ps1 -Issue <ID> -Files "<arq1>,<arq2>,..."`);
     - Sem GitHub Issue (via Plano Local): `node scripts/review.mjs --plan <caminho_implementation_plan.md> --files "<arq1>,<arq2>,..."`;
  3. Invocar o subagente **🐠 Goldfish de Implementação** lendo `scratch/review_prompt.md` (ou `scratch/review_prompt_issue_<ID>.md` / `scratch/review_prompt_plan.md`) até obter o veredito estrito **`APROVADO`** (`ACCEPT & FIX via TDD` ou `CONTEST WITH EVIDENCE`), apresentando a tabela final `## 🐠 Relatório Goldfish de Implementação (review.mjs)`.
- **Auditoria Estrutural Global (`node scripts/audit-repo.mjs` / wrapper `scripts/audit-repo.ps1`):** Problemas arquiteturais globais fora da Issue ativa nunca devem ser corrigidos sem rastreabilidade; devem gerar proposta de nova(s) Issue(s) atômica(s) (`gh issue create`).

### 1.19 Governança de Linguagem Ubíqua (DDD Ubiquitous Language) e Portão Determinístico `audit-verify`
- Manter terminologia canônica estrita em código, contratos, UI e documentação conforme definido em `docs/DIRETRIZES_DOMINIO.md`, garantindo aprovação integral na esteira `node scripts/audit-verify.mjs`.

### 1.20 Governança de Qualidade Web, `modern-web-guidance` e Critério de Uso Sob Demanda da `/hallmark`
- **Pilar 1 — Pré-Flight Web Platform (`modern-web-guidance`):** Em tarefas HTML/CSS/DOM/JS client-side, consultar `npx -y modern-web-guidance@latest search "<verbo + primitiva>"` e `retrieve "<guide-id>"`, adotando APIs nativas modernas (`<dialog>`, Popover API, `scrollbar-width` com fallback `@supports`, guarda IME `!e.nativeEvent.isComposing`, `structuredClone()`, `.toSorted()`, `{ cause: err }`) e mantendo `legacy-scan` com `totalFindings: 0`.
- **Pilar 2 — Engenharia de UI Baseada em Evidências:** Acionar `frontend-ui-engineering`, `accessibility` (WCAG 2.2 AA), `core-web-vitals` (LCP, INP, CLS), `performance`, `seo`, `best-practices` e `web-quality-audit`.
- **Pilar 3 — Uso Seletivo Sob Demanda da Skill `/hallmark`:** Nunca aplicar `/hallmark` sobre um design system existente sem pedido explícito; acioná-la (com `sloplint.mjs`) apenas sob demanda para projetar do zero (*greenfield*) Landing Pages, sites institucionais ou Keynotes.

---

## 🧠 2. Ciclo Mandatório de `/using-agent-skills` em TODAS as Chamadas

```
Fluxo de Trabalho por Fase
    │
    ├── 1. DEFINE (Concepção e Alinhamento)
    │   ├── Dúvidas sobre o que o usuário quer? ──────→ interview-me (grill-me)
    │   ├── Conceito bruto precisando de variantes? ──→ idea-refine
    │   └── Requisitos e critérios de aceite? ────────→ spec-driven-development
    │
    ├── 2. PLAN (Planejamento)
    │   ├── Fast-Track XS_EXPRESS ou FULL_EGM_DAG? ───→ node scripts/blast-radius.mjs <arqs> --json
    │   ├── Quebrar a especificação em fatias? ───────→ planning-and-task-breakdown
    │   ├── Nível de qualidade e critérios mínimos? ──→ constraint-driven-development
    │   ├── Segurança preventiva e Threat Model? ─────→ mantis-advise
    │   ├── Cold Spec Review (1º Portão Goldfish)? ───→ egm-goldfish-review + doubt-driven-development
    │   └── Grafo DAG pós-Goldfish e tiers de modelo? → dag-slice-orchestrator
    │
    ├── 3. BUILD (Implementação Cirúrgica)
    │   ├── Hard Sandbox Whitelist por Fatia DAG? ────→ plan-collision.mjs snapshot-slice / verify-slice
    │   ├── Fatias verticais finas e verificáveis? ───→ incremental-implementation + dag-slice-orchestrator
    │   ├── Decisões de alto impacto ou risco? ───────→ doubt-driven-development
    │   ├── Interface, HTML/CSS e JS Client-Side? ────→ modern-web-guidance + frontend-ui-engineering + accessibility + core-web-vitals
    │   ├── Landing Page / Keynote Greenfield (Opt-in)?→ hallmark (sob demanda expressa)
    │   ├── Contratos de API e tipos? ────────────────→ api-and-interface-design
    │   └── Validação em documentação oficial? ───────→ source-driven-development
    │
    ├── 4. VERIFY (Validação Rigorosa)
    │   ├── Ciclo red-green-refactor obrigatório? ────→ test-driven-development
    │   └── Validação em navegador real? ─────────────→ browser-testing-with-devtools
    │
    ├── 5. REVIEW & SHIP (Revisão e Entrega)
    │   ├── Auditoria das 22 regras Clean Code? ──────→ clean-code-audit (node scripts/scan-clean-code.mjs --changed)
    │   ├── Revisão 2º Portão Goldfish (review.mjs)? ─→ egm-goldfish-review + code-review-and-quality
    │   ├── Auditoria de qualidade e padrões web? ────→ modern-web-guidance + web-quality-audit + best-practices + performance + seo
    │   ├── Eliminação de complexidade desnecessária? ─→ code-simplification
    │   ├── Segurança e validação de permissões? ─────→ security-and-hardening + mantis-advise
    │   ├── Desempenho e latência? ───────────────────→ performance-optimization
    │   └── Commits atômicos (quando ordenados)? ─────→ git-workflow-and-versioning
```

---

## ⚖️ 3. Comportamentos Operacionais Inegociáveis (Core Behaviors)

1. **Explicitar Suposições (Surface Assumptions):** Declarar premissas adotadas antes de trabalhos não-triviais e aguardar validação.
2. **Gerenciamento Ativo de Dúvidas (Manage Confusion Actively):** Ao encontrar inconsistências, parar, apontar o conflito e aguardar resolução.
3. **Discordância Técnica Justificada (Push Back When Warranted):** Apontar riscos técnicos, de latência ou custo excessivo com clareza e alternativas.
4. **Simplicidade Radical (Enforce Simplicity):** Evitar abstrações prematuras. Se 100 linhas resolvem com clareza, 1.000 linhas são um fracasso.
5. **Disciplina de Escopo (Maintain Scope Discipline):** Tocar apenas nos arquivos necessários para a fatia aprovada.
6. **Verificar com Fatos (Verify, Don't Assume):** Respaldar toda entrega com execução real de testes e da esteira `audit-verify`.
7. **Segurança Sintática e Coalescência Explícita:** Em TypeScript/JavaScript, nunca utilizar `||` para fallbacks de valores potencialmente falsy — utilizar sempre `??` (*Nullish Coalescing*); em qualquer linguagem, executar subprocessos com array de argumentos (`execFileSync`) sem interpolação de shell (`CWE-78`).

---

## 🤝 4. Portabilidade Multi-Agente (`Antigravity` / `Claude Code` / `OpenAI Codex CLI`) & Parâmetros do Projeto

- **Projeto:** `{{PROJECT_NAME}}` | **Linguagem Base:** `{{LANGUAGE}}` | **Stack Detectada:** `{{STACK_SUMMARY}}`
- **Domínios Semânticos de Teste:** `{{TEST_DOMAINS}}`
- **Esteira Determinística Multi-OS:** Definida em `harness.config.json` e executada via `node scripts/audit-verify.mjs`.
- **Ponte Nativa Multi-Host:**
  - **Google Antigravity:** Lê `AGENTS.md` e despacha subagentes via `define_subagent` / `invoke_subagent` (`TypeName: "research"` para `🐠 Goldfish` e `TypeName: "slice-executor"` para fatias DAG).
  - **Anthropic Claude Code:** Lê `CLAUDE.md` (que importa `@AGENTS.md`) e despacha os subagentes nativos `.claude/agents/goldfish-auditor.md` (somente-leitura) e `.claude/agents/slice-executor.md` (confinado à Whitelist).
  - **OpenAI Codex CLI:** Lê `AGENTS.md` nativamente e despacha processos isolados via `codex exec --sandbox read-only` (para `🐠 Goldfish`) e `codex exec --full-auto` (para fatias DAG).
