"""Cosign end-to-end run on Mezo testnet, against the real deployed contracts.

Usage (from contracts/):  python -I script/demo.py <stage>
  fund     deployer borrows MUSD from Mezo (openTrove) and funds the demo wallets
  bold     full cycle on the Bold market: cover, cap check, lend, vote (cover-capped), rewards funding,
           borrow, demo-oracle crash, Morpho liquidation with bad debt, first-loss allocation
  rewards  distribute the funded epoch's MEZO, check no over-distribution, claim
  restore  set the demo oracle back to the starting price
  steady   second market, after Bold passed: cover, lend, borrow, and a two-market re-vote

Every transaction and every check is appended to deployments/demo-run.json.
Private keys are read from ../.env and never printed.
"""
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAST = os.path.join(ROOT, "..", ".tools", "foundry", "cast.exe")
EXPLORER = "https://explorer.test.mezo.org/tx/"
E18 = 10**18

env = dict(l.strip().split("=", 1) for l in open(os.path.join(ROOT, "..", ".env")) if "=" in l)
RPC = env["RPC"]
D_PATH = os.path.join(ROOT, "deployments", "31611.json")
D = json.load(open(D_PATH))
RUN_PATH = os.path.join(ROOT, "deployments", "demo-run.json")
run = json.load(open(RUN_PATH)) if os.path.exists(RUN_PATH) else {"steps": [], "checks": []}

BTC = "0x7b7C000000000000000000000000000000000000"
BORROWER_OPS = "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5"
PRICE_FEED = "0x86bCF0841622a5dAC14A313a15f96A95421b9366"
ZERO = "0x" + "00" * 20
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
LOSS_ABSORBED = None  # topic computed lazily
MP = "(address,address,address,address,uint256)"

# Sizes, chosen to fit 0.05 BTC / 100 MEZO of faucet funds.
TROVE_MUSD = 2350
COVER_BOLD, LEND_BOLD, BORROW_BOLD = 400, 1000, 500
COVER_STEADY, LEND_STEADY, BORROW_STEADY = 150, 500, 100
FIRST_COVER = 10  # posted before voting, to show the cover cap binding
REWARDS_MEZO = 8
LOCK_BTC = E18 // 1000  # 0.001 BTC into veBTC
CRASH_FACTOR = 0.3  # demo oracle: MEZO -70%


# ------------------------------------------------------------------ plumbing

def cast(*args, ok=True):
    # Reads retry on transient RPC errors. Sends never retry: a resend could duplicate a broadcast tx.
    tries = 1 if args[0] == "send" else 5
    for attempt in range(tries):
        out = subprocess.run([CAST, *map(str, args), "--rpc-url", RPC], capture_output=True, text=True)
        if out.returncode == 0 or "execution reverted" in out.stderr:
            break
        time.sleep(3)
    if out.returncode == 0 or not ok:
        return out
    raise SystemExit(f"cast {args[0]} {args[1] if len(args) > 1 else ''} failed:\n{out.stderr.strip()[:600]}")


def call(to, sig, *args):
    return cast("call", to, sig, *args).stdout.strip()


def num(to, sig, *args):
    return int(call(to, sig, *args).split("\n")[0].split(" ")[0])


def save():
    json.dump(run, open(RUN_PATH, "w"), indent=2)


def receipt(h):
    # Raw JSON-RPC receipt: cast's own receipt parsing fails on Mezo precompile txs (blockTimestamp 0x0).
    for _ in range(90):
        out = cast("rpc", "eth_getTransactionReceipt", h, ok=False)
        if out.returncode == 0 and out.stdout.strip() not in ("", "null"):
            return json.loads(out.stdout)
        time.sleep(2)
    raise SystemExit(f"no receipt for {h}")


def send(label, who, to, sig, *args, value=None):
    extra = ["--value", str(value)] if value else []
    h = cast("send", to, sig, *args, *extra, "--private-key", env[f"{who}_KEY"], "--async").stdout.strip().splitlines()[-1]
    r = receipt(h)
    if r.get("status") not in ("0x1", 1, "1"):
        raise SystemExit(f"{label}: reverted ({r.get('transactionHash')})")
    h = r["transactionHash"]
    run["steps"].append({"label": label, "actor": who.lower(), "tx": h, "url": EXPLORER + h, "block": int(r["blockNumber"], 16), "time": int(time.time())})
    save()
    print(f"  {label:<62} {EXPLORER}{h}")
    return r


