"""Check deployments/31611.json against on-chain state. Exits non-zero on any mismatch.

Usage (from contracts/):  python -I script/verify_deploy.py
Added after a partial v2 broadcast showed that the deploy script records planned addresses even when a broadcast
stops early; this script is the source of truth that the recorded deployment really exists and is wired correctly.
"""
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAST = os.path.join(ROOT, "..", ".tools", "foundry", "cast.exe")
RPC = "https://rpc.test.mezo.org"
D = json.load(open(os.path.join(ROOT, "deployments", "31611.json")))
results = []


def cast(*a):
    for _ in range(5):
        o = subprocess.run([CAST, *map(str, a), "--rpc-url", RPC], capture_output=True, text=True)
        if o.returncode == 0:
            out = o.stdout.strip()
            return out[1:-1] if out.startswith('"') else out.split(" ")[0]
        time.sleep(2)
    return "ERR"


def eq(name, got, want):
    ok = str(got).lower() == str(want).lower()
    results.append({"check": name, "pass": ok, "got": str(got), "want": str(want)})
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {got}" + ("" if ok else f" (want {want})"))


ADMIN = D["admin"]
for k in ("morpho", "oracle", "gauge", "vaultBold", "vaultSteady", "irmBold", "irmSteady", "liquidator"):
    eq(f"{k} has code", int(cast("codesize", D[k]) or 0) > 0, True)

eq("Morpho owner is the deployer", cast("call", D["morpho"], "owner()(address)"), ADMIN)
eq("Demo oracle owner is the deployer", cast("call", D["oracle"], "owner()(address)"), ADMIN)
eq("Demo oracle price is 10 MUSD/MEZO", cast("call", D["oracle"], "price()(uint256)"), 10 * 10**36)
eq("Gauge reads Mezo testnet veBTC", cast("call", D["gauge"], "ve()(address)"), D["veBTC"])
eq("Gauge pays MEZO", cast("call", D["gauge"], "rewardToken()(address)"), D["mezo"])
eq("Gauge epoch is 10 minutes", cast("call", D["gauge"], "epochLength()(uint256)"), 600)
eq("Gauge has v2 poke support (votedPower readable)", cast("call", D["gauge"], "votedPower(uint256)(uint256)", 1) != "ERR", True)
eq("Gauge has 2 vaults", cast("call", D["gauge"], "vaultCount()(uint256)"), 2)
eq("Liquidator points at our Morpho", cast("call", D["liquidator"], "morpho()(address)"), D["morpho"])

SPEC = {"vaultBold": ("Bold MEZO", 77 * 10**16, 19, 2500, "irmBold", 12 * 10**16),
        "vaultSteady": ("Steady MEZO", 625 * 10**15, 9, 2000, "irmSteady", 8 * 10**16)}
for k, (name, lltv, lev, prem, irm, apr) in SPEC.items():
    v = D[k]
    eq(f"{k} name", cast("call", v, "name()(string)"), name)
    eq(f"{k} LLTV", cast("call", v, "lltv()(uint256)"), lltv)
    eq(f"{k} max leverage", cast("call", v, "maxLeverage()(uint256)"), lev)
    eq(f"{k} premium bps", cast("call", v, "premiumBps()(uint256)"), prem)
    eq(f"{k} uses the recorded IRM", cast("call", v, "irm()(address)"), D[irm])
    eq(f"{k} IRM APR", cast("call", D[irm], "aprWad()(uint256)"), apr)
    eq(f"{k} morpho", cast("call", v, "morpho()(address)"), D["morpho"])
    eq(f"{k} oracle", cast("call", v, "oracle()(address)"), D["oracle"])
    eq(f"{k} loan token is MUSD", cast("call", v, "musd()(address)"), D["musd"])
    eq(f"{k} collateral is MEZO", cast("call", v, "collateral()(address)"), D["mezo"])
    eq(f"{k} gauge", cast("call", v, "gauge()(address)"), D["gauge"])
    eq(f"{k} registered in gauge (capRate 1e13)", cast("call", D["gauge"], "capRate(address)(uint256)", v), 10**13)
    mid = cast("call", v, "marketId()(bytes32)")
    upd = subprocess.run([CAST, "call", D["morpho"], "market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)", mid, "--rpc-url", RPC], capture_output=True, text=True).stdout.splitlines()
    eq(f"{k} Morpho market exists", len(upd) == 6 and int(upd[4].split(" ")[0]) > 0, True)

json.dump({"deployment": D, "checks": results, "time": int(time.time())}, open(os.path.join(ROOT, "deployments", "verify-31611.json"), "w"), indent=2)
failed = [r for r in results if not r["pass"]]
print(f"{len(results) - len(failed)}/{len(results)} checks pass")
sys.exit(1 if failed else 0)
