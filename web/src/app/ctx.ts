import type { Address, Hex } from "viem";
import type { DemoRun, Deployment, GaugeState, LossEvent, MarketState, UserState, walletClient } from "../chain";
import type { Next, TxItem } from "./activity";

export type { Next };

export type Ctx = {
  d: Deployment;
  markets: MarketState[];
  gauge: GaugeState | null;
  price: bigint;
  user: UserState | null;
  account: Address | null;
  /** Sends one transaction and tracks it to a receipt. Resolves to its activity id once confirmed, else false.
   *  Refuses while another transaction is in flight, whatever the buttons show. */
  send: (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>) => Promise<number | false>;
  /** True when the allowance already covers `amount`. After an approval it returns false: the action is a second, deliberate step. */
  approveIfNeeded: (token: Address, spender: Address, amount: bigint, label: string, next: Next) => Promise<boolean>;
  connect: () => void;
  /** Opens the testnet, network and risk details. */
  about: () => void;
  /** Recognised losses from LossAbsorbed events; null until the scan has finished. */
  losses: LossEvent[] | null;
  lossesFailed: boolean;
  demo: DemoRun | null;
  busy: boolean;
  /** This session's transactions for the connected account, newest first. */
  activity: TxItem[];
};
