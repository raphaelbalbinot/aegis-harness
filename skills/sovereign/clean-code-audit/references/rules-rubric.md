# Rubrica Detalhada das 22 Regras (`clean-code-audit`)

Este guia de referência define os critérios exatos de avaliação (estática e semântica), exemplos multi-linguagem (TypeScript, Python, Ruby) e a classificação de **Facilidade / Risco de Regressão**.

---

## R1. Funções Pequenas (4–25 linhas) e Arquivos Pequenos
- **Critério:** Funções devem fazer UMA coisa, fazer BEM e fazer só isso.
- **Limiares Pragmáticos:** Funções: ideal `4–25` linhas de lógica efetiva descontando assinatura e chaves de fechamento (`⚠️ Alerta` `26–40`; `❌ Crítico` `> 40`; e até `45` linhas em componentes `.tsx`). Arquivos: ideal `≤ 250` linhas (`⚠️ Alerta` `> 300`; `❌ Crítico` `> 500`).
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)` — extrair subfunções privadas mantendo a assinatura pública intacta.

## R2. Single Responsibility Principle (SRP)
- **Critério:** Cada módulo ou classe deve ter uma única responsabilidade e uma única razão para mudar. Dispara quando um módulo acumula `>= 8` funções exportadas (ou `> 400` linhas efetivas com `>= 6` funções exportadas) ou mistura imports de I/O de infraestrutura com marcação de UI.
- **Facilidade / Risco:** `🔴 Estrutural (Alto Blast Radius)`.

## R3. Nomes Significativos e Únicos
- **Critério:** Nomes revelam intenção, sem desinformação (`data`, `info`, `temp`, `tmp`, `val`, `obj`, `stuff` proibidos).
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)` (interno) / `🔴 Estrutural` (exportado).

## R4. Comentários com Contexto e Proveniência
- **Critério:** Docstring com intenção e exemplo em APIs públicas; explicação do *porquê* (bug, issue `#ID`, commit, constraint, workaround) em lógicas não-óbvias.
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.

## R5. Disciplina de Tipos & Estados Ilegais Irrepresentáveis
- **Critério:**
  1. **Tipos Explícitos:** Zero código dinâmico sem anotação (`: any`, `as any`, Python sem type hints / retorno `->`, Ruby sem RBS).
  2. **Estados Ilegais Irrepresentáveis (*Make Illegal States Unrepresentable*):** Proibido modelar interfaces ou tipos de estado combinando $\ge 3$ flags booleanas de ciclo de vida mutuamente exclusivas (`isLoading`, `isSuccess`, `isError`, `isPending`, `isCompleted`, `isFailed`) no mesmo nível, pois permitem estados impossíveis (`isLoading: true` e `isError: true` simultaneamente). Utilize uniões discriminadas (`status: 'idle' | 'loading' | 'success' | 'error'`).
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)` (anotações locais) / `🔴 Estrutural (Alto Blast Radius)` (modelagem de estado).

## R6. DRY (Don't Repeat Yourself)
- **Critério:** Representação única e canônica para cada regra de negócio ou transformação (janela de 6 linhas significativas, ignorando declarações de tipo/pontuação e isolando arquivos de teste dos arquivos de produção).
- **Facilidade / Risco:** `🟡 Local` (mesmo arquivo) / `🔴 Estrutural (Alto Blast Radius)` (entre arquivos).

## R7. Estrutura de Diretório Previsível
- **Critério:** Respeitar convenções fortes do framework sem pastas amorfas (`misc/`, `helpers2/`, `temp/`, `stuff/`).
- **Facilidade / Risco:** `🔴 Estrutural (Alto Blast Radius)`.

## R8. Dependency Injection & Testes Comportamentais de Domínio (Anti-Stage/Cluster & Anti-Teste Teatral)
- **Critério:**
  1. **Dependency Injection:** Dependências externas (banco, storage, HTTP, relógio) injetadas via parâmetro/construtor, nunca hardcoded (`new Firestore()`, `new Storage()`).
  2. **Nomenclatura Semântica por Domínio:** Proibido nomear arquivos de teste com jargões de etapa, cluster, fase, sufixo de linter ou issue (`stage-a-clusters-*`, `*-clean-code.test.*`, `*-srp.test.*`, `*-guard-clauses*`, `cluster-*`, `etapa-*`, `phase-*`, `issue-*`). Todo arquivo de teste deve residir no subdiretório do seu contexto (`tests/ai/`, `tests/editor/`, `tests/kdp/`, `tests/telemetry/`, `tests/storage/`, `tests/governance/`).
  3. **Test Behavior, Not Static Clusters:** Suítes de domínio devem invocar funções reais de negócio e validar o comportamento observável pela usuária/chamador. É proibido criar testes que apenas passem listas estáticas de arquivos (`CLUSTER_A1_...`) para o scanner sem exercitar o domínio, bem como blocos `it(...)` / `test(...)` sem asserção ou com asserções tautológicas (`expect(true).toBe(true)`).
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)` (testes) / `🔴 Estrutural (Alto Blast Radius)` (DI em produção).

