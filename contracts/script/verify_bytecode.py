"""Compare deployed runtime bytecode with this checkout's compiled artifacts (run `forge build` first).
Immutable slots (constructor-set values) and the trailing CBOR metadata are masked; everything else must match.
Usage (from contracts/): python -I script/verify_bytecode.py
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAST = os.path.join(ROOT, "..", ".tools", "foundry", "cast.exe")
D = json.load(open(os.path.join(ROOT, "deployments", "31611.json")))
TARGETS = {"morpho": "Morpho.sol/Morpho.json", "oracle": "AdminOracle.sol/AdminOracle.json", "gauge": "CosignGauge.sol/CosignGauge.json",
           "vaultBold": "CosignVault.sol/CosignVault.json", "vaultSteady": "CosignVault.sol/CosignVault.json",
           "irmBold": "FixedRateIrm.sol/FixedRateIrm.json", "irmSteady": "FixedRateIrm.sol/FixedRateIrm.json",
           "liquidator": "CosignLiquidator.sol/CosignLiquidator.json"}


def strip_metadata(b):
    n = int.from_bytes(b[-2:], "big")
    return b[: -(n + 2)] if 0 < n < 200 else b


out, bad = {}, 0
for k, f in TARGETS.items():
    art = json.load(open(os.path.join(ROOT, "out", f)))["deployedBytecode"]
    local = bytearray.fromhex(art["object"][2:])
    chain = bytearray.fromhex(subprocess.run([CAST, "code", D[k], "--rpc-url", "https://rpc.test.mezo.org"], capture_output=True, text=True).stdout.strip()[2:])
    for refs in (art.get("immutableReferences") or {}).values():
        for r in refs:
            for i in range(r["start"], r["start"] + r["length"]):
                for b in (local, chain):
                    if i < len(b):
                        b[i] = 0
    ok = strip_metadata(local) == strip_metadata(chain)
    bad += not ok
    out[k] = {"address": D[k], "match": ok, "bytes": len(chain)}
    print(f"  {'MATCH' if ok else 'DIFF '} {k:12} {D[k]} ({len(chain)} bytes)")
json.dump(out, open(os.path.join(ROOT, "deployments", "bytecode-31611.json"), "w"), indent=2)
sys.exit(1 if bad else 0)
