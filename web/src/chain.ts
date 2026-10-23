import { createPublicClient, createWalletClient, custom, defineChain, http, parseAbi, type Address, type Hex } from "viem";

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const EXPLORER = "https://explorer.test.mezo.org";
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;

// VITE_RPC lets a local fork stand in for testnet during development; production uses the Mezo testnet RPC.
export const client = createPublicClient({
  chain: mezoTestnet,
  batch: { multicall: true }, transport: http(import.meta.env.VITE_RPC || undefined, { retryCount: 4, retryDelay: 700, timeout: 15_000 }),
});

export type Deployment = {
  block: number;
  admin: Address;
  musd: Address;
  mezo: Address;
  veBTC: Address;
  morpho: Address;
  oracle: Address;
  gauge: Address;
  vaultSteady: Address;
  vaultBold: Address;
  liquidator?: Address;
};

const ZERO = "0x0000000000000000000000000000000000000000";
/** Markets deployed so far (Bold first; Steady is added after Bold passes the full cycle). */
export const deployedVaults = (d: Deployment) => [d.vaultBold, d.vaultSteady].filter((v) => v && v !== ZERO) as Address[];

export type DemoStep = { label: string; actor: string; tx: Hex; url: string; block: number; time: number };
export type DemoCheck = { check: string; pass: boolean; detail: string; block: number; note?: string };
export type DemoRun = {
  steps: DemoStep[];
  checks?: DemoCheck[];
  veBTCTokenId?: number;
  before?: { senior: string | number; junior: string | number; seniorPrice: string | number };
  after?: { senior: string | number; junior: string | number; seniorPrice: string | number };
  loss?: { tx: string; recognized: string; byJunior: string; bySenior: string };
  loss2?: { tx: string; recognized: string; byJunior: string; bySenior: string; seniorInterestBooked: string };
  forgoneSeniorInterest?: string;
};

