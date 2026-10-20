// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignGauge} from "../src/CosignGauge.sol";
import {CosignLiquidator, ISyncableVault} from "../src/CosignLiquidator.sol";
import {CosignSetup} from "./Cosign.t.sol";

/// MUSD stand-in that re-enters a target during transferFrom, to prove the vault's reentrancy guard.
contract ReentrantToken is ERC20 {
    address public target;
    bytes public payload;

    constructor() ERC20("RMUSD", "RMUSD") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function arm(address t, bytes calldata p) external {
        target = t;
        payload = p;
    }

    function transferFrom(address f, address to, uint256 a) public override returns (bool) {
        if (target != address(0)) {
            address t = target;
            target = address(0);
            (bool ok, bytes memory ret) = t.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        return super.transferFrom(f, to, a);
    }
}

contract CosignEdgeTest is CosignSetup {
    using MarketParamsLib for MarketParams;

    function _newVault(address loan, uint256 lltv) internal returns (CosignVault v) {
        if (!morpho.isLltvEnabled(lltv)) morpho.enableLltv(lltv);
        morpho.createMarket(MarketParams(loan, address(mezo), address(oracle), address(irm), lltv));
        v = new CosignVault(
            CosignVault.Config({
                name: "test",
                morpho: morpho,
                musd: loan,
                collateral: address(mezo),
                oracle: address(oracle),
                irm: address(irm),
                lltv: lltv,
                rewardToken: address(mezo),
                maxLeverage: 19,
                premiumBps: 2000,
                rewardJuniorBps: 3000,
                cooldown: 1 hours,
                withdrawWindow: 1 days,
                rewardDuration: EPOCH
            })
        );
    }

    // ---------------------------------------------- liquidation ordering

    function test_Liquidator_BooksInterestBeforeLoss() public {
        CosignLiquidator liq = new CosignLiquidator(morpho);
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrow(1_000e18, 500e18);
        vm.warp(block.timestamp + 30 days);
        (uint256 sPre,) = vault.previewBooks();
        assertGt(sPre, vault.seniorAssets(), "senior has unbooked interest");
        oracle.setPrice(0.3e36);
        uint256 coll = morpho.position(mp.id(), borrower).collateral;
        uint256 mezoBefore = mezo.balanceOf(liquidator);
        vm.startPrank(liquidator);
        musd.approve(address(liq), type(uint256).max);
        liq.liquidate(ISyncableVault(address(vault)), borrower, coll, 0);
        vm.stopPrank();
        (uint256 s1, uint256 j1) = vault.previewBooks();
        assertEq(s1, sPre, "senior keeps all interest earned before the loss");
        assertLt(j1, 1_000e18, "junior took the loss");
        assertEq(mezo.balanceOf(liquidator) - mezoBefore, coll, "seized collateral forwarded to caller");
    }

    function test_Liquidator_CallbackOnlyFromMorpho() public {
        CosignLiquidator liq = new CosignLiquidator(morpho);
        vm.expectRevert(CosignLiquidator.OnlyMorpho.selector);
        liq.onMorphoLiquidate(1, abi.encode(lender, address(musd)));
    }

    /// Known limitation, pinned: a liquidation sent straight to Morpho nets senior's unsynced interest.
    function test_DirectLiquidation_NetsUnsyncedSeniorInterest() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrow(1_000e18, 500e18);
        uint256 booked = vault.seniorAssets();
        vm.warp(block.timestamp + 30 days);
        (uint256 sPre,) = vault.previewBooks();
        _crashAndLiquidate(0.3e36);
        vault.sync();
        (uint256 s1,) = vault.previewBooks();
        assertEq(s1, booked, "senior forgoes interest accrued since the last sync");
        assertLt(s1, sPre);
    }

    // --------------------------------------------------------- liquidity

    function test_SeniorWithdraw_LimitedByMorphoLiquidity() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrow(20_000e18, 10_900e18); // 100 MUSD left unborrowed
        uint256 shares = vault.seniorShares(lender);
        vm.prank(lender);
        vm.expectRevert(bytes("insufficient liquidity"));
        vault.withdrawSenior(shares);
        vm.prank(lender);
        uint256 got = vault.withdrawSenior(shares / 200); // ~50 MUSD fits
        assertApproxEqAbs(got, 50e18, 1e6);
    }

    // ------------------------------------------------------ authorization

    function test_Unauthorized_AdminAndOwnerPaths() public {
        vm.prank(lender);
        vm.expectRevert();
        oracle.setPrice(1);
        vm.prank(lender);
        vm.expectRevert(CosignVault.OnlyGauge.selector);
        vault.notifyReward(1);
        vm.prank(lender);
        vm.expectRevert(CosignVault.OnlyDeployer.selector);
        vault.setGauge(lender);
        vm.expectRevert(CosignVault.GaugeAlreadySet.selector);
        vault.setGauge(lender);
        vm.prank(lender);
        vm.expectRevert();
        gauge.addVault(lender, 1);

        ve.set(7, cosigner, 1e18);
        _junior(cosigner, 10e18);
        _vote(cosigner, 7);
        vm.prank(lender);
        vm.expectRevert(CosignGauge.NotApproved.selector);
        gauge.reset(7);
        vm.prank(lender);
        vm.expectRevert(CosignGauge.StillCovered.selector);
        gauge.clean(7, address(vault));
    }

    function test_CannotTouchOtherAccounts() public {
        _junior(cosigner, 100e18);
        _senior(lender, 500e18);
        vm.startPrank(cosigner2);
        vm.expectRevert(CosignVault.InsufficientShares.selector);
        vault.withdrawSenior(1);
        vm.expectRevert(CosignVault.InsufficientShares.selector);
        vault.requestJuniorWithdraw(1);
        vm.expectRevert(CosignVault.NoRequest.selector);
        vault.withdrawJunior();
        assertEq(vault.claimRewards(), 0);
        vm.stopPrank();
    }

    // ----------------------------------------------- accounting isolation

    function test_MultiUser_IsolationAndProRataLoss() public {
        _junior(cosigner, 300e18);
        _junior(cosigner2, 100e18);
        _senior(lender, 1_000e18);
        address lender2 = makeAddr("lender2");
        musd.mint(lender2, 1_000e18);
        vm.startPrank(lender2);
        musd.approve(address(vault), type(uint256).max);
        vault.depositSenior(500e18);
        vm.stopPrank();
        _borrow(1_000e18, 500e18);
        uint256 loss = _crashAndLiquidate(0.3e36);
        vault.sync();
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner), 300e18 - loss * 3 / 4, 1e9, "cover loss pro rata 3:1");
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner2), 100e18 - loss / 4, 1e9);
        assertApproxEqAbs(vault.seniorBalanceOf(lender), 1_000e18, 1e9, "lenders untouched");
        assertApproxEqAbs(vault.seniorBalanceOf(lender2), 500e18, 1e9);
        uint256 before = vault.seniorBalanceOf(lender2);
        uint256 sh = vault.seniorShares(lender);
        vm.prank(lender);
        vault.withdrawSenior(sh);
        assertApproxEqAbs(vault.seniorBalanceOf(lender2), before, 1e9, "one exit does not move another account's value");
    }

    function test_Undercovered_AfterRealLoss_ThenRecovers() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18);
        _borrow(1_000e18, 500e18);
        _crashAndLiquidate(0.45e36); // loss ~81 < cover 100, but leaves senior > 19x cover
        vault.sync();
        (uint256 s, uint256 j) = vault.previewBooks();
        assertGt(j, 0);
        assertGt(s, j * 19);
        assertTrue(vault.isUndercovered());
        assertEq(vault.capacity(), 0);
        vm.expectRevert();
        _senior(lender, 1e18);
        uint256 sh = vault.juniorSharesOf(cosigner);
        vm.prank(cosigner);
        vault.requestJuniorWithdraw(sh / 10);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(cosigner);
        vm.expectRevert(CosignVault.Undercovered.selector);
        vault.withdrawJunior();
        _junior(cosigner2, 100e18); // recapitalise
        assertFalse(vault.isUndercovered());
        assertGt(vault.capacity(), 0);
    }

    function test_WipedRound_DoesNotReviveOnRecap() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18);
        _borrow(1_000e18, 700e18);
        _crashAndLiquidate(0.1e36);
        vault.sync();
        assertEq(vault.juniorRound(), 1);
        _junior(cosigner2, 1_000e18);
        assertEq(vault.juniorSharesOf(cosigner), 0, "old shares stay void");
        assertEq(vault.juniorBalanceOf(cosigner), 0);
        vm.prank(cosigner);
        vm.expectRevert(CosignVault.InsufficientShares.selector);
        vault.requestJuniorWithdraw(1);
        vm.prank(cosigner);
        vault.depositJunior(10e18); // returning co-signer starts fresh in the new round
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner), 10e18, 1e6);
    }

    // ------------------------------------------------------------- votes

    function test_WeightFollowsCoverWithdrawal() public {
        _junior(cosigner, 100e18);
        ve.set(1, cosigner, 1_000e18);
        _vote(cosigner, 1);
        assertApproxEqAbs(gauge.weightOf(address(vault)), 100e18, 1e6);
        uint256 sh = vault.juniorSharesOf(cosigner);
        vm.prank(cosigner);
        vault.requestJuniorWithdraw(sh / 2);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(cosigner);
        vault.withdrawJunior();
        assertApproxEqAbs(gauge.weightOf(address(vault)), 50e18, 1e6, "weight follows live cover");
    }

    // ----------------------------------------------------------- rewards

    function test_TwoVaults_SplitByWeight_NoOverDistribution_NoDoubleClaim() public {
        CosignVault v2 = _newVault(address(musd), 0.625e18);
        v2.setGauge(address(gauge));
        gauge.addVault(address(v2), 1e18);
        vm.prank(cosigner);
        musd.approve(address(v2), type(uint256).max);
        _junior(cosigner, 300e18);
        vm.prank(cosigner);
        v2.depositJunior(100e18);
        ve.set(1, cosigner, 1_000e18);
        address[] memory t = new address[](2);
        t[0] = address(vault);
        t[1] = address(v2);
        uint256[] memory w = new uint256[](2);
        w[0] = 1;
        w[1] = 1;
        vm.prank(cosigner);
        gauge.vote(1, t, w); // 500 votes each; cover caps 300 and 100
        mezo.mint(address(this), 1_000e18);
        mezo.approve(address(gauge), 1_000e18);
        gauge.fund(1_000e18);
        uint256 e = gauge.currentEpoch();
        vm.warp(block.timestamp + EPOCH);
        gauge.distribute(e);
        assertApproxEqAbs(mezo.balanceOf(address(vault)), 750e18, 1e6, "3/4 by capped weight");
        assertApproxEqAbs(mezo.balanceOf(address(v2)), 250e18, 1e6);
        assertEq(mezo.balanceOf(address(gauge)) + mezo.balanceOf(address(vault)) + mezo.balanceOf(address(v2)), 1_000e18, "nothing created");
        vm.expectRevert(CosignGauge.AlreadyDistributed.selector);
        gauge.distribute(e);
        vm.warp(block.timestamp + EPOCH);
        vm.startPrank(cosigner);
        assertApproxEqAbs(vault.claimRewards(), 750e18, 1e9);
        assertApproxEqAbs(v2.claimRewards(), 250e18, 1e9);
        assertEq(vault.claimRewards(), 0, "no double claim");
        assertEq(v2.claimRewards(), 0);
        vm.stopPrank();
    }

    // -------------------------------------------------------- reentrancy

    function test_Reentrancy_GuardBlocksTokenCallback() public {
        ReentrantToken r = new ReentrantToken();
        CosignVault rv = _newVault(address(r), 0.77e18);
        r.mint(cosigner, 1_000e18);
        vm.startPrank(cosigner);
        r.approve(address(rv), type(uint256).max);
        r.arm(address(rv), abi.encodeCall(CosignVault.depositJunior, (1e18)));
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        rv.depositJunior(100e18);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ rounding

    /// Depositing then withdrawing never returns more than was put in.
    function testFuzz_RoundTripNoFreeValue(uint256 cover, uint256 amt) public {
        cover = bound(cover, 1e12, 50_000e18); // 19x stays within the lender's 1M test balance
        amt = bound(amt, 1e6, cover * 19);
        _junior(cosigner, cover);
        uint256 b0 = musd.balanceOf(lender);
        _senior(lender, amt);
        uint256 sh = vault.seniorShares(lender);
        vm.prank(lender);
        vault.withdrawSenior(sh);
        assertLe(musd.balanceOf(lender), b0, "no profit from a round trip");
        assertApproxEqAbs(musd.balanceOf(lender), b0, 2, "loses at most rounding dust");
    }
}
