# 📜 Constituição de Governança, Regras de Atuação & Agent Skills — {{PROJECT_NAME}} (Aegis Harness)

Antes de planejar, refatorar ou escrever qualquer código neste repositório, você DEVE ler e obedecer integralmente a este documento (`AGENTS.md`) e à **Tríade Constitucional de Documentação** localizada na pasta `docs/`:

1. **`docs/PRD.md`** — Constituição do produto, modelo de negócio, jornadas críticas de usuário, cotas/limites operacionais, SLAs e regras de privacidade/segurança (LGPD/GDPR).
2. **`docs/ARCHITECTURE.md`** — Decisões técnicas imutáveis (`{{STACK_SUMMARY}}`), topologia de serviços serverless/containers, separação estrita de estado/persistência, contratos de API, telemetria e diagramas sincronizados com o código.
3. **`docs/DIRETRIZES_DOMINIO.md`** *(ou `DIRETRIZES_CRIATIVAS.md` / `DIRETRIZES_EDITORIAIS.md`)* — Regras especialistas do domínio de negócio, parâmetros criativos/estéticos/técnicos, invariantes de qualidade e glossário oficial da Linguagem Ubíqua (DDD).

*(Nota de Unificação Soberana: Todas as regras operacionais, de runtime Cloud Run/Serverless, segurança preventiva Google Mantis, integridade 1:1 de prompts e qualidade web moderna estão unificadas diretamente neste `AGENTS.md`, eliminando a fragmentação em `.agents/rules/`).*

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

### 1.3 Apresentação Obrigatória de Implementation Plan Antes de Codificar (Isolamento Total por Artefatos da Conversa)
- **Isolamento Total na Conversa:** Crie o plano exclusivamente no artefato da conversa (`<appDataDir>/brain/<conversation-id>/implementation_plan.md` com `RequestFeedback: true`). Nunca grave listas transitórias em `tasks/todo.md` ou `tasks/plan.md` no repositório.
- O plano deve conter obrigatoriamente:
  1. **Objetivo da fatia/tarefa.**
  2. **Arquivos impactados e Radar de Colisão Paralela (`node scripts/plan-collision.mjs register --issue <ID> --files <arq1,arq2>`).**
  3. **Fatiamento vertical (Tasks S/M).**
  4. **Critérios de verificação e testes via TDD.**
  5. **Matriz de Trade-offs Arquiteturais (`## ⚖️ Alternativas Arquiteturais Consideradas — Boost Trade-off Matrix`):** Contrastar pelo menos 2 caminhos viáveis (Opção A vs. Opção B) avaliando Complexidade/Acoplamento, Latência/Performance, Custo Operacional e Risco de Regressão.
  6. **Critérios de Aceite em Formato BDD Gherkin (`Dado... Quando... Então...`) e Espelhamento 1:1 com a Issue do GitHub.**
  7. **Cold Spec Review Pré-Aprovação, Pre-Mortem de Produção & Navalha de Occam (1º Portão EGM Goldfish na Fase `PLAN` — skill `egm-goldfish-review`):**
     - Invocar subagente **🐠 Goldfish** (`invoke_subagent` com `TypeName: "research"`, `Model: "inherit"`, `Role: "Goldfish Cold Spec Auditor"`) passando o caminho de `implementation_plan.md`, o output do `blast-radius` e os arquivos-alvo reais (sem o histórico da conversa).
     - O Goldfish deve responder obrigatoriamente ao **Pre-Mortem de Produção sob carga** e à **Navalha de Occam** e gerar a tabela `GF-01..N` para aprovação humana (*Default Approve on Proceed*).

### 1.4 Atualização Mandatória da Tríade Constitucional (`docs/`) Antes da Implementação
- Sempre que houver alterações funcionais, novas decisões arquiteturais, mudanças de escopo ou evolução de regras de domínio, o agente **DEVE atualizar formalmente a Tríade Constitucional em `docs/` ANTES de iniciar a implementação do código**:
  1. `docs/PRD.md`
  2. `docs/ARCHITECTURE.md`
  3. `docs/DIRETRIZES_DOMINIO.md` (ou `DIRETRIZES_CRIATIVAS.md` / `DIRETRIZES_EDITORIAIS.md`)
