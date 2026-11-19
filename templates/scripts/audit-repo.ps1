Push-Location

try {
    $repoRoot = git rev-parse --show-toplevel 2>$null
    if ($repoRoot) {
        Set-Location -Path $repoRoot
    }

    # 1. Arvore de arquivos do projeto sem pipes (excluindo artefatos auxiliares do workspace/scratch)
    $allFiles = git ls-files
    $treeFiles = $allFiles -notmatch 'node_modules|\.git|dist|build|\.next|^workspace/|^scratch/'
    $treeContent = $treeFiles -join "`r`n"

    # 2. Manifestos de dependencias (raiz, frontend e backend)
    $packageJsonContent = ""
    if (Test-Path -Path "package.json") {
        $packageJsonContent += "// package.json (raiz)`r`n" + (Get-Content -Path "package.json" -Raw -ErrorAction SilentlyContinue) + "`r`n"
    }
    if (Test-Path -Path "frontend/package.json") {
        $packageJsonContent += "// frontend/package.json`r`n" + (Get-Content -Path "frontend/package.json" -Raw -ErrorAction SilentlyContinue) + "`r`n"
    }
    if (Test-Path -Path "backend/package.json") {
        $packageJsonContent += "// backend/package.json`r`n" + (Get-Content -Path "backend/package.json" -Raw -ErrorAction SilentlyContinue)
    }

    # 3. Analise de dependencias e fronteiras (frontend/src e backend/src)
    $depCruiserContent = "Nao executado"
    if (Test-Path -Path ".dependency-cruiser.js") {
        $depResult = npx depcruise --config .dependency-cruiser.js frontend/src backend/src 2>&1
        if ($depResult) {
            $depCruiserContent = $depResult -join "`r`n"
        }
    }

    # 4. Verificacao de tipos estaticos nos workspaces (frontend e backend)
    $tscFrontendResult = npm run typecheck --prefix frontend 2>&1
    $tscBackendResult = npm run typecheck --prefix backend 2>&1
    $tscContent = "// Frontend typecheck:`r`n" + (($tscFrontendResult | Out-String).Trim()) + "`r`n`r`n// Backend typecheck:`r`n" + (($tscBackendResult | Out-String).Trim())

    # 4.1 Guardrails Sintaticos (ast-grep) e Codigo Morto (Knip)
    $astGrepResult = npm run ast:scan 2>&1
    $knipResult = npm run audit:dead-code 2>&1
    $guardrailsContent = "// ast-grep (governanca sintatica):`r`n" + (($astGrepResult | Out-String).Trim()) + "`r`n`r`n// knip (codigo morto e dependencias orfas):`r`n" + (($knipResult | Out-String).Trim())

    # 4.2 Contexto Incremental de Issues do GitHub (abertas) e Estrutura Oficial (docs/ARCHITECTURE.md)
    $openIssuesRaw = gh issue list --state open --limit 30 2>$null
    $openIssuesContent = if ($openIssuesRaw) { $openIssuesRaw -join "`r`n" } else { "Nenhuma issue aberta listada no momento." }

    $archOutlineContent = "Arquivo docs/ARCHITECTURE.md nao encontrado."
    if (Test-Path -Path "docs/ARCHITECTURE.md") {
        $archHeadings = Get-Content -Path "docs/ARCHITECTURE.md" -Encoding UTF8 -ErrorAction SilentlyContinue | Where-Object { $_ -match '^#{1,3}\s+' }
        if ($archHeadings) {
            $archOutlineContent = $archHeadings -join "`r`n"
        }
    }

    # 5. Montagem do prompt de auditoria global
    $promptLines = @(
        "Papel: Arquiteto de Software e Auditor de Seguranca Senior.",
        "Contexto:",
        "Auditoria estrutural e arquitetural do monorepo TypeScript/Node (Mesa Editorial Heldora - Next.js App Router + Backend Cloud Run Serverless).",
        "",
        "0. Panorama Incremental (Issues Abertas no GitHub e Indice do docs/ARCHITECTURE.md):",
        "- Issues Abertas (Backlog Incremental Planejado - NAO aponte itens ja mapeados aqui como defeito estrutural):",
        '```text',
        $openIssuesContent,
        '```',
        "- Indice Arquitetural Oficial (docs/ARCHITECTURE.md):",
        '```text',
        $archOutlineContent,
        '```',
        "",
        "1. Arvore de arquivos do repositorio:",
        '```text',
        $treeContent,
        '```',
        "",
        "2. Manifestos package.json (raiz, frontend/package.json e backend/package.json):",
        '```json',
        $packageJsonContent,
        '```',
        "",
        "3. Relatorio de Fronteiras / Dependency-Cruiser (frontend/src e backend/src):",
        '```text',
        $depCruiserContent,
        '```',
        "",
        "4. Verificacao de Tipos nos Workspaces (frontend e backend):",
        '```text',
        $tscContent,
        '```',
        "",
        "5. Guardrails Sintaticos (ast-grep) e Codigo Morto (Knip):",
        '```text',
        $guardrailsContent,
        '```',
        "",
        "Objetivo:",
        "Avalie estritamente com base nos metadados, estrutura e relatorios:",
        "1. [Fronteiras, Estrutura e Drift Arquitetural]: Ha violacoes de camadas arquiteturais (Client/Server), divergencia entre a arvore real de arquivos e o docs/ARCHITECTURE.md, ou arquivos de codigo/testes fora de seus diretorios de dominio semantico (Regra 1.14)?",
        "2. [Saude de Dependencias]: Ha riscos de dependencias obsoletas, conflitantes, duplicadas ou orfas nos package.json?",
        "3. [Tipagem e Governanca Cloud Run]: Ha falhas criticas de tipagem, violacoes de guardrails sintaticos ou riscos de arquitetura Serverless/Stateless (Regra 1.5 e Regra 1.12)?",
        "",
        "Diretriz: Seja conciso (opere em modo Low Thinking: direto ao ponto, sem preambulos). Respeite a evolucao incremental do projeto (nao cobre itens que pertencem as Issues abertas listadas acima). Caso encontre problemas concretos, classifique por impacto (Alta/Media/Baixa) e agrupe-os como 'Propostas de Novas Issues Atomicas' (separadas pelos 5 Eixos da Regra 1.11) para aprovacao do usuario antes de qualquer alteracao de codigo. Se a saude estrutural estiver integra, responda 'APROVADO'."
    )

    $prompt = $promptLines -join "`r`n"
    Set-Clipboard -Value $prompt

    $scratchDir = Join-Path $PSScriptRoot "..\scratch"
    if (-not (Test-Path $scratchDir)) {
        New-Item -ItemType Directory -Path $scratchDir -Force | Out-Null
    }
    $promptFile = Join-Path $scratchDir "audit_prompt.md"
    [System.IO.File]::WriteAllText($promptFile, $prompt, [System.Text.Encoding]::UTF8)

    Write-Host "[OK] Auditoria estrutural gravada em '$promptFile' e copiada para a area de transferencia!" -ForegroundColor Green
    Write-Host "[DICA] Voce pode pedir a um subagente (Model: 'pro' em Low Thinking) para ler '$promptFile' e emitir o parecer arquitetural." -ForegroundColor Cyan

}
finally {
    Pop-Location
}