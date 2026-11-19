"""
Portão Determinístico Unificado de 12 Gates de Auditoria e Verificação do Awencanto (scripts/audit-verify.py).

Executa em sequência os 12 Portões Determinísticos (Regra 1.7.2 e Regra 1.18):
 1. Lockfile & Dependency Sync (check-lockfile-sync.py)
 2. Python Syntax & Bytecode Compile (py_compile)
 3. Structural AST Security & Guardrails (ast-grep + Cloud Run static guardrails)
 4. Architecture Boundaries & Zero Circular Imports (dependency-cruiser + check-architecture-boundaries.py)
 5. Dead Code & Unused Symbols (knip + check-dead-code.py)
 6. Prompt & Model Registry Integrity (prompt_models_registry.json + templates .md)
 7. RVC v2 & Solfeggio Acoustic Safety (URI prefix validation + pickle-free serialization)
 8. Triple Telemetry & Financial Buckets Contract (4 visões financeiras + is_test_account)
 9. Archify 3D & Graph Anti-Drift (sync-architecture-graph.mjs --check)
10. Semantic Test Naming Governance (check-test-naming-governance.py)
11. Automated Pytest Suite (pytest nos 5 domínios)
12. Clean Code 22/22 Zero Tolerance Audit (scan-clean-code.mjs --enforce-zero-rules)
"""

from __future__ import annotations

import json
from pathlib import Path
import py_compile
import shutil
import subprocess
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent


def _resolve_python_executable() -> str:
    venv_win = REPO_ROOT / ".venv" / "Scripts" / "python.exe"
    if venv_win.exists():
        return str(venv_win)
    venv_unix = REPO_ROOT / ".venv" / "bin" / "python"
    if venv_unix.exists():
        return str(venv_unix)
    return sys.executable


