// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {Context} from "swap-vm/src/libs/VM.sol";
import {Opcode} from "swap-vm/src/libs/OpcodeList.sol";
import {MemoryPtr, MemoryPtrLib} from "swap-vm/src/libs/MemoryPtr.sol";
import {InstructionBuilder} from "swap-vm/src/libs/InstructionBuilder.sol";
import {InstructionArgs} from "swap-vm/src/libs/InstructionArgs.sol";
import {
    FeeReceiver,
    FeeReceiverLib,
    FeeMetaLib
} from "swap-vm/src/libs/ProtocolFee.sol";

/// @notice Taker-paid flat fee on `tokenIn`, paid to a fixed treasury before the maker push.
/// @dev Fees-bank slot Opcode._72. Visible in the program bytes; never hidden.
///      Encoding: [uint24 bps][address treasury]
///      `bps` uses FeeProtocol scale: 1e7 = 100%, so 5 bps of fill = 5_000.
library ProtocolFee {
    using InstructionArgs for bytes;
    using InstructionBuilder for MemoryPtr;
    using Math for uint256;

    error FeeBpsOutOfRange(uint24 bps);
    error BadTreasury();

    Opcode internal constant opcode = Opcode._72;

    uint256 internal constant BPS = FeeReceiverLib.BPS;

    function sizeOf(uint24, address) internal pure returns (uint256) {
        return InstructionBuilder.sizeOf() + 3 + 20;
    }

    function build(
        uint24 bps,
        address treasury
    ) internal pure returns (bytes memory) {
        return
            build(MemoryPtrLib.alloc(sizeOf(bps, treasury)), bps, treasury)
                .resolve();
    }

    function build(
        MemoryPtr ptrStart,
        uint24 bps,
        address treasury
    ) internal pure returns (MemoryPtr ptr) {
        require(bps < BPS, FeeBpsOutOfRange(bps));
        require(treasury != address(0), BadTreasury());
        ptr = ptrStart.pushHeader(opcode);
        ptr = ptr.push(bps, 3).push(treasury);
        ptrStart.patchLength(ptr);
    }

    function parse(
        bytes calldata args
    ) internal pure returns (uint24 bps, address treasury) {
        bps = args.at(0).asU24();
        treasury = args.at(3).asAddress();
    }

    function exec(Context memory ctx, bytes calldata args) internal {
        (uint24 bps, address treasury) = parse(args);

        FeeReceiver[] memory receivers = new FeeReceiver[](1);
        receivers[0] = FeeReceiverLib.encode(treasury, bps, 0);
        ctx.fee.meta = FeeMetaLib.encode(true, 1, bps, 0);
        ctx.fee.receivers = receivers;

        uint256 fee;
        if (ctx.query.isExactIn) {
            fee = (ctx.swap.amountIn * uint256(bps)) / BPS;
            ctx.swap.amountIn -= fee;

            uint256 reduction = ctx.swap.amountIn;
            ctx.runLoop();
            reduction -= ctx.swap.amountIn;

            if (reduction > 0)
                fee = (ctx.swap.amountIn * uint256(bps)) / (BPS - bps);
        } else {
            ctx.runLoop();
            fee = (ctx.swap.amountIn * uint256(bps)) / (BPS - bps);
        }
        ctx.swap.amountIn += fee;
        ctx.fee.feeTotal = fee;
    }
}
