// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {GridManager} from "./GridManager.sol";
import {GridLib} from "./libraries/GridLib.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {LadderRouter} from "./LadderRouter.sol";

/// @notice UI/taker read path. Spendable now and reliability come next.
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
        bool active;
        uint8 rungCount;
    }

    LadderRouter public immutable router;
    GridManager public immutable grids;

    constructor(LadderRouter router_, GridManager grids_) {
        router = router_;
        grids = grids_;
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
        v.active = g.active;
        v.rungCount = p.rungCount;

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
