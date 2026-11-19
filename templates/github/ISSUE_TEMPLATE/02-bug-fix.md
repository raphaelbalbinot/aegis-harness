---
name: "🐛 Correção de Bug / Defeito Técnico (TDD Red-Green)"
about: "Relato e plano cirúrgico para correção de defeito técnico com reprodução obrigatória via teste automatizado (TDD)"
title: "fix(escopo): "
labels: ["bug"]
assignees: []
---

## 🔍 Contexto, Sintoma e Causa Raiz

- **Sintoma Observado:** ...
- **Comportamento Esperado:** ...
- **Causa Raiz Identificada:** ...

---

## 🧱 Fatiamento Cirúrgico TDD (`🔴 RED` → `🟢 GREEN` → `🔵 REFACTOR`)

1. 🔴 **RED (Reprodução do Bug):** Escrever teste automatizado que reproduz a falha e comprovar que falha antes da correção.
2. 🟢 **GREEN (Correção Mínima):** Aplicar correção cirúrgica sem dual-schema legado (Regra 1.12).
3. 🔵 **REFACTOR & AUDIT:** Executar `audit-verify` e `scripts/review.ps1 -Issue <ID>` até obter `APROVADO`.

---

## 🧪 Critérios de Aceite em Formato BDD Gherkin (1:1 com TDD)

```gherkin
Funcionalidade: [Módulo ou Fluxo onde a correção é aplicada]

  Cenário: [Reprodução e resolução definitiva do defeito]
    Dado que [estado inicial ou payload que antes disparava o bug]
    Quando [função, componente ou endpoint é executado]
    Então [comportamento correto esperado sem o erro]
    E [garantia de não-regressão nos fluxos adjacentes]
```
