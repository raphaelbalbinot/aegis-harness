---
name: archify
description: Turns natural language descriptions, architectural questions, or existing codebases into interactive, verifiable architecture and technical diagrams (HTML/SVG + typed JSON IR) backed by real source evidence.
---

# 🏛️ Archify — Evidence-Backed Interactive Architecture Diagrams

Esta skill transforma bases de código reais ou especificações técnicas em diagramas interativos, vetoriais e auditáveis compilados em HTML/SVG autocontidos (`docs/architecture/architecture-3d.html`) e grafos JSON tipados anti-alucinação (`docs/architecture/monorepo-graph.json`).

---

## 🎯 1. Princípio Fundamental: Fidelidade Factual (Source Evidence Mapping)

1. **Topologia Baseada em Evidências:** Nenhum nó, microsserviço, porta, rota de API, fila, máquina de estados ou fluxo E2E pode ser desenhado no diagrama se não existir fisicamente no código-fonte ou no plano aprovado.
2. **Representação Intermediária Tipada (Typed JSON IR):** Em vez de adivinhar coordenadas visuais, o agente constrói a especificação formal do sistema em JSON estruturado (nós, arestas, camadas, sequências de pipeline, fluxos de telemetria, máquinas de estado e jornadas E2E), validada deterministicamente antes de renderizar o HTML.
3. **Entrega Autocontida & Interativa:** O artefato HTML gerado não depende de bibliotecas externas em runtime e oferece:
   - Navegação por 5 abas temáticas (`topology-3d`, `pipelines-sequence`, `telemetry-billing`, `state-machines`, `e2e-flows`).
   - Alternância de temas (Light & Dark mode).
   - Busca em tempo real de nós, serviços, rotas e jornadas E2E.
   - Rastreamento de rotas e destaque de impacto reverso (*Blast Radius* via hover/click).

---

## 📐 2. Gatilhos Obrigatórios para Criação e Sincronização de Diagramas

Sempre que qualquer uma das situações abaixo ocorrer no repositório, o agente DEVE atualizar o grafo arquitetural e rodar a verificação anti-drift (`arch:sync` / `arch:check`):

| # | Gatilho de Engenharia | Aba / Artefato Impactado |
| :- | :--- | :--- |
| **1** | **Nova Suíte E2E ou Alteração de Jornada Crítica** | **Aba 5 (`🧪 Jornadas E2E`)** + `e2eFlows` em `monorepo-graph.json` |
| **2** | **Nova Rota de API, Microsserviço, Endpoint ou Fila Assíncrona** | **Aba 1 (`🌐 Topologia 3D`)** + `docs/ARCHITECTURE.md` |
| **3** | **Novo Estágio de Pipeline, Orquestrador ou Prompt Físico** | **Aba 2 (`⚡ Pipelines & Sequência`)** + `sequences` em `monorepo-graph.json` |
| **4** | **Alteração em Regras de FinOps, Faturamento ou Telemetria** | **Aba 3 (`💰 Telemetria & Custos`)** + `telemetryFlow` em `monorepo-graph.json` |
| **5** | **Novo Status ou Transição de Máquina de Estados** | **Aba 4 (`🔄 Máquinas de Estado`)** + `stateMachines` em `monorepo-graph.json` |
| **6** | **Onboarding de Nova Sessão de IA ou Revisão Arquitetural** | Ler `docs/architecture/monorepo-graph.json` (~800 tokens) para absorver toda a topologia sem abrir dezenas de arquivos. |

---

## 🛡️ 3. Protocolo Anti-Drift no Precommit

- **`arch:sync`:** Varre os diretórios de rotas, serviços, pipelines e suítes E2E do projeto, regenerando `monorepo-graph.json` e o visualizador HTML interativo.
- **`arch:check`:** Verifica se houve drift entre a árvore de arquivos real no disco e o grafo registrado, bloqueando o precommit (`audit-verify.mjs`) caso haja divergência.
