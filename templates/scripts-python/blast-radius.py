"""
Analisador Determinístico de Blast Radius AST para Python (Aegis Harness v2).

Uso:
  python scripts/blast-radius.py <arquivo> [--json]
"""

import argparse
import ast
import json
from pathlib import Path
import re
import sys
import time
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
HIGH_RISK_THRESHOLD = 4
MEDIUM_RISK_THRESHOLD = 2
_DEFAULT_SECURITY_SURFACE_RE = re.compile(
    r"(?:^|/)(?:api|routes|webhooks?|auth|oidc|security|storage|ai|prompts|workers?)(?:/|$)|"
    r"(?:^|/|[._-])(?:auth|oidc|security|webhook|jwt|oauth|rbac|sanitize)(?:[._-]|/|$)|"
    r"(?:^|/)(?:main\.py|schemas\.py|firestore\.rules|storage\.rules)$",
    re.IGNORECASE,
)
_WEB_FILE_RE = re.compile(r"\.(?:tsx|jsx|css|scss|html|vue|svelte)$", re.IGNORECASE)


def _load_harness_security_patterns() -> list[re.Pattern[str]]:
    cfg_path = REPO_ROOT / "harness.config.json"
    if not cfg_path.exists():
        return []
    try:
        parsed = json.loads(cfg_path.read_text(encoding="utf-8"))
        raw_patterns = parsed.get("blastRadius", {}).get("securityPatterns", [])
        compiled: list[re.Pattern[str]] = []
        for pattern in raw_patterns:
            try:
                compiled.append(re.compile(str(pattern), re.IGNORECASE))
            except re.error:
                continue
        return compiled
    except Exception:
        return []


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
    search_dirs = [REPO_ROOT / d for d in ("app", "src", "tests") if (REPO_ROOT / d).exists()]
    all_py_files: list[Path] = []
    for base in search_dirs:
        all_py_files.extend(base.rglob("*.py"))
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
    tests_dir = REPO_ROOT / "tests"
    if not tests_dir.exists():
        return
    dependent_modules = {dep.replace("/", ".").removesuffix(".py") for dep in direct_dependents}
    for py_file in tests_dir.rglob("*.py"):
        rel = py_file.relative_to(REPO_ROOT).as_posix()
        if rel not in impacted_tests and (_extract_imports(py_file) & dependent_modules):
            impacted_tests.append(rel)


def _classify_risk_level(normalized: str, total_dependents: int) -> str:
    if normalized in ("app/schemas.py", "app/config.py", "app/main.py") or total_dependents >= HIGH_RISK_THRESHOLD:
        return "HIGH"
    if total_dependents >= MEDIUM_RISK_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def _is_security_surface(normalized: str) -> bool:
    if normalized.startswith("tests/"):
        return False
    if _DEFAULT_SECURITY_SURFACE_RE.search(normalized):
        return True
    return any(p.search(normalized) for p in _load_harness_security_patterns())


def _compute_ceremony_tier(
    risk_level: str,
    direct_dependents: list[str],
    security_surface_touched: bool = False,
) -> str:
    if risk_level == "LOW" and len(direct_dependents) == 0 and not security_surface_touched:
        return "XS_EXPRESS"
    return "FULL_EGM_DAG"


def _compute_recommended_skills(
    normalized: str,
    ceremony_tier: str,
    security_surface_touched: bool,
) -> list[str]:
    skills: list[str] = []
    if not normalized.endswith(".md"):
        skills.extend(["test-driven-development", "code-review-and-quality"])
    if security_surface_touched:
        skills.append("mantis-advise")
    if _WEB_FILE_RE.search(normalized):
        skills.extend(["accessibility", "core-web-vitals"])
    if ceremony_tier == "FULL_EGM_DAG":
        skills.extend(["egm-goldfish-review", "clean-code-audit"])
    return list(dict.fromkeys(skills))


def _record_blast_radius_stamp(
    normalized: str,
    ceremony_tier: str,
    plan_goldfish_required: bool,
    code_goldfish_required: bool,
) -> None:
    git_dir = REPO_ROOT / ".git"
    if not git_dir.exists():
        return
    stamp_path = git_dir / "aegis-gate-stamp.json"
    current: dict[str, Any] = {}
    if stamp_path.exists():
        try:
            current = json.loads(stamp_path.read_text(encoding="utf-8"))
        except Exception:
            current = {}
    current["blastRadiusEvaluation"] = {
        "planGoldfishRequired": plan_goldfish_required,
        "codeGoldfishRequired": code_goldfish_required,
        "ceremonyTier": ceremony_tier,
        "evaluatedFiles": [normalized],
        "evaluatedAt": int(time.time() * 1000),
    }
    stamp_path.write_text(json.dumps(current, indent=2), encoding="utf-8")


def _resolve_target_module(normalized: str) -> str:
    target_path = REPO_ROOT / normalized
    if target_path.exists() and target_path.suffix == ".py":
        return _module_name_from_path(target_path)
    return normalized.replace("/", ".").removesuffix(".py")


def analyze_blast_radius(target_rel_path: str) -> dict[str, Any]:
    normalized = target_rel_path.strip().replace("\\", "/").lstrip("./")
    target_module = _resolve_target_module(normalized)
    direct_dependents, impacted_tests = _find_direct_dependents_and_tests(normalized, target_module)
    _append_indirect_tests(direct_dependents, impacted_tests)
    risk_level = _classify_risk_level(normalized, len(direct_dependents) + len(impacted_tests))
    security_surface_touched = _is_security_surface(normalized)
    related_docs = ["workspace/kb/THREAT_MODEL.md"] if security_surface_touched else []
    ceremony_tier = _compute_ceremony_tier(risk_level, direct_dependents, security_surface_touched)
    plan_goldfish_required = ceremony_tier != "XS_EXPRESS"
    code_goldfish_required = not normalized.endswith(".md")
    recommended_skills = _compute_recommended_skills(normalized, ceremony_tier, security_surface_touched)
    return {
        "target_file": normalized,
        "target_module": target_module,
        "risk_level": risk_level,
        "ceremony_tier": ceremony_tier,
        "plan_goldfish_required": plan_goldfish_required,
        "code_goldfish_required": code_goldfish_required,
        "goldfish_required": code_goldfish_required,
        "recommended_skills": recommended_skills,
        "security_surface_touched": security_surface_touched,
        "related_docs": related_docs,
        "direct_dependents": sorted(direct_dependents),
        "impacted_tests": sorted(impacted_tests),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Calcula o Blast Radius AST de um módulo Python.")
    parser.add_argument("target", help="Caminho relativo do arquivo (ex.: app/schemas.py).")
    parser.add_argument("--json", action="store_true", help="Emite saída em formato JSON.")
    args = parser.parse_args()

    report = analyze_blast_radius(args.target)
    _record_blast_radius_stamp(
        report["target_file"],
        report["ceremony_tier"],
        report["plan_goldfish_required"],
        report["code_goldfish_required"],
    )
    if args.json:
        sys.stdout.write(f"{json.dumps(report, indent=2, ensure_ascii=False)}\n")
    else:
        sys.stdout.write(
            f"[BLAST RADIUS] {report['target_file']} | Risco: {report['risk_level']} | Tier: {report['ceremony_tier']}\n"
        )
        sys.stdout.write(f"  planGoldfishRequired: {report['plan_goldfish_required']} | codeGoldfishRequired: {report['code_goldfish_required']}\n")
        sys.stdout.write(f"  recommendedSkills: {', '.join(report['recommended_skills'])}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
