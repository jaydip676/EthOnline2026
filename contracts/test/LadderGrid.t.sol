// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {ISwapVM} from "swap-vm/src/interfaces/ISwapVM.sol";
import {Vm} from "forge-std/Vm.sol";

import {AQUA} from "../src/libraries/Constants.sol";
import {GridLib} from "../src/libraries/GridLib.sol";
import {LadderRouter} from "../src/LadderRouter.sol";
import {GridManager} from "../src/GridManager.sol";
import {LadderLens} from "../src/LadderLens.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {OracleEnvelope} from "../src/instructions/OracleEnvelope.sol";
import {CoverageGuard} from "../src/instructions/CoverageGuard.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ForkRpc} from "./utils/ForkRpc.sol";

/// @notice Spec §10 start: self-custody + a fill. expectRevert on an internal quote is wrong.
contract LadderGridTest is ForkRpc {
    IAqua internal aqua;
    LadderRouter internal router;
    GridManager internal manager;
    LadderLens internal lens;
    MockOracle internal oracle;
    MockERC20 internal weth;
    MockERC20 internal usdc;
    address internal maker;
    address internal taker;
    address internal taker2;
    address internal treasury;

    GridLib.GridParams internal params;
    ISwapVM.Order[] internal orders;
    bytes32[] internal hashes;
    bool internal wethIsA;

    uint256 internal constant SPOT = 2500e18;
    uint256 internal constant ETH_BAL = 10e18;
    uint256 internal constant USDC_BAL = 25_000e6;

    function setUp() public {
        forkAqua();
        aqua = IAqua(AQUA);
        maker = makeAddr("maker");
        taker = makeAddr("taker");
        taker2 = makeAddr("taker2");
        treasury = makeAddr("treasury");

        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        oracle = new MockOracle(int256(SPOT), 18, "ETH / USD");
        router = new LadderRouter(address(aqua), address(weth), address(oracle), treasury, address(this));
        manager = new GridManager(router);
        lens = new LadderLens(router, manager, aqua);

        wethIsA = address(weth) < address(usdc);

        params = GridLib.GridParams({
            maker: maker,
            weth: address(weth),
            usdc: address(usdc),
            oracle: address(oracle),
            treasury: treasury,
            aqua: address(aqua),
            spot: SPOT,
            rangeBps: GridLib.DEFAULT_RANGE_BPS,
            envelopeBps: GridLib.DEFAULT_ENVELOPE_BPS,
            rungCount: GridLib.DEFAULT_RUNGS,
            maxShareBps: GridLib.DEFAULT_COMMIT_BPS,
            minCoverageBps: GridLib.DEFAULT_COVERAGE_BPS,
            protocolFeeBps: GridLib.DEFAULT_PROTOCOL_FEE,
            maxStaleness: GridLib.DEFAULT_STALENESS,
            wethDecimals: 18,
            usdcDecimals: 6,
            mode: GridLib.Mode.Grid,
            tier: GridLib.Tier.Flexible,
            saltNonce: 1,
            ethCap: 2e18,
            usdcCap: 5_000e6
        });

        weth.mint(maker, ETH_BAL);
        usdc.mint(maker, USDC_BAL);
        weth.mint(taker, 50e18);
        usdc.mint(taker, 100_000e6);
        weth.mint(taker2, 50e18);
        usdc.mint(taker2, 100_000e6);

        vm.startPrank(maker);
        weth.approve(address(aqua), type(uint256).max);
        usdc.approve(address(aqua), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(taker);
        weth.approve(address(router), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(taker2);
        weth.approve(address(router), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function test_01_shipDoesNotMoveTokens() public {
        uint256 w = weth.balanceOf(maker);
        uint256 u = usdc.balanceOf(maker);
        vm.recordLogs();
        _shipAll();
        assertEq(weth.balanceOf(maker), w, "WETH must stay in the wallet");
        assertEq(usdc.balanceOf(maker), u, "USDC must stay in the wallet");
        assertEq(_transferCountFrom(maker), 0, "ship must not emit Transfer from maker");
    }

    function test_02_takerHitsBidRung3() public {
        _shipAll();
        uint256 rung = 3;
        uint256 wBefore = weth.balanceOf(maker);
        uint256 uBefore = usdc.balanceOf(maker);

        (uint256 amountIn, uint256 amountOut) = _swap(rung, true, 0.1e18);

        assertGt(amountOut, 0);
        assertEq(weth.balanceOf(maker), wBefore + amountIn - _fee(amountIn), "maker receives WETH net of fee");
        assertEq(usdc.balanceOf(maker), uBefore - amountOut, "maker pays USDC at the bid");
    }

    function test_03_roundTripSelfRearms() public {
        _shipAll();
        uint256 rung = 3;
        uint256 uStart = usdc.balanceOf(maker);

        (uint256 bidIn,) = _swap(rung, true, 0.1e18);
        uint256 wethNet = bidIn - _fee(bidIn);

        (, uint256 askOut) = _swap(rung, false, 250e6);
        assertGt(usdc.balanceOf(maker), uStart, "round trip earns 2s");
        assertLe(weth.balanceOf(maker), ETH_BAL + wethNet);
        assertGt(askOut, 0);
    }

    function test_04_fillsNeverExceedRealBalance() public {
        _shipAll();
        uint256 wStart = weth.balanceOf(maker);
        uint256 uStart = usdc.balanceOf(maker);

        for (uint256 i; i < params.rungCount; ++i) {
            try this.externalSwap(i, true, 0.5e18) {} catch {}
            try this.externalSwap(i, false, 1_000e6) {} catch {}
        }

        assertLe(wStart - _min(weth.balanceOf(maker), wStart), wStart);
        assertLe(uStart - _min(usdc.balanceOf(maker), uStart), uStart);
        assertGe(weth.balanceOf(maker), 0);
        assertGe(usdc.balanceOf(maker), 0);
    }

    function test_05_spendWethPausesAsks() public {
        _shipAll();
        uint256 send = (weth.balanceOf(maker) * 70) / 100;
        vm.prank(maker);
        weth.transfer(address(0xDEAD), send);

        vm.expectRevert();
        this.externalQuote(3, false, 1e6);
        (uint256 qIn,) = _quote(3, true, 0.05e18);
        assertGt(qIn, 0, "bids still quote");
    }

    function test_06_returnWethRearmsAsks() public {
        _shipAll();
        uint256 amount = weth.balanceOf(maker);
        vm.prank(maker);
        weth.transfer(taker, amount);
        vm.expectRevert();
        this.externalQuote(3, false, 1e6);

        vm.prank(taker);
        weth.transfer(maker, amount);

        (, uint256 qOut) = _quote(3, false, 100e6);
        assertGt(qOut, 0, "asks live again with no maker tx");
    }

    function test_07_halvingWalletHalvesShare() public {
        _shipAll();
        (, uint256 outBefore) = _quote(3, false, 10_000e6);

        vm.prank(maker);
        weth.transfer(taker, ETH_BAL / 2);

        (, uint256 outAfter) = _quote(3, false, 10_000e6);
        assertApproxEqRel(outAfter * 2, outBefore, 0.15e18, "available halves with the wallet");
    }

    function test_08_partialFillCaps() public {
        params.ethCap = 0.6e18;
        params.maxShareBps = 10_000;
        _shipAll();
        vm.prank(maker);
        weth.transfer(taker, ETH_BAL - 0.6e18);

        (uint256 amountIn, uint256 amountOut) = _swap(0, false, 10_000e6);
        assertLe(amountOut, 0.6e18);
        assertGt(amountIn, 0);
        assertGt(amountOut, 0);
    }

    function test_09_envelopeClosesAndReopens() public {
        _shipAll();
        oracle.setPrice(int256(2_000e18));
        vm.expectRevert(abi.encodeWithSelector(OracleEnvelope.EnvelopeClosed.selector, uint256(2_000e18)));
        this.externalQuote(3, true, 0.05e18);

        oracle.setPrice(int256(SPOT));
        (uint256 qIn,) = _quote(3, true, 0.05e18);
        assertGt(qIn, 0);
    }

    function test_10_staleOraclePauses() public {
        _shipAll();
        oracle.setPriceAndTimestamp(int256(SPOT), 1_000);
        vm.warp(1_000 + params.maxStaleness + 1);
        vm.expectRevert(abi.encodeWithSelector(OracleEnvelope.OracleStale.selector, uint256(1_000)));
        this.externalQuote(3, true, 0.05e18);
    }

    function test_11_revokeAllowanceDarkens() public {
        _shipAll();
        vm.prank(maker);
        weth.approve(address(aqua), 0);
        vm.prank(maker);
        usdc.approve(address(aqua), 0);
        vm.expectRevert();
        this.externalQuote(3, true, 0.05e18);

        vm.prank(maker);
        weth.approve(address(aqua), type(uint256).max);
        vm.prank(maker);
        usdc.approve(address(aqua), type(uint256).max);
        (uint256 qIn,) = _quote(3, true, 0.05e18);
        assertGt(qIn, 0);
    }

    function test_12_protocolFeeToTreasury() public {
        _shipAll();
        uint256 before = weth.balanceOf(treasury);
        (uint256 amountIn,) = _swap(3, true, 1e18);
        assertEq(weth.balanceOf(treasury) - before, _fee(amountIn));
    }

    function test_13_dockAllStopsQuotes() public {
        _shipAll();
        address[] memory tokens = new address[](2);
        tokens[0] = address(weth);
        tokens[1] = address(usdc);
        uint256 w = weth.balanceOf(maker);
        vm.startPrank(maker);
        for (uint256 i; i < hashes.length; ++i) {
            aqua.dock(address(router), hashes[i], tokens);
        }
        vm.stopPrank();
        assertEq(weth.balanceOf(maker), w, "dock must not move tokens");
        vm.expectRevert();
        this.externalQuote(0, true, 0.05e18);
    }

    function test_14_fuzzPriceNeverBetterThanRung(uint96 raw) public {
        _shipAll();
        uint256 amountIn = bound(uint256(raw), 1e15, 0.5e18);
        uint256 rung = 3;
        uint256 bid = GridLib.level(params, rung) - GridLib.halfSpread(params);
        try this.externalQuote(rung, true, amountIn) returns (uint256 inAmt, uint256 outAmt) {
            if (inAmt == 0) return;
            assertLe(outAmt * 1e18 * 1e18, inAmt * bid * 1e6 + 1e6);
        } catch {}
    }

    function test_registerGridIndexesMaker() public {
        _shipAll();
        vm.prank(maker);
        uint256 id = manager.registerGrid(address(weth), address(usdc), hashes, params);
        assertEq(id, 0);
        assertEq(manager.gridCount(maker), 1);
        LadderLens.GridView memory gv = lens.gridView(maker, 0);
        assertEq(gv.oraclePrice, SPOT);
        assertEq(uint8(gv.envelopeState), uint8(GridLib.PausedReason.None));
        assertGt(gv.spendableWeth, 0);
        assertGt(gv.slac, 1e18, "SLAC is provisioned / equity, above 1x");
        LadderLens.RungView[] memory rs = lens.rungs(maker, 0);
        assertTrue(rs[3].bidLive, "lens must probe quote");
        assertTrue(rs[3].askLive);
        assertEq(uint8(rs[3].pausedReason), uint8(GridLib.PausedReason.None));
        assertGt(rs[3].virtualWeth, 0);
        assertEq(rs[3].coverageWeth, 10_000);
    }

    /// @dev Spec 9: coverage below the floor stops the quote; restore and it lives.
    function test_spec09_coverageBreachThenRestore() public {
        _shipAll();
        uint256 keep = 3e18;
        uint256 send = weth.balanceOf(maker) - keep;
        vm.prank(maker);
        weth.transfer(taker, send);

        uint256 share = (keep * uint256(params.maxShareBps)) / 10_000;
        uint256 coverage = (share * 10_000) / params.ethCap;
        assertLt(coverage, params.minCoverageBps);

        vm.expectRevert(abi.encodeWithSelector(CoverageGuard.CoverageBreach.selector, coverage));
        this.externalQuote(3, false, 1e6);

        (uint256 bidIn,) = _quote(3, true, 0.05e18);
        assertGt(bidIn, 0, "bids still quote - USDC coverage is intact");

        vm.prank(taker);
        weth.transfer(maker, send);
        (, uint256 askOut) = _quote(3, false, 1e6);
        assertGt(askOut, 0, "asks live once coverage is restored");
    }

    /// @dev Spec 10: underfunded, adverse move, refund - no fill at the stale adverse price.
    function test_spec10_underfundedAdverseMoveNoStaleFill() public {
        _shipAll();
        uint256 keepUsdc = 5_000e6;
        uint256 sendUsdc = usdc.balanceOf(maker) - keepUsdc;
        vm.prank(maker);
        usdc.transfer(taker, sendUsdc);

        uint256 share = (keepUsdc * uint256(params.maxShareBps)) / 10_000;
        uint256 coverage = (share * 10_000) / params.usdcCap;
        vm.expectRevert(abi.encodeWithSelector(CoverageGuard.CoverageBreach.selector, coverage));
        this.externalQuote(3, true, 0.05e18);

        uint256 adverse = 2_000e18;
        oracle.setPrice(int256(adverse));

        vm.prank(taker);
        usdc.transfer(maker, sendUsdc);

        vm.expectRevert(abi.encodeWithSelector(OracleEnvelope.EnvelopeClosed.selector, adverse));
        this.externalQuote(3, true, 0.05e18);
        vm.expectRevert();
        this.externalSwap(3, true, 0.05e18);

        oracle.setPrice(int256(SPOT));
        (uint256 qIn, uint256 qOut) = _quote(3, true, 0.05e18);
        assertGt(qIn, 0);
        uint256 bid = GridLib.level(params, 3) - GridLib.halfSpread(params);
        assertLe(qOut * 1e18 * 1e18, qIn * bid * 1e6 + 1e6, "fill is the rung, not the dumped print");
    }

    /// @dev Spec 11: two takers, one wallet, one fill, one clean revert.
    function test_spec11_twoTakersOneBalance() public {
        params.maxShareBps = 10_000;
        params.ethCap = 1e18;
        _shipAll();
        uint256 leave = 1e18;
        uint256 send = weth.balanceOf(maker) - leave;
        vm.prank(maker);
        weth.transfer(taker, send);

        uint256 makerWeth = weth.balanceOf(maker);
        uint256 t1Start = weth.balanceOf(taker);
        uint256 t2Start = weth.balanceOf(taker2);

        (uint256 inAmt, uint256 outAmt) = _swapAs(taker, 3, false, 50_000e6);
        assertGt(inAmt, 0);
        assertGt(outAmt, 0);

        vm.expectRevert();
        this.externalSwapAs(taker2, 3, false, 50_000e6);

        uint256 taken = (weth.balanceOf(taker) - t1Start) + (weth.balanceOf(taker2) - t2Start);
        assertLe(taken, makerWeth);
        assertEq(weth.balanceOf(taker2), t2Start, "second taker receives nothing");
    }

    /// @dev Spec 17: experiment - collision rate vs SLAC 1x-9x. Not pass/fail on the rate.
    function test_spec17_fuzzSlacCollisions(uint8 slacRaw, uint16 spendRaw) public {
        uint256 slacX = bound(uint256(slacRaw), 1, 9);
        uint256 spendBps = bound(uint256(spendRaw), 0, 8_000);
        uint256 n = params.rungCount;
        params.maxShareBps = 10_000;
        params.minCoverageBps = 1;
        params.ethCap = (ETH_BAL * slacX) / n;
        params.usdcCap = (USDC_BAL * slacX) / n;
        _shipAll();

        uint256 send = (ETH_BAL * spendBps) / 10_000;
        if (send > 0 && send < ETH_BAL) {
            vm.prank(maker);
            weth.transfer(address(0xDEAD), send);
        }

        uint256 wStart = weth.balanceOf(maker);
        uint256 t1Start = weth.balanceOf(taker);
        uint256 t2Start = weth.balanceOf(taker2);

        bool firstOk;
        bool secondOk;
        try this.externalSwapAs(taker, 3, false, 50_000e6) {
            firstOk = true;
        } catch {}
        try this.externalSwapAs(taker2, 4, false, 50_000e6) {
            secondOk = true;
        } catch {}

        uint256 taken = (weth.balanceOf(taker) - t1Start) + (weth.balanceOf(taker2) - t2Start);
        assertLe(taken, wStart, "fills cannot exceed the wallet");

        emit log_named_uint("slacX", slacX);
        emit log_named_uint("spendBps", spendBps);
        emit log_named_uint("first", firstOk ? 1 : 0);
        emit log_named_uint("second", secondOk ? 1 : 0);
        emit log_named_uint("collision", firstOk && !secondOk ? 1 : 0);
    }

    function externalSwap(uint256 rung, bool takerSellsWeth, uint256 amount)
        external
        returns (uint256, uint256)
    {
        return _swap(rung, takerSellsWeth, amount);
    }

    function externalSwapAs(address who, uint256 rung, bool takerSellsWeth, uint256 amount)
        external
        returns (uint256, uint256)
    {
        return _swapAs(who, rung, takerSellsWeth, amount);
    }

    function externalQuote(uint256 rung, bool takerSellsWeth, uint256 amount)
        external
        returns (uint256, uint256)
    {
        return _quote(rung, takerSellsWeth, amount);
    }

    function _shipAll() internal {
        (orders, hashes) = _orders();
        address[] memory tokens = new address[](2);
        tokens[0] = address(weth);
        tokens[1] = address(usdc);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = params.ethCap;
        amounts[1] = params.usdcCap;
        vm.startPrank(maker);
        for (uint256 i; i < orders.length; ++i) {
            bytes32 h = aqua.ship(address(router), abi.encode(orders[i]), tokens, amounts);
            assertEq(h, hashes[i]);
        }
        vm.stopPrank();
    }

    function _orders() internal view returns (ISwapVM.Order[] memory o, bytes32[] memory h) {
        uint256 n = params.rungCount;
        o = new ISwapVM.Order[](n);
        h = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            o[i] = manager.buildRungOrder(params, i);
            h[i] = router.hash(o[i]);
        }
    }

    function _swap(uint256 rung, bool takerSellsWeth, uint256 amount) internal returns (uint256, uint256) {
        return _swapAs(taker, rung, takerSellsWeth, amount);
    }

    function _swapAs(
        address who,
        uint256 rung,
        bool takerSellsWeth,
        uint256 amount
    ) internal returns (uint256, uint256) {
        bool isAToB = takerSellsWeth ? wethIsA : !wethIsA;
        bytes memory td = manager.buildTakerData(who, true, isAToB, true);
        vm.prank(who);
        (uint256 inAmt, uint256 outAmt,) = router.swap(orders[rung], amount, td);
        return (inAmt, outAmt);
    }

    function _quote(uint256 rung, bool takerSellsWeth, uint256 amount) internal view returns (uint256, uint256) {
        bool isAToB = takerSellsWeth ? wethIsA : !wethIsA;
        bytes memory td = manager.buildTakerData(taker, true, isAToB, true);
        (uint256 inAmt, uint256 outAmt,) = router.asView().quote(orders[rung], amount, td);
        return (inAmt, outAmt);
    }

    function _fee(uint256 amountIn) internal view returns (uint256) {
        return (amountIn * uint256(params.protocolFeeBps)) / GridLib.FEE_SCALE;
    }

    function _transferCountFrom(address from) internal returns (uint256 n) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("Transfer(address,address,uint256)");
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length > 1 && logs[i].topics[0] == sig) {
                address src = address(uint160(uint256(logs[i].topics[1])));
                if (src == from) ++n;
            }
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
