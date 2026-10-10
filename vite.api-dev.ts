import { loadEnv, type Plugin } from 'vite';

/**
 * Só no `npm run dev`: atende /api/<nome> com as mesmas funções de `api/`
 * que rodam na Vercel, para desenvolver sem precisar do `vercel dev`.
 * As variáveis vêm do .env.local.
 */
export function apiDevServer(): Plugin {
  return {
    name: 'sisifo-api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ''));

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const route = /^\/api\/([a-z-]+)$/.exec(url.pathname)?.[1];
        if (!route) return next();

        try {
          const mod = (await server.ssrLoadModule(`/api/${route}.ts`)) as Record<
            string,
            ((request: Request) => Response | Promise<Response>) | undefined
          >;
          const method = req.method ?? 'GET';
          const handler = mod[method];
          if (!handler) {
            res.statusCode = 405;
            res.end();
            return;
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
          }
          const request = new Request(url, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });

          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            if (key !== 'set-cookie') res.setHeader(key, value);
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          if (error instanceof Error) server.ssrFixStacktrace(error);
          next(error);
        }
      });
    },
  };
}
