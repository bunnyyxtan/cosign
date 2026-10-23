import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Address, Hex } from "viem";
import {
  addrUrl, authorizedAccount, client, connectWallet, disconnectWallet, ensureChain, erc20Abi, loadDeployment, loadLosses, loadMarkets,
  loadUser, mezoTestnet, selectProvider, setDisconnected, txUrl, walletChainId, walletClient, wasDisconnected,
  type Eip1193,
  type DemoRun, type Deployment, type GaugeState, type LossEvent, type MarketState, type UserState,
} from "./chain";
import type { Ctx, Next } from "./app/ctx";
import { ConnectModal } from "./app/Connect";
import { Cosign, Rewards } from "./app/Cosign";
import { Evidence } from "./app/Evidence";
import { MarketDetail, Markets } from "./app/Markets";
import { Positions } from "./app/Positions";
import { onWallets, savedWallet, saveWallet, wallets, type Wallet } from "./wallets";
import { fmt, short, WAD } from "./app/ui";
import { ArrowNE, Check, Close, Wordmark } from "./ui/Icon";

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
  EpochNotOver: "That epoch has not ended yet. It can be distributed once it is over.",
  AlreadyDistributed: "That epoch was already distributed.",
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

type Route = { page: "markets" } | { page: "cosign" } | { page: "rewards" } | { page: "positions" } | { page: "evidence" } | { page: "market"; vault: Address };
/** Wallet = waiting for the user to sign; chain = sent, waiting for a receipt; ok only after a successful receipt.
 *  syncing = confirmed, figures not yet re-read; next = the separate action an approval unlocks. */
