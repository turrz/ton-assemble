import crypto from 'node:crypto';
import { Address, Cell, beginCell } from '@ton/core';
import { TonClient4 } from '@ton/ton';

export interface TonClientConfig {
  rpcUrl: string;
  network: 'mainnet';
}

/** Normalize an account last-tx hash from base64 (TON API) to hex when possible. */
export function normalizeTxHash(hash: string): string {
  try {
    return Buffer.from(hash, 'base64').toString('hex');
  } catch {
    return hash;
  }
}

export class TonClientProvider {
  private clientPromise: Promise<TonClient4> | null = null;

  constructor(private readonly config: TonClientConfig) {
    if (config.network !== 'mainnet') {
      throw new Error('Only mainnet network is supported');
    }
    if (!config.rpcUrl || config.rpcUrl.trim().length === 0) {
      throw new Error('TON RPC URL is required for mainnet');
    }
  }

  async getClient(): Promise<TonClient4> {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }
    return this.clientPromise;
  }

  private async createClient(): Promise<TonClient4> {
    const endpoint = this.config.rpcUrl.trim();
    return new TonClient4({ endpoint, timeout: 20000 });
  }

  async getLastSeqno(): Promise<number> {
    const client = await this.getClient();
    const last = await client.getLastBlock();
    return last.last.seqno;
  }

  async getAccountState(address: Address) {
    const client = await this.getClient();
    const seqno = await this.getLastSeqno();
    return client.getAccount(seqno, address);
  }

  static sha256(data: Buffer): Buffer {
    return crypto.createHash('sha256').update(data).digest();
  }

  static dnsCategoryHash(name: string): bigint {
    const hash = this.sha256(Buffer.from(name, 'utf-8'));
    return BigInt('0x' + hash.toString('hex'));
  }
}
