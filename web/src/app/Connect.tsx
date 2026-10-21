import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { Address } from "viem";
import { addrUrl, ensureChain, mezoTestnet, requestAccount, selectProvider, walletChainId } from "../chain";
import { ArrowE, ArrowNE, Check, Close } from "../ui/Icon";
import { KNOWN, knownFor, onWallets, savedWallet, wallets, type Known, type Wallet } from "../wallets";
import { short } from "./ui";
import "./connect.css";

type Step = "choose" | "authorize" | "network" | "wrongnet" | "done" | "rejected" | "pending" | "failed" | "account";

type Props = {
  open: boolean;
  onClose: () => void;
  account: Address | null;
  walletId: string | null;
  chainId: number | null;
  /** Called only after the wallet itself has authorised the account. */
  onConnected: (w: Wallet, account: Address) => void;
  onChain: (id: number | null) => void;
  onDisconnect: () => void;
};

const errCode = (e: unknown) => {
  const x = e as { code?: number; cause?: { code?: number } };
  return x.code ?? x.cause?.code;
};
const errText = (e: unknown) => {
  const x = e as { shortMessage?: string; message?: string };
  return (x.shortMessage ?? x.message ?? "The wallet did not respond.").split(/\r?\n/)[0];
};

export function ConnectModal(p: Props) {
  // Stay mounted briefly after closing so the exit animation can play.
  const [shown, setShown] = useState(p.open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (p.open) { setShown(true); setLeaving(false); return; }
    if (!shown) return;
    setLeaving(true);
    const t = setTimeout(() => { setShown(false); setLeaving(false); }, 200);
    return () => clearTimeout(t);
  }, [p.open]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown ? <Dialog {...p} leaving={leaving} /> : null;
}