type Toast = { kind: "wallet" | "chain" | "ok" | "error"; label: string; text: string; tx?: Hex; block?: bigint; syncing?: boolean; next?: Next };

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("market/")) return { page: "market", vault: h.slice(7) as Address };
  if (h === "cosign" || h === "rewards" || h === "positions" || h === "evidence") return { page: h };
  return { page: "markets" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [d, setD] = useState<Deployment | null | undefined>(undefined);
  const [demo, setDemo] = useState<DemoRun | null>(null);
  const [markets, setMarkets] = useState<MarketState[]>([]);
  const [gauge, setGauge] = useState<GaugeState | null>(null);
  const [price, setPrice] = useState(0n);
  const [losses, setLosses] = useState<LossEvent[] | null>(null); // null while the event scan runs
  const [lossesFailed, setLossesFailed] = useState(false);
  const [account, setAccount] = useState<Address | null>(null);
  const [user, setUser] = useState<UserState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false); // a confirmed transaction's figures are being re-read
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const f = () => { setRoute(parseRoute()); setMenu(false); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  useEffect(() => {
    loadDeployment().then(({ d, demo }) => {
      setD(d);
      setDemo(demo);
    });
  }, []);

  // Every refresh reads at one block, never older than this session's latest confirmed transaction, so a lagging
  // RPC node cannot hand back pre-transaction figures as current. Returns whether fresh figures were applied.
  const floor = useRef(0n);
  const refresh = useCallback(async (quiet = false) => {
    if (!d) return false;
    try {
      const head = await client.getBlockNumber();
      if (head < floor.current) return false;
      const read = async (at: bigint) => {
        const r = await loadMarkets(d, at);
        return { r, u: account ? await loadUser(d, r.markets, r.gauge.epoch, account, at) : null };
      };
      // A node behind the load balancer may not have the newest block yet: fall back one block, never below the floor.
      const { r, u } = await read(head).catch((e) => (head - 1n >= floor.current ? read(head - 1n) : Promise.reject(e)));
      setMarkets(r.markets);
      setGauge(r.gauge);
      setPrice(r.price);
      if (account) setUser(u);
      setLoadError(null);
      setUpdated(new Date());
      return true;
    } catch (e) {
      if (quiet) return false;
      setLoadError(`Could not read Mezo testnet: ${(e as Error).message.split("\n")[0]}`);
      return false;
    }
  }, [d, account]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (d) loadLosses(d).then((l) => { setLosses(l); setLossesFailed(false); }).catch(() => setLossesFailed(true));
  }, [d]);

  // The provider this session runs through. Its listeners attach once and come off when it changes.
  const [eth, setEth] = useState<Eip1193 | undefined>(undefined);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const detected = useSyncExternalStore(onWallets, wallets);
  const current = detected.find((w) => w.id === walletId);

  const use = (p: Eip1193, id: string | null, a: Address) => {
    selectProvider(p);
    setEth(p);
    setWalletId(id);
    setUser(null);
    setAccount(a);
  };

  useEffect(() => {
    // Dev-only: ?devconnect connects the local test wallet on load (used for headless screenshots).
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("devconnect") && window.ethereum) {
      const p = window.ethereum;
      connectWallet().then((a) => use(p, null, a)).catch(() => {});
    }
  }, []);

  // Restore a connection the wallet already authorised, without a prompt, unless the user chose Disconnect.
  // It asks the wallet picked last time (waiting for it to announce itself). With nothing remembered it asks
  // window.ethereum only when no wallet announces itself, since with several wallets that would be a guess.
  // Nothing is shown as connected until the wallet answers.
  useEffect(() => {
    if (wasDisconnected()) return;
    let done = false;
    let live = true;
    const attempt = () => {
      if (done) return;
      const saved = savedWallet();
      const w = saved ? wallets().find((x) => x.id === saved) : undefined;
      const p = w?.provider ?? (!saved && wallets().every((x) => x.legacy) ? window.ethereum : undefined);
      if (!p) return;
      done = true;
      setRestoring(true);
      authorizedAccount(p)
        .then((a) => { if (live && a && !wasDisconnected()) use(p, w?.id ?? null, a); })
        .catch(() => {})
        .finally(() => { if (live) setRestoring(false); });
    };
    attempt();
    const off = onWallets(attempt);
    const t = setTimeout(off, 4000);
    return () => { live = false; off(); clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (!eth) return;
    let live = true;
    walletChainId().then((id) => { if (live) setChainId(id); }).catch(() => {});
    const onAccounts = (a: unknown) => {
      setUser(null); // never show the previous account's positions
      setAccount(wasDisconnected() ? null : (((a as Address[])[0] ?? null) as Address | null));
    };
    const onChain = (id: unknown) => setChainId(parseInt(id as string, 16));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [eth]);

  const connect = () => setWalletOpen(true);
  const closeWallet = useCallback(() => setWalletOpen(false), []);
  /** The dialog calls this only after the wallet itself has authorised the account. */
  const onConnected = (w: Wallet, a: Address) => {
    saveWallet(w.id);
    setDisconnected(false);
    use(w.provider, w.id, a);
  };

  const disconnect = async () => {
    setDisconnected(true);
    await disconnectWallet();
    setAccount(null);
    setUser(null);
    setEth(undefined);
  };

  const switchNetwork = async () => {
    try {
      await ensureChain();
      setChainId(await walletChainId());
    } catch (e) {
      setToast({ kind: "error", label: "Switch network", text: explain(e) });
    }
  };

  /** Send a transaction, wait for it, and surface the explorer link. */
  const send = useCallback(
    async (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>) => {
      if (!account) return false;
      setBusy(true);
      try {
        await ensureChain();
        setToast({ kind: "wallet", label, text: "Confirm in your wallet" });
        const hash = await write(walletClient(account));
        setToast({ kind: "chain", label, text: "Sent. Waiting for Mezo testnet to include it", tx: hash });
        const r = await waitReceipt(hash);
        if (r.status !== "success") {
          setToast({ kind: "error", label, text: "The transaction was mined but reverted. Nothing changed.", tx: hash });
          return false;
        }
        const done = `Confirmed in block ${r.blockNumber.toString()}`;
        setToast({ kind: "ok", label, text: "Confirmed onchain · updating balances…", tx: hash, block: r.blockNumber, syncing: true });
        if (r.blockNumber > floor.current) floor.current = r.blockNumber;
        // Re-read until a node that has this block answers. A failed read is not a failed transaction, and the
        // buttons stay locked meanwhile so stale figures never invite a second send.
        setSyncing(true);
        let fresh = false;
        for (const until = Date.now() + 45_000; !fresh && Date.now() < until; ) {
          fresh = await refresh(true);
          if (!fresh) await new Promise((res) => setTimeout(res, 1500));
        }
        setSyncing(false);
        setToast((t) => (t?.tx === hash ? { ...t, syncing: false, text: fresh ? `${done} · balances updated` : `${done}. Balances could not be re-read yet; Cosign keeps trying every 15 seconds. Do not send it again.` } : t));
        if (d) loadLosses(d).then(setLosses).catch(() => setLossesFailed(true));
        return true;
      } catch (e) {
        setToast({ kind: "error", label, text: explain(e) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [account, refresh, d],
  );

  /** Approve `spender` for `amount` of `token` if the current allowance is short. */
  const approveIfNeeded = useCallback(
    async (token: Address, spender: Address, amount: bigint, label: string, next: Next) => {
      if (!account) return false;
      const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender] }).catch(() => null);
      if (allowance === null) {
        setToast({ kind: "error", label: `Approve ${label}`, text: "Could not read your current allowance from Mezo testnet. Nothing was sent; try again in a moment." });
        return false;
      }
      if (allowance >= amount) return true;
      const ok = await send(`Approve ${label}`, (w) => w.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }));
      if (!ok) return false;
      // Wallets let users edit the spending cap; check what was actually approved, at or after the approval's block.
      let now: bigint | null = null;
      for (let i = 0; i < 5 && now === null; i++) {
        now = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender], blockNumber: floor.current }).catch(() => null);
        if (now === null) await new Promise((res) => setTimeout(res, 1500));
      }
      if (now === null) {
        setToast((t) => (t ? { ...t, syncing: false, text: "Approval confirmed, but the allowance could not be re-read yet. Wait a moment, then press the button again; you will not be asked to approve twice if it went through." } : t));
      } else if (now < amount) {
        setToast({ kind: "error", label: `Approve ${label}`, text: `The approved amount is lower than ${fmt(amount)}. Approve at least that much.` });
      } else {
        // Two deliberate steps: the action is offered as its own button, never chained onto the approval.
        setToast((t) => (t ? { ...t, syncing: false, text: `Allowance approved — ready to ${next.ready}`, next } : t));
      }
      return false;
    },
    [account, send],
  );

  const ctx: Ctx = { d: d!, markets, gauge, price, user, account, send, approveIfNeeded, connect, losses, lossesFailed, demo, busy };
  const wrongChain = account && chainId !== null && chainId !== mezoTestnet.id;
  const isOn = (p: Route["page"], vault?: string) =>
    route.page === p && (!vault || (route.page === "market" && route.vault.toLowerCase() === vault.toLowerCase())) ? "page" : undefined;
  const title = route.page === "market" ? markets.find((m) => m.vault.toLowerCase() === route.vault.toLowerCase())?.name ?? "Market" : { markets: "Markets", cosign: "Co-sign", rewards: "Rewards", positions: "Positions", evidence: "Evidence" }[route.page];

  return (
    <div className={`app ${menu ? "menu-open" : ""}`}>
      <a className="skip" href="#app-main">Skip to content</a>
      <aside className="side" aria-label="Workspace">
        <div className="side-top">
          <Wordmark href="../" label="Cosign website" />
          <button className="icon-btn side-close" onClick={() => setMenu(false)} aria-label="Close menu"><Close /></button>
        </div>
        <nav className="side-nav">
          <span className="side-k">Workspace</span>
          <a href="#/markets" aria-current={isOn("markets")}>Markets</a>
          {markets.map((m) => <a key={m.vault} className="sub" href={`#/market/${m.vault}`} aria-current={isOn("market", m.vault)}>{m.name}</a>)}
          <a href="#/cosign" aria-current={isOn("cosign")}>Co-sign</a>
          <a href="#/rewards" aria-current={isOn("rewards")}>Rewards</a>
          <a href="#/positions" aria-current={isOn("positions")}>Positions</a>
          <span className="side-k">Proof</span>
          <a href="#/evidence" aria-current={isOn("evidence")}>Recorded evidence</a>
          <a href="../">Website</a>
        </nav>
        <div className="side-foot">
          <span className={`netdot ${loadError ? "is-bad" : updated ? "is-ok" : ""}`} />
          <div>
            <b>Mezo testnet · 31611</b>
            <span>{loadError ? "Not reachable" : updated ? `Live · read ${updated.toLocaleTimeString()}` : "Connecting…"}</span>
            {price > 0n && <span>MEZO {fmt(price / WAD, 2)} MUSD · demo oracle</span>}
          </div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenu(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMenu(true)} aria-label="Open menu"><span /><span /></button>
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <span className="chip chip-plain topbar-net">Testnet prototype</span>
            {account ? (
              <div className="acct">
                <button className="acct-addr num" onClick={connect} aria-haspopup="dialog" aria-label={`Wallet ${short(account)}: details`}>
                  {current?.icon ? <img src={current.icon} width={18} height={18} alt="" /> : <i />}{short(account)}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
              </div>
            ) : restoring ? (
              <button className="btn btn-ghost btn-sm" disabled aria-busy="true"><span className="spin" />Reconnecting</button>
            ) : (
              <button className="btn btn-dark btn-sm" onClick={connect} aria-haspopup="dialog">Connect wallet</button>
            )}
          </div>
        </header>

        {wrongChain && (
          <div className="banner is-loss" role="alert">
            <span>Your wallet is on another network. Cosign runs on Mezo testnet.</span>
            <button className="btn btn-dark btn-sm" onClick={switchNetwork}>Switch to Mezo testnet</button>
          </div>
        )}
        {syncing && (
          <div className="banner is-pending" role="status">
            <span><span className="spin" aria-hidden="true" />Your transaction is confirmed onchain. The figures below are from before it and are being updated.</span>
          </div>
        )}
        {loadError && (
          <div className="banner is-loss" role="alert">
            <span>{loadError}. Figures below may be out of date.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => refresh()}>Try again</button>
          </div>
        )}

        <main id="app-main" className="content">
          {d === undefined && <Loading text="Loading the deployment…" />}
          {d === null && (
            <div className="empty card card-white">
              <h1 className="page-title">Not deployed</h1>
              <p>This build has no Cosign deployment for Mezo testnet. Run the deploy script, then reload.</p>
            </div>
          )}
          {d && route.page === "evidence" && <Evidence {...ctx} />}
          {d && route.page !== "evidence" && markets.length === 0 && !loadError && <Loading text="Reading the markets from Mezo testnet…" />}
          {d && markets.length > 0 && route.page === "markets" && <Markets {...ctx} />}
          {d && markets.length > 0 && route.page === "market" && <MarketDetail {...ctx} vault={route.vault} />}
          {d && markets.length > 0 && route.page === "cosign" && <Cosign {...ctx} />}
          {d && markets.length > 0 && route.page === "rewards" && <Rewards {...ctx} />}
          {d && markets.length > 0 && route.page === "positions" && <Positions {...ctx} />}
        </main>

        <footer className="app-foot">
          <p><b>Unaudited prototype on Mezo testnet.</b> Cover is first-loss capital, not a guarantee: lenders lose money if losses exceed it. MEZO rewards are funded by the Cosign team, not by Mezo protocol emissions. The MEZO price comes from a demo oracle the Cosign team controls.</p>
        </footer>
      </div>

      {toast && <TxTray toast={toast} busy={busy} onClose={() => setToast(null)} />}
      <ConnectModal open={walletOpen} onClose={closeWallet} account={account} walletId={walletId} chainId={chainId}
        onConnected={onConnected} onChain={setChainId} onDisconnect={disconnect} />
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="loading" role="status">
      <span className="spin" />{text}
      <div className="skel" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}

