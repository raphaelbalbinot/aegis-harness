"""
Analisador Determinístico de Blast Radius AST para Python/FastAPI no Awencanto (Regra 1.7.1 e Regra 1.11).

Uso:
  python scripts/blast-radius.py <arquivo> [--json]
"""

import argparse
import ast
import json
from pathlib import Path
import sys
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
HIGH_RISK_THRESHOLD = 4
MEDIUM_RISK_THRESHOLD = 2

AXIS_MAPPING = {
    "app/services/solfeggio_decider.py": "Eixo 1 — Prescrição Terapêutica & Geração Musical IA (Gemini 4 & Lyria)",
    "app/services/lyria_service.py": "Eixo 1 — Prescrição Terapêutica & Geração Musical IA (Gemini 4 & Lyria)",
    "app/services/fal_audio_service.py": "Eixo 2 — Engenharia Vocal Assíncrona & Pós-Produção Acústica (Fal.ai & FFmpeg)",
    "app/services/ffmpeg_mixer.py": "Eixo 2 — Engenharia Vocal Assíncrona & Pós-Produção Acústica (Fal.ai & FFmpeg)",
    "app/services/firestore_service.py": "Eixo 3 — Persistência Multiusuário, Segurança & Telemetria Tripla (Firestore & GCS)",
    "app/services/gcs_storage.py": "Eixo 3 — Persistência Multiusuário, Segurança & Telemetria Tripla (Firestore & GCS)",
    "app/services/telemetry_service.py": "Eixo 3 — Persistência Multiusuário, Segurança & Telemetria Tripla (Firestore & GCS)",
    "app/main.py": "Eixo 4 — Contratos de API, Orquestração & Experiência Web (FastAPI)",
    "app/schemas.py": "Eixo 4 — Contratos de API, Orquestração & Experiência Web (FastAPI)",
    "app/config.py": "Eixo 5 — Infraestrutura Serverless, CI/CD & Governança",
}


def _module_name_from_path(py_file: Path) -> str:
    rel = py_file.relative_to(REPO_ROOT).with_suffix("")
    return ".".join(rel.parts)


def _extract_imports(py_file: Path) -> set[str]:
    try:
        tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
    except Exception:
        return set()

    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module)
    return imports


def _matches_module_dependency(imported_modules: set[str], target_module: str) -> bool:
    return any(
        imp == target_module or imp.startswith(f"{target_module}.") or target_module.startswith(f"{imp}.")
        for imp in imported_modules
    )


def _find_direct_dependents_and_tests(
    target_rel: str,
    target_module: str,
) -> tuple[list[str], list[str]]:
    all_py_files = list((REPO_ROOT / "app").rglob("*.py")) + list((REPO_ROOT / "tests").rglob("*.py"))
    direct_dependents: list[str] = []
    impacted_tests: list[str] = []

    for py_file in all_py_files:
        rel = py_file.relative_to(REPO_ROOT).as_posix()
        if rel == target_rel or not _matches_module_dependency(_extract_imports(py_file), target_module):
            continue
        if rel.startswith("tests/"):
            impacted_tests.append(rel)
        else:
            direct_dependents.append(rel)
    return direct_dependents, impacted_tests


def _append_indirect_tests(direct_dependents: list[str], impacted_tests: list[str]) -> None:
    dependent_modules = {dep.replace("/", ".").removesuffix(".py") for dep in direct_dependents}
    for py_file in (REPO_ROOT / "tests").rglob("*.py"):
        rel = py_file.relative_to(REPO_ROOT).as_posix()
        if rel not in impacted_tests and (_extract_imports(py_file) & dependent_modules):
            impacted_tests.append(rel)


def _classify_risk_level(normalized: str, total_dependents: int) -> str:
    if normalized in ("app/schemas.py", "app/config.py", "app/main.py") or total_dependents >= HIGH_RISK_THRESHOLD:
        return "HIGH"
    if total_dependents >= MEDIUM_RISK_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def _compute_ceremony_tier(normalized: str, risk_level: str, direct_dependents: list[str]) -> str:
    lower_path = normalized.lower()
    is_security_sensitive = any(tok in lower_path for tok in ("auth", "security", "webhook", "oidc", "firestore.rules"))
    if risk_level == "LOW" and len(direct_dependents) == 0 and not is_security_sensitive:
        return "XS_EXPRESS"
    return "FULL_EGM_DAG"


def analyze_blast_radius(target_rel_path: str) -> dict[str, Any]:
    normalized = target_rel_path.strip().replace("\\", "/").lstrip("./")
    target_path = REPO_ROOT / normalized
    target_module = (
        _module_name_from_path(target_path)
        if target_path.exists() and target_path.suffix == ".py"
        else normalized.replace("/", ".").removesuffix(".py")
    )

    direct_dependents, impacted_tests = _find_direct_dependents_and_tests(normalized, target_module)
    _append_indirect_tests(direct_dependents, impacted_tests)
    risk_level = _classify_risk_level(normalized, len(direct_dependents) + len(impacted_tests))
    ceremony_tier = _compute_ceremony_tier(normalized, risk_level, direct_dependents)
    axis = AXIS_MAPPING.get(normalized, "Eixo 5 — Infraestrutura Serverless, CI/CD & Governança")

    return {
        "target_file": normalized,
        "target_module": target_module,
        "governance_axis": axis,
        "risk_level": risk_level,
        "ceremony_tier": ceremony_tier,
        "direct_dependents": sorted(direct_dependents),
        "impacted_tests": sorted(impacted_tests),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Calcula o Blast Radius AST de um módulo do Awencanto.")
    parser.add_argument("target", help="Caminho relativo do arquivo (ex.: app/schemas.py).")
    parser.add_argument("--json", action="store_true", help="Emite saída em formato JSON.")
    args = parser.parse_args()

    report = analyze_blast_radius(args.target)
    if args.json:
        sys.stdout.write(f"{json.dumps(report, indent=2, ensure_ascii=False)}\n")
    else:
        sys.stdout.write(f"Alvo: {report['target_file']} ({report['risk_level']})\n")
        sys.stdout.write(f"Eixo: {report['governance_axis']}\n")
        sys.stdout.write(
            f"Dependentes diretos ({len(report['direct_dependents'])}): {', '.join(report['direct_dependents']) or 'nenhum'}\n"
        )
        sys.stdout.write(
            f"Testes impactados ({len(report['impacted_tests'])}): {', '.join(report['impacted_tests']) or 'nenhum'}\n"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
