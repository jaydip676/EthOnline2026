// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {ISwapVM} from "swap-vm/src/interfaces/ISwapVM.sol";

import {AQUA, WETH_BASE, USDC_BASE} from "../src/libraries/Constants.sol";
import {GridLib} from "../src/libraries/GridLib.sol";
import {GridManager} from "../src/GridManager.sol";
import {LadderLens} from "../src/LadderLens.sol";
import {LadderRouter} from "../src/LadderRouter.sol";

/// @notice Pocket-money Base demo: 8 rungs (or the last registered grid), bid fill, then the same rung's ask.
contract DemoBase is Script {
    uint256 internal constant FILL_WETH = 0.0005 ether;
    uint256 internal constant FILL_USDC = 5e5; // 0.5 USDC

    function run() external {
        require(block.chainid == 8453, "Base only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);

        string memory json = vm.readFile("../frontend/lib/deployments.json");
        require(vm.parseJsonUint(json, ".chainId") == 8453, "not Base deployments");
        LadderRouter router = LadderRouter(payable(vm.parseJsonAddress(json, ".router")));
        GridManager manager = GridManager(vm.parseJsonAddress(json, ".gridManager"));
        LadderLens lens = LadderLens(vm.parseJsonAddress(json, ".lens"));
        address oracle = vm.parseJsonAddress(json, ".chainlinkAdapter");
        address treasury = vm.parseJsonAddress(json, ".treasury");

        uint256 wethBal = IERC20(WETH_BASE).balanceOf(me);
        uint256 usdcBal = IERC20(USDC_BASE).balanceOf(me);
        require(wethBal >= 0.005 ether, "need >= 0.005 WETH");
        require(usdcBal >= 15e6, "need >= 15 USDC");

        (uint256 spot,,) = lens.oraclePrice(oracle);
        require(spot > 1_000e18 && spot < 10_000e18, "spot");

        GridLib.GridParams memory p;
        uint256 gridId;
        uint256 existing = manager.gridCount(me);
        if (existing > 0) {
            gridId = existing - 1;
            p = manager.getGrid(me, gridId).params;
            console2.log("using existing grid", gridId);
        } else {
            p = GridLib.GridParams({
                maker: me,
                weth: WETH_BASE,
                usdc: USDC_BASE,
                oracle: oracle,
                treasury: treasury,
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
                saltNonce: uint64(block.timestamp),
                ethCap: (wethBal * GridLib.DEFAULT_COMMIT_BPS) / 10_000,
                usdcCap: (usdcBal * GridLib.DEFAULT_COMMIT_BPS) / 10_000
            });
        }

        bool wethIsA = WETH_BASE < USDC_BASE;
        uint256 rung = p.rungCount > 3 ? 3 : uint256(p.rungCount) / 2;

        vm.startBroadcast(pk);
        IERC20(WETH_BASE).approve(AQUA, type(uint256).max);
        IERC20(USDC_BASE).approve(AQUA, type(uint256).max);
        IERC20(WETH_BASE).approve(address(router), type(uint256).max);
        IERC20(USDC_BASE).approve(address(router), type(uint256).max);

        if (existing == 0) {
            (, bytes32[] memory hashes,,) = manager.previewGrid(p);
            address[] memory tokens = new address[](2);
            tokens[0] = WETH_BASE;
            tokens[1] = USDC_BASE;
            uint256[] memory amounts = new uint256[](2);
            amounts[0] = p.ethCap;
            amounts[1] = p.usdcCap;
            uint256 wethBefore = IERC20(WETH_BASE).balanceOf(me);
            uint256 usdcBefore = IERC20(USDC_BASE).balanceOf(me);
            for (uint256 i; i < p.rungCount; ++i) {
                bytes32 h = IAqua(AQUA).ship(address(router), abi.encode(manager.buildRungOrder(p, i)), tokens, amounts);
                require(h == hashes[i], "hash");
            }
            require(IERC20(WETH_BASE).balanceOf(me) == wethBefore, "ship moved WETH");
            require(IERC20(USDC_BASE).balanceOf(me) == usdcBefore, "ship moved USDC");
            gridId = manager.registerGrid(WETH_BASE, USDC_BASE, hashes, p);
        }

        ISwapVM.Order memory order = manager.buildRungOrder(p, rung);
        bytes memory bidTd = manager.buildTakerData(me, true, wethIsA, true);
        (uint256 swapIn, uint256 swapOut,) = router.swap(order, FILL_WETH, bidTd);
        require(swapOut > 0, "bid fill");

        bytes memory askTd = manager.buildTakerData(me, true, !wethIsA, true);
        (uint256 askSwapIn, uint256 askSwapOut,) = router.swap(order, FILL_USDC, askTd);
        require(askSwapOut > 0, "ask fill");
        vm.stopBroadcast();

        LadderLens.RungView[] memory rs = lens.rungs(me, gridId);
        console2.log("spot", spot);
        console2.log("gridId", gridId);
        console2.log("rung", rung);
        console2.log("ethCap", p.ethCap);
        console2.log("usdcCap", p.usdcCap);
        console2.log("bid in", swapIn);
        console2.log("bid out", swapOut);
        console2.log("ask in", askSwapIn);
        console2.log("ask out", askSwapOut);
        console2.log("rung bidLive", rs[rung].bidLive);
        console2.log("rung askLive", rs[rung].askLive);
        console2.log("base demo ok");
    }
}
