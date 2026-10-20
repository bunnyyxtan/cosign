// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Subset of Mezo's veBTC (tigris VotingEscrow) used here.
interface IVeBTC {
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);
    function balanceOfNFT(uint256 tokenId) external view returns (uint256);
}

interface ICosignVault {
    function juniorSharesOf(address account) external view returns (uint256);
    function coverAssets() external view returns (uint256);
    function notifyReward(uint256 amount) external;
}

/// @title CosignGauge
/// @notice veBTC holders vote MEZO rewards toward Cosign vaults. Rules:
///         1. You can only vote for a vault where you hold cover (junior shares).
///         2. A vault's weight = min(votes, live cover * capRate). No cover, no weight.
///         3. Cover holders cannot fully exit a vault while their vote on it is active (enforced by the vault).
///         4. Anyone can `clean` votes whose voter no longer holds cover (e.g. after a wipe).
///         Rewards are SELF-FUNDED (anyone calls `fund`), not Mezo protocol emissions.
/// @dev Vote power is read from veBTC at vote time. Anyone can `poke` a token whose power has since decayed or
///      expired; owners re-vote to refresh upward. A vault's cap is on its total cover, not per voter.
///      Weights are read live when `distribute` is called. Unaudited prototype, testnet only.
contract CosignGauge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_VAULTS = 8;

    IVeBTC public immutable ve;
    IERC20 public immutable rewardToken;
    uint256 public immutable genesis;
    uint256 public immutable epochLength;

    address[] public vaults;
    mapping(address => uint256) public capRate; // veBTC power (1e18) backed per 1e18 MUSD of cover

    mapping(address => uint256) public vaultVotes;
    mapping(address => mapping(address => uint256)) public accountVotes; // vault => voter => votes
    mapping(uint256 => mapping(address => uint256)) public tokenVotes; // tokenId => vault => votes
    mapping(uint256 => address) public voterOf;
    mapping(uint256 => address[]) internal _tokenVaults;
    mapping(uint256 => uint256) public lastVotedEpochPlusOne;
    mapping(uint256 => uint256) public votedPower; // veBTC power the token's current votes were cast with

    mapping(uint256 => uint256) public epochBudget;
    mapping(uint256 => bool) public distributed;

    event VaultAdded(address indexed vault, uint256 capRate);
    event Voted(uint256 indexed tokenId, address indexed voter, uint256 indexed epoch, uint256 power);
    event VoteCast(uint256 indexed tokenId, address indexed vault, uint256 votes);
    event VotesReset(uint256 indexed tokenId, address indexed voter);
    event VoteCleaned(uint256 indexed tokenId, address indexed vault, uint256 votes);
    event Poked(uint256 indexed tokenId, uint256 oldPower, uint256 newPower);
    event Funded(address indexed from, uint256 indexed epoch, uint256 amount);
    event Distributed(uint256 indexed epoch, address indexed vault, uint256 weight, uint256 amount);
    event Rolled(uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);

    error NotApproved();
    error AlreadyVoted();
    error BadInput();
    error UnknownVault();
    error NoCover();
    error NoPower();
    error EpochNotOver();
    error AlreadyDistributed();
    error StillCovered();

    constructor(address owner_, IVeBTC ve_, IERC20 rewardToken_, uint256 epochLength_) Ownable(owner_) {
        require(epochLength_ > 0, "epoch");
        ve = ve_;
        rewardToken = rewardToken_;
        epochLength = epochLength_;
        genesis = block.timestamp;
    }

    // ------------------------------------------------------------------ admin

    function addVault(address vault, uint256 rate) external onlyOwner {
        if (vaults.length >= MAX_VAULTS || capRate[vault] != 0 || rate == 0) revert BadInput();
        vaults.push(vault);
        capRate[vault] = rate;
        emit VaultAdded(vault, rate);
    }

    // ------------------------------------------------------------------ views

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - genesis) / epochLength;
    }

    function epochEnd(uint256 epoch) external view returns (uint256) {
        return genesis + (epoch + 1) * epochLength;
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    function coverCap(address vault) public view returns (uint256) {
        return ICosignVault(vault).coverAssets() * capRate[vault] / 1e18;
    }

    /// @notice Effective weight: votes count only up to what the vault's cover backs.
    function weightOf(address vault) public view returns (uint256) {
        uint256 v = vaultVotes[vault];
        uint256 cap = coverCap(vault);
        return v < cap ? v : cap;
    }

    function tokenVaults(uint256 tokenId) external view returns (address[] memory) {
        return _tokenVaults[tokenId];
    }

    // ----------------------------------------------------------------- voting

    function vote(uint256 tokenId, address[] calldata targets, uint256[] calldata weights) external nonReentrant {
        if (!ve.isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        uint256 epoch = currentEpoch();
        if (lastVotedEpochPlusOne[tokenId] == epoch + 1) revert AlreadyVoted();
        if (targets.length == 0 || targets.length != weights.length || targets.length > MAX_VAULTS) revert BadInput();

        _reset(tokenId);
        uint256 power = ve.balanceOfNFT(tokenId);
        if (power == 0) revert NoPower();

        uint256 sum;
        for (uint256 i; i < weights.length; ++i) sum += weights[i];
        if (sum == 0) revert BadInput();

        for (uint256 i; i < targets.length; ++i) {
            address v = targets[i];
            if (capRate[v] == 0) revert UnknownVault();
            if (tokenVotes[tokenId][v] != 0) revert BadInput(); // duplicate target
            if (ICosignVault(v).juniorSharesOf(msg.sender) == 0) revert NoCover();
            uint256 amt = power * weights[i] / sum;
            if (amt == 0) revert BadInput();
            tokenVotes[tokenId][v] = amt;
            vaultVotes[v] += amt;
            accountVotes[v][msg.sender] += amt;
            _tokenVaults[tokenId].push(v);
            emit VoteCast(tokenId, v, amt);
        }
        voterOf[tokenId] = msg.sender;
        votedPower[tokenId] = power;
        lastVotedEpochPlusOne[tokenId] = epoch + 1;
        emit Voted(tokenId, msg.sender, epoch, power);
    }

    /// @notice Remove a token's votes. Callable by the NFT owner/approved or by whoever cast the votes.
    function reset(uint256 tokenId) external nonReentrant {
        if (msg.sender != voterOf[tokenId] && !ve.isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _reset(tokenId);
    }

    /// @notice Anyone can remove votes on `vault` whose voter no longer holds cover there.
    function clean(uint256 tokenId, address vault) external nonReentrant {
        uint256 amt = tokenVotes[tokenId][vault];
        if (amt == 0) revert BadInput();
        address voter = voterOf[tokenId];
        if (ICosignVault(vault).juniorSharesOf(voter) != 0) revert StillCovered();
        tokenVotes[tokenId][vault] = 0;
        vaultVotes[vault] -= amt;
        accountVotes[vault][voter] -= amt;
        emit VoteCleaned(tokenId, vault, amt);
    }

    /// @notice Anyone can scale a token's votes down to its current veBTC power (decayed or expired locks).
    ///         Down only: owners re-vote to use more power.
    function poke(uint256 tokenId) external nonReentrant {
        uint256 old = votedPower[tokenId];
        uint256 p = ve.balanceOfNFT(tokenId);
        if (old == 0 || p >= old) revert BadInput();
        address voter = voterOf[tokenId];
        address[] storage list = _tokenVaults[tokenId];
        for (uint256 i; i < list.length; ++i) {
            address v = list[i];
            uint256 amt = tokenVotes[tokenId][v];
            if (amt == 0) continue;
            uint256 cut = amt - amt * p / old;
            tokenVotes[tokenId][v] = amt - cut;
            vaultVotes[v] -= cut;
            accountVotes[v][voter] -= cut;
        }
        votedPower[tokenId] = p;
        emit Poked(tokenId, old, p);
    }

    function _reset(uint256 tokenId) internal {
        address voter = voterOf[tokenId];
        address[] storage list = _tokenVaults[tokenId];
        for (uint256 i; i < list.length; ++i) {
            address v = list[i];
            uint256 amt = tokenVotes[tokenId][v];
            if (amt == 0) continue;
            tokenVotes[tokenId][v] = 0;
            vaultVotes[v] -= amt;
            accountVotes[v][voter] -= amt;
        }
        delete _tokenVaults[tokenId];
        delete votedPower[tokenId];
        if (voter != address(0)) {
            delete voterOf[tokenId];
            emit VotesReset(tokenId, voter);
        }
    }

    // ---------------------------------------------------------------- rewards

    /// @notice Add MEZO to the current epoch's budget (self-funded rewards).
    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) revert BadInput();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 epoch = currentEpoch();
        epochBudget[epoch] += amount;
        emit Funded(msg.sender, epoch, amount);
    }

    /// @notice After `epoch` ends, split its budget across vaults by effective weight.
    function distribute(uint256 epoch) external nonReentrant {
        uint256 now_ = currentEpoch();
        if (epoch >= now_) revert EpochNotOver();
        if (distributed[epoch]) revert AlreadyDistributed();
        distributed[epoch] = true;
        uint256 budget = epochBudget[epoch];
        if (budget == 0) return;

        uint256 n = vaults.length;
        uint256[] memory w = new uint256[](n);
        uint256 total;
        for (uint256 i; i < n; ++i) {
            w[i] = weightOf(vaults[i]);
            total += w[i];
        }
        uint256 sent;
        if (total > 0) {
            for (uint256 i; i < n; ++i) {
                uint256 amt = budget * w[i] / total;
                if (amt == 0) continue;
                sent += amt;
                rewardToken.safeTransfer(vaults[i], amt);
                ICosignVault(vaults[i]).notifyReward(amt);
                emit Distributed(epoch, vaults[i], w[i], amt);
            }
        }
        uint256 rest = budget - sent;
        if (rest > 0) {
            epochBudget[now_] += rest;
            emit Rolled(epoch, now_, rest);
        }
    }
}
