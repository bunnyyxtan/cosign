// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIrm} from "morpho-blue/interfaces/IIrm.sol";
import {MarketParams, Market} from "morpho-blue/interfaces/IMorpho.sol";

/// @notice Morpho IRM with a fixed borrow APR. Lender APR = borrow APR * utilisation.
contract FixedRateIrm is IIrm {
    uint256 public immutable aprWad;
    uint256 public immutable ratePerSecond;

    constructor(uint256 aprWad_) {
        aprWad = aprWad_;
        ratePerSecond = aprWad_ / 365 days;
    }

    function borrowRate(MarketParams memory, Market memory) external view returns (uint256) {
        return ratePerSecond;
    }

    function borrowRateView(MarketParams memory, Market memory) external view returns (uint256) {
        return ratePerSecond;
    }
}
