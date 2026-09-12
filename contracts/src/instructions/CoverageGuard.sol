// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";

import { Context } from "swap-vm/src/libs/VM.sol";
import { Opcode } from "swap-vm/src/libs/OpcodeList.sol";
import { MemoryPtr, MemoryPtrLib } from "swap-vm/src/libs/MemoryPtr.sol";
import { InstructionBuilder } from "swap-vm/src/libs/InstructionBuilder.sol";
import { InstructionArgs } from "swap-vm/src/libs/InstructionArgs.sol";

import { WalletGuard } from "./WalletGuard.sol";

/// @notice Auto-docks a quote when coverage falls below the maker's floor.
/// @dev Reserved conditions-bank slot Opcode._29.
///      Encoding: [uint16 minCoverageBps][uint16 maxShareBps][address aqua]
///      `quotedSize` is the live Aqua virtual balance.
///      `realAvailable = min(quotedSize, wallet × maxShareBps / 10_000, allowance)`
///      `coverage = realAvailable / quotedSize` in bps.
///      Reverts `CoverageBreach(coverage)` below `minCoverageBps`.
///      Reads Aqua virtual itself so it stays correct after WalletGuard caps `balanceOut`.
library CoverageGuard {
    using InstructionArgs for bytes;
    using InstructionBuilder for MemoryPtr;

    error CoverageBreach(uint256 coverage);
    error MinCoverageBpsOutOfRange(uint16 minCoverageBps);

    Opcode internal constant opcode = Opcode._29;

    uint256 internal constant BPS = 10_000;

    function sizeOf(uint16, uint16, address) internal pure returns (uint256) {
        return InstructionBuilder.sizeOf() + 2 + 2 + 20;
    }

    function build(uint16 minCoverageBps, uint16 maxShareBps, address aqua) internal pure returns (bytes memory) {
        return build(MemoryPtrLib.alloc(sizeOf(minCoverageBps, maxShareBps, aqua)), minCoverageBps, maxShareBps, aqua)
            .resolve();
    }

    function build(MemoryPtr ptrStart, uint16 minCoverageBps, uint16 maxShareBps, address aqua)
        internal
        pure
        returns (MemoryPtr ptr)
    {
        require(minCoverageBps > 0 && minCoverageBps <= BPS, MinCoverageBpsOutOfRange(minCoverageBps));
        ptr = ptrStart.pushHeader(opcode);
        ptr = ptr.push(minCoverageBps, 2).push(maxShareBps, 2).push(aqua);
        ptrStart.patchLength(ptr);
    }

    function parse(bytes calldata args)
        internal
        pure
        returns (uint16 minCoverageBps, uint16 maxShareBps, address aqua)
    {
        minCoverageBps = args.at(0).asU16();
        maxShareBps = args.at(2).asU16();
        aqua = args.at(4).asAddress();
    }

    function coverageOf(address maker, address token, uint16 maxShareBps, address aqua, uint256 quotedSize)
        internal
        view
        returns (uint256 coverageBps, uint256 realAvailable)
    {
        realAvailable = WalletGuard.availableOf(maker, token, maxShareBps, aqua, quotedSize);
        if (quotedSize == 0) return (0, realAvailable);
        coverageBps = Math.mulDiv(realAvailable, BPS, quotedSize);
    }

    function exec(Context memory ctx, bytes calldata args) internal view {
        (uint16 minCoverageBps, uint16 maxShareBps, address aqua) = parse(args);
        (uint248 quotedSize,) =
            IAqua(aqua).rawBalances(ctx.query.maker, address(this), ctx.query.orderHash, ctx.query.tokenOut);
        (uint256 coverage,) = coverageOf(ctx.query.maker, ctx.query.tokenOut, maxShareBps, aqua, uint256(quotedSize));
        if (coverage < minCoverageBps) revert CoverageBreach(coverage);
    }
}
