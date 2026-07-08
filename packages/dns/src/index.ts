import crypto from 'node:crypto';
import { Address, Cell, beginCell } from '@ton/core';
import { TonClientProvider, normalizeTxHash } from '@ton-site-builder/blockchain';
import type { TupleItem } from '@ton/ton';

export interface TonTransactionMessage {
  address: string;
  amount: string;
  payload?: string;
}

export interface TonTransaction {
  validUntil: number;
  messages: TonTransactionMessage[];
}

/** Result of building an ADNL site-record tx (for reverse proxy). Includes link for QR. */
export interface BuildSetSiteRecordTxAdnlResult {
  tx: TonTransaction;
  nftAddress: string;
  bodyBase64: string;
}

export interface DomainServiceConfig {
  clientProvider: TonClientProvider;
}

// .ton DNS collection address on mainnet (official)
const TON_DNS_COLLECTION_ADDRESS = Address.parse(
  'EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz'
);

const OP_CHANGE_DNS_RECORD = 0x4eb1f0f9;
const DNS_TX_AMOUNT_NANOTONS = '200000000'; // 0.2 TON
const DNS_TX_VALID_SECONDS = 600;

type AddressTupleItem = { type: 'slice' | 'cell'; cell: Cell };

export class DomainService {
  private clientProvider: TonClientProvider;

  constructor(config: DomainServiceConfig) {
    this.clientProvider = config.clientProvider;
  }

  async resolveOwner(domain: string): Promise<string> {
    const itemAddrObj = await this.resolveDomainNftAddress(domain);
    const client = await this.clientProvider.getClient();
    const seqno = await this.clientProvider.getLastSeqno();
    const dataRes = await client.runMethod(seqno, itemAddrObj, 'get_nft_data');
    // get_nft_data returns (int, int, slice, slice, cell)
    return this.parseAddressFromResult(dataRes.result[3]);
  }

  async buildSetSiteRecordTxAdnl(
    domain: string,
    adnlAddressHex: string
  ): Promise<BuildSetSiteRecordTxAdnlResult> {
    const itemAddrObj = await this.resolveDomainNftAddress(domain);
    const adnlBytes = this.parseHex32(adnlAddressHex, 'ADNL address');

    // dns_adnl_address#AD01 adnl_addr:bits256 flags:# = DNSRecord
    const dnsRecord = beginCell()
      .storeUint(0xad01, 16)
      .storeBuffer(adnlBytes)
      .storeUint(0, 8)
      .endCell();

    const { message, bodyBase64 } = this.buildDnsChangeMessage(itemAddrObj, dnsRecord);

    return {
      tx: this.wrapTransaction(message),
      nftAddress: itemAddrObj.toString({ bounceable: true }),
      bodyBase64,
    };
  }

  async buildSetSiteRecordTx(domain: string, contentIdHex: string): Promise<TonTransaction> {
    const itemAddrObj = await this.resolveDomainNftAddress(domain);
    const bagId = this.parseHex32(contentIdHex, 'contentId');

    const dnsRecord = beginCell()
      .storeUint(0x7473, 16) // dns_storage_address#7473
      .storeBuffer(bagId)
      .endCell();

    const { message } = this.buildDnsChangeMessage(itemAddrObj, dnsRecord);
    return this.wrapTransaction(message);
  }

  async waitForTx(txHashHex: string, address: string, timeoutMs = 120000): Promise<boolean> {
    const client = await this.clientProvider.getClient();
    const addr = Address.parse(address);
    const deadline = Date.now() + timeoutMs;
    const targetHex = txHashHex.replace(/^0x/, '').toLowerCase();

    while (Date.now() < deadline) {
      const seqno = await this.clientProvider.getLastSeqno();
      const acc = await client.getAccount(seqno, addr);
      const lastHash = acc.account.last?.hash;
      if (typeof lastHash === 'string') {
        const currentHex = normalizeTxHash(lastHash).toLowerCase();
        if (currentHex === targetHex) {
          return true;
        }
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  }

  /** Resolve the on-chain DNS NFT contract for a `.ton` domain label. */
  private async resolveDomainNftAddress(domain: string): Promise<Address> {
    const { label } = this.parseTonDomain(domain);
    const client = await this.clientProvider.getClient();
    const seqno = await this.clientProvider.getLastSeqno();

    const domainCell = beginCell().storeBuffer(Buffer.from(label, 'utf-8')).endCell();
    const labelHash = Cell.fromBoc(domainCell.toBoc())[0].hash();
    const index = BigInt('0x' + labelHash.toString('hex'));

    const res = await client.runMethod(
      seqno,
      TON_DNS_COLLECTION_ADDRESS,
      'get_nft_address_by_index',
      [{ type: 'int', value: index } as TupleItem]
    );

    return Address.parse(this.parseAddressFromResult(res.result[0]));
  }

  private buildDnsChangeMessage(
    nftAddress: Address,
    dnsRecord: Cell
  ): { message: TonTransactionMessage; bodyBase64: string } {
    const categorySite = TonClientProvider.dnsCategoryHash('site');
    const body = beginCell()
      .storeUint(OP_CHANGE_DNS_RECORD, 32)
      .storeUint(this.randomQueryId(), 64)
      .storeUint(categorySite, 256)
      .storeRef(dnsRecord)
      .endCell();
    const bodyBase64 = body.toBoc().toString('base64');

    return {
      bodyBase64,
      message: {
        address: nftAddress.toString({ bounceable: true }),
        amount: DNS_TX_AMOUNT_NANOTONS,
        payload: bodyBase64,
      },
    };
  }

  private wrapTransaction(message: TonTransactionMessage): TonTransaction {
    return {
      validUntil: Math.floor(Date.now() / 1000) + DNS_TX_VALID_SECONDS,
      messages: [message],
    };
  }

  private parseTonDomain(domain: string): { label: string } {
    const lower = domain.trim().toLowerCase();
    if (!lower.endsWith('.ton')) {
      throw new Error('Only .ton domains are supported');
    }
    const label = lower.slice(0, -4);
    if (!/^[a-z0-9-]{4,126}$/.test(label)) {
      throw new Error('Invalid .ton domain label');
    }
    return { label };
  }

  private parseAddressFromResult(item: TupleItem): string {
    const cell = getAddressTupleCell(item);
    if (!cell) {
      throw new Error('Unexpected TupleItem type for address');
    }
    return cell.beginParse().loadAddress().toString({ bounceable: true });
  }

  private parseHex32(value: string, fieldName: string): Buffer {
    const clean = value.replace(/^0x/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(clean)) {
      throw new Error(`${fieldName} must be 32-byte hex string`);
    }
    return Buffer.from(clean, 'hex');
  }

  private randomQueryId(): bigint {
    const buf = Buffer.allocUnsafe(8);
    crypto.randomFillSync(buf);
    return BigInt('0x' + buf.toString('hex'));
  }
}

function getAddressTupleCell(item: TupleItem): Cell | null {
  if (!item || typeof item !== 'object' || !('type' in item) || !('cell' in item)) {
    return null;
  }
  const typed = item as AddressTupleItem;
  if (typed.type === 'slice' || typed.type === 'cell') {
    return typed.cell;
  }
  return null;
}
