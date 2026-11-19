---
name: egm-goldfish-review
description: Protocolo oficial do Padrão EGM (Elephant-Goldfish Model) para Revisão Adversarial em Duplo Portão (1º Portão Cold Spec Review na fase PLAN com Pre-Mortem e Navalha de Occam, Express Lane determinística XS_EXPRESS vs. FULL_EGM_DAG, e 2º Portão Goldfish de Implementação na fase REVIEW via node scripts/review.mjs com injeção AST/CRAP e resolução autônoma ACCEPT & FIX vs. CONTEST WITH EVIDENCE). Use ao finalizar qualquer implementation_plan.md ou ao concluir a implementação de uma Issue antes de entregar ao usuário.
---

# 🐘🐠 Padrão EGM (Elephant-Goldfish Model) — Revisão Adversarial em Duplo Portão

Esta skill codifica o protocolo operacional completo da separação cognitiva entre o agente executor que acumula contexto da sessão (**🐘 Elephant**) e o subagente auditor invocado com zero histórico da conversa (**🐠 Goldfish**), com suporte nativo Multi-OS (`node scripts/review.mjs`) e Multi-Host (`Antigravity`, `Claude Code` e `OpenAI Codex CLI`).

---

## 🎯 1. Por que Separar Elephant de Goldfish?

1. **O Viés do 🐘 Elephant (Sessão Principal com Contexto):**
   - Acumula dezenas de turnos de conversa, negociações de escopo e tentativas de código.
   - Sofre naturalmente de *viés de autoconfirmação (self-review bias)*: tende a justificar atalhos e aprovar o próprio plano ou diff.
2. **A Frieza do 🐠 Goldfish (Subagente Somente-Leitura com Zero Contexto):**
   - É invocado recebendo **exclusivamente fatos brutos** (o plano ou o diff real com funções completas, a telemetria AST/CRAP pré-injetada pelo `scan-clean-code.mjs`, o output do `blast-radius`, a Issue oficial do GitHub ou plano local e os arquivos-alvo), sem o histórico do chat.
   - Tem como missão encontrar falhas lógicas, quebras de contrato, violações de Clean Code, vulnerabilidades CWE e omissões de testes BDD.

---

## ⚡ 1.1 Express Lane Determinística (`ceremonyTier: "XS_EXPRESS"` vs. `"FULL_EGM_DAG"`) (`GF-03`, `GF-05`)

Para eliminar o imposto de latência em alterações triviais sem depender de julgamento subjetivo do LLM, o script `node scripts/blast-radius.mjs <arquivos> --json` calcula matematicamente o campo `ceremonyTier`:

- **`ceremonyTier === "XS_EXPRESS"` (Fast-Track Determinístico TDD-Safe):**
  - Emitido **somente quando** a mudança toca `<= 1` arquivo de produção acompanhado opcionalmente de seu(s) arquivo(s) de teste unitário (`.test.*` / `.spec.*` — preservando a Regra 1.6 TDD), possui `0` consumidores reversos (`totalConsumers === 0`), apresenta `riskLevel === "LOW"`, não pertence ao Eixo `B_SECURITY_HARDENING` e não aciona o gatilho `stopAndWarnTriggered`.
  - **Rito `XS_EXPRESS`:** Dispensa a invocação de subagentes (`🐠 Goldfish` nos Portões 1 e 2 e `slice-executor` do DAG), mas **mantém estritamente obrigatórios** o ciclo TDD local (🔴 RED $\rightarrow$ 🟢 GREEN $\rightarrow$ 🔵 REFACTOR), o scanner `node scripts/scan-clean-code.mjs --changed` e a esteira `node scripts/audit-verify.mjs`.
- **`ceremonyTier === "FULL_EGM_DAG"` (Rito Completo em Duplo Portão):**
  - Emitido automaticamente quando há $2+$ arquivos de produção, consumidores reversos ($>0$), risco `MEDIUM`/`HIGH` ou Eixo `B_SECURITY_HARDENING`. Exige obrigatoriamente o **1º Portão Cold Spec Review**, a alocação no **Grafo DAG** e o **2º Portão Goldfish de Implementação**.

---

## 🤝 1.2 Matriz de Despacho Multi-Host (`Antigravity` vs. `Claude Code` vs. `OpenAI Codex CLI`)

