import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Vite configuration.
 * - `npm run dev`       uses real Firebase (fill in src/firebase-config.js first).
 * - `npm run dev:mock`  uses the offline mock in /mock, so you can try the app
 *                       without any Firebase project. Mock data lives in your browser only.
 * The small plugin below lets the Newsstand function (/api/newsstand) run during
 * local development, just as it does on Vercel.
 */
export default defineConfig(({ mode }) => {
  const mock = mode === 'mock';
  const r = (p) => fileURLToPath(new URL(p, import.meta.url));

  return {
    define: {
      'import.meta.env.VITE_MOCK': JSON.stringify(mock ? 'true' : 'false')
    },
    resolve: {
      alias: mock
        ? [
            { find: /^firebase\/app$/, replacement: r('./mock/app.js') },
            { find: /^firebase\/auth$/, replacement: r('./mock/auth.js') },
            { find: /^firebase\/firestore$/, replacement: r('./mock/firestore.js') }
          ]
        : []
    },
    build: { chunkSizeWarningLimit: 1200 },
    plugins: [
      {
        name: 'local-api',
        configureServer(server) {
          server.middlewares.use('/api/newsstand', async (req, res) => {
            try {
              const mod = await server.ssrLoadModule('/api/newsstand.js');
              await mod.default(req, res);
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ items: [], failed: [], error: String(err) }));
            }
          });
        }
      }
    ]
  };
});