function Dialog({ onClose, account, walletId, chainId, onConnected, onChain, onDisconnect, leaving }: Props & { leaving: boolean }) {
  const list = useSyncExternalStore(onWallets, wallets);
  const [step, setStep] = useState<Step>(account ? "account" : "choose");
  const [wallet, setWallet] = useState<Wallet | null>(() => list.find((w) => w.id === walletId) ?? null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const run = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(document.activeElement);
  const last = savedWallet();
  const name = wallet?.name ?? "your wallet";

  // Focus the step's main control on every step change; give focus back to the opener on close.
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>("button, a[href]");
    el?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    const o = opener.current;
    return () => { document.documentElement.classList.remove("modal-open"); (o as HTMLElement | null)?.focus?.({ preventScroll: true }); };
  }, []);
  // Success closes itself after a moment; the account is already shown in the header.
  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [step, onClose]);

  const toNetwork = async (my: number) => {
    const id = await walletChainId().catch(() => null);
    onChain(id);
    if (my !== run.current) return;
    if (id === mezoTestnet.id) return setStep("done");
    setStep("network");
    try {
      await ensureChain();
      onChain(await walletChainId());
      if (my === run.current) setStep("done");
    } catch (e) {
      if (my !== run.current) return;
      // A declined switch needs no second explanation; anything else is shown as the wallet worded it.
      setError(errCode(e) === 4001 || /declined/i.test(errText(e)) ? "" : errText(e));
      setStep("wrongnet");
    }
  };

  const start = async (w: Wallet) => {
    const my = ++run.current;
    setWallet(w);
    setError("");
    setStep("authorize");
    selectProvider(w.provider);
    try {
      const a = await requestAccount();
      // A newer attempt (the user went back and picked another wallet) wins over a late answer from this one.
      if (my !== run.current) return;
      onConnected(w, a);
      await toNetwork(my);
    } catch (e) {
      if (my !== run.current) return;
      const code = errCode(e);
      if (code === 4001) setStep("rejected");
      else if (code === -32002) setStep("pending");
      else { setError(errText(e)); setStep("failed"); }
    }
  };

  const back = () => { run.current++; setError(""); setStep("choose"); };
  const switchNow = async () => { const my = ++run.current; setWallet((w) => w); await toNetwork(my); };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    const all = [...(box.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])];
    if (e.key === "Tab" && all.length) {
      const i = all.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); all[all.length - 1].focus(); }
      else if (!e.shiftKey && i === all.length - 1) { e.preventDefault(); all[0].focus(); }
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const opts = [...(box.current?.querySelectorAll<HTMLElement>("[data-opt]") ?? [])];
      const i = opts.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      opts[(i + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length].focus();
    }
  };

  const known = KNOWN.map((k) => ({ k, w: list.find((w) => knownFor(w) === k) }));
  const others = list.filter((w) => !knownFor(w));
  const onMezo = chainId === mezoTestnet.id;

  const title: Record<Step, string> = {
    choose: "Connect a wallet",
    authorize: `Approve in ${name}`,
    network: "Switch to Mezo testnet",
    wrongnet: "Your wallet is on another network",
    done: "Wallet connected",
    rejected: "Request declined",
    pending: `${name} already has a request open`,
    failed: `Couldn't connect to ${name}`,
    account: "Your wallet",
  };

  return (
    <div className={`wm-root${leaving ? " is-leaving" : ""}`} onKeyDown={onKey}>
      <div className="wm-scrim" onClick={onClose} aria-hidden="true" />
      <div className="wm" ref={box} role="dialog" aria-modal="true" aria-labelledby="wm-title" aria-describedby="wm-desc">
        <header className="wm-head">
          <h2 id="wm-title" className="wm-title">{title[step]}</h2>
          <button className="icon-btn wm-close" onClick={onClose} aria-label="Close"><Close /></button>
        </header>

        <div className="wm-step" key={step} aria-live="polite">
          {step === "choose" && (
            <>
              <p id="wm-desc" className="wm-lede">
                {list.length ? "Choose the wallet to use with Cosign. It will ask you to approve the connection." : "No wallet extension was found in this browser. Install one, then reload this page."}
              </p>
              <span className="eyebrow wm-k">Recommended</span>
              <ul className="wm-list">
                {known.map(({ k, w }) => (
                  <li key={k.id}>{w ? <Option w={w} known={k} last={last === w.id} onPick={start} /> : <Missing k={k} />}</li>
                ))}
              </ul>
              {others.length > 0 && (
                <>
                  <span className="eyebrow wm-k">Other wallets in this browser</span>
                  <ul className="wm-list">{others.map((w) => <li key={w.id}><Option w={w} last={last === w.id} onPick={start} /></li>)}</ul>
                </>
              )}
              {!list.length && <button className="btn btn-ghost btn-block wm-reload" onClick={() => window.location.reload()} data-autofocus>Reload after installing</button>}
            </>
          )}

          {(step === "authorize" || step === "network") && wallet && (
            <div className="wm-state">
              <span className="wm-wait"><WalletIcon w={wallet} size={48} /></span>
              <p id="wm-desc" className="wm-lede">
                {step === "authorize"
                  ? `${wallet.name} has opened a connection request. Approve it there to share your address with Cosign.`
                  : `Approve the network change in ${wallet.name}. If it doesn't know Mezo testnet yet, it will ask to add it: chain ID 31611, currency BTC.`}
              </p>
              <Progress at={step === "authorize" ? 0 : 1} />
              <p className="wm-hint">Don't see it? Open {wallet.name} from your browser's toolbar.</p>
              <div className="wm-actions"><button className="btn btn-ghost" onClick={back}>Back</button></div>
            </div>
          )}

          {step === "wrongnet" && wallet && (
            <div className="wm-state">
              <span className="wm-badge is-warn" aria-hidden="true">!</span>
              <p id="wm-desc" className="wm-lede">
                Your address is connected, but the wallet is on another network. Cosign works only on Mezo testnet and will ask to switch before any transaction.
                {error && <span className="wm-err">{error}</span>}
              </p>
              <Progress at={1} />
              <div className="wm-actions">
                <button className="btn btn-dark" onClick={switchNow} data-autofocus>Switch to Mezo testnet</button>
                <button className="btn btn-ghost" onClick={onClose}>Not now</button>
              </div>
            </div>
          )}

          {step === "done" && account && (
            <div className="wm-state">
              <span className="wm-badge is-ok" aria-hidden="true"><Check size={22} /></span>
              <p id="wm-desc" className="wm-lede">{wallet ? `${wallet.name} confirmed the connection.` : "Your wallet confirmed the connection."}</p>
              <div className="wm-who">
                {wallet && <WalletIcon w={wallet} size={28} />}
                <span className="num">{short(account)}</span>
                <span className="chip chip-live">Mezo testnet</span>
              </div>
              <Progress at={3} />
              <div className="wm-actions"><button className="btn btn-dark" onClick={onClose} data-autofocus>Done</button></div>
            </div>
          )}

          {(step === "rejected" || step === "pending" || step === "failed") && (
            <div className="wm-state">
              <span className={`wm-badge ${step === "pending" ? "is-warn" : "is-bad"}`} aria-hidden="true">{step === "pending" ? "!" : <Close size={20} />}</span>
              <p id="wm-desc" className="wm-lede" role="alert">
                {step === "rejected" && `You declined the request in ${name}. Nothing was shared with Cosign.`}
                {step === "pending" && `Open ${name} from your browser's toolbar to finish or cancel the earlier request, then try again.`}
                {step === "failed" && <>{name} didn't complete the connection. Nothing was shared with Cosign.<span className="wm-err">{error}</span></>}
              </p>
              <div className="wm-actions">
                <button className="btn btn-dark" onClick={() => wallet && start(wallet)} data-autofocus>Try again</button>
                <button className="btn btn-ghost" onClick={back}>Choose another wallet</button>
              </div>
            </div>
          )}

          {step === "account" && account && (
            <>
              <p id="wm-desc" className="wm-lede">Connected to Cosign. Your wallet signs every transaction; Cosign never holds your keys.</p>
              <dl className="wm-facts">
                <div><dt>Wallet</dt><dd>{wallet ? <><WalletIcon w={wallet} size={24} />{wallet.name}</> : "Browser wallet"}</dd></div>
                <div><dt>Address</dt><dd className="num wm-addr" aria-label={account}>{account.slice(2).match(/.{1,4}/g)!.map((g, i) => <span key={i}>{i === 0 ? "0x" + g : g}</span>)}</dd></div>
                <div><dt>Network</dt><dd>{onMezo ? <span className="chip chip-live">Mezo testnet · 31611</span> : <span className="chip chip-loss">Another network</span>}</dd></div>
              </dl>
              <div className="wm-actions wm-actions-row">
                {!onMezo && <button className="btn btn-dark btn-sm" onClick={async () => { try { await ensureChain(); onChain(await walletChainId()); } catch { /* the banner stays */ } }}>Switch to Mezo testnet</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(account).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}>
                  {copied ? "Copied" : "Copy address"}
                </button>
                <a className="btn btn-ghost btn-sm" href={addrUrl(account)} target="_blank" rel="noreferrer">Explorer <ArrowNE size={12} /></a>
                <button className="btn btn-ghost btn-sm wm-disconnect" onClick={() => { onDisconnect(); onClose(); }}>Disconnect</button>
              </div>
            </>
          )}
        </div>

        <footer className="wm-foot">Cosign will never ask for your recovery phrase or private key. Testnet only: use a test account.</footer>
      </div>
    </div>
  );
}