/** One transaction's state. It reads "Confirmed" only after a successful receipt; pending states cannot be dismissed. */
function TxTray({ toast, busy, onClose }: { toast: Toast; busy: boolean; onClose: () => void }) {
  // Confirmed is a fact once the receipt says so; the re-read after it is shown separately and cannot be dismissed.
  const signing = toast.kind === "wallet" || toast.kind === "chain";
  const pending = signing || !!toast.syncing;
  const cur = { wallet: 0, chain: 1, ok: 3, error: -1 }[toast.kind];
  const cls = (i: number) => (i < cur ? "done" : i === cur ? "on" : "");
  return (
    <div className={`tray is-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} aria-live="polite">
      <div className="tray-icon" aria-hidden="true">{signing ? <span className="spin" /> : toast.kind === "ok" ? <Check /> : <Close />}</div>
      <div className="tray-body">
        <b>{toast.label}</b>
        <span className={toast.syncing ? "tray-sync" : undefined}>{toast.syncing && <span className="spin" aria-hidden="true" />}{toast.text}</span>
        {toast.kind !== "error" && (
          <ol className="tray-steps" aria-hidden="true">
            <li className={cls(0)}>Sign</li><li className={cls(1)}>Mining</li><li className={cls(2)}>Confirmed</li>
          </ol>
        )}
        {toast.tx && <a className="link" href={txUrl(toast.tx)} target="_blank" rel="noreferrer">View transaction <ArrowNE size={12} /></a>}
        {toast.next && !toast.syncing && (
          <button className="btn btn-dark btn-sm tray-next" disabled={busy} onClick={() => { const n = toast.next!; onClose(); n.run(); }}>{toast.next.label}</button>
        )}
      </div>
      {!pending && <button className="icon-btn" onClick={onClose} aria-label="Dismiss"><Close /></button>}
    </div>
  );
}
