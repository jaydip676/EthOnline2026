// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {GridManager} from "./GridManager.sol";
import {GridLib} from "./libraries/GridLib.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {LadderRouter} from "./LadderRouter.sol";

/// @notice UI/taker read path. Rung live flags still do not quote the router.
contract LadderLens {
    using GridLib for GridLib.GridParams;

    struct RungView {
        uint256 index;
        uint256 level;
        uint256 bidPrice;
        uint256 askPrice;
        bool bidLive;
        bool askLive;
        GridLib.PausedReason pausedReason;
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
    }

    struct MakerScore {
        uint32 succeeded;
        uint32 attempted;
        uint64 updatedAt;
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
    }

    function rungs(address maker, uint256 gridId) external view returns (RungView[] memory out) {
        GridManager.Grid memory g = grids.getGrid(maker, gridId);
        GridLib.GridParams memory p = g.params;
        GridView memory gv = gridView(maker, gridId);
        uint256 n = p.rungCount;
        out = new RungView[](n);
        uint256 s = GridLib.halfSpread(p);
        for (uint256 i; i < n; ++i) {
            RungView memory r;
            r.index = i;
            r.level = GridLib.level(p, i);
            r.bidPrice = r.level - s;
            r.askPrice = r.level + s;
            r.pausedReason = gv.envelopeState;
            out[i] = r;
        }
    }
}
