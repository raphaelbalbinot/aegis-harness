param (
    [Parameter(Mandatory = $true, Position = 0)] [string]$Issue,
    [Parameter(Mandatory = $false)] [string]$Files = ""
)

# 1. Puxa a issue diretamente pelo gh
$issueRaw = gh issue view "$Issue"
if ($LASTEXITCODE -ne 0 -or -not $issueRaw) {
    Write-Error "Erro ao consultar a issue #$Issue via gh. Verifique se o numero existe e se o 'gh auth login' foi feito."
    exit 1
}
$issueContent = $issueRaw -join "`r`n"

# 1.0.1 Extrai automaticamente as clausulas BDD Gherkin (Cenario / Dado / Quando / Entao / E) da Issue para verificacao 1:1
$bddLines = $issueRaw | Where-Object { $_ -match '^\s*(\*\*|-|\d+\.)?\s*(Cen.rio|Dado|Quando|Ent.o|E\s)\b' }
$bddChecklistContent = if ($bddLines) { ($bddLines -join "`r`n") } else { "Nenhuma clausula BDD formal detectada automaticamente; valide todos os Criterios de Aceite listados na Issue." }

# 1.1 Puxa a lista de outras issues abertas no repositorio para evitar alucinacao de escopo em tarefas fatiadas
$openIssuesRaw = gh issue list --state open --limit 30 2>$null
$openIssuesContent = if ($openIssuesRaw) { $openIssuesRaw -join "`r`n" } else { "Nenhuma outra issue aberta listada." }

# 2. Registra apenas arquivos escopados (ou fora de node_modules/scratch/workspace) como 'intencao de adicionar'
$fileScopeArray = @()
if (-not [string]::IsNullOrWhiteSpace($Files)) {
    $fileScopeArray = $Files.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
}

if ($fileScopeArray.Count -gt 0) {
    git add -N -- $fileScopeArray 2>$null
    $statusRaw = git status --short -- $fileScopeArray
    $diffRaw = git diff HEAD --function-context -- $fileScopeArray
} else {
    git add -N -- :/ ":(exclude):/node_modules/*" ":(exclude):/workspace/*" ":(exclude):/scratch/*" 2>$null
    $statusRaw = git status --short -- :/ ":(exclude):/node_modules/*" ":(exclude):/workspace/*" ":(exclude):/scratch/*"
    $diffRaw = git diff HEAD --function-context -- :/ ":(exclude):/package-lock.json" ":(exclude):/*/package-lock.json" ":(exclude):/skills-lock.json" ":(exclude):/docs/architecture/*" ":(exclude):/node_modules/*" ":(exclude):/workspace/*" ":(exclude):/scratch/*"
}

$statusContent = $statusRaw -join "`r`n"
$diffContent = $diffRaw -join "`r`n"
if ([string]::IsNullOrWhiteSpace($diffContent)) {
    Write-Warning "Nenhum diff encontrado contra o HEAD. Nada para revisar."
    exit 0
}

# 3. Monta o prompt com blindagem estrita anti-alucinacao de escopo
$promptLines = @(
    "Papel: Revisor Tecnico Senior (2o Portao EGM Goldfish).",
    "Contexto:",
    "- Requisitos Exclusivos da Issue #$($Issue):",
    $issueContent,
    "",
    "- Checklist Extraido de Clausulas BDD Gherkin (Rastreabilidade 1:1 Obrigatoria):",
    $bddChecklistContent,
    "",
    "- Roadmap / Outras Issues da Sequencia (Fora do Escopo Desta Revisao):",
    $openIssuesContent,
    "",
    "- Arquivos Alterados / Removidos (git status --short):",
    '```text',
    $statusContent,
    '```',
    "",
    "- Diff da Implementacao Atual com Contexto Completo de Funcao (Issue #$($Issue)):",
    '```diff',
    $diffContent,
    '```',
    "",
    "Objetivo e Matriz de Avaliacao nos 4 Eixos Inegociaveis:",
    "Avalie estritamente nos 4 eixos abaixo:",
    "1. [Eixo 1 - Rastreabilidade BDD 1:1 e Anti-Mock Oco]: Cada clausula 'Entao' e cada Criterio de Aceite da Issue #$($Issue) possui assercao real e verificavel nos testes automatizados do Diff? Rejeite testes tautologicos (que apenas testam o proprio mock sem exercitar o codigo real).",
    "2. [Eixo 2 - Zero Spec Drift e Regra 1.12]: A implementacao segue 100% os nomes de propriedades, contratos e fluxos pedidos na Issue #$($Issue), sem desvios silenciosos e sem gambiarras de compatibilidade zumbi/dual-schema (ex.: 'novo ?? antigo')?",
    "3. [Eixo 3 - Seguranca Serverless, Subprocessos e Tipagem (Regra 1.5 e Core Behavior 7)]: Existem promessas/tarefas sem await pos-resposta HTTP, estado mutavel em memoria global de servidor, ausencia de limpeza finally em /tmp, uso de '||' falsy em vez de '??' para defaults, ou vulnerabilidades de injecao?",
    "4. [Eixo 4 - Simulacao de Execucao Mental]: Simulando a execucao das funcoes completas mostradas no Diff, existe algum bug logico, race condition, loop infinito ou crash em casos de borda (null/undefined/array vazio)?",
    "",
    "REGRA DE OURO ANTI-ALUCINACAO E CONTESTACAO COM EVIDENCIA (EGM GOLDFISH): E TERMINANTEMENTE PROIBIDO cobrar itens, migracoes ou refatoracoes que pertencam as demais issues da sequencia (listadas no Roadmap acima) ou apontar problemas em arquivos/modulos que nao fazem parte dos Criterios de Aceite da Issue #$($Issue). Se o agente principal (Elephant) apresentar evidencia de que uma decisao de design foi expressamente solicitada e aprovada pelo usuario, aceite a evidencia sem bloquear a aprovacao por preferencia subjetiva.",
    "Diretriz: Seja conciso. Nao elogie o codigo nem resuma o que ele faz. Categorize cada apontamento real (ex.: [BDD/TDD], [Clean Code], [Serverless/Cloud Run], [Tipagem], [Bug Logico/Caso de Borda]) com linha/trecho e sugestao de correcao. Se todos os criterios da Issue #$($Issue) foram cumpridos, responda apenas 'APROVADO'."
)

$prompt = $promptLines -join "`r`n"

# 4. Copia para a area de transferencia e persiste em scratch/review_prompt.md e scratch/review_prompt_issue_<ID>.md
try {
    Set-Clipboard -Value $prompt
} catch {
    # Ignora caso clipboard nao esteja disponivel
}

$scratchDir = Join-Path $PSScriptRoot "..\scratch"
if (-not (Test-Path $scratchDir)) {
    New-Item -ItemType Directory -Path $scratchDir -Force | Out-Null
}
$promptFile = Join-Path $scratchDir "review_prompt.md"
$promptIssueFile = Join-Path $scratchDir "review_prompt_issue_$($Issue).md"
[System.IO.File]::WriteAllText($promptFile, $prompt, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($promptIssueFile, $prompt, [System.Text.Encoding]::UTF8)

Write-Host "[OK] Prompt gravado em '$promptFile' (e '$promptIssueFile') para a issue #$Issue!" -ForegroundColor Green
Write-Host "[DICA] O agente executor le '$promptIssueFile' para validar com subagente autonomo (🐠 Goldfish) ate APROVADO." -ForegroundColor Cyan
