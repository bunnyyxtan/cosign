// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorpho, MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {CosignVault} from "../src/CosignVault.sol";
import {CosignGauge, IVeBTC} from "../src/CosignGauge.sol";
import {FixedRateIrm} from "../src/FixedRateIrm.sol";
import {AdminOracle} from "../src/AdminOracle.sol";

/// Deploys Cosign on Mezo testnet: our own unmodified Morpho Blue instance, two MEZO-collateral MUSD markets,
/// one Cosign vault per market, and a gauge reading Mezo's real testnet veBTC.
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

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address admin = vm.addr(pk);
        uint256 mezoPriceWad = vm.envOr("MEZO_PRICE_WAD", uint256(1e18)); // demo price, MUSD per MEZO

        vm.startBroadcast(pk);
        IMorpho morpho = IMorpho(deployCode("Morpho.sol:Morpho", abi.encode(admin)));
        AdminOracle oracle = new AdminOracle(admin, mezoPriceWad * 1e18);
        CosignGauge gauge = new CosignGauge(admin, IVeBTC(VEBTC), IERC20(MEZO), EPOCH);

        MarketSpec[2] memory specs = [
            MarketSpec("Steady MEZO", 0.625e18, 0.08e18, 9, 2000), // cover >= 10%
            MarketSpec("Bold MEZO", 0.77e18, 0.12e18, 19, 2500) // cover >= 5%
        ];
        address[2] memory vaults;
        address[2] memory irms;
        for (uint256 i; i < 2; ++i) {
            FixedRateIrm irm = new FixedRateIrm(specs[i].apr);
            morpho.enableIrm(address(irm));
            morpho.enableLltv(specs[i].lltv);
            morpho.createMarket(MarketParams(MUSD, MEZO, address(oracle), address(irm), specs[i].lltv));
            CosignVault v = new CosignVault(
                CosignVault.Config({
                    name: specs[i].name,
                    morpho: morpho,
                    musd: MUSD,
                    collateral: MEZO,
                    oracle: address(oracle),
                    irm: address(irm),
                    lltv: specs[i].lltv,
                    rewardToken: MEZO,
                    maxLeverage: specs[i].maxLeverage,
                    premiumBps: specs[i].premiumBps,
                    rewardJuniorBps: 3000,
                    cooldown: EPOCH,
                    withdrawWindow: 1 days,
                    rewardDuration: EPOCH
                })
            );
            v.setGauge(address(gauge));
            gauge.addVault(address(v), CAP_RATE);
            vaults[i] = address(v);
            irms[i] = address(irm);
        }
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
        vm.serializeAddress(o, "irmSteady", irms[0]);
        vm.serializeAddress(o, "irmBold", irms[1]);
        vm.serializeAddress(o, "vaultSteady", vaults[0]);
        string memory json = vm.serializeAddress(o, "vaultBold", vaults[1]);
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        console2.log("gauge", address(gauge));
        console2.log("vaultSteady", vaults[0]);
        console2.log("vaultBold", vaults[1]);
    }
}
