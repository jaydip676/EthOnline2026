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

        vm.startPrank(maker);
        weth.approve(address(aqua), type(uint256).max);
        usdc.approve(address(aqua), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(taker);
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

    function externalSwap(uint256 rung, bool takerSellsWeth, uint256 amount)
        external
        returns (uint256, uint256)
    {
        return _swap(rung, takerSellsWeth, amount);
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
        bool isAToB = takerSellsWeth ? wethIsA : !wethIsA;
        bytes memory td = manager.buildTakerData(taker, true, isAToB, true);
        vm.prank(taker);
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
}
