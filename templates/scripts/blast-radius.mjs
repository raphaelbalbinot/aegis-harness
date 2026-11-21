// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve deterministicamente a raiz do projeto mesmo quando o script reside em `templates/scripts/` (GF-04).
 * Exemplo: resolveDefaultRootDir()
 *
 * @returns {string}
 */
export function resolveDefaultRootDir() {
  const parentDir = path.resolve(__dirname, '..');
  if (path.basename(parentDir) === 'templates') {
    return path.resolve(parentDir, '..');
  }
  return parentDir;
}

const ROOT = resolveDefaultRootDir();

const HIGH_RISK_CONSUMER_THRESHOLD = 5;
const MIN_SEARCH_TOKEN_LENGTH = 6;
const MAX_SAMPLE_FILES = 10;
const AGGREGATOR_BARREL_PATH = 'backend/src/index.ts';
const PROMPT_LOADER_PATH = 'backend/src/prompts/loader.ts';

const PERSISTENCE_LAYER_TOKENS = ['firebase/', 'firestore', 'storage', 'idb', 'db/'];

const LAYER_RULES = [
  { test: (/** @type {string} */ n) => n.includes('export/') || n.includes('publish/'), id: 'PUBLICATION', label: 'Exportação & Publicação de Artefatos' },
  { test: (/** @type {string} */ n) => n.includes('app/api/') || n.includes('routes/'), id: 'CORE', label: 'Core Handlers & Rotas de API' },
  { test: (/** @type {string} */ n) => n.includes('components/') || n.includes('app/'), id: 'CLIENTS', label: 'Borda & Componentes de Interface' },
  { test: (/** @type {string} */ n) => n.includes('ai/') || n.includes('prompts/') || n.includes('services/'), id: 'SERVICES', label: 'Motores de Domínio, Serviços & IA' },
  { test: (/** @type {string} */ n) => PERSISTENCE_LAYER_TOKENS.some((tok) => n.includes(tok)), id: 'PERSISTENCE', label: 'Persistência & Resiliência de Estado' },
];

const GOVERNANCE_AXIS_RULES = [
  {
    id: 'B_SECURITY_HARDENING',
    label: 'Eixo B — Segurança & Hardening / CWE',
    regex: /(?:^|\/|[._-])(?:oidc|auth|sanitize|prompt-shield|security)(?:[._-]|\/|$)|(?:^|\/)firestore\.rules$/i,
  },
  {
    id: 'A_INFRA_SERVERLESS',
    label: 'Eixo A — Infraestrutura & Nuvem Serverless',
    regex: /(?:cloud-tasks\/|gcs\/|Dockerfile|next\.config|app\/api\/batch\/|app\/api\/tasks\/)/,
  },
  {
    id: 'C_AI_AND_DOMAIN',
    label: 'Eixo C — Lógica de Domínio & Motores de IA',
    regex: /(?:backend\/src\/ai\/|backend\/prompts\/|backend\/src\/prompts\/|frontend\/src\/lib\/ai\/|frontend\/src\/lib\/prompts\/|app\/api\/ai\/)/,
  },
  {
    id: 'E_PERSISTENCE_STATE',
    label: 'Eixo E — Persistência & Estado Híbrido',
    regex: /(?:firebase\/|firestore|storage\/|idb|local-draft|useAutoSave|types\/project\.ts|app\/api\/projects\/|app\/api\/account\/)/,
  },
];

const SECURITY_SURFACE_PATH_REGEX =
  /(?:^|\/)(?:api|routes|webhooks?|auth|oidc|security|firestore|gcs|storage|ai|prompts|cloud-tasks)(?:\/|$)|(?:^|\/|[._-])(?:auth|oidc|security|webhook|prompt-shield|sanitize|ffmpeg|rvc)(?:[._-]|\/|$)|(?:^|\/)(?:main\.py|schemas\.py|firestore\.rules)$/i;

/**
 * Verifica se um caminho pertence à superfície de segurança sem falso positivo para `author` (GF-02).
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSecuritySurfaceFile(filePath) {
  const norm = String(filePath ?? '').replace(/\\/g, '/').replace(/^[./]+/, '');
  if (!norm || /\.(test|spec|mcp)\.[^/]+$/i.test(norm) || norm.startsWith('tests/')) return false;
  return SECURITY_SURFACE_PATH_REGEX.test(norm);
}

/**
 * Resolve a flag de superfície de segurança e documentos vinculados (Regra 1.8).
 * @param {string} foundNorm
 * @param {boolean} isTest
 */
function resolveRelatedDocsForTarget(foundNorm, isTest) {
  const securitySurfaceTouched = !isTest && isSecuritySurfaceFile(foundNorm);
  return {
    securitySurfaceTouched,
    relatedDocs: securitySurfaceTouched ? ['workspace/kb/THREAT_MODEL.md'] : [],
  };
}

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md'];
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '/index.ts', '/index.tsx', '/index.js', '/index.mjs'];
const TARGET_SEARCH_PREFIXES = [
  '',
  'src/',
  'lib/',
  'bin/',
  'templates/',
  'frontend/',
  'frontend/src/',
  'frontend/e2e/',
  'backend/',
  'backend/src/',
  'backend/prompts/',
  'landing/',
  'landing/src/',
  'scripts/',
];
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  'scratch',
  '.agents',
  '.claude',
  '.turbo',
  '.gemini',
]);
const IMPORT_EXPORT_REGEX = /(?:import\s+(?:[\s\S]*?from\s+)?|export\s+(?:[\s\S]*?from\s+)|import\s*\(\s*)['"]([^'"]+)['"]/g;
const NAMED_IMPORT_REGEX = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g;
const REEXPORT_FROM_REGEX = /export\s+(?:type\s+)?(\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/g;
const LATE_EXPORT_BLOCK_REGEX = /export\s+(?:type\s+)?\{([^}]+)\}(?!\s*from)/g;
const DIRECT_EXPORT_LINE_REGEX = /^\s*export\s+(?:default\s+)?(?:async\s+)?(function|const|let|interface|type|class|enum)\s+([A-Za-z0-9_$]+)/;

/** @param {string} filePath */
function detectLayer(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  const matched = LAYER_RULES.find((rule) => rule.test(norm));
  return matched ? { id: matched.id, label: matched.label } : { id: 'UTILS', label: 'Utilitários & Tipagens' };
}

/** @param {string} filePath */
function detectGovernanceAxis(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  const matched = GOVERNANCE_AXIS_RULES.find((rule) => rule.regex.test(norm));
  if (matched) return { id: matched.id, label: matched.label };
  if (norm.startsWith('backend/') || norm.startsWith('scripts/')) {
    return { id: 'C_AI_AND_DOMAIN', label: 'Eixo C — Lógica de Domínio & Motores de IA' };
  }
  return { id: 'D_UI_AND_EDITOR', label: 'Eixo D — Interface & Experiência do Usuário' };
}

/** @param {string} dir @returns {string[]} */
function getAllSourceFiles(dir) {
  /** @type {string[]} */
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(fullPath));
    } else if (entry.isFile() && SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

/** @param {string} candidate */
function resolveWithExtensions(candidate) {
  for (const ext of RESOLVE_EXTENSIONS) {
    const full = candidate + ext;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return full;
    }
  }
  return null;
}