export async function loadDeployment(): Promise<{ d: Deployment | null; demo: DemoRun | null }> {
  const get = async (f: string) => {
    try {
      // Data files sit at the site root; the app is served from /app/.
      const r = await fetch(`../${f}`, { cache: "no-store" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  return { d: await get("31611.json"), demo: await get("demo-run.json") };
}

export const vaultAbi = parseAbi([
  "function name() view returns (string)",
  "function previewBooks() view returns (uint256 senior, uint256 junior)",
  "function capacity() view returns (uint256)",
  "function coverageBps() view returns (uint256)",
  "function isUndercovered() view returns (bool)",
  "function seniorSharePrice() view returns (uint256)",
  "function juniorSharePrice() view returns (uint256)",
  "function juniorRound() view returns (uint64)",
  "function totalJuniorShares() view returns (uint256)",
  "function maxLeverage() view returns (uint256)",
  "function premiumBps() view returns (uint256)",
  "function rewardJuniorBps() view returns (uint256)",
  "function cooldown() view returns (uint256)",
  "function withdrawWindow() view returns (uint256)",
  "function marketId() view returns (bytes32)",
  "function irm() view returns (address)",
  "function lltv() view returns (uint256)",
  "function marketParams() view returns ((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv))",
  "function seniorShares(address) view returns (uint256)",
  "function seniorBalanceOf(address) view returns (uint256)",
  "function juniorBalanceOf(address) view returns (uint256)",
  "function juniorSharesOf(address) view returns (uint256)",
  "function withdrawRequests(address) view returns (uint64 round, uint64 readyAt, uint256 shares)",
  "function pendingRewards(address) view returns (uint256)",
  "function depositSenior(uint256 assets) returns (uint256)",
  "function withdrawSenior(uint256 shares) returns (uint256)",
  "function depositJunior(uint256 assets) returns (uint256)",
  "function requestJuniorWithdraw(uint256 shares)",
  "function withdrawJunior() returns (uint256)",
  "function claimRewards() returns (uint256)",
  "function sync()",
  "event LossAbsorbed(uint256 loss, uint256 byJunior, uint256 bySenior, uint256 seniorAssetsAfter, uint256 juniorAssetsAfter)",
  "error ZeroAmount()",
  "error CapacityExceeded(uint256 capacity)",
  "error Undercovered()",
  "error NoRequest()",
  "error RequestVoid()",
  "error NotReady(uint64 readyAt)",
  "error RequestExpired()",
  "error InsufficientShares()",
  "error VotesActive()",
  "event JuniorWiped(uint64 endedRound, uint256 dustCarried)",
]);

export const gaugeAbi = parseAbi([
  "function currentEpoch() view returns (uint256)",
  "function epochEnd(uint256) view returns (uint256)",
  "function epochBudget(uint256) view returns (uint256)",
  "function vaultVotes(address) view returns (uint256)",
  "function weightOf(address) view returns (uint256)",
  "function coverCap(address) view returns (uint256)",
  "function accountVotes(address vault, address account) view returns (uint256)",
  "function tokenVotes(uint256 tokenId, address vault) view returns (uint256)",
  "function lastVotedEpochPlusOne(uint256) view returns (uint256)",
  "function distributed(uint256) view returns (bool)",
  "function fund(uint256 amount)",
  "function distribute(uint256 epoch)",
  "function vote(uint256 tokenId, address[] targets, uint256[] weights)",
  "function reset(uint256 tokenId)",
  "event Distributed(uint256 indexed epoch, address indexed vault, uint256 weight, uint256 amount)",
  "error NotApproved()",
  "error AlreadyVoted()",
  "error BadInput()",
  "error UnknownVault()",
  "error NoCover()",
  "error NoPower()",
  "error EpochNotOver()",
  "error AlreadyDistributed()",
]);

export const morphoAbi = parseAbi([
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)",
  "function withdrawCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver)",
  "function borrow((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function repay((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const irmAbi = parseAbi(["function aprWad() view returns (uint256)"]);
export const oracleAbi = parseAbi(["function price() view returns (uint256)", "function owner() view returns (address)"]);
export const veAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function ownerToNFTokenIdList(address owner, uint256 index) view returns (uint256)",
  "function balanceOfNFT(uint256 tokenId) view returns (uint256)",
]);

export type MarketState = {
  vault: Address;
  name: string;
  senior: bigint;
  junior: bigint;
  capacity: bigint;
  /** Cover shares outstanding in the current round; a co-signer owns juniorShares / totalJuniorShares of the cover. */
  totalJuniorShares: bigint;
  /** Seconds a co-signer has to withdraw after the notice period ends. */
  withdrawWindow: bigint;
  coverageBps: bigint;
  undercovered: boolean;
  seniorPrice: bigint;
  juniorPrice: bigint;
  round: bigint;
  maxLeverage: bigint;
  premiumBps: bigint;
  rewardJuniorBps: bigint;
  cooldown: bigint;
  marketId: Hex;
  lltv: bigint;
  params: { loanToken: Address; collateralToken: Address; oracle: Address; irm: Address; lltv: bigint };
  borrowApr: bigint;
  totalSupply: bigint;
  totalBorrow: bigint;
  totalBorrowShares: bigint;
  votes: bigint;
  weight: bigint;
  coverCap: bigint;
};

/** `waiting`: finished epochs (among the last 12) that were funded and have not been distributed yet. */
export type GaugeState = { epoch: bigint; epochEnd: bigint; budget: bigint; totalWeight: bigint; waiting: { epoch: bigint; budget: bigint }[] };

/** `at` pins every read to one block, so a refresh never mixes pre- and post-transaction state. */
export async function loadMarkets(d: Deployment, at?: bigint): Promise<{ markets: MarketState[]; gauge: GaugeState; price: bigint }> {
  const b = at === undefined ? {} : { blockNumber: at };
  const vaults = deployedVaults(d);
  const fields = [
    "name", "previewBooks", "capacity", "coverageBps", "isUndercovered", "seniorSharePrice", "juniorSharePrice",
    "juniorRound", "maxLeverage", "premiumBps", "rewardJuniorBps", "cooldown", "marketId", "lltv", "marketParams",
    "totalJuniorShares", "withdrawWindow",
  ] as const;
  const vaultReads = vaults.flatMap((v) => fields.map((f) => ({ address: v, abi: vaultAbi, functionName: f }) as const));
  const gaugeReads = vaults.flatMap((v) =>
    (["vaultVotes", "weightOf", "coverCap"] as const).map((f) => ({ address: d.gauge, abi: gaugeAbi, functionName: f, args: [v] }) as const),
  );
  const [vr, gr, epoch, price] = await Promise.all([
    client.multicall({ contracts: vaultReads, allowFailure: false, ...b }),
    client.multicall({ contracts: gaugeReads, allowFailure: false, ...b }),
    client.readContract({ address: d.gauge, abi: gaugeAbi, functionName: "currentEpoch", ...b }),
    client.readContract({ address: d.oracle, abi: oracleAbi, functionName: "price", ...b }),
  ]);
  const past = Array.from({ length: Number(epoch < 12n ? epoch : 12n) }, (_, i) => epoch - 1n - BigInt(i));
  const [epochEnd, budget, ...pastReads] = (await client.multicall({
    contracts: [
      { address: d.gauge, abi: gaugeAbi, functionName: "epochEnd", args: [epoch] } as const,
      { address: d.gauge, abi: gaugeAbi, functionName: "epochBudget", args: [epoch] } as const,
      ...past.flatMap((k) => [
        { address: d.gauge, abi: gaugeAbi, functionName: "epochBudget", args: [k] } as const,
        { address: d.gauge, abi: gaugeAbi, functionName: "distributed", args: [k] } as const,
      ]),
    ] as never, // mixed-ABI batch: the result is cast below
    allowFailure: false,
    ...b,
  })) as unknown as [bigint, bigint, ...(bigint | boolean)[]];
  const waiting = past
    .map((k, i) => ({ epoch: k, budget: pastReads[i * 2] as bigint, done: pastReads[i * 2 + 1] as boolean }))
    .filter((x) => x.budget > 0n && !x.done)
    .map(({ epoch: e, budget: bg }) => ({ epoch: e, budget: bg }))
    .reverse();

  const markets: MarketState[] = vaults.map((vault, i) => {
    const r = vr.slice(i * fields.length, (i + 1) * fields.length) as unknown[];
    const books = r[1] as readonly [bigint, bigint];
    const g = gr.slice(i * 3, i * 3 + 3) as bigint[];
    return {
      vault,
      name: r[0] as string,
      senior: books[0],
      junior: books[1],
      capacity: r[2] as bigint,
      coverageBps: r[3] as bigint,
      undercovered: r[4] as boolean,
      seniorPrice: r[5] as bigint,
      juniorPrice: r[6] as bigint,
      round: r[7] as bigint,
      maxLeverage: r[8] as bigint,
      premiumBps: r[9] as bigint,
      rewardJuniorBps: r[10] as bigint,
      cooldown: r[11] as bigint,
      marketId: r[12] as Hex,
      lltv: r[13] as bigint,
      params: r[14] as MarketState["params"],
      totalJuniorShares: r[15] as bigint,
      withdrawWindow: r[16] as bigint,
      borrowApr: 0n,
      totalSupply: 0n,
      totalBorrow: 0n,
      totalBorrowShares: 0n,
      votes: g[0],
      weight: g[1],
      coverCap: g[2],
    };
  });

  const more = await client.multicall({
    contracts: markets.flatMap((m) => [
      { address: d.morpho, abi: morphoAbi, functionName: "market", args: [m.marketId] } as const,
      { address: m.params.irm, abi: irmAbi, functionName: "aprWad" } as const,
    ]),
    allowFailure: false,
    ...b,
  });
  markets.forEach((m, i) => {
    const mk = more[i * 2] as readonly bigint[];
    m.totalSupply = mk[0];
    m.totalBorrow = mk[2];
    m.totalBorrowShares = mk[3];
    m.borrowApr = more[i * 2 + 1] as bigint;
  });

  const totalWeight = markets.reduce((a, m) => a + m.weight, 0n);
  return { markets, gauge: { epoch, epochEnd, budget, totalWeight, waiting }, price };
}

export type UserState = {
  btc: bigint;
  musd: bigint;
  mezo: bigint;
  perVault: Record<
    Address,
    {
      senior: bigint;
      seniorShares: bigint;
      junior: bigint;
      juniorShares: bigint;
      request: { round: bigint; readyAt: bigint; shares: bigint };
      rewards: bigint;
      votes: bigint;
      collateral: bigint;
      borrowShares: bigint;
    }
  >;
  veTokens: { id: bigint; power: bigint; votedThisEpoch: boolean; votes: Record<Address, bigint> }[];
};

export async function loadUser(d: Deployment, markets: MarketState[], epoch: bigint, user: Address, at?: bigint): Promise<UserState> {
  const b = at === undefined ? {} : { blockNumber: at };
  const [btc, musd, mezo, veCount] = await Promise.all([
    client.getBalance({ address: user, ...b }),
    client.readContract({ address: d.musd, abi: erc20Abi, functionName: "balanceOf", args: [user], ...b }),
    client.readContract({ address: d.mezo, abi: erc20Abi, functionName: "balanceOf", args: [user], ...b }),
    client.readContract({ address: d.veBTC, abi: veAbi, functionName: "balanceOf", args: [user], ...b }),
  ]);
  const perVault: UserState["perVault"] = {};
  const reads = markets.flatMap((m) => [
    { address: m.vault, abi: vaultAbi, functionName: "seniorBalanceOf", args: [user] } as const,
    { address: m.vault, abi: vaultAbi, functionName: "seniorShares", args: [user] } as const,
    { address: m.vault, abi: vaultAbi, functionName: "juniorBalanceOf", args: [user] } as const,
    { address: m.vault, abi: vaultAbi, functionName: "juniorSharesOf", args: [user] } as const,
    { address: m.vault, abi: vaultAbi, functionName: "withdrawRequests", args: [user] } as const,
    { address: m.vault, abi: vaultAbi, functionName: "pendingRewards", args: [user] } as const,
    { address: d.gauge, abi: gaugeAbi, functionName: "accountVotes", args: [m.vault, user] } as const,
    { address: d.morpho, abi: morphoAbi, functionName: "position", args: [m.marketId, user] } as const,
  ]);
  const res = (await client.multicall({ contracts: reads, allowFailure: false, ...b })) as unknown[];
  markets.forEach((m, i) => {
    const r = res.slice(i * 8, i * 8 + 8);
    const req = r[4] as readonly [bigint, bigint, bigint];
    const pos = r[7] as readonly [bigint, bigint, bigint];
    perVault[m.vault] = {
      senior: r[0] as bigint,
      seniorShares: r[1] as bigint,
      junior: r[2] as bigint,
      juniorShares: r[3] as bigint,
      request: { round: req[0], readyAt: req[1], shares: req[2] },
      rewards: r[5] as bigint,
      votes: r[6] as bigint,
      borrowShares: pos[1],
      collateral: pos[2],
    };
  });

  const n = Number(veCount > 20n ? 20n : veCount);
  const ids = n
    ? await client.multicall({
        contracts: Array.from({ length: n }, (_, i) => ({ address: d.veBTC, abi: veAbi, functionName: "ownerToNFTokenIdList", args: [user, BigInt(i)] }) as const),
        allowFailure: false,
        ...b,
      })
    : [];
  const veTokens = await Promise.all(
    (ids as bigint[]).map(async (id) => {
      const calls = [
        { address: d.veBTC, abi: veAbi, functionName: "balanceOfNFT", args: [id] },
        { address: d.gauge, abi: gaugeAbi, functionName: "lastVotedEpochPlusOne", args: [id] },
        ...markets.map((m) => ({ address: d.gauge, abi: gaugeAbi, functionName: "tokenVotes", args: [id, m.vault] })),
      ];
      // Mixed-ABI batch: viem can't infer a heterogeneous spread, every result here is a uint256.
      const [power, last, ...v] = (await client.multicall({ contracts: calls as never, allowFailure: false, ...b })) as bigint[];
      const votes: Record<Address, bigint> = {};
      markets.forEach((m, i) => (votes[m.vault] = v[i]));
      return { id, power, votedThisEpoch: last === epoch + 1n, votes };
    }),
  );
  return { btc, musd, mezo, perVault, veTokens };
}

export type LossEvent = { vault: Address; loss: bigint; byJunior: bigint; bySenior: bigint; tx: Hex; block: bigint };

export async function loadLosses(d: Deployment): Promise<LossEvent[]> {
  const latest = await client.getBlockNumber();
  // Mezo's RPC rejects log queries wider than 10,000 blocks; scan in windows, a few at a time.
  const step = 10_000n;
  const windows: [bigint, bigint][] = [];
  for (let from = BigInt(d.block); from <= latest; from += step) windows.push([from, from + step - 1n > latest ? latest : from + step - 1n]);
  const out: LossEvent[] = [];
  for (let i = 0; i < windows.length; i += 4) {
    const batch = await Promise.all(
      windows.slice(i, i + 4).map(([fromBlock, toBlock]) =>
        client.getContractEvents({ address: deployedVaults(d), abi: vaultAbi, eventName: "LossAbsorbed", fromBlock, toBlock }),
      ),
    );
    for (const l of batch.flat()) {
      const a = l.args as { loss: bigint; byJunior: bigint; bySenior: bigint };
      out.push({ vault: l.address, loss: a.loss, byJunior: a.byJunior, bySenior: a.bySenior, tx: l.transactionHash, block: l.blockNumber });
    }
  }
  return out.reverse();
}

// ----------------------------------------------------------------- wallet

export type Eip1193 = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (e: string, f: (...a: unknown[]) => void) => void;
  removeListener?: (e: string, f: (...a: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

// Every wallet call goes through the provider the user picked, so with several wallets installed the one they
// chose is the one that signs. Without a pick it falls back to the legacy injected provider.
let selected: Eip1193 | undefined;
export function selectProvider(p: Eip1193 | undefined) { selected = p; }
const eth = () => selected ?? window.ethereum;

/** Opens the wallet's own connection prompt. Only an explicit Connect action calls this. */
export async function requestAccount(): Promise<Address> {
  const p = eth();
  if (!p) throw new Error("No browser wallet found. Install Rabby, OKX Wallet or another EVM wallet to continue.");
  const [account] = (await p.request({ method: "eth_requestAccounts" })) as Address[];
  if (!account) throw new Error("The wallet did not share an account.");
  return account;
}

export async function connectWallet(): Promise<Address> {
  const account = await requestAccount();
  await ensureChain();
  return account;
}

/** The account this site is already authorised for, if any. eth_accounts never opens a wallet prompt. */
export async function authorizedAccount(p = eth()): Promise<Address | null> {
  if (!p) return null;
  const [account] = (await p.request({ method: "eth_accounts" })) as Address[];
  return account ?? null;
}

// Set by an explicit Disconnect so a reload does not restore the wallet; cleared by an explicit Connect.
// Only this flag is stored, never an address: a restored connection always comes from the wallet itself.
const DISCONNECTED = "cosign:disconnected";
export function wasDisconnected() {
  try { return localStorage.getItem(DISCONNECTED) === "1"; } catch { return false; }
}
export function setDisconnected(on: boolean) {
  try { if (on) localStorage.setItem(DISCONNECTED, "1"); else localStorage.removeItem(DISCONNECTED); } catch { /* storage blocked: Disconnect lasts for this page only */ }
}

export async function walletChainId(): Promise<number | null> {
  const p = eth();
  if (!p) return null;
  return parseInt((await p.request({ method: "eth_chainId" })) as string, 16);
}

const MEZO_TESTNET_PARAMS = {
  chainId: "0x7b7b",
  chainName: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: ["https://rpc.test.mezo.org"],
  blockExplorerUrls: [EXPLORER],
};

/** Switch the wallet to Mezo testnet, adding it only if the wallet does not know the chain (EIP-3326 code 4902). */
export async function ensureChain() {
  const p = eth()!;
  if ((await walletChainId()) === mezoTestnet.id) return;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MEZO_TESTNET_PARAMS.chainId }] });
  } catch (e) {
    const code = (e as { code?: number; data?: { originalError?: { code?: number } } }).code;
    const inner = (e as { data?: { originalError?: { code?: number } } }).data?.originalError?.code;
    if (code === 4902 || inner === 4902) {
      await p.request({ method: "wallet_addEthereumChain", params: [MEZO_TESTNET_PARAMS] });
    } else if (code === 4001) {
      throw new Error("You declined switching to Mezo testnet. Cosign only works on Mezo testnet.");
    } else {
      throw e;
    }
  }
  if ((await walletChainId()) !== mezoTestnet.id) throw new Error("Your wallet is not on Mezo testnet. Switch networks and try again.");
}

/** Ask the wallet to forget this site (wallet_revokePermissions, where supported); always clears app state. */
export async function disconnectWallet() {
  try {
    await eth()?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
  } catch {
    /* not supported by every wallet; the app still forgets the account */
  }
}

export function walletClient(account: Address) {
  return createWalletClient({ account, chain: mezoTestnet, transport: custom(eth()!) });
}
