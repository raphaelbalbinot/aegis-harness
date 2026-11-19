---
name: egm-goldfish-review
description: Protocolo oficial do Padrão EGM (Elephant-Goldfish Model) para Revisão Adversarial em Duplo Portão (1º Portão Cold Spec Review na fase PLAN com Pre-Mortem e Navalha de Occam, e 2º Portão Goldfish de Implementação na fase REVIEW via scripts/review.ps1 com resolução autônoma ACCEPT & FIX vs. CONTEST WITH EVIDENCE). Use ao finalizar qualquer implementation_plan.md ou ao concluir a implementação de uma Issue antes de entregar ao usuário.
---

# 🐘🐠 Padrão EGM (Elephant-Goldfish Model) — Revisão Adversarial em Duplo Portão

Esta skill codifica o protocolo operacional completo da separação cognitiva entre o agente executor que acumula contexto da sessão (**🐘 Elephant**) e o subagente auditor invocado com zero histórico da conversa (**🐠 Goldfish**).

---

## 🎯 1. Por que Separar Elephant de Goldfish?

1. **O Viés do 🐘 Elephant (Sessão Principal com Contexto):**
   - Acumula dezenas de turnos de conversa, negociações de escopo e tentativas de código.
   - Sofre naturalmente de *viés de autoconfirmação (self-review bias)*: tende a justificar atalhos e aprovar o próprio plano ou diff.
2. **A Frieza do 🐠 Goldfish (Subagente `research` com Zero Contexto):**
   - É invocado via `invoke_subagent` (`TypeName: "research"`, `Model: "inherit"`) recebendo **exclusivamente fatos brutos** (o plano ou o diff real com funções completas, o output do `blast-radius`, a Issue oficial do GitHub e os arquivos-alvo), sem o histórico do chat.
   - Tem como missão encontrar falhas lógicas, quebras de contrato, violações de Clean Code, vulnerabilidades CWE e omissões de testes BDD.

---

## 🛡️ 2. O 1º Portão: Cold Spec Review na Fase `PLAN` (Regra 1.3.7)

### Quando Acionar
Sempre que a tarefa envolver múltiplos arquivos, cruzar eixos da Regra 1.11 ou apresentar risco `MEDIUM` / `HIGH` no `blast-radius`.

### Passo a Passo de Execução (Fase `PLAN`)
1. **Preparação pelo 🐘 Elephant:**
   - Executar `blast-radius` e `plan-collision register`.
   - Elaborar o `implementation_plan.md` contendo a **Boost Trade-off Matrix (`Opção A vs. Opção B`)** e os cenários **BDD Gherkin (`Dado / Quando / Então`)** espelhados 1:1 com a Issue.
2. **Invocação do 🐠 Goldfish Cold Spec Auditor:**
   - Chamar `invoke_subagent` com:
     - `TypeName: "research"`
     - `Model: "inherit"`
     - `Role: "Goldfish Cold Spec Auditor"`
   - Passar no `Prompt`:
     - O caminho absoluto do `implementation_plan.md`;
     - O output do `blast-radius`;
     - A lista de arquivos-alvo reais no disco para leitura;
     - A exigência de responder obrigatoriamente às **Duas Provocações Boost**:
       1. **Pre-Mortem de Produção:** *"Se esta implementação falhar em produção sob carga (ex.: race condition, CPU throttling pós-resposta no Cloud Run, estouro de memória em `/tmp` ou falha de streaming/webhook), qual será a linha ou causa raiz mais provável?"*
       2. **Navalha de Occam (Simplificação Radical):** *"Existe uma forma de entregar exatamente o mesmo comportamento com menos código, menos estado ou menos acoplamento?"*
3. **Trava Anti-Inferência Silenciosa & Tabela `GF-01..N`:**
   - O **🐘 Elephant NUNCA altera silenciosamente o pedido do usuário** por conta própria.
   - Ele anexa ao `implementation_plan.md` (e resume no chat) a tabela padronizada:

```markdown
## 🐠 Relatório Cold Spec Review (EGM Goldfish)

| ID | Categoria | Achado do 🐠 Goldfish (Zero Contexto) | Análise do 🐘 Elephant (Com Contexto) | Status para Aprovação |
| :--- | :--- | :--- | :--- | :--- |
| **GF-01** | Cloud Run / Serverless | ... | ✅ Recomendado — ... | Aprovado por padrão (Proceed) |
| **GF-02** | Testes / BDD | ... | ✅ Recomendado — ... | Aprovado por padrão (Proceed) |
| **GF-03** | Escopo / Negócio | ... | ⚠️ Conflita com o pedido — ... | Rejeitado salvo ordem em contrário |
```