/**
 * Resolve aliases de workspace (`@scope/pkg/...` ou `@/...`) de forma agnóstica ao projeto.
 * @param {string} importStr
 * @param {string} sourceFilePath
 * @param {string} activeRootDir
 */
function resolveWorkspaceAlias(importStr, sourceFilePath, activeRootDir) {
  const scopedMatch = importStr.match(/^@[^/]+\/([^/]+)(?:\/(.+))?$/);
  if (scopedMatch) {
    const pkgDir = scopedMatch[1];
    const subPath = scopedMatch[2] ?? 'index';
    return (
      resolveWithExtensions(path.join(activeRootDir, pkgDir, 'src', subPath)) ??
      resolveWithExtensions(path.join(activeRootDir, 'packages', pkgDir, 'src', subPath))
    );
  }
  if (importStr.startsWith('@/')) {
    const sub = importStr.slice(2);
    const isLanding = sourceFilePath.replace(/\\/g, '/').includes('/landing/');
    const candidates = isLanding
      ? [path.join(activeRootDir, 'landing', 'src', sub), path.join(activeRootDir, 'src', sub)]
      : [path.join(activeRootDir, 'src', sub), path.join(activeRootDir, 'frontend', 'src', sub)];
    for (const candidate of candidates) {
      const found = resolveWithExtensions(candidate);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @param {string} importStr
 * @param {string} sourceFilePath
 * @param {string} [activeRootDir]
 */
function resolveImportPath(importStr, sourceFilePath, activeRootDir = ROOT) {
  if (!importStr || importStr.startsWith('node:')) return null;
  if (importStr.startsWith('@')) {
    return resolveWorkspaceAlias(importStr, sourceFilePath, activeRootDir);
  }
  if (importStr.startsWith('.')) {
    return resolveWithExtensions(path.resolve(path.dirname(sourceFilePath), importStr));
  }
  return null;
}

/** @param {string} content @param {number} charIndex */
function computeLineNumberAtOffset(content, charIndex) {
  return content.slice(0, charIndex).split(/\r?\n/).length;
}

/** @param {string} rawSpecifier */
function parseCanonicalSymbolName(rawSpecifier) {
  const cleaned = rawSpecifier.trim().replace(/^type\s+/, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+as\s+/);
  return (parts[0] ?? '').trim();
}

/** @param {string} rawSpecifier */
function parseExportedAliasName(rawSpecifier) {
  const cleaned = rawSpecifier.trim().replace(/^type\s+/, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+as\s+/);
  return (parts[1] ?? parts[0] ?? '').trim();
}

/**
 * Registra os símbolos de um bloco `export { ... }` no mapa de símbolos do módulo.
 * @param {Map<string, any>} symbolMap
 * @param {string} rawSpecifiers
 * @param {number} blockLine
 */
function addLateExportSpecifiers(symbolMap, rawSpecifiers, blockLine) {
  for (const token of rawSpecifiers.split(',')) {
    const exportedName = parseExportedAliasName(token);
    if (exportedName && !symbolMap.has(exportedName)) {
      symbolMap.set(exportedName, { name: exportedName, kind: 'reexport', line: blockLine });
    }
  }
}

/** @param {string} content */
function extractExportedSymbols(content) {
  const symbolMap = new Map();
  const lines = content.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx++) {
    const match = lines[idx].match(DIRECT_EXPORT_LINE_REGEX);
    if (match && !symbolMap.has(match[2])) {
      symbolMap.set(match[2], { name: match[2], kind: match[1], line: idx + 1 });
    }
  }
  LATE_EXPORT_BLOCK_REGEX.lastIndex = 0;
  let blockMatch;
  while ((blockMatch = LATE_EXPORT_BLOCK_REGEX.exec(content)) !== null) {
    const blockLine = computeLineNumberAtOffset(content, blockMatch.index);
    addLateExportSpecifiers(symbolMap, blockMatch[1], blockLine);
  }
  return Array.from(symbolMap.values());
}

/**
 * Registra os símbolos nomeados importados por um consumidor a partir de um alvo resolvido.
 * @param {{ node: Record<string, any>; resolvedNorm: string; rawSpecifiers: string; importLine: number }} recordSpec
 */
function recordNamedImportSpecifiers(recordSpec) {
  const { node, resolvedNorm, rawSpecifiers, importLine } = recordSpec;
  const existing = node.importedSymbolsBySource.get(resolvedNorm) ?? {
    symbols: new Set(),
    line: importLine,
  };
  existing.line = Math.min(existing.line, importLine);
  for (const token of rawSpecifiers.split(',')) {
    const symName = parseCanonicalSymbolName(token);
    if (symName) existing.symbols.add(symName);
  }
  node.importedSymbolsBySource.set(resolvedNorm, existing);
}

/**
 * Indexa imports nomeados e re-exports de um nó no grafo.
 * @param {Record<string, any>} node
 * @param {Map<string, any>} fileMap
 * @param {string} [activeRootDir]
 */
function indexNodeNamedSymbolsAndReExports(node, fileMap, activeRootDir = ROOT) {
  NAMED_IMPORT_REGEX.lastIndex = 0;
  let namedMatch;
  while ((namedMatch = NAMED_IMPORT_REGEX.exec(node.content)) !== null) {
    const resolved = resolveImportPath(namedMatch[2], node.absolute, activeRootDir);
    if (!resolved) continue;
    const resolvedNorm = path.relative(activeRootDir, resolved).replace(/\\/g, '/');
    if (!fileMap.has(resolvedNorm)) continue;
    const importLine = computeLineNumberAtOffset(node.content, namedMatch.index);
    recordNamedImportSpecifiers({ node, resolvedNorm, rawSpecifiers: namedMatch[1], importLine });
  }

  REEXPORT_FROM_REGEX.lastIndex = 0;
  let reExportMatch;
  while ((reExportMatch = REEXPORT_FROM_REGEX.exec(node.content)) !== null) {
    const resolved = resolveImportPath(reExportMatch[2], node.absolute, activeRootDir);
    if (!resolved) continue;
    const resolvedNorm = path.relative(activeRootDir, resolved).replace(/\\/g, '/');
    if (fileMap.has(resolvedNorm)) {
      node.reExportTargets.add(resolvedNorm);
    }
  }
}

/**
 * Indexa imports de um único nó no mapa de arquivos do repositório.
 * @param {Record<string, any>} node
 * @param {Map<string, any>} fileMap
 * @param {string} [activeRootDir]
 */
function indexNodeImports(node, fileMap, activeRootDir = ROOT) {
  if (node.path.endsWith('.md')) return;
  IMPORT_EXPORT_REGEX.lastIndex = 0;
  let match;
  while ((match = IMPORT_EXPORT_REGEX.exec(node.content)) !== null) {
    const resolved = resolveImportPath(match[1], node.absolute, activeRootDir);
    if (!resolved) continue;
    const resolvedNorm = path.relative(activeRootDir, resolved).replace(/\\/g, '/');
    if (fileMap.has(resolvedNorm)) {
      node.imports.add(resolvedNorm);
      fileMap.get(resolvedNorm).importedBy.add(node.path);
    }
  }
  indexNodeNamedSymbolsAndReExports(node, fileMap, activeRootDir);
}

/**
 * Propaga os consumidores de um barrel pass-through para um alvo re-exportado específico.
 * @param {{ barrelNode: Record<string, any>; targetNorm: string; targetNode: Record<string, any>; fileMap: Map<string, any> }} propCtx
 */
function propagateBarrelConsumersToTarget(propCtx) {
  const { barrelNode, targetNorm, targetNode, fileMap } = propCtx;
  for (const consumerNorm of barrelNode.importedBy) {
    if (consumerNorm === targetNorm) continue;
    targetNode.importedBy.add(consumerNorm);
    const consumerNode = fileMap.get(consumerNorm);
    const viaBarrel = consumerNode?.importedSymbolsBySource.get(barrelNode.path);
    if (viaBarrel && !consumerNode.importedSymbolsBySource.has(targetNorm)) {
      consumerNode.importedSymbolsBySource.set(targetNorm, viaBarrel);
    }
  }
}

/**
 * Propaga consumidores de barrels pass-through (ex.: `frontend/src/types/project.ts` -> `backend/src/types/project.ts`).
 * @param {Record<string, any>} barrelNode
 * @param {Map<string, any>} fileMap
 */
function propagatePassThroughBarrel(barrelNode, fileMap) {
  for (const targetNorm of barrelNode.reExportTargets) {
    const targetNode = fileMap.get(targetNorm);
    if (targetNode) {
      propagateBarrelConsumersToTarget({ barrelNode, targetNorm, targetNode, fileMap });
    }
  }
}

/**
 * Propaga seletivamente consumidores do barrel agregador `backend/src/index.ts` apenas aos módulos cujos símbolos foram importados.
 * @param {Record<string, any>} indexBarrelNode
 * @param {Map<string, any>} fileMap
 */
function propagateAggregatorBarrelBySymbol(indexBarrelNode, fileMap) {
  for (const consumerNorm of indexBarrelNode.importedBy) {
    const consumerNode = fileMap.get(consumerNorm);
    const importedRecord = consumerNode?.importedSymbolsBySource.get(indexBarrelNode.path);
    if (!importedRecord) continue;
    linkConsumerToMatchingReExportTargets({ consumerNorm, consumerNode, importedRecord, indexBarrelNode, fileMap });
  }
}

/**
 * Conecta um consumidor de `backend/src/index.ts` aos submódulos específicos que exportam os símbolos consumidos.
 * @param {{ consumerNorm: string; consumerNode: Record<string, any>; importedRecord: { symbols: Set<string>; line: number }; indexBarrelNode: Record<string, any>; fileMap: Map<string, any> }} linkCtx
 */
function linkConsumerToMatchingReExportTargets(linkCtx) {
  const { consumerNorm, consumerNode, importedRecord, indexBarrelNode, fileMap } = linkCtx;
  for (const targetNorm of indexBarrelNode.reExportTargets) {
    const targetNode = fileMap.get(targetNorm);
    if (!targetNode) continue;
    const matchedSyms = targetNode.exportedSymbols
      .map((/** @type {{ name: string }} */ s) => s.name)
      .filter((/** @type {string} */ name) => importedRecord.symbols.has(name));
    if (matchedSyms.length > 0) {
      targetNode.importedBy.add(consumerNorm);
      consumerNode.imports.add(targetNorm);
      consumerNode.importedSymbolsBySource.set(targetNorm, {
        symbols: new Set(matchedSyms),
        line: importedRecord.line,
      });
    }
  }
}

/**
 * Propaga arestas de re-exportação em duas passagens para cobrir cadeias multi-hop sem ciclos.
 * @param {Map<string, any>} fileMap
 */
function propagateBarrelReExports(fileMap) {
  const indexBarrel = fileMap.get(AGGREGATOR_BARREL_PATH);
  if (indexBarrel) {
    propagateAggregatorBarrelBySymbol(indexBarrel, fileMap);
  }
  const passThroughBarrels = Array.from(fileMap.values()).filter(
    (node) => node.path !== AGGREGATOR_BARREL_PATH && node.reExportTargets.size > 0
  );
  for (let pass = 0; pass < 2; pass++) {
    passThroughBarrels.forEach((node) => propagatePassThroughBarrel(node, fileMap));
  }
}

/**
 * Conecta os nós de código que referenciam o nome base de um prompt `.md`.
 * @param {string} promptNorm
 * @param {Record<string, any>} promptNode
 * @param {Array<Record<string, any>>} codeNodes
 */
function linkCodeNodesReferencingPrompt(promptNorm, promptNode, codeNodes) {
  const baseName = path.basename(promptNorm);
  for (const codeNode of codeNodes) {
    if (codeNode.content.includes(baseName)) {
      codeNode.imports.add(promptNorm);
      promptNode.importedBy.add(codeNode.path);
    }
  }
}

/**
 * Conecta templates e subprompts modulares `backend/prompts/*.md` ao `loader.ts` e aos orquestradores que os referenciam.
 * @param {Map<string, any>} fileMap
 */
function indexPromptSemanticEdges(fileMap) {
  const loaderNode = fileMap.get(PROMPT_LOADER_PATH);
  const promptEntries = Array.from(fileMap.entries()).filter(([norm]) => norm.startsWith('backend/prompts/') && norm.endsWith('.md'));
  const codeNodes = Array.from(fileMap.values()).filter((n) => !n.path.endsWith('.md'));

  for (const [promptNorm, promptNode] of promptEntries) {
    if (loaderNode) {
      loaderNode.imports.add(promptNorm);
      promptNode.importedBy.add(PROMPT_LOADER_PATH);
    }
    linkCodeNodesReferencingPrompt(promptNorm, promptNode, codeNodes);
    linkSubpromptToParentCommonPrompt(promptNorm, promptNode, promptEntries);
  }
}

/**
 * Conecta um subprompt de modo/fork (`03-3_...md`, `03-3A_...md`) ao seu template pai `*_common.md`.
 * @param {string} promptNorm
 * @param {Record<string, any>} promptNode
 * @param {Array<[string, Record<string, any>]>} promptEntries
 */
function linkSubpromptToParentCommonPrompt(promptNorm, promptNode, promptEntries) {
  const baseName = path.basename(promptNorm);
  const subMatch = baseName.match(/^(\d+(?:-[CD])?)-[123](?:[A-D])?_(.+)\.md$/);
  if (!subMatch) return;
  const prefix = `${subMatch[1]}_`;
  for (const [candidateNorm, candidateNode] of promptEntries) {
    const candidateBase = path.basename(candidateNorm);
    if (candidateBase.startsWith(prefix) && candidateBase.endsWith('_common.md')) {
      candidateNode.imports.add(promptNorm);
      promptNode.importedBy.add(candidateNorm);
    }
  }
}

/** @param {string} routeNorm */
function buildApiRouteMatcherRegex(routeNorm) {
  const match = routeNorm.match(/^frontend\/src\/app\/(api\/.+)\/route\.ts$/);
  if (!match) return null;
  const routePattern = match[1].replace(/\[[^\]]+\]/g, '(?:\\$\\{[^}]+\\}|\\[[^\\]]+\\]|[A-Za-z0-9_-]+)');
  return new RegExp(`/${routePattern}(?:['"\`/?]|$)`);
}

/**
 * Conecta os chamadores HTTP que invocam uma rota BFF específica.
 * @param {{ routeNorm: string; routeNode: Record<string, any>; routeRegex: RegExp; candidateCallers: Array<Record<string, any>> }} routeLinkCtx
 */
function linkCallersToApiRoute(routeLinkCtx) {
  const { routeNorm, routeNode, routeRegex, candidateCallers } = routeLinkCtx;
  for (const callerNode of candidateCallers) {
    if (callerNode.path !== routeNorm && routeRegex.test(callerNode.content)) {
      callerNode.imports.add(routeNorm);
      routeNode.importedBy.add(callerNode.path);
    }
  }
}

/**
 * Conecta rotas BFF Next.js (`frontend/src/app/api/.../route.ts`) aos componentes UI e testes que chamam `/api/...`.
 * @param {Map<string, any>} fileMap
 */
function indexApiRouteSemanticEdges(fileMap) {
  const routeEntries = Array.from(fileMap.entries()).filter(
    ([norm]) => norm.startsWith('frontend/src/app/api/') && norm.endsWith('/route.ts')
  );
  const candidateCallers = Array.from(fileMap.values()).filter((n) => !n.path.endsWith('.md'));

  for (const [routeNorm, routeNode] of routeEntries) {
    const routeRegex = buildApiRouteMatcherRegex(routeNorm);
    if (routeRegex) {
      linkCallersToApiRoute({ routeNorm, routeNode, routeRegex, candidateCallers });
    }
  }
}

/** @param {string} normPath @returns {string[]} */
function buildInspectionSearchTokens(normPath) {
  const segments = normPath.split('/');
  const tokens = new Set([normPath]);
  if (segments.length >= 2) {
    tokens.add(segments.slice(1).join('/'));
  }
  if (segments.length >= 3) {
    tokens.add(segments.slice(-3).join('/'));
  }
  const baseName = segments[segments.length - 1] ?? '';
  if (segments.length >= 2 && !['page.tsx', 'route.ts', 'layout.tsx', 'index.ts'].includes(baseName)) {
    tokens.add(segments.slice(-2).join('/'));
  }
  return Array.from(tokens).filter((t) => t.length >= MIN_SEARCH_TOKEN_LENGTH);
}

/**
 * Registra as suítes de teste que inspecionam um determinado nó de código.
 * @param {{ isTest: boolean; importedBy: Set<string> }} targetNode
 * @param {string[]} tokens
 * @param {Array<{ path: string; content: string }>} testNodes
 */
function attachInspectingTestsToNode(targetNode, tokens, testNodes) {
  for (const testNode of testNodes) {
    if (tokens.some((tok) => testNode.content.includes(tok))) {
      targetNode.importedBy.add(testNode.path);
    }
  }
}

/**
 * Conecta suítes de teste que inspecionam arquivos via fs.readFileSync / readRepoFile.
 * @param {Map<string, any>} fileMap
 */
function indexSourceInspectingTests(fileMap) {
  const testNodes = Array.from(fileMap.values()).filter(
    (n) => n.isTest && (n.content.includes('readFileSync') || n.content.includes('readRepoFile'))
  );
  for (const [targetNorm, targetNode] of fileMap.entries()) {
    if (targetNode.isTest) continue;
    attachInspectingTestsToNode(targetNode, buildInspectionSearchTokens(targetNorm), testNodes);
  }
}

/**
 * @param {string} file
 * @param {string} [activeRootDir]
 */
function createGraphNode(file, activeRootDir = ROOT) {
  const norm = path.relative(activeRootDir, file).replace(/\\/g, '/');
  let content = '';
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err instanceof Error && err.message.length < 0) content = '';
  }
  const isVitest = norm.includes('.test.') || norm.includes('__tests__');
  const isE2E = norm.startsWith('frontend/e2e/') && (norm.endsWith('.spec.ts') || norm.endsWith('.mcp.ts'));
  return {
    path: norm,
    absolute: file,
    content,
    imports: new Set(),
    importedBy: new Set(),
    reExportTargets: new Set(),
    exportedSymbols: norm.endsWith('.md') ? [] : extractExportedSymbols(content),
    importedSymbolsBySource: new Map(),
    isVitest,
    isE2E,
    isTest: isVitest || isE2E,
  };
}

