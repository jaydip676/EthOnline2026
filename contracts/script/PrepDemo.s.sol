// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {WETH_BASE, USDC_BASE} from "../src/libraries/Constants.sol";
import {LadderLens} from "../src/LadderLens.sol";

interface IWETH {
    function deposit() external payable;
    function balanceOf(address) external view returns (uint256);
}

/// @dev Uniswap V3 SwapRouter02 on Base. Ops-only — not part of the product.
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

/// @notice Turn leftover ETH on the deployer into WETH + native USDC for a $50-scale Base demo.
///         Keeps 0.003 ETH native for Start / fill gas.
contract PrepDemo is Script {
    ISwapRouter02 internal constant UNI = ISwapRouter02(0x2626664c2603336E57B271c5C0b26F421741e481);
    uint256 internal constant KEEP_ETH = 0.003 ether;
    uint256 internal constant KEEP_WETH = 0.006 ether;
    uint256 internal constant MIN_SWAP_ETH = 0.008 ether;
    uint256 internal constant MIN_USDC = 15e6;

    function run() external {
        require(block.chainid == 8453, "Base only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);

        uint256 wethBal = IERC20(WETH_BASE).balanceOf(me);
        uint256 usdcBal = IERC20(USDC_BASE).balanceOf(me);
        if (wethBal >= KEEP_WETH && usdcBal >= MIN_USDC && me.balance >= KEEP_ETH) {
            console2.log("already funded");
            console2.log("ETH", me.balance);
            console2.log("WETH", wethBal);
            console2.log("USDC", usdcBal);
            return;
        }

        uint256 native = me.balance;
        require(
            native >= KEEP_ETH + KEEP_WETH + MIN_SWAP_ETH,
            "send more ETH: need ~0.017 ETH total here (0.003 gas + 0.006 WETH + ~$20 USDC)"
        );

        string memory json = vm.readFile("../frontend/lib/deployments.json");
        address lens = vm.parseJsonAddress(json, ".lens");
        address oracle = vm.parseJsonAddress(json, ".chainlinkAdapter");
        (uint256 px,,) = LadderLens(lens).oraclePrice(oracle);
        require(px > 0, "oracle");

        uint256 wrapAmt = native - KEEP_ETH;
        uint256 swapAmt = wrapAmt - KEEP_WETH;
        uint256 minUsdc = (swapAmt * px * 95) / (100 * 1e18 * 1e12);

        vm.startBroadcast(pk);
        IWETH(WETH_BASE).deposit{value: wrapAmt}();
        IERC20(WETH_BASE).approve(address(UNI), swapAmt);
        uint256 out = _swap(me, swapAmt, minUsdc);
        vm.stopBroadcast();

        console2.log("ETH left", me.balance);
        console2.log("WETH", IERC20(WETH_BASE).balanceOf(me));
        console2.log("USDC", IERC20(USDC_BASE).balanceOf(me));
        console2.log("USDC from swap", out);
        console2.log("prep demo ok");
    }

    function _swap(address me, uint256 swapAmt, uint256 minUsdc) internal returns (uint256 out) {
        uint24[3] memory fees = [uint24(500), uint24(3000), uint24(100)];
        for (uint256 i; i < fees.length; ++i) {
            try UNI.exactInputSingle(
                ISwapRouter02.ExactInputSingleParams({
                    tokenIn: WETH_BASE,
                    tokenOut: USDC_BASE,
                    fee: fees[i],
                    recipient: me,
                    amountIn: swapAmt,
                    amountOutMinimum: minUsdc,
                    sqrtPriceLimitX96: 0
                })
            ) returns (uint256 amountOut) {
                return amountOut;
            } catch {}
        }
        revert("uni swap failed");
    }
}