| Portão / Papel | **Google Antigravity** | **Anthropic Claude Code** | **OpenAI Codex CLI** |
| :--- | :--- | :--- | :--- |
| **1º Portão — Cold Spec Auditor (`PLAN`)** | `invoke_subagent(TypeName: "research", Model: "inherit", Role: "Goldfish Cold Spec Auditor")` | Subagente nativo `.claude/agents/goldfish-auditor.md` via tool `Task` / `Agent` (`subagent_type: "goldfish-auditor"`) | `codex exec --sandbox read-only "Audite implementation_plan.md conforme egm-goldfish-review (Portão 1)"` |
| **2º Portão — Goldfish de Implementação (`REVIEW`)** | `invoke_subagent(TypeName: "research", Model: "inherit", Role: "Revisor Tecnico Senior - EGM Goldfish")` lendo `scratch/review_prompt.md` | Subagente `.claude/agents/goldfish-auditor.md` via tool `Task` / `Agent` lendo `scratch/review_prompt.md` | `codex exec --sandbox read-only "Leia scratch/review_prompt.md e emita veredito APROVADO ou REPROVADO nos 4 Eixos"` |

---

## 🛡️ 2. O 1º Portão: Cold Spec Review na Fase `PLAN` (Regra 1.3.7)

### Quando Acionar
Sempre que `node scripts/blast-radius.mjs <arquivos> --json` retornar `ceremonyTier: "FULL_EGM_DAG"`.

### Passo a Passo de Execução (Fase `PLAN`)
1. **Preparação pelo 🐘 Elephant:**
   - Executar `node scripts/blast-radius.mjs <arquivos> --json` e `node scripts/plan-collision.mjs register --issue <ID> --files <csv>`.
   - Elaborar o `implementation_plan.md` contendo a **Boost Trade-off Matrix (`Opção A vs. Opção B`)** e os cenários **BDD Gherkin (`Dado / Quando / Então`)** espelhados 1:1 com a Issue.
2. **Invocação do 🐠 Goldfish Cold Spec Auditor:**
   - Despachar o subagente conforme a **Matriz Multi-Host (Seção 1.2)** passando exclusivamente:
     - O caminho absoluto do `implementation_plan.md`;
     - O output do `blast-radius.mjs`;
     - A lista de arquivos-alvo reais no disco para leitura;
     - A exigência de responder obrigatoriamente às **Duas Provocações Boost**:
       1. **Pre-Mortem de Produção:** *"Se esta implementação falhar em produção sob carga (ex.: race condition, CPU throttling pós-resposta serverless, estouro de memória em `/tmp`, Command Injection CWE-78 ou falha de streaming/webhook), qual será a linha ou causa raiz mais provável?"*
       2. **Navalha de Occam (Simplificação Radical):** *"Existe uma forma de entregar exatamente o mesmo comportamento com menos código, menos estado ou menos acoplamento?"*
3. **Trava Anti-Inferência Silenciosa & Tabela `GF-01..N`:**
   - O **🐘 Elephant NUNCA altera silenciosamente o pedido do usuário** por conta própria.
   - Ele anexa ao `implementation_plan.md` (e resume no chat) a tabela padronizada:

```markdown
## 🐠 Relatório Cold Spec Review (EGM Goldfish)

| ID | Categoria | Achado do 🐠 Goldfish (Zero Contexto) | Análise do 🐘 Elephant (Com Contexto) | Status para Aprovação |
| :--- | :--- | :--- | :--- | :--- |
| **GF-01** | Serverless / Runtime | ... | ✅ Recomendado — ... | Aprovado por padrão (Proceed) |
| **GF-02** | Testes / BDD | ... | ✅ Recomendado — ... | Aprovado por padrão (Proceed) |
| **GF-03** | Escopo / Negócio | ... | ⚠️ Conflita com o pedido — ... | Rejeitado salvo ordem em contrário |
```

4. **Regra Default Approve on Proceed:**
   - Quando o usuário aprovar o `implementation_plan.md` sem ressalvas, todas as sugestões recomendadas (`✅ Recomendado`) consideram-se automaticamente aprovadas, devendo ser alocadas nas fatias do Grafo DAG (`dag-slice-orchestrator`) e implementadas via TDD.

---

## 🔬 3. O 2º Portão: Goldfish de Implementação na Fase `REVIEW` (Regra 1.18)

### Pré-Requisito Obrigatório Antes do `review.mjs`
1. Executar a auditoria incremental das 22 regras de Clean Code:
   - `node scripts/scan-clean-code.mjs --changed` (ou `node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --changed`)
2. Corrigir imediatamente os desvios (`🟢 Quick Wins` e `🟡 Refatorações Locais`) e rodar a esteira determinística (`node scripts/audit-verify.mjs`).

### Extração do Dossiê Cirúrgico Multi-OS (`node scripts/review.mjs`)
Executar em qualquer sistema operacional (Windows, Linux, macOS ou CI) passando `--issue` ou `--plan` e a lista restrita `--files` do plano:
```bash
# Modo 1 — Vinculado a uma Issue do GitHub:
node scripts/review.mjs --issue <ID> --files "<arq1>,<arq2>,..."

# Modo 2 — Vinculado a um implementation_plan.md local (projetos sem GitHub Issues):
node scripts/review.mjs --plan <caminho_plano> --files "<arq1>,<arq2>,..."
```
*(No Windows, `powershell -File .\scripts\review.ps1 -Issue <ID> -Files "<arq1>,<arq2>,..."` delega automaticamente para `review.mjs` via `Join-Path $PSScriptRoot "review.mjs"`).*

