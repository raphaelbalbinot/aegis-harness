/**
 * .opencode/plugins/aegis-hook-guard.mjs — Adaptador Nativo OpenCode para o Aegis Hook Guard
 *
 * Intercepta `tool.execute.before` e delega 100% da lógica determinística para
 * `scripts/aegis-hook-guard.mjs` (sem duplicar regras).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DRAFT_MARKER_RE = /(?:^|\r?\n)\s*(?:Status:\s*DRAFT\b|<!--\s*aegis-draft\s*-->)/i;

/**
 * Converte o evento `tool.execute.before` do OpenCode no payload padrão do `aegis-hook-guard.mjs`.
 * No OpenCode, `write`/`edit` não possuem `ArtifactMetadata.RequestFeedback`: qualquer escrita em
 * `implementation_plan.md` sem marcador explícito de rascunho (`Status: DRAFT` ou `<!-- aegis-draft -->`)
 * é avaliada como plano pronto (`RequestFeedback: true`), ativando fisicamente o Confidence Gate e o 1º Goldfish.
 * @param {string} cwd
 * @param {{ tool?: string }} input
 * @param {{ args?: Record<string, any> }} output
 */
function buildHookPayload(cwd, input, output) {
  const rawTool = String(input?.tool ?? '').toLowerCase();
  const args = output?.args ?? {};

  if (rawTool === 'bash' || rawTool === 'shell' || rawTool === 'run_command') {
    return {
      cwd,
      toolCall: {
        name: 'run_command',
        args: { CommandLine: String(args.command ?? args.CommandLine ?? '') },
      },
    };
  }

  if (rawTool === 'write' || rawTool === 'edit' || rawTool === 'write_file' || rawTool === 'edit_file') {
    const mappedName = rawTool.startsWith('edit') ? 'edit_file' : 'write_file';
    const targetPath = String(args.filePath ?? args.path ?? args.Path ?? '');
    const content = args.content ?? args.Content;
    const replacement = args.newString ?? args.Replacement;
    const textSample = String(content ?? replacement ?? '');
    const isPlanFile = targetPath.replace(/\\/g, '/').endsWith('/implementation_plan.md') || targetPath === 'implementation_plan.md';
    const artifactMeta =
      args.ArtifactMetadata ??
      (isPlanFile ? { RequestFeedback: !DRAFT_MARKER_RE.test(textSample) } : undefined);

    return {
      cwd,
      toolCall: {
        name: mappedName,
        args: {
          Path: targetPath,
          Content: content,
          Target: args.oldString ?? args.Target,
          Replacement: replacement,
          ArtifactMetadata: artifactMeta,
        },
      },
    };
  }

  return null;
}

export const AegisHookGuardPlugin = async ({ directory }) => {
  const repoRoot = directory || process.cwd();
  const guardPath = path.join(repoRoot, 'scripts', 'aegis-hook-guard.mjs');
  const { evaluatePreToolUseHook } = await import(pathToFileURL(guardPath).href);

  return {
    'tool.execute.before': async (input, output) => {
      const payload = buildHookPayload(repoRoot, input, output);
      if (!payload) return;
      const result = evaluatePreToolUseHook(payload);
      if (result?.decision === 'deny') {
        throw new Error(result.reason || 'Bloqueado pelo Aegis Hook Guard.');
      }
    },
  };
};
