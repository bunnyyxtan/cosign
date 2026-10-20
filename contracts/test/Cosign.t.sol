// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorpho, MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {MorphoBalancesLib} from "morpho-blue/libraries/periphery/MorphoBalancesLib.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignGauge, IVeBTC} from "../src/CosignGauge.sol";
import {FixedRateIrm} from "../src/FixedRateIrm.sol";
import {AdminOracle} from "../src/AdminOracle.sol";

contract MockToken is ERC20 {
    constructor(string memory s) ERC20(s, s) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

contract MockVeBTC is IVeBTC {
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => uint256) public power;

    function set(uint256 id, address owner, uint256 p) external {
        ownerOf[id] = owner;
        power[id] = p;
    }

    function isApprovedOrOwner(address s, uint256 id) external view returns (bool) {
        return ownerOf[id] == s;
    }

    function balanceOfNFT(uint256 id) external view returns (uint256) {
        return power[id];
    }
}

abstract contract CosignSetup is Test {
    using MarketParamsLib for MarketParams;
    using MorphoBalancesLib for IMorpho;

    uint256 constant LLTV = 0.77e18;
    uint256 constant PRICE = 1e36; // 1 MEZO = 1 MUSD
    uint256 constant EPOCH = 1 hours;

    MockToken musd;
    MockToken mezo;
    MockVeBTC ve;
    IMorpho morpho;
    FixedRateIrm irm;
    AdminOracle oracle;
    CosignVault vault;
    CosignGauge gauge;
    MarketParams mp;

    address cosigner = makeAddr("cosigner");
    address cosigner2 = makeAddr("cosigner2");
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");
    address liquidator = makeAddr("liquidator");

    function setUp() public {
        musd = new MockToken("MUSD");
        mezo = new MockToken("MEZO");
        ve = new MockVeBTC();
        morpho = IMorpho(deployCode("Morpho.sol:Morpho", abi.encode(address(this))));
        irm = new FixedRateIrm(0.1e18);
        oracle = new AdminOracle(address(this), PRICE);
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);
        mp = MarketParams(address(musd), address(mezo), address(oracle), address(irm), LLTV);
        morpho.createMarket(mp);

        vault = new CosignVault(
            CosignVault.Config({
                name: "MEZO 77",
                morpho: morpho,
                musd: address(musd),
                collateral: address(mezo),
                oracle: address(oracle),
                irm: address(irm),
                lltv: LLTV,
                rewardToken: address(mezo),
                maxLeverage: 19,
                premiumBps: 2000,
                rewardJuniorBps: 3000,
                cooldown: 1 hours,
                withdrawWindow: 1 days,
                rewardDuration: EPOCH
            })
        );
        gauge = new CosignGauge(address(this), ve, IERC20(address(mezo)), EPOCH);
        gauge.addVault(address(vault), 1e18); // 1 veBTC power per 1 MUSD of cover (test units)
        vault.setGauge(address(gauge));

        address[5] memory users = [cosigner, cosigner2, lender, borrower, liquidator];
        for (uint256 i; i < users.length; ++i) {
            musd.mint(users[i], 1_000_000e18);
            mezo.mint(users[i], 1_000_000e18);
            vm.startPrank(users[i]);
            musd.approve(address(vault), type(uint256).max);
            musd.approve(address(morpho), type(uint256).max);
            mezo.approve(address(morpho), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ------------------------------------------------------------- helpers

    function _junior(address a, uint256 amt) internal {
        vm.prank(a);
        vault.depositJunior(amt);
    }

    function _senior(address a, uint256 amt) internal {
        vm.prank(a);
        vault.depositSenior(amt);
    }

    function _borrow(uint256 collateral, uint256 amount) internal {
        vm.startPrank(borrower);
        morpho.supplyCollateral(mp, collateral, borrower, "");
        morpho.borrow(mp, amount, 0, borrower, borrower);
        vm.stopPrank();
    }

    /// Crash the price and liquidate all collateral; returns Morpho's realised bad debt.
    function _crashAndLiquidate(uint256 newPrice) internal returns (uint256 badDebt) {
        oracle.setPrice(newPrice);
        uint256 coll = morpho.position(mp.id(), borrower).collateral;
        uint256 supplyBefore = morpho.expectedTotalSupplyAssets(mp);
        vm.prank(liquidator);
        morpho.liquidate(mp, borrower, coll, 0, "");
        badDebt = supplyBefore - morpho.market(mp.id()).totalSupplyAssets;
    }

    function _vote(address who, uint256 tokenId) internal {
        address[] memory t = new address[](1);
        t[0] = address(vault);
        uint256[] memory w = new uint256[](1);
        w[0] = 1;
        vm.prank(who);
        gauge.vote(tokenId, t, w);
    }
}

contract CosignTest is CosignSetup {
    // --------------------------------------------------------------- tests

    function test_JuniorAbsorbsBadDebt_SeniorFlat() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrow(1_000e18, 700e18); // 70% LTV on a 77% LLTV market
        uint256 seniorPriceBefore = vault.seniorSharePrice();
        uint256 lenderBefore = vault.seniorBalanceOf(lender);

        uint256 badDebt = _crashAndLiquidate(0.3e36); // MEZO -70%
        assertGt(badDebt, 0, "bad debt realised");
        assertLt(badDebt, 1_000e18, "fits inside cover");

        vm.expectEmit(false, false, false, false);
        emit CosignVault.LossAbsorbed(0, 0, 0, 0, 0);
        vault.sync();

        assertGe(vault.seniorSharePrice(), seniorPriceBefore, "senior share price flat");
        assertGe(vault.seniorBalanceOf(lender), lenderBefore, "lender whole");
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner), 1_000e18 - badDebt, 1e6, "junior paid the loss");
    }

    function test_LossBeyondJunior_SplitsAndWipes_ThenRecapitalises() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18); // exactly 19x
        _borrow(1_000e18, 700e18);
        (uint256 s0, uint256 j0) = vault.previewBooks();

        uint256 badDebt = _crashAndLiquidate(0.1e36);
        assertGt(badDebt, j0, "loss exceeds cover");
        vault.sync();
        (uint256 s1, uint256 j1) = vault.previewBooks();

        assertEq((s0 - s1) + (j0 - j1), badDebt, "byJunior + bySenior == loss");
        assertEq(j1, 0, "junior fully used first");
        assertEq(vault.juniorRound(), 1, "round retired");
        assertEq(vault.totalJuniorShares(), 0);
        assertEq(vault.juniorSharesOf(cosigner), 0, "old cover void");
        assertTrue(vault.isUndercovered());

        // Recapitalise: new cover is not diluted by dead shares.
        _junior(cosigner2, 500e18);
        assertApproxEqAbs(vault.juniorBalanceOf(cosigner2), 500e18, 1e6);
        assertEq(vault.juniorBalanceOf(cosigner), 0);
    }

    function test_SeniorCapacityEnforced() public {
        vm.expectRevert(abi.encodeWithSelector(CosignVault.CapacityExceeded.selector, 0));
        _senior(lender, 1e18); // no cover, no lending

        _junior(cosigner, 100e18);
        assertApproxEqAbs(vault.capacity(), 1_900e18, 1e6);
        _senior(lender, 1_900e18);
        vm.expectRevert();
        _senior(lender, 1e18);
        assertEq(vault.coverageBps(), 500); // 5%
    }

    function test_JuniorWithdraw_CooldownWindowCoverage() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_000e18);
        uint256 shares = vault.juniorSharesOf(cosigner);

        vm.prank(cosigner);
        vm.expectRevert(CosignVault.NoRequest.selector);
        vault.withdrawJunior();

        vm.prank(cosigner);
        vault.requestJuniorWithdraw(shares);
        vm.prank(cosigner);
        vm.expectRevert();
        vault.withdrawJunior(); // cooldown

        vm.warp(block.timestamp + 1 hours);
        vm.prank(cosigner);
        vm.expectRevert(CosignVault.Undercovered.selector);
        vault.withdrawJunior(); // would leave 1,000 senior with no cover

        vm.prank(cosigner);
        vault.requestJuniorWithdraw(shares / 2); // 50 left covers 950 >= 1,000? no: 50*19=950 < 1000
        vm.warp(block.timestamp + 1 hours);
        vm.prank(cosigner);
        vm.expectRevert(CosignVault.Undercovered.selector);
        vault.withdrawJunior();

        vm.prank(cosigner);
        vault.requestJuniorWithdraw(shares / 10); // 90 left covers 1,710
        vm.warp(block.timestamp + 2 days);
        vm.prank(cosigner);
        vm.expectRevert(CosignVault.RequestExpired.selector);
        vault.withdrawJunior();

        vm.prank(cosigner);
        vault.requestJuniorWithdraw(shares / 10);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(cosigner);
        uint256 got = vault.withdrawJunior();
        assertApproxEqAbs(got, 10e18, 1e6);
    }

    function test_JuniorFullExitBlockedWhileVoting() public {
        _junior(cosigner, 100e18);
        ve.set(1, cosigner, 50e18);
        _vote(cosigner, 1);

        uint256 shares = vault.juniorSharesOf(cosigner);
        vm.prank(cosigner);
        vault.requestJuniorWithdraw(shares);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(cosigner);
        vm.expectRevert(CosignVault.VotesActive.selector);
        vault.withdrawJunior();

        vm.prank(cosigner);
        gauge.reset(1);
        vm.prank(cosigner);
        vault.withdrawJunior();
        assertEq(vault.juniorSharesOf(cosigner), 0);
    }

    function test_InterestSplit_JuniorEarnsPremium() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 10_000e18);
        _borrow(20_000e18, 11_000e18); // fully utilised
        vm.warp(block.timestamp + 365 days);
        vault.sync();
        (uint256 s, uint256 j) = vault.previewBooks();
        uint256 interest = (s + j) - 11_000e18;
        uint256 seniorShareOfInterest = interest * 10_000 / 11_000;
        uint256 premium = seniorShareOfInterest * 2000 / 10_000;
        assertApproxEqRel(s - 10_000e18, seniorShareOfInterest - premium, 1e12);
        assertApproxEqRel(j - 1_000e18, interest - seniorShareOfInterest + premium, 1e12);
        assertGt((j - 1_000e18) * 1e18 / 1_000e18, (s - 10_000e18) * 1e18 / 10_000e18, "junior APR > senior APR");
    }

    function test_InflationAttackUnprofitable() public {
        _junior(cosigner2, 1); // attacker: 1 wei of cover
        // Attacker donates MUSD to the vault's Morpho position.
        vm.prank(cosigner2);
        morpho.supply(mp, 1_000e18, 0, address(vault), "");
        _junior(cosigner, 1_000e18); // victim
        assertGt(vault.juniorBalanceOf(cosigner), 999e18, "victim keeps ~all value");
    }

    function test_Gauge_NoCoverNoVote_WeightCapped_OneVotePerEpoch() public {
        ve.set(1, cosigner, 500e18);
        address[] memory t = new address[](1);
        t[0] = address(vault);
        uint256[] memory w = new uint256[](1);
        w[0] = 1;

        vm.prank(cosigner);
        vm.expectRevert(CosignGauge.NoCover.selector);
        gauge.vote(1, t, w);

        _junior(cosigner, 100e18);
        vm.prank(cosigner);
        gauge.vote(1, t, w);
        assertEq(gauge.vaultVotes(address(vault)), 500e18);
        assertApproxEqAbs(gauge.weightOf(address(vault)), 100e18, 1e6, "weight capped by cover");

        vm.prank(cosigner);
        vm.expectRevert(CosignGauge.AlreadyVoted.selector);
        gauge.vote(1, t, w);

        vm.warp(block.timestamp + EPOCH);
        vm.prank(cosigner);
        gauge.vote(1, t, w); // new epoch ok

        vm.prank(lender); // not the owner
        vm.expectRevert(CosignGauge.NotApproved.selector);
        gauge.vote(1, t, w);
    }

    function test_Gauge_DistributeAndClaim() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 9_000e18);
        ve.set(1, cosigner, 100e18);
        _vote(cosigner, 1);

        mezo.approve(address(gauge), 1_000e18);
        mezo.mint(address(this), 1_000e18);
        gauge.fund(1_000e18);
        uint256 e = gauge.currentEpoch();
        vm.expectRevert(CosignGauge.EpochNotOver.selector);
        gauge.distribute(e);

        vm.warp(block.timestamp + EPOCH);
        gauge.distribute(e);
        vm.warp(block.timestamp + EPOCH); // stream finishes

        uint256 cBefore = mezo.balanceOf(cosigner);
        uint256 lBefore = mezo.balanceOf(lender);
        vm.prank(cosigner);
        vault.claimRewards();
        vm.prank(lender);
        vault.claimRewards();
        assertApproxEqRel(mezo.balanceOf(cosigner) - cBefore, 300e18, 1e15, "30% to cover");
        assertApproxEqRel(mezo.balanceOf(lender) - lBefore, 700e18, 1e15, "70% to lenders");
    }

    function test_Gauge_NoWeightAfterWipe_CleanRemovesStaleVotes() public {
        _junior(cosigner, 100e18);
        _senior(lender, 1_900e18);
        ve.set(1, cosigner, 100e18);
        _vote(cosigner, 1);
        _borrow(1_000e18, 700e18);
        _crashAndLiquidate(0.1e36);
        vault.sync();

        assertEq(gauge.weightOf(address(vault)), 0, "wiped vault earns nothing");
        gauge.clean(1, address(vault)); // anyone
        assertEq(gauge.vaultVotes(address(vault)), 0);
        assertEq(gauge.accountVotes(address(vault), cosigner), 0);
    }

    function test_RewardsEarnedBeforeWipeStayClaimable() public {
        _junior(cosigner, 1_000e18);
        _senior(lender, 1_000e18);
        ve.set(1, cosigner, 100e18);
        _vote(cosigner, 1);
        mezo.mint(address(this), 100e18);
        mezo.approve(address(gauge), 100e18);
        gauge.fund(100e18);
        uint256 e = gauge.currentEpoch();
        vm.warp(block.timestamp + EPOCH);
        gauge.distribute(e);
        vm.warp(block.timestamp + EPOCH);
        uint256 owed = vault.pendingRewards(cosigner);
        assertGt(owed, 0);

        _borrow(3_000e18, 1_900e18);
        _crashAndLiquidate(0.01e36);
        vault.sync();
        assertEq(vault.juniorRound(), 1);
        assertEq(vault.pendingRewards(cosigner), owed, "earned rewards survive the wipe");
        vm.prank(cosigner);
        assertEq(vault.claimRewards(), owed);
    }

    /// Waterfall holds for any crash size and cover size.
    function testFuzz_LossWaterfall(uint256 crashPrice, uint256 cover, uint256 borrowAmt) public {
        cover = bound(cover, 10e18, 5_000e18);
        uint256 senior = cover * 19;
        borrowAmt = bound(borrowAmt, 1e18, (cover + senior) * 9 / 10);
        crashPrice = bound(crashPrice, 0.001e36, 0.6e36);
        _junior(cosigner, cover);
        _senior(lender, senior);
        uint256 coll = borrowAmt * 100 / 70 + 1; // ~70% LTV, unhealthy for any crash below 0.77/0.7
        mezo.mint(borrower, coll);
        _borrow(coll, borrowAmt);
        (uint256 s0, uint256 j0) = vault.previewBooks();
        uint256 sp0 = vault.seniorSharePrice();

        uint256 badDebt = _crashAndLiquidate(crashPrice);
        vault.sync();
        (uint256 s1, uint256 j1) = vault.previewBooks();

        assertEq((s0 - s1) + (j0 - j1), badDebt, "conservation");
        if (badDebt <= j0) {
            assertEq(s1, s0, "senior untouched while cover lasts");
            assertGe(vault.seniorSharePrice(), sp0);
        } else {
            assertEq(j1, 0, "junior exhausted before senior");
        }
    }

}
