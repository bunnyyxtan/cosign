// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IMorpho, MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {MorphoBalancesLib} from "morpho-blue/libraries/periphery/MorphoBalancesLib.sol";

interface ICosignGaugeVotes {
    function accountVotes(address vault, address account) external view returns (uint256);
}

/// @title CosignVault
/// @notice Tranche vault in front of one Morpho Blue market. It is a supplier of MUSD to that market.
///         Lenders hold SENIOR claims, co-signers hold JUNIOR claims ("cover").
///         Interest: each tranche earns on its own capital, plus junior takes `premiumBps` of senior's interest.
///         Losses (Morpho bad debt): charged to junior first, senior only after junior is exhausted.
///         Lending limit: senior deposits are accepted only while seniorAssets <= maxLeverage * juniorAssets.
///         This caps co-signed capital entering the market. It does NOT cap borrowing from other suppliers
///         of the same Morpho market.
/// @dev Unaudited prototype, testnet only.
contract CosignVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MarketParamsLib for MarketParams;
    using MorphoBalancesLib for IMorpho;
    using Math for uint256;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant VIRTUAL_SHARES = 1e6; // inflation-attack protection (same idea as Morpho/OZ)
    uint256 internal constant VIRTUAL_ASSETS = 1;
    uint256 internal constant DUST = 1e12; // junior book below this (with shares outstanding) counts as wiped
    uint256 internal constant RPS_SCALE = 1e18;
    uint8 internal constant SENIOR = 0;
    uint8 internal constant JUNIOR = 1;

    struct Config {
        string name;
        IMorpho morpho;
        address musd;
        address collateral;
        address oracle;
        address irm;
        uint256 lltv;
        address rewardToken;
        uint256 maxLeverage; // e.g. 19 => cover must be >= 5% of the vault
        uint256 premiumBps; // e.g. 2000 => 20% of senior interest goes to junior
        uint256 rewardJuniorBps; // e.g. 3000 => 30% of MEZO rewards go to junior
        uint256 cooldown; // seconds between junior withdraw request and execution
        uint256 withdrawWindow; // seconds the request stays executable after cooldown
        uint256 rewardDuration; // seconds each reward notification streams over
    }

    struct JuniorPosition {
        uint64 round;
        uint256 shares;
    }

    struct WithdrawRequest {
        uint64 round;
        uint64 readyAt;
        uint256 shares;
    }

    struct RewardState {
        uint256 rate;
        uint64 finish;
        uint64 lastUpdate;
        uint256 perShare;
    }

    string public name;
    IMorpho public immutable morpho;
    IERC20 public immutable musd;
    IERC20 public immutable rewardToken;
    address public immutable collateral;
    address public immutable oracle;
    address public immutable irm;
    uint256 public immutable lltv;
    Id public immutable marketId;
    uint256 public immutable maxLeverage;
    uint256 public immutable premiumBps;
    uint256 public immutable rewardJuniorBps;
    uint256 public immutable cooldown;
    uint256 public immutable withdrawWindow;
    uint256 public immutable rewardDuration;
    address public immutable deployer;
    address public gauge;

    uint256 public seniorAssets;
    uint256 public juniorAssets;
    uint256 public totalSeniorShares;
    uint256 public totalJuniorShares;
    uint64 public juniorRound;

    mapping(address => uint256) public seniorShares;
    mapping(address => JuniorPosition) internal _junior;
    mapping(address => WithdrawRequest) public withdrawRequests;

    RewardState[2] public rewards;
    mapping(uint64 => uint256) public roundEndPerShare;
    mapping(address => uint256)[2] internal _paid;
    mapping(address => uint256) internal _earned;

    event SeniorDeposited(address indexed account, uint256 assets, uint256 shares);
    event SeniorWithdrawn(address indexed account, uint256 assets, uint256 shares);
    event JuniorDeposited(address indexed account, uint256 assets, uint256 shares, uint64 round);
    event JuniorWithdrawRequested(address indexed account, uint256 shares, uint64 readyAt);
    event JuniorWithdrawn(address indexed account, uint256 assets, uint256 shares);
    event InterestAccrued(uint256 interest, uint256 toSenior, uint256 toJunior);
    event LossAbsorbed(uint256 loss, uint256 byJunior, uint256 bySenior, uint256 seniorAssetsAfter, uint256 juniorAssetsAfter);
    event JuniorWiped(uint64 endedRound, uint256 dustCarried);
    event RewardNotified(uint256 toSenior, uint256 toJunior);
    event RewardsClaimed(address indexed account, uint256 amount);
    event GaugeSet(address gauge);

    error ZeroAmount();
    error CapacityExceeded(uint256 capacity);
    error Undercovered();
    error NoRequest();
    error RequestVoid();
    error NotReady(uint64 readyAt);
    error RequestExpired();
    error InsufficientShares();
    error VotesActive();
    error OnlyGauge();
    error OnlyDeployer();
    error GaugeAlreadySet();

    constructor(Config memory c) {
        require(c.maxLeverage > 0 && c.premiumBps <= BPS && c.rewardJuniorBps <= BPS && c.rewardDuration > 0, "bad config");
        name = c.name;
        morpho = c.morpho;
        musd = IERC20(c.musd);
        rewardToken = IERC20(c.rewardToken);
        collateral = c.collateral;
        oracle = c.oracle;
        irm = c.irm;
        lltv = c.lltv;
        marketId = marketParams().id();
        maxLeverage = c.maxLeverage;
        premiumBps = c.premiumBps;
        rewardJuniorBps = c.rewardJuniorBps;
        cooldown = c.cooldown;
        withdrawWindow = c.withdrawWindow;
        rewardDuration = c.rewardDuration;
        deployer = msg.sender;
        IERC20(c.musd).forceApprove(address(c.morpho), type(uint256).max);
    }

    function setGauge(address g) external {
        if (msg.sender != deployer) revert OnlyDeployer();
        if (gauge != address(0)) revert GaugeAlreadySet();
        if (g == address(0)) revert ZeroAmount();
        gauge = g;
        emit GaugeSet(g);
    }

    // ------------------------------------------------------------------ views

    function marketParams() public view returns (MarketParams memory) {
        return MarketParams({loanToken: address(musd), collateralToken: collateral, oracle: oracle, irm: irm, lltv: lltv});
    }

    /// @notice Tranche books including interest/losses not yet synced.
    function previewBooks() public view returns (uint256 senior, uint256 junior) {
        (senior, junior,,) = _books(morpho.expectedSupplyAssets(marketParams(), address(this)));
    }

    /// @notice Cover that counts for gauge weight: zero when no live junior shares exist.
    function coverAssets() external view returns (uint256) {
        if (totalJuniorShares == 0) return 0;
        (, uint256 j) = previewBooks();
        return j;
    }

    /// @notice How much more senior MUSD the vault accepts right now.
    function capacity() public view returns (uint256) {
        (uint256 s, uint256 j) = previewBooks();
        uint256 cap = j * maxLeverage;
        return cap > s ? cap - s : 0;
    }

    /// @notice junior / (senior + junior), in basis points.
    function coverageBps() external view returns (uint256) {
        (uint256 s, uint256 j) = previewBooks();
        return s + j == 0 ? 0 : j * BPS / (s + j);
    }

    function isUndercovered() public view returns (bool) {
        if (totalSeniorShares == 0) return false;
        (uint256 s, uint256 j) = previewBooks();
        return s > j * maxLeverage;
    }

    /// @notice MUSD value of the shares minted for 1 MUSD at a fresh start (1e18 = 1.0).
    function seniorSharePrice() external view returns (uint256) {
        (uint256 s,) = previewBooks();
        return _toAssets(1e18 * VIRTUAL_SHARES, s, totalSeniorShares);
    }

    function juniorSharePrice() external view returns (uint256) {
        (, uint256 j) = previewBooks();
        return _toAssets(1e18 * VIRTUAL_SHARES, j, totalJuniorShares);
    }

    function juniorSharesOf(address a) public view returns (uint256) {
        JuniorPosition memory p = _junior[a];
        return p.round == juniorRound ? p.shares : 0;
    }

    function seniorBalanceOf(address a) external view returns (uint256) {
        (uint256 s,) = previewBooks();
        return _toAssets(seniorShares[a], s, totalSeniorShares);
    }

    function juniorBalanceOf(address a) external view returns (uint256) {
        (, uint256 j) = previewBooks();
        return _toAssets(juniorSharesOf(a), j, totalJuniorShares);
    }

    function pendingRewards(address a) external view returns (uint256 amount) {
        amount = _earned[a] + seniorShares[a] * (_rewardPerShare(SENIOR) - _paid[SENIOR][a]) / RPS_SCALE;
        JuniorPosition memory p = _junior[a];
        if (p.shares > 0) {
            uint256 ps = p.round == juniorRound ? _rewardPerShare(JUNIOR) : roundEndPerShare[p.round];
            amount += p.shares * (ps - _paid[JUNIOR][a]) / RPS_SCALE;
        }
    }

    // --------------------------------------------------------------- lenders

    function depositSenior(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        _sync();
        uint256 cap = juniorAssets * maxLeverage;
        if (seniorAssets + assets > cap) revert CapacityExceeded(cap > seniorAssets ? cap - seniorAssets : 0);
        _updateSenior(msg.sender);
        musd.safeTransferFrom(msg.sender, address(this), assets);
        uint256 credited = _supply(assets);
        shares = _toShares(credited, seniorAssets, totalSeniorShares);
        if (shares == 0) revert ZeroAmount();
        seniorAssets += credited;
        totalSeniorShares += shares;
        seniorShares[msg.sender] += shares;
        emit SeniorDeposited(msg.sender, credited, shares);
    }

    /// @notice Senior can always exit (liquidity permitting). Exiting only improves coverage.
    function withdrawSenior(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (shares > seniorShares[msg.sender]) revert InsufficientShares();
        _sync();
        _updateSenior(msg.sender);
        assets = _toAssets(shares, seniorAssets, totalSeniorShares);
        seniorShares[msg.sender] -= shares;
        totalSeniorShares -= shares;
        uint256 debit = _withdraw(assets, msg.sender);
        seniorAssets = seniorAssets > debit ? seniorAssets - debit : 0;
        emit SeniorWithdrawn(msg.sender, assets, shares);
    }

    // ------------------------------------------------------------ co-signers

    /// @notice Post MUSD cover. Always allowed, including to recapitalise an undercovered or wiped vault.
    function depositJunior(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        _sync();
        _updateJunior(msg.sender);
        musd.safeTransferFrom(msg.sender, address(this), assets);
        uint256 credited = _supply(assets);
        shares = _toShares(credited, juniorAssets, totalJuniorShares);
        if (shares == 0) revert ZeroAmount();
        juniorAssets += credited;
        totalJuniorShares += shares;
        _junior[msg.sender].shares += shares;
        emit JuniorDeposited(msg.sender, credited, shares, juniorRound);
    }

    /// @notice Start the exit clock. Requested shares keep bearing losses until withdrawn.
    function requestJuniorWithdraw(uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (shares > juniorSharesOf(msg.sender)) revert InsufficientShares();
        uint64 readyAt = uint64(block.timestamp + cooldown);
        withdrawRequests[msg.sender] = WithdrawRequest({round: juniorRound, readyAt: readyAt, shares: shares});
        emit JuniorWithdrawRequested(msg.sender, shares, readyAt);
    }

    function withdrawJunior() external nonReentrant returns (uint256 assets) {
        WithdrawRequest memory r = withdrawRequests[msg.sender];
        if (r.shares == 0) revert NoRequest();
        if (block.timestamp < r.readyAt) revert NotReady(r.readyAt);
        if (block.timestamp > r.readyAt + withdrawWindow) revert RequestExpired();
        _sync(); // may wipe the round, voiding the request
        if (r.round != juniorRound) revert RequestVoid();
        _updateJunior(msg.sender);
        uint256 held = _junior[msg.sender].shares;
        uint256 shares = r.shares < held ? r.shares : held;
        if (shares == 0) revert InsufficientShares();
        if (shares == held && gauge != address(0)) {
            if (ICosignGaugeVotes(gauge).accountVotes(address(this), msg.sender) != 0) revert VotesActive();
        }
        assets = _toAssets(shares, juniorAssets, totalJuniorShares);
        // Only lenders who hold shares need cover; rounding dust left after every lender exits must not trap cover.
        if (totalSeniorShares > 0 && seniorAssets > (juniorAssets - assets) * maxLeverage) revert Undercovered();
        delete withdrawRequests[msg.sender];
        _junior[msg.sender].shares = held - shares;
        totalJuniorShares -= shares;
        uint256 debit = _withdraw(assets, msg.sender);
        juniorAssets = juniorAssets > debit ? juniorAssets - debit : 0;
        emit JuniorWithdrawn(msg.sender, assets, shares);
    }

    // --------------------------------------------------------------- rewards

    /// @notice Gauge transfers MEZO first, then calls this. Streams over `rewardDuration`.
    function notifyReward(uint256 amount) external {
        if (msg.sender != gauge) revert OnlyGauge();
        uint256 toJunior = amount * rewardJuniorBps / BPS;
        if (totalSeniorShares == 0) toJunior = amount;
        if (totalJuniorShares == 0) toJunior = 0;
        uint256 toSenior = amount - toJunior;
        _notify(SENIOR, toSenior);
        _notify(JUNIOR, toJunior);
        emit RewardNotified(toSenior, toJunior);
    }

    function claimRewards() external nonReentrant returns (uint256 amount) {
        _updateSenior(msg.sender);
        _updateJunior(msg.sender);
        amount = _earned[msg.sender];
        if (amount == 0) return 0;
        _earned[msg.sender] = 0;
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardsClaimed(msg.sender, amount);
    }

    /// @notice Anyone can push pending interest / bad debt into the tranche books.
    function sync() external nonReentrant {
        _sync();
    }

    // -------------------------------------------------------------- internal

    function _books(uint256 total) internal view returns (uint256 s, uint256 j, uint256 interest, uint256 loss) {
        s = seniorAssets;
        j = juniorAssets;
        uint256 book = s + j;
        if (total > book) {
            interest = total - book;
            if (totalJuniorShares == 0) {
                // No live cover: lenders keep all interest; no premium is owed for cover that does not exist.
                s += interest;
                return (s, j, interest, 0);
            }
            uint256 sPart = book == 0 ? 0 : interest.mulDiv(s, book);
            uint256 premium = sPart.mulDiv(premiumBps, BPS);
            s += sPart - premium;
            j += interest - sPart + premium;
        } else if (total < book) {
            loss = book - total;
            uint256 hitJ = loss < j ? loss : j;
            j -= hitJ;
            s -= loss - hitJ;
        }
    }

    function _sync() internal {
        (uint256 s, uint256 j, uint256 interest, uint256 loss) = _books(morpho.expectedSupplyAssets(marketParams(), address(this)));
        if (interest > 0) emit InterestAccrued(interest, s - seniorAssets, j - juniorAssets);
        if (loss > 0) emit LossAbsorbed(loss, juniorAssets - j, seniorAssets - s, s, j);
        seniorAssets = s;
        juniorAssets = j;
        if (totalJuniorShares > 0 && j < DUST) {
            // Cover is gone: retire the round so fresh cover is not diluted by dead shares.
            _updateGlobal(JUNIOR);
            roundEndPerShare[juniorRound] = rewards[JUNIOR].perShare;
            emit JuniorWiped(juniorRound, j);
            juniorRound++;
            totalJuniorShares = 0;
        }
    }

    function _supply(uint256 assets) internal returns (uint256 credited) {
        MarketParams memory mp = marketParams();
        uint256 pre = morpho.expectedSupplyAssets(mp, address(this));
        morpho.supply(mp, assets, 0, address(this), "");
        credited = morpho.expectedSupplyAssets(mp, address(this)) - pre;
    }

    function _withdraw(uint256 assets, address receiver) internal returns (uint256 debit) {
        MarketParams memory mp = marketParams();
        uint256 pre = morpho.expectedSupplyAssets(mp, address(this));
        morpho.withdraw(mp, assets, 0, address(this), receiver);
        debit = pre - morpho.expectedSupplyAssets(mp, address(this));
    }

    function _toShares(uint256 assets, uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        return assets.mulDiv(totalShares + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS);
    }

    function _toAssets(uint256 shares, uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        return shares.mulDiv(totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
    }

    function _rewardPerShare(uint8 t) internal view returns (uint256) {
        RewardState memory r = rewards[t];
        uint256 supply = t == SENIOR ? totalSeniorShares : totalJuniorShares;
        uint256 end = block.timestamp < r.finish ? block.timestamp : r.finish;
        if (supply == 0 || end <= r.lastUpdate) return r.perShare;
        return r.perShare + (end - r.lastUpdate) * r.rate * RPS_SCALE / supply;
    }

    function _updateGlobal(uint8 t) internal {
        RewardState storage r = rewards[t];
        r.perShare = _rewardPerShare(t);
        uint256 end = block.timestamp < r.finish ? block.timestamp : r.finish;
        if (end > r.lastUpdate) r.lastUpdate = uint64(end);
    }

    function _updateSenior(address a) internal {
        _updateGlobal(SENIOR);
        uint256 ps = rewards[SENIOR].perShare;
        _earned[a] += seniorShares[a] * (ps - _paid[SENIOR][a]) / RPS_SCALE;
        _paid[SENIOR][a] = ps;
    }

    function _updateJunior(address a) internal {
        _updateGlobal(JUNIOR);
        uint256 ps = rewards[JUNIOR].perShare;
        JuniorPosition storage p = _junior[a];
        if (p.round != juniorRound) {
            // Shares from a wiped round: keep rewards earned up to the wipe, then the shares are void.
            if (p.shares > 0) _earned[a] += p.shares * (roundEndPerShare[p.round] - _paid[JUNIOR][a]) / RPS_SCALE;
            p.shares = 0;
            p.round = juniorRound;
        } else {
            _earned[a] += p.shares * (ps - _paid[JUNIOR][a]) / RPS_SCALE;
        }
        _paid[JUNIOR][a] = ps;
    }

    function _notify(uint8 t, uint256 amount) internal {
        if (amount == 0) return;
        _updateGlobal(t);
        RewardState storage r = rewards[t];
        uint256 leftover = block.timestamp < r.finish ? (r.finish - block.timestamp) * r.rate : 0;
        r.rate = (amount + leftover) / rewardDuration;
        r.finish = uint64(block.timestamp + rewardDuration);
        r.lastUpdate = uint64(block.timestamp);
    }
}
