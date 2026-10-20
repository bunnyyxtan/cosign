import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import {
  addrUrl, client, connectWallet, disconnectWallet, ensureChain, erc20Abi, gaugeAbi, loadDeployment, loadLosses, loadMarkets,
  loadUser, mezoTestnet, morphoAbi, txUrl, vaultAbi, walletChainId, walletClient,
  type DemoRun, type Deployment, type GaugeState, type LossEvent, type MarketState, type UserState,
} from "./chain";
import { Waterfall } from "./Waterfall";
import { Explore } from "./Explore";

/** Poll for a receipt for up to 3 minutes; Mezo's load-balanced RPC can briefly miss a mined tx. */
async function waitReceipt(hash: Hex) {
  for (let i = 0; i < 90; i++) {
    try {
      return await client.getTransactionReceipt({ hash });
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("No receipt after 3 minutes. Check the transaction in the explorer.");
}

/** Plain-language reasons for the reverts a user can hit. Unknown errors fall back to the wallet's message. */
const REASONS: Record<string, string> = {
  CapacityExceeded: "There isn't that much room to lend. Room opens as co-signers add cover.",
  Undercovered: "That withdrawal would leave lenders with less than the minimum cover.",
  NotReady: "Your withdrawal notice period has not ended yet.",
  RequestExpired: "Your withdrawal window closed. Request again.",
  RequestVoid: "Your request was cancelled because this market's cover was wiped out.",
  NoRequest: "Request a withdrawal first.",
  InsufficientShares: "You don't hold that much here.",
  VotesActive: "Remove your votes on this market before withdrawing all of your cover.",
  NoCover: "Post cover on a market before voting for it.",
  AlreadyVoted: "This veBTC position already voted this epoch.",
  NotApproved: "This wallet doesn't own that veBTC position.",
  NoPower: "This veBTC position has no voting power.",
  ZeroAmount: "Enter a larger amount.",
};

function explain(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; code?: number; cause?: { code?: number; data?: { errorName?: string } } };
  const text = err.shortMessage ?? err.message ?? "Something went wrong";
  if (err.code === 4001 || err.cause?.code === 4001 || /user rejected|denied/i.test(err.message ?? "")) return "You rejected the request in your wallet.";
  const name = err.cause?.data?.errorName ?? Object.keys(REASONS).find((k) => text.includes(k));
  if (name && REASONS[name]) return REASONS[name];
  if (/insufficient collateral/i.test(err.message ?? "")) return "That would leave your loan under-collateralised. Repay first, or ask for less.";
  if (/insufficient liquidity/i.test(err.message ?? "")) return "Not enough unborrowed MUSD in this market right now. Try a smaller amount.";
  return text.split(/\r?\n/)[0];
}

type Route = { page: "explore" } | { page: "markets" } | { page: "cosign" } | { page: "market"; vault: Address };
type Toast = { kind: "pending" | "ok" | "error"; text: string; tx?: Hex };

const WAD = 10n ** 18n;
export const fmt = (v: bigint, dp = 2) =>
  Number(formatUnits(v, 18)).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (bps: bigint | number, dp = 1) => `${(Number(bps) / 100).toFixed(dp)}%`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("market/")) return { page: "market", vault: h.slice(7) as Address };
  if (h === "cosign") return { page: "cosign" };
  if (h === "markets") return { page: "markets" };
  return { page: "explore" };
}

