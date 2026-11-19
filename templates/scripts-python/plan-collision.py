"""
Detector Determinístico de Colisão de Planos Ativos (Regra 1.3.4 de AGENTS.md).
Mantém registro em .git/active-plans.json para bloquear issues concorrentes que toquem nos mesmos arquivos.

Comandos suportados:
  python scripts/plan-collision.py register --issue <ID> --files <arq1,arq2,...>
  python scripts/plan-collision.py check [--issue <ID>] [--files <arq1,arq2,...>]
  python scripts/plan-collision.py release --issue <ID>
  python scripts/plan-collision.py list
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
ACTIVE_PLANS_FILE = REPO_ROOT / ".git" / "active-plans.json"


def _normalize_path(file_path: str) -> str:
    return file_path.strip().replace("\\", "/").lstrip("./")


def _load_plans() -> dict[str, dict[str, Any]]:
    if not ACTIVE_PLANS_FILE.exists():
        return {}
    try:
        plans_payload = json.loads(ACTIVE_PLANS_FILE.read_text(encoding="utf-8"))
        if isinstance(plans_payload, dict):
            return plans_payload
    except Exception:
        pass
    return {}


def _save_plans(plans: dict[str, dict[str, Any]]) -> None:
    ACTIVE_PLANS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ACTIVE_PLANS_FILE.write_text(
        json.dumps(plans, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _find_collisions(
    plans: dict[str, dict[str, Any]],
    candidate_issue: str,
    candidate_files: list[str],
) -> list[dict[str, Any]]:
    collisions: list[dict[str, Any]] = []
    candidate_set = {_normalize_path(f) for f in candidate_files if f.strip()}
    for issue_id, entry in plans.items():
        if str(issue_id) == str(candidate_issue):
            continue
        existing_files = {_normalize_path(f) for f in entry.get("files", [])}
        overlap = sorted(candidate_set.intersection(existing_files))
        if overlap:
            collisions.append({"conflicting_issue": issue_id, "overlapping_files": overlap})
    return collisions


def _find_all_plan_collisions(plans: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    collisions: list[dict[str, Any]] = []
    issue_ids = list(plans.keys())
    pairs = [
        (issue_a, issue_b)
        for idx, issue_a in enumerate(issue_ids)
        for issue_b in issue_ids[idx + 1 :]
    ]
    for issue_a, issue_b in pairs:
        files_a = set(plans[issue_a].get("files", []))
        overlap = sorted(files_a.intersection(set(plans[issue_b].get("files", []))))
        if overlap:
            collisions.append({"issues": [issue_a, issue_b], "overlapping_files": overlap})
    return collisions


def _handle_register(plans: dict[str, dict[str, Any]], issue_id: str, raw_files: str) -> int:
    files = [_normalize_path(f) for f in raw_files.split(",") if f.strip()]
    collisions = _find_collisions(plans, issue_id, files)
    if collisions:
        payload = {"status": "COLLISION_DETECTED", "issue": issue_id, "collisions": collisions}
        sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
        return 1

    plans[issue_id] = {
        "issue": issue_id,
        "files": sorted(set(files)),
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_plans(plans)
    payload = {"status": "REGISTERED", "issue": issue_id, "files": plans[issue_id]["files"]}
    sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    return 0


def _handle_check(plans: dict[str, dict[str, Any]], issue_id: str, raw_files: str) -> int:
    if raw_files:
        files = [_normalize_path(f) for f in raw_files.split(",") if f.strip()]
        collisions = _find_collisions(plans, issue_id or "candidate", files)
    else:
        collisions = _find_all_plan_collisions(plans)
    if collisions:
        payload = {"status": "COLLISION_DETECTED", "collisions": collisions}
        sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
        return 1
    sys.stdout.write(f"{json.dumps({'status': 'OK', 'active_plans_count': len(plans)}, indent=2)}\n")
    return 0


def _handle_release(plans: dict[str, dict[str, Any]], issue_id: str) -> int:
    removed = plans.pop(issue_id, None)
    _save_plans(plans)
    payload = {"status": "RELEASED", "issue": issue_id, "was_present": removed is not None}
    sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    return 0


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gerenciador de planos ativos e detecção de colisão de arquivos (.git/active-plans.json)."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    reg_parser = subparsers.add_parser("register", help="Registra arquivos planejados para uma Issue.")
    reg_parser.add_argument("--issue", required=True, help="Número ou identificador da Issue.")
    reg_parser.add_argument("--files", required=True, help="Lista de arquivos separados por vírgula.")

    chk_parser = subparsers.add_parser("check", help="Verifica colisões entre planos ativos.")
    chk_parser.add_argument("--issue", default="", help="Issue opcional a verificar.")
    chk_parser.add_argument("--files", default="", help="Lista opcional de arquivos separados por vírgula.")

    rel_parser = subparsers.add_parser("release", help="Libera o plano ativo de uma Issue concluída.")
    rel_parser.add_argument("--issue", required=True, help="Número ou identificador da Issue.")
    subparsers.add_parser("list", help="Lista todos os planos ativos registrados.")
    return parser


def main() -> int:
    args = _build_arg_parser().parse_args()
    plans = _load_plans()
    if args.command == "register":
        return _handle_register(plans, str(args.issue), args.files)
    if args.command == "check":
        return _handle_check(plans, str(args.issue), args.files)
    if args.command == "release":
        return _handle_release(plans, str(args.issue))
    sys.stdout.write(f"{json.dumps({'active_plans': plans}, indent=2, ensure_ascii=False)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
