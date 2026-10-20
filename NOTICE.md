# Third-party notices

Cosign's own source is MIT licensed (see `LICENSE`). It depends on the following, each under its own licence.

## Contracts (git submodules in `contracts/lib`)

| Component | Version | Licence |
|---|---|---|
| [Morpho Blue](https://github.com/morpho-org/morpho-blue) | commit `9cf6d5b` | GPL-2.0-or-later |
| [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) | v5.1.0 | MIT |
| [forge-std](https://github.com/foundry-rs/forge-std) | v1.17.0 plus 4 commits (`b013eff`) | MIT or Apache-2.0 |

### Note on Morpho Blue

The Morpho Blue instance that Cosign markets run on is built from Morpho's unmodified source and is a separate deployed contract. Cosign's contracts call it through its public interface.

`CosignVault` and `CosignLiquidator` also import Morpho interfaces and `MarketParamsLib` / `MorphoBalancesLib`, which are licensed GPL-2.0-or-later. Whether compiling Cosign against those libraries makes the combined deployed bytecode a GPL-2.0-or-later work is a legal question this project has not resolved. Obtain legal advice before any commercial or mainnet use. This is a known open item.

## Web app (production dependencies)

React, React DOM, viem and their transitive dependencies are MIT, ISC, Apache-2.0 or BSD licensed. `npm audit --omit=dev` reports no known vulnerabilities at the time of writing. The lockfile (`web/package-lock.json`) pins exact versions; use `npm ci`.

## Reference material

Mezo's MUSD, MEZO and veBTC contracts are not redistributed here; the repository records their testnet addresses only.
