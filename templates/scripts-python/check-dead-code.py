"""Gate 5: Detector determinístico AST de Código Morto e Imports Não Utilizados em Python (app/, scripts/, tests/).

Analisa a árvore sintática abstrata (AST) de cada módulo Python para identificar:
1. Símbolos importados no topo do módulo que nunca são referenciados no corpo nem em __all__.
2. Funções privadas de módulo (`_nome`) definidas no escopo global que nunca são chamadas no arquivo,
   respeitando callbacks decorados (`@app.*`, `@model_validator`, `@field_validator`), funções de teste (`test_*`)
   e métodos visitantes de AST (`visit_*`).
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
_EXEMPT_IMPORTS = {"annotations", "TYPE_CHECKING"}


def _extract_tokens_from_string(raw_text: str) -> set[str]:
    """Extrai identificadores candidatos de uma anotação de tipo em string."""
    cleaned = raw_text.replace("[", " ").replace("]", " ").replace(",", " ")
    return {token.strip() for token in cleaned.split() if token.strip()}


def _collect_referenced_names(tree: ast.Module) -> set[str]:
    """Coleta todos os identificadores referenciados no módulo (incluindo anotações em string)."""
    referenced: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            referenced.add(node.id)
        elif isinstance(node, ast.Attribute):
            referenced.add(node.attr)
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            referenced.update(_extract_tokens_from_string(node.value))
    return referenced


def _extract_imported_aliases(node: ast.stmt) -> list[tuple[str, int]]:
    """Extrai os nomes locais importados por uma instrução Import ou ImportFrom."""
    if isinstance(node, ast.Import):
        names = [alias.asname or alias.name.split(".")[0] for alias in node.names]
        return [(n, node.lineno) for n in names if n not in _EXEMPT_IMPORTS]
    if isinstance(node, ast.ImportFrom):
        names = [alias.asname or alias.name for alias in node.names if alias.name != "*"]
        return [(n, node.lineno) for n in names if n not in _EXEMPT_IMPORTS]
    return []


def _collect_top_level_imports(tree: ast.Module) -> list[tuple[str, int]]:
    """Lista os símbolos importados no escopo de topo do módulo com o número da linha."""
    imported: list[tuple[str, int]] = []
    for node in tree.body:
        imported.extend(_extract_imported_aliases(node))
    return imported


def _collect_unused_private_functions(tree: ast.Module, all_repo_tokens: set[str]) -> list[tuple[str, int]]:
    """Identifica funções privadas de topo `_nome` que não possuem decorators e não são referenciadas."""
    unused_funcs: list[tuple[str, int]] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if not node.name.startswith("_") or node.name.startswith("__"):
            continue
        if node.decorator_list or node.name.startswith("visit_"):
            continue
        if node.name not in all_repo_tokens:
            unused_funcs.append((node.name, node.lineno))
    return unused_funcs


def _discover_python_files(root_dir: Path) -> list[Path]:
    """Lista todos os arquivos Python auditáveis em app/, scripts/ e tests/."""
    py_files: list[Path] = []
    for folder in ("app", "scripts", "tests"):
        target = root_dir / folder
        if target.exists():
            py_files.extend(p for p in target.rglob("*.py") if p.name != "__init__.py")
    return py_files


def _audit_single_module(
    rel_path: str,
    tree: ast.Module,
    repo_loaded_names: set[str],
) -> list[str]:
    """Audita um módulo AST em busca de imports mortos e funções privadas órfãs."""
    errors: list[str] = []
    local_refs = _collect_referenced_names(tree)
    unused_imports = [
        (name, lineno) for name, lineno in _collect_top_level_imports(tree) if name not in local_refs
    ]
    for imp_name, lineno in unused_imports:
        errors.append(
            f"[DEAD-IMPORT] {rel_path}:{lineno} -> Import '{imp_name}' não utilizado (esperado=referenciado, recebido=órfão)."
        )
    for fn_name, lineno in _collect_unused_private_functions(tree, repo_loaded_names):
        errors.append(
            f"[DEAD-FUNCTION] {rel_path}:{lineno} -> Função privada '{fn_name}' nunca chamada (esperado=referenciada, recebido=órfã)."
        )
    return errors


def check_python_dead_code(root_dir: Path = REPO_ROOT) -> tuple[bool, list[str]]:
    """Varre app/, scripts/ e tests/ em busca de imports mortos e funções privadas órfãs."""
    parsed_trees: dict[Path, ast.Module] = {}
    repo_loaded_names: set[str] = set()
    for py_file in _discover_python_files(root_dir):
        tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        parsed_trees[py_file] = tree
        repo_loaded_names.update(_collect_referenced_names(tree))

    errors: list[str] = []
    for py_file, tree in sorted(parsed_trees.items()):
        rel_path = py_file.relative_to(root_dir).as_posix()
        errors.extend(_audit_single_module(rel_path, tree, repo_loaded_names))
    return len(errors) == 0, errors


def main() -> int:
    """Executa a auditoria de código morto Python via CLI."""
    ok, errors = check_python_dead_code(REPO_ROOT)
    if not ok:
        for err in errors:
            sys.stderr.write(f"{err}\n")
        return 1
    sys.stdout.write("OK - Zero imports não utilizados ou funções privadas órfãs em app/, scripts/ e tests/.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
