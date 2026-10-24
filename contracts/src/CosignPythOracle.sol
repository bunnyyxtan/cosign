// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IOracle} from "morpho-blue/interfaces/IOracle.sol";

/// @notice The slice of Pyth's IPyth this oracle reads (PythStructs.Price in pyth-sdk-solidity).
interface IPythPrices {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
}

/// @notice MEZO priced in MUSD for a Morpho Blue market, from two Pyth feeds: MEZO/USD divided by MUSD/USD, at
///         Morpho's scale (1e36 = 1 MUSD per MEZO; both tokens have 18 decimals).
///         It reverts rather than return a price that is stale, not positive, or too uncertain. Morpho then refuses
///         borrows, collateral withdrawals and liquidations until a fresh update lands; repaying and adding collateral
///         never read the oracle. Unaudited prototype, testnet only.
contract CosignPythOracle is IOracle {
    IPythPrices public immutable pyth;
    bytes32 public immutable baseFeed; // MEZO/USD
    bytes32 public immutable quoteFeed; // MUSD/USD
    uint256 public immutable maxAge; // seconds between a feed's publish time and now
    uint256 public immutable maxConfBps; // widest confidence interval accepted, as a share of the price

    error StalePrice(bytes32 feed, uint256 publishTime);
    error InvalidPrice(bytes32 feed);
    error WideConfidence(bytes32 feed);

    constructor(IPythPrices pyth_, bytes32 baseFeed_, bytes32 quoteFeed_, uint256 maxAge_, uint256 maxConfBps_) {
        require(address(pyth_) != address(0) && baseFeed_ != 0 && quoteFeed_ != 0, "bad feed");
        require(maxAge_ > 0 && maxConfBps_ > 0 && maxConfBps_ <= 10_000, "bad limits");
        pyth = pyth_;
        baseFeed = baseFeed_;
        quoteFeed = quoteFeed_;
        maxAge = maxAge_;
        maxConfBps = maxConfBps_;
    }

    function price() external view returns (uint256) {
        (uint256 b, int32 be) = _read(baseFeed);
        (uint256 q, int32 qe) = _read(quoteFeed);
        // 1e36 * (b * 10^be) / (q * 10^qe). Exponents are bounded to [-18, 0], so this cannot overflow.
        uint256 num = 1e36 * b;
        uint256 den = q;
        if (be >= qe) num *= 10 ** uint256(int256(be - qe));
        else den *= 10 ** uint256(int256(qe - be));
        uint256 p = num / den;
        if (p == 0) revert InvalidPrice(baseFeed);
        return p;
    }

    function _read(bytes32 id) internal view returns (uint256, int32) {
        IPythPrices.Price memory p = pyth.getPriceUnsafe(id);
        if (p.price <= 0 || p.expo < -18 || p.expo > 0) revert InvalidPrice(id);
        // the same two-sided age test as Pyth's getPriceNoOlderThan: a publish time far in the future is also refused
        uint256 age =
            block.timestamp > p.publishTime ? block.timestamp - p.publishTime : p.publishTime - block.timestamp;
        if (age > maxAge) revert StalePrice(id, p.publishTime);
        uint256 v = uint256(uint64(p.price));
        if (uint256(p.conf) * 10_000 > v * maxConfBps) revert WideConfidence(id);
        return (v, p.expo);
    }
}
