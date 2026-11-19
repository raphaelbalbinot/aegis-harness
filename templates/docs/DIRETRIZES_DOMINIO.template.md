# 🎨 Diretrizes de Domínio, Regras Criativas & Linguagem Ubíqua — {{PROJECT_NAME}}

> **Status:** Documento Constitucional Ativo (`Regra 1.4` e `Regra 1.19` do `AGENTS.md`)
> **Escopo:** Codifica as regras especialistas do domínio de negócio, parâmetros criativos/estilísticos, invariantes de qualidade e o glossário oficial da Linguagem Ubíqua (DDD).

---

## 1. Princípios Inegociáveis do Domínio
- **Identidade & Tom do Produto:** Defina as diretrizes qualitativas, estéticas, acústicas, editoriais ou financeiras que diferenciam este produto.
- **Invariantes de Domínio:** Regras de negócio que nunca podem ser violadas, independentemente da camada técnica (ex.: normas técnicas internacionais, limites físicos/matemáticos, fidelidade autoral).

---

## 2. Glossário da Linguagem Ubíqua (DDD Ubiquitous Language — `Regra 1.19`)
| Termo Canônico Oficial | Significado no Domínio | Termos Legados / Proibidos (Banidos do Código e UI) |
| :--- | :--- | :--- |
| *Defina o Termo Canônico 1* | Explicação exata da entidade ou processo | *Ex.: termo antigo ou ambíguo* |
| *Defina o Termo Canônico 2* | Explicação exata da entidade ou processo | *Ex.: apelido informal de tabela* |

---

## 3. Parâmetros Especialistas, Prompts & Rubricas de Qualidade
- **Fidelidade Estrutural 1:1 (`Regra 1.10`):** Todo template, prompt ou arquivo de configuração de domínio referenciado no código deve corresponder exatamente ao nome físico real no disco.
- **Critérios de Qualidade de Saída:** Especifique as métricas determinísticas que validam se o artefato gerado pelo domínio está pronto para produção.
- **Domain Skills Associadas (`.agents/skills/`):** Liste aqui as skills específicas deste projeto que encapsulam conhecimento profundo do domínio.