/** APRs from live chain state. Lender base = borrow APR x utilisation (Morpho fee is 0). */
function aprs(m: MarketState) {
  const util = m.totalSupply === 0n ? 0 : Number(m.totalBorrow) / Number(m.totalSupply);
  const base = (Number(m.borrowApr) / 1e18) * util;
  const prem = Number(m.premiumBps) / 10_000;
  const s = Number(m.senior), j = Number(m.junior);
  return {
    util,
    borrow: Number(m.borrowApr) / 1e18,
    senior: base * (1 - prem),
    junior: j > 0 ? base * (1 + (prem * s) / j) : 0,
  };
}
const apr = (x: number) => `${(x * 100).toFixed(2)}%`;

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [d, setD] = useState<Deployment | null | undefined>(undefined);
  const [demo, setDemo] = useState<DemoRun | null>(null);
  const [markets, setMarkets] = useState<MarketState[]>([]);
  const [gauge, setGauge] = useState<GaugeState | null>(null);
  const [price, setPrice] = useState(0n);
  const [losses, setLosses] = useState<LossEvent[]>([]);
  const [account, setAccount] = useState<Address | null>(null);
  const [user, setUser] = useState<UserState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    const f = () => setRoute(parseRoute());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  useEffect(() => {
    loadDeployment().then(({ d, demo }) => {
      setD(d);
      setDemo(demo);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!d) return;
    try {
      const r = await loadMarkets(d);
      setMarkets(r.markets);
      setGauge(r.gauge);
      setPrice(r.price);
      setLoadError(null);
      if (account) setUser(await loadUser(d, r.markets, r.gauge.epoch, account));
    } catch (e) {
      setLoadError(`Could not read Mezo testnet: ${(e as Error).message.split("\n")[0]}`);
    }
  }, [d, account]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (d) loadLosses(d).then(setLosses).catch(() => setLosses([]));
  }, [d]);

  useEffect(() => {
    // Dev-only: ?devconnect connects the local test wallet on load (used for headless screenshots).
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("devconnect")) connectWallet().then(setAccount).catch(() => {});
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    walletChainId().then(setChainId).catch(() => {});
    const onAccounts = (a: unknown) => {
      setUser(null); // never show the previous account's positions
      setAccount(((a as Address[])[0] ?? null) as Address | null);
    };
    const onChain = (id: unknown) => setChainId(parseInt(id as string, 16));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = async () => {
    try {
      setAccount(await connectWallet());
      setChainId(await walletChainId());
    } catch (e) {
      setToast({ kind: "error", text: explain(e) });
    }
  };

  const disconnect = async () => {
    await disconnectWallet();
    setAccount(null);
    setUser(null);
  };

  const switchNetwork = async () => {
    try {
      await ensureChain();
      setChainId(await walletChainId());
    } catch (e) {
      setToast({ kind: "error", text: explain(e) });
    }
  };

  /** Send a transaction, wait for it, and surface the explorer link. */
  const send = useCallback(
    async (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>) => {
      if (!account) return false;
      try {
        await ensureChain();
        setToast({ kind: "pending", text: `${label}: confirm in your wallet` });
        const hash = await write(walletClient(account));
        setToast({ kind: "pending", text: `${label}: waiting for Mezo testnet`, tx: hash });
        const r = await waitReceipt(hash);
        if (r.status !== "success") {
          setToast({ kind: "error", text: `${label}: the transaction was mined but reverted. Nothing changed.`, tx: hash });
          return false;
        }
        setToast({ kind: "ok", text: `${label}: done`, tx: hash });
        // The load-balanced RPC can trail the receipt: wait until it has the tx's block, then read (and read once more).
        for (let i = 0; i < 15 && (await client.getBlockNumber().catch(() => 0n)) < r.blockNumber + 1n; i++) {
          await new Promise((res) => setTimeout(res, 1500));
        }
        await refresh();
        setTimeout(refresh, 5000);
        if (d) loadLosses(d).then(setLosses);
        return true;
      } catch (e) {
        setToast({ kind: "error", text: `${label}: ${explain(e)}` });
        return false;
      }
    },
    [account, refresh, d],
  );

  /** Approve `spender` for `amount` of `token` if the current allowance is short. */
  const approveIfNeeded = useCallback(
    async (token: Address, spender: Address, amount: bigint, label: string) => {
      if (!account) return false;
      const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender] });
      if (allowance >= amount) return true;
      const ok = await send(`Approve ${label}`, (w) => w.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }));
      if (!ok) return false;
      // Wallets let users edit the spending cap; check what was actually approved.
      const now = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender] });
      if (now < amount) {
        setToast({ kind: "error", text: `Approve ${label}: the approved amount is lower than ${fmt(amount)}. Approve at least that much.` });
        return false;
      }
      return true;
    },
    [account, send],
  );

  const ctx = { d: d!, markets, gauge, price, user, account, send, approveIfNeeded, connect, losses, demo };

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/">
          <span className="mark" aria-hidden>
            <i className="m-j" />
            <i className="m-s" />
          </span>
          Cosign
        </a>
        <nav>
          <a href="#/" aria-current={route.page === "explore" ? "page" : undefined}>Explore demo</a>
          <a href="#/markets" aria-current={route.page === "markets" || route.page === "market" ? "page" : undefined}>Markets</a>
          <a href="#/cosign" aria-current={route.page === "cosign" ? "page" : undefined}>Co-sign</a>
        </nav>
        <div className="net">
          <span className="badge">Mezo testnet</span>
          {account ? (
            <>
              <span className="acct">{short(account)}</span>
              <button className="link" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button onClick={connect}>Connect wallet</button>
          )}
        </div>
      </header>

      {account && chainId !== null && chainId !== mezoTestnet.id && (
        <div className="toast error" role="alert">
          <span>Your wallet is on another network. Cosign runs on Mezo testnet.</span>
          <button className="secondary" onClick={switchNetwork}>Switch to Mezo testnet</button>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          <span>{toast.text}</span>
          {toast.tx && <a href={txUrl(toast.tx)} target="_blank" rel="noreferrer">View transaction</a>}
          {toast.kind !== "pending" && <button className="link" onClick={() => setToast(null)} aria-label="Dismiss">Dismiss</button>}
        </div>
      )}

      <main>
        {d === undefined && <p className="muted">Loading deployment…</p>}
        {d === null && (
          <section className="empty">
            <h1>Not deployed yet</h1>
            <p>The Cosign contracts have not been deployed to Mezo testnet from this build. Run the deploy script, then reload.</p>
          </section>
        )}
        {loadError && <p className="error-line">{loadError}</p>}
        {d && route.page !== "explore" && markets.length === 0 && !loadError && (
          <p className="muted" role="status">Reading the markets from Mezo testnet…</p>
        )}
        {d && route.page === "explore" && <Explore d={d} demo={demo} markets={markets} />}
        {d && markets.length > 0 && route.page === "markets" && <Markets {...ctx} />}
        {d && markets.length > 0 && route.page === "cosign" && <Cosign {...ctx} />}
        {d && markets.length > 0 && route.page === "market" && <MarketDetail {...ctx} vault={route.vault} />}
      </main>

      <footer>
        <p>
          <strong>Unaudited prototype on Mezo testnet.</strong> Cover is first-loss capital, not a guarantee: lenders lose money
          if losses exceed it. MEZO rewards are funded by the Cosign team, not by Mezo protocol emissions. The MEZO price comes
          from a labelled demo oracle that the Cosign team controls.
        </p>
        {d && (
          <p className="addrs">
            Contracts: <a href={addrUrl(d.morpho)} target="_blank" rel="noreferrer">Morpho Blue</a>,{" "}
            <a href={addrUrl(d.vaultBold)} target="_blank" rel="noreferrer">Bold vault</a>,{" "}
            {d.vaultSteady !== "0x0000000000000000000000000000000000000000" && (
              <><a href={addrUrl(d.vaultSteady)} target="_blank" rel="noreferrer">Steady vault</a>,{" "}</>
            )}
            {d.liquidator && <><a href={addrUrl(d.liquidator)} target="_blank" rel="noreferrer">liquidator</a>,{" "}</>}
            <a href={addrUrl(d.gauge)} target="_blank" rel="noreferrer">gauge</a>,{" "}
            <a href={addrUrl(d.oracle)} target="_blank" rel="noreferrer">demo oracle</a>,{" "}
            <a href={addrUrl(d.veBTC)} target="_blank" rel="noreferrer">Mezo veBTC</a>
          </p>
        )}
      </footer>
    </div>
  );
}