/**
 * Constrói e retorna o mapa completo do grafo de dependências cross-workspace do repositório.
 * Exemplo: const fileMap = buildGraph();
 * @param {string} [activeRootDir]
 */
export function buildGraph(activeRootDir = ROOT) {
  const sourceFiles = getAllSourceFiles(activeRootDir);

  const fileMap = new Map();
  for (const file of sourceFiles) {
    const node = createGraphNode(file, activeRootDir);
    fileMap.set(node.path, node);
  }

  for (const node of fileMap.values()) {
    indexNodeImports(node, fileMap, activeRootDir);
  }
  propagateBarrelReExports(fileMap);
  indexPromptSemanticEdges(fileMap);
  indexApiRouteSemanticEdges(fileMap);
  indexSourceInspectingTests(fileMap);
  return fileMap;
}

/**
 * Resolve o caminho normalizado do arquivo-alvo dentro do `fileMap`.
 * @param {string} rawTargetPath
 * @param {Map<string, any>} fileMap
 * @returns {string | null}
 */
function resolveTargetNormPath(rawTargetPath, fileMap) {
  const cleanTarget = rawTargetPath.replace(/^[./\\]+/, '').replace(/\\/g, '/');
  if (fileMap.has(cleanTarget)) return cleanTarget;

  const candidates = TARGET_SEARCH_PREFIXES.flatMap((prefix) =>
    SCAN_EXTENSIONS.concat(['']).map((ext) => `${prefix}${cleanTarget}${ext}`)
  );
  return candidates.find((candidate) => fileMap.has(candidate)) ?? null;
}

