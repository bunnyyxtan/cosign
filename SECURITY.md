# Security policy

Cosign is an **unaudited prototype** that runs on Mezo testnet only. It has not been deployed to mainnet and must not be used with real funds.

## Reporting a vulnerability

Please report privately, not in a public issue.

Use GitHub's private reporting: **Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it (a Foundry test is ideal), and the contract and commit it applies to. You will get an acknowledgement as soon as a maintainer can respond; there is no bounty programme.

## Scope

In scope: the contracts in `contracts/src` and the app in `web/`.

Out of scope: the vendored Morpho Blue, OpenZeppelin and Mezo contracts (report those upstream), and the demo oracle's single-owner trust model, which is documented and intentional for testnet.

## Known limitations

Documented in the README under *Security and limitations* and in `docs/TESTNET_REPORT.md`. These are not new findings:

- Direct Morpho liquidations can net unbooked interest against a loss.
- The vault deposit limit is not a borrowing limit on the Morpho market.
- Cover whose notice period has ended can leave before a loss is booked.
- Losses beyond available cover fall on lenders still in the vault.

## Secrets

Never commit private keys. `.env` is git-ignored; `.env.example` lists the variables used by the demo scripts, all of which are testnet-only.
