// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {Context} from "swap-vm/src/libs/VM.sol";
import {Opcode} from "swap-vm/src/libs/OpcodeList.sol";
import {MemoryPtr, MemoryPtrLib} from "swap-vm/src/libs/MemoryPtr.sol";
import {InstructionBuilder} from "swap-vm/src/libs/InstructionBuilder.sol";
import {InstructionArgs} from "swap-vm/src/libs/InstructionArgs.sol";

/// @notice Caps the maker's token to a live share of the real wallet.
/// @dev Reserved conditions-bank slot Opcode._28.
///      Encoding: [address token][uint16 maxShareBps][address aqua]
///      `available = min(aquaVirtual, balanceOf(maker) * maxShareBps / 10_000, allowance(maker, aqua))`
///      Reverts `InsufficientWalletBalance` when available is zero.
library WalletGuard {
    using InstructionArgs for bytes;
    using InstructionBuilder for MemoryPtr;

    error InsufficientWalletBalance(uint256 available, uint256 needed);
    error MaxShareBpsOutOfRange(uint16 maxShareBps);

    Opcode internal constant opcode = Opcode._28;

    uint256 internal constant SHARE_DENOM = 10_000;

    function sizeOf(address, uint16, address) internal pure returns (uint256) {
        return InstructionBuilder.sizeOf() + 20 + 2 + 20;
    }

    function build(
        address token,
        uint16 maxShareBps,
        address aqua
    ) internal pure returns (bytes memory) {
        return
            build(
                MemoryPtrLib.alloc(sizeOf(token, maxShareBps, aqua)),
                token,
                maxShareBps,
                aqua
            ).resolve();
    }

    function build(
        MemoryPtr ptrStart,
        address token,
        uint16 maxShareBps,
        address aqua
    ) internal pure returns (MemoryPtr ptr) {
        require(maxShareBps <= SHARE_DENOM, MaxShareBpsOutOfRange(maxShareBps));
        ptr = ptrStart.pushHeader(opcode);
        ptr = ptr.push(token).push(maxShareBps, 2).push(aqua);
        ptrStart.patchLength(ptr);
    }

    function parse(
        bytes calldata args
    ) internal pure returns (address token, uint16 maxShareBps, address aqua) {
        token = args.at(0).asAddress();
        maxShareBps = args.at(20).asU16();
        aqua = args.at(22).asAddress();
    }

    function availableOf(
        address maker,
        address token,
        uint16 maxShareBps,
        address aqua,
        uint256 aquaVirtual
    ) internal view returns (uint256) {
        uint256 share = Math.mulDiv(
            IERC20(token).balanceOf(maker),
            maxShareBps,
            SHARE_DENOM
        );
        uint256 allowance_ = IERC20(token).allowance(maker, aqua);
        return Math.min(aquaVirtual, Math.min(share, allowance_));
    }

    function exec(Context memory ctx, bytes calldata args) internal view {
        (address token, uint16 maxShareBps, address aqua) = parse(args);

        uint256 available = availableOf(
            ctx.query.maker,
            token,
            maxShareBps,
            aqua,
            ctx.swap.balanceOut
        );
        if (available == 0)
            revert InsufficientWalletBalance(
                0,
                ctx.swap.amountOut == 0 ? 1 : ctx.swap.amountOut
            );
        if (available < ctx.swap.balanceOut) ctx.swap.balanceOut = available;
    }
}
