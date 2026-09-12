// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {CollisionHeuristic} from "../src/libraries/CollisionHeuristic.sol";

contract CollisionHeuristicTest is Test {
    function test_hazardAt1xIsZero() public pure {
        assertEq(CollisionHeuristic.rawHazardBps(1e18), 0);
    }

    function test_hazardAt32xAboutOnePercent() public pure {
        uint256 h = CollisionHeuristic.rawHazardBps(32e17);
        assertApproxEqAbs(h, 100, 15);
    }

    function test_hazardAt9xIsMaterial() public pure {
        uint256 h = CollisionHeuristic.rawHazardBps(9e18);
        assertGt(h, 1_000);
        assertLe(h, 10_000);
    }

    function test_eoaPaysAPremium() public pure {
        CollisionHeuristic.Args memory a;
        a.reliabilityBps = 10_000;
        a.slac = 32e17;
        a.minCoverageBps = 4_000;
        a.isContract = true;
        a.sizeBpsOfAvailable = 5_000;
        uint256 contractH = CollisionHeuristic.collisionHazardBps(a);
        a.isContract = false;
        uint256 eoaH = CollisionHeuristic.collisionHazardBps(a);
        assertGt(eoaH, contractH);
    }

    function test_maxSafeAroundThreeForContract() public pure {
        CollisionHeuristic.Args memory a;
        a.reliabilityBps = 10_000;
        a.slac = 9e18;
        a.minCoverageBps = 4_000;
        a.isContract = true;
        a.sizeBpsOfAvailable = 5_000;
        uint256 safe = CollisionHeuristic.maxSafeSlac(a);
        assertGe(safe, 25e17);
        assertLe(safe, 35e17);
    }

    function test_scoreNeverExceedsReliability() public pure {
        CollisionHeuristic.Args memory a;
        a.reliabilityBps = 8_000;
        a.slac = 5e18;
        a.minCoverageBps = 4_000;
        a.isContract = false;
        a.sizeBpsOfAvailable = 10_000;
        CollisionHeuristic.Score memory s = CollisionHeuristic.score(a);
        assertLe(s.predictedFillBps, a.reliabilityBps);
    }
}
