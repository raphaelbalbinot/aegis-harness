# 🛡️ Regras Modulares — Segurança Shift-Left & Threat Model

Carregue este módulo sempre que `blast-radius` indicar `securitySurfaceTouched: true` (auth, OIDC, APIs/webhooks, permissões, persistência multi-tenant, subprocessos ou pipelines de IA).

1. **Shift-Left (`mantis-advise`):** consulte `workspace/kb/THREAT_MODEL.md`, mantenha o hash `<!-- aegis-surface-hash: ... -->` sincronizado e cite nominalmente os IDs `TM-*` aplicáveis no fechamento.
2. **Auditoria Completa (`mantis-meta-agent`):** para revisões profundas de superfície de ataque ou campanhas defensivas, acione `mantis-meta-agent` (que orquestra os 17 estágios em `references/`).
3. **Raciocínio Sequencial (`sequential-thinking`):** acione antes de remediações CWE complexas, concorrência crítica ou módulos `riskLevel: "HIGH"`.
4. **Hardening Padrão:** validação estrita na borda, menor privilégio, zero interpolação de shell (`CWE-78`) e proteção contra traversal/SSRF.
