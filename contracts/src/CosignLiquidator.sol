// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMorpho, MarketParams} from "morpho-blue/interfaces/IMorpho.sol";
import {IMorphoLiquidateCallback} from "morpho-blue/interfaces/IMorphoCallbacks.sol";

interface ISyncableVault {
    function sync() external;
    function marketParams() external view returns (MarketParams memory);
}

/// @title CosignLiquidator
/// @notice Liquidates a Morpho position in a Cosign market with the vault synced on both sides.
///         CosignVault only sees the net change of its Morpho position between syncs, so interest accrued
///         since the last sync would otherwise be netted against a same-interval bad-debt loss, letting
///         senior's unbooked interest absorb part of the loss before junior. Syncing first books that interest,
///         so the loss that follows is charged junior-first exactly.
/// @dev Liquidations sent to Morpho directly bypass this and keep the netting behaviour (bounded by senior's
///      interest since the last sync). Unaudited prototype, testnet only.
contract CosignLiquidator is IMorphoLiquidateCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IMorpho public immutable morpho;
    address private _payer; // set only for the duration of `liquidate`

    error OnlyMorpho();
    error NotInLiquidation();

    constructor(IMorpho morpho_) {
        morpho = morpho_;
    }

    /// @notice Caller must approve this contract for the loan token (MUSD). Seized collateral is sent to the caller.
    function liquidate(ISyncableVault vault, address borrower, uint256 seizedAssets, uint256 repaidShares)
        external
        nonReentrant
        returns (uint256 seized, uint256 repaid)
    {
        vault.sync();
        MarketParams memory mp = vault.marketParams();
        _payer = msg.sender;
        (seized, repaid) = morpho.liquidate(mp, borrower, seizedAssets, repaidShares, abi.encode(msg.sender, mp.loanToken));
        _payer = address(0);
        IERC20(mp.collateralToken).safeTransfer(msg.sender, seized);
        vault.sync();
    }

    /// @dev Morpho calls this mid-liquidation; pull the repayment from the original caller and let Morpho take it.
    function onMorphoLiquidate(uint256 repaidAssets, bytes calldata data) external {
        if (msg.sender != address(morpho)) revert OnlyMorpho();
        (address payer, address loanToken) = abi.decode(data, (address, address));
        // Morpho only calls back the contract that started the liquidation; this pins the payer to that caller anyway.
        if (payer == address(0) || payer != _payer) revert NotInLiquidation();
        IERC20(loanToken).safeTransferFrom(payer, address(this), repaidAssets);
        IERC20(loanToken).forceApprove(address(morpho), repaidAssets);
    }
}
