import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

const rootDir = path.resolve(__dirname, '..', '..', '..');

dotenv.config();
dotenv.config({ path: path.join(rootDir, '.env') });

const envSchema = z
  .object({
    PORT: z.string().default('3000'),
    PUBLIC_BASE_URL: z.string().url(),
    DB_PATH: z.string().default('./data/tonassemble.sqlite'),
    TON_RPC_URL: z.string().min(1),
    TON_NETWORK: z.enum(['mainnet']).default('mainnet'),
    TON_PROXY_ADNL_HEX: z.string().optional(),
    TON_STORAGE_DAEMON_BIN: z.string().optional(),
    TON_STORAGE_DAEMON_HOST: z.string().optional(),
    TON_STORAGE_DB_PATH: z.string().optional(),
    BOT_TOKEN: z.string().min(1),
    DONATE_TON_ADDRESS: z.string().optional(),
    DONATE_TEXT: z.string().optional(),
    CONTACT_TELEGRAM: z.string().optional(),
    CONTACT_X: z.string().optional(),
    CONTACT_EMAIL: z.string().optional(),
  })
  .refine(
    (v) =>
      (v.TON_PROXY_ADNL_HEX && v.TON_PROXY_ADNL_HEX.length >= 64) ||
      (v.TON_STORAGE_DAEMON_BIN && v.TON_STORAGE_DAEMON_HOST && v.TON_STORAGE_DB_PATH),
    { message: 'Set either TON_PROXY_ADNL_HEX (64+ hex) or all TON_STORAGE_* for publish' }
  );

export type ApiEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export function expandPath(p: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return p
    .replace(/^\$HOME(?=[/]|$)/, home)
    .replace(/^~(?=[/]|$)/, home)
    .replace(/\$HOME/g, home);
}
