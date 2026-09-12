// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Context} from "swap-vm/src/libs/VM.sol";
import {AquaOpcodes} from "swap-vm/src/opcodes/AquaOpcodes.sol";
import {OracleEnvelope} from "./instructions/OracleEnvelope.sol";
import {WalletGuard} from "./instructions/WalletGuard.sol";
import {CoverageGuard} from "./instructions/CoverageGuard.sol";
import {RungQuote} from "./instructions/RungQuote.sol";
import {ProtocolFee} from "./instructions/ProtocolFee.sol";

/// @notice Aqua opcode table plus Ladder's five custom instructions.
contract LadderOpcodes is AquaOpcodes {
    function _runOpcode(Context memory ctx, uint256 opcode, bytes calldata args) internal virtual override {
        if (opcode == OracleEnvelope.opcode.asU8()) {
            OracleEnvelope.exec(ctx, args);
            return;
        }
        if (opcode == WalletGuard.opcode.asU8()) {
            WalletGuard.exec(ctx, args);
            return;
        }
        if (opcode == CoverageGuard.opcode.asU8()) {
            CoverageGuard.exec(ctx, args);
            return;
        }
        if (opcode == RungQuote.opcode.asU8()) {
            RungQuote.exec(ctx, args);
            return;
        }
        if (opcode == ProtocolFee.opcode.asU8()) {
            ProtocolFee.exec(ctx, args);
            return;
        }
        super._runOpcode(ctx, opcode, args);
    }
}
