"""Gate 1: Verifica sincronização estrita entre package.json <-> package-lock.json e integridade de requirements.txt.

Garante que todas as dependências declaradas em package.json estejam refletidas com a mesma
especificação no bloco packages[""] de package-lock.json e que requirements.txt não possua
pacotes sem pinagem de versão (>= ou ==) nem duplicatas.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
_REQ_PIN_PATTERN = re.compile(r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?\s*(>=|==|~=)")


def _validate_npm_dependency_map(
    dep_section: str,
    pkg_deps: dict[str, str],
    lock_deps: dict[str, str],
) -> list[str]:
    """Compara um mapa de dependências (dependencies/devDependencies) entre package.json e package-lock.json."""
    errors: list[str] = []
    for dep_name, expected_spec in pkg_deps.items():
        actual_spec = lock_deps.get(dep_name)
        if actual_spec is None:
            errors.append(
                f"Dependência npm '{dep_name}' (esperado='{expected_spec}') em [{dep_section}] ausente em package-lock.json (recebido=None)."
            )
        elif actual_spec != expected_spec:
            errors.append(
                f"Divergência de versão para '{dep_name}' em [{dep_section}]: esperado='{expected_spec}', recebido='{actual_spec}'."
            )
    return errors


def validate_package_lock_sync(root_dir: Path) -> list[str]:
    """Valida a existência e paridade entre package.json e package-lock.json na raiz."""
    pkg_path = root_dir / "package.json"
    lock_path = root_dir / "package-lock.json"
    if not pkg_path.exists():
        return ["Arquivo package.json não encontrado na raiz (esperado='package.json', recebido=ausente)."]
    if not lock_path.exists():
        return ["Arquivo package-lock.json não encontrado na raiz (esperado='package-lock.json', recebido=ausente)."]

    pkg_payload: dict[str, Any] = json.loads(pkg_path.read_text(encoding="utf-8"))
    lock_payload: dict[str, Any] = json.loads(lock_path.read_text(encoding="utf-8"))
    root_lock_entry: dict[str, Any] = lock_payload.get("packages", {}).get("", {})
    if not root_lock_entry:
        return ["Entrada raiz packages[''] ausente em package-lock.json (esperado=dict, recebido=vazio)."]

    errors: list[str] = []
    for section in ("dependencies", "devDependencies"):
        pkg_section = pkg_payload.get(section, {})
        lock_section = root_lock_entry.get(section, {})
        if isinstance(pkg_section, dict) and isinstance(lock_section, dict):
            errors.extend(_validate_npm_dependency_map(section, pkg_section, lock_section))
    return errors


def validate_requirements_pinning(root_dir: Path) -> list[str]:
    """Valida que requirements.txt possua pinagem explícita (>= ou ==) e zero pacotes duplicados."""
    req_path = root_dir / "requirements.txt"
    if not req_path.exists():
        return ["Arquivo requirements.txt não encontrado na raiz (esperado='requirements.txt', recebido=ausente)."]

    seen_packages: set[str] = set()
    errors: list[str] = []
    for idx, raw_line in enumerate(req_path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("--"):
            continue
        match = _REQ_PIN_PATTERN.match(line)
        if not match:
            errors.append(
                f"Linha {idx} de requirements.txt sem pinagem explícita (esperado='pkg>=x.y.z', recebido='{line}')."
            )
            continue
        pkg_key = match.group(1).lower()
        if pkg_key in seen_packages:
            errors.append(
                f"Pacote duplicado em requirements.txt na linha {idx} (esperado=único, recebido='{pkg_key}')."
            )
        seen_packages.add(pkg_key)
    return errors


def check_lockfile_sync(root_dir: Path = REPO_ROOT) -> tuple[bool, list[str]]:
    """Executa a validação combinada de package-lock.json e requirements.txt."""
    errors = validate_package_lock_sync(root_dir) + validate_requirements_pinning(root_dir)
    return len(errors) == 0, errors


def main() -> int:
    """Ponto de entrada CLI do verificador de sincronia de lockfiles."""
    parser = argparse.ArgumentParser(description="Verifica sincronia de package-lock.json e requirements.txt.")
    parser.add_argument("--root", default=str(REPO_ROOT), help="Diretório raiz do repositório.")
    args = parser.parse_args()

    ok, errors = check_lockfile_sync(Path(args.root).resolve())
    if not ok:
        for err in errors:
            sys.stderr.write(f"[LOCKFILE-SYNC FAIL] {err}\n")
        return 1

    sys.stdout.write("OK - package.json, package-lock.json e requirements.txt 100% sincronizados.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