type Ctx = {
  d: Deployment;
  markets: MarketState[];
  gauge: GaugeState | null;
  price: bigint;
  user: UserState | null;
  account: Address | null;
  send: (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>) => Promise<boolean>;
  approveIfNeeded: (token: Address, spender: Address, amount: bigint, label: string) => Promise<boolean>;
  connect: () => void;
  losses: LossEvent[];
  demo: DemoRun | null;
};

// ================================================================ Markets

function Markets({ markets, gauge, price, losses }: Ctx) {
  const scale = markets.reduce((a, m) => (m.senior + m.junior + m.capacity > a ? m.senior + m.junior + m.capacity : a), 1n);
  return (
    <>
      <section className="hero">
        <h1>Co-signers put money in front of lenders.</h1>
        <p className="lede">
          Bitcoin holders post MUSD as cover on a lending market. A market can only take lender deposits up to a fixed
          multiple of its cover. Co-signers earn a cut of the interest and MEZO rewards. If a loan goes bad, the loss
          comes out of their cover first; lenders are only hit by the part that is larger than the cover.
        </p>
        <Legend />
      </section>

      <section className="market-list" aria-label="Markets">
        {markets.map((m) => {
          const a = aprs(m);
          const share = gauge && gauge.totalWeight > 0n ? Number((m.weight * 10_000n) / gauge.totalWeight) : 0;
          const loss = losses.find((l) => l.vault.toLowerCase() === m.vault.toLowerCase());
          return (
            <article className="market-row" key={m.vault}>
              <div className="row-head">
                <h2><a href={`#/market/${m.vault}`}>{m.name}</a></h2>
                <p className="muted">
                  MUSD loans against MEZO up to {pct((m.lltv * 10_000n) / WAD, 1)} loan-to-value. Cover must stay above{" "}
                  {pct(10_000n / (m.maxLeverage + 1n), 0)} of the vault.
                </p>
              </div>
              <Waterfall senior={m.senior} junior={m.junior} scale={scale} capacity={m.capacity} />
              <dl className="figures">
                <Fig k="Cover absorbs the first" v={`${fmt(m.junior, 0)} MUSD`} sub={`of losses (${pct(m.coverageBps)} of the vault)`} strong />
                <Fig k="Room to lend" v={`${fmt(m.capacity, 0)} MUSD`} />
                <Fig k="Lender APR" v={apr(a.senior)} sub={`${(a.util * 100).toFixed(0)}% borrowed`} />
                <Fig k="Co-signer APR" v={apr(a.junior)} sub="before MEZO" />
                <Fig k="Borrow APR" v={apr(a.borrow)} sub="fixed" />
                <Fig k="MEZO rewards" v={`${share / 100}%`} sub={gauge ? `of ${fmt(gauge.budget, 0)} this epoch` : ""} />
              </dl>
              <div className="row-foot">
                {m.undercovered && <span className="warn">Under-covered: no new lender deposits, no cover withdrawals</span>}
                {loss && (
                  <span className="muted">
                    Last loss {fmt(loss.loss)} MUSD: cover paid {fmt(loss.byJunior)}, lenders paid {fmt(loss.bySenior)}.
                  </span>
                )}
                <a className="btn" href={`#/market/${m.vault}`}>Open market</a>
              </div>
            </article>
          );
        })}
      </section>
      <p className="muted small">MEZO demo price: {fmt(price / WAD, 4)} MUSD (demo oracle, not a market price).</p>
    </>
  );
}

