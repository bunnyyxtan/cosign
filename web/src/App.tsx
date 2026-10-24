import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { keccak256, toHex, type Address, type Hex } from "viem";
import {
  authorizedAccount, client, connectWallet, disconnectWallet, ensureChain, erc20Abi, loadDeployment, loadLosses, loadMarkets,
  loadUser, mezoTestnet, selectProvider, setDisconnected, txUrl, walletChainId, walletClient, wasDisconnected,
  type Eip1193,
  type DemoRun, type Deployment, type GaugeState, type LossEvent, type MarketState, type UserState,
} from "./chain";
import type { Ctx, Next } from "./app/ctx";
import {
  add, blocking, dismiss, explain, forAccount, isOpen, mine, parseSaved, reconcile, SAVE_KEY, sweep, toSave, tone, toasts, unresolved, update,
  type Lookup, type TxItem,
} from "./app/activity";
import { ConnectModal } from "./app/Connect";
import { Cosign } from "./app/Cosign";
import { Rewards } from "./app/Rewards";
import { Evidence } from "./app/Evidence";
import { MarketDetail, Markets } from "./app/Markets";
import { Portfolio } from "./app/Portfolio";
import { Sheet, useLeaving } from "./app/Modal";
import { onWallets, savedWallet, saveWallet, wallets, type Wallet } from "./wallets";
import { href, legacyPath, parsePath, pathOf, slugTable, type Route } from "./app/routes";
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

/** One receipt lookup: a receipt, none yet, or no answer from the RPC. */
async function lookup(hash: Hex): Promise<Lookup> {
  try {
    const r = await client.getTransactionReceipt({ hash });
    return { status: r.status, block: r.blockNumber };
  } catch (e) {
    return (e as { name?: string }).name === "TransactionReceiptNotFoundError" ? null : "error";
  }
}

/** The sending account is stored only as this tag, never as an address. */
const tag = (a: string) => keccak256(toHex(a.toLowerCase()));
const readSaved = () => { try { return parseSaved(localStorage.getItem(SAVE_KEY)); } catch { return []; } };
const writeSaved = (v: unknown[]) => { try { if (v.length) localStorage.setItem(SAVE_KEY, JSON.stringify(v)); else localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked: recovery lasts for this page only */ } };

const currentRoute = () => parsePath(window.location.pathname);

