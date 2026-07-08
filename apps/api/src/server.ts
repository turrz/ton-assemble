import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { Db } from '@ton-site-builder/db';
import { TonClientProvider } from '@ton-site-builder/blockchain';
import { DomainService } from '@ton-site-builder/dns';
import { TonStorageService } from '@ton-site-builder/storage';
import { env, expandPath } from './config';
import { errorHandler } from './middleware';
import { registerApiRoutes } from './routes/apiRoutes';
import { registerPublicRoutes } from './routes/publicRoutes';
import { createServices } from './services';

const app = fastify({ logger: true });

app.setErrorHandler(errorHandler);

app.register(fastifyCors, { origin: true });

app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public', 'static'),
  prefix: '/static/',
});

app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public', 'assets'),
  prefix: '/assets/',
  decorateReply: false,
});

const db = new Db({ dbPath: env.DB_PATH });
const tonClientProvider = new TonClientProvider({
  rpcUrl: env.TON_RPC_URL,
  network: env.TON_NETWORK,
});
const dnsService = new DomainService({ clientProvider: tonClientProvider });
const storageService =
  env.TON_STORAGE_DAEMON_BIN && env.TON_STORAGE_DAEMON_HOST && env.TON_STORAGE_DB_PATH
    ? new TonStorageService({
        daemonBin: expandPath(env.TON_STORAGE_DAEMON_BIN),
        host: env.TON_STORAGE_DAEMON_HOST,
        database: expandPath(env.TON_STORAGE_DB_PATH),
      })
    : null;

const services = createServices({
  env,
  db,
  dnsService,
  storageService,
  tonClientProvider,
});

app.register(registerApiRoutes, { env, services });
app.register(registerPublicRoutes, { env, services });

const start = async () => {
  try {
    await app.listen({ port: Number(env.PORT), host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
