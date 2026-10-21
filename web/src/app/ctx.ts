import type { Address, Hex } from "viem";
import type { DemoRun, Deployment, GaugeState, LossEvent, MarketState, UserState, walletClient } from "../chain";

/** The action an approval unlocks, offered as its own button once the approval confirms. */
export type Next = { ready: string; label: string; run: () => void };

export type Ctx = {
  d: Deployment;
  markets: MarketState[];
  gauge: GaugeState | null;
  price: bigint;
  user: UserState | null;
  account: Address | null;
  send: (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>) => Promise<boolean>;
  /** True when the allowance already covers `amount`. After an approval it returns false: the action is a second, deliberate step. */
  approveIfNeeded: (token: Address, spender: Address, amount: bigint, label: string, next: Next) => Promise<boolean>;
  connect: () => void;
  /** Recognised losses from LossAbsorbed events; null until the scan has finished. */
  losses: LossEvent[] | null;
  lossesFailed: boolean;
  demo: DemoRun | null;
  busy: boolean;
};
