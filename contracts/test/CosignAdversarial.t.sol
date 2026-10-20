// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {console2} from "forge-std/console2.sol";
import {MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {MorphoBalancesLib} from "morpho-blue/libraries/periphery/MorphoBalancesLib.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignGauge} from "../src/CosignGauge.sol";
import {CosignSetup} from "./Cosign.t.sol";

/// Adversarial accounting scenarios (Directive 005, item 1 and 2). Every scenario liquidates straight on Morpho,
/// bypassing CosignLiquidator, and compares the vault's books with exact "interest first, then loss" accounting.
contract CosignAdversarialTest is CosignSetup {
    using MarketParamsLib for MarketParams;
    using MorphoBalancesLib for *;

    uint256 constant PREMIUM_BPS = 2000;

    struct Exact {
        uint256 s;
        uint256 j;
    }

    function _borrowAs(address who, uint256 collateral, uint256 amount) internal {
        mezo.mint(who, collateral);
        vm.startPrank(who);
        mezo.approve(address(morpho), type(uint256).max);
        morpho.supplyCollateral(mp, collateral, who, "");
        morpho.borrow(mp, amount, 0, who, who);
        vm.stopPrank();
    }

    function _liquidateAll(address who) internal returns (uint256 badDebt) {
        uint256 coll = morpho.position(mp.id(), who).collateral;
        uint256 before = morpho.expectedTotalSupplyAssets(mp);
        vm.prank(liquidator);
        morpho.liquidate(mp, who, coll, 0, "");
        badDebt = before - morpho.market(mp.id()).totalSupplyAssets;
    }

    /// Exact reference: book interest I at the last-sync split, then charge gross loss L junior-first.
    function _exact(uint256 s0, uint256 j0, uint256 interest, uint256 loss) internal pure returns (Exact memory e) {
        uint256 sPart = s0 + j0 == 0 ? 0 : interest * s0 / (s0 + j0);
        uint256 prem = sPart * PREMIUM_BPS / 10_000;
        e.s = s0 + sPart - prem;
        e.j = j0 + interest - sPart + prem;
        uint256 hitJ = loss < e.j ? loss : e.j;
        e.j -= hitJ;
        e.s -= loss - hitJ;
    }

    function _log(string memory name, uint256 s0, uint256 j0, Exact memory e, uint256 s1, uint256 j1) internal pure {
        console2.log(name);
        console2.log("  booked before   senior", s0, "junior", j0);
        console2.log("  exact ordering  senior", e.s, "junior", e.j);
        console2.log("  vault (netted)  senior", s1, "junior", j1);
    }

    // ------------------------------------------------ 1. direct liquidation after interest

    function test_Adv_DirectLiquidationAfterInterest() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        uint256 s0 = vault.seniorAssets();
        uint256 j0 = vault.juniorAssets();
        vm.warp(block.timestamp + 30 days);
        uint256 interest = morpho.expectedSupplyAssets(mp, address(vault)) - (s0 + j0);
        oracle.setPrice(0.3e36);
        uint256 loss = _liquidateAll(borrower);
        vault.sync();
        (uint256 s1, uint256 j1) = (vault.seniorAssets(), vault.juniorAssets());
        Exact memory e = _exact(s0, j0, interest, loss);
        _log("direct liquidation after 30 days of interest", s0, j0, e, s1, j1);

        assertEq(s1, s0, "G1: senior keeps its last-synced value while the net loss fits in cover");
        assertApproxEqAbs(s1 + j1, e.s + e.j, 2, "no value created or destroyed");
        assertApproxEqAbs(e.s - s1, j1 - e.j, 2, "what senior forgoes goes to junior, not elsewhere");
        assertLe(e.s - s1, interest, "senior forgoes at most the interest accrued since the last sync");
    }

    // --------------------------------------- 2. several liquidations between two syncs

    function test_Adv_MultipleLiquidationsBetweenSyncs() public {
        address b1 = makeAddr("b1");
        address b2 = makeAddr("b2");
        address b3 = makeAddr("b3");
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrowAs(b1, 400e18, 200e18);
        _borrowAs(b2, 400e18, 200e18);
        _borrowAs(b3, 400e18, 200e18);
        uint256 s0 = vault.seniorAssets();
        uint256 j0 = vault.juniorAssets();
        vm.warp(block.timestamp + 10 days);
        uint256 interest = morpho.expectedSupplyAssets(mp, address(vault)) - (s0 + j0);
        oracle.setPrice(0.3e36);
        uint256 loss = _liquidateAll(b1);
        vm.warp(block.timestamp + 1 days);
        interest += 0; // interest during the gap is folded into the final comparison below
        loss += _liquidateAll(b2);
        vm.warp(block.timestamp + 1 days);
        loss += _liquidateAll(b3);
        uint256 total = morpho.expectedSupplyAssets(mp, address(vault));
        interest = total + loss - (s0 + j0); // gross interest over the whole interval
        vault.sync();
        (uint256 s1, uint256 j1) = (vault.seniorAssets(), vault.juniorAssets());
        Exact memory e = _exact(s0, j0, interest, loss);
        _log("three direct liquidations between syncs", s0, j0, e, s1, j1);
        assertEq(s1, s0, "G1 holds across several liquidations");
        assertEq(s1 + j1, total);
        assertLe(e.s - s1, interest);
    }

    // ---------------------------------------- 3. senior exits around the loss

    function test_Adv_SeniorExitBeforeRealisation_LossFitsCover() public {
        address lender2 = makeAddr("lender2");
        musd.mint(lender2, 10_000e18);
        vm.prank(lender2);
        musd.approve(address(vault), type(uint256).max);
        _junior(cosigner, 1_000e18);
        _senior(lender, 5_000e18);
        vm.prank(lender2);
        vault.depositSenior(5_000e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        oracle.setPrice(0.3e36); // loss exists but is not realised yet
        uint256 shares = vault.seniorShares(lender);
        vm.prank(lender);
        uint256 out = vault.withdrawSenior(shares);
        assertApproxEqAbs(out, 5_000e18, 1e9, "early exit leaves at full value");
        uint256 b2Before = vault.seniorBalanceOf(lender2);
        _liquidateAll(borrower);
        vault.sync();
        assertGe(vault.seniorBalanceOf(lender2), b2Before, "remaining lender untouched while the loss fits in cover");
    }

    function test_Adv_SeniorExitBeforeRealisation_LossExceedsCover_RedistributesToStayers() public {
        // Same loss, with and without an early exit: who pays the part cover cannot?
        uint256 stayerLossNoExit = _scenarioExcessLoss(false);
        uint256 stayerLossWithExit = _scenarioExcessLoss(true);
        console2.log("remaining lender loss, nobody exits   ", stayerLossNoExit);
        console2.log("remaining lender loss, other lender ran", stayerLossWithExit);
        assertGt(stayerLossWithExit, stayerLossNoExit, "an early exit shifts the excess loss onto lenders who stay");
    }

    function _scenarioExcessLoss(bool earlyExit) internal returns (uint256 stayerLoss) {
        uint256 snap = vm.snapshotState();
        address lender2 = makeAddr("lender2");
        musd.mint(lender2, 10_000e18);
        vm.prank(lender2);
        musd.approve(address(vault), type(uint256).max);
        _junior(cosigner, 100e18);
        _senior(lender, 950e18);
        vm.prank(lender2);
        vault.depositSenior(950e18);
        _borrowAs(borrower, 1_000e18, 700e18);
        oracle.setPrice(0.1e36); // bad debt ~600, cover 100
        if (earlyExit) {
            uint256 sh = vault.seniorShares(lender);
            vm.prank(lender);
            vault.withdrawSenior(sh);
        }
        uint256 before = vault.seniorBalanceOf(lender2);
        _liquidateAll(borrower);
        vault.sync();
        stayerLoss = before - vault.seniorBalanceOf(lender2);
        vm.revertToState(snap);
    }

    function test_Adv_SeniorExitAfterRealisation_SeesTheLossOnlyBeyondCover() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 5_000e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        oracle.setPrice(0.3e36);
        _liquidateAll(borrower);
        uint256 sh = vault.seniorShares(lender);
        vm.prank(lender);
        uint256 out = vault.withdrawSenior(sh); // withdraw syncs first
        assertApproxEqAbs(out, 5_000e18, 1e9, "loss fit in cover, so exit after realisation is still full value");
    }

    // ------------------------------------------- 4/5. partial and total junior depletion

    function test_Adv_PartialDepletion() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        uint256 s0 = vault.seniorAssets();
        oracle.setPrice(0.3e36);
        uint256 loss = _liquidateAll(borrower);
        vault.sync();
        assertEq(vault.seniorAssets(), s0);
        assertApproxEqAbs(vault.juniorAssets(), 1_000e18 - loss, 1, "cover reduced by exactly the loss");
        assertEq(vault.juniorRound(), 0, "not wiped");
    }

    function test_Adv_TotalDepletion_SeniorTakesOnlyTheExcess() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18);
        _borrowAs(borrower, 1_000e18, 700e18);
        uint256 s0 = vault.seniorAssets();
        uint256 j0 = vault.juniorAssets();
        vm.warp(block.timestamp + 5 days);
        uint256 interest = morpho.expectedSupplyAssets(mp, address(vault)) - (s0 + j0);
        oracle.setPrice(0.1e36);
        uint256 loss = _liquidateAll(borrower);
        vault.sync();
        (uint256 s1, uint256 j1) = (vault.seniorAssets(), vault.juniorAssets());
        Exact memory e = _exact(s0, j0, interest, loss);
        _log("total depletion", s0, j0, e, s1, j1);
        assertEq(j1, 0);
        assertEq(vault.juniorRound(), 1, "round retired");
        assertApproxEqAbs(s1, e.s, 2, "when cover is exhausted, netting and exact ordering agree for senior");
    }

    // ------------------------------ 6. the first transaction after an external liquidation

    function test_Adv_DepositRightAfterExternalLiquidation_DoesNotInheritTheLoss() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        oracle.setPrice(0.3e36);
        _liquidateAll(borrower); // nobody synced
        _junior(cosigner2, 500e18); // deposit syncs first
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner2), 500e18, 1e9, "new cover is priced after the loss is booked");
        uint256 sh = vault.seniorShares(lender);
        vm.prank(lender);
        uint256 out = vault.withdrawSenior(sh);
        assertApproxEqAbs(out, 10_000e18, 1e9);
    }

    // ------------------------------------------------------- item 2 economics

    function test_Adv_BorrowingContinuesWhileUndercovered() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        oracle.setPrice(0.45e36);
        _liquidateAll(borrower);
        vault.sync();
        assertTrue(vault.isUndercovered());
        oracle.setPrice(1e36);
        address b2 = makeAddr("b2");
        _borrowAs(b2, 2_000e18, 1_000e18); // Cosign cannot stop Morpho borrowing
        assertEq(morpho.position(mp.id(), b2).borrowShares > 0, true, "the 19x rule limits deposits, not borrowing");
    }

    function test_Adv_ArmedJuniorRequestCanExitBeforeRealisation() public {
        _junior(cosigner, 500e18);
        _junior(cosigner2, 500e18);
        _senior(lender, 5_000e18);
        _borrowAs(borrower, 1_000e18, 500e18);
        uint256 sh2 = vault.juniorSharesOf(cosigner2);
        vm.prank(cosigner2);
        vault.requestJuniorWithdraw(sh2);
        vm.warp(block.timestamp + 1 hours); // request matured, window open
        oracle.setPrice(0.3e36); // crash, loss not realised
        vm.prank(cosigner2);
        uint256 out = vault.withdrawJunior();
        uint256 c1Before = vault.juniorBalanceOf(cosigner);
        uint256 loss = _liquidateAll(borrower);
        vault.sync();
        console2.log("armed co-signer exited with", out, "; remaining cover paid", c1Before - vault.juniorBalanceOf(cosigner));
        assertApproxEqAbs(out, 500e18, 1e15, "a matured request exits at pre-loss value");
        assertApproxEqAbs(c1Before - vault.juniorBalanceOf(cosigner), loss, 1e9, "the co-signer who stayed paid the whole loss");
    }

    function test_Adv_WipedRoundAccruesPremiumForTheNextRecapitaliser() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18);
        _borrowAs(borrower, 1_000e18, 700e18);
        oracle.setPrice(0.1e36);
        _liquidateAll(borrower);
        vault.sync();
        assertEq(vault.totalJuniorShares(), 0);
        oracle.setPrice(1e36);
        address b2 = makeAddr("b2");
        _borrowAs(b2, 3_000e18, 1_000e18);
        uint256 jBefore = vault.juniorAssets();
        vm.warp(block.timestamp + 365 days);
        vault.sync();
        uint256 accrued = vault.juniorAssets() - jBefore;
        console2.log("junior book accrued while nobody held cover:", accrued);
        _junior(cosigner2, 1e18);
        console2.log("recapitaliser posting 1 MUSD now holds:", vault.juniorBalanceOf(cosigner2));
        assertEq(accrued, 0, "senior pays no premium while no cover exists");
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner2), 1e18, 1e9, "recapitaliser gets exactly what they posted");
    }

    // ----------------------------------------------------------- stale votes

    function test_Adv_PokeScalesDecayedVotesDown_AnyoneCanCall() public {
        _junior(cosigner, 1_000e18);
        ve.set(1, cosigner, 1_000e18);
        _vote(cosigner, 1);
        assertEq(gauge.vaultVotes(address(vault)), 1_000e18);
        ve.set(1, cosigner, 250e18); // lock decayed
        vm.prank(lender); // a stranger
        gauge.poke(1);
        assertEq(gauge.vaultVotes(address(vault)), 250e18, "votes follow current veBTC power");
        assertEq(gauge.accountVotes(address(vault), cosigner), 250e18);
        assertEq(gauge.votedPower(1), 250e18);
        ve.set(1, cosigner, 900e18); // power back up: poke may only lower
        vm.prank(lender);
        vm.expectRevert(CosignGauge.BadInput.selector);
        gauge.poke(1);
        ve.set(1, cosigner, 0); // expired
        gauge.poke(1);
        assertEq(gauge.vaultVotes(address(vault)), 0, "expired lock carries no weight");
        vm.prank(cosigner);
        gauge.reset(1);
        assertEq(gauge.votedPower(1), 0);
    }

    // --------------------------------------------------------------- fuzz

    /// Enforceable guarantee under direct liquidations, for any interest period, crash size, and cover size:
    /// senior's last-synced book falls only by the part of the net loss that exceeds junior's book,
    /// and whatever senior forgoes versus exact ordering is at most the interest since the last sync.
    function testFuzz_Adv_EnforceableGuarantee(uint256 cover, uint256 days_, uint256 price, uint256 borrowAmt) public {
        cover = bound(cover, 10e18, 5_000e18);
        uint256 senior = cover * 19;
        days_ = bound(days_, 0, 365);
        price = bound(price, 0.01e36, 0.6e36);
        borrowAmt = bound(borrowAmt, 1e18, (cover + senior) * 9 / 10);
        _junior(cosigner, cover);
        _senior(lender, senior);
        _borrowAs(borrower, borrowAmt * 100 / 70 + 1, borrowAmt);
        uint256 s0 = vault.seniorAssets();
        uint256 j0 = vault.juniorAssets();
        vm.warp(block.timestamp + days_ * 1 days);
        uint256 interest = morpho.expectedSupplyAssets(mp, address(vault)) - (s0 + j0);
        oracle.setPrice(price);
        uint256 loss = _liquidateAll(borrower);
        vault.sync();
        (uint256 s1, uint256 j1) = (vault.seniorAssets(), vault.juniorAssets());
        Exact memory e = _exact(s0, j0, interest, loss);

        uint256 netLoss = loss > interest ? loss - interest : 0;
        uint256 excess = netLoss > j0 ? netLoss - j0 : 0;
        assertGe(s1 + excess, s0, "senior loses only the net loss beyond cover");
        assertLe(s0 - (s1 < s0 ? s1 : s0), excess, "and never more than that");
        assertLe(e.s > s1 ? e.s - s1 : 0, interest, "forgone vs exact <= interest since last sync");
        assertApproxEqAbs(s1 + j1, e.s + e.j, 2, "conservation");
    }
}