/**
 * Separa os dependentes diretos de um nó em consumidores de código, testes Vitest e suítes E2E.
 * @param {Record<string, any>} targetNode
 * @param {Map<string, any>} fileMap
 */
function splitDirectDependents(targetNode, fileMap) {
  const directConsumers = [];
  const directVitest = [];
  const directE2E = [];
  for (const dep of targetNode.importedBy) {
    const depNode = fileMap.get(dep);
    if (!depNode) continue;
    if (depNode.isVitest) directVitest.push(dep);
    else if (depNode.isE2E) directE2E.push(dep);
    else directConsumers.push(dep);
  }
  return { directConsumers, directVitest, directE2E };
}

/**
 * Coleta consumidores e suítes de teste transitivos (2º grau) a partir dos consumidores diretos.
 * @param {string} foundNorm
 * @param {string[]} directConsumers
 * @param {Map<string, any>} fileMap
 */
function collectTransitiveImpact(foundNorm, directConsumers, fileMap) {
  const transitiveConsumers = new Set();
  const transitiveVitest = new Set();
  const transitiveE2E = new Set();
  const directSet = new Set(directConsumers);
  const upstreams = directConsumers.flatMap((c) => Array.from(fileMap.get(c)?.importedBy ?? []));

  for (const upstream of upstreams) {
    if (upstream === foundNorm || directSet.has(upstream)) continue;
    const upNode = fileMap.get(upstream);
    if (!upNode) continue;
    if (upNode.isVitest) transitiveVitest.add(upstream);
    else if (upNode.isE2E) transitiveE2E.add(upstream);
    else transitiveConsumers.add(upstream);
  }
  return { transitiveConsumers, transitiveVitest, transitiveE2E };
}

