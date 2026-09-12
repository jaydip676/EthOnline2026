// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Transparent collision heuristic for SLAC.
/// @dev Method demonstration, not a validated predictor. A wrong number costs a
///      taker one reverted simulation. It never prices a swap and never holds a key.
///
///      Raw hazard is quadratic in `(SLAC - 1)`, calibrated so ~3.2x is ~1% under
///      the test_spec17 spend pattern. EOA makers get a 25% hazard premium versus
///      a contract. Coverage below 40% scales hazard up. Taking more than half of
///      `realAvailable` adds a linear surcharge.
library CollisionHeuristic {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant HAZARD_QUAD = 21;
    uint256 internal constant TARGET_HAZARD_BPS = 100;
    uint16 internal constant COVERAGE_REF = 4_000;

    struct Args {
        uint16 reliabilityBps;
        uint256 slac;
        uint16 minCoverageBps;
        bool isContract;
        uint16 sizeBpsOfAvailable;
    }

    struct Score {
        uint16 predictedFillBps;
        uint256 maxSafeSlac;
        uint16 collisionHazardBps;
    }

    function rawHazardBps(uint256 slac) internal pure returns (uint256) {
        if (slac <= WAD) return 0;
        if (slac > 9 * WAD) slac = 9 * WAD;
        uint256 x = slac - WAD;
        return Math.min(BPS, Math.mulDiv(HAZARD_QUAD * x, x, WAD * WAD));
    }

    function collisionHazardBps(Args memory a) internal pure returns (uint256 h) {
        h = rawHazardBps(a.slac);
        if (!a.isContract) h = (h * 5) / 4;
        if (a.minCoverageBps > 0 && a.minCoverageBps < COVERAGE_REF) {
            h = Math.mulDiv(h, COVERAGE_REF, a.minCoverageBps);
        }
        if (a.sizeBpsOfAvailable > 5_000) {
            h += (uint256(a.sizeBpsOfAvailable) - 5_000) / 10;
        }
        if (h > BPS) h = BPS;
    }

    function score(Args memory a) internal pure returns (Score memory s) {
        uint256 h = collisionHazardBps(a);
        s.collisionHazardBps = uint16(h);
        s.predictedFillBps = uint16(Math.mulDiv(a.reliabilityBps, BPS - h, BPS));
        s.maxSafeSlac = maxSafeSlac(a);
    }

    function maxSafeSlac(Args memory a) internal pure returns (uint256 best) {
        Args memory probe = a;
        uint256 lo = WAD;
        uint256 hi = 9 * WAD;
        best = WAD;
        for (uint256 i; i < 24; ++i) {
            if (lo >= hi) break;
            uint256 mid = (lo + hi) / 2;
            probe.slac = mid;
            if (collisionHazardBps(probe) <= TARGET_HAZARD_BPS) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
    }
}
