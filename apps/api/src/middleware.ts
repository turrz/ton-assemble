import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiEnv } from './config';
import { TelegramUser, verifyTelegramInitData } from './telegramAuth';

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser?: TelegramUser;
  }
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: unknown,
    message?: string
  ) {
    super(message ?? (typeof payload === 'object' && payload ? JSON.stringify(payload) : String(payload)));
  }
}

export function createTelegramAuth(env: Pick<ApiEnv, 'BOT_TOKEN'>) {
  return async function telegramAuth(request: FastifyRequest, reply: FastifyReply) {
    const initData = request.headers['x-telegram-init-data'];
    if (!initData || typeof initData !== 'string') {
      request.log.warn('Telegram auth failed: missing init data');
      return reply.code(401).send({ ok: false, error: 'Unauthorized' });
    }

    try {
      request.telegramUser = verifyTelegramInitData(initData, env.BOT_TOKEN);
    } catch (err) {
      request.log.warn({ err }, 'Telegram auth failed');
      return reply.code(401).send({ ok: false, error: 'Unauthorized' });
    }
  };
}

export function requireTelegramId(request: FastifyRequest): string {
  if (!request.telegramUser) {
    throw new AppError(401, { ok: false, error: 'Unauthorized' }, 'Unauthorized');
  }
  return request.telegramUser.id;
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send(error.payload);
  }

  if (error instanceof ZodError) {
    request.log.warn({ err: error }, 'Request validation failed');
    if (request.raw.url?.startsWith('/api/')) {
      return reply.code(400).send({ ok: false, error: 'Invalid request' });
    }
    return reply.code(400).send('Invalid request');
  }

  request.log.error({ err: error }, 'Unhandled request error');
  return reply.code(500).send({ ok: false, error: 'Internal server error' });
}