function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      <li><i className="sw j" /> Cover from co-signers. Pays first.</li>
      <li><i className="sw s" /> Lender deposits. Paid after cover is gone.</li>
      <li><i className="sw c" /> Room to lend. Opens as cover grows.</li>
    </ul>
  );
}

function Fig({ k, v, sub, strong }: { k: string; v: string; sub?: string; strong?: boolean }) {
  return (
    <div className={strong ? "fig strong" : "fig"}>
      <dt>{k}</dt>
      <dd>
        {v}
        {sub && <small> {sub}</small>}
      </dd>
    </div>
  );
}

// =========================================================== Market detail

function MarketDetail(ctx: Ctx & { vault: Address }) {
  const { markets, vault, losses, demo } = ctx;
  const m = markets.find((x) => x.vault.toLowerCase() === vault.toLowerCase());
  const myLosses = losses.filter((l) => l.vault.toLowerCase() === vault.toLowerCase());
  const [replay, setReplay] = useState<LossEvent | null>(null);
  if (!m) return <p className="muted">Unknown market. <a href="#/markets">Back to markets</a></p>;
  const a = aprs(m);

  return (
    <>
      <p className="crumb"><a href="#/markets">Markets</a> / {m.name}</p>
      <section className="detail-head">
        <h1>{m.name}</h1>
        <p className="lede">
          Lenders' MUSD is lent on <a href={addrUrl(ctx.d.morpho)} target="_blank" rel="noreferrer">Morpho Blue</a> against MEZO
          collateral. Co-signers' cover sits in front of it.
        </p>
      </section>

      <section className="big-bar">
        {replay ? (
          <LossReplay ev={replay} onDone={() => setReplay(null)} />
        ) : (
          <Waterfall senior={m.senior} junior={m.junior} scale={m.senior + m.junior + m.capacity} capacity={m.capacity} large />
        )}
        <dl className="figures">
          <Fig k="Cover absorbs the first" v={`${fmt(m.junior, 0)} MUSD`} sub={`of losses (${pct(m.coverageBps)} of the vault)`} strong />
          <Fig k="Cover" v={`${fmt(m.junior)} MUSD`} />
          <Fig k="Lender deposits" v={`${fmt(m.senior)} MUSD`} />
          <Fig k="Lender share value" v={fmt(m.seniorPrice, 9)} sub="MUSD per starting MUSD" />
          <Fig k="Lender APR" v={apr(a.senior)} />
          <Fig k="Co-signer APR" v={apr(a.junior)} />
        </dl>
        <p className="muted small">
          Room to lend ({fmt(m.capacity, 0)} MUSD) limits deposits into this Cosign vault. It is not a cap on borrowing in the
          underlying Morpho market, which anyone can also supply to directly, without cover.
        </p>
        {m.undercovered && (
          <p className="warn">
            Under-covered after a loss: new lender deposits and cover withdrawals are paused until cover is added. Borrowing
            on Morpho is not paused.
          </p>
        )}
        {m.round > 0n && <p className="muted">Cover was wiped {m.round.toString()} time(s) and then recapitalised. Old cover shares were retired.</p>}
      </section>

      <section className="guarantee" aria-labelledby="g-title">
        <h2 id="g-title">What cover does and does not guarantee</h2>
        <div className="g-cols">
          <div>
            <h3>The contracts enforce</h3>
            <ul>
              <li>A loss is taken from cover first. Lenders are charged only for the part of a loss larger than the cover in front of them.</li>
              <li>A lender's balance as of the vault's last update is not reduced until losses since then exceed that cover.</li>
              <li>Every recognised loss is split between cover and lenders with nothing created or lost (see the LossAbsorbed events below).</li>
            </ul>
          </div>
          <div>
            <h3>They do not guarantee</h3>
            <ul>
              <li>Interest earned since the vault's last update. If a liquidation skips Cosign's liquidator, that interest can absorb part of the loss first; it moves to co-signers.</li>
              <li>Protection beyond the cover. If a loss is larger, lenders still in the vault share the rest; lenders who withdrew before the liquidation are not charged.</li>
              <li>That cover stays. A co-signer whose withdrawal notice has ended can leave before a loss is booked.</li>
              <li>A borrowing limit. Cosign caps deposits into this vault, not borrowing in the Morpho market. The MEZO price comes from a demo oracle the Cosign team controls.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="cols">
        <LendPanel {...ctx} m={m} />
        <BorrowPanel {...ctx} m={m} />
      </div>

      <section className="history">
        <h2>Losses on this market</h2>
        {myLosses.length === 0 ? (
          <p className="muted">No losses yet. When a Morpho liquidation leaves bad debt, it appears here with the transaction that charged it.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Loss</th><th>Paid by cover</th><th>Paid by lenders</th><th>Proof</th><th /></tr>
            </thead>
            <tbody>
              {myLosses.map((l) => (
                <tr key={l.tx}>
                  <td>{fmt(l.loss)} MUSD</td>
                  <td className="j-text">{fmt(l.byJunior)}</td>
                  <td>{fmt(l.bySenior)}</td>
                  <td><a href={txUrl(l.tx)} target="_blank" rel="noreferrer">Block {l.block.toString()}</a></td>
                  <td><button className="link" onClick={() => setReplay(l)}>Replay</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {demo && demo.steps.length > 0 && <DemoSteps demo={demo} />}
    </>
  );
}

function LossReplay({ ev, onDone }: { ev: LossEvent; onDone: () => void }) {
  const [after, setAfter] = useState<{ s: bigint; j: bigint } | null>(null);
  const [phase, setPhase] = useState<"before" | "after">("before");
  useEffect(() => {
    // The event carries the books after the loss; before = after + what each tranche paid.
    client
      .getContractEvents({ address: ev.vault, abi: vaultAbi, eventName: "LossAbsorbed", fromBlock: ev.block, toBlock: ev.block })
      .then((logs) => {
        const l = logs.find((x) => x.transactionHash === ev.tx);
        const a = l?.args as { seniorAssetsAfter: bigint; juniorAssetsAfter: bigint } | undefined;
        if (a) setAfter({ s: a.seniorAssetsAfter, j: a.juniorAssetsAfter });
      });
  }, [ev]);
  useEffect(() => {
    if (!after) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("after"), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [after]);
  if (!after) return <p className="muted">Reading the loss from Mezo testnet…</p>;
  const before = { s: after.s + ev.bySenior, j: after.j + ev.byJunior };
  const cur = phase === "before" ? before : after;
  const scale = before.s + before.j;
  return (
    <div className="replay">
      <Waterfall senior={cur.s} junior={cur.j} scale={scale} lost={phase === "after" ? ev.byJunior : 0n} lostSenior={phase === "after" ? ev.bySenior : 0n} large />
      <p className="replay-note">
        {phase === "before" ? "Before the liquidation." : (
          <>
            Loss of <strong>{fmt(ev.loss)} MUSD</strong>: cover paid <strong className="j-text">{fmt(ev.byJunior)}</strong>, lenders paid{" "}
            <strong>{fmt(ev.bySenior)}</strong>. <a href={txUrl(ev.tx)} target="_blank" rel="noreferrer">See the transaction</a>.
          </>
        )}{" "}
        <button className="link" onClick={onDone}>Back to live view</button>
      </p>
    </div>
  );
}

function DemoSteps({ demo }: { demo: DemoRun }) {
  return (
    <section className="history">
      <h2>Recorded demo run</h2>
      <p className="muted">
        Every step of the signature demo, as it happened on Mezo testnet. Each link opens the transaction in the Mezo explorer.
      </p>
      <ol className="steps">
        {demo.steps.map((s) => (
          <li key={s.tx} className={s.label.startsWith("DEMO ORACLE") ? "oracle" : undefined}>
            <span>{s.label}</span>
            <span className="muted">{s.actor}</span>
            <a href={s.url} target="_blank" rel="noreferrer">{s.tx.slice(0, 10)}…</a>
          </li>
        ))}
      </ol>
      {demo.checks && demo.checks.length > 0 && (
        <>
          <h2 className="sub">Checks recorded during the run</h2>
          <p className="muted">Each check read live contract state at the block shown. Failures are kept, with what we changed.</p>
          <ul className="checks">
            {demo.checks.map((c, i) => (
              <li key={i} className={c.pass ? "pass" : "fail"}>
                <span className="mark-pf">{c.pass ? "Pass" : "Fail"}</span>
                <span><strong>{c.check}</strong> <span className="muted">{c.detail}</span>{c.note && <em className="note"> {c.note}</em>}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Amount({ value, onChange, max, unit, id }: { value: string; onChange: (v: string) => void; max?: bigint; unit: string; id: string }) {
  return (
    <div className="amount">
      <input id={id} inputMode="decimal" placeholder="0.0" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
      <span>{unit}</span>
      {max !== undefined && <button type="button" className="link" onClick={() => onChange(formatUnits(max, 18))}>Max</button>}
    </div>
  );
}

const toWei = (s: string) => {
  try {
    return s ? parseUnits(s, 18) : 0n;
  } catch {
    return 0n;
  }
};

function LendPanel({ m, user, account, send, approveIfNeeded, connect, d }: Ctx & { m: MarketState }) {
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const me = user?.perVault[m.vault];
  const depWei = toWei(dep);
  const tooMuch = depWei > m.capacity;
  return (
    <section className="panel">
      <h2>Lend MUSD</h2>
      <p className="muted">
        {fmt(m.junior)} MUSD of cover sits in front of lenders. A loss comes out of cover first; lenders lose money only
        when a loss is larger than the cover.
      </p>
      {!account ? <button onClick={connect}>Connect wallet to lend</button> : (
        <>
          <label htmlFor="lend">Deposit</label>
          <Amount id="lend" value={dep} onChange={setDep} unit="MUSD" max={user && user.musd < m.capacity ? user.musd : m.capacity} />
          {tooMuch && <p className="warn">Only {fmt(m.capacity)} MUSD of room right now. More cover opens more room.</p>}
          <button
            disabled={depWei === 0n || tooMuch}
            onClick={async () => {
              if (!(await approveIfNeeded(d.musd, m.vault, depWei, "MUSD"))) return;
              if (await send("Deposit MUSD", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "depositSenior", args: [depWei] }))) setDep("");
            }}
          >Deposit</button>
          <p className="held">{user ? `You have ${fmt(me?.senior ?? 0n)} MUSD here. Wallet: ${fmt(user.musd)} MUSD.` : "Loading your position…"}</p>
          {me && me.seniorShares > 0n && (
            <>
              <label htmlFor="wd">Withdraw</label>
              <Amount id="wd" value={wd} onChange={setWd} unit="MUSD" max={me.senior} />
              <button
                className="secondary"
                disabled={toWei(wd) === 0n}
                onClick={async () => {
                  const w = toWei(wd);
                  const shares = w >= me.senior ? me.seniorShares : (me.seniorShares * w) / me.senior;
                  if (await send("Withdraw MUSD", (wc) => wc.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawSenior", args: [shares] }))) setWd("");
                }}
              >Withdraw</button>
              <p className="muted small">Lenders can leave any time the market has unborrowed MUSD.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function BorrowPanel({ m, user, account, send, approveIfNeeded, connect, d, price }: Ctx & { m: MarketState }) {
  const [coll, setColl] = useState("");
  const [amt, setAmt] = useState("");
  const [rep, setRep] = useState("");
  const [out, setOut] = useState("");
  const me = user?.perVault[m.vault];
  const debt = me && m.totalBorrow > 0n ? estimateDebt(me.borrowShares, m) : 0n;
  const collValue = me ? (me.collateral * price) / 10n ** 36n : 0n;
  const maxBorrow = (collValue * m.lltv) / WAD;
  const ltv = collValue > 0n ? Number((debt * 10_000n) / collValue) / 100 : 0;
  return (
    <section className="panel">
      <h2>Borrow MUSD</h2>
      <p className="muted">Post MEZO, borrow MUSD at a fixed {apr(Number(m.borrowApr) / 1e18)}. Above {pct((m.lltv * 10_000n) / WAD, 1)} loan-to-value you can be liquidated.</p>
      {!account ? <button onClick={connect}>Connect wallet to borrow</button> : (
        <>
          <label htmlFor="coll">Add MEZO collateral</label>
          <Amount id="coll" value={coll} onChange={setColl} unit="MEZO" max={user?.mezo} />
          <button
            className="secondary"
            disabled={toWei(coll) === 0n}
            onClick={async () => {
              const c = toWei(coll);
              if (!(await approveIfNeeded(d.mezo, d.morpho, c, "MEZO"))) return;
              if (await send("Add collateral", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "supplyCollateral", args: [m.params, c, account, "0x"] }))) setColl("");
            }}
          >Add collateral</button>
          <label htmlFor="borrow">Borrow</label>
          <Amount id="borrow" value={amt} onChange={setAmt} unit="MUSD" />
          <button
            disabled={toWei(amt) === 0n}
            onClick={async () => {
              if (await send("Borrow MUSD", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "borrow", args: [m.params, toWei(amt), 0n, account, account] }))) setAmt("");
            }}
          >Borrow</button>
          <p className="held">
            Collateral {fmt(me?.collateral ?? 0n)} MEZO, debt {fmt(debt)} MUSD{collValue > 0n ? `, ${ltv.toFixed(1)}% LTV, up to ${fmt(maxBorrow)} MUSD` : ""}.
          </p>
          {debt > 0n && (
            <>
              <label htmlFor="repay">Repay</label>
              <Amount id="repay" value={rep} onChange={setRep} unit="MUSD" max={debt} />
              <button
                className="secondary"
                disabled={toWei(rep) === 0n}
                onClick={async () => {
                  const r = toWei(rep);
                  const full = r >= debt;
                  if (!(await approveIfNeeded(d.musd, d.morpho, full ? debt + debt / 1000n + 1n : r, "MUSD"))) return;
                  const args = full ? ([m.params, 0n, me!.borrowShares, account, "0x"] as const) : ([m.params, r, 0n, account, "0x"] as const);
                  if (await send("Repay MUSD", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "repay", args }))) setRep("");
                }}
              >Repay</button>
            </>
          )}
          {me && me.collateral > 0n && (
            <>
              <label htmlFor="wcoll">Withdraw collateral</label>
              <Amount id="wcoll" value={out} onChange={setOut} unit="MEZO" max={debt === 0n ? me.collateral : undefined} />
              {debt > 0n && <p className="muted small">While you have debt, you can only take out collateral that is not backing it.</p>}
              <button
                className="secondary"
                disabled={toWei(out) === 0n}
                onClick={async () => {
                  if (await send("Withdraw collateral", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "withdrawCollateral", args: [m.params, toWei(out), account, account] }))) setOut("");
                }}
              >Withdraw collateral</button>
            </>
          )}
        </>
      )}
    </section>
  );
}

function estimateDebt(borrowShares: bigint, m: MarketState) {
  // Morpho borrow shares -> assets, rounding up (virtual shares 1e6, virtual assets 1).
  return borrowShares === 0n ? 0n : (borrowShares * (m.totalBorrow + 1n)) / (m.totalBorrowShares + 1_000_000n) + 1n;
}

// ================================================================= Co-sign

function Cosign(ctx: Ctx) {
  const { user, account, connect, markets, gauge, send, d } = ctx;
  if (!account) {
    return (
      <section className="hero">
        <h1>Co-sign a market.</h1>
        <p className="lede">
          Co-signers are veBTC holders who post MUSD cover on a market and vote MEZO rewards toward it. Your cover opens room
          for lenders and earns a premium on their interest. It is also the first money lost when a loan goes bad.
        </p>
        <p className="muted">
          To co-sign you need a wallet on Mezo testnet with some MUSD and a veBTC lock. This is a test network with a test
          oracle; nothing here has value.
        </p>
        <p className="actions">
          <button onClick={connect}>Connect wallet</button>{" "}
          <a className="btn secondary" href="#/">Explore the demo without a wallet</a>
        </p>
      </section>
    );
  }
  return (
    <>
      <section className="hero compact">
        <h1>Co-sign a market.</h1>
        <div className="risk">
          <h2>What you are signing up for</h2>
          <p>
            Your cover pays first. If a liquidation leaves bad debt, it is taken from cover before any lender loses money, and
            you can lose all of it. Leaving takes a {Number(markets[0].cooldown) / 60}-minute notice, and you cannot leave if
            that would drop the market below its minimum cover. Co-signers whose notice has already ended can leave before a
            loss is booked, which leaves more of that loss to the cover that stays. Votes count per market: a market's votes are
            capped by its total cover, not by yours alone.
          </p>
        </div>
      </section>
      <div className="cols">
        {markets.map((m) => <CoverPanel key={m.vault} {...ctx} m={m} />)}
      </div>
      <VotePanel {...ctx} />
      <section className="panel wide">
        <h2>MEZO rewards</h2>
        <p className="muted">Rewards stream over each epoch after they are distributed. Cover holders get {Number(markets[0].rewardJuniorBps) / 100}% of a market's rewards; lenders get the rest.</p>
        <ul className="plain">
          {markets.map((m) => (
            <li key={m.vault}>
              {m.name}: {fmt(user?.perVault[m.vault]?.rewards ?? 0n, 4)} MEZO ready{" "}
              <button className="secondary" disabled={!user || (user.perVault[m.vault]?.rewards ?? 0n) === 0n}
                onClick={() => send("Claim MEZO", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "claimRewards" }))}>Claim</button>
            </li>
          ))}
        </ul>
        {gauge && <p className="muted small">Epoch {gauge.epoch.toString()} ends at {new Date(Number(gauge.epochEnd) * 1000).toLocaleTimeString()}. Budget {fmt(gauge.budget, 0)} MEZO.</p>}
      </section>
      <p className="muted small">Gauge: <a href={addrUrl(d.gauge)} target="_blank" rel="noreferrer">{short(d.gauge)}</a></p>
    </>
  );
}

function CoverPanel({ m, user, send, approveIfNeeded, d }: Ctx & { m: MarketState }) {
  const [dep, setDep] = useState("");
  const me = user?.perVault[m.vault];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const req = me?.request;
  const reqLive = req && req.shares > 0n && req.round === m.round;
  const ready = reqLive && now >= req.readyAt;
  const opens = toWei(dep) * m.maxLeverage;
  return (
    <section className="panel">
      <h2>{m.name}</h2>
      <Waterfall senior={m.senior} junior={m.junior} scale={m.senior + m.junior + m.capacity} capacity={m.capacity} />
      <p className="held">{user ? `Your cover: ${fmt(me?.junior ?? 0n)} MUSD.` : "Loading your cover…"} Market cover: {fmt(m.junior)} MUSD, {pct(m.coverageBps)} of the vault.</p>
      <label htmlFor={`cov-${m.vault}`}>Post cover</label>
      <Amount id={`cov-${m.vault}`} value={dep} onChange={setDep} unit="MUSD" max={user?.musd} />
      {opens > 0n && <p className="muted small">Opens room for up to {fmt(opens, 0)} MUSD of lender deposits.</p>}
      <button
        disabled={toWei(dep) === 0n}
        onClick={async () => {
          const a = toWei(dep);
          if (!(await approveIfNeeded(d.musd, m.vault, a, "MUSD"))) return;
          if (await send("Post cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "depositJunior", args: [a] }))) setDep("");
        }}
      >Post cover</button>
      {me && me.juniorShares > 0n && (
        <div className="exit">
          {!reqLive && (
            <button className="secondary" onClick={() => send("Request to withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "requestJuniorWithdraw", args: [me.juniorShares] }))}>
              Request to withdraw all cover
            </button>
          )}
          {reqLive && !ready && <p className="muted small">Withdrawal ready at {new Date(Number(req!.readyAt) * 1000).toLocaleTimeString()}. Your cover still pays losses until then.</p>}
          {reqLive && ready && (
            <button className="secondary" onClick={() => send("Withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawJunior" }))}>
              Withdraw cover
            </button>
          )}
          {me.votes > 0n && <p className="muted small">Remove your votes on this market before withdrawing all of your cover.</p>}
        </div>
      )}
    </section>
  );
}

function VotePanel({ user, markets, send, d, gauge }: Ctx) {
  const tokens = user?.veTokens ?? [];
  const [sel, setSel] = useState<bigint | null>(null);
  const [w, setW] = useState<Record<string, number>>({});
  const token = useMemo(() => tokens.find((t) => t.id === sel) ?? tokens[0], [tokens, sel]);
  const eligible = markets.filter((m) => (user?.perVault[m.vault]?.juniorShares ?? 0n) > 0n);
  const total = eligible.reduce((a, m) => a + (w[m.vault] ?? 0), 0);
  return (
    <section className="panel wide">
      <h2>Vote MEZO rewards with veBTC</h2>
      <p className="muted">
        You can only vote for markets where you hold cover, and a market's votes count only up to what its cover backs.
        Lock BTC for veBTC on <a href="https://testnet.mezo.org" target="_blank" rel="noreferrer">testnet.mezo.org</a>.
      </p>
      {tokens.length === 0 ? <p>No veBTC in this wallet.</p> : (
        <>
          <label htmlFor="ve">veBTC position</label>
          <select id="ve" value={token?.id.toString()} onChange={(e) => setSel(BigInt(e.target.value))}>
            {tokens.map((t) => <option key={t.id.toString()} value={t.id.toString()}>#{t.id.toString()}: {fmt(t.power, 6)} voting power</option>)}
          </select>
          {eligible.length === 0 ? <p className="warn">Post cover on a market first.</p> : (
            <div className="sliders">
              {eligible.map((m) => (
                <div key={m.vault} className="slider">
                  <label htmlFor={`w-${m.vault}`}>{m.name}</label>
                  <input id={`w-${m.vault}`} type="range" min={0} max={100} value={w[m.vault] ?? 0} onChange={(e) => setW({ ...w, [m.vault]: Number(e.target.value) })} />
                  <span>{total ? Math.round(((w[m.vault] ?? 0) / total) * 100) : 0}%</span>
                  <small className="muted">now {fmt(token?.votes[m.vault] ?? 0n, 6)}</small>
                </div>
              ))}
            </div>
          )}
          {token?.votedThisEpoch && <p className="muted small">This position already voted in epoch {gauge?.epoch.toString()}. You can vote again next epoch.</p>}
          <div className="btns">
            <button
              disabled={!token || total === 0 || token.votedThisEpoch}
              onClick={() => {
                const ms = eligible.filter((m) => (w[m.vault] ?? 0) > 0);
                send("Vote", (wc) => wc.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "vote", args: [token!.id, ms.map((m) => m.vault), ms.map((m) => BigInt(w[m.vault]))] }));
              }}
            >Vote</button>
            {token && Object.values(token.votes).some((v) => v > 0n) && (
              <button className="secondary" onClick={() => send("Remove votes", (wc) => wc.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "reset", args: [token.id] }))}>Remove votes</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

