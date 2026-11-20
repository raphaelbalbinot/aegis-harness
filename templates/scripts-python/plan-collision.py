"""
Detector Determinístico de Colisão de Planos Ativos (Regra 1.3.4) e Hard Sandbox de Whitelist (GF-01).
Mantém registro em .git/active-plans.json para bloquear issues concorrentes que toquem nos mesmos arquivos
e fiscaliza fisicamente (SHA-256 + Base64) o confinamento de arquivos de cada fatia DAG.

Comandos suportados:
  python scripts/plan-collision.py register --issue <ID> --files <arq1,arq2,...> [--root <dir>]
  python scripts/plan-collision.py check [--issue <ID>] [--files <arq1,arq2,...>] [--root <dir>]
  python scripts/plan-collision.py release --issue <ID> [--root <dir>]
  python scripts/plan-collision.py snapshot-slice --slice <ID> --files <arq1,arq2,...> [--root <dir>]
  python scripts/plan-collision.py verify-slice --slice <ID> [--files <arq1,arq2,...>] [--revert-unauthorized] [--root <dir>]
  python scripts/plan-collision.py list [--root <dir>]
"""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
ACTIVE_PLANS_FILE = REPO_ROOT / ".git" / "active-plans.json"


def _resolve_root(raw_root: str) -> Path:
    return Path(raw_root).resolve() if raw_root else REPO_ROOT


def _resolve_plans_file(target_root: Path) -> Path:
    return target_root / ".git" / "active-plans.json"


def _normalize_path(file_path: str, target_root: Path = REPO_ROOT) -> str:
    cleaned = str(file_path).strip().strip('"').strip("'")
    if not cleaned:
        return ""
    candidate = Path(cleaned)
    if candidate.is_absolute():
        try:
            cleaned = candidate.resolve().relative_to(target_root.resolve()).as_posix()
        except ValueError:
            cleaned = candidate.as_posix()
    return cleaned.replace("\\", "/").lstrip("./").strip()


def _load_plans(target_root: Path = REPO_ROOT) -> dict[str, Any]:
    plans_file = _resolve_plans_file(target_root)
    if not plans_file.exists():
        return {}
    try:
        plans_payload = json.loads(plans_file.read_text(encoding="utf-8"))
        if isinstance(plans_payload, dict):
            return plans_payload
    except Exception:
        return {}
    return {}


