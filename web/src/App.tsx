import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Address, Hex } from "viem";
import {
  authorizedAccount, client, connectWallet, disconnectWallet, ensureChain, erc20Abi, loadDeployment, loadLosses, loadMarkets,
  loadUser, mezoTestnet, selectProvider, setDisconnected, txUrl, walletChainId, walletClient, wasDisconnected,
  type Eip1193,
  type DemoRun, type Deployment, type GaugeState, type LossEvent, type MarketState, type UserState,
} from "./chain";
import type { Ctx, Next } from "./app/ctx";
import { add, dismiss, explain, isOpen, mine, sweep, tone, toasts, update, type TxItem } from "./app/activity";
import { ConnectModal } from "./app/Connect";
import { Cosign } from "./app/Cosign";
import { Rewards } from "./app/Rewards";
import { Evidence } from "./app/Evidence";
import { MarketDetail, Markets } from "./app/Markets";
import { Portfolio } from "./app/Portfolio";
import { Sheet, useLeaving } from "./app/Modal";
import { onWallets, savedWallet, saveWallet, wallets, type Wallet } from "./wallets";
import { fmt, short, WAD } from "./app/ui";
import { Activity, ArrowNE, Check, Close, Info, NavCosign, NavMarkets, NavPortfolio, NavRewards, Wordmark } from "./ui/Icon";

