---
name: clean-code-audit
description: Audita a qualidade do código contra 22 regras enxutas de Clean Code, AI-Friendly Engineering, Serverless Anti-Freeze e Engenharia Comportamental (funções/arquivos pequenos, SRP, nomes significativos, comentários com proveniência vs. óbvios, disciplina de tipos e estados ilegais irrepresentáveis, DRY, estrutura previsível, Dependency Injection e testes comportamentais de domínio anti-stage/cluster/teatrais, aninhamento raso e índice CRAP < 10, erros com contexto, logging JSON, zero silent catch, zero magic numbers, limite de parâmetros, imutabilidade, Anti-Freeze Cloud Run, Fail-Fast, Stateless, Parse Don't Validate, zero ciclos e zero ternários aninhados). Gera Matriz Resumo com Facilidade/Risco de Regressão (🟢 Quick Win, 🟡 Local, 🔴 Estrutural), Ranking Top 5 Hotspots e suporta modo incremental --changed.
---

# Clean Code, AI-Friendly & Serverless Audit (`clean-code-audit` — 22 Regras)

## Visão Geral

Esta skill realiza uma auditoria híbrida (estática/determinística + semântica pelo Agente) sobre um arquivo, diretório, diff (`--changed`) ou repositório completo, validando **22 Regras de Engenharia de Código Limpo, Amigável para IA, Testes Comportamentais e Resiliente em Nuvem Serverless (Cloud Run)**.

> **Regra de Ouro (Modo Somente-Leitura por Padrão):** Esta skill opera estritamente em modo diagnóstico (**Somente-Leitura / Read-Only**). Nunca refatore nem edite os arquivos auditados automaticamente durante a auditoria; entregue primeiro a Matriz Resumo das 22 Regras, o Ranking Top 5 Hotspots, o Catálogo de Desvios com snippets sugeridos e o Plano de Ação em 3 Fases, aguardando autorização explícita do usuário.

---

## Classificação de Facilidade / Risco de Regressão

Cada regra e desvio recebe um selo indicando o quão simples e seguro é corrigi-lo sem quebrar o código existente:

| Faixa de Segurança | Significado Técnico | Estratégia de Correção |
| :--- | :--- | :--- |
| **`🟢 Quick Win (Risco Zero)`** | Edição cirúrgica que **não altera fluxo de controle nem contratos públicos** (ex.: enriquecer erro, remover comentário óbvio, documentar proveniência, estruturar log JSON, extrair constante de número mágico ou condição booleana, preservar `cause` no catch). | Pode ser aplicado imediatamente com risco praticamente nulo de regressão. |
| **`🟡 Refatoração Local (Risco Baixo)`** | Altera apenas a **implementação interna de uma função ou arquivo**, preservando a assinatura pública e os exports intactos (ex.: *guard clauses* / *early return*, extrair subfunção privada de 4–20 linhas, imutabilidade de parâmetros, validação de schema local, `await` explícito Anti-Freeze). | Seguro para aplicar validando os testes unitários locais do próprio módulo. |
| **`🔴 Estrutural (Alto Blast Radius)`** | Altera **assinaturas exportadas, fronteiras de módulos, injeção de dependências, estado global ou localização de arquivos** (ex.: dividir módulo por SRP, extrair módulo DRY compartilhado, injetar clientes via DI, quebrar ciclo de imports, remover estado em memória global). | Exige mapear dependentes reversos (`blast-radius`) e atualizar chamadores/mocks sob TDD. |

---

## Catálogo das 22 Regras Auditadas

1. **R1 — Funções pequenas (4–25 linhas) e arquivos pequenos:** Funções fazem UMA coisa e fazem BEM (ideal 4–25 linhas de lógica imperativa efetiva, descontando assinatura, fechamentos, árvores JSX declarativas e interior de template literals multilinhas; construtores declarativos puros com `cyclomaticComplexity <= 3` até 65 linhas; alerta de tamanho de arquivo > 300 linhas apenas quando combinado com funções extensas/complexas). *(`🟡 Refatoração Local`)*
2. **R2 — Single Responsibility Principle (SRP):** Cada módulo tem uma única responsabilidade e uma única razão para mudar (proibido misturar camadas incompatíveis como I/O de servidor com UI/JSX, importar SDKs de I/O dentro de módulos de contratos/catálogos puros `types|prompts|config` ou exceder `>= 15` funções exportadas num mesmo módulo). *(`🔴 Estrutural`)*
3. **R3 — Nomes significativos e únicos:** Nomes revelam intenção real, sem desinformação (`data`, `info`, `temp`, `val`, `obj` proibidos). *(`🟡 Local` / `🔴 Estrutural`)*
4. **R4 — Comentários com contexto e proveniência:** Docstring com intenção e exemplo em APIs públicas; explicação do *porquê* (bug, issue `#ID`, commit, constraint, workaround) em lógicas não-óbvias. *(`🟢 Quick Win`)*
5. **R5 — Disciplina de Tipos & Estados Ilegais Irrepresentáveis:** Proibido código dinâmico sem anotação (`any` em TS, Python sem type hints, Ruby sem RBS) e proibido modelar tipos/interfaces de estado combinando $\ge 3$ flags booleanas de ciclo de vida mutuamente exclusivas (`isLoading`, `isSuccess`, `isError`) em vez de uma *Discriminated Union* (`status: 'idle' | 'loading' | 'success' | 'error'`). *(`🟡 Local` / `🔴 Estrutural`)*
6. **R6 — DRY (Don't Repeat Yourself):** Zero duplicação de blocos de lógica ou regras de negócio (janela de 6 linhas significativas, ignorando declarações de tipo/pontuação e sem cruzar arquivos de teste com produção). *(`🟡 Local` / `🔴 Estrutural`)*
7. **R7 — Estrutura de diretório previsível:** Seguir convenções fortes do framework sem pastas vagas (`misc/`, `helpers2/`, `temp/`). *(`🔴 Estrutural`)*
8. **R8 — Dependency Injection & Testes Comportamentais de Domínio (Anti-Stage/Cluster & Anti-Teste Teatral):** Dependências de I/O injetadas e nunca instanciadas hardcoded (`new Firestore()`, `new Storage()`); arquivos de teste DEVEM ter nomes semânticos de domínio (proibido `stage-a-clusters-*`, `*-clean-code.test.*`, `*-srp.test.*`, `issue-*`), exercitar comportamento real de domínio e conter asserções verificáveis (proibido teste vazio ou tautológico `expect(true).toBe(true)`). *(`🟡 Local` / `🔴 Estrutural`)*
9. **R9 — Aninhamento Raso, Complexidade Ciclomática & Índice CRAP (`CRAP < 10`):** Nível único de abstração por função com *guard clauses* (aninhamento $< 3$; o bloco `try` externo de guarda e `else if` não incrementam nível) e índice $\text{CRAP}(m) = \text{comp}(m)^2 \times (1 - \text{cov}(m))^3 + \text{comp}(m) < 10$. *(`🟡 Refatoração Local`)*
10. **R10 — Erro com contexto:** Exceções devem informar o valor recebido (`received`) e o esperado (`expected`). *(`🟢 Quick Win`)*
11. **R11 — Zero comentário que descreve o óbvio:** Proibidos comentários que apenas narram a sintaxe (`// increment i by 1`). *(`🟢 Quick Win`)*
12. **R12 — Logging estruturado:** Logs em formato JSON com campos nomeados (`event`, `context`, `error`). *(`🟢 Quick Win`)*
13. **R13 — Proibição de Exceções Engolidas (*Silent Catch*):** Proibidos blocos `catch {}` vazios, `except: pass` ou re-throw que descarte a causa original (`{ cause: err }`). *(`🟢 Quick Win`)*
14. **R14 — Zero Números/Strings Mágicas:** Literais numéricos em condicionais/fórmulas devem ser extraídos para constantes nomeadas com unidade (`MAX_RETRY_DELAY_MS`). *(`🟢 Quick Win`)*
15. **R15 — Limite de Parâmetros (`≤ 3` posicionais) e Zero *Boolean Flags*:** Funções com 4+ parâmetros devem receber um objeto tipado de opções. *(`🟡 Local` / `🔴 Estrutural`)*
16. **R16 — Imutabilidade de Parâmetros (*No Parameter Mutation*):** Proibido mutar diretamente propriedades ou arrays de parâmetros de entrada. *(`🟡 Refatoração Local`)*
17. **R17 — Assincronismo Seguro & Anti-Freeze Serverless (Cloud Run):** Toda Promise deve ser aguardada com `await` antes da resposta HTTP (zero *fire-and-forget*) e é proibido usar `setTimeout`/`setInterval` soltos no servidor (componentes `"use client"` e testes são isentos). *(`🟡 Refatoração Local`)*
18. **R18 — Fail-Fast & Zero Compatibilidade Zumbi / Código Morto:** Proibidos fallbacks de dual-schema legado (`a.word_count ?? a.wordCount`) ou `process.env.X || default`. *(`🟡 Refatoração Local`)*
19. **R19 — Servidor 100% *Stateless* (Zero Estado Mutável em Memória Global):** Proibido manter `let state = ...`, `new Map()` ou caches mutáveis no escopo global de módulo em servidores Cloud Run (componentes `"use client"` e testes são isentos). *(`🔴 Estrutural`)*
20. **R20 — Validação de Schema na Fronteira (*Parse, Don't Validate*):** Proibido usar `JSON.parse(x) as Tipo` ou `req.json() as Tipo` sem validação de schema em runtime (Zod/Pydantic/TypeGuard). *(`🟡 Refatoração Local`)*
21. **R21 — Zero Dependências Circulares (`A ↔ B`):** Proibidos ciclos diretos ou indiretos de importação entre módulos. *(`🔴 Estrutural`)*
22. **R22 — Zero Ternários Aninhados e Condições Criptográficas:** Proibidos ternários aninhados (`a ? b : c ? d : e`, desconsiderando optional chaining `?.` e nullish coalescing `??`) e condicionais com ≥ 4 operadores lógicos inline sem constante booleana nomeada. *(`🟢 Quick Win`)*

---

## Protocolo de Convergência em Passagem Única (Anti-Cascata & First Principles)

Para evitar que a correção de uma regra faça surgir desvios colaterais em outras regras (*Efeito Cascata de Código*), toda refatoração derivada desta auditoria deve obedecer às seguintes diretrizes:

1. **Convergência `R1` e `R9` sem engatilhar `R2` ou `R15`:** Ao decompor uma função longa (`R1`) ou com alto CRAP / aninhamento (`R9`), extraia subfunções auxiliares **privadas** (sem `export`) dentro do mesmo módulo coeso e agrupe parâmetros em um objeto tipado de contexto quando houver mais de 3 argumentos (`R15`), evitando inflar o número de exports públicos (`R2`).
2. **Proibição de Fragmentação Cosmética de JSX/Tailwind (`R1`, `R6` e `R9`):** Em componentes React (`.tsx`), NUNCA quebre blocos de marcação HTML/Tailwind coesos em micro-componentes artificiais sem estado próprio nem reutilização real apenas para reduzir a contagem de linhas ou o CRAP Score. A árvore declarativa JSX (`return (<div className="...">...</div>)`) não é lógica imperativa; extraia apenas cálculos, *builders* de estado e handlers imperativos complexos para módulos puros (`.ts`), mantendo a hierarquia visual HTML/Tailwind contígua e legível.
3. **Preservação de Módulos de Domínio Coesos (`R2`), Template Literals Multilinhas (`R1`/`R9`) e Contratos Independentes (`R6`):** Nunca divida um módulo que encapsula um único agregado ou adaptador de infraestrutura (`indexeddb.ts`, `gcs/client.ts`, `types/project.ts`, `language-catalog.ts`) em `*-part1.ts` e `*-part2.ts` apenas por número de exports; a violação real de SRP (`R2`) é a mistura de camadas arquiteturais (I/O + UI ou I/O em contratos puros) ou o acúmulo de `>= 15` funções exportadas. Além disso, o interior de *template literals* multilinhas (`` `<!DOCTYPE html>...` ``) não é código imperativo JS/TS e não deve inflar `R1` nem `R9`.
4. **Convergência `R9` com Guard Clauses e `try` de Guarda:** Ao reduzir aninhamento e CRAP (`R9`), aplique *early returns* no topo da função; o bloco `try { ... } catch` externo da função não conta como nível ciclomático adicional.
5. **Attack the Premise & Redesign From First Principles (`R5`):** Quando duas correções que compartilham a mesma premissa falharem no mesmo portão de qualidade, pare de remendar (*do not bolt onto the old design*): formule a premissa defeituosa em uma frase, modele a forma dos dados primeiro para tornar estados ilegais impossíveis (`R5`) e remova a complexidade antes de adicionar código.
6. **Testes Comportamentais por Contexto de Domínio (`R8`):** Ao criar ou atualizar testes durante uma refatoração, NUNCA crie suítes artificiais de etapa/cluster/meta-linter (como `stage-a-clusters-*` ou `*-clean-code.test.ts`); adicione ou atualize testes que chamem o código de produção como sua usuária/chamador faz e validem o resultado observável dentro do domínio correspondente.
7. **Ordem de Execução One-Pass File-Centric:** Ao remediar um arquivo ou domínio, aplique de cima para baixo (`🔴 Estrutural` → `🟡 Local` → `🟢 Quick Win`) e valide imediatamente `scan-clean-code.mjs <arquivo>` até zerar os desvios do módulo em uma única passagem.

---

## Como Executar o Scanner (`scan-clean-code.mjs`)

```bash
# Auditar um diretório ou arquivo específico:
node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs <caminho> --markdown

# Auditar APENAS os arquivos modificados no Git (--changed):
node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs --changed

# Saída em JSON para consumo programático:
node .agents/skills/clean-code-audit/scripts/scan-clean-code.mjs <caminho> --json
```

---

## Formato Obrigatório do Relatório de Saída

1. **Matriz Resumo das 22 Regras** (com colunas: `#`, `Regra`, `Status`, `Desvios`, `Facilidade / Risco de Regressão` (`🟢 Quick Win (Risco Zero)` | `🟡 Refatoração Local (Risco Baixo)` | `🔴 Estrutural (Alto Blast Radius)`), `Diagnóstico Sintético`).
2. **Top 5 Arquivos Mais Críticos (*Hotspots*)** (tabela listando os 5 arquivos com mais desvios e a distribuição `🟢` / `🟡` / `🔴`).
3. **Catálogo Acionável de Desvios** (com link clicável `arquivo:linha`, faixa de risco, diagnóstico e snippet sugerido).
4. **Plano de Ação Recomendado em 3 Fases de Segurança** (`Fase 1: 🟢 Quick Wins` → `Fase 2: 🟡 Refatorações Locais` → `Fase 3: 🔴 Mudanças Estruturais com Blast Radius`).
