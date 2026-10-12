/**
 * Tutor de Programacao - servidor HTTP.
 * Node puro, sem dependencias externas: basta `npm start`.
 */
import http from 'node:http';
import { config, PUBLIC_DIR } from './config.js';
import { sendJson, sendError } from './http/router.js';
import { router as apiRouter } from './routes/index.js';
import { serveStatic } from './http/static.js';
import { applyCors, applySecurityHeaders, checkRateLimit } from './http/middleware.js';
import { logger, notFound } from './utils/index.js';

const servidor = http.createServer(async (req, res) => {
  const inicio = Date.now();
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  applyCors(req, res);
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname.startsWith('/api/')) {
      checkRateLimit(req);

      const rota = apiRouter.match(req.method, pathname);
      if (!rota) throw notFound(`Rota ${req.method} ${pathname} nao existe`);

      await rota.handler(req, res, rota.params);

      logger.debug(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - inicio}ms`);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await serveStatic(req, res, pathname)) return;

      // SPA: qualquer rota desconhecida sem extensao devolve o index.
      if (!pathname.includes('.') && (await serveStatic(req, res, '/index.html'))) return;
    }

    throw notFound('Pagina nao encontrada');
  } catch (erro) {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendError(res, erro);
  }
});

servidor.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    logger.error(
      `A porta ${config.port} ja esta em uso. Defina outra em PORT no arquivo .env, ` +
        'ou encerre o processo que a ocupa.',
    );
    process.exit(1);
  }
  logger.error('Erro no servidor:', erro);
});

servidor.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  const iaStatus = config.anthropic.apiKey
    ? `ativa (${config.anthropic.model})`
    : 'inativa (motor local)';

  logger.info('');
  logger.info('  Tutor de Programacao');
  logger.info(`  ${url}`);
  logger.info('');
  logger.info(`  Motor local  : ativo`);
  logger.info(`  IA (Claude)  : ${iaStatus}`);
  logger.info(`  Estaticos    : ${PUBLIC_DIR}`);
  logger.info('');
});

const encerrar = (sinal) => () => {
  logger.info(`\n${sinal} recebido, encerrando o servidor...`);
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};

process.on('SIGINT', encerrar('SIGINT'));
process.on('SIGTERM', encerrar('SIGTERM'));

process.on('unhandledRejection', (motivo) => {
  logger.error('Rejeicao nao tratada:', motivo);
});

export { servidor, sendJson };