## R9. Aninhamento Raso, Complexidade Ciclomática & Índice CRAP (`CRAP < 10`)
- **Critério:**
  1. **Aninhamento Raso (< 3):** Nível único de abstração por função (proibido `if` dentro de `for` dentro de `if`; o bloco `try` externo de guarda da função e cadeias `else if` não contam como níveis adicionais; aplicar *guard clauses* / *early return*).
  2. **Índice CRAP (`< 10`):** Cada função deve manter o índice **CRAP (*Change Risk Anti-Patterns*)** abaixo de `10` (`⚠️ Alerta` `10–29.99`; `❌ Crítico` `≥ 30`):
     $$\text{CRAP}(m) = \text{comp}(m)^2 \times (1 - \text{cov}(m))^3 + \text{comp}(m)$$
     onde $\text{comp}(m)$ é a complexidade ciclomática da função e $\text{cov}(m) \in [0, 1]$ é a cobertura de testes da função.
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)`.

## R10. Erro com Contexto
- **Critério:** Toda exceção deve informar o valor recebido (`received`) e o esperado (`expected`).
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.

## R11. Comentário que Descreve o Óbvio
- **Critério:** Proibidos comentários que apenas narram a sintaxe (`// increment i by 1`).
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.

## R12. Logging Estruturado
- **Critério:** Logs emitidos em JSON com campos nomeados (`event`, `level`, `context`, `error`).
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.

## R13. Proibição de Exceções Engolidas (*Silent Catch*)
- **Critério:** Proibidos blocos `catch (err) {}` vazios, `except Exception: pass` ou re-throw que descarte a causa original (`new Error("...", { cause: err })`).
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.

## R14. Zero Números/Strings Mágicas
- **Critério:** Literais numéricos de domínio em condicionais, timers ou fórmulas devem ser extraídos para constantes nomeadas com unidade (`MAX_RETRY_DELAY_MS = 86_400`).
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.

## R15. Limite de Parâmetros (`≤ 3` posicionais) e Zero *Boolean Flags*
- **Critério:** Funções com 4 ou mais parâmetros posicionais devem receber um único objeto/dataclass tipado de opções.
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)` (privada) / `🔴 Estrutural` (exportada).

## R16. Imutabilidade de Parâmetros (*No Parameter Mutation*)
- **Critério:** Proibido alterar propriedades ou elementos dos argumentos recebidos (`param.status = "done"`, `param.push(...)`); sempre retornar uma nova cópia/estrutura.
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)`.

## R17. Assincronismo Seguro & Anti-Freeze Serverless (Cloud Run)
- **Critério:**
  1. Toda Promise deve ser aguardada com `await` / `Promise.all` antes do envio da resposta HTTP (proibido *fire-and-forget* sem `await`).
  2. Proibido usar `setTimeout` ou `setInterval` soltos em rotas/serviços de servidor (o Cloud Run congela a CPU após a resposta HTTP). Arquivos client-side com `"use client"` e suítes de teste são isentos.
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)`.

## R18. Fail-Fast & Zero Compatibilidade Zumbi / Código Morto
- **Critério:** Proibidos fallbacks zumbis de dual-schema (`obj.word_count ?? obj.wordCount`) ou `process.env.VAR || default`.
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)`.

## R19. Servidor 100% *Stateless* (Zero Estado Mutável Global)
- **Critério:** Proibido armazenar estado de negócio, sessões ou caches em variáveis globais de módulo (`let state = ...`, `const cache = new Map()`) em servidores multi-instância. Arquivos client-side com `"use client"` e suítes de teste são isentos.
- **Facilidade / Risco:** `🔴 Estrutural (Alto Blast Radius)`.

## R20. Validação de Schema na Fronteira (*Parse, Don't Validate*)
- **Critério:** Proibido usar `JSON.parse(raw) as MeuTipo` ou `await req.json() as MeuTipo` sem validar o payload em runtime via schema (Zod, Pydantic, TypeGuard).
- **Facilidade / Risco:** `🟡 Refatoração Local (Risco Baixo)`.

## R21. Zero Dependências Circulares (`A ↔ B`)
- **Critério:** Proibidos ciclos diretos ou indiretos de importação entre arquivos.
- **Facilidade / Risco:** `🔴 Estrutural (Alto Blast Radius)`.

## R22. Zero Ternários Aninhados e Condições Criptográficas
- **Critério:** Proibidos operadores ternários aninhados (`a ? b : c ? d : e`, sanitizando previamente optional chaining `?.`, nullish coalescing `??` e propriedades opcionais `?:`) e `if` com ≥ 4 operadores lógicos inline sem extrair constante booleana nomeada.
- **Facilidade / Risco:** `🟢 Quick Win (Risco Zero)`.
