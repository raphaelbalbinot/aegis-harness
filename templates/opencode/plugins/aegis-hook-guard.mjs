/**
 * .opencode/plugins/aegis-hook-guard.mjs — Adaptador Nativo OpenCode para o Aegis Hook Guard
 *
 * Intercepta `tool.execute.before` e delega 100% da lógica determinística para
 * `scripts/aegis-hook-guard.mjs` (sem duplicar regras).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Converte o evento `tool.execute.before` do OpenCode no payload padrão do `aegis-hook-guard.mjs`.
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
    return {
      cwd,
      toolCall: {
        name: mappedName,
        args: {
          Path: String(args.filePath ?? args.path ?? args.Path ?? ''),
          Content: args.content ?? args.Content,
          Target: args.oldString ?? args.Target,
          Replacement: args.newString ?? args.Replacement,
          ArtifactMetadata: args.ArtifactMetadata,
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
