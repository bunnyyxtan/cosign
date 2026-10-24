// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IMorpho, MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {MorphoBalancesLib} from "morpho-blue/libraries/periphery/MorphoBalancesLib.sol";
import {CosignPythOracle, IPythPrices} from "../src/CosignPythOracle.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignLiquidator, ISyncableVault} from "../src/CosignLiquidator.sol";
import {FixedRateIrm} from "../src/FixedRateIrm.sol";

contract Token is ERC20 {
    constructor(string memory s) ERC20(s, s) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// Stores whatever price the test sets, like a Pyth contract after an update.
contract MockPyth is IPythPrices {
    mapping(bytes32 => Price) internal prices;

    function set(bytes32 id, int64 p, uint64 conf, int32 expo, uint256 publishTime) external {
        prices[id] = Price(p, conf, expo, publishTime);
    }

    function getPriceUnsafe(bytes32 id) external view returns (Price memory) {
        return prices[id];
    }
}

abstract contract PythBase is Test {
    bytes32 constant MEZO_USD = 0x80beaaedbdd228e77c5d62dfcd74b0305674b7e27a5cc6a46e71bd3a696826df;
    bytes32 constant MUSD_USD = 0x0617a9b725011a126a2b9fd53563f4236501f32cf76d877644b943394606c6de;
    uint256 constant MAX_AGE = 3700; // the sponsored feeds' 1 hour heartbeat plus 100 s
    uint256 constant MAX_CONF = 500; // 5%
    MockPyth pyth;
    CosignPythOracle oracle;

    function _setUpOracle() internal {
        vm.warp(1_792_828_000);
        pyth = new MockPyth();
        oracle = new CosignPythOracle(pyth, MEZO_USD, MUSD_USD, MAX_AGE, MAX_CONF);
        // the live Mezo testnet values read on 24 Oct 2026: MEZO 0.003328 USD, MUSD 0.98944261 USD
        _setMezo(332_800, 3_800);
        pyth.set(MUSD_USD, 98_944_261, 77_912, -8, block.timestamp);
    }

    function _setMezo(int64 p, uint64 conf) internal {
        pyth.set(MEZO_USD, p, conf, -8, block.timestamp);
    }
}

contract CosignPythOracleTest is PythBase {
    function setUp() public {
        _setUpOracle();
    }

    function test_PriceAtMorphoScale() public view {
        // 1e36 * 0.003328 / 0.98944261 MUSD per MEZO
        assertEq(oracle.price(), uint256(1e36) * 332_800 / 98_944_261);
        assertApproxEqRel(oracle.price(), 3.3635e33, 0.0001e18);
    }

    function test_DifferentExponents() public {
        pyth.set(MEZO_USD, 33_280_000, 380_000, -10, block.timestamp); // same 0.003328 at expo -10
        assertEq(oracle.price(), uint256(1e36) * 332_800 / 98_944_261);
        pyth.set(MUSD_USD, 1, 0, 0, block.timestamp); // MUSD exactly 1 at expo 0
        assertEq(oracle.price(), 0.003328e36);
    }

    function test_Stale_RevertsPastMaxAge_TwoSided() public {
        vm.warp(block.timestamp + MAX_AGE);
        oracle.price(); // exactly at the limit is accepted
        vm.warp(block.timestamp + 1);
        vm.expectRevert(
            abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MEZO_USD, block.timestamp - MAX_AGE - 1)
        );
        oracle.price();
        // a fresh MEZO price does not hide a stale MUSD price
        _setMezo(332_800, 3_800);
        vm.expectRevert(
            abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MUSD_USD, block.timestamp - MAX_AGE - 1)
        );
        oracle.price();
        // a publish time too far in the future is refused too
        pyth.set(MUSD_USD, 98_944_261, 77_912, -8, block.timestamp + MAX_AGE + 1);
        vm.expectRevert(
            abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MUSD_USD, block.timestamp + MAX_AGE + 1)
        );
        oracle.price();
    }

    function test_NeverPublished_IsStale() public {
        pyth.set(MEZO_USD, 0, 0, 0, 0); // what an unknown feed looks like: all zero
        vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.InvalidPrice.selector, MEZO_USD));
        oracle.price();
    }

    function test_InvalidPrices() public {
        int64[2] memory bad = [int64(0), int64(-332_800)];
        for (uint256 i; i < 2; ++i) {
            _setMezo(bad[i], 0);
            vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.InvalidPrice.selector, MEZO_USD));
            oracle.price();
        }
        int32[2] memory badExpo = [int32(1), int32(-19)];
        for (uint256 i; i < 2; ++i) {
            pyth.set(MEZO_USD, 332_800, 0, badExpo[i], block.timestamp);
            vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.InvalidPrice.selector, MEZO_USD));
            oracle.price();
        }
        // a price that rounds to zero at Morpho's scale is refused, not returned as 0
        pyth.set(MEZO_USD, 1, 0, -18, block.timestamp);
        pyth.set(MUSD_USD, type(int64).max, 0, 0, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.InvalidPrice.selector, MEZO_USD));
        oracle.price();
    }

    function test_Confidence() public {
        _setMezo(332_800, 16_640); // exactly 5%
        oracle.price();
        _setMezo(332_800, 16_641);
        vm.expectRevert(abi.encodeWithSelector(CosignPythOracle.WideConfidence.selector, MEZO_USD));
        oracle.price();
    }

    function test_ConstructorLimits() public {
        vm.expectRevert("bad limits");
        new CosignPythOracle(pyth, MEZO_USD, MUSD_USD, 0, MAX_CONF);
        vm.expectRevert("bad limits");
        new CosignPythOracle(pyth, MEZO_USD, MUSD_USD, MAX_AGE, 10_001);
        vm.expectRevert("bad feed");
        new CosignPythOracle(pyth, bytes32(0), MUSD_USD, MAX_AGE, MAX_CONF);
    }

    /// Any positive price at any accepted exponent either prices or reverts InvalidPrice; it never overflows.
    function testFuzz_NoOverflow(int64 b, int64 q, int32 be, int32 qe) public {
        b = int64(bound(b, 1, type(int64).max));
        q = int64(bound(q, 1, type(int64).max));
        be = int32(bound(be, -18, 0));
        qe = int32(bound(qe, -18, 0));
        pyth.set(MEZO_USD, b, 0, be, block.timestamp);
        pyth.set(MUSD_USD, q, 0, qe, block.timestamp);
        try oracle.price() returns (uint256 p) {
            assertGt(p, 0);
        } catch (bytes memory err) {
            assertEq(bytes4(err), CosignPythOracle.InvalidPrice.selector);
        }
    }
}