- **Exceção Estrita para Correções de BUGS:** Correções de defeitos técnicos já especificados na documentação não exigem atualização prévia na pasta `docs/`.

### 1.5 Travas Inegociáveis de Arquitetura Serverless, Cloud Run & Runtime de Produção
- **1.5.1 Proibição de Processamento Pós-Resposta (Anti-Freeze / CPU Throttling):** No Cloud Run, a CPU é congelada após o envio da resposta HTTP. NUNCA execute promessas em background sem `await` (fire-and-forget) nem use `setTimeout`/`setInterval` pós-resposta. Delegue tarefas longas a filas/jobs assíncronos (Cloud Tasks / Cloud Run Jobs).
- **1.5.2 Proibição de Estado em Memória do Servidor (Stateless & Multi-Instances):** É proibido armazenar estado de negócio, sessões, caches ou locks concorrentes em variáveis globais do processo. Externalize todo estado em banco estruturado (ex.: Firestore/PostgreSQL), armazenamento local-first (IndexedDB) ou Object Storage (GCS/S3).
- **1.5.3 Sistema de Arquivos Efêmero (`/tmp` em RAM):** Gere artefatos como streams/buffers em memória. Quando o uso de `/tmp` for indispensável para processamento intermediário, remova os arquivos obrigatoriamente em bloco `finally`.
- **1.5.4 Host Universal e Porta Dinâmica:** Escutar sempre em `0.0.0.0` e na porta `process.env.PORT ?? 8080` (sem portas estáticas fixadas em produção).
- **1.5.5 Tratamento de Desligamento Gracioso (`SIGTERM`):** Registrar handler `SIGTERM` para encerrar conexões e requisições em trânsito com segurança dentro da janela de scale-down.

### 1.6 Desenvolvimento Estritamente Orientado a Testes (TDD Mandatório em Cada Fatia)
- Executar o ciclo estrito **🔴 RED** (teste falhando) → **🟢 GREEN** (código mínimo) → **🔵 REFACTOR** antes de marcar `[x]` no checklist da conversa.

### 1.7 Prevenção Ativa de Alucinação, Blast Radius e Mini-Auditoria Mandatória
- **1.7.1 Análise Pré-Voo de Blast Radius:** Executar `node scripts/blast-radius.mjs <arquivo> --json` (ou `python scripts/blast-radius.py <arquivo> --json`) antes de alterar contratos ou módulos centrais.
- **1.7.2 Mini-Auditoria Pós-Voo Contínua:** Executar `node scripts/audit-verify.mjs` (ou `python scripts/audit-verify.py`) ao finalizar cada tarefa (código de saída deve ser `0`).

### 1.8 Protocolo de Raciocínio Sequencial Profundo (`sequential-thinking` MCP) e Segurança Shift-Left (`mantis-advise`)
- **Raciocínio Sequencial (`sequential-thinking`):** Acionar obrigatoriamente antes de codificar algoritmos complexos, concorrência serverless, remediações de segurança (CWEs) ou módulos com risco `HIGH` no Blast Radius.
- **Segurança Preventiva Shift-Left (`mantis-advise`):** Sempre que o planejamento ou código envolver (1) APIs/Endpoints HTTP ou Webhooks, (2) Autenticação/Sessão/Permissões, (3) Regras de Persistência/Storage multi-tenant ou (4) Pipelines de IA/LLMs (prevenção de *Prompt Injection* CWE-74 e isolamento de envelopes XML), o agente **DEVE** acionar a skill `mantis-advise`, consultar `workspace/kb/THREAT_MODEL.md` e `workspace/historical_learnings.jsonl` (quando existentes), aplicar validação estrita de schema na borda (Zod/Pydantic) sem vazar stacktraces e incluir no fechamento o selo:
  `[Mantis-Advise]: ✔ Modelo de Ameaças Consultado | ✔ Padrões Defensivos Aplicados`.

