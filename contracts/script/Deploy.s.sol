// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorpho, MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignGauge, IVeBTC} from "../src/CosignGauge.sol";
import {FixedRateIrm} from "../src/FixedRateIrm.sol";
import {AdminOracle} from "../src/AdminOracle.sol";

/// Deploys Cosign on Mezo testnet in two steps:
///   forge script script/Deploy.s.sol --sig "core()"                 Morpho Blue, demo oracle, gauge, Bold market + vault
///   forge script script/Deploy.s.sol --sig "addMarket(string)" steady   second market, added after Bold passes the full cycle
contract Deploy is Script {
    // Mezo testnet (chain 31611)
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant MEZO = 0x7B7c000000000000000000000000000000000001;
    address constant VEBTC = 0xB63fcCd03521Cf21907627bd7fA465C129479231;

    uint256 constant EPOCH = 10 minutes; // short on testnet so the demo fits in a session
    uint256 constant CAP_RATE = 1e13; // 1 veBTC voting power backed per 100,000 MUSD of cover

    struct MarketSpec {
        string name;
        uint256 lltv;
        uint256 apr;
        uint256 maxLeverage;
        uint256 premiumBps;
    }

    function _path() internal view returns (string memory) {
        return string.concat("./deployments/", vm.toString(block.chainid), ".json");
    }

    function _spec(string memory which) internal pure returns (MarketSpec memory) {
        if (keccak256(bytes(which)) == keccak256("bold")) return MarketSpec("Bold MEZO", 0.77e18, 0.12e18, 19, 2500); // cover >= 5%
        if (keccak256(bytes(which)) == keccak256("steady")) return MarketSpec("Steady MEZO", 0.625e18, 0.08e18, 9, 2000); // cover >= 10%
        revert("unknown market");
    }

    function core() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address admin = vm.addr(pk);
        uint256 mezoPriceWad = vm.envOr("MEZO_PRICE_WAD", uint256(1e18)); // demo price, MUSD per MEZO

        vm.startBroadcast(pk);
        IMorpho morpho = IMorpho(deployCode("Morpho.sol:Morpho", abi.encode(admin)));
        AdminOracle oracle = new AdminOracle(admin, mezoPriceWad * 1e18);
        CosignGauge gauge = new CosignGauge(admin, IVeBTC(VEBTC), IERC20(MEZO), EPOCH);
        (address irm, address vault) = _market(morpho, address(oracle), gauge, _spec("bold"));
        vm.stopBroadcast();

        string memory o = "deploy";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeUint(o, "block", block.number);
        vm.serializeAddress(o, "admin", admin);
        vm.serializeAddress(o, "musd", MUSD);
        vm.serializeAddress(o, "mezo", MEZO);
        vm.serializeAddress(o, "veBTC", VEBTC);
        vm.serializeAddress(o, "morpho", address(morpho));
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "gauge", address(gauge));
        vm.serializeAddress(o, "irmBold", irm);
        vm.serializeAddress(o, "vaultBold", vault);
        vm.serializeAddress(o, "irmSteady", address(0));
        string memory json = vm.serializeAddress(o, "vaultSteady", address(0));
        vm.writeJson(json, _path());
        console2.log("morpho", address(morpho));
        console2.log("gauge", address(gauge));
        console2.log("vaultBold", vault);
    }

    function addMarket(string calldata which) external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        string memory json = vm.readFile(_path());
        IMorpho morpho = IMorpho(vm.parseJsonAddress(json, ".morpho"));
        address oracle = vm.parseJsonAddress(json, ".oracle");
        CosignGauge gauge = CosignGauge(vm.parseJsonAddress(json, ".gauge"));

        vm.startBroadcast(pk);
        (address irm, address vault) = _market(morpho, oracle, gauge, _spec(which));
        vm.stopBroadcast();

        string memory key = keccak256(bytes(which)) == keccak256("steady") ? "Steady" : "Bold";
        vm.writeJson(vm.toString(irm), _path(), string.concat(".irm", key));
        vm.writeJson(vm.toString(vault), _path(), string.concat(".vault", key));
        console2.log(string.concat("vault", key), vault);
    }

    function _market(IMorpho morpho, address oracle, CosignGauge gauge, MarketSpec memory s)
        internal
        returns (address irm, address vault)
    {
        irm = address(new FixedRateIrm(s.apr));
        morpho.enableIrm(irm);
        morpho.enableLltv(s.lltv);
        morpho.createMarket(MarketParams(MUSD, MEZO, oracle, irm, s.lltv));
        CosignVault v = new CosignVault(
            CosignVault.Config({
                name: s.name,
                morpho: morpho,
                musd: MUSD,
                collateral: MEZO,
                oracle: oracle,
                irm: irm,
                lltv: s.lltv,
                rewardToken: MEZO,
                maxLeverage: s.maxLeverage,
                premiumBps: s.premiumBps,
                rewardJuniorBps: 3000,
                cooldown: EPOCH,
                withdrawWindow: 1 days,
                rewardDuration: EPOCH
            })
        );
        v.setGauge(address(gauge));
        gauge.addVault(address(v), CAP_RATE);
        vault = address(v);
    }
}
