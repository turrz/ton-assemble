import { Address, Cell, Slice, beginCell } from '@ton/core';
import { TonClientProvider } from '@ton-site-builder/blockchain';
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

export class DomainService {
  private clientProvider: TonClientProvider;

  constructor(config: DomainServiceConfig) {
    this.clientProvider = config.clientProvider;
  }

  async resolveOwner(domain: string): Promise<string> {
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

    const itemAddress = this.parseAddressFromResult(res.result[0]);
    const itemAddrObj = Address.parse(itemAddress);

    const dataRes = await client.runMethod(seqno, itemAddrObj, 'get_nft_data');
    // get_nft_data returns (int, int, slice, slice, cell)
    const ownerSliceItem = dataRes.result[3];
    const ownerAddress = this.parseAddressFromResult(ownerSliceItem);
    return ownerAddress;
  }

  async buildSetSiteRecordTxAdnl(
    domain: string,
    adnlAddressHex: string
  ): Promise<BuildSetSiteRecordTxAdnlResult> {
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

    const itemAddress = this.parseAddressFromResult(res.result[0]);
    const itemAddrObj = Address.parse(itemAddress);

    const categorySite = TonClientProvider.dnsCategoryHash('site');
    const adnlBytes = this.parseAdnlHex(adnlAddressHex);

    // dns_adnl_address#AD01 adnl_addr:bits256 flags:# = DNSRecord
    const dnsRecord = beginCell()
      .storeUint(0xad01, 16)
      .storeBuffer(adnlBytes)
      .storeUint(0, 8) // flags
      .endCell();

    const body = beginCell()
      .storeUint(OP_CHANGE_DNS_RECORD, 32)
      .storeUint(this.randomQueryId(), 64)
      .storeUint(categorySite, 256)
      .storeRef(dnsRecord)
      .endCell();

    const bodyBase64 = body.toBoc().toString('base64');
    const message: TonTransactionMessage = {
      address: itemAddrObj.toString({ bounceable: true }),
      amount: '200000000', // 0.2 TON
      payload: bodyBase64,
    };

    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const tx: TonTransaction = { validUntil, messages: [message] };

    return {
      tx,
      nftAddress: itemAddrObj.toString({ bounceable: true }),
      bodyBase64,
    };
  }

  async buildSetSiteRecordTx(domain: string, contentIdHex: string): Promise<TonTransaction> {
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

    const itemAddress = this.parseAddressFromResult(res.result[0]);
    const itemAddrObj = Address.parse(itemAddress);

    const categorySite = TonClientProvider.dnsCategoryHash('site');
    const bagId = this.parseBagId(contentIdHex);

    const dnsRecord = beginCell()
      .storeUint(0x7473, 16) // dns_storage_address#7473
      .storeBuffer(bagId)
      .endCell();

    const body = beginCell()
      .storeUint(OP_CHANGE_DNS_RECORD, 32)
      .storeUint(this.randomQueryId(), 64)
      .storeUint(categorySite, 256)
      .storeRef(dnsRecord)
      .endCell();

    const message: TonTransactionMessage = {
      address: itemAddrObj.toString({ bounceable: true }),
      amount: '200000000', // 0.2 TON in nanotons, should be enough for gas
      payload: body.toBoc().toString('base64'),
    };

    const validUntil = Math.floor(Date.now() / 1000) + 600;

    return {
      validUntil,
      messages: [message],
    };
  }

  async waitForTx(txHashHex: string, address: string, timeoutMs = 120000): Promise<boolean> {
    const client = await this.clientProvider.getClient();
    const addr = Address.parse(address);
    const deadline = Date.now() + timeoutMs;
    const targetHex = txHashHex.replace(/^0x/, '').toLowerCase();

    while (Date.now() < deadline) {
      const seqno = await this.clientProvider.getLastSeqno();
      const acc = await client.getAccount(seqno, addr);
      const last = acc.account.last;
      if (last) {
        let currentHex: string;
        if (typeof last.hash === 'string') {
          try {
            currentHex = Buffer.from(last.hash, 'base64').toString('hex');
          } catch {
            currentHex = last.hash;
          }
        } else {
          currentHex = '';
        }
        if (currentHex.toLowerCase() === targetHex) {
          return true;
        }
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
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

  private parseAddressFromResult(item: import('@ton/ton').TupleItem): string {
    if (item && (item as any).type === 'slice') {
      const cell = (item as any).cell as Cell;
      const slice = cell.beginParse();
      const addr = slice.loadAddress();
      return (addr as Address).toString({ bounceable: true });
    }
    if (item && (item as any).type === 'cell') {
      const cell = (item as any).cell as Cell;
      const slice = cell.beginParse();
      const addr = slice.loadAddress();
      return (addr as Address).toString({ bounceable: true });
    }
    throw new Error('Unexpected TupleItem type for address');
  }

  private parseBagId(contentIdHex: string): Buffer {
    const clean = contentIdHex.replace(/^0x/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(clean)) {
      throw new Error('contentId must be 32-byte hex string');
    }
    return Buffer.from(clean, 'hex');
  }

  private parseAdnlHex(adnlHex: string): Buffer {
    const clean = adnlHex.replace(/^0x/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(clean)) {
      throw new Error('ADNL address must be 32-byte hex string');
    }
    return Buffer.from(clean, 'hex');
  }

  private randomQueryId(): bigint {
    const buf = Buffer.allocUnsafe(8);
    require('crypto').randomFillSync(buf);
    return BigInt('0x' + buf.toString('hex'));
  }
}

