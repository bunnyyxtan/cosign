// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IOracle} from "morpho-blue/interfaces/IOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice DEMO ORACLE. The owner sets the MEZO price in MUSD (Morpho scale: 1e36 = 1 MUSD per MEZO,
///         both tokens 18 decimals). It exists to demonstrate a price crash on testnet. Not for real use.
contract AdminOracle is IOracle, Ownable {
    uint256 public price;

    event PriceSet(uint256 price);

    constructor(address owner_, uint256 initialPrice) Ownable(owner_) {
        _set(initialPrice);
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        _set(newPrice);
    }

    function _set(uint256 p) internal {
        require(p > 0, "zero price");
        price = p;
        emit PriceSet(p);
    }
}
