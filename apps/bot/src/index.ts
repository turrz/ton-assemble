import path from 'node:path';
import crypto from 'node:crypto';
import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { z } from 'zod';
import { Db, hashAccessKey } from '@ton-site-builder/db';

// Load .env from monorepo root (when running via npm run dev --workspace=..., cwd is apps/bot)
const rootDir = path.resolve(__dirname, '..', '..', '..');
dotenv.config();
dotenv.config({ path: path.join(rootDir, '.env') });

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url(),
  DB_PATH: z.string().default('./data/tonassemble.sqlite'),
  WEBAPP_PATH: z.string().default(''), // e.g. /app or empty for root
  ADMIN_TELEGRAM_ID: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Resolve DB path to absolute so API and bot always use same file (e.g. when run via pm2)
const dbPath = path.isAbsolute(env.DB_PATH) ? env.DB_PATH : path.resolve(process.cwd(), env.DB_PATH);
const db = new Db({ dbPath });
const bot = new Telegraf(env.BOT_TOKEN);

const webAppUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}${env.WEBAPP_PATH || ''}`;

// Show command list when user types /
bot.telegram.setMyCommands([
  { command: 'start', description: 'Welcome and open TonAssemble' },
  { command: 'app', description: 'Open TonAssemble Mini App' },
  { command: 'domains', description: 'Open app to manage .ton domains' },
  { command: 'preview', description: 'Get preview link: /preview <siteId>' },
  { command: 'ping', description: 'Test: bot replies pong' },
  ...(env.ADMIN_TELEGRAM_ID
    ? [
        { command: 'key', description: 'Admin: get access key for non-4N domain' },
        { command: 'getkey', description: 'Admin: same as /key' },
      ]
    : []),
]).catch(() => {});

bot.start(async (ctx) => {
  const telegramId = String(ctx.from?.id ?? '');
  db.upsertUser(telegramId);
  const adminHint = telegramId === env.ADMIN_TELEGRAM_ID ? '\n\nAdmin: send /key or /getkey to receive a one-time access key for non-4N domains.' : '';
  await ctx.reply(
    `Welcome to TonAssemble.\n\nCreate and publish static sites to your .ton domain. Open the app below to get started.${adminHint}`,
    Markup.inlineKeyboard([
      [Markup.button.webApp('Open TonAssemble', webAppUrl)],
    ])
  );
});

bot.command('app', async (ctx) => {
  await ctx.reply('Open TonAssemble to manage your sites and domains.', Markup.inlineKeyboard([
    [Markup.button.webApp('Open TonAssemble', webAppUrl)],
  ]));
});

bot.command('domains', async (ctx) => {
  await ctx.reply('View and verify your .ton domains in the app.', Markup.inlineKeyboard([
    [Markup.button.webApp('Open TonAssemble', webAppUrl)],
  ]));
});

bot.command('preview', async (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply('Usage: /preview <siteId>');
    return;
  }
  const siteId = Number(parts[1]);
  if (!Number.isInteger(siteId) || siteId <= 0) {
    await ctx.reply('Invalid site id.');
    return;
  }
  const url = `${env.PUBLIC_BASE_URL}/preview/${siteId}`;
  await ctx.reply(`Preview:\n${url}`);
});

async function handleKeyCommand(ctx: { from?: { id?: number }; reply: (text: string) => Promise<unknown> }) {
  const fromId = ctx.from?.id;
  if (fromId == null) {
    await ctx.reply('Cannot identify user.').catch(() => {});
    return;
  }
  const telegramId = String(fromId);
  if (!env.ADMIN_TELEGRAM_ID || telegramId !== env.ADMIN_TELEGRAM_ID) {
    await ctx.reply('Access denied.').catch(() => {});
    return;
  }
  try {
    const key = crypto.randomBytes(16).toString('hex');
    db.createAccessKey(hashAccessKey(key), telegramId);
    await ctx.reply(
      `Access key (single use, for non-4N domains):\n\n${key}\n\nSend this key when adding a non-4N domain in the app.`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create key.';
    console.error('[bot] /key error:', err);
    await ctx.reply(`Error: ${msg}`).catch(() => {});
  }
}

bot.command('key', handleKeyCommand);
bot.command('getkey', handleKeyCommand);

bot.command('ping', async (ctx) => {
  await ctx.reply('pong');
});

bot.launch().then(async () => {
  const me = await bot.telegram.getMe();
  console.log('TonAssemble bot started as @' + me.username + ' (id=' + me.id + ')');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
