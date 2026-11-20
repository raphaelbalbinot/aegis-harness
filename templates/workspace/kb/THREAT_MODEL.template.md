KB_SNAPSHOT: UNPINNED
<!-- aegis-surface-hash: bootstrap -->
# 🛡️ Modelo de Ameaças Vivo (Living Threat Model — Regra 1.8) — {{PROJECT_NAME}}

- **Projeto:** `{{PROJECT_NAME}}`
- **Linguagem Base:** `{{LANGUAGE}}`
- **Stack Detectada:** `{{STACK_SUMMARY}}`

## Deployment Intent
Intent: PRODUCTION

## Fronteiras de Confiança (Trust Boundaries)
- **TB-01 (Borda Pública -> API/Webhooks):** Tráfego externo não confiável exigindo autenticação, autorização por escopo/tenant e validação estrita de schema.
- **TB-02 (Aplicação -> Subprocessos / Runtime):** Execução local ou em containers/serverless exigindo isolamento de processos e limpeza de recursos efêmeros (`/tmp`).
- **TB-03 (Aplicação -> Persistência & Object Storage):** Isolamento estrito de dados multi-tenant e prevenção contra travessia de diretórios (Path Traversal).
- **TB-04 (Aplicação -> Pipelines de IA / LLMs):** Delimitação estrutural de contexto, blindagem contra Prompt Injection e validação de saída estruturada.

## Atores de Ameaça (Threat Actors)
- **TA-01:** Atacante externo não autenticado explorando rotas públicas, webhooks ou payloads malformados.
- **TA-02:** Usuário autenticado malicioso tentando escalar privilégios ou acessar recursos de outro tenant (IDOR / BOLA).
- **TA-03:** Injeção indireta via insumos externos, arquivos ou prompts processados por motores de IA ou subprocessos.

## Ativos de Alto Risco (Risk Tiers)
- **`CRITICAL`:** Credenciais, tokens de autenticação, chaves de API, isolamento multi-tenant de banco/storage e execução de subprocessos.
- **`STANDARD`:** Contratos de rotas de negócio, filas assíncronas, telemetria operacional e orquestração de IA.
- **`LOW_CRITICALITY`:** Utilitários puros de formatação, constantes estáticas de UI e helpers matemáticos sem I/O.

## Controles de Segurança & Mitigações (Mantis Living Threat Model)

| ID | Risco / CWE | Impacto | Controle Mitigador Obrigatório |
| :--- | :--- | :--- | :--- |
| TM-CORE-01 | CWE-284 / CWE-306: Controle de Acesso e Autenticação na Borda | Crítico | Autenticação explícita em rotas/webhooks e validação anti-IDOR por tenant. |
| TM-CORE-02 | CWE-78 / CWE-88: Injeção de Comandos em Subprocessos | Crítico | Uso estrito de execFileSync / subprocess.run com array de argumentos e shell=False. |
| TM-CORE-03 | CWE-22 / CWE-639: Path Traversal e Isolamento de Storage | Crítico | Canonicalização de caminhos, rejeição de '..' e validação de prefixo por escopo/tenant. |
| TM-CORE-04 | CWE-74 / CWE-20: Prompt Injection e Validação de Schema na Borda | Alto | Validação de payloads de entrada (Zod/Pydantic) e sanitização de delimitadores XML/prompts. |
| TM-CORE-05 | CWE-400 / CWE-459: Exaustão de Recursos Serverless e Limpeza de /tmp | Alto | Await estrito antes da resposta HTTP (Anti-Freeze), timeouts explícitos e remoção de /tmp em bloco finally. |