### 1.9 Governança de Context Caching e Eficiência de Inferência IA
- Em projetos que consomem LLMs, gerenciar caches explícitos exclusivamente no backend com TTL curto dinâmico (+10 a +20 min) e desalocação garantida em bloco `try ... finally`.

### 1.10 Fidelidade Estrutural 1:1 com o Sistema de Arquivos e Integridade de Prompts (Anti-Ghosting)
- É terminantemente proibido utilizar identificadores fictícios, aliases mágicos ou nomes de arquivos/prompts legados que não existam fisicamente no disco.
- Todo contrato tipado e função de carregamento de prompts/templates deve refletir 1:1 os nomes físicos reais no sistema de arquivos (ex.: sufixo `_common.md` para templates modulares), verificáveis diretamente via `fs.existsSync` sem truques ocultos de concatenação de strings.

### 1.11 Alerta Preventivo de Heterogeneidade de Escopo & Desmembramento Mandatório de Issues (5 Eixos)
- Classificar demandas nos 5 Eixos: **A (Infra/Cloud)**, **B (Segurança/CWE)**, **C (Domínio/Motores IA)**, **D (UI/Experiência)** e **E (Persistência/Dados)**.
- **Gatilho Stop-and-Warn:** Se a issue cruzar mais de 2 eixos não triviais ou misturar Infra Pesada (A) com UI/Domínio, parar imediatamente e propor a abertura de novas issues atômicas (`gh issue create`).

### 1.12 Proibição Estrita de Compatibilidade Zumbi / Dual-Schema
- Quando um contrato, propriedade ou schema evoluir, remover 100% do formato antigo do código de produção, atualizar os testes e adicionar regra no `ast-grep`.

### 1.13 Governança de Observabilidade, FinOps e Segregação `production` vs. `dev_and_test`
- Rastrear telemetria e custos nos 3 níveis (`Sistema`, `Usuário/Tenant` e `Recurso/Job`) com fechamento mensal (`months/{YYYY-MM}`) segregado em 4 visões financeiras (`invoice_total`, `production`, `failed_and_retries`, `dev_and_test`) e flag explícita `is_test_account`.

### 1.14 Governança Semântica de Testes (Anti-Issue Naming)
- Proibido nomear arquivos de teste com identificadores efêmeros (`issue-47.test.*`, `test_issue_12.py`). Organizar estritamente por pastas de domínio (`{{TEST_DOMAINS}}`), validado por `check-test-naming-governance`.

### 1.15 Governança Dual E2E e Sincronização de Arquitetura Viva (`Archify`)
- Manter paridade entre suítes E2E automatizadas e fluxos interativos MCP (`chrome-devtools-mcp`), mantendo os diagramas e o grafo arquitetural (`archify`) sincronizados com o código.

### 1.16 Governança de Dois Ciclos de Engenharia (Two-Cycle Workflow: Inner TDD vs. Outer Precommit)
- **Inner Loop Cirúrgico:** Rodar apenas os testes unitários do domínio impactado durante o TDD.
- **Outer Loop Completo:** Rodar `node scripts/audit-verify.mjs` (ou `python scripts/audit-verify.py`) ao concluir o conjunto de fatias da issue.

### 1.17 Recomendação Proativa do Slash Command `/compact`
- Recomendar proativamente o uso de `/compact` ao concluir fatias extensas para preservar a janela de contexto.

### 1.18 Revisão Técnica Sênior Adversarial Pré-Commit — 2º Portão EGM Goldfish (`clean-code-audit --changed` + `scripts/review.ps1`)
- Antes de encerrar qualquer implementação (seguindo a skill `egm-goldfish-review`):
  1. Executar a auditoria incremental das 22 regras de Clean Code (`node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --changed`) e corrigir desvios locais;
  2. Executar `powershell -File .\scripts\review.ps1 -Issue <ID> -Files "<arq1>,<arq2>,..."` e invocar o subagente **🐠 Goldfish de Implementação** (`TypeName: "research"`, `Model: "inherit"`, Low Thinking) lendo `scratch/review_prompt_issue_<ID>.md` até obter o veredito estrito **`APROVADO`** (resolvendo bugs via `ACCEPT & FIX via TDD` ou protegendo pedidos explícitos do usuário via `CONTEST WITH EVIDENCE`), apresentando a tabela final `## 🐠 Relatório Goldfish de Implementação (review.ps1)`.