/** Poll for a receipt for up to 3 minutes; Mezo's load-balanced RPC can briefly miss a mined tx. Null = still unknown. */
async function waitReceipt(hash: Hex) {
  for (let i = 0; i < 90; i++) {
    try {
      return await client.getTransactionReceipt({ hash });
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

export type Route =
  | { page: "markets" }
  | { page: "market"; vault: Address; tab: "lend" | "borrow" }
  | { page: "cosign"; vault?: Address }
  | { page: "rewards" }
  | { page: "portfolio" }
  | { page: "evidence" };

/** Hash routes. Old links keep working: #/positions opens Portfolio. */
function parseRoute(): Route {
  const [p, a, b] = window.location.hash.replace(/^#\/?/, "").split("/");
  if (p === "market" && a) return { page: "market", vault: a as Address, tab: b === "borrow" ? "borrow" : "lend" };
  if (p === "cosign") return { page: "cosign", vault: (a || undefined) as Address | undefined };
  if (p === "positions" || p === "portfolio") return { page: "portfolio" };
  if (p === "rewards" || p === "evidence") return { page: p };
  return { page: "markets" };
}

const NAV = [
  { page: "markets", href: "#/markets", label: "Markets", icon: NavMarkets },
  { page: "cosign", href: "#/cosign", label: "Co-sign", icon: NavCosign },
  { page: "rewards", href: "#/rewards", label: "Rewards", icon: NavRewards },
  { page: "portfolio", href: "#/portfolio", label: "Portfolio", icon: NavPortfolio },
] as const;

function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return on;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false); // a confirmed transaction's figures are being re-read
  const [menu, setMenu] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activity, setActivity] = useState<TxItem[]>([]);
  const online = useOnline();

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
    } catch {
      if (quiet) return false;
      setLoadError("Mezo testnet isn't responding");
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

  // ---------------------------------------------------------------- transactions
  const seq = useRef(0);
  const flying = useRef(false);
  const held = useRef(false);
  const note = (id: number, p: Parameters<typeof update>[2]) => setActivity((l) => update(l, id, p, Date.now()));
  useEffect(() => {
    const t = setInterval(() => setActivity((l) => sweep(l, Date.now(), held.current)), 500);
    return () => clearInterval(t);
  }, []);

  const switchNetwork = async () => {
    try {
      await ensureChain();
      setChainId(await walletChainId());
    } catch (e) {
      if (!account) return;
      const x = explain(e);
      const id = ++seq.current;
      setActivity((l) => add(l, { id, account, label: "Switch network", state: "signing", text: "", at: Date.now() }));
      note(id, { state: x.state, text: x.text, detail: x.detail });
    }
  };

  /** Send a transaction, track it to a receipt, then re-read figures at or after its block. */
  const send = useCallback(
    async (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>): Promise<number | false> => {
      // One transaction at a time, enforced here rather than by disabled buttons alone.
      if (!account || flying.current) return false;
      flying.current = true;
      setBusy(true);
      const id = ++seq.current;
      setActivity((l) => add(l, { id, account, label, state: "signing", text: "Confirm in your wallet", at: Date.now() }));
      try {
        await ensureChain();
        const hash = await write(walletClient(account));
        note(id, { state: "pending", text: "Sent. Waiting for Mezo testnet", tx: hash });
        const r = await waitReceipt(hash);
        if (!r) {
          note(id, { state: "unknown", text: "Not confirmed after 3 minutes. It may still go through: check the explorer before sending again." });
          return false;
        }
        if (r.status !== "success") {
          note(id, { state: "failed", text: "Reverted onchain. Nothing changed except the network fee.", block: r.blockNumber });
          return false;
        }
        if (r.blockNumber > floor.current) floor.current = r.blockNumber;
        note(id, { state: "syncing", text: "Confirmed. Updating balances", block: r.blockNumber });
        // Re-read until a node that has this block answers. A failed read is not a failed transaction, and the
        // buttons stay locked meanwhile so stale figures never invite a second send.
        setSyncing(true);
        let fresh = false;
        for (const until = Date.now() + 45_000; !fresh && Date.now() < until; ) {
          fresh = await refresh(true);
          if (!fresh) await new Promise((res) => setTimeout(res, 1500));
        }
        setSyncing(false);
        note(id, fresh
          ? { state: "done", text: `Confirmed in block ${r.blockNumber}` }
          : { state: "unsynced", text: `Confirmed in block ${r.blockNumber}. Balances haven't refreshed yet; Cosign keeps trying. Don't send it again.` });
        if (d) loadLosses(d).then(setLosses).catch(() => setLossesFailed(true));
        return id;
      } catch (e) {
        const x = explain(e);
        note(id, { state: x.state, text: x.text, detail: x.detail });
        return false;
      } finally {
        flying.current = false;
        setBusy(false);
      }
    },
    [account, refresh, d],
  );

  /** Approve `spender` for `amount` of `token` if the current allowance is short. */
  const approveIfNeeded = useCallback(
    async (token: Address, spender: Address, amount: bigint, label: string, next: Next) => {
      if (!account || flying.current) return false;
      const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender] }).catch(() => null);
      if (allowance === null) {
        const id = ++seq.current;
        setActivity((l) => add(l, { id, account, label: `Approve ${label}`, state: "signing", text: "", at: Date.now() }));
        note(id, { state: "failed", text: "Couldn't read your current allowance from Mezo testnet. Nothing was sent; try again in a moment." });
        return false;
      }
      if (allowance >= amount) return true;
      const id = await send(`Approve ${label}`, (w) => w.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }));
      if (!id) return false;
      // Wallets let users edit the spending cap; check what was actually approved, at or after the approval's block.
      let now: bigint | null = null;
      for (let i = 0; i < 5 && now === null; i++) {
        now = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender], blockNumber: floor.current }).catch(() => null);
        if (now === null) await new Promise((res) => setTimeout(res, 1500));
      }
      if (now === null) note(id, { state: "unsynced", text: "Approval confirmed, but the allowance couldn't be re-read yet. Press the button again in a moment; you won't be asked to approve twice if it went through." });
      else if (now < amount) note(id, { state: "failed", text: `The approved amount is lower than ${fmt(amount)} ${label}. Approve at least that much.` });
      // Two deliberate steps: the action stays in the form, and is offered here too; it never starts by itself.
      else note(id, { state: "approved", text: `${label} approved. Next: ${next.ready}.`, next });
      return false;
    },
    [account, send],
  );

  const mineAll = mine(activity, account);
  const ctx: Ctx = { d: d!, markets, gauge, price, user, account, send, approveIfNeeded, connect, about: () => setAboutOpen(true), losses, lossesFailed, demo, busy, activity: mineAll };
  const wrongChain = !!account && chainId !== null && chainId !== mezoTestnet.id;
  const section = route.page === "market" || route.page === "evidence" ? "markets" : route.page;
  const marketName = route.page === "market" ? markets.find((m) => m.vault.toLowerCase() === route.vault.toLowerCase())?.name ?? "Market" : "";
  const pageName = { markets: "Markets", market: marketName, cosign: "Co-sign", rewards: "Rewards", portfolio: "Portfolio", evidence: "Recorded evidence" }[route.page];
  const nested = route.page === "market" || route.page === "evidence";

  return (
    <div className={`app ${menu ? "menu-open" : ""}`}>
      <a className="skip" href="#app-main">Skip to content</a>
      <aside className="side" aria-label="Cosign app">
        <div className="side-top">
          <Wordmark href="#/markets" label="Cosign: markets" />
          <button className="icon-btn side-close" onClick={() => setMenu(false)} aria-label="Close menu"><Close /></button>
        </div>
        <nav className="side-nav" aria-label="Main">
          {NAV.map(({ page, href, label, icon: I }) => (
            <a key={page} href={href} aria-current={section === page ? "page" : undefined}><I size={18} />{label}</a>
          ))}
        </nav>
        <button className="side-env" onClick={() => setAboutOpen(true)}>
          <span className={`netdot ${!online || loadError ? "is-bad" : updated ? "is-ok" : ""}`} aria-hidden="true" />
          <span><b>Mezo Testnet</b><small>Unaudited · risks</small></span>
          <Info size={16} />
        </button>
      </aside>
      <div className="scrim" onClick={() => setMenu(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <div className="bar-in topbar-in">
            <button className="icon-btn menu-toggle" onClick={() => setMenu(true)} aria-label="Open menu"><span /><span /></button>
            {nested ? (
              <nav className="crumb" aria-label="Breadcrumb"><a href="#/markets">Markets</a><span aria-hidden="true">/</span><span aria-current="page">{pageName}</span></nav>
            ) : <span className="topbar-title">{pageName}</span>}
            <div className="topbar-right">
              <NetStatus online={online} loadError={!!loadError} live={!!updated} wrongChain={wrongChain} onSwitch={switchNetwork} onOpen={() => setAboutOpen(true)} />
              {account && mineAll.length > 0 && <ActivityMenu items={mineAll} />}
              {account ? (
                <button className="acct" onClick={connect} aria-haspopup="dialog" aria-label={`Account ${short(account)}: copy, explorer, disconnect`}>
                  {current?.icon ? <img src={current.icon} width={20} height={20} alt="" /> : <i aria-hidden="true" />}
                  <span className="num acct-long">{short(account)}</span><span className="num acct-short">{account.slice(0, 4)}…{account.slice(-4)}</span>
                </button>
              ) : restoring ? (
                <button className="btn btn-ghost btn-sm" disabled aria-busy="true"><span className="spin" />Reconnecting</button>
              ) : (
                <button className="btn btn-dark btn-sm" onClick={connect} aria-haspopup="dialog">Connect wallet</button>
              )}
            </div>
          </div>
        </header>

        {(wrongChain || syncing || loadError || !online) && (
          <div className="bar-in banners">
            {wrongChain && (
              <div className="banner is-loss" role="alert">
                <span>Your wallet is on another network. Cosign runs on Mezo Testnet.</span>
                <button className="btn btn-dark btn-sm" onClick={switchNetwork}>Switch network</button>
              </div>
            )}
            {!online && <div className="banner is-loss" role="alert"><span>You're offline. Figures below are from your last connection; nothing can be sent.</span></div>}
            {online && loadError && (
              <div className="banner is-loss" role="alert">
                <span>{loadError}. Figures below may be out of date.</span>
                <button className="btn btn-ghost btn-sm" onClick={() => refresh()}>Try again</button>
              </div>
            )}
            {syncing && (
              <div className="banner is-pending" role="status">
                <span><span className="spin" aria-hidden="true" />Confirmed onchain. Updating the figures below.</span>
              </div>
            )}
          </div>
        )}

        <main id="app-main" className="bar-in content">
          {d === undefined && <Loading text="Loading the deployment…" />}
          {d === null && (
            <div className="empty card card-white">
              <h1 className="page-title">Not deployed</h1>
              <p>This build has no Cosign deployment for Mezo testnet.</p>
            </div>
          )}
          {d && route.page === "evidence" && <Evidence {...ctx} />}
          {d && route.page !== "evidence" && markets.length === 0 && !loadError && <Loading text="Reading markets from Mezo testnet…" />}
          {d && markets.length > 0 && route.page === "markets" && <Markets {...ctx} />}
          {d && markets.length > 0 && route.page === "market" && <MarketDetail key={route.vault + route.tab} {...ctx} vault={route.vault} tab={route.tab} />}
          {d && markets.length > 0 && route.page === "cosign" && <Cosign {...ctx} vault={route.vault} />}
          {d && markets.length > 0 && route.page === "rewards" && <Rewards {...ctx} />}
          {d && markets.length > 0 && route.page === "portfolio" && <Portfolio {...ctx} />}
        </main>
      </div>

      <Toasts items={toasts(activity, account)} busy={busy} onClose={(id) => setActivity((l) => dismiss(l, id))}
        onHold={(h) => { held.current = h; }} />
      <ConnectModal open={walletOpen} onClose={closeWallet} account={account} walletId={walletId} chainId={chainId}
        onConnected={onConnected} onChain={setChainId} onDisconnect={disconnect} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} online={online} loadError={loadError} updated={updated} price={price} />
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

/** A compact, truthful network indicator. It opens the testnet and risk details. */
function NetStatus({ online, loadError, live, wrongChain, onSwitch, onOpen }: {
  online: boolean; loadError: boolean; live: boolean; wrongChain: boolean; onSwitch: () => void; onOpen: () => void;
}) {
  if (wrongChain) return <button className="net is-bad" onClick={onSwitch}><i aria-hidden="true" />Wrong network<span className="net-x">: switch</span></button>;
  const [cls, text] = !online ? ["is-bad", "Offline"] : loadError ? ["is-bad", "Testnet unreachable"] : live ? ["is-ok", "Mezo Testnet"] : ["", "Connecting"];
  return <button className={`net ${cls}`} onClick={onOpen} aria-label={`${text}. Network and risk details`}><i aria-hidden="true" /><span className="net-t">{text}</span></button>;
}

const STATE_WORD: Record<TxItem["state"], string> = {
  signing: "Waiting for signature", pending: "Pending", syncing: "Confirmed · updating", done: "Confirmed", approved: "Approved",
  unsynced: "Confirmed", unknown: "Not confirmed yet", rejected: "Declined", failed: "Failed",
};

/** This session's transactions, so a toast hiding itself never loses the record. In memory only. */
function ActivityMenu({ items }: { items: TxItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const live = items.filter((t) => isOpen(t.state)).length;
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  return (
    <div className="actv" ref={ref} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button className="icon-btn actv-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true"
        aria-label={live ? `Activity: ${live} in progress` : "Activity this session"}>
        {live ? <span className="spin" aria-hidden="true" /> : <Activity size={18} />}
      </button>
      {open && (
        <div className="actv-pop" role="region" aria-label="Activity this session">
          <div className="actv-head"><b>Activity</b><span>This session</span></div>
          <ul>
            {items.map((t) => (
              <li key={t.id} className={`is-${tone(t.state)}`}>
                <i aria-hidden="true" />
                <span><b>{t.label}</b><small>{STATE_WORD[t.state]} · {new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span>
                {t.tx && <a className="icon-btn" href={txUrl(t.tx)} target="_blank" rel="noreferrer" aria-label={`${t.label}: view in explorer`}><ArrowNE /></a>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Transaction notices. Unresolved ones stay; successes leave by themselves; failures wait to be closed. */
function Toasts({ items, busy, onClose, onHold }: { items: TxItem[]; busy: boolean; onClose: (id: number) => void; onHold: (h: boolean) => void }) {
  // A toast that leaves stays for one short exit animation.
  const [leaving, setLeaving] = useState<TxItem[]>([]);
  const prev = useRef<TxItem[]>([]);
  const ids = items.map((t) => t.id).join();
  useEffect(() => {
    const gone = prev.current.filter((p) => !items.some((i) => i.id === p.id));
    prev.current = items;
    if (!gone.length) return;
    setLeaving((l) => [...l, ...gone]);
    setTimeout(() => setLeaving((l) => l.filter((x) => !gone.some((g) => g.id === x.id))), 220);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.slice(0, 3);
  // The container unmounts with its last toast, so no mouseleave or blur arrives: release the hold here.
  useEffect(() => { if (!shown.length) onHold(false); }, [shown.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown.length && !leaving.length) return null;
  return (
    <div className="toasts" aria-live="polite" onMouseEnter={() => onHold(true)} onMouseLeave={() => onHold(false)}
      onFocus={() => onHold(true)} onBlur={() => onHold(false)}>
      {shown.map((t) => <Toast key={t.id} t={t} busy={busy} onClose={() => onClose(t.id)} />)}
      {leaving.filter((t) => !shown.some((s) => s.id === t.id)).map((t) => <Toast key={`x${t.id}`} t={t} busy leaving onClose={() => {}} />)}
    </div>
  );
}

function Toast({ t, busy, onClose, leaving = false }: { t: TxItem; busy: boolean; onClose: () => void; leaving?: boolean }) {
  const open = isOpen(t.state);
  const k = tone(t.state);
  return (
    <div className={`toast is-${k}${leaving ? " is-leaving" : ""}`} role={t.state === "failed" ? "alert" : "status"} aria-hidden={leaving || undefined}>
      <span className="toast-icon" aria-hidden="true">{open ? <span className="spin" /> : k === "ok" ? <Check size={14} /> : k === "pending" ? "!" : <Close size={14} />}</span>
      <div className="toast-body">
        <b>{t.label}</b>
        <span>{t.text}</span>
        {(t.tx || t.next || t.detail) && (
          <div className="toast-actions">
            {t.next && <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => { const n = t.next!; onClose(); n.run(); }}>{t.next.label}</button>}
            {t.tx && <a className="link" href={txUrl(t.tx)} target="_blank" rel="noreferrer">Explorer <ArrowNE size={12} /></a>}
            {t.detail && <details className="toast-detail"><summary>Details</summary><code>{t.detail}</code></details>}
          </div>
        )}
      </div>
      {!open && <button className="icon-btn toast-x" onClick={onClose} aria-label="Dismiss"><Close size={14} /></button>}
    </div>
  );
}

/** Testnet, network and risk details: one quiet place instead of a footer on every page. */
function About({ open, onClose, online, loadError, updated, price }: {
  open: boolean; onClose: () => void; online: boolean; loadError: string | null; updated: Date | null; price: bigint;
}) {
  const { shown, leaving } = useLeaving(open);
  if (!shown) return null;
  return (
    <Sheet title="Mezo Testnet prototype" onClose={onClose} leaving={leaving} describedBy="about-desc" size="md">
      <p id="about-desc" className="wm-lede">Cosign is an unaudited prototype. It runs on Mezo Testnet only; testnet tokens have no value. Don't use it with real funds.</p>
      <dl className="wm-facts">
        <div><dt>Network</dt><dd>Mezo Testnet · chain 31611</dd></div>
        <div><dt>Data</dt><dd>{!online ? "Offline" : loadError ? "Not reachable" : updated ? `Live · read ${updated.toLocaleTimeString()}` : "Connecting…"}</dd></div>
        {price > 0n && <div><dt>MEZO price</dt><dd className="num">{fmt(price / WAD, 2)} MUSD · demo oracle</dd></div>}
      </dl>
      <h3 className="wm-sub">Risks</h3>
      <ul className="wm-risks">
        <li><b>Cover is first-loss.</b> It pays for bad debt before lenders and can be lost in full.</li>
        <li><b>Lenders can lose money</b> when a loss is larger than the cover in front of them.</li>
        <li><b>Borrowers can be liquidated</b> when their loan-to-value reaches the market's limit.</li>
        <li><b>The MEZO price is a demo oracle</b> the Cosign team controls; it is not a market price.</li>
        <li><b>MEZO rewards are funded by participants</b> through the gauge. They aren't protocol emissions and aren't guaranteed.</li>
      </ul>
      <div className="wm-links">
        <a className="link" href="#/evidence" onClick={onClose}>Recorded evidence</a>
        <a className="link" href="https://github.com/bunnyyxtan/cosign/blob/main/docs/PRODUCT.md" target="_blank" rel="noreferrer">How Cosign works <ArrowNE size={12} /></a>
        <a className="link" href="../">Website</a>
      </div>
    </Sheet>
  );
}
