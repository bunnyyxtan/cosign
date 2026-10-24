// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorpho, MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {MorphoBalancesLib} from "morpho-blue/libraries/periphery/MorphoBalancesLib.sol";
import {CosignPythOracle, IPythPrices} from "../src/CosignPythOracle.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignLiquidator, ISyncableVault} from "../src/CosignLiquidator.sol";
import {Token} from "./CosignPythOracle.t.sol";

/// LOCAL FORK ONLY: PYTH_FORK=1 forge test --match-path test/CosignPythFork.t.sol -vv
/// Reads the real Pyth Core Compatible contract, Morpho Blue, MUSD and Bold's IRM on Mezo testnet, at the latest
/// block. Everything created here exists only in the fork. MEZO is a chain precompile that a fork cannot run, so a
/// scratch ERC20 stands in at its address. The price fall is simulated with vm.mockCall on top of the real feed.
contract CosignPythForkTest is Test {
    using MarketParamsLib for MarketParams;
    using MorphoBalancesLib for IMorpho;

    IPythPrices constant PYTH = IPythPrices(0x933aDeC2C7624b11E4B2b80ACE15BF9a71a31315); // Pyth Core Compatible
    address constant PYTH_DOCUMENTED = 0x2880aB155794e7179c9eE2e38200202908C17B43; // the address in Mezo's docs
    bytes32 constant MEZO_USD = 0x80beaaedbdd228e77c5d62dfcd74b0305674b7e27a5cc6a46e71bd3a696826df;
    bytes32 constant MUSD_USD = 0x0617a9b725011a126a2b9fd53563f4236501f32cf76d877644b943394606c6de;
    IMorpho constant MORPHO = IMorpho(0xC6db4999d8428b259FD198A88d2B8E6494045A48);
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant MEZO = 0x7B7c000000000000000000000000000000000001;
    address constant IRM_BOLD = 0x3482E42af82B46fE9e0547A48178f2f8C8206e6A;
    uint256 constant LLTV = 0.77e18; // already enabled on this Morpho
    uint256 constant MAX_AGE = 3700;

    CosignPythOracle oracle;
    CosignVault vault;
    CosignLiquidator liq;
    MarketParams mp;
    address cosigner = makeAddr("cosigner");
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");
    address keeper = makeAddr("keeper");

    function setUp() public {
        if (!vm.envOr("PYTH_FORK", false)) vm.skip(true, "set PYTH_FORK=1 to run against a Mezo testnet fork");
        vm.createSelectFork("mezo_testnet");
        vm.etch(MEZO, address(new Token("MEZO")).code);
        oracle = new CosignPythOracle(PYTH, MEZO_USD, MUSD_USD, MAX_AGE, 500);
        mp = MarketParams(MUSD, MEZO, address(oracle), IRM_BOLD, LLTV);
        MORPHO.createMarket(mp);
        vault = new CosignVault(
            CosignVault.Config({
                name: "Bold MEZO (Pyth, fork)",
                morpho: MORPHO,
                musd: MUSD,
                collateral: MEZO,
                oracle: address(oracle),
                irm: IRM_BOLD,
                lltv: LLTV,
                rewardToken: MEZO,
                maxLeverage: 19,
                premiumBps: 2500,
                rewardJuniorBps: 3000,
                cooldown: 600,
                withdrawWindow: 1 days,
                rewardDuration: 1 hours
            })
        );
        liq = new CosignLiquidator(MORPHO);
        address[4] memory users = [cosigner, lender, borrower, keeper];
        for (uint256 i; i < users.length; ++i) {
            deal(MUSD, users[i], 10_000e18);
            Token(MEZO).mint(users[i], 1_000_000e18);
            vm.startPrank(users[i]);
            IERC20(MUSD).approve(address(vault), type(uint256).max);
            IERC20(MUSD).approve(address(MORPHO), type(uint256).max);
            IERC20(MUSD).approve(address(liq), type(uint256).max);
            IERC20(MEZO).approve(address(MORPHO), type(uint256).max);
            vm.stopPrank();
        }
        vm.prank(cosigner);
        vault.depositJunior(50e18);
        vm.prank(lender);
        vault.depositSenior(950e18);
    }

    function test_LiveFeeds() public view {
        IPythPrices.Price memory m = PYTH.getPriceUnsafe(MEZO_USD);
        IPythPrices.Price memory u = PYTH.getPriceUnsafe(MUSD_USD);
        console.log("MEZO/USD price e8", uint256(int256(m.price)), "conf e8", m.conf);
        console.log("MUSD/USD price e8", uint256(int256(u.price)), "conf e8", u.conf);
        console.log("ages s", block.timestamp - m.publishTime, block.timestamp - u.publishTime);
        console.log("oracle price (1e36 = 1 MUSD per MEZO)", oracle.price());
        assertEq(oracle.price(), uint256(1e36) * uint256(int256(m.price)) / uint256(int256(u.price)));
        // the address in Mezo's docs has no MEZO/USD feed at all
        (bool ok,) = PYTH_DOCUMENTED.staticcall(abi.encodeCall(IPythPrices.getPriceUnsafe, (MEZO_USD)));
        assertFalse(ok);
    }

    function test_BorrowRepayStaleFallLiquidate() public {
        uint256 p = oracle.price();
        uint256 coll = 100_000e18; // ~336 MUSD of MEZO at today's ~0.0033 USD
        uint256 limit = coll * p / 1e36 * LLTV / 1e18;
        console.log("collateral value", coll * p / 1e36, "borrow limit", limit);
        vm.startPrank(borrower);
        MORPHO.supplyCollateral(mp, coll, borrower, "");
        vm.expectRevert(bytes("insufficient collateral"));
        MORPHO.borrow(mp, limit + 1e18, 0, borrower, borrower);
        uint256 amount = limit * 96 / 100; // ~74% LTV
        MORPHO.borrow(mp, amount, 0, borrower, borrower);
        MORPHO.repay(mp, amount / 10, 0, borrower, ""); // partial repayment
        vm.stopPrank();

        // the real feed goes stale once its publish time is more than MAX_AGE old
        IPythPrices.Price memory m = PYTH.getPriceUnsafe(MEZO_USD);
        vm.warp(m.publishTime + MAX_AGE + 1);
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MEZO_USD, m.publishTime));
        MORPHO.borrow(mp, 1e18, 0, borrower, borrower);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MEZO_USD, m.publishTime));
        liq.liquidate(ISyncableVault(address(vault)), borrower, coll, 0);
        vm.prank(borrower);
        MORPHO.repay(mp, 1e18, 0, borrower, ""); // repaying never reads the oracle

        // simulated next update: MEZO 35% lower, MUSD unchanged, both freshly published
        _mock(MEZO_USD, m.price * 65 / 100, m.conf, m.expo);
        IPythPrices.Price memory u = PYTH.getPriceUnsafe(MUSD_USD);
        _mock(MUSD_USD, u.price, u.conf, u.expo);
        assertLt(coll * oracle.price() / 1e36, MORPHO.expectedBorrowAssets(mp, borrower)); // under water
        vault.sync();
        (uint256 s0, uint256 j0) = (vault.seniorAssets(), vault.juniorAssets());
        uint256 supply0 = MORPHO.market(mp.id()).totalSupplyAssets;
        vm.prank(keeper);
        liq.liquidate(ISyncableVault(address(vault)), borrower, coll, 0);
        uint256 badDebt = supply0 - MORPHO.market(mp.id()).totalSupplyAssets;
        console.log("bad debt", badDebt, "cover paid", j0 - vault.juniorAssets());
        assertEq(MORPHO.position(mp.id(), borrower).borrowShares, 0);
        assertGt(badDebt, 0);
        assertApproxEqAbs(j0 - vault.juniorAssets(), badDebt, 2); // cover paid it all
        assertEq(vault.seniorAssets(), s0); // lenders' booked principal unchanged
    }

    function _mock(bytes32 id, int64 price, uint64 conf, int32 expo) internal {
        vm.mockCall(
            address(PYTH),
            abi.encodeCall(IPythPrices.getPriceUnsafe, (id)),
            abi.encode(IPythPrices.Price(price, conf, expo, block.timestamp))
        );
    }
}
