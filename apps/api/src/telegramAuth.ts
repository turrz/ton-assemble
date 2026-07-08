import crypto from 'node:crypto';

export interface TelegramUser {
  id: string;
}

export function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): TelegramUser {
  if (!botToken) {
    throw new Error('BOT_TOKEN is required to verify Telegram init data');
  }

  const parsed = new URLSearchParams(initData);
  const hash = parsed.get('hash');
  if (!hash) {
    throw new Error('Missing hash in init data');
  }

  parsed.delete('hash');

  const dataCheckString = Array.from(parsed.keys())
    .sort()
    .map((key) => `${key}=${parsed.get(key) ?? ''}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    throw new Error('Invalid Telegram init data hash');
  }

  const authDate = parsed.get('auth_date');
  if (authDate) {
    const authTime = Number(authDate);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isNaN(authTime) && now - authTime > maxAgeSeconds) {
      throw new Error('Telegram init data is too old');
    }
  }

  const userJson = parsed.get('user');
  if (!userJson) {
    throw new Error('Missing user field in init data');
  }

  let user: unknown;
  try {
    user = JSON.parse(userJson);
  } catch {
    throw new Error('Cannot parse Telegram user JSON');
  }

  if (!isTelegramUserPayload(user)) {
    throw new Error('Invalid Telegram user data');
  }

  return { id: String(user.id) };
}

function isTelegramUserPayload(value: unknown): value is { id: string | number } {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { id?: unknown }).id !== 'undefined';
}
