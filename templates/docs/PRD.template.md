# 📜 Constituição do Produto (PRD) — {{PROJECT_NAME}}

> **Status:** Documento Constitucional Ativo (`Regra 1.4` do `AGENTS.md`)
> **Escopo:** Define o propósito do produto, modelo de negócio, jornadas críticas de usuário, SLAs operacionais e travas de privacidade/segurança. Nenhuma funcionalidade deve ser implementada sem estar especificada neste documento.

---

## 1. Visão Geral & Propósito do Produto
- **Problema Resolvido:** Descreva de forma objetiva qual dor real este sistema resolve e por que soluções genéricas falham.
- **Público-Alvo & Personas:** Defina os perfis de usuário primários e secundários.
- **Proposta de Valor Central:** O diferencial inegociável da entrega.

---

## 2. Modelo de Negócio, Cotas & Limites Operacionais
- **Planos / Tiers de Acesso:** Como o produto é disponibilizado ou monetizado.
- **Unidade de Consumo / Quota:** Limites de uso por usuário/tenant e regras de proteção contra abuso (*rate limiting* e *budget caps*).
- **Métricas de Sucesso (KPIs & FinOps):** Custo unitário máximo por operação e metas de conversão/retenção.

---

## 3. Requisitos Funcionais & Jornadas Críticas (E2E)
| ID | Funcionalidade / Jornada | Critério de Aceite Resumido (BDD) | Prioridade |
| :--- | :--- | :--- | :---: |
| `RF-01` | Autenticação e Isolamento de Tenant | Dado um usuário autenticado, quando acessa seus recursos, então vê apenas dados do próprio `user_id`/`tenant_id`. | P0 |
| `RF-02` | Fluxo Principal de Domínio | Dado um input válido de domínio, quando o pipeline executa, então retorna o artefato validado dentro do SLA. | P0 |
| `RF-03` | Exportação / Entrega de Artefato | Dado um processamento concluído, quando o usuário solicita o resultado, então recebe o arquivo íntegro. | P1 |

---

## 4. Requisitos Não-Funcionais, SLAs & Privacidade (LGPD/GDPR)
- **SLAs de Latência:**
  - Operações síncronas de leitura/UI: `< 300ms` (p95).
  - Processamentos assíncronos / workers pesados: delegados a filas/jobs dedicados sem bloquear a thread HTTP.
- **Privacidade & Ciclo de Vida de Dados:**
  - Arquivos temporários e payloads transitórios devem expirar automaticamente (ex.: *Lifecycle Policy* de 24h em Cloud Storage e limpeza imediata de `/tmp` em bloco `finally`).
  - Direito ao esquecimento: exclusão em cascata de dados de banco, objetos binários e conta de autenticação.