O motor `review.mjs` extrai de forma 100% blindada contra Command Injection (`CWE-78` via `execFileSync` sem shell):
- Os requisitos e cláusulas BDD Gherkin da Issue (`gh issue view`) ou do plano local (`--plan`);
- A lista de até 30 issues abertas (`gh issue list --state open`) quando disponível, para blindagem contra alucinação de escopo;
- A **telemetria determinística AST/CRAP pré-injetada** do `scan-clean-code.mjs` sobre os arquivos alterados (eliminando o ponto cego semântico de mesma família de modelo);
- O `git diff HEAD --function-context` restrito aos arquivos da entrega, gravando `scratch/review_prompt.md` e adicionalmente `scratch/review_prompt_issue_<ID>.md` (modo `--issue`) ou `scratch/review_prompt_plan.md` (modo `--plan`).

### Invocação do Subagente Revisor e Os 4 Eixos Inegociáveis
Despachar o auditor **🐠 Goldfish** conforme a **Matriz Multi-Host (Seção 1.2)** instruindo avaliação estrita nos 4 Eixos:
1. **Eixo 1 — Rastreabilidade BDD 1:1 & Anti-Mock Oco:** Cada cláusula `Então` possui asserção real nos testes do Diff? (Rejeitar testes tautológicos que só testam o próprio mock).
2. **Eixo 2 — Zero Spec Drift & Regra 1.12:** Fidelidade 100% aos contratos especificados e zero compatibilidade zumbi/dual-schema (`novo ?? antigo`).
3. **Eixo 3 — Segurança Serverless, Subprocessos (`CWE-78`) & Tipagem:** Zero promessas sem `await` pós-resposta HTTP, zero estado mutável em memória global, limpeza `finally` de `/tmp`, uso de `execFileSync` sem shell interpolation e uso estrito de `??` sobre `||`.
4. **Eixo 4 — Simulação de Execução Mental & Telemetria AST/CRAP:** Simulação linha a linha das funções completas do Diff cruzada com o relatório pré-injetado do `scan-clean-code.mjs` ($\text{CRAP}(m) < 10$), buscando bugs lógicos, *race conditions* ou crashes em casos de borda.

### Loop Autônomo de Resolução (Compatível com `/goal`)
Caso o Goldfish aponte problemas antes de emitir `APROVADO`, o **🐘 Elephant** classifica e age imediatamente:
- **`✅ ACCEPT & FIX via TDD` (Defeito Técnico Real):** Se for falha de teste BDD, tipagem, Clean Code, Serverless ou bug de borda, o Elephant escreve o teste falhando (🔴 RED), corrige o código (🟢 GREEN), roda `node scripts/review.mjs` novamente e re-submete ao Goldfish.
- **`🛡️ CONTEST WITH EVIDENCE` (Proteção do Pedido do Usuário):** Se o Goldfish (sem contexto) cobrar algo que contradiz uma decisão explícita do usuário ou de outra issue do roadmap, o Elephant **nunca desfaz o pedido do usuário**: na re-submissão, apresenta a evidência formal do requisito aprovado para que o Goldfish valide os demais eixos e emita **`APROVADO`**.

### Tabela Obrigatória no Relatório Final de Entrega
Ao obter **`APROVADO`**, incluir na resposta final ao usuário:

```markdown
## 🐠 Relatório Goldfish de Implementação (`review.mjs`)
- **Veredito Final:** `APROVADO`
- **Resumo dos Apontamentos e Resoluções:**
  - `[Categoria]`: Descrição -> `✅ Corrigido via TDD` (ou `🛡️ Contestado — Preservado Pedido do Usuário`).
```

---

## 🏗️ 4. Auditoria Estrutural Global Multi-OS (`node scripts/audit-repo.mjs`)

- O comando `node scripts/audit-repo.mjs` (ou wrapper Windows `powershell -File .\scripts\audit-repo.ps1`) realiza um *health check* arquitetural do repositório inteiro e gera o dossiê `scratch/audit_prompt.md`.
- **Regra Inegociável de Rastreabilidade:** Problemas estruturais encontrados pelo `audit-repo.mjs` **NUNCA devem ser alterados diretamente no código sem rastreabilidade** — o agente deve apresentar o diagnóstico ao usuário e propor a abertura de **novas Issues atômicas no GitHub (`gh issue create`)**, separadas pelos 5 Eixos (Regra 1.11) e com cenários BDD Gherkin (Regra 1.3).
