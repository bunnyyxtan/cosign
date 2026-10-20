"""Recover test funds from the v1 Cosign deployment before v2 is deployed.

Usage (from contracts/):  python -I script/migrate_v1.py exit-a      lenders out, borrower repays, cover exit requested
                          python -I script/migrate_v1.py exit-b      after the notice period: cover out, funds to deployer
Transactions are logged to deployments/migration-v1.json. Reads v1 addresses from deployments/31611-v1.json.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demo  # noqa: E402  (reuses its send / call / receipt helpers)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = json.load(open(os.path.join(ROOT, "deployments", "31611-v1.json")))
demo.D = V1
demo.RUN_PATH = os.path.join(ROOT, "deployments", "migration-v1.json")
demo.run = json.load(open(demo.RUN_PATH)) if os.path.exists(demo.RUN_PATH) else {"steps": [], "checks": []}
num, send, addr, MP, mp, position = demo.num, demo.send, demo.addr, demo.MP, demo.mp, demo.position
VAULTS = (("Bold", V1["vaultBold"]), ("Steady", V1["vaultSteady"]))


def exit_a():
    for name, v in VAULTS:
        sh = num(v, "seniorShares(address)(uint256)", addr("LENDER"))
        if sh:
            send(f"v1: lender withdraws all senior ({name})", "LENDER", v, "withdrawSenior(uint256)", sh)
        for who in ("LENDER", "COSIGNER"):
            if num(v, "pendingRewards(address)(uint256)", addr(who)):
                send(f"v1: {who.lower()} claims MEZO ({name})", who, v, "claimRewards()")
        _, bshares, coll = position(v, "BORROWER")
        if bshares:
            send("v1: borrower approves MUSD for Morpho", "BORROWER", V1["musd"], "approve(address,uint256)", V1["morpho"], 10**24)
            send(f"v1: borrower repays all debt ({name})", "BORROWER", V1["morpho"], f"repay({MP},uint256,uint256,address,bytes)", mp(v), 0, bshares, addr("BORROWER"), "0x")
        if coll:
            send(f"v1: borrower withdraws MEZO collateral ({name})", "BORROWER", V1["morpho"], f"withdrawCollateral({MP},uint256,address,address)", mp(v), coll, addr("BORROWER"), addr("BORROWER"))
    tid = 390
    if any(num(V1["gauge"], "tokenVotes(uint256,address)(uint256)", tid, v) for _, v in VAULTS):
        send("v1: co-signer removes veBTC votes", "COSIGNER", V1["gauge"], "reset(uint256)", tid)
    for name, v in VAULTS:
        sh = num(v, "juniorSharesOf(address)(uint256)", addr("COSIGNER"))
        if sh:
            send(f"v1: co-signer requests to withdraw all cover ({name})", "COSIGNER", v, "requestJuniorWithdraw(uint256)", sh)


def exit_b():
    for name, v in VAULTS:
        if num(v, "juniorSharesOf(address)(uint256)", addr("COSIGNER")):
            send(f"v1: co-signer withdraws cover ({name})", "COSIGNER", v, "withdrawJunior()")
    for who in ("LENDER", "COSIGNER", "BORROWER"):
        musd = demo.balance(V1["musd"], who)
        if musd:
            send(f"Return {who.lower()} MUSD to deployer for v2", who, V1["musd"], "transfer(address,uint256)", addr("DEPLOYER"), musd)
        mezo = demo.balance(V1["mezo"], who)
        if mezo > 10**15:
            send(f"Return {who.lower()} MEZO to deployer for v2", who, V1["mezo"], "transfer(address,uint256)", addr("DEPLOYER"), mezo)
    print("deployer now holds", demo.fmt(demo.balance(V1["musd"], "DEPLOYER")), "MUSD and", demo.fmt(demo.balance(V1["mezo"], "DEPLOYER")), "MEZO")


def exit_dust():
    """v1 bug workaround: 1 wei of senior dust with zero shares blocks a full cover exit (Undercovered),
    so request all but 1e9 shares (well under 1e-12 MUSD) and leave that dust behind."""
    for name, v in VAULTS:
        sh = num(v, "juniorSharesOf(address)(uint256)", addr("COSIGNER"))
        if sh > 10**9:
            send(f"v1: co-signer requests all cover but dust ({name})", "COSIGNER", v, "requestJuniorWithdraw(uint256)", sh - 10**9)


if __name__ == "__main__":
    {"exit-a": exit_a, "exit-b": exit_b, "exit-dust": exit_dust}[sys.argv[1]]()