/**
 * Emparelha automaticamente `.spec.ts` <-> `mcp/*.mcp.ts` conforme a Regra 1.15 (Dual E2E Validation).
 * @param {Iterable<string>} rawE2EPaths
 * @param {Map<string, any>} fileMap
 */
function expandDualE2EPairs(rawE2EPaths, fileMap) {
  const expanded = new Set(rawE2EPaths);
  for (const e2ePath of Array.from(expanded)) {
    if (e2ePath.startsWith('frontend/e2e/') && e2ePath.endsWith('.spec.ts')) {
      const base = path.basename(e2ePath, '.spec.ts');
      const mcpPair = `frontend/e2e/mcp/${base}.mcp.ts`;
      if (fileMap.has(mcpPair)) expanded.add(mcpPair);
    } else if (e2ePath.startsWith('frontend/e2e/mcp/') && e2ePath.endsWith('.mcp.ts')) {
      const base = path.basename(e2ePath, '.mcp.ts');
      const specPair = `frontend/e2e/${base}.spec.ts`;
      if (fileMap.has(specPair)) expanded.add(specPair);
    }
  }
  return Array.from(expanded);
}

/**
 * Constrói o mapa `{ [consumerPath]: { symbols: string[], line: number } }` para os consumidores diretos do alvo.
 * @param {string} foundNorm
 * @param {string[]} directConsumers
 * @param {Map<string, any>} fileMap
 */
function buildConsumerSymbolMap(foundNorm, directConsumers, fileMap) {
  /** @type {Record<string, { symbols: string[]; line: number }>} */
  const consumerSymbolMap = {};
  for (const consumerNorm of directConsumers) {
    const consumerNode = fileMap.get(consumerNorm);
    const importEntry = consumerNode?.importedSymbolsBySource.get(foundNorm);
    if (importEntry) {
      consumerSymbolMap[consumerNorm] = {
        symbols: Array.from(importEntry.symbols),
        line: importEntry.line,
      };
    }
  }
  return consumerSymbolMap;
}

/**
 * Classifica o nível de risco pré-voo (`HIGH`, `MEDIUM` ou `LOW`).
 * @param {number} totalConsumers
 * @param {string[]} directConsumers
 */
