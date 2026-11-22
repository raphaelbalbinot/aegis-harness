# 🤖 Regras Modulares — IA, LLMs & FinOps

Carregue este módulo sempre que tocar em pipelines de IA, prompts, context caching ou telemetria de custo.

1. **Context Caching Seguro:** gerencie caches explícitos de LLMs exclusivamente no backend, com TTL curto dinâmico e desalocação garantida em bloco `try ... finally`.
2. **Segregação de Telemetria (`production` vs. `dev_and_test`):** quando rastrear custos/tokens, segregue `invoice_total`, `production`, `failed_and_retries` e `dev_and_test` com flag `is_test_account`.
3. **Prevenção de Prompt Injection (`CWE-74`):** separe estritamente instruções de sistema de dados fornecidos pelo usuário e valide saídas estruturadas com schema estrito (Zod/Pydantic).
4. **Eficiência de Inferência:** evite chamadas redundantes de LLM para tarefas que código determinístico (regex, parser, AST) resolve com precisão.
