// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Valida as dependências de um único tipo (`dependencies` ou `devDependencies`) para um workspace.
 * @param {string} label
 * @param {string} depType
 * @param {{ pkgDeps: Record<string, string>; lockDeps: Record<string, string> }} depsPair
 * @returns {string[]}
 */
function validateDependencyTypeMap(label, depType, depsPair) {
  const { pkgDeps, lockDeps } = depsPair;
  /** @type {string[]} */
  const errors = [];
  for (const [depName, expectedVersion] of Object.entries(pkgDeps)) {
    const actualVersion = lockDeps[depName];
    if (!actualVersion) {
      errors.push(
        `Dependência "${depName}" (${expectedVersion}) presente em ${label} [${depType}], mas AUSENTE em package-lock.json.`
      );
    } else if (actualVersion !== expectedVersion) {
      errors.push(
        `Versão divergente para "${depName}" em ${label}: esperado "${expectedVersion}", lockfile contém "${actualVersion}".`
      );
    }
  }
  return errors;
}

/**
 * Valida um único pacote/workspace contra a entrada correspondente em `package-lock.json`.
 * @param {{ key: string; dir: string; label: string }} pkgInfo
 * @param {Record<string, any>} lockPackages
 * @returns {string[]}
 */
function validateWorkspacePackageEntry(pkgInfo, lockPackages) {
  const pkgJsonPath = path.join(pkgInfo.dir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return [];

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const lockEntry = lockPackages[pkgInfo.key] ?? null;
  if (!lockEntry) {
    return [`Workspace "${pkgInfo.key}" ausente no package-lock.json (packages["${pkgInfo.key}"]).`];
  }

  return [
    ...validateDependencyTypeMap(pkgInfo.label, 'dependencies', {
      pkgDeps: pkgJson.dependencies ?? {},
      lockDeps: lockEntry.dependencies ?? {},
    }),
    ...validateDependencyTypeMap(pkgInfo.label, 'devDependencies', {
      pkgDeps: pkgJson.devDependencies ?? {},
      lockDeps: lockEntry.devDependencies ?? {},
    }),
  ];
}

/**
 * @param {string[]} workspaces
 * @param {Array<{ key: string; dir: string; label: string }>} packagesToCheck
 * @param {Record<string, any>} lockPackages
 * @returns {string[]}
 */
function collectLockfileErrors(workspaces, packagesToCheck, lockPackages) {
  /** @type {string[]} */
  const errors = [];
  for (const ws of workspaces) {
    if (fs.existsSync(path.join(rootDir, ws, 'package-lock.json'))) {
      errors.push(
        `Lockfile duplicado detectado em "${ws}/package-lock.json". Em npm workspaces, apenas o package-lock.json da raiz deve existir.`
      );
    }
  }
  for (const pkgInfo of packagesToCheck) {
    errors.push(...validateWorkspacePackageEntry(pkgInfo, lockPackages));
  }
  return errors;
}

/**
 * Verifica a sincronização estrita entre o package-lock.json da raiz e os workspaces npm.
 * Exemplo: const ok = checkLockfileSync();
 *
 * @returns {boolean}
 */
export function checkLockfileSync() {
  const rootPkgPath = path.join(rootDir, 'package.json');
  const lockfilePath = path.join(rootDir, 'package-lock.json');

  if (!fs.existsSync(lockfilePath)) {
    process.stderr.write('❌ package-lock.json não encontrado na raiz!\n');
    process.exit(1);
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  /** @type {string[]} */
  const workspaces = rootPkg.workspaces ?? [];
  const packagesToCheck = [
    { key: '', dir: rootDir, label: 'raiz (package.json)' },
    ...workspaces.map((ws) => ({
      key: ws,
      dir: path.join(rootDir, ws),
      label: `workspace ${ws} (${ws}/package.json)`,
    })),
  ];

  const errors = collectLockfileErrors(workspaces, packagesToCheck, lockfile.packages ?? {});
  if (errors.length > 0) {
    process.stderr.write('\n❌ [Lockfile Drift Detected] Dessincronização no package-lock.json:\n');
    for (const err of errors) {
      process.stderr.write(`   • ${err}\n`);
    }
    process.stderr.write('\n💡 Execute "npm install" na raiz do monorepo para sincronizar o lockfile.\n\n');
    process.exit(1);
  }

  process.stdout.write('✔ package-lock.json 100% sincronizado com todos os workspaces.\n');
  return true;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  checkLockfileSync();
}