function computeRiskLevel(totalConsumers, directConsumers) {
  const hasCriticalDirect = directConsumers.some((c) => c.includes('route.ts') || c.includes('AutoSave'));
  if (totalConsumers > HIGH_RISK_CONSUMER_THRESHOLD || hasCriticalDirect) return 'HIGH';
  if (directConsumers.length > 0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Formata o comando recomendado de execução Vitest para as suítes unitárias impactadas.
 * @param {string[]} impactedTestSuites
 */
function formatRecommendedVitestCommand(impactedTestSuites) {
  if (impactedTestSuites.length === 0) return '';
  const relSuites = impactedTestSuites.map((s) => (s.startsWith('frontend/') ? s.slice('frontend/'.length) : s));
  return `npm test --prefix frontend -- ${relSuites.join(' ')}`;
}

/**
 * Formata o comando recomendado de execução Playwright para os pares `.spec.ts` impactados.
 * @param {string[]} impactedE2ESuites
 */
function formatRecommendedPlaywrightCommand(impactedE2ESuites) {
  const specSuites = impactedE2ESuites
    .filter((s) => s.endsWith('.spec.ts'))
    .map((s) => (s.startsWith('frontend/') ? s.slice('frontend/'.length) : s));
  if (specSuites.length === 0) return '';
  return `npx --prefix frontend playwright test ${specSuites.join(' ')}`;
}

/**
 * Verifica se um relatório individual satisfaz os critérios de isolamento da Express Lane (`XS_EXPRESS`).
 * @param {Record<string, any>} r
 */
function isReportEligibleForExpress(r) {
  const totalConsumers =
    (r.metrics?.directConsumersCount ?? r.directConsumers?.length ?? 0) +
    (r.metrics?.transitiveConsumersCount ?? r.transitiveConsumers?.length ?? 0);
  return (
    totalConsumers === 0 &&
    r.riskLevel === 'LOW' &&
    r.governanceAxis !== 'B_SECURITY_HARDENING' &&
    !r.securitySurfaceTouched
  );
}

/**
 * Calcula deterministicamente o tier de cerimônia (`XS_EXPRESS` vs. `FULL_EGM_DAG`) de forma TDD-safe (GF-03, GF-05).
 * @param {Array<Record<string, any>>} validReports
 * @param {{ stopAndWarnTriggered?: boolean }} [scopeHeterogeneity]
 * @returns {'XS_EXPRESS' | 'FULL_EGM_DAG'}
 */
export function computeCeremonyTier(validReports, scopeHeterogeneity) {
  if (!validReports || validReports.length === 0) return 'FULL_EGM_DAG';
  if (scopeHeterogeneity?.stopAndWarnTriggered) return 'FULL_EGM_DAG';

  const nonTestReports = validReports.filter((r) => !r.isTest);
  if (nonTestReports.length > 1) return 'FULL_EGM_DAG';

  return validReports.every(isReportEligibleForExpress) ? 'XS_EXPRESS' : 'FULL_EGM_DAG';
}

/**
 * Constrói o objeto de métricas numéricas de dependentes e suítes impactadas (GF-01).
 * @param {string[]} directConsumers
 * @param {Set<string>} transitiveConsumers
 * @param {string[]} impactedTestSuites
 * @param {string[]} impactedE2ESuites
 */
function buildTargetMetrics(directConsumers, transitiveConsumers, impactedTestSuites, impactedE2ESuites) {
  return {
    directConsumersCount: directConsumers.length,
    transitiveConsumersCount: transitiveConsumers.size,
    impactedTestsCount: impactedTestSuites.length,
    impactedE2ECount: impactedE2ESuites.length,
  };
}

/**
 * Monta o objeto base de relatório de Blast Radius para um alvo resolvido.
 * @param {{ foundNorm: string; targetNode: Record<string, any>; directConsumers: string[]; transitiveConsumers: Set<string>; impactedTestSuites: string[]; impactedE2ESuites: string[]; fileMap: Map<string, any> }} ctx
 */
function createTargetReportObject(ctx) {
  const { foundNorm, targetNode, directConsumers, transitiveConsumers, impactedTestSuites, impactedE2ESuites, fileMap } = ctx;
  const layer = detectLayer(foundNorm);
  const axis = detectGovernanceAxis(foundNorm);
  const isTest = Boolean(targetNode.isTest);
  const { securitySurfaceTouched, relatedDocs } = resolveRelatedDocsForTarget(foundNorm, isTest);
  return {
    /** @type {string | undefined} */ error: undefined,
    /** @type {string[]} */ availableFilesSample: [],
    target: foundNorm,
    isTest,
    securitySurfaceTouched,
    relatedDocs,
    layer: layer.id,
    layerLabel: layer.label,
    governanceAxis: axis.id,
    governanceAxisLabel: axis.label,
    riskLevel: computeRiskLevel(directConsumers.length + transitiveConsumers.size, directConsumers),
    exportedSymbols: targetNode.exportedSymbols,
    consumerSymbolMap: buildConsumerSymbolMap(foundNorm, directConsumers, fileMap),
    directDependencies: Array.from(targetNode.imports),
    directConsumers,
    transitiveConsumers: Array.from(transitiveConsumers),
    impactedTestSuites,
    impactedE2ESuites,
    recommendedTestCommand: formatRecommendedVitestCommand(impactedTestSuites),
    recommendedE2ECommand: formatRecommendedPlaywrightCommand(impactedE2ESuites),
    metrics: buildTargetMetrics(directConsumers, transitiveConsumers, impactedTestSuites, impactedE2ESuites),
    /** @type {'XS_EXPRESS' | 'FULL_EGM_DAG'} */ ceremonyTier: 'FULL_EGM_DAG',
  };
}

/**
 * Monta o objeto final de relatório de Blast Radius para um único arquivo-alvo já resolvido.
 * @param {string} foundNorm
 * @param {Map<string, any>} fileMap
 */
function buildTargetBlastReport(foundNorm, fileMap) {
  const targetNode = fileMap.get(foundNorm);
  const { directConsumers, directVitest, directE2E } = splitDirectDependents(targetNode, fileMap);
  const { transitiveConsumers, transitiveVitest, transitiveE2E } = collectTransitiveImpact(foundNorm, directConsumers, fileMap);
  const impactedTestSuites = Array.from(new Set([...directVitest, ...transitiveVitest]));
  const impactedE2ESuites = expandDualE2EPairs([...directE2E, ...transitiveE2E], fileMap);
  const report = createTargetReportObject({
    foundNorm,
    targetNode,
    directConsumers,
    transitiveConsumers,
    impactedTestSuites,
    impactedE2ESuites,
    fileMap,
  });
  report.ceremonyTier = computeCeremonyTier([report], { stopAndWarnTriggered: false });
  report.goldfishRequired = true;
  return report;
}

/**
 * Calcula dependentes diretos, transitivos, símbolos exportados, eixo da Regra 1.11 e suítes de teste impactadas por um arquivo-alvo.
 * Exemplo: const report = calculateBlastRadius('frontend/src/lib/export/docx-helpers.ts');
 *
 * @param {string} rawTargetPath
 * @param {Map<string, any>} [existingFileMap]
 * @returns {Record<string, any>}
 */
export function calculateBlastRadius(rawTargetPath, existingFileMap) {
  const fileMap = existingFileMap ?? buildGraph();
  const foundNorm = resolveTargetNormPath(rawTargetPath, fileMap);
  if (!foundNorm || !fileMap.has(foundNorm)) {
    return {
      error: `Arquivo não encontrado no grafo de código: ${rawTargetPath}`,
      availableFilesSample: Array.from(fileMap.keys()).slice(0, MAX_SAMPLE_FILES),
      ceremonyTier: 'FULL_EGM_DAG',
      goldfishRequired: true,
    };
  }
  return buildTargetBlastReport(foundNorm, fileMap);
}

/**
 * Avalia o gatilho de heterogeneidade de escopo da Regra 1.11 (Stop-and-Warn) para um conjunto de relatórios.
 * @param {Array<Record<string, any>>} validReports
 */
function evaluateScopeHeterogeneity(validReports) {
  const axesTouched = Array.from(new Set(validReports.map((r) => r.governanceAxis).filter(Boolean)));
  const touchesInfraWithOther = axesTouched.includes('A_INFRA_SERVERLESS') && axesTouched.length > 1;
  const stopAndWarnTriggered = touchesInfraWithOther || axesTouched.length > 2;
  const axesJoined = axesTouched.length > 0 ? axesTouched.join(', ') : 'N/A';
  const reason = stopAndWarnTriggered
    ? `Gatilho Stop-and-Warn (Regra 1.11) ativado: escopo cruza os eixos [${axesTouched.join(', ')}].`
    : `Escopo coeso dentro dos limites da Regra 1.11 (${axesJoined}).`;
  return { axesTouched, stopAndWarnTriggered, reason };
}

/**
 * Consolida a análise de Blast Radius para múltiplos arquivos-alvo reutilizando uma única construção do grafo,
 * avaliando heterogeneidade de escopo nos 5 Eixos (Regra 1.11) e deduplicando comandos Vitest e E2E.
 * Exemplo: const dossier = calculateMultiTargetBlastRadius(['src/lib/export/doc-builder.ts', 'src/lib/export/docx-helpers.ts']);
 *
 * @param {string[]} targetPaths
 * @param {Map<string, any>} [existingFileMap]
 */
export function calculateMultiTargetBlastRadius(targetPaths, existingFileMap) {
  const fileMap = existingFileMap ?? buildGraph();
  const targets = targetPaths.map((targetPath) => calculateBlastRadius(targetPath, fileMap));
  const validReports = targets.filter((t) => !t.error);
  const scopeHeterogeneity = evaluateScopeHeterogeneity(validReports);
  const hasInvalidTarget = targets.some((t) => Boolean(t.error));
  const ceremonyTier = hasInvalidTarget
    ? 'FULL_EGM_DAG'
    : computeCeremonyTier(validReports, scopeHeterogeneity);
  const allVitestSuites = Array.from(new Set(validReports.flatMap((r) => r.impactedTestSuites ?? [])));
  const allE2ESuites = Array.from(new Set(validReports.flatMap((r) => r.impactedE2ESuites ?? [])));

  return {
    targets,
    ceremonyTier,
    goldfishRequired: true,
    securitySurfaceTouched: validReports.some((r) => Boolean(r.securitySurfaceTouched)),
    relatedDocs: Array.from(new Set(validReports.flatMap((r) => r.relatedDocs ?? []))),
    scopeHeterogeneity,
    consolidatedTestSuites: allVitestSuites,
    consolidatedE2ESuites: allE2ESuites,
    recommendedTestCommand: formatRecommendedVitestCommand(allVitestSuites),
    recommendedE2ECommand: formatRecommendedPlaywrightCommand(allE2ESuites),
  };
}

/**
 * Formata a seção Markdown de um único arquivo-alvo dentro do Dossiê Pré-Compilado do Goldfish.
 * @param {Record<string, any>} report
 */
function renderTargetDossierSectionMarkdown(report) {
  if (report.error) {
    return `### ❌ Alvo Não Encontrado\n- ${report.error}`;
  }
  const exportedList =
    report.exportedSymbols.length === 0
      ? '_Nenhum símbolo público exportado_'
      : report.exportedSymbols.map((/** @type {{ name: string; kind: string; line: number }} */ s) => `\`${s.name}\` (${s.kind} :L${s.line})`).join(', ');
  const consumerEntries = Object.entries(report.consumerSymbolMap ?? {});
  const consumerLines =
    consumerEntries.length === 0
      ? ['  - _Sem imports nomeados diretos mapeados_']
      : consumerEntries.map(([cPath, meta]) => `  - \`${cPath}:L${meta.line}\` consome: ${meta.symbols.map((/** @type {string} */ s) => `\`${s}\``).join(', ')}`);

  return [
    `### 🎯 Alvo: \`${report.target}\``,
    `- **Camada:** \`[${report.layer}]\` ${report.layerLabel}`,
    `- **Eixo de Governança (Regra 1.11):** \`${report.governanceAxis}\` (${report.governanceAxisLabel})`,
    `- **Nível de Risco:** **${report.riskLevel}** (${report.metrics.directConsumersCount} diretos | ${report.metrics.transitiveConsumersCount} transitivos)`,
    `- **Símbolos Públicos Exportados (${report.exportedSymbols.length}):** ${exportedList}`,
    `- **Mapa de Símbolos por Consumidor Direto:**`,
    ...consumerLines,
  ].join('\n');
}

