// The recorded Mezo testnet demonstration (contracts/deployments/demo-run.json), as shown on the website.
// Historical and immutable: these are not live values. scripts/sync.mjs fails the build if a hash here
// is missing from demo-run.json.

export const EXPLORER = "https://explorer.test.mezo.org";
export const tx = (h: string) => `${EXPLORER}/tx/${h}`;
export const REPO = "https://github.com/bunnyyxtan/cosign";
export const EVIDENCE = `${REPO}/blob/main/docs/TESTNET_EVIDENCE.md`;

export type Stage = {
  key: string;
  label: string;
  title: string;
  body: string;
  cover: number;      // junior cover, MUSD
  senior: number;     // senior booked principal, MUSD
  lost: number;       // cumulative loss charged to cover, MUSD
  block: number;
  hash: string;
  oracle?: boolean;   // a demo-oracle step, controlled by the Cosign team
};

export const STAGES: Stage[] = [
  {
    key: "posted", label: "Cover posted", title: "Cover sits in front of lenders.",
    body: "Co-signers post 400 MUSD of cover on Bold MEZO. A lender deposits 1,000 MUSD behind it.",
    cover: 400, senior: 1000, lost: 0, block: 16263342,
    hash: "0x8f35b478c230e382394dad815798ea18a737af716619e600485227b6707b8328",
  },
  {
    key: "shock", label: "Price shock", title: "The collateral price falls 70%.",
    body: "The demo oracle moves MEZO from 10.00 to 3.00 MUSD. A 500 MUSD loan is now under water.",
    cover: 400, senior: 1000, lost: 0, block: 16263358, oracle: true,
    hash: "0x83caa79b9bcf4091663c0297bd3bcf0888abd3ead42a64eaa2bda1c4abe4217e",
  },
  {
    key: "liquidation", label: "Liquidation", title: "Morpho realises bad debt.",
    body: "A liquidator seizes all collateral directly on Morpho Blue. 300.50 MUSD of the loan is left unpaid.",
    cover: 400, senior: 1000, lost: 0, block: 16263362,
    hash: "0x1b71eae77951915978ab1c6d141ab411303106fdae58ed7aceae2a3287b13f59",
  },
  {
    key: "absorbed", label: "Cover pays first", title: "Cover absorbs the whole loss.",
    body: "Cosign syncs and charges 300.50 MUSD to cover. Lenders' last-booked 1,000 MUSD is unchanged.",
    cover: 99.5, senior: 1000, lost: 300.5, block: 16263365,
    hash: "0x214aaa56492884f6031638d438959fdc14a805f16db883f1259651fe79a0a3ba",
  },
  {
    key: "second", label: "Second loss", title: "A second loss, through Cosign's liquidator.",
    body: "CosignLiquidator books lenders' interest first, then liquidates. Cover pays 60.10 MUSD more.",
    cover: 39.4, senior: 1000.000053, lost: 360.6, block: 16263635,
    hash: "0x9e3b672c54374dd316e5ef90785442335474b41b7b1ced1a7b21165e3bb4ccba",
  },
];

/** The 400 + 1,000 MUSD the recorded market started with: the fixed scale for every replay frame. */
export const SCALE = 1400;
export const FORGONE = "0.000004";

export const CHECKS = { total: 58, passed: 52 };
export const REWARDS = { funded: 8, claimed: 7.999999997, epoch: 14 };
