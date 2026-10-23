import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { Address } from "viem";
import { addrUrl, ensureChain, mezoTestnet, requestAccount, selectProvider, walletChainId } from "../chain";
import { ArrowE, ArrowNE, Check, Close, Copy } from "../ui/Icon";
import { KNOWN, knownFor, onWallets, savedWallet, wallets, type Known, type Wallet } from "../wallets";
import { Sheet, useLeaving } from "./Modal";
import { short } from "./ui";

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
  return (x.shortMessage ?? x.message ?? "The wallet did not respond.").split(/\r?\n/)[0].slice(0, 200);
};

export function ConnectModal(p: Props) {
  const { shown, leaving } = useLeaving(p.open);
  return shown ? <Dialog {...p} leaving={leaving} /> : null;
}

function Dialog({ onClose, account, walletId, chainId, onConnected, onChain, onDisconnect, leaving }: Props & { leaving: boolean }) {
  const list = useSyncExternalStore(onWallets, wallets);
  const [step, setStep] = useState<Step>(account ? "account" : "choose");
  const [wallet, setWallet] = useState<Wallet | null>(() => list.find((w) => w.id === walletId) ?? null);
  const [error, setError] = useState("");
  const run = useRef(0);
  const last = savedWallet();
  const name = wallet?.name ?? "your wallet";

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
  const switchNow = async () => { const my = ++run.current; await toNetwork(my); };

  // Arrow keys move between wallet options.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const opts = [...document.querySelectorAll<HTMLElement>(".wm [data-opt]")];
    const i = opts.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    opts[(i + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length].focus();
  };

  const known = KNOWN.map((k) => ({ k, w: list.find((w) => knownFor(w) === k) }));
  const others = list.filter((w) => !knownFor(w));

  const title: Record<Step, string> = {
    choose: "Connect wallet",
    authorize: `Approve in ${name}`,
    network: "Switch to Mezo Testnet",
    wrongnet: "Wrong network",
    done: "Connected",
    rejected: "Request declined",
    pending: `${name} has a request open`,
    failed: `Couldn't connect ${name}`,
    account: "Account",
  };

  return (
    <Sheet title={title[step]} onClose={onClose} leaving={leaving} describedBy="wm-desc" focusKey={step} onKeyDown={onKey} size="sm">
      <div className="wm-step" key={step} aria-live="polite">
        {step === "choose" && (
          <>
            {!list.length && <p id="wm-desc" className="wm-lede">No wallet extension found in this browser. Install one, then reload.</p>}
            <ul className="wm-list" aria-describedby={list.length ? "wm-desc" : undefined}>
              {known.map(({ k, w }) => (
                <li key={k.id}>{w ? <Option w={w} last={last === w.id} first={k.id === "io.rabby"} onPick={start} /> : <Missing k={k} />}</li>
              ))}
              {others.map((w) => <li key={w.id}><Option w={w} last={last === w.id} onPick={start} /></li>)}
            </ul>
            {!list.length && <button className="btn btn-ghost btn-block wm-reload" onClick={() => window.location.reload()} data-autofocus>Reload after installing</button>}
            <p id={list.length ? "wm-desc" : undefined} className="wm-note">Mezo Testnet only. Cosign never asks for your recovery phrase.</p>
          </>
        )}

        {(step === "authorize" || step === "network") && wallet && (
          <div className="wm-state">
            <span className="wm-wait"><WalletIcon w={wallet} size={44} /></span>
            <p id="wm-desc" className="wm-lede">
              {step === "authorize"
                ? `Approve the connection in ${wallet.name}.`
                : `Approve the network change in ${wallet.name}. It may ask to add Mezo Testnet (chain 31611).`}
            </p>
            <p className="wm-hint">Don't see it? Open {wallet.name} from the browser toolbar.</p>
            <div className="wm-actions"><button className="btn btn-ghost btn-sm" onClick={back}>Back</button></div>
          </div>
        )}

        {step === "wrongnet" && wallet && (
          <div className="wm-state">
            <span className="wm-badge is-warn" aria-hidden="true">!</span>
            <p id="wm-desc" className="wm-lede">
              Connected, but {wallet.name} is on another network. Cosign works only on Mezo Testnet.
              {error && <span className="wm-err">{error}</span>}
            </p>
            <div className="wm-actions">
              <button className="btn btn-dark" onClick={switchNow} data-autofocus>Switch to Mezo Testnet</button>
              <button className="btn btn-ghost" onClick={onClose}>Not now</button>
            </div>
          </div>
        )}

        {step === "done" && account && (
          <div className="wm-state">
            <span className="wm-badge is-ok" aria-hidden="true"><Check size={22} /></span>
            <p id="wm-desc" className="wm-lede">{wallet ? wallet.name : "Your wallet"} connected as <span className="num">{short(account)}</span>.</p>
            <div className="wm-actions"><button className="btn btn-dark" onClick={onClose} data-autofocus>Done</button></div>
          </div>
        )}

        {(step === "rejected" || step === "pending" || step === "failed") && (
          <div className="wm-state">
            <span className={`wm-badge ${step === "pending" ? "is-warn" : "is-bad"}`} aria-hidden="true">{step === "pending" ? "!" : <Close size={20} />}</span>
            <p id="wm-desc" className="wm-lede" role="alert">
              {step === "rejected" && `You declined in ${name}. Nothing was shared.`}
              {step === "pending" && `Open ${name} from the browser toolbar to finish or cancel the earlier request, then try again.`}
              {step === "failed" && <>{name} didn't complete the connection. Nothing was shared.{error && <span className="wm-err">{error}</span>}</>}
            </p>
            <div className="wm-actions">
              <button className="btn btn-dark" onClick={() => wallet && start(wallet)} data-autofocus>Try again</button>
              <button className="btn btn-ghost" onClick={back}>Other wallet</button>
            </div>
          </div>
        )}

        {step === "account" && account && (
          <AccountView account={account} wallet={wallet} onMezo={chainId === mezoTestnet.id}
            onSwitch={async () => { try { await ensureChain(); onChain(await walletChainId()); } catch { /* the banner stays */ } }}
            onDisconnect={() => { onDisconnect(); onClose(); }} />
        )}
      </div>
    </Sheet>
  );
}

function AccountView({ account, wallet, onMezo, onSwitch, onDisconnect }: {
  account: Address; wallet: Wallet | null; onMezo: boolean; onSwitch: () => void; onDisconnect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const copy = () => navigator.clipboard?.writeText(account).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  return (
    <>
      <div className="wm-acct" id="wm-desc">
        {wallet ? <WalletIcon w={wallet} size={40} /> : <span className="wm-icon is-mono" style={{ width: 40, height: 40 }} aria-hidden="true">W</span>}
        <div className="wm-acct-main">
          <span className="wm-acct-name">{wallet?.name ?? "Browser wallet"}</span>
          <button className="wm-addr num" onClick={() => setFull(!full)} aria-expanded={full} aria-label={full ? "Hide full address" : `Address ${short(account)}. Show full address`}>
            {short(account)}
          </button>
        </div>
        <div className="wm-acct-tools">
          <button className="icon-btn" onClick={copy} aria-label={copied ? "Address copied" : "Copy address"} title={copied ? "Copied" : "Copy address"}>{copied ? <Check /> : <Copy />}</button>
          <a className="icon-btn" href={addrUrl(account)} target="_blank" rel="noreferrer" aria-label="View address in the explorer" title="View in explorer"><ArrowNE /></a>
        </div>
      </div>
      {full && <p className="wm-full num" aria-label="Full address">{account}</p>}
      <div className={`wm-net ${onMezo ? "is-ok" : "is-bad"}`}>
        <i aria-hidden="true" /><span>{onMezo ? "Mezo Testnet" : "Another network"}</span>
        {!onMezo && <button className="btn btn-dark btn-sm" onClick={onSwitch}>Switch</button>}
        {copied && <span className="wm-copied" role="status">Address copied</span>}
      </div>
      <button className="btn btn-ghost btn-block wm-disconnect" onClick={onDisconnect}>Disconnect</button>
    </>
  );
}

function Option({ w, last, first, onPick }: { w: Wallet; last: boolean; first?: boolean; onPick: (w: Wallet) => void }) {
  return (
    <button className="wm-opt" onClick={() => onPick(w)} data-opt data-autofocus={first || undefined}>
      <WalletIcon w={w} size={36} />
      <span className="wm-opt-text"><b>{w.name}</b></span>
      <span className="wm-tag">{last ? "Last used" : "Installed"}</span>
      <ArrowE size={16} className="wm-go" />
    </button>
  );
}

function Missing({ k }: { k: Known }) {
  return (
    <div className="wm-opt is-missing">
      <span className="wm-icon is-mono" style={{ width: 36, height: 36 }} aria-hidden="true">{k.name[0]}</span>
      <span className="wm-opt-text"><b>{k.name}</b></span>
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