/**
 * Formata a linha de superfície de segurança / Threat Model no dossiê Goldfish (GF-01).
 * @param {ReturnType<typeof calculateMultiTargetBlastRadius>} multiReport
 */
function formatThreatModelDossierLine(multiReport) {
  return multiReport.securitySurfaceTouched
    ? '- **Superfície de Segurança / Threat Model (Regra 1.8):** `workspace/kb/THREAT_MODEL.md` (Leitura Obrigatória)'
    : '- **Superfície de Segurança / Threat Model (Regra 1.8):** _Não acionada diretamente_';
}

/**
 * Renderiza o Dossiê Pré-Compilado em Markdown enxuto para alimentar o subagente `Goldfish Cold Spec Auditor` (`--goldfish`).
 * Exemplo: const markdown = formatGoldfishDossierMarkdown(calculateMultiTargetBlastRadius(['scripts/blast-radius.mjs']));
 *
 * @param {ReturnType<typeof calculateMultiTargetBlastRadius>} multiReport
 */
export function formatGoldfishDossierMarkdown(multiReport) {
  const { scopeHeterogeneity, ceremonyTier, targets, recommendedTestCommand, recommendedE2ECommand } = multiReport;
  const stopAndWarnBadge = scopeHeterogeneity.stopAndWarnTriggered ? '🚨 **SIM (STOP-AND-WARN ATIVADO)**' : '✅ **NÃO (Escopo Coeso)**';
  const targetSections = targets.map((t) => renderTargetDossierSectionMarkdown(t)).join('\n\n');
  const axesDisplay = scopeHeterogeneity.axesTouched.length > 0 ? scopeHeterogeneity.axesTouched.map((a) => `\`${a}\``).join(', ') : '_Nenhum_';
  const vitestCmdDisplay = recommendedTestCommand !== '' ? recommendedTestCommand : 'Nenhuma suíte Vitest impactada';
  const e2eCmdDisplay = recommendedE2ECommand !== '' ? recommendedE2ECommand : 'Nenhuma suíte E2E impactada';

  return [
    `# 🐠 Dossiê Pré-Compilado para Cold Spec Review (EGM Goldfish)`,
    `## 🧭 Diagnóstico Preventivo de Heterogeneidade (Regra 1.11 — 5 Eixos)`,
    `- **Ceremony Tier:** \`${ceremonyTier}\``,
    formatThreatModelDossierLine(multiReport),
    `- **Eixos Tocados:** ${axesDisplay}`,
    `- **Gatilho Stop-and-Warn:** ${stopAndWarnBadge}`,
    `- **Parecer:** ${scopeHeterogeneity.reason}`,
    `## 📦 Contratos, Símbolos e Dependentes por Arquivo-Alvo\n\n${targetSections}`,
    `## 🧪 Comandos de Verificação Consolidados`,
    `- **Vitest (TDD Unitário/Integração):** \`${vitestCmdDisplay}\``,
    `- **Playwright / Dual E2E (`.concat('`.spec.ts` + `.mcp.ts`):** `') + `${e2eCmdDisplay}\``,
  ].join('\n');
}

