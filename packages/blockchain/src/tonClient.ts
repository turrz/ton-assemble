import { Address, Cell, beginCell } from '@ton/core';
import { TonClient4 } from '@ton/ton';

export interface TonClientConfig {
  rpcUrl: string;
  network: 'mainnet';
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

  async runMethod(address: Address, method: string, args?: import('@ton/ton').TupleItem[]) {
    const client = await this.getClient();
    const seqno = await this.getLastSeqno();
    return client.runMethod(seqno, address, method, args);
  }

  static sha256(data: Buffer): Buffer {
    return require('crypto').createHash('sha256').update(data).digest();
  }

  static dnsCategoryHash(name: string): bigint {
    const hash = this.sha256(Buffer.from(name, 'utf-8'));
    return BigInt('0x' + hash.toString('hex'));
  }

  static dnsInternalFromDomain(domain: string): Cell {
    const lower = domain.toLowerCase();
    const parts = lower.split('.');
    if (parts.length < 2 || parts[parts.length - 1] !== 'ton') {
      throw new Error('Only .ton domains are supported');
    }
    const labels = [...parts].reverse();
    const bytes: number[] = [];
    for (const label of labels) {
      for (const ch of Buffer.from(label, 'utf-8')) {
        bytes.push(ch);
      }
      bytes.push(0);
    }
    return beginCell().storeBuffer(Buffer.from(bytes)).endCell();
  }
}

