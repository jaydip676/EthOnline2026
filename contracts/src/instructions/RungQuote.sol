// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {Context} from "swap-vm/src/libs/VM.sol";
import {Opcode} from "swap-vm/src/libs/OpcodeList.sol";
import {MemoryPtr, MemoryPtrLib} from "swap-vm/src/libs/MemoryPtr.sol";
import {InstructionBuilder} from "swap-vm/src/libs/InstructionBuilder.sol";
import {InstructionArgs} from "swap-vm/src/libs/InstructionArgs.sol";

/// @notice Fixed-price two-sided quote. A rung is a price, not a curve.
/// @dev Swap-curve bank slot Opcode._52.
///      Encoding:
///        [uint256 level][uint256 halfSpread][uint256 bidCap][uint256 askCap]
///        [uint8 wethDecimals][uint8 quoteDecimals][uint8 flags]
///      `level` and `halfSpread` are 1e18 ETH/USD.
///      Bid (maker buys ETH) fills at `L − s`. Ask (maker sells ETH) fills at `L + s`.
///      flags bit0 = wethIsTokenA.
library RungQuote {
    using InstructionArgs for bytes;
    using InstructionBuilder for MemoryPtr;
    using Math for uint256;

    error SideOff();
    error ZeroPrice();
    error ZeroOutput();

    Opcode internal constant opcode = Opcode._52;

    uint256 internal constant ONE = 1e18;
    uint8 internal constant FLAG_WETH_IS_TOKEN_A = 1;

    function sizeOf(uint256, uint256, uint256, uint256, uint8, uint8, uint8) internal pure returns (uint256) {
        return InstructionBuilder.sizeOf() + 32 + 32 + 32 + 32 + 1 + 1 + 1;
    }

    function build(
        uint256 level,
        uint256 halfSpread,
        uint256 bidCap,
        uint256 askCap,
        uint8 wethDecimals,
        uint8 quoteDecimals,
        bool wethIsTokenA
    ) internal pure returns (bytes memory) {
        uint8 flags = wethIsTokenA ? FLAG_WETH_IS_TOKEN_A : 0;
        return build(
            MemoryPtrLib.alloc(sizeOf(level, halfSpread, bidCap, askCap, wethDecimals, quoteDecimals, flags)),
            level,
            halfSpread,
            bidCap,
            askCap,
            wethDecimals,
            quoteDecimals,
            flags
        ).resolve();
    }

    function build(
        MemoryPtr ptrStart,
        uint256 level,
        uint256 halfSpread,
        uint256 bidCap,
        uint256 askCap,
        uint8 wethDecimals,
        uint8 quoteDecimals,
        uint8 flags
    ) internal pure returns (MemoryPtr ptr) {
        ptr = ptrStart.pushHeader(opcode);
        ptr = ptr.push(level, 32).push(halfSpread, 32).push(bidCap, 32).push(askCap, 32).push(wethDecimals).push(
            quoteDecimals
        ).push(flags);
        ptrStart.patchLength(ptr);
    }

    function parse(bytes calldata args)
        internal
        pure
        returns (
            uint256 level,
            uint256 halfSpread,
            uint256 bidCap,
            uint256 askCap,
            uint8 wethDecimals,
            uint8 quoteDecimals,
            uint8 flags
        )
    {
        level = args.at(0).asU256();
        halfSpread = args.at(32).asU256();
        bidCap = args.at(64).asU256();
        askCap = args.at(96).asU256();
        wethDecimals = args.at(128).asU8();
        quoteDecimals = args.at(129).asU8();
        flags = args.at(130).asU8();
    }

    function exec(Context memory ctx, bytes calldata args) internal pure {
        (
            uint256 level,
            uint256 halfSpread,
            uint256 bidCap,
            uint256 askCap,
            uint8 wethDecimals,
            uint8 quoteDecimals,
            uint8 flags
        ) = parse(args);

        bool wethIsTokenA = (flags & FLAG_WETH_IS_TOKEN_A) != 0;
        bool aToB = ctx.query.tokenIn < ctx.query.tokenOut;
        bool takerSellsWeth = wethIsTokenA ? aToB : !aToB;
        // Taker selling WETH → maker bid. Taker buying WETH → maker ask.
        bool isBid = takerSellsWeth;

        uint256 price = isBid ? level - halfSpread : level + halfSpread;
        require(price > 0, ZeroPrice());

        uint256 sideCap = isBid ? bidCap : askCap;
        if (sideCap == 0) revert SideOff();

        uint256 maxOut = ctx.swap.balanceOut < sideCap ? ctx.swap.balanceOut : sideCap;
        if (maxOut == 0) revert SideOff();

        uint256 wethScale = 10 ** uint256(wethDecimals);
        uint256 quoteScale = 10 ** uint256(quoteDecimals);

        if (ctx.query.isExactIn) {
            uint256 amountOut = _outForIn(isBid, ctx.swap.amountIn, price, wethScale, quoteScale);
            if (amountOut > maxOut) {
                amountOut = maxOut;
                ctx.swap.amountIn = _inForOut(isBid, amountOut, price, wethScale, quoteScale);
            }
            ctx.swap.amountOut = amountOut;
        } else {
            uint256 amountOut = ctx.swap.amountOut > maxOut ? maxOut : ctx.swap.amountOut;
            ctx.swap.amountOut = amountOut;
            ctx.swap.amountIn = _inForOut(isBid, amountOut, price, wethScale, quoteScale);
        }

        require(ctx.swap.amountOut > 0 && ctx.swap.amountIn > 0, ZeroOutput());
    }

    /// @dev Bid: WETH in → USDC out at `price`. Ask: USDC in → WETH out at `price`.
    function _outForIn(bool isBid, uint256 amountIn, uint256 price, uint256 wethScale, uint256 quoteScale)
        private
        pure
        returns (uint256)
    {
        if (isBid) {
            return Math.mulDiv(amountIn, price * quoteScale, ONE * wethScale);
        }
        return Math.mulDiv(amountIn, ONE * wethScale, price * quoteScale);
    }

    function _inForOut(bool isBid, uint256 amountOut, uint256 price, uint256 wethScale, uint256 quoteScale)
        private
        pure
        returns (uint256)
    {
        if (isBid) {
            return Math.mulDiv(amountOut, ONE * wethScale, price * quoteScale, Math.Rounding.Ceil);
        }
        return Math.mulDiv(amountOut, price * quoteScale, ONE * wethScale, Math.Rounding.Ceil);
    }
}