/** @param {string} text */
function printLine(text = '') {
  process.stdout.write(`${text}\n`);
}

/** @param {string} riskLevel */
function resolveRiskAnsiColor(riskLevel) {
  if (riskLevel === 'HIGH') return '\x1b[31m';
  if (riskLevel === 'MEDIUM') return '\x1b[33m';
  return '\x1b[32m';
}

/** @param {{ heading: string; items: string[]; emptyMessage: string; itemPrefix: string }} sectionSpec */
function printSectionItems(sectionSpec) {
  const { heading, items, emptyMessage, itemPrefix } = sectionSpec;
  printLine(heading);
  if (items.length === 0) {
    printLine(emptyMessage);
    return;
  }
  items.forEach((/** @type {string} */ item) => printLine(`${itemPrefix}${item}\x1b[0m`));
}

/** @param {Record<string, any>} result */
function printHumanReadableBlastRadius(result) {
  const riskColor = resolveRiskAnsiColor(result.riskLevel);
  printLine('\n\x1b[1m\x1b[36m════════════════════════════════════════════════════════════════════\x1b[0m');
  printLine(`\x1b[1m💥 ANÁLISE DE BLAST RADIUS: \x1b[37m${result.target}\x1b[0m`);
  printLine(`\x1b[1m🏛️  Camada Arquitetural:   \x1b[35m[${result.layer}] ${result.layerLabel}\x1b[0m`);
  printLine(`\x1b[1m🧭 Eixo Regra 1.11:       \x1b[34m[${result.governanceAxis}] ${result.governanceAxisLabel}\x1b[0m`);
  printLine(`\x1b[1m⚠️  Nível de Risco:        ${riskColor}${result.riskLevel}\x1b[0m`);
  printLine(`\x1b[1m⚡ Ceremony Tier:         \x1b[36m${result.ceremonyTier}\x1b[0m`);
  printLine('\x1b[36m════════════════════════════════════════════════════════════════════\x1b[0m\n');

  printSectionItems({ heading: `\x1b[1m📥 O que este arquivo consome (${result.directDependencies.length}):\x1b[0m`, items: result.directDependencies, emptyMessage: '   (Nenhuma dependência interna local)', itemPrefix: '   └─ \x1b[90m' });
  printSectionItems({ heading: `\n\x1b[1m💥 Quem depende diretamente deste arquivo (${result.directConsumers.length}):\x1b[0m`, items: result.directConsumers, emptyMessage: '   \x1b[32m✔ Nenhum consumidor direto de aplicação (módulo folha/isolado)\x1b[0m', itemPrefix: '   ├─ \x1b[33m' });
  if (result.transitiveConsumers.length > 0) {
    printSectionItems({ heading: `\n\x1b[1m🌊 Impacto Transitivo de 2º Grau (${result.transitiveConsumers.length}):\x1b[0m`, items: result.transitiveConsumers, emptyMessage: '', itemPrefix: '   └─ \x1b[90m' });
  }
  printSectionItems({ heading: `\n\x1b[1m🧪 Suítes de Teste Vitest Impactadas (${result.impactedTestSuites.length}):\x1b[0m`, items: result.impactedTestSuites, emptyMessage: '   \x1b[33m⚠️  Nenhum teste unitário consome este arquivo diretamente!\x1b[0m', itemPrefix: '   ✔ \x1b[32m' });
  if (result.impactedE2ESuites.length > 0) {
    printSectionItems({ heading: `\n\x1b[1m🎭 Suítes Dual E2E Impactadas (${result.impactedE2ESuites.length}):\x1b[0m`, items: result.impactedE2ESuites, emptyMessage: '', itemPrefix: '   🎭 \x1b[36m' });
  }

  printLine('\n\x1b[36m────────────────────────────────────────────────────────────────────\x1b[0m');
  printLine(`\x1b[1mResumo Pré-Voo:\x1b[0m ${result.metrics.directConsumersCount} dependentes diretos | ${result.metrics.impactedTestsCount} suítes Vitest | ${result.metrics.impactedE2ECount} suítes E2E.`);
  printLine('\x1b[36m────────────────────────────────────────────────────────────────────\x1b[0m\n');
}

/** @param {string[]} args */
function runCli(args) {
  const isJson = args.includes('--json');
  const isGoldfish = args.includes('--goldfish');
  const targetArgs = args.filter((a) => !a.startsWith('--'));

  if (targetArgs.length === 0) {
    process.stderr.write('Uso: node scripts/blast-radius.mjs <arquivo1> [arquivo2...] [--json] [--goldfish]\n');
    process.exit(1);
  }

  if (isGoldfish || targetArgs.length > 1) {
    const multiReport = calculateMultiTargetBlastRadius(targetArgs);
    printLine(isJson ? JSON.stringify(multiReport, null, 2) : formatGoldfishDossierMarkdown(multiReport));
    return;
  }

  const singleResult = calculateBlastRadius(targetArgs[0]);
  if (singleResult.error) {
    if (isJson) {
      printLine(JSON.stringify(singleResult, null, 2));
    } else {
      process.stderr.write(`\x1b[31m✖ ${singleResult.error}\x1b[0m\n`);
      singleResult.availableFilesSample.forEach((/** @type {string} */ f) => printLine(`  - ${f}`));
    }
    process.exit(1);
  }
  if (isJson) printLine(JSON.stringify(singleResult, null, 2));
  else printHumanReadableBlastRadius(singleResult);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  runCli(process.argv.slice(2));
}
