/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Veto absoluto a dependências circulares entre camadas e módulos (Regra R21 Clean Code).',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-client-importing-server',
      comment: 'Componentes de UI, hooks e páginas de navegador são proibidos de importar módulos Node.js ou SDKs administrativos server-side.',
      severity: 'error',
      from: {
        path: '(^src/components|^src/hooks|^frontend/src/components|^frontend/src/hooks)',
      },
      to: {
        path: '(^backend/|node:fs|node:path|node:child_process|firebase-admin)',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
  },
};