def _resolve_cli_binary(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    win_cmd = shutil.which(f"{name}.cmd")
    return win_cmd or name


def _run_subprocess(args: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(
        args,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    output = f"{proc.stdout}\n{proc.stderr}".strip()
    return proc.returncode == 0, output


def gate_01_lockfile_sync() -> tuple[bool, str]:
    script = REPO_ROOT / "scripts" / "check-lockfile-sync.py"
    return _run_subprocess([_resolve_python_executable(), str(script)])


def _compile_folder(folder: str) -> list[str]:
    target_dir = REPO_ROOT / folder
    if not target_dir.exists():
        return []
    errors: list[str] = []
    for py_file in target_dir.rglob("*.py"):
        try:
            py_compile.compile(str(py_file), doraise=True)
        except py_compile.PyCompileError as exc:
            errors.append(str(exc))
    return errors


def gate_02_py_compile() -> tuple[bool, str]:
    errors: list[str] = []
    for folder in ("app", "scripts", "tests"):
        errors.extend(_compile_folder(folder))
    if errors:
        return False, "; ".join(errors)
    return True, "Sintaxe Python (py_compile) validada em app/, scripts/ e tests/."


def _check_static_cloudrun_guardrails() -> list[str]:
    errors: list[str] = []
    for py_file in (REPO_ROOT / "app").rglob("*.py"):
        content = py_file.read_text(encoding="utf-8", errors="ignore")
        rel = py_file.relative_to(REPO_ROOT).as_posix()
        if "fal_client.subscribe(" in content:
            errors.append(f"[Regra 1.5.3] Uso proibido de fal_client.subscribe em {rel}.")

    main_content = (REPO_ROOT / "app" / "main.py").read_text(encoding="utf-8", errors="ignore")
    if "hmac.compare_digest" not in main_content:
        errors.append("[Regra 1.5.5] hmac.compare_digest ausente em app/main.py.")
    if "shutil.rmtree" not in main_content:
        errors.append("[Regra 1.5.4] shutil.rmtree ausente em app/main.py.")

    for doc_name in ("PRD.md", "ARCHITECTURE.md", "DIRETRIZES_CRIATIVAS.md"):
        if not (REPO_ROOT / "docs" / doc_name).exists():
            errors.append(f"[Regra 1.4] Documento obrigatório ausente: docs/{doc_name}.")
    return errors


def gate_03_ast_grep_and_security_guardrails() -> tuple[bool, str]:
    static_errs = _check_static_cloudrun_guardrails()
    if static_errs:
        return False, "; ".join(static_errs)
    npx_bin = _resolve_cli_binary("npx")
    ok_sg, out_sg = _run_subprocess([npx_bin, "ast-grep", "scan"])
    if not ok_sg:
        return False, out_sg
    return True, "Guardrails AST (ast-grep) e Cloud Run/Segurança validados."


def gate_04_architecture_boundaries() -> tuple[bool, str]:
    npx_bin = _resolve_cli_binary("npx")
    ok_dc, out_dc = _run_subprocess([npx_bin, "depcruise", "scripts", "--config", ".dependency-cruiser.cjs"])
    if not ok_dc:
        return False, out_dc
    py_script = REPO_ROOT / "scripts" / "check-architecture-boundaries.py"
    return _run_subprocess([_resolve_python_executable(), str(py_script)])


def gate_05_dead_code_and_knip() -> tuple[bool, str]:
    npx_bin = _resolve_cli_binary("npx")
    ok_knip, out_knip = _run_subprocess([npx_bin, "knip", "--config", "knip.jsonc", "--no-progress"])
    if not ok_knip:
        return False, out_knip
    py_script = REPO_ROOT / "scripts" / "check-dead-code.py"
    return _run_subprocess([_resolve_python_executable(), str(py_script)])


def gate_06_prompt_and_registry_integrity() -> tuple[bool, str]:
    prompts_dir = REPO_ROOT / "app" / "prompts"
    reg_path = prompts_dir / "prompt_models_registry.json"
    if not reg_path.exists():
        return False, "prompt_models_registry.json ausente em app/prompts/."
    registry = json.loads(reg_path.read_text(encoding="utf-8")).get("prompts", {})
    for stage_key in ("audio_diagnosis", "solfeggio_decision", "lyrics_composer", "music_generation"):
        if stage_key not in registry:
            return False, f"Estágio '{stage_key}' ausente em prompt_models_registry.json."
    for md_file in ("audio_diagnosis.md", "lyrics_composer.md", "vocal_language_section.md", "music_generation_eclectic_celtic.md"):
        if not (prompts_dir / md_file).exists():
            return False, f"Template de prompt obrigatório ausente: app/prompts/{md_file}."
    return True, "Integridade de templates .md/XML e prompt_models_registry.json validada."


def gate_07_rvc_and_solfeggio_acoustic_safety() -> tuple[bool, str]:
    rvc_text = (REPO_ROOT / "app" / "services" / "rvc_service.py").read_text(encoding="utf-8")
    for required_token in ("validate_model_gcs_uri", "submit_process_song_job", "get_voice_acoustic_profile"):
        if required_token not in rvc_text:
            return False, f"Guardrail obrigatório RVC v2 ({required_token}) ausente em app/services/rvc_service.py."
    if "pickle.loads" in rvc_text or "MAGIC_PTH_HEADER" in rvc_text:
        return False, "Código sintético legado (MAGIC_PTH_HEADER) ou pickle.loads detectado em rvc_service.py."
    for legacy_file in (
        REPO_ROOT / "app" / "services" / "rvc_v2_models.py",
        REPO_ROOT / "app" / "services" / "fal_audio_service.py",
        REPO_ROOT / "scripts" / "train_rvc_cloudbuild.py",
    ):
        if legacy_file.exists():
            return False, f"Arquivo legado proibido (Zero-Zombie Regra 1.12) ainda existe: {legacy_file.name}."
    return True, "Segurança acústica RVC v2 Oficial (Cloud Run Job dispatch + validação de prefixo GCS) validada."


def gate_08_triple_telemetry_contract() -> tuple[bool, str]:
    tel_text = (REPO_ROOT / "app" / "services" / "telemetry_service.py").read_text(encoding="utf-8")
    for required_token in ("invoice_total", "production", "failed_and_retries", "dev_and_test", "is_test_account"):
        if required_token not in tel_text:
            return False, f"Token obrigatório de telemetria '{required_token}' ausente em telemetry_service.py."
    return True, "Contrato de Telemetria Tripla, 4 visões financeiras e is_test_account validados."


def gate_09_archify_anti_drift() -> tuple[bool, str]:
    node_bin = _resolve_cli_binary("node")
    script = REPO_ROOT / "scripts" / "sync-architecture-graph.mjs"
    return _run_subprocess([node_bin, str(script), "--check"])


def gate_10_test_naming_governance() -> tuple[bool, str]:
    script = REPO_ROOT / "scripts" / "check-test-naming-governance.py"
    return _run_subprocess([_resolve_python_executable(), str(script)])


def gate_11_pytest_suite() -> tuple[bool, str]:
    return _run_subprocess([_resolve_python_executable(), "-m", "pytest", "-q"])


def gate_12_clean_code_zero_tolerance() -> tuple[bool, str]:
    node_bin = _resolve_cli_binary("node")
    scanner = REPO_ROOT / ".agent" / "skills" / "clean-code-audit" / "scripts" / "scan-clean-code.mjs"
    return _run_subprocess([node_bin, str(scanner), "--enforce-zero-rules"])


def main() -> int:
    sys.stdout.write("=== Awencanto 12-Gate Deterministic Audit (scripts/audit-verify.py) ===\n")
    gates = [
        ("01/12 Lockfile & Dependency Sync", gate_01_lockfile_sync),
        ("02/12 Python Bytecode Compile", gate_02_py_compile),
        ("03/12 Structural AST & Security Guardrails", gate_03_ast_grep_and_security_guardrails),
        ("04/12 Architecture Boundaries & DAG", gate_04_architecture_boundaries),
        ("05/12 Dead Code & Unused Symbols (Knip + AST)", gate_05_dead_code_and_knip),
        ("06/12 Prompt & Model Registry Integrity", gate_06_prompt_and_registry_integrity),
        ("07/12 RVC v2 & Solfeggio Acoustic Safety", gate_07_rvc_and_solfeggio_acoustic_safety),
        ("08/12 Triple Telemetry & Financial Contract", gate_08_triple_telemetry_contract),
        ("09/12 Archify 3D & Graph Anti-Drift", gate_09_archify_anti_drift),
        ("10/12 Semantic Test Naming Governance", gate_10_test_naming_governance),
        ("11/12 Automated Pytest Suite (5 Domains)", gate_11_pytest_suite),
        ("12/12 Clean Code 22/22 Zero Tolerance", gate_12_clean_code_zero_tolerance),
    ]
    for label, gate_fn in gates:
        ok, details = gate_fn()
        status_str = "OK  " if ok else "FAIL"
        sys.stdout.write(f"[{label}] {status_str} - {details}\n")
        if not ok:
            return 1

    sys.stdout.write("=== RESULTADO FINAL: 12/12 GATES APROVADOS (Exit Code 0) ===\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
