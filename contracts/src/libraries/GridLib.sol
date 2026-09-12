// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Shared grid geometry. Even spacing; half-spread is spacing / 2.
library GridLib {
    uint256 internal constant ONE = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant FEE_SCALE = 1e7;
    uint24 internal constant DEFAULT_PROTOCOL_FEE = 5_000; // 5 bps of fill
    uint16 internal constant DEFAULT_COMMIT_BPS = 2_000; // 20%
    uint16 internal constant DEFAULT_RANGE_BPS = 600; // ±6%
    uint16 internal constant DEFAULT_ENVELOPE_BPS = 1_000; // ±10%
    uint16 internal constant DEFAULT_COVERAGE_BPS = 4_000; // 40%
    uint8 internal constant DEFAULT_RUNGS = 8;
    uint32 internal constant DEFAULT_STALENESS = 3_600;

    enum Mode {
        Grid,
        BuyLadder,
        SellLadder
    }

    enum Tier {
        Flexible,
        Committed
    }

    enum PausedReason {
        None,
        EnvelopeClosed,
        OracleStale,
        InsufficientBalance,
        CoverageBreach,
        AllowanceRevoked,
        Docked
    }

    struct GridParams {
        address maker;
        address weth;
        address usdc;
        address oracle;
        address treasury;
        address aqua;
        uint256 spot; // 1e18 ETH/USD used at build time
        uint16 rangeBps;
        uint16 envelopeBps;
        uint8 rungCount;
        uint16 maxShareBps;
        uint16 minCoverageBps;
        uint24 protocolFeeBps;
        uint32 maxStaleness;
        uint8 wethDecimals;
        uint8 usdcDecimals;
        Mode mode;
        Tier tier;
        uint64 saltNonce;
        uint256 ethCap; // per-rung Aqua virtual WETH
        uint256 usdcCap; // per-rung Aqua virtual USDC
    }

    error BadRungCount(uint8 n);
    error BadBps();
    error ZeroSpot();
    error ZeroAddress();

    function validate(GridParams memory p) internal pure {
        if (
            p.maker == address(0) ||
            p.weth == address(0) ||
            p.usdc == address(0) ||
            p.oracle == address(0)
        ) {
            revert ZeroAddress();
        }
        if (p.rungCount < 2 || p.rungCount > 32)
            revert BadRungCount(p.rungCount);
        if (p.rangeBps == 0 || p.rangeBps >= BPS) revert BadBps();
        if (p.envelopeBps == 0 || p.envelopeBps >= BPS) revert BadBps();
        if (p.envelopeBps <= p.rangeBps) revert BadBps();
        if (p.maxShareBps == 0 || p.maxShareBps > BPS) revert BadBps();
        if (p.minCoverageBps == 0 || p.minCoverageBps > BPS) revert BadBps();
        if (p.spot == 0) revert ZeroSpot();
    }

    function low(GridParams memory p) internal pure returns (uint256) {
        return Math.mulDiv(p.spot, BPS - p.rangeBps, BPS);
    }

    function high(GridParams memory p) internal pure returns (uint256) {
        return Math.mulDiv(p.spot, BPS + p.rangeBps, BPS);
    }

    function spacing(GridParams memory p) internal pure returns (uint256) {
        return (high(p) - low(p)) / (uint256(p.rungCount) - 1);
    }

    function halfSpread(GridParams memory p) internal pure returns (uint256) {
        return spacing(p) / 2;
    }

    function level(
        GridParams memory p,
        uint256 rungIndex
    ) internal pure returns (uint256) {
        return low(p) + spacing(p) * rungIndex;
    }

    function envelopeFloor(
        GridParams memory p
    ) internal pure returns (uint256) {
        return Math.mulDiv(p.spot, BPS - p.envelopeBps, BPS);
    }

    function envelopeCeiling(
        GridParams memory p
    ) internal pure returns (uint256) {
        return Math.mulDiv(p.spot, BPS + p.envelopeBps, BPS);
    }

    function bidCap(GridParams memory p) internal pure returns (uint256) {
        if (p.mode == Mode.SellLadder) return 0;
        return p.usdcCap;
    }

    function askCap(GridParams memory p) internal pure returns (uint256) {
        if (p.mode == Mode.BuyLadder) return 0;
        return p.ethCap;
    }

    function wethIsTokenA(GridParams memory p) internal pure returns (bool) {
        return p.weth < p.usdc;
    }

    function tokenA(GridParams memory p) internal pure returns (address) {
        return wethIsTokenA(p) ? p.weth : p.usdc;
    }

    function tokenB(GridParams memory p) internal pure returns (address) {
        return wethIsTokenA(p) ? p.usdc : p.weth;
    }

    function salt(
        GridParams memory p,
        uint256 rungIndex
    ) internal pure returns (uint64) {
        return uint64((uint256(p.saltNonce) << 8) | rungIndex);
    }
}
