import type { Address, Hex } from "viem";
import type { DemoRun, Deployment, GaugeState, LossEvent, MarketState, UserState, walletClient } from "../chain";

export type Ctx = {
  d: Deployment;
  markets: MarketState[];
  gauge: GaugeState | null;
  price: bigint;
  user: UserState | null;
  account: Address | null;
  send: (label: string, write: (w: ReturnType<typeof walletClient>) => Promise<Hex>) => Promise<boolean>;
  approveIfNeeded: (token: Address, spender: Address, amount: bigint, label: string) => Promise<boolean>;
  connect: () => void;
  /** Recognised losses from LossAbsorbed events; null until the scan has finished. */
  losses: LossEvent[] | null;
  lossesFailed: boolean;
  demo: DemoRun | null;
  busy: boolean;
};
