import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface StorageServiceConfig {
  daemonBin: string;
  host: string;
  database: string;
  timeout?: number;
}

export interface StorageServiceUploadResult {
  contentId: string;
}

export interface StorageService {
  uploadStaticSite(dirPath: string): Promise<StorageServiceUploadResult>;
}

/**
 * Calls storage-daemon-cli to create and upload a bag from a directory.
 * Requires a running storage daemon; uses TON_STORAGE_DAEMON_* env.
 */
export class TonStorageService implements StorageService {
  private config: StorageServiceConfig;

  constructor(config: StorageServiceConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 60000,
    };
  }

  async uploadStaticSite(dirPath: string): Promise<StorageServiceUploadResult> {
    const stat = await fs.promises.stat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }
    const indexPath = path.join(dirPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error('Static site directory must contain index.html');
    }

    const args = [
      '-v', '0',
      '-I', this.config.host,
      '-k', path.join(this.config.database, 'cli-keys', 'client'),
      '-p', path.join(this.config.database, 'cli-keys', 'server.pub'),
      '--cmd', `create "${dirPath}" --json`,
    ];

    let stdout: string;
    let stderr: string;
    try {
      const { stdout: out, stderr: err } = await execFileAsync(this.config.daemonBin, args, {
        encoding: 'utf8',
        timeout: this.config.timeout,
        maxBuffer: 2 * 1024 * 1024,
      });
      stdout = out ?? '';
      stderr = err ?? '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`TON Storage upload failed: ${msg}`);
    }

    const fullOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
    const bagId = extractBagId(fullOutput);
    if (!bagId) {
      const snippet = fullOutput.length > 400 ? fullOutput.slice(0, 400) + '...' : fullOutput;
      throw new Error(`TON Storage did not return a valid bag id. Output: ${snippet || '(empty)'}`);
    }

    // Ensure upload is not paused so the gateway can fetch the bag via DHT
    try {
      await execFileAsync(this.config.daemonBin, [
        '-v', '0',
        '-I', this.config.host,
        '-k', path.join(this.config.database, 'cli-keys', 'client'),
        '-p', path.join(this.config.database, 'cli-keys', 'server.pub'),
        '--cmd', `upload-resume ${bagId}`,
      ], { encoding: 'utf8', timeout: 10000 });
    } catch {
      // Best-effort: bag is created even if resume fails
    }

    return { contentId: bagId };
  }
}

/** Normalize bag id to 64-char hex (DNS content id). Handles base64 from daemon. */
function toContentIdHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed.toLowerCase();
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf.toString('hex');
  } catch {
    // not valid base64
  }
  return null;
}

function extractBagId(output: string): string | null {
  const lines = output.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const torrent = obj.torrent as { hash?: string } | undefined;
      const hashRaw = torrent?.hash ?? (obj.hash as string | undefined) ?? (obj.bag_id as string) ?? (obj.bagId as string) ?? (obj.id as string);
      if (typeof hashRaw === 'string' && hashRaw.length > 0) {
        const hex = toContentIdHex(hashRaw);
        if (hex) return hex;
      }
      const result = obj as { result?: { bag_id?: string; bagId?: string } };
      const id = result.result?.bag_id ?? result.result?.bagId;
      if (typeof id === 'string' && id.length > 0) {
        const hex = toContentIdHex(id);
        if (hex) return hex;
      }
    } catch {
      // not JSON, try next line
    }
  }
  try {
    const obj = JSON.parse(output.trim()) as Record<string, unknown>;
    const torrent = obj.torrent as { hash?: string } | undefined;
    const hashRaw = torrent?.hash ?? (obj.hash as string) ?? (obj.bag_id as string) ?? (obj.bagId as string) ?? (obj.id as string);
    if (typeof hashRaw === 'string' && hashRaw.length > 0) {
      const hex = toContentIdHex(hashRaw);
      if (hex) return hex;
    }
  } catch {
    // ignore
  }
  const hex64 = /[0-9a-fA-F]{64}/.exec(output);
  if (hex64) return hex64[0].toLowerCase();
  return null;
}