const NAV = [
  { page: "markets", href: href.markets(), label: "Markets", icon: NavMarkets },
  { page: "cosign", href: href.cosign(), label: "Co-sign", icon: NavCosign },
  { page: "rewards", href: href.rewards(), label: "Rewards", icon: NavRewards },
  { page: "portfolio", href: href.portfolio(), label: "Portfolio", icon: NavPortfolio },
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
  const [route, setRoute] = useState<Route>(currentRoute);
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

  // History API navigation. Links stay real <a href> elements (new tab, copy link, middle-click all work); a plain
  // left click on an in-app link is handled here without a page load. Back and Forward come through popstate.
  useEffect(() => {
    const onPop = () => { setRoute(currentRoute()); setMenu(false); };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin || !(u.pathname === "/app" || u.pathname.startsWith("/app/"))) return;
      if (u.pathname === window.location.pathname && u.hash) return; // an anchor on this page, such as Skip to content
      e.preventDefault();
      if (u.pathname + u.search !== window.location.pathname + window.location.search) window.history.pushState(null, "", u.pathname + u.search);
      setRoute(parsePath(u.pathname));
      setMenu(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick);
    return () => { window.removeEventListener("popstate", onPop); document.removeEventListener("click", onClick); };
  }, []);

  // Show the canonical form of the current address (/app becomes /app/markets; trailing slash and letter case).
  useEffect(() => {
    if (route.page === "notfound" || window.location.hash.startsWith("#/")) return;
    const p = pathOf(route);
    if (window.location.pathname !== p) window.history.replaceState(null, "", p + window.location.search);
  }, [route]);

  useEffect(() => {
    loadDeployment().then(({ d, demo }) => {
      setD(d);
      setDemo(demo);
      // Old shared links (#/market/0x..., #/cosign/0x..., #/positions, ...) open the same thing at its new address.
      // The vault is matched only against this deployment's own addresses.
      const old = d && legacyPath(window.location.hash, slugTable({ bold: d.vaultBold, steady: d.vaultSteady }));
      if (old) { window.history.replaceState(null, "", old); setRoute(parsePath(old)); }
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
  const live = useRef<TxItem[]>([]);
  live.current = activity;
  const blocked = blocking(activity, account);

  // Unresolved hashes survive a reload. Restore this account's before saving anything for it, so nothing is lost.
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    restoredFor.current = null;
    if (!account) return;
    const now = Date.now();
    const back = forAccount(readSaved(), tag(account), mezoTestnet.id, now).filter((x) => !live.current.some((t) => t.tx === x.tx));
    if (back.length) setActivity((l) => back.reduce((acc, x) => add(acc, { id: ++seq.current, account, label: x.label, state: "pending", text: "Checking Mezo testnet for this transaction", tx: x.tx, at: x.at, restored: true }), l));
    restoredFor.current = account;
  }, [account]);
  useEffect(() => {
    if (!account || restoredFor.current !== account) return;
    writeSaved(toSave(readSaved(), activity, tag(account), mezoTestnet.id, Date.now(), tag));
  }, [activity, account]);

  // Restored and unknown transactions are looked up again, never resent: every 4 s while pending, every 30 s once unknown.
  const checked = useRef<Record<number, number>>({});
  useEffect(() => {
    const t = setInterval(async () => {
      const now = Date.now();
      const due = mine(live.current, account).filter((x) => unresolved(x) && (x.restored || x.state === "unknown") && now - (checked.current[x.id] ?? 0) >= (x.state === "unknown" ? 30_000 : 4_000));
      for (const x of due) {
        checked.current[x.id] = now;
        const next = reconcile(x, await lookup(x.tx!), Date.now());
        if (!next) continue;
        note(x.id, next);
        if (next.state === "done") { if (next.block && next.block > floor.current) floor.current = next.block; refresh(true); if (d) loadLosses(d).then(setLosses).catch(() => {}); }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [account, refresh, d]); // eslint-disable-line react-hooks/exhaustive-deps
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
      // Nor while an earlier one's outcome is unknown: sending again could duplicate it.
      if (!account || flying.current || blocking(live.current, account).length) return false;
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
      if (!account || flying.current || blocking(live.current, account).length) return false;
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
  const ctx: Ctx = { d: d!, markets, gauge, price, user, account, send, approveIfNeeded, connect, about: () => setAboutOpen(true), losses, lossesFailed, demo, busy: busy || blocked.length > 0, activity: mineAll };
  const wrongChain = !!account && chainId !== null && chainId !== mezoTestnet.id;
  const section = route.page === "market" || route.page === "evidence" ? "markets" : route.page;
  const routeSlug = route.page === "market" || route.page === "cosign" ? route.slug : undefined;
  const routeMarket = routeSlug ? markets.find((m) => m.slug === routeSlug) : undefined;
  // A valid slug whose vault isn't in this deployment is as unknown as a misspelt one.
  const missing = route.page === "notfound" || (!!routeSlug && markets.length > 0 && !routeMarket);
  const marketName = routeMarket?.name ?? "Market";
  const pageName = missing ? "Not found" : { markets: "Markets", market: marketName, cosign: "Co-sign", rewards: "Rewards", portfolio: "Portfolio", evidence: "Recorded evidence", notfound: "Not found" }[route.page];
  const nested = !missing && (route.page === "market" || route.page === "evidence");
  useEffect(() => { document.title = route.page === "markets" ? "Cosign app" : `${pageName} · Cosign`; }, [pageName, route.page]);

  return (
    <div className={`app ${menu ? "menu-open" : ""}`}>
      <a className="skip" href="#app-main">Skip to content</a>
      <aside className="side" aria-label="Cosign app">
        <div className="side-top">
          <Wordmark href={href.markets()} label="Cosign: markets" />
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
              <nav className="crumb" aria-label="Breadcrumb"><a href={href.markets()}>Markets</a><span aria-hidden="true">/</span><span aria-current="page">{pageName}</span></nav>
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

        {(wrongChain || syncing || loadError || !online || blocked.length > 0) && (
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
            {!busy && blocked.length > 0 && (
              <div className="banner is-pending" role="status">
                <span><span className="spin" aria-hidden="true" />{blocked[0].label}: not confirmed yet. New transactions are paused until it is, or until you close its notice after checking the explorer.</span>
                <a className="btn btn-ghost btn-sm" href={txUrl(blocked[0].tx!)} target="_blank" rel="noreferrer">Explorer <ArrowNE size={12} /></a>
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
          {d && missing && <NotFound what={route.page === "notfound" ? route.what : "market"} />}
          {d && !missing && route.page === "evidence" && <Evidence {...ctx} />}
          {d && !missing && route.page !== "evidence" && markets.length === 0 && !loadError && <Loading text="Reading markets from Mezo testnet…" />}
          {d && markets.length > 0 && route.page === "markets" && <Markets {...ctx} />}
          {d && markets.length > 0 && route.page === "market" && routeMarket && <MarketDetail key={route.slug + route.tab} {...ctx} vault={routeMarket.vault} tab={route.tab} />}
          {d && markets.length > 0 && route.page === "cosign" && !missing && <Cosign key={route.slug ?? "all"} {...ctx} vault={routeMarket?.vault} />}
          {d && markets.length > 0 && route.page === "rewards" && <Rewards {...ctx} />}
          {d && markets.length > 0 && route.page === "portfolio" && <Portfolio {...ctx} />}
        </main>
      </div>

      <Toasts items={toasts(activity, account)} busy={busy || blocked.length > 0} onClose={(id) => setActivity((l) => dismiss(l, id))}
        onHold={(h) => { held.current = h; }} />
      <ConnectModal open={walletOpen} onClose={closeWallet} account={account} walletId={walletId} chainId={chainId}
        onConnected={onConnected} onChain={setChainId} onDisconnect={disconnect} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} online={online} loadError={loadError} updated={updated} price={price} />
    </div>
  );
}

/** An address under /app that isn't a page, or names a market this deployment doesn't have. */
function NotFound({ what }: { what: "market" | "page" }) {
  return (
    <div className="empty card card-white" role="alert">
      <h1 className="page-title">{what === "market" ? "Market not found" : "Page not found"}</h1>
      <p>{what === "market" ? "This deployment has two markets, Bold MEZO and Steady MEZO. The link you followed doesn't match either." : "There's no page at this address in the Cosign app."}</p>
      <div className="empty-actions">
        <a className="btn btn-dark" href={href.markets()}>Go to Markets</a>
        <a className="btn btn-ghost" href={href.portfolio()}>Portfolio</a>
      </div>
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
  if (wrongChain) return <button className="net is-bad" onClick={onSwitch} aria-label="Wrong network. Switch to Mezo Testnet"><i aria-hidden="true" /><span className="net-t">Wrong network</span><span className="net-x">: switch</span></button>;
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
  // Publish the stack's height so the page can leave room for it at the bottom.
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = document.documentElement.style;
    const el = box.current;
    if (!el) { root.setProperty("--toast-h", "0px"); return; }
    // Collision handling with the stack kept bottom-right: the sticky action panel is limited to the room above the
    // stack (measured from where the panel actually is, so banners and scroll position count), and a field in use
    // that a new notice would cover is scrolled clear once.
    const fit = () => {
      root.setProperty("--toast-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
      const side = document.querySelector<HTMLElement>(".split-side");
      if (side && getComputedStyle(side).position === "sticky") {
        const room = window.innerHeight - side.getBoundingClientRect().top - el.getBoundingClientRect().height - 40;
        side.style.maxHeight = `${Math.max(180, Math.floor(room))}px`;
      } else if (side) side.style.maxHeight = "";
    };
    const clearFocus = () => {
      const a = document.activeElement as HTMLElement | null;
      if (!a || a === document.body || el.contains(a)) return;
      const r = a.getBoundingClientRect(), t = el.getBoundingClientRect();
      if (r.bottom <= t.top - 8 || r.right <= t.left || r.left >= t.right) return;
      const by = r.bottom - (t.top - 16);
      const panel = a.closest<HTMLElement>(".split-side");
      if (panel && panel.scrollHeight > panel.clientHeight) panel.scrollTop += by; else window.scrollBy({ top: by });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.documentElement.classList.add("has-toasts");
    fit();
    requestAnimationFrame(() => { fit(); clearFocus(); });
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect(); window.removeEventListener("scroll", fit); window.removeEventListener("resize", fit);
      root.setProperty("--toast-h", "0px"); document.documentElement.classList.remove("has-toasts");
      const side = document.querySelector<HTMLElement>(".split-side"); if (side) side.style.maxHeight = "";
    };
  }, [shown.length > 0 || leaving.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown.length && !leaving.length) return null;
  return (
    <div className="toasts" ref={box} aria-live="polite" onMouseEnter={() => onHold(true)} onMouseLeave={() => onHold(false)}
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
        {price > 0n && <div><dt>MEZO price</dt><dd className="num">{fmt(price / WAD, 2)} MUSD · team-set demo price</dd></div>}
      </dl>
      <h3 className="wm-sub">Risks</h3>
      <ul className="wm-risks">
        <li><b>Cover is first-loss.</b> It pays for bad debt before lenders and can be lost in full.</li>
        <li><b>Lenders can lose money</b> when a loss is larger than the cover in front of them.</li>
        <li><b>Borrowers can be liquidated</b> when their loan-to-value reaches the market's limit.</li>
        <li><b>The MEZO price is a demo price</b> the Cosign team sets{price > 0n ? ` (${fmt(price / WAD, 2)} MUSD)` : ""}; it is not a market price, so borrow limits are illustrative.</li>
        <li><b>MEZO rewards are funded by participants</b> through the gauge. They aren't protocol emissions and aren't guaranteed.</li>
      </ul>
      <div className="wm-links">
        <a className="link" href={href.evidence()} onClick={onClose}>Recorded evidence</a>
        <a className="link" href="https://github.com/bunnyyxtan/cosign/blob/main/docs/PRODUCT.md" target="_blank" rel="noreferrer">How Cosign works <ArrowNE size={12} /></a>
        <a className="link" href="/">Website</a>
      </div>
    </Sheet>
  );
}