def _save_plans(plans: dict[str, Any], target_root: Path = REPO_ROOT) -> None:
    plans_file = _resolve_plans_file(target_root)
    plans_file.parent.mkdir(parents=True, exist_ok=True)
    plans_file.write_text(
        json.dumps(plans, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _iter_issue_plans(plans: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [
        (str(key), entry)
        for key, entry in plans.items()
        if str(key) != "slices" and isinstance(entry, dict)
    ]


def _find_collisions(
    plans: dict[str, Any],
    candidate_issue: str,
    candidate_files: list[str],
) -> list[dict[str, Any]]:
    collisions: list[dict[str, Any]] = []
    candidate_set = {_normalize_path(f) for f in candidate_files if f.strip()}
    for issue_id, entry in _iter_issue_plans(plans):
        if str(issue_id) == str(candidate_issue):
            continue
        existing_files = {_normalize_path(f) for f in entry.get("files", [])}
        overlap = sorted(candidate_set.intersection(existing_files))
        if overlap:
            collisions.append({"conflicting_issue": issue_id, "overlapping_files": overlap})
    return collisions


def _find_all_plan_collisions(plans: dict[str, Any]) -> list[dict[str, Any]]:
    collisions: list[dict[str, Any]] = []
    issue_entries = dict(_iter_issue_plans(plans))
    issue_ids = list(issue_entries.keys())
    pairs = [
        (issue_a, issue_b)
        for idx, issue_a in enumerate(issue_ids)
        for issue_b in issue_ids[idx + 1 :]
    ]
    for issue_a, issue_b in pairs:
        files_a = set(issue_entries[issue_a].get("files", []))
        overlap = sorted(files_a.intersection(set(issue_entries[issue_b].get("files", []))))
        if overlap:
            collisions.append({"issues": [issue_a, issue_b], "overlapping_files": overlap})
    return collisions


def _parse_porcelain_line(line: str, target_root: Path) -> str:
    raw_entry = line[3:].strip()
    if " -> " in raw_entry:
        raw_entry = raw_entry.split(" -> ", 1)[1]
    return _normalize_path(raw_entry, target_root)


def _get_dirty_files(target_root: Path) -> list[str]:
    try:
        proc = subprocess.run(
            ["git", "status", "--porcelain", "-uall"],
            cwd=str(target_root),
            capture_output=True,
            text=True,
            check=True,
        )
    except Exception:
        return []
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    return [p for p in (_parse_porcelain_line(ln, target_root) for ln in lines) if p]


MAX_SNAPSHOT_BASE64_BYTES = 2_097_152


def _build_single_file_snapshot(target_root: Path, rel_path: str) -> dict[str, Any]:
    abs_path = target_root / rel_path
    if not abs_path.exists() or not abs_path.is_file():
        return {"existed": False, "sha256": None, "contentBase64": None}
    file_size = abs_path.stat().st_size
    if file_size > MAX_SNAPSHOT_BASE64_BYTES:
        return {"existed": True, "sha256": f"size:{file_size}", "contentBase64": None}
    raw_bytes = abs_path.read_bytes()
    return {
        "existed": True,
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "contentBase64": base64.b64encode(raw_bytes).decode("ascii"),
    }


def _build_union_allowed_set(
    plans: dict[str, Any],
    slice_id: str,
    extra_allowed: list[str],
) -> set[str]:
    slices_map = plans.get("slices", {})
    current_slice = slices_map.get(slice_id, {}) if isinstance(slices_map, dict) else {}
    union_allowed: set[str] = set(current_slice.get("allowedFiles", [])) | set(extra_allowed)
    if isinstance(slices_map, dict):
        for other_id, other_entry in slices_map.items():
            if str(other_id) != str(slice_id) and isinstance(other_entry, dict):
                union_allowed.update(other_entry.get("allowedFiles", []))
    for _, issue_entry in _iter_issue_plans(plans):
        union_allowed.update(_normalize_path(f) for f in issue_entry.get("files", []))
    return union_allowed


def _is_file_modified_since_baseline(
    target_root: Path,
    rel_path: str,
    baseline_files: dict[str, Any],
    dirty_set: set[str],
) -> bool:
    snapshot_entry = baseline_files.get(rel_path)
    if not isinstance(snapshot_entry, dict):
        return rel_path in dirty_set
    abs_path = target_root / rel_path
    if not abs_path.exists() or not abs_path.is_file():
        return bool(snapshot_entry.get("existed"))
    expected_sha = str(snapshot_entry.get("sha256") or "")
    if expected_sha.startswith("size:"):
        return f"size:{abs_path.stat().st_size}" != expected_sha
    current_sha = hashlib.sha256(abs_path.read_bytes()).hexdigest()
    return current_sha != expected_sha


def _revert_from_git_or_unlink(target_root: Path, rel_path: str, abs_path: Path) -> None:
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", rel_path],
        cwd=str(target_root),
        capture_output=True,
        check=False,
    )
    if tracked.returncode == 0:
        subprocess.run(["git", "checkout", "HEAD", "--", rel_path], cwd=str(target_root), check=False)
        return
    if abs_path.exists():
        abs_path.unlink()


def _revert_single_unauthorized_file(
    target_root: Path,
    rel_path: str,
    snapshot_entry: dict[str, Any] | None,
) -> None:
    abs_path = target_root / rel_path
    if isinstance(snapshot_entry, dict):
        if snapshot_entry.get("existed") and snapshot_entry.get("contentBase64") is not None:
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            abs_path.write_bytes(base64.b64decode(str(snapshot_entry["contentBase64"])))
        elif not snapshot_entry.get("existed") and abs_path.exists():
            abs_path.unlink()
        return
    _revert_from_git_or_unlink(target_root, rel_path, abs_path)


def _handle_snapshot_slice(
    plans: dict[str, Any],
    slice_id: str,
    raw_files: str,
    target_root: Path,
) -> int:
    allowed_files = sorted(
        {_normalize_path(f, target_root) for f in raw_files.split(",") if f.strip()}
    )
    relevant_files = sorted(set(_get_dirty_files(target_root)) | set(allowed_files))
    baseline_files = {
        rel_path: _build_single_file_snapshot(target_root, rel_path)
        for rel_path in relevant_files
    }
    slices_map = plans.setdefault("slices", {})
    slices_map[slice_id] = {
        "sliceId": slice_id,
        "allowedFiles": allowed_files,
        "baselineFiles": baseline_files,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _save_plans(plans, target_root)
    sys.stdout.write(f"{json.dumps(slices_map[slice_id], indent=2, ensure_ascii=False)}\n")
    return 0


def _collect_unauthorized_files(
    target_root: Path,
    baseline_files: dict[str, Any],
    union_allowed: set[str],
) -> list[str]:
    dirty_files = _get_dirty_files(target_root)
    dirty_set = set(dirty_files)
    candidates = sorted(dirty_set | set(baseline_files.keys()))
    return [
        rel
        for rel in candidates
        if rel not in union_allowed
        and _is_file_modified_since_baseline(target_root, rel, baseline_files, dirty_set)
    ]


def _handle_verify_slice(
    plans: dict[str, Any],
    slice_id: str,
    raw_files: str,
    revert_unauthorized: bool,
    target_root: Path,
) -> int:
    slices_map = plans.get("slices", {})
    slice_entry = slices_map.get(slice_id) if isinstance(slices_map, dict) else None
    if not isinstance(slice_entry, dict):
        err = {"ok": False, "sliceId": slice_id, "unauthorizedFiles": [], "reverted": [], "error": "Slice not found"}
        sys.stdout.write(f"{json.dumps(err, indent=2, ensure_ascii=False)}\n")
        return 1
    extra_allowed = [_normalize_path(f, target_root) for f in raw_files.split(",") if f.strip()]
    union_allowed = _build_union_allowed_set(plans, slice_id, extra_allowed)
    baseline_files = slice_entry.get("baselineFiles", {})
    unauthorized = _collect_unauthorized_files(target_root, baseline_files, union_allowed)
    reverted: list[str] = []
    if revert_unauthorized:
        for rel_path in unauthorized:
            _revert_single_unauthorized_file(target_root, rel_path, baseline_files.get(rel_path))
            reverted.append(rel_path)
    is_ok = len(unauthorized) == 0
    if is_ok or revert_unauthorized:
        slices_map.pop(slice_id, None)
        _save_plans(plans, target_root)
    payload = {"ok": is_ok, "sliceId": slice_id, "unauthorizedFiles": unauthorized, "reverted": reverted}
    sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    return 0 if is_ok else 1


def _handle_register(
    plans: dict[str, Any],
    issue_id: str,
    raw_files: str,
    target_root: Path = REPO_ROOT,
) -> int:
    files = [_normalize_path(f, target_root) for f in raw_files.split(",") if f.strip()]
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
    _save_plans(plans, target_root)
    payload = {"status": "REGISTERED", "issue": issue_id, "files": plans[issue_id]["files"]}
    sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    return 0


def _handle_check(
    plans: dict[str, Any],
    issue_id: str,
    raw_files: str,
    target_root: Path = REPO_ROOT,
) -> int:
    if raw_files:
        files = [_normalize_path(f, target_root) for f in raw_files.split(",") if f.strip()]
        collisions = _find_collisions(plans, issue_id or "candidate", files)
    else:
        collisions = _find_all_plan_collisions(plans)
    if collisions:
        payload = {"status": "COLLISION_DETECTED", "collisions": collisions}
        sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
        return 1
    active_count = len(_iter_issue_plans(plans))
    sys.stdout.write(f"{json.dumps({'status': 'OK', 'active_plans_count': active_count}, indent=2)}\n")
    return 0


def _handle_release(
    plans: dict[str, Any],
    issue_id: str,
    target_root: Path = REPO_ROOT,
) -> int:
    removed = plans.pop(issue_id, None)
    _save_plans(plans, target_root)
    payload = {"status": "RELEASED", "issue": issue_id, "was_present": removed is not None}
    sys.stdout.write(f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    return 0


def _add_slice_subparsers(subparsers: Any) -> None:
    snap_parser = subparsers.add_parser("snapshot-slice", help="Registra snapshot SHA-256/Base64 pré-fatia.")
    snap_parser.add_argument("--slice", required=True, help="Identificador da fatia (ex.: F1).")
    snap_parser.add_argument("--files", required=True, help="Lista CSV da Allowed Files Whitelist.")
    snap_parser.add_argument("--root", default="", help="Diretório raiz opcional do repositório.")

    ver_parser = subparsers.add_parser("verify-slice", help="Verifica whitelist pós-fatia e reverte intrusos.")
    ver_parser.add_argument("--slice", required=True, help="Identificador da fatia (ex.: F1).")
    ver_parser.add_argument("--files", default="", help="Arquivos extras opcionais permitidos.")
    ver_parser.add_argument("--revert-unauthorized", action="store_true", help="Reverte arquivos fora da whitelist.")
    ver_parser.add_argument("--root", default="", help="Diretório raiz opcional do repositório.")


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gerenciador de planos ativos e Hard Sandbox de fatias (.git/active-plans.json)."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    reg_parser = subparsers.add_parser("register", help="Registra arquivos planejados para uma Issue.")
    reg_parser.add_argument("--issue", required=True, help="Número ou identificador da Issue.")
    reg_parser.add_argument("--files", required=True, help="Lista de arquivos separados por vírgula.")
    reg_parser.add_argument("--root", default="", help="Diretório raiz opcional.")

    chk_parser = subparsers.add_parser("check", help="Verifica colisões entre planos ativos.")
    chk_parser.add_argument("--issue", default="", help="Issue opcional a verificar.")
    chk_parser.add_argument("--files", default="", help="Lista opcional de arquivos separados por vírgula.")
    chk_parser.add_argument("--root", default="", help="Diretório raiz opcional.")

    rel_parser = subparsers.add_parser("release", help="Libera o plano ativo de uma Issue concluída.")
    rel_parser.add_argument("--issue", required=True, help="Número ou identificador da Issue.")
    rel_parser.add_argument("--root", default="", help="Diretório raiz opcional.")

    lst_parser = subparsers.add_parser("list", help="Lista todos os planos ativos registrados.")
    lst_parser.add_argument("--root", default="", help="Diretório raiz opcional.")
    _add_slice_subparsers(subparsers)
    return parser


def main() -> int:
    args = _build_arg_parser().parse_args()
    target_root = _resolve_root(getattr(args, "root", ""))
    plans = _load_plans(target_root)
    if args.command == "register":
        return _handle_register(plans, str(args.issue), args.files, target_root)
    if args.command == "check":
        return _handle_check(plans, str(args.issue), args.files, target_root)
    if args.command == "release":
        return _handle_release(plans, str(args.issue), target_root)
    if args.command == "snapshot-slice":
        return _handle_snapshot_slice(plans, str(args.slice), args.files, target_root)
    if args.command == "verify-slice":
        return _handle_verify_slice(plans, str(args.slice), args.files, bool(args.revert_unauthorized), target_root)
    sys.stdout.write(f"{json.dumps({'active_plans': plans}, indent=2, ensure_ascii=False)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
