# ⚙️ Regras Modulares — Infraestrutura, Runtime & Persistência

Carregue este módulo sempre que tocar em APIs, workers, subprocessos, bancos de dados, storage ou containers (Cloud Run / Kubernetes).

1. **Zero Processamento Fantasma Pós-Resposta:** nunca dispare tarefas em background sem `await` (*fire-and-forget*) que sobrevivam ao ciclo da requisição sem fila/orquestrador dedicado.
2. **Arquitetura Stateless:** proibido armazenar estado de sessão, jobs ou locks concorrentes em memória global do processo; externalize todo estado nas camadas de persistência definidas em `docs/ARCHITECTURE.md`.
3. **Limpeza Determinística & Desligamento Gracioso:** remova arquivos temporários (ex.: mídia, áudio, uploads) em bloco `finally` e trate sinais `SIGTERM`/`SIGINT`.
4. **Atualização da Arquitetura:** mudanças estruturais de contrato, schema ou fronteira de módulo devem atualizar `docs/ARCHITECTURE.md` (ou ADR curto) antes da implementação.
5. **Heterogeneidade de Escopo:** se uma demanda cruzar `> 2` eixos não triviais ou misturar Infra com UI/Domínio, proponha desmembramento em issues atômicas.