/// The oracle behind a Morpho market and a Cosign vault, at realistic prices: borrow, repay, freeze while stale,
/// then a crash, a liquidation through CosignLiquidator and the loss charged to cover first.
contract CosignPythMarketTest is PythBase {
    using MarketParamsLib for MarketParams;
    using MorphoBalancesLib for IMorpho;

    uint256 constant LLTV = 0.77e18;
    Token musd;
    Token mezo;
    IMorpho morpho;
    CosignVault vault;
    CosignLiquidator liq;
    MarketParams mp;
    address cosigner = makeAddr("cosigner");
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");
    address keeper = makeAddr("keeper");

    function setUp() public {
        _setUpOracle();
        musd = new Token("MUSD");
        mezo = new Token("MEZO");
        morpho = IMorpho(deployCode("Morpho.sol:Morpho", abi.encode(address(this))));
        FixedRateIrm irm = new FixedRateIrm(0.1e18);
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);
        mp = MarketParams(address(musd), address(mezo), address(oracle), address(irm), LLTV);
        morpho.createMarket(mp);
        vault = new CosignVault(
            CosignVault.Config({
                name: "Bold MEZO (Pyth)",
                morpho: morpho,
                musd: address(musd),
                collateral: address(mezo),
                oracle: address(oracle),
                irm: address(irm),
                lltv: LLTV,
                rewardToken: address(mezo),
                maxLeverage: 19,
                premiumBps: 2500,
                rewardJuniorBps: 3000,
                cooldown: 600,
                withdrawWindow: 1 days,
                rewardDuration: 1 hours
            })
        );
        liq = new CosignLiquidator(morpho);
        address[4] memory users = [cosigner, lender, borrower, keeper];
        for (uint256 i; i < users.length; ++i) {
            musd.mint(users[i], 1_000_000e18);
            mezo.mint(users[i], 1_000_000e18);
            vm.startPrank(users[i]);
            musd.approve(address(vault), type(uint256).max);
            musd.approve(address(morpho), type(uint256).max);
            musd.approve(address(liq), type(uint256).max);
            mezo.approve(address(morpho), type(uint256).max);
            vm.stopPrank();
        }
        vm.prank(cosigner);
        vault.depositJunior(50e18);
        vm.prank(lender);
        vault.depositSenior(950e18);
    }

    function test_BorrowRepay_FreezeWhileStale_FallLiquidate_CoverPaysAll() public {
        // 100,000 MEZO at 0.003328 / 0.98944 ≈ 336.35 MUSD of collateral; limit at 77% ≈ 258.99 MUSD
        uint256 coll = 100_000e18;
        uint256 value = coll * oracle.price() / 1e36;
        assertApproxEqRel(value, 336.35e18, 0.0001e18);
        vm.startPrank(borrower);
        morpho.supplyCollateral(mp, coll, borrower, "");
        vm.expectRevert(bytes("insufficient collateral"));
        morpho.borrow(mp, value * 78 / 100, 0, borrower, borrower); // above 77%
        morpho.borrow(mp, 250e18, 0, borrower, borrower); // 74.3% LTV
        vm.stopPrank();

        // an hour and a bit with no update: borrowing, collateral withdrawal and liquidation all stop
        vm.warp(block.timestamp + MAX_AGE + 1);
        vm.startPrank(borrower);
        vm.expectRevert(
            abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MEZO_USD, block.timestamp - MAX_AGE - 1)
        );
        morpho.borrow(mp, 1e18, 0, borrower, borrower);
        vm.expectRevert(
            abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MEZO_USD, block.timestamp - MAX_AGE - 1)
        );
        morpho.withdrawCollateral(mp, 1e18, borrower, borrower);
        // repaying does not read the oracle, so a borrower can always pay down while the feed is stale
        morpho.repay(mp, 20e18, 0, borrower, "");
        vm.stopPrank();
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(CosignPythOracle.StalePrice.selector, MEZO_USD, block.timestamp - MAX_AGE - 1)
        );
        liq.liquidate(ISyncableVault(address(vault)), borrower, coll, 0);

        // the next update brings a 35% fall (this week's range was 0.00264 to 0.00484 USD): cover absorbs all of it
        (uint256 juniorLoss, uint256 seniorLoss, uint256 badDebt) = _fallAndLiquidate(216_320, coll);
        assertGt(badDebt, 0);
        assertApproxEqAbs(juniorLoss, badDebt, 2); // Morpho and the vault round a wei apart
        assertEq(seniorLoss, 0);
    }

    /// A 45% fall at 74% LTV leaves more bad debt than Bold's 5% cover: cover is used up first, lenders take the rest.
    function test_DeepFall_CoverFirstThenLenders() public {
        uint256 coll = 100_000e18;
        vm.startPrank(borrower);
        morpho.supplyCollateral(mp, coll, borrower, "");
        morpho.borrow(mp, 250e18, 0, borrower, borrower);
        vm.stopPrank();
        (uint256 juniorLoss, uint256 seniorLoss, uint256 badDebt) = _fallAndLiquidate(183_040, coll);
        assertEq(vault.juniorAssets(), 0);
        assertEq(juniorLoss, 50e18);
        assertApproxEqAbs(juniorLoss + seniorLoss, badDebt, 2); // the whole loss is charged, cover first
        assertGt(seniorLoss, 0);
    }

    /// Fresh prices with MEZO at `mezoPrice` (expo -8), then liquidate all collateral through CosignLiquidator.
    function _fallAndLiquidate(int64 mezoPrice, uint256 coll)
        internal
        returns (uint256 juniorLoss, uint256 seniorLoss, uint256 badDebt)
    {
        _setMezo(mezoPrice, uint64(mezoPrice) / 100);
        pyth.set(MUSD_USD, 98_944_261, 77_912, -8, block.timestamp);
        assertLt(coll * oracle.price() / 1e36, morpho.expectedBorrowAssets(mp, borrower)); // under water
        vault.sync(); // book interest first so the difference below is the loss alone
        (uint256 s0, uint256 j0) = (vault.seniorAssets(), vault.juniorAssets());
        uint256 supply0 = morpho.market(mp.id()).totalSupplyAssets;
        vm.prank(keeper);
        liq.liquidate(ISyncableVault(address(vault)), borrower, coll, 0);
        assertEq(morpho.position(mp.id(), borrower).collateral, 0);
        assertEq(morpho.position(mp.id(), borrower).borrowShares, 0); // Morpho realised the rest as bad debt
        badDebt = supply0 - morpho.market(mp.id()).totalSupplyAssets;
        juniorLoss = j0 - vault.juniorAssets();
        seniorLoss = s0 - vault.seniorAssets();
    }

    function test_RepayInFull_ThenWithdrawCollateral() public {
        vm.startPrank(borrower);
        morpho.supplyCollateral(mp, 10_000e18, borrower, "");
        morpho.borrow(mp, 10e18, 0, borrower, borrower);
        vm.warp(block.timestamp + 1 days); // interest accrues; the feed is stale by now
        _setMezo(332_800, 3_800); // a fresh update lands
        pyth.set(MUSD_USD, 98_944_261, 77_912, -8, block.timestamp);
        morpho.repay(mp, 0, morpho.position(mp.id(), borrower).borrowShares, borrower, "");
        morpho.withdrawCollateral(mp, 10_000e18, borrower, borrower);
        vm.stopPrank();
        assertEq(morpho.position(mp.id(), borrower).collateral, 0);
        assertEq(mezo.balanceOf(borrower), 1_000_000e18);
    }
}
