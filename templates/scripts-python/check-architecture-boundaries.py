"""Gate 4: Verificador determinístico de Fronteiras Arquiteturais e Zero Ciclos de Importação em Python (app/).

Garante:
1. Ausência total de dependências circulares diretas ou indiretas (A <-> B) entre módulos de app/.
2. Blindagem estrita de camadas: módulos de contratos puros (app/schemas.py, app/config.py e app/prompts/*)
   são terminantemente proibidos de importar app/main.py ou app/services/*.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
_PURE_CONTRACT_PREFIXES = ("app.schemas", "app.config", "app.prompts")
_FORBIDDEN_UPPER_PREFIXES = ("app.main", "app.services")


def _file_to_module_name(py_file: Path, root_dir: Path) -> str:
    """Converte o caminho de um arquivo .py em nome de módulo pontilhado relativo à raiz."""
    rel_parts = list(py_file.relative_to(root_dir).with_suffix("").parts)
    if rel_parts and rel_parts[-1] == "__init__":
        rel_parts.pop()
    return ".".join(rel_parts)


def _extract_node_imports(node: ast.AST, known_modules: set[str]) -> set[str]:
    """Extrai módulos internos referenciados em um único nó Import ou ImportFrom."""
    if isinstance(node, ast.Import):
        return {alias.name for alias in node.names if alias.name in known_modules}
    if isinstance(node, ast.ImportFrom) and node.module:
        candidates = {node.module} | {f"{node.module}.{alias.name}" for alias in node.names}
        return candidates & known_modules
    return set()


def _extract_internal_imports(py_file: Path, known_modules: set[str]) -> set[str]:
    """Extrai o conjunto de módulos internos de app/ importados por py_file via AST."""
    tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
    imported: set[str] = set()
    for node in ast.walk(tree):
        imported.update(_extract_node_imports(node, known_modules))
    return imported


def _detect_layer_violations(graph: dict[str, set[str]]) -> list[str]:
    """Detecta importações proibidas da camada de contratos puros para serviços ou main."""
    errors: list[str] = []
    pure_mods = [m for m in sorted(graph) if m.startswith(_PURE_CONTRACT_PREFIXES)]
    for mod in pure_mods:
        forbidden_deps = [d for d in sorted(graph[mod]) if d.startswith(_FORBIDDEN_UPPER_PREFIXES)]
        for dep in forbidden_deps:
            errors.append(
                f"[BOUNDARY VIOLATION] Camada pura '{mod}' não pode importar camada superior (esperado=apenas contratos, recebido='{dep}')."
            )
    return errors


def _visit_graph_node(
    node: str,
    graph: dict[str, set[str]],
    visited: set[str],
    active_stack: list[str],
    errors: list[str],
) -> None:
    """Visita recursivamente um nó do grafo em profundidade para detectar ciclos."""
    visited.add(node)
    active_stack.append(node)
    for neighbor in sorted(graph.get(node, set())):
        if neighbor in active_stack:
            idx = active_stack.index(neighbor)
            cycle_chain = " -> ".join(active_stack[idx:] + [neighbor])
            errors.append(
                f"[CIRCULAR DEPENDENCY] Ciclo de importação detectado (esperado=DAG acíclico, recebido='{cycle_chain}')."
            )
        elif neighbor not in visited:
            _visit_graph_node(neighbor, graph, visited, active_stack, errors)
    active_stack.pop()


def _detect_import_cycles(graph: dict[str, set[str]]) -> list[str]:
    """Detecta ciclos diretos e transitivos no grafo de importação via busca em profundidade."""
    visited: set[str] = set()
    active_stack: list[str] = []
    errors: list[str] = []
    for module_name in sorted(graph):
        if module_name not in visited:
            _visit_graph_node(module_name, graph, visited, active_stack, errors)
    return errors


def check_architecture_boundaries(root_dir: Path = REPO_ROOT) -> tuple[bool, list[str]]:
    """Constroi o grafo AST de app/ e retorna se as fronteiras e aciclicidade estão íntegras."""
    app_dir = root_dir / "app"
    py_files = [p for p in app_dir.rglob("*.py") if p.name != "__init__.py"]
    module_map = {_file_to_module_name(f, root_dir): f for f in py_files}
    known_modules = set(module_map.keys())

    graph: dict[str, set[str]] = {}
    for mod_name, file_path in module_map.items():
        graph[mod_name] = _extract_internal_imports(file_path, known_modules) - {mod_name}

    errors = _detect_layer_violations(graph) + _detect_import_cycles(graph)
    return len(errors) == 0, errors


def main() -> int:
    """Executa a verificação de fronteiras arquiteturais via linha de comando."""
    ok, errors = check_architecture_boundaries(REPO_ROOT)
    if not ok:
        for err in errors:
            sys.stderr.write(f"{err}\n")
        return 1
    sys.stdout.write("OK - Fronteiras arquiteturais e DAG acíclico de app/ validados.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