def check(name, passed, detail):
    run["checks"].append({"check": name, "pass": bool(passed), "detail": detail, "block": int(cast("block-number").stdout.strip())})
    save()
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}: {detail}")
    if not passed:
        raise SystemExit(f"check failed: {name}")


def reverts_with(who, to, sig, *args):
    """eth_call from `who`; returns the revert text (or '' if it would succeed)."""
    out = cast("call", to, sig, *args, "--from", env[f"{who}_ADDR"], ok=False)
    return "" if out.returncode == 0 else (out.stderr.strip().splitlines() or ["reverted"])[-1]


def addr(who):
    return env[f"{who}_ADDR"]


def wad(x):
    return int(round(x * E18))


def fmt(x):
    return f"{x / E18:,.4f}"


def mp(vault):
    vals = [l.split(" ")[0] for l in call(vault, f"marketParams(){MP}").splitlines()]
    return "(" + ",".join(vals) + ")"


def books(vault):
    lines = call(vault, "previewBooks()(uint256,uint256)").split("\n")
    return int(lines[0].split(" ")[0]), int(lines[1].split(" ")[0])


def position(vault, who):
    lines = call(D["morpho"], "position(bytes32,address)(uint256,uint128,uint128)", call(vault, "marketId()(bytes32)"), addr(who)).split("\n")
    return [int(l.split(" ")[0]) for l in lines]


def market(vault):
    lines = call(D["morpho"], "market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)", call(vault, "marketId()(bytes32)")).split("\n")
    return [int(l.split(" ")[0]) for l in lines]


def collateral_for(borrow_musd, ltv):
    price = num(D["oracle"], "price()(uint256)")  # 1e36 scale
    return wad(borrow_musd) * 10**36 // price * 100 // int(ltv * 100) + 1


def balance(token, who):
    return num(token, "balanceOf(address)(uint256)", addr(who))


# ------------------------------------------------------------------ stages

