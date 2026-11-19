"""
Guardrail Determinístico de Nomenclatura e Organização Semântica de Testes (Regra 1.14 de AGENTS.md).

Verifica:
1. Proibição absoluta de nomes baseados em número de issue ou PR (ex.: test_issue_42.py, issue-123.py, bug_99.py).
2. Proibição de arquivos de teste soltos diretamente na raiz de tests/.
3. Existência e presença de testes reais nos 5 diretórios de domínio semântico obrigatórios do Awencanto:
   - tests/ai/
   - tests/audio/
   - tests/storage/
   - tests/api/
   - tests/governance/
"""

from pathlib import Path
import re
import sys


REPO_ROOT = Path(__file__).resolve().parent.parent
TESTS_DIR = REPO_ROOT / "tests"

MANDATORY_DOMAINS = ("ai", "audio", "storage", "api", "governance")
ALLOWED_AUX_DIRS = ("fixtures", "__pycache__")

FORBIDDEN_NAME_REGEX = re.compile(
    r"(issue[_-]?\d+|pr[_-]?\d+|bug[_-]?\d+|hotfix[_-]?\d+|ticket[_-]?\d+)",
    re.IGNORECASE,
)


def _check_root_entries(tests_dir: Path) -> list[str]:
    errors: list[str] = []
    for item in tests_dir.iterdir():
        if item.is_file() and item.name not in ("__init__.py", "conftest.py"):
            errors.append(
                f"Arquivo solto na raiz de 'tests/' não permitido pela Regra 1.14: 'tests/{item.name}'. "
                f"Mova para um domínio semântico ({', '.join(MANDATORY_DOMAINS)}) ou 'tests/fixtures/'."
            )
        elif item.is_dir() and item.name not in MANDATORY_DOMAINS and item.name not in ALLOWED_AUX_DIRS:
            errors.append(
                f"Subdiretório 'tests/{item.name}/' fora dos domínios semânticos oficiais "
                f"({', '.join(MANDATORY_DOMAINS)})."
            )
    return errors


def _audit_single_test_file(tf: Path) -> list[str]:
    errors: list[str] = []
    rel_path = tf.relative_to(REPO_ROOT).as_posix()
    if not tf.name.startswith("test_"):
        errors.append(f"Arquivo '{rel_path}' deve seguir o padrão semântico 'test_<capacidade_de_dominio>.py'.")
    if FORBIDDEN_NAME_REGEX.search(tf.name):
        errors.append(
            f"Violação da Regra 1.14 (Nomenclatura Anti-Issue): '{rel_path}' contém referência a número de issue/PR/bug."
        )

    content = tf.read_text(encoding="utf-8", errors="ignore")
    for match in re.finditer(r"def\s+(test_[a-zA-Z0-9_]+)", content):
        fn_name = match.group(1)
        if FORBIDDEN_NAME_REGEX.search(fn_name):
            errors.append(
                f"Violação da Regra 1.14 em '{rel_path}': função '{fn_name}' referencia número de issue/PR/bug."
            )
    return errors


def _audit_mandatory_domain(domain: str) -> list[str]:
    domain_dir = TESTS_DIR / domain
    if not domain_dir.exists() or not domain_dir.is_dir():
        return [f"Domínio semântico obrigatório ausente: 'tests/{domain}/'."]

    test_files = [f for f in domain_dir.rglob("*.py") if f.name not in ("__init__.py", "conftest.py")]
    if not test_files:
        return [f"Domínio semântico 'tests/{domain}/' não possui nenhum arquivo de teste ('test_*.py')."]

    errors: list[str] = []
    for tf in test_files:
        errors.extend(_audit_single_test_file(tf))
    return errors


def check_test_governance() -> tuple[bool, list[str]]:
    if not TESTS_DIR.exists():
        return False, ["Diretório 'tests/' não encontrado na raiz do projeto."]

    errors = _check_root_entries(TESTS_DIR)
    for domain in MANDATORY_DOMAINS:
        errors.extend(_audit_mandatory_domain(domain))
    return len(errors) == 0, errors


def main() -> int:
    ok, errors = check_test_governance()
    if not ok:
        sys.stdout.write("[FAIL] Violação na Governança Semântica de Testes (Regra 1.14):\n")
        for err in errors:
            sys.stdout.write(f"  - {err}\n")
        return 1

    sys.stdout.write(
        f"[OK] Governança de Testes validada com sucesso nos 5 domínios semânticos ({', '.join(MANDATORY_DOMAINS)}).\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
