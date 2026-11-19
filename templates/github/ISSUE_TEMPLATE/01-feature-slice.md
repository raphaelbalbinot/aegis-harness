---
name: "✨ Feature / Fatia Vertical (BDD Gherkin + TDD)"
about: "Proposta de nova funcionalidade, evolução arquitetural ou fatia vertical seguindo o Aegis Harness (AGENTS.md)"
title: "feat(escopo): "
labels: ["enhancement"]
assignees: []
---

## 🎯 Objetivo

Descreva de forma clara e objetiva o que será construído e por quê:

1. **Entregável / Capacidade 1:** ...
2. **Entregável / Capacidade 2:** ...

---

## 🧭 Classificação Preventiva nos 5 Eixos Técnicos (`AGENTS.md` Regra 1.11)

- [ ] **Eixo A (Infraestrutura & Cloud Serverless):** Workers, filas assíncronas, storage, CI/CD, timeouts longos.
- [ ] **Eixo B (Segurança & Hardening / CWE):** Sanitização, autenticação, isolamento multilocatário, regras de acesso.
- [ ] **Eixo C (Lógica de Domínio & Motores Core/IA):** Regras de negócio centrais, pipelines e orquestradores.
- [ ] **Eixo D (Interface & Experiência do Usuário):** Páginas, componentes, formulários, i18n, acessibilidade WCAG 2.2 e Core Web Vitals.
- [ ] **Eixo E (Persistência & Telemetria):** Banco de dados, sincronização de estado, esquemas e observabilidade/FinOps.

---

## 📂 Arquivos Impactados & Blast Radius (`blast-radius`)

### 1. Documentação Canônica (`docs/` — Regra 1.4):
- [ ] `docs/PRD.md`
- [ ] `docs/ARCHITECTURE.md`

### 2. Código de Produção:
- `src/...` — Descrição da alteração

### 3. Testes Automatizados por Contexto de Domínio (Regra 1.14 — Proibido `issue-*.test.*`):
- `tests/<dominio>/<contexto-semantico>.test.*`

---

## ⚖️ Alternativas Arquiteturais Consideradas — Boost Trade-off Matrix (Regra 1.3.5)

| Critério | Opção A (Escolhida) | Opção B (Alternativa) |
| :--- | :--- | :--- |
| **Complexidade & Acoplamento** | ... | ... |
| **Latência & Performance** | ... | ... |
| **Custo Operacional** | ... | ... |
| **Risco de Regressão** | ... | ... |

---

## 🧪 Critérios de Aceite em Formato BDD Gherkin (1:1 com TDD)

```gherkin
Funcionalidade: [Nome da Funcionalidade]

  Cenário: [Título do Cenário 1 — Caminho Feliz / Regra Principal]
    Dado que [contexto ou estado inicial do sistema]
    Quando [ação executada, rota chamada ou função invocada]
    Então [resultado observável e verificável na asserção do teste]
    E [efeito colateral esperado, persistência, telemetria ou invariante garantida]
```

---

## ✅ Checklist Final de Verificação (`Outer Loop`)

- [ ] Documentação `docs/` sincronizada (`PRD.md`, `ARCHITECTURE.md`)
- [ ] Auditoria Clean Code Incremental (`scan-clean-code.mjs --changed`)
- [ ] Esteira Determinística Completa (`audit-verify` com saída `0`)
- [ ] 2º Portão EGM Goldfish (`powershell -File .\scripts\review.ps1 -Issue <ID> -Files "..."`) com veredito `APROVADO`