def stage_fund():
    price = num(PRICE_FEED, "fetchPrice()(uint256)")
    btc = int(cast("balance", addr("DEPLOYER")).stdout.strip())
    keep = E18 * 35 // 10000  # 0.0035 BTC kept for gas + funding wallets
    coll = btc - keep
    debt_total = wad(TROVE_MUSD) * 1001 // 1000 + 200 * E18
    icr = coll * price / E18 / debt_total
    check("Trove collateral ratio is safe", icr > 1.4, f"{icr * 100:.1f}% with {coll / E18:.4f} BTC at ${price / E18:,.0f} (min 110%)")
    send(f"Deployer borrows {TROVE_MUSD} MUSD from Mezo (openTrove)", "DEPLOYER", BORROWER_OPS, "openTrove(uint256,address,address)", wad(TROVE_MUSD), ZERO, ZERO, value=coll)
    check("MUSD received from Mezo borrowing", balance(D["musd"], "DEPLOYER") >= wad(TROVE_MUSD), f"{fmt(balance(D['musd'], 'DEPLOYER'))} MUSD")
    for who, amt in [("COSIGNER", LOCK_BTC + E18 // 2000), ("LENDER", E18 * 3 // 10000), ("BORROWER", E18 * 3 // 10000)]:
        send(f"Fund {who.lower()} with BTC for gas", "DEPLOYER", BTC, "transfer(address,uint256)", addr(who), amt)
    send("Fund co-signer with MUSD", "DEPLOYER", D["musd"], "transfer(address,uint256)", addr("COSIGNER"), wad(COVER_BOLD + COVER_STEADY))
    send("Fund lender with MUSD", "DEPLOYER", D["musd"], "transfer(address,uint256)", addr("LENDER"), wad(LEND_BOLD + LEND_STEADY))
    mezo = collateral_for(BORROW_BOLD, 0.7) + collateral_for(BORROW_STEADY, 0.5)
    send(f"Fund borrower with {fmt(mezo)} MEZO collateral", "DEPLOYER", D["mezo"], "transfer(address,uint256)", addr("BORROWER"), mezo)


def lock_vebtc():
    send("Co-signer approves BTC for veBTC", "COSIGNER", BTC, "approve(address,uint256)", D["veBTC"], LOCK_BTC)
    for weeks in (208, 104, 52, 26, 12, 8, 4, 3, 2, 1):  # longest lock veBTC accepts = most voting power
        dur = weeks * 7 * 24 * 3600
        if reverts_with("COSIGNER", D["veBTC"], "createLock(uint256,uint256)", LOCK_BTC, dur) == "":
            break
    r = send(f"Co-signer locks 0.001 BTC in Mezo veBTC for {weeks} weeks", "COSIGNER", D["veBTC"], "createLock(uint256,uint256)", LOCK_BTC, dur)
    token_id = next(int(l["topics"][3], 16) for l in r["logs"] if l["address"].lower() == D["veBTC"].lower() and l["topics"][0] == TRANSFER)
    power = num(D["veBTC"], "balanceOfNFT(uint256)(uint256)", token_id)
    check("veBTC position minted to co-signer", call(D["veBTC"], "ownerOf(uint256)(address)", token_id).lower() == addr("COSIGNER").lower(), f"tokenId {token_id}, voting power {fmt(power)}")
    run["veBTCTokenId"] = token_id
    save()
    return token_id, power


def stage_bold():
    v, g, morpho = D["vaultBold"], D["gauge"], D["morpho"]
    cap_rate = num(g, "capRate(address)(uint256)", v)
    run["startPrice"] = str(num(D["oracle"], "price()(uint256)"))

    print("Step 1: co-signer posts cover, votes")
    token_id, power = lock_vebtc()
    send("Co-signer approves MUSD for Bold vault", "COSIGNER", D["musd"], "approve(address,uint256)", v, wad(COVER_BOLD))
    # Size the first cover so its cap is half the veBTC power: the cap must visibly bind.
    first = max(E18 // 100, min(wad(FIRST_COVER), power * E18 // (2 * cap_rate)))
    send(f"Co-signer posts {fmt(first)} MUSD cover (Bold)", "COSIGNER", v, "depositJunior(uint256)", first)
    shares = num(v, "juniorSharesOf(address)(uint256)", addr("COSIGNER"))
    jb = num(v, "juniorBalanceOf(address)(uint256)", addr("COSIGNER"))
    check("Junior shares and cover recorded", shares > 0 and abs(jb - first) <= 10, f"{shares} shares worth {fmt(jb)} MUSD")
    send("Co-signer votes veBTC 100% for Bold", "COSIGNER", g, "vote(uint256,address[],uint256[])", token_id, f"[{v}]", "[1]")
    votes, weight = num(g, "vaultVotes(address)(uint256)", v), num(g, "weightOf(address)(uint256)", v)
    cap = num(g, "coverCap(address)(uint256)", v)
    check("Effective weight capped by cover", weight == min(votes, cap) and weight < votes,
          f"votes {votes}, cover cap {cap} ({fmt(first)} MUSD x capRate {cap_rate}), effective {weight}")
    send(f"Co-signer posts {fmt(wad(COVER_BOLD) - first)} more MUSD cover (Bold)", "COSIGNER", v, "depositJunior(uint256)", wad(COVER_BOLD) - first)
    weight2, cap2 = num(g, "weightOf(address)(uint256)", v), num(g, "coverCap(address)(uint256)", v)
    check("Effective weight follows cover live", weight2 == min(votes, cap2) and weight2 > weight, f"cover cap now {cap2}, effective {weight2} (was {weight})")
    capacity = num(v, "capacity()(uint256)")
    check("Lending capacity opened by cover", capacity == wad(COVER_BOLD) * 19, f"{fmt(capacity)} MUSD (= {COVER_BOLD} cover x 19)")

    print("Step 2: lender deposits; cap is enforced")
    over = capacity + 1
    reason = reverts_with("LENDER", v, "depositSenior(uint256)", over)
    check("Deposit above capacity is rejected", "CapacityExceeded" in reason or "0x" in reason, f"eth_call depositSenior({fmt(over)}) -> {reason}")
    send("Lender approves MUSD for Bold vault", "LENDER", D["musd"], "approve(address,uint256)", v, wad(LEND_BOLD))
    send(f"Lender deposits {LEND_BOLD} MUSD (Bold, senior)", "LENDER", v, "depositSenior(uint256)", wad(LEND_BOLD))
    s, j = books(v)
    check("Senior and junior capital allocated", abs(s - wad(LEND_BOLD)) <= 10 and abs(j - wad(COVER_BOLD)) <= 10, f"senior {fmt(s)}, junior {fmt(j)}, coverage {num(v, 'coverageBps()(uint256)') / 100:.2f}%")
    check("Vault supplied everything to Morpho", market(v)[0] >= s + j - 10, f"Morpho market supply {fmt(market(v)[0])} MUSD")

    bold_rest()


def bold_rest():
    v, g, morpho = D["vaultBold"], D["gauge"], D["morpho"]
    print("Step 4: self-funded MEZO rewards")
    send("Deployer approves MEZO for gauge", "DEPLOYER", D["mezo"], "approve(address,uint256)", g, wad(REWARDS_MEZO))
    send(f"Deployer funds {REWARDS_MEZO} MEZO rewards (self-funded)", "DEPLOYER", g, "fund(uint256)", wad(REWARDS_MEZO))
    epoch = num(g, "currentEpoch()(uint256)")
    run["rewardEpoch"] = epoch
    check("Gauge holds exactly the funded MEZO", num(D["mezo"], "balanceOf(address)(uint256)", g) == wad(REWARDS_MEZO), f"epoch {epoch} budget {fmt(num(g, 'epochBudget(uint256)(uint256)', epoch))} MEZO")

    bold_borrow()


def bold_borrow():
    v, g, morpho = D["vaultBold"], D["gauge"], D["morpho"]
    print("Step 5: borrower posts MEZO and borrows MUSD on Morpho")
    coll = collateral_for(BORROW_BOLD, 0.7)
    send("Borrower approves MEZO for Morpho", "BORROWER", D["mezo"], "approve(address,uint256)", morpho, coll)
    send(f"Borrower posts {fmt(coll)} MEZO collateral (Bold)", "BORROWER", morpho, f"supplyCollateral({MP},uint256,address,bytes)", mp(v), coll, addr("BORROWER"), "0x")
    send(f"Borrower borrows {BORROW_BOLD} MUSD at 70% LTV (Bold)", "BORROWER", morpho, f"borrow({MP},uint256,uint256,address,address)", mp(v), wad(BORROW_BOLD), 0, addr("BORROWER"), addr("BORROWER"))
    _, bshares, pcoll = position(v, "BORROWER")
    mk = market(v)
    debt = bshares * (mk[2] + 1) // (mk[3] + 10**6) + 1
    price = num(D["oracle"], "price()(uint256)")
    ltv = debt * 10**36 / (pcoll * price)
    check("Collateral and debt recorded by Morpho", pcoll == coll and abs(debt - wad(BORROW_BOLD)) < E18 // 100 and ltv < 0.77, f"collateral {fmt(pcoll)} MEZO, debt {fmt(debt)} MUSD, LTV {ltv * 100:.2f}% (LLTV 77%)")
    check("Borrower received MUSD", balance(D["musd"], "BORROWER") >= wad(BORROW_BOLD), f"{fmt(balance(D['musd'], 'BORROWER'))} MUSD")

    print("Step 6: demo oracle crash and Morpho liquidation")
    s0, j0 = books(v)
    sp0, jp0 = num(v, "seniorSharePrice()(uint256)"), num(v, "juniorSharePrice()(uint256)")
    w0 = num(g, "weightOf(address)(uint256)", v)
    run["before"] = {"senior": str(s0), "junior": str(j0), "seniorPrice": str(sp0), "juniorPrice": str(jp0)}
    start = num(D["oracle"], "price()(uint256)")
    reason = reverts_with("BORROWER", D["oracle"], "setPrice(uint256)", start // 2)
    check("Only the oracle owner can set the demo price", reason != "", f"eth_call setPrice from borrower -> {reason}")
    send(f"DEMO ORACLE: MEZO price -{int((1 - CRASH_FACTOR) * 100)}% ({start / 1e36:.2f} -> {start * CRASH_FACTOR / 1e36:.2f} MUSD)", "DEPLOYER", D["oracle"], "setPrice(uint256)", int(start * CRASH_FACTOR))
    price = num(D["oracle"], "price()(uint256)")
    ltv = debt * 10**36 / (pcoll * price)
    check("Borrower is now liquidatable", ltv > 0.77, f"LTV {ltv * 100:.1f}% > LLTV 77%")
    supply_before = market(v)[0]
    send("Liquidator approves MUSD for Morpho", "DEPLOYER", D["musd"], "approve(address,uint256)", morpho, wad(BORROW_BOLD))
    r = send("Liquidator seizes all collateral; Morpho realises bad debt", "DEPLOYER", morpho, f"liquidate({MP},address,uint256,uint256,bytes)", mp(v), addr("BORROWER"), pcoll, 0, "0x")
    mk = market(v)
    _, bs_after, coll_after = position(v, "BORROWER")
    realised = supply_before - mk[0]  # Morpho cuts totalSupplyAssets by the bad debt
    run["badDebtTx"] = r["transactionHash"]
    check("Morpho realised bad debt", realised > 0 and coll_after == 0 and bs_after == 0, f"{fmt(realised)} MUSD written off market supply (approx., includes accrued interest delta)")

    print("Step 7: Cosign allocates the loss, junior first")
    r = send("Cosign sync: loss charged to cover first", "DEPLOYER", v, "sync()")
    verify_loss(r)


def verify_loss(r=None):
    """Decode LossAbsorbed from the sync receipt and check the waterfall against the recorded pre-crash state."""
    v, g = D["vaultBold"], D["gauge"]
    if r is None:
        h = next(st["tx"] for st in reversed(run["steps"]) if st["label"].startswith("Cosign sync"))
        r = receipt(h)
    topic = subprocess.run([CAST, "keccak", "LossAbsorbed(uint256,uint256,uint256,uint256,uint256)"], capture_output=True, text=True).stdout.strip()
    log = next(l for l in r["logs"] if l["address"].lower() == v.lower() and l["topics"][0] == topic)
    data = log["data"][2:]
    loss, by_j, by_s, s_after, j_after = (int(data[i * 64:(i + 1) * 64], 16) for i in range(5))
    s0, j0, sp0 = int(run["before"]["senior"]), int(run["before"]["junior"]), int(run["before"]["seniorPrice"])
    sp1 = num(v, "seniorSharePrice()(uint256)")
    run["after"] = {"senior": str(s_after), "junior": str(j_after), "seniorPrice": str(sp1), "juniorPrice": str(num(v, "juniorSharePrice()(uint256)"))}
    run["loss"] = {"tx": r["transactionHash"], "recognized": str(loss), "byJunior": str(by_j), "bySenior": str(by_s)}
    save()
    check("LossAbsorbed: juniorLoss + seniorLoss == recognized loss", by_j + by_s == loss, f"{fmt(by_j)} + {fmt(by_s)} = {fmt(loss)} MUSD (tx {r['transactionHash']})")
    check("Junior absorbed the whole loss", by_s == 0 and by_j == loss and loss < j0, f"cover {fmt(j0)} -> {fmt(j_after)} MUSD (+ interest accrued before sync)")
    check("Senior book not reduced by the loss", s_after >= s0, f"senior {fmt(s0)} -> {fmt(s_after)} MUSD")
    check("Senior share value unchanged or higher", sp1 >= sp0, f"{sp0 / E18:.9f} -> {sp1 / E18:.9f} MUSD per starting MUSD")
    rate = num(g, "capRate(address)(uint256)", v)
    votes1, cap1, w1 = num(g, "vaultVotes(address)(uint256)", v), num(g, "coverCap(address)(uint256)", v), num(g, "weightOf(address)(uint256)", v)
    w0 = min(votes1, j0 * rate // E18)
    check("Effective weight after the loss = min(votes, live cover cap)", w1 == min(votes1, cap1) and w1 <= w0, f"{w0} -> {w1} (votes {votes1}, cover cap {cap1})")
    print(f"   cover   {fmt(j0)} -> {fmt(j_after)} MUSD")
    print(f"   lenders {fmt(s0)} -> {fmt(s_after)} MUSD")


def stage_rewards():
    g, e = D["gauge"], run["rewardEpoch"]
    now = num(g, "currentEpoch()(uint256)")
    if now <= e:
        raise SystemExit(f"epoch {e} not over yet; ends at {num(g, 'epochEnd(uint256)(uint256)', e)} (now {int(time.time())})")
    funded = num(g, "epochBudget(uint256)(uint256)", e)
    before = {v: num(D["mezo"], "balanceOf(address)(uint256)", v) for v in (D["vaultBold"],)}
    r = send(f"Gauge distributes epoch {e} MEZO by cover-capped weight", "DEPLOYER", g, "distribute(uint256)", e)
    got = num(D["mezo"], "balanceOf(address)(uint256)", D["vaultBold"]) - before[D["vaultBold"]]
    left = num(D["mezo"], "balanceOf(address)(uint256)", g)
    check("Distributed no more than funded", got <= funded and got + left == funded, f"funded {fmt(funded)}, sent to Bold {fmt(got)}, left in gauge {fmt(left)}")
    reason = reverts_with("DEPLOYER", g, "distribute(uint256)", e)
    check("Epoch cannot be distributed twice", reason != "", f"second distribute -> {reason}")
    wait = 0
    while wait < 700:
        time.sleep(30)
        wait += 30
        if num(D["vaultBold"], "pendingRewards(address)(uint256)", addr("COSIGNER")) > 0 and wait >= 120:
            break
    claimed = 0
    for who in ("COSIGNER", "LENDER"):
        pend = num(D["vaultBold"], "pendingRewards(address)(uint256)", addr(who))
        b0 = balance(D["mezo"], who)
        send(f"{who.capitalize()} claims MEZO rewards (Bold)", who, D["vaultBold"], "claimRewards()")
        got_w = balance(D["mezo"], who) - b0
        claimed += got_w
        check(f"{who.capitalize()} claim paid", got_w >= pend and got_w > 0, f"{fmt(got_w)} MEZO")
        reason = reverts_with(who, D["vaultBold"], "claimRewards()")
        again = num(D["vaultBold"], "pendingRewards(address)(uint256)", addr(who))
        check(f"{who.capitalize()} cannot double claim", again < E18 // 1000, f"pending right after claim {fmt(again)} MEZO (only new streaming)")
    check("Claims never exceed what the vault received", claimed <= got, f"claimed {fmt(claimed)} of {fmt(got)} MEZO so far (rest still streaming)")
    run["rewards"] = {"epoch": e, "funded": str(funded), "distributedToBold": str(got), "claimed": str(claimed)}
    save()


def stage_restore():
    send("DEMO ORACLE: restore starting MEZO price", "DEPLOYER", D["oracle"], "setPrice(uint256)", int(run["startPrice"]))


def stage_steady():
    v, g, morpho = D["vaultSteady"], D["gauge"], D["morpho"]
    assert v != ZERO, "deploy the Steady market first (Deploy.s.sol addMarket steady)"
    print("Steady: cover, lend, borrow, two-market vote")
    send("Co-signer approves MUSD for Steady vault", "COSIGNER", D["musd"], "approve(address,uint256)", v, wad(COVER_STEADY))
    send(f"Co-signer posts {COVER_STEADY} MUSD cover (Steady)", "COSIGNER", v, "depositJunior(uint256)", wad(COVER_STEADY))
    send("Lender approves MUSD for Steady vault", "LENDER", D["musd"], "approve(address,uint256)", v, wad(LEND_STEADY))
    send(f"Lender deposits {LEND_STEADY} MUSD (Steady, senior)", "LENDER", v, "depositSenior(uint256)", wad(LEND_STEADY))
    coll = collateral_for(BORROW_STEADY, 0.5)
    send("Borrower approves MEZO for Morpho", "BORROWER", D["mezo"], "approve(address,uint256)", morpho, coll)
    send(f"Borrower posts {fmt(coll)} MEZO collateral (Steady)", "BORROWER", morpho, f"supplyCollateral({MP},uint256,address,bytes)", mp(v), coll, addr("BORROWER"), "0x")
    send(f"Borrower borrows {BORROW_STEADY} MUSD at 50% LTV (Steady)", "BORROWER", morpho, f"borrow({MP},uint256,uint256,address,address)", mp(v), wad(BORROW_STEADY), 0, addr("BORROWER"), addr("BORROWER"))
    s, j = books(v)
    check("Steady books", abs(s - wad(LEND_STEADY)) <= 10 and abs(j - wad(COVER_STEADY)) <= 10, f"senior {fmt(s)}, junior {fmt(j)}, room {fmt(num(v, 'capacity()(uint256)'))}")
    tid = run["veBTCTokenId"]
    if num(g, "lastVotedEpochPlusOne(uint256)(uint256)", tid) == num(g, "currentEpoch()(uint256)") + 1:
        print("   already voted this epoch; run `steady` again next epoch for the two-market vote")
        return
    send("Co-signer re-votes veBTC: 60% Bold / 40% Steady", "COSIGNER", g, "vote(uint256,address[],uint256[])", tid, f"[{D['vaultBold']},{v}]", "[60,40]")
    for name, vv in (("Bold", D["vaultBold"]), ("Steady", v)):
        check(f"{name} effective weight", True, f"votes {num(g, 'vaultVotes(address)(uint256)', vv)}, cover cap {num(g, 'coverCap(address)(uint256)', vv)}, effective {num(g, 'weightOf(address)(uint256)', vv)}")




def stage_claims():
    """After the reward stream ends: claim everything, then prove nothing more can be claimed."""
    v = D["vaultBold"]
    finish = max(int(call(v, "rewards(uint256)(uint256,uint64,uint64,uint256)", t).splitlines()[1].split(" ")[0]) for t in (0, 1))
    while int(time.time()) <= finish + 15:
        time.sleep(20)
    got = int(run["rewards"]["distributedToBold"]) if "rewards" in run else 8 * E18
    paid = 0
    for st in run["steps"]:
        if "claims MEZO" in st["label"]:
            r = receipt(st["tx"])
            paid += sum(int(l["data"], 16) for l in r["logs"] if l["address"].lower() == D["mezo"].lower() and l["topics"][0] == TRANSFER)
    for who in ("COSIGNER", "LENDER"):
        if num(v, "pendingRewards(address)(uint256)", addr(who)) > 0:
            r = send(f"{who.capitalize()} claims MEZO rewards (Bold)", who, v, "claimRewards()")
            paid += sum(int(l["data"], 16) for l in r["logs"] if l["address"].lower() == D["mezo"].lower() and l["topics"][0] == TRANSFER)
        check(f"{who.capitalize()} has nothing left to claim after the stream", num(v, "pendingRewards(address)(uint256)", addr(who)) == 0, "pending 0")
        out = cast("call", v, "claimRewards()(uint256)", "--from", addr(who))
        check(f"{who.capitalize()} second claim pays 0", int(out.stdout.strip().split(" ")[0]) == 0, f"eth_call claimRewards -> {out.stdout.strip()}")
    left = num(D["mezo"], "balanceOf(address)(uint256)", v)
    check("Claims + vault remainder == distributed (no over-distribution)", paid + left == got and paid <= got, f"claimed {fmt(paid)} + left in vault {fmt(left)} (rounding dust) = {fmt(paid + left)} of {fmt(got)} MEZO")
    run.setdefault("rewards", {"epoch": run["rewardEpoch"], "funded": str(got), "distributedToBold": str(got)})["claimed"] = str(paid)
    save()


def stage_liqproof():
    """Second Bold loss, liquidated through CosignLiquidator: interest is booked before the loss lands."""
    v, g, morpho, liq = D["vaultBold"], D["gauge"], D["morpho"], D["liquidator"]
    price = num(D["oracle"], "price()(uint256)")
    assert price == int(run["startPrice"]), "restore the demo price first"
    borrow = 100
    coll = collateral_for(borrow, 0.7)
    send(f"Fund borrower with {fmt(coll)} MEZO (second Bold loan)", "DEPLOYER", D["mezo"], "transfer(address,uint256)", addr("BORROWER"), coll)
    send("Borrower approves MEZO for Morpho", "BORROWER", D["mezo"], "approve(address,uint256)", morpho, coll)
    send(f"Borrower posts {fmt(coll)} MEZO collateral (Bold, loan 2)", "BORROWER", morpho, f"supplyCollateral({MP},uint256,address,bytes)", mp(v), coll, addr("BORROWER"), "0x")
    send(f"Borrower borrows {borrow} MUSD (Bold, loan 2)", "BORROWER", morpho, f"borrow({MP},uint256,uint256,address,address)", mp(v), wad(borrow), 0, addr("BORROWER"), addr("BORROWER"))
    print("   letting interest accrue for 3 minutes")
    time.sleep(180)
    booked = num(v, "seniorAssets()(uint256)")
    s_pre, j_pre = books(v)
    check("Senior has unbooked interest before the crash", s_pre > booked, f"booked {fmt(booked)}, with pending interest {s_pre / E18:.12f} MUSD")
    send(f"DEMO ORACLE: MEZO price -70% ({price / 1e36:.2f} -> {price * CRASH_FACTOR / 1e36:.2f} MUSD)", "DEPLOYER", D["oracle"], "setPrice(uint256)", int(price * CRASH_FACTOR))
    _, _, pcoll = position(v, "BORROWER")
    send("Liquidator approves MUSD for CosignLiquidator", "DEPLOYER", D["musd"], "approve(address,uint256)", liq, wad(borrow))
    r = send("CosignLiquidator: sync, liquidate on Morpho, sync", "DEPLOYER", liq, "liquidate(address,address,uint256,uint256)(uint256,uint256)", v, addr("BORROWER"), pcoll, 0)
    topic = subprocess.run([CAST, "keccak", "LossAbsorbed(uint256,uint256,uint256,uint256,uint256)"], capture_output=True, text=True).stdout.strip()
    acc = subprocess.run([CAST, "keccak", "InterestAccrued(uint256,uint256,uint256)"], capture_output=True, text=True).stdout.strip()
    logs = [l for l in r["logs"] if l["address"].lower() == v.lower()]
    interest = [l for l in logs if l["topics"][0] == acc]
    loss_log = next(l for l in logs if l["topics"][0] == topic)
    d = loss_log["data"][2:]
    loss, by_j, by_s, s_after, j_after = (int(d[i * 64:(i + 1) * 64], 16) for i in range(5))
    to_senior = int(interest[0]["data"][2 + 64: 2 + 128], 16) if interest else 0
    run["loss2"] = {"tx": r["transactionHash"], "recognized": str(loss), "byJunior": str(by_j), "bySenior": str(by_s), "seniorInterestBooked": str(to_senior)}
    save()
    check("Interest booked before the loss (InterestAccrued precedes LossAbsorbed)", bool(interest) and logs.index(interest[0]) < logs.index(loss_log) and to_senior > 0, f"senior credited {to_senior / E18:.12f} MUSD interest first")
    check("Second loss: juniorLoss + seniorLoss == recognized loss", by_j + by_s == loss and by_s == 0, f"{fmt(by_j)} + {fmt(by_s)} = {fmt(loss)} MUSD")
    check("Senior kept all interest earned before the loss", s_after >= s_pre and abs(s_after - (booked + to_senior)) <= 2, f"senior {fmt(booked)} -> {s_after / E18:.12f} MUSD")
    under = call(v, "isUndercovered()(bool)") == "true"
    check("Coverage below minimum after the real loss", under and num(v, "capacity()(uint256)") == 0, f"coverage {num(v, 'coverageBps()(uint256)') / 100:.2f}% < 5%, room to lend 0")
    reason = reverts_with("LENDER", v, "depositSenior(uint256)", E18)
    check("Lender deposits blocked while under-covered", reason != "", f"eth_call depositSenior(1) -> {reason}")


STAGES = {"fund": stage_fund, "bold": stage_bold, "bold-rest": bold_rest, "bold-borrow": bold_borrow, "verify-loss": verify_loss, "rewards": stage_rewards, "restore": stage_restore, "steady": stage_steady}
STAGES["claims"] = stage_claims
STAGES["liqproof"] = stage_liqproof


def stage_topup():
    """Borrow 300 more MUSD from the deployer's Mezo trove for browser testing."""
    send("Deployer borrows 300 more MUSD from Mezo (withdrawMUSD)", "DEPLOYER", BORROWER_OPS, "withdrawMUSD(uint256,address,address)", wad(300), ZERO, ZERO)
    check("Top-up received", balance(D["musd"], "DEPLOYER") >= wad(300), f"deployer holds {fmt(balance(D['musd'], 'DEPLOYER'))} MUSD")


STAGES["topup"] = stage_topup

if __name__ == "__main__":
    STAGES[sys.argv[1]]()
