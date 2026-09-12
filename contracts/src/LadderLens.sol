// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {ISwapVM} from "swap-vm/src/interfaces/ISwapVM.sol";

import {GridManager} from "./GridManager.sol";
import {CollisionHeuristic} from "./libraries/CollisionHeuristic.sol";
import {GridLib} from "./libraries/GridLib.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {LadderRouter} from "./LadderRouter.sol";
import {OracleEnvelope} from "./instructions/OracleEnvelope.sol";
import {WalletGuard} from "./instructions/WalletGuard.sol";
import {CoverageGuard} from "./instructions/CoverageGuard.sol";
import {RungQuote} from "./instructions/RungQuote.sol";

/// @notice UI/taker read path. Live flags come from the same quote() a taker would call.
contract LadderLens {
    using GridLib for GridLib.GridParams;

    uint8 internal constant DOCKED = 0xff;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BID_PROBE = 1e15; // 0.001 WETH
    uint256 internal constant ASK_PROBE = 1e6; // 1 USDC

    struct RungView {
        uint256 index;
        uint256 level;
        uint256 bidPrice;
        uint256 askPrice;
        bool bidLive;
        bool askLive;
        GridLib.PausedReason pausedReason;
        uint256 virtualWeth;
        uint256 virtualUsdc;
        uint256 realAvailableWeth;
        uint256 realAvailableUsdc;
        uint256 coverageWeth;
        uint256 coverageUsdc;
    }

    struct GridView {
        GridLib.PausedReason envelopeState;
        uint256 oraclePrice;
        uint256 updatedAt;
        uint256 floor;
        uint256 ceiling;
        uint256 spendableWeth;
        uint256 spendableUsdc;
        bool reserveBacked;
        GridLib.Tier tier;
        bool active;
        uint8 rungCount;
        uint256 slac; // 1e18 = 1.0×  Σ provisioned / wallet equity
    }

    struct MakerScore {
        uint32 succeeded;
        uint32 attempted;
        uint64 updatedAt;
    }

    /// @notice Collision heuristic for a maker. Method demonstration, not a validated predictor.
    struct MakerView {
        uint16 reliabilityBps;
        uint16 predictedFillBps;
        uint256 maxSafeSlac;
        uint16 collisionHazardBps;
        uint256 slac;
        bool isContract;
    }

    LadderRouter public immutable router;
    GridManager public immutable grids;
    IAqua public immutable aqua;
    address public reporter;

    mapping(address maker => MakerScore) public scores;

    error NotReporter();

    constructor(LadderRouter router_, GridManager grids_, IAqua aqua_) {
        router = router_;
        grids = grids_;
        aqua = aqua_;
        reporter = msg.sender;
    }

    function setReporter(address reporter_) external {
        require(msg.sender == reporter, NotReporter());
        reporter = reporter_;
    }

    function report(address maker, bool filled) external {
        require(msg.sender == reporter, NotReporter());
        MakerScore storage s = scores[maker];
        unchecked {
            ++s.attempted;
            if (filled) ++s.succeeded;
        }
        s.updatedAt = uint64(block.timestamp);
    }

    function reliabilityBps(address maker) public view returns (uint16) {
        MakerScore memory s = scores[maker];
        if (s.attempted == 0) return 10_000;
        return uint16((uint256(s.succeeded) * 10_000) / s.attempted);
    }

    /// @notice Quadratic-in-(SLAC-1) fill heuristic. Never prices a swap. Never holds a key.
    /// @dev Uses grid 0 only -- do not call rungs() here. Size is the 50% of available
    ///      calibration point (no surcharge) so maxSafeSlac is comparable to test 17.
    function makerView(address maker) public view returns (MakerView memory v) {
        v.reliabilityBps = reliabilityBps(maker);
        v.isContract = maker.code.length > 0;
        if (grids.gridCount(maker) == 0) {
            v.predictedFillBps = v.reliabilityBps;
            v.maxSafeSlac = WAD;
            return v;
        }

        GridView memory gv = gridView(maker, 0);
        GridManager.Grid memory g = grids.getGrid(maker, 0);
        v.slac = gv.slac;

        uint16 cov = g.params.minCoverageBps;
        if (g.params.ethCap > 0) {
            uint256 live = Math.mulDiv(gv.spendableWeth, 10_000, g.params.ethCap);
            if (live > 10_000) live = 10_000;
            if (live < cov) cov = uint16(live);
        }
        if (g.params.usdcCap > 0) {
            uint256 live = Math.mulDiv(gv.spendableUsdc, 10_000, g.params.usdcCap);
            if (live > 10_000) live = 10_000;
            if (live < cov) cov = uint16(live);
        }

        CollisionHeuristic.Score memory s = CollisionHeuristic.score(
            CollisionHeuristic.Args({
                reliabilityBps: v.reliabilityBps,
                slac: gv.slac == 0 ? WAD : gv.slac,
                minCoverageBps: cov,
                isContract: v.isContract,
                sizeBpsOfAvailable: 5_000
            })
        );
        v.predictedFillBps = s.predictedFillBps;
        v.maxSafeSlac = s.maxSafeSlac;
        v.collisionHazardBps = s.collisionHazardBps;
    }

    function spendableNow(address maker, address token, uint16 maxShareBps) public view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(maker);
        uint256 share = Math.mulDiv(balance, maxShareBps, 10_000);
        uint256 allowance_ = IERC20(token).allowance(maker, address(aqua));
        return Math.min(share, allowance_);
    }

    function gridView(address maker, uint256 gridId) public view returns (GridView memory v) {
        GridManager.Grid memory g = grids.getGrid(maker, gridId);
        GridLib.GridParams memory p = g.params;
        IPriceOracle oracle = IPriceOracle(p.oracle);
        (, int256 answer,, uint256 ts,) = oracle.latestRoundData();
        uint256 px = answer > 0 ? uint256(answer) : 0;
        uint8 decimals_ = oracle.decimals();
        if (decimals_ < 18) px *= 10 ** (18 - decimals_);
        else if (decimals_ > 18) px /= 10 ** (decimals_ - 18);

        v.oraclePrice = px;
        v.updatedAt = ts;
        v.floor = GridLib.envelopeFloor(p);
        v.ceiling = GridLib.envelopeCeiling(p);
        v.spendableWeth = spendableNow(maker, p.weth, p.maxShareBps);
        v.spendableUsdc = spendableNow(maker, p.usdc, p.maxShareBps);
        v.tier = p.tier;
        v.active = g.active;
        v.rungCount = p.rungCount;
        v.reserveBacked = p.tier == GridLib.Tier.Committed && v.spendableWeth >= p.ethCap && v.spendableUsdc >= p.usdcCap;

        if (block.timestamp > ts + p.maxStaleness) {
            v.envelopeState = GridLib.PausedReason.OracleStale;
        } else if (px < v.floor || px >= v.ceiling) {
            v.envelopeState = GridLib.PausedReason.EnvelopeClosed;
        } else {
            v.envelopeState = GridLib.PausedReason.None;
        }

        uint256 provisioned;
        uint256 n = g.hashes.length;
        for (uint256 i; i < n; ++i) {
            (uint256 vw, uint256 vu,) = _virtuals(maker, g.hashes[i], p);
            provisioned += _usd(vw, vu, px);
        }
        uint256 equity = _usd(IERC20(p.weth).balanceOf(maker), IERC20(p.usdc).balanceOf(maker), px);
        v.slac = equity == 0 ? 0 : Math.mulDiv(provisioned, WAD, equity);
    }

    function rungs(address maker, uint256 gridId) external view returns (RungView[] memory out) {
        GridManager.Grid memory g = grids.getGrid(maker, gridId);
        GridLib.GridParams memory p = g.params;
        GridView memory gv = gridView(maker, gridId);
        uint256 n = p.rungCount;
        out = new RungView[](n);
        uint256 s = GridLib.halfSpread(p);
        bool wethIsA = GridLib.wethIsTokenA(p);
        bytes memory bidData = grids.buildTakerData(address(this), true, wethIsA, true);
        bytes memory askData = grids.buildTakerData(address(this), true, !wethIsA, true);
        ISwapVM viewRouter = router.asView();

        for (uint256 i; i < n; ++i) {
            RungView memory r;
            r.index = i;
            r.level = GridLib.level(p, i);
            r.bidPrice = r.level - s;
            r.askPrice = r.level + s;

            bytes32 hash_ = i < g.hashes.length ? g.hashes[i] : bytes32(0);
            uint8 tokensCount;
            (r.virtualWeth, r.virtualUsdc, tokensCount) = _virtuals(maker, hash_, p);
            (r.coverageWeth, r.realAvailableWeth) = CoverageGuard.coverageOf(
                maker, p.weth, p.maxShareBps, p.aqua, r.virtualWeth
            );
            (r.coverageUsdc, r.realAvailableUsdc) = CoverageGuard.coverageOf(
                maker, p.usdc, p.maxShareBps, p.aqua, r.virtualUsdc
            );

            if (!g.active || tokensCount == 0 || tokensCount == DOCKED) {
                r.pausedReason = GridLib.PausedReason.Docked;
                out[i] = r;
                continue;
            }

            ISwapVM.Order memory order = grids.buildRungOrder(p, i);
            GridLib.PausedReason bidReason;
            GridLib.PausedReason askReason;
            (r.bidLive, bidReason) = _quoteLive(viewRouter, order, BID_PROBE, bidData, maker, p.usdc);
            (r.askLive, askReason) = _quoteLive(viewRouter, order, ASK_PROBE, askData, maker, p.weth);

            if (r.bidLive || r.askLive) {
                r.pausedReason = GridLib.PausedReason.None;
            } else if (gv.envelopeState != GridLib.PausedReason.None) {
                r.pausedReason = gv.envelopeState;
            } else if (bidReason != GridLib.PausedReason.None) {
                r.pausedReason = bidReason;
            } else {
                r.pausedReason = askReason;
            }
            out[i] = r;
        }
    }

    function _virtuals(
        address maker,
        bytes32 hash_,
        GridLib.GridParams memory p
    ) internal view returns (uint256 wethAmt, uint256 usdcAmt, uint8 tokensCount) {
        if (hash_ == bytes32(0)) return (0, 0, 0);
        (uint248 vw, uint8 nWeth) = aqua.rawBalances(maker, address(router), hash_, p.weth);
        (uint248 vu,) = aqua.rawBalances(maker, address(router), hash_, p.usdc);
        return (uint256(vw), uint256(vu), nWeth);
    }

    function _usd(uint256 wethAmt, uint256 usdcAmt, uint256 px) internal pure returns (uint256) {
        return Math.mulDiv(wethAmt, px, WAD) + usdcAmt * 1e12;
    }

    function _quoteLive(
        ISwapVM viewRouter,
        ISwapVM.Order memory order,
        uint256 amount,
        bytes memory td,
        address maker,
        address tokenOut
    ) internal view returns (bool live, GridLib.PausedReason reason) {
        if (IERC20(tokenOut).allowance(maker, address(aqua)) == 0) {
            return (false, GridLib.PausedReason.AllowanceRevoked);
        }
        try viewRouter.quote(order, amount, td) returns (uint256 inAmt, uint256 outAmt, bytes32) {
            return (inAmt > 0 && outAmt > 0, GridLib.PausedReason.None);
        } catch (bytes memory err) {
            return (false, _pausedFromRevert(err));
        }
    }

    function _pausedFromRevert(bytes memory err) internal pure returns (GridLib.PausedReason) {
        if (err.length < 4) return GridLib.PausedReason.InsufficientBalance;
        bytes4 sel;
        assembly {
            sel := mload(add(err, 32))
        }
        if (sel == OracleEnvelope.EnvelopeClosed.selector || sel == OracleEnvelope.OracleAnswerNonPositive.selector) {
            return GridLib.PausedReason.EnvelopeClosed;
        }
        if (sel == OracleEnvelope.OracleStale.selector) return GridLib.PausedReason.OracleStale;
        if (sel == CoverageGuard.CoverageBreach.selector) return GridLib.PausedReason.CoverageBreach;
        if (sel == WalletGuard.InsufficientWalletBalance.selector) {
            return GridLib.PausedReason.InsufficientBalance;
        }
        if (sel == RungQuote.SideOff.selector) return GridLib.PausedReason.None;
        return GridLib.PausedReason.InsufficientBalance;
    }
}
