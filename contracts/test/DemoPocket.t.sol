// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {ISwapVM} from "swap-vm/src/interfaces/ISwapVM.sol";

import {AQUA, WETH_BASE, USDC_BASE} from "../src/libraries/Constants.sol";
import {GridLib} from "../src/libraries/GridLib.sol";
import {GridManager} from "../src/GridManager.sol";
import {LadderLens} from "../src/LadderLens.sol";
import {LadderRouter} from "../src/LadderRouter.sol";
import {ForkRpc} from "./utils/ForkRpc.sol";

interface IWETH {
    function deposit() external payable;
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Pocket-money path against the live Base deployment. Needs BASE_RPC_URL.
contract DemoPocketTest is ForkRpc {
    ISwapRouter02 internal constant UNI = ISwapRouter02(0x2626664c2603336E57B271c5C0b26F421741e481);
    address internal constant MAKER = 0x637AcD6C56f9D4685B1b9f949a4903049c22C7aA;

    function test_pocketDemoOnLiveBase() public {
        forkAqua();
        string memory json = vm.readFile("../frontend/lib/deployments.json");
        LadderRouter router = LadderRouter(payable(vm.parseJsonAddress(json, ".router")));
        GridManager manager = GridManager(vm.parseJsonAddress(json, ".gridManager"));
        LadderLens lens = LadderLens(vm.parseJsonAddress(json, ".lens"));
        address oracle = vm.parseJsonAddress(json, ".chainlinkAdapter");
        require(address(router).code.length > 0, "router");

        vm.deal(MAKER, 0.02 ether);
        vm.startPrank(MAKER);

        uint256 wrapAmt = 0.017 ether;
        uint256 swapAmt = 0.011 ether;
        IWETH(WETH_BASE).deposit{value: wrapAmt}();
        IERC20(WETH_BASE).approve(address(UNI), swapAmt);
        uint256 usdcOut = UNI.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH_BASE,
                tokenOut: USDC_BASE,
                fee: 500,
                recipient: MAKER,
                amountIn: swapAmt,
                amountOutMinimum: 20e6,
                sqrtPriceLimitX96: 0
            })
        );
        require(usdcOut >= 20e6, "usdc");
        require(IERC20(WETH_BASE).balanceOf(MAKER) >= 0.005 ether, "weth");

        IERC20(WETH_BASE).approve(AQUA, type(uint256).max);
        IERC20(USDC_BASE).approve(AQUA, type(uint256).max);
        IERC20(WETH_BASE).approve(address(router), type(uint256).max);
        IERC20(USDC_BASE).approve(address(router), type(uint256).max);

        (uint256 spot,,) = lens.oraclePrice(oracle);
        GridLib.GridParams memory p = GridLib.GridParams({
            maker: MAKER,
            weth: WETH_BASE,
            usdc: USDC_BASE,
            oracle: oracle,
            treasury: MAKER,
            aqua: AQUA,
            spot: spot,
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
            saltNonce: 42,
            ethCap: (IERC20(WETH_BASE).balanceOf(MAKER) * GridLib.DEFAULT_COMMIT_BPS) / 10_000,
            usdcCap: (IERC20(USDC_BASE).balanceOf(MAKER) * GridLib.DEFAULT_COMMIT_BPS) / 10_000
        });

        (, bytes32[] memory hashes,,) = manager.previewGrid(p);
        address[] memory tokens = new address[](2);
        tokens[0] = WETH_BASE;
        tokens[1] = USDC_BASE;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = p.ethCap;
        amounts[1] = p.usdcCap;
        uint256 wethBefore = IERC20(WETH_BASE).balanceOf(MAKER);
        uint256 usdcBefore = IERC20(USDC_BASE).balanceOf(MAKER);
        for (uint256 i; i < p.rungCount; ++i) {
            bytes32 h = IAqua(AQUA).ship(address(router), abi.encode(manager.buildRungOrder(p, i)), tokens, amounts);
            require(h == hashes[i], "hash");
        }
        require(IERC20(WETH_BASE).balanceOf(MAKER) == wethBefore, "ship moved WETH");
        require(IERC20(USDC_BASE).balanceOf(MAKER) == usdcBefore, "ship moved USDC");
        uint256 gridId = manager.registerGrid(WETH_BASE, USDC_BASE, hashes, p);

        LadderLens.RungView[] memory beforeFill = lens.rungs(MAKER, gridId);
        uint256 live;
        for (uint256 i; i < beforeFill.length; ++i) {
            if (beforeFill[i].bidLive || beforeFill[i].askLive) ++live;
        }
        require(live >= 6, "rungs not live");

        bool wethIsA = WETH_BASE < USDC_BASE;
        ISwapVM.Order memory order = manager.buildRungOrder(p, 3);
        (uint256 bidIn, uint256 bidOut,) =
            router.swap(order, 0.0005 ether, manager.buildTakerData(MAKER, true, wethIsA, true));
        require(bidOut > 0 && bidIn > 0, "bid");
        (uint256 askIn, uint256 askOut,) =
            router.swap(order, 5e5, manager.buildTakerData(MAKER, true, !wethIsA, true));
        require(askOut > 0 && askIn > 0, "ask rearm");

        LadderLens.RungView[] memory afterFill = lens.rungs(MAKER, gridId);
        require(afterFill[3].bidLive || afterFill[3].askLive, "rung 3 dead after round-trip");

        uint256 dump = (IERC20(WETH_BASE).balanceOf(MAKER) * 70) / 100;
        IERC20(WETH_BASE).transfer(address(1), dump);
        vm.stopPrank();

        LadderLens.RungView[] memory afterDump = lens.rungs(MAKER, gridId);
        require(!afterDump[3].askLive, "ask still live after 70% WETH spend");
        require(afterDump[3].bidLive, "bid should stay live");
        require(afterDump[3].pausedReason == GridLib.PausedReason.None, "bid side still quotes");
    }
}