- **Auditoria Estrutural Global (`scripts/audit-repo.ps1`):** Problemas arquiteturais globais fora da Issue ativa nunca devem ser corrigidos sem rastreabilidade; devem gerar proposta de nova(s) Issue(s) atômica(s) (`gh issue create`).

### 1.19 Governança de Linguagem Ubíqua (DDD Ubiquitous Language)
- Manter terminologia canônica estrita em código, contratos, UI e documentação conforme definido em `docs/DIRETRIZES_DOMINIO.md`, expurgando termos legados depreciados.

### 1.20 Governança de Qualidade Web, `modern-web-guidance` e Critério de Uso Sob Demanda da `/hallmark`
- **Pilar 1 — Pré-Flight Web Platform (`modern-web-guidance`):** Em toda tarefa que crie ou altere HTML, CSS, DOM ou JS client-side, consultar primeiro `npx -y modern-web-guidance@latest search "<verbo + primitiva>"` e `retrieve "<guide-id>"`, adotando APIs nativas modernas (`<dialog>`, Popover API, `scrollbar-width` com fallback `@supports`, guarda IME `!e.nativeEvent.isComposing`, `structuredClone()`, `.toSorted()`, `{ cause: err }`) e mantendo `npx -y modern-web-guidance@latest legacy-scan <dir> --json` com `totalFindings: 0`.
- **Pilar 2 — Engenharia de UI & Qualidade Baseada em Evidências:** Acionar em conjunto `frontend-ui-engineering`, `accessibility` (WCAG 2.2 AA), `core-web-vitals` (LCP, INP, CLS), `performance`, `seo`, `best-practices` e `web-quality-audit`.
- **Pilar 3 — Uso Seletivo Sob Demanda da Skill `/hallmark`:** Para telas de produto, dashboards e refatorações em sistemas existentes, utilizar estritamente os Pilares 1 e 2 acima (nunca aplicar `/hallmark` sobre um design system existente sem pedido explícito). Acionar a skill `/hallmark` (e seu linter determinístico `sloplint.mjs`) **sob demanda** quando o objetivo for projetar do zero (*greenfield*) uma **Landing Page comercial, site institucional ou Keynote/Deck executivo** com assinatura visual editorial.

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
    │   ├── Quebrar a especificação em fatias? ───────→ planning-and-task-breakdown
    │   ├── Nível de qualidade e critérios mínimos? ──→ constraint-driven-development
    │   ├── Segurança preventiva e Threat Model? ─────→ mantis-advise
    │   └── Cold Spec Review (1º Portão Goldfish)? ───→ egm-goldfish-review + doubt-driven-development
    │
    ├── 3. BUILD (Implementação Cirúrgica)
    │   ├── Fatias verticais finas e verificáveis? ───→ incremental-implementation
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
    │   ├── Auditoria das 22 regras Clean Code? ──────→ clean-code-audit
    │   ├── Revisão 2º Portão Goldfish (review.ps1)? ─→ egm-goldfish-review + code-review-and-quality
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
7. **Segurança Sintática e Coalescência Explícita:** Em TypeScript/JavaScript, nunca utilizar `||` para fallbacks de valores potencialmente falsy — utilizar sempre `??` (*Nullish Coalescing*); em Python/Go/Rust, utilizar tipagem estrita e execução segura de subprocessos sem `shell=True`.

---

## 🏛️ 4. Parâmetros Tecnológicos Detectados pelo Harness

- **Projeto:** `{{PROJECT_NAME}}`
- **Linguagem Base:** `{{LANGUAGE}}`
- **Stack Detectada:** `{{STACK_SUMMARY}}`
- **Domínios Semânticos de Teste:** `{{TEST_DOMAINS}}`
- **Configuração da Esteira Determinística:** Definida em `harness.config.json` e executada via `node scripts/audit-verify.mjs` (ou `python scripts/audit-verify.py`).