function Option({ w, known, last, onPick }: { w: Wallet; known?: Known; last: boolean; onPick: (w: Wallet) => void }) {
  return (
    <button className="wm-opt" onClick={() => onPick(w)} data-opt data-autofocus={known?.id === "io.rabby" || undefined}>
      <WalletIcon w={w} size={40} />
      <span className="wm-opt-text">
        <b>{w.name}{known?.id === "io.rabby" && <span className="wm-tag">Preferred</span>}</b>
        <span>{last ? "Last used · detected in this browser" : "Detected in this browser"}</span>
      </span>
      <ArrowE size={16} className="wm-go" />
    </button>
  );
}

function Missing({ k }: { k: Known }) {
  return (
    <div className="wm-opt is-missing">
      <span className="wm-icon is-mono" style={{ width: 40, height: 40 }} aria-hidden="true">{k.name[0]}</span>
      <span className="wm-opt-text">
        <b>{k.name}</b>
        <span>Not installed in this browser</span>
      </span>
      <a className="btn btn-ghost btn-sm" href={k.install} target="_blank" rel="noreferrer" aria-label={`Install ${k.name} (opens the official site)`}>Install <ArrowNE size={12} /></a>
    </div>
  );
}

/** The wallet's own EIP-6963 icon when it supplies one; otherwise a plain monogram, never a recreated logo. */
function WalletIcon({ w, size }: { w: Wallet; size: number }) {
  return w.icon
    ? <img className="wm-icon" src={w.icon} width={size} height={size} alt="" />
    : <span className="wm-icon is-mono" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">{w.name[0]}</span>;
}

function Progress({ at }: { at: number }) {
  const steps = ["Approve", "Network", "Connected"];
  return (
    <ol className="wm-progress" aria-label="Connection progress">
      {steps.map((s, i) => <li key={s} className={i < at ? "done" : i === at ? "on" : ""} aria-current={i === at ? "step" : undefined}>{s}</li>)}
    </ol>
  );
}