4. **Regra Default Approve on Proceed:**
   - Quando o usuário aprovar o `implementation_plan.md` sem ressalvas, todas as sugestões recomendadas (`✅ Recomendado`) consideram-se automaticamente aprovadas, devendo ser sincronizadas na Issue do GitHub (`gh issue edit <ID>`) e implementadas via TDD.

---

## 🔬 3. O 2º Portão: Goldfish de Implementação na Fase `REVIEW` (Regra 1.18)

### Pré-Requisito Obrigatório Antes do `review.ps1`
1. Executar a auditoria incremental das 22 regras de Clean Code:
   - `node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --changed` (ou `npm run audit:clean-code -- --changed`)
2. Corrigir imediatamente os desvios (`🟢 Quick Wins` e `🟡 Refatorações Locais`) e rodar a esteira determinística (`audit-verify`).

### Extração do Dossiê Cirúrgico (`scripts/review.ps1`)
Executar sempre passando `-Issue` e a lista restrita `-Files` do plano:
```powershell
powershell -File .\scripts\review.ps1 -Issue <ID> -Files "<arq1>,<arq2>,..."
```
O script extrai automaticamente:
- Os requisitos e cláusulas BDD Gherkin da Issue (`gh issue view`);
- A lista de até 30 issues abertas (`gh issue list --state open`) para blindagem contra alucinação de escopo;
- O `git diff HEAD --function-context` restrito aos arquivos da Issue, salvando em `scratch/review_prompt_issue_<ID>.md`.

### Invocação do Subagente Revisor e Os 4 Eixos Inegociáveis
Invocar `invoke_subagent` (`TypeName: "research"`, `Model: "inherit"`, `Role: "Revisor Tecnico Senior - EGM Goldfish"`) instruindo avaliação estrita nos 4 Eixos:
1. **Eixo 1 — Rastreabilidade BDD 1:1 & Anti-Mock Oco:** Cada cláusula `Então` possui asserção real nos testes do Diff? (Rejeitar testes tautológicos que só testam o próprio mock).
2. **Eixo 2 — Zero Spec Drift & Regra 1.12:** Fidelidade 100% aos contratos especificados e zero compatibilidade zumbi/dual-schema (`novo ?? antigo`).
3. **Eixo 3 — Segurança Serverless, Subprocessos & Tipagem:** Zero promessas sem `await` pós-resposta HTTP, zero estado mutável em memória global, limpeza `finally` de `/tmp` e uso estrito de `??` sobre `||`.
4. **Eixo 4 — Simulação de Execução Mental:** Simulação linha a linha das funções completas do Diff buscando bugs lógicos, *race conditions* ou crashes em casos de borda.

### Loop Autônomo de Resolução (Compatível com `/goal`)
Caso o Goldfish aponte problemas antes de emitir `APROVADO`, o **🐘 Elephant** classifica e age imediatamente:
- **`✅ ACCEPT & FIX via TDD` (Defeito Técnico Real):** Se for falha de teste BDD, tipagem, Clean Code, Serverless ou bug de borda, o Elephant escreve o teste falhando (🔴 RED), corrige o código (🟢 GREEN), roda `review.ps1` novamente e re-submete ao Goldfish.
- **`🛡️ CONTEST WITH EVIDENCE` (Proteção do Pedido do Usuário):** Se o Goldfish (sem contexto) cobrar algo que contradiz uma decisão explícita do usuário ou de outra issue do roadmap, o Elephant **nunca desfaz o pedido do usuário**: na re-submissão, apresenta a evidência formal do requisito aprovado para que o Goldfish valide os demais eixos e emita **`APROVADO`**.

### Tabela Obrigatória no Relatório Final de Entrega
Ao obter **`APROVADO`**, incluir na resposta final ao usuário:

```markdown
## 🐠 Relatório Goldfish de Implementação (`review.ps1`)
- **Veredito Final:** `APROVADO`
- **Resumo dos Apontamentos e Resoluções:**
  - `[Categoria]`: Descrição -> `✅ Corrigido via TDD` (ou `🛡️ Contestado — Preservado Pedido do Usuário`).
```

---

## 🏗️ 4. Auditoria Estrutural Global (`scripts/audit-repo.ps1`)

- O script `powershell -File .\scripts\audit-repo.ps1` realiza um *health check* arquitetural do repositório inteiro (`scratch/audit_prompt.md`).
- **Regra Inegociável de Rastreabilidade:** Problemas estruturais encontrados pelo `audit-repo.ps1` **NUNCA devem ser alterados diretamente no código sem rastreabilidade** — o agente deve apresentar o diagnóstico ao usuário e propor a abertura de **novas Issues atômicas no GitHub (`gh issue create`)**, separadas pelos 5 Eixos (Regra 1.11) e com cenários BDD Gherkin (Regra 1.3).
