// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { Context } from "swap-vm/src/libs/VM.sol";
import { Opcode } from "swap-vm/src/libs/OpcodeList.sol";
import { MemoryPtr, MemoryPtrLib } from "swap-vm/src/libs/MemoryPtr.sol";
import { InstructionBuilder } from "swap-vm/src/libs/InstructionBuilder.sol";
import { InstructionArgs } from "swap-vm/src/libs/InstructionArgs.sol";
import { IPriceOracle } from "../instructions/IPriceOracle.sol";

/// @notice Reverts the quote when Chainlink fair price is outside `[floor, ceiling)` or the feed is stale.
/// @dev Reserved conditions-bank slot Opcode._27.
///      Encoding: [uint256 floor][uint256 ceiling][uint32 maxStaleness][address feed]
///      `floor`/`ceiling` are 1e18 ETH/USD. `maxStaleness` is seconds since `updatedAt`.
library OracleEnvelope {
    using InstructionArgs for bytes;
    using InstructionBuilder for MemoryPtr;
    using SafeCast for int256;

    error EnvelopeClosed(uint256 price);
    error OracleStale(uint256 updatedAt);
    error OracleAnswerNonPositive(int256 answer);

    Opcode internal constant opcode = Opcode._27;

    uint8 internal constant DECIMALS = 18;

    function sizeOf(uint256, uint256, uint32, address) internal pure returns (uint256) {
        return InstructionBuilder.sizeOf() + 32 + 32 + 4 + 20;
    }

    function build(uint256 floor, uint256 ceiling, uint32 maxStaleness, address feed)
        internal
        pure
        returns (bytes memory)
    {
        return build(MemoryPtrLib.alloc(sizeOf(floor, ceiling, maxStaleness, feed)), floor, ceiling, maxStaleness, feed)
            .resolve();
    }

    function build(MemoryPtr ptrStart, uint256 floor, uint256 ceiling, uint32 maxStaleness, address feed)
        internal
        pure
        returns (MemoryPtr ptr)
    {
        ptr = ptrStart.pushHeader(opcode);
        ptr = ptr.push(floor, 32).push(ceiling, 32).push(maxStaleness, 4).push(feed);
        ptrStart.patchLength(ptr);
    }

    function parse(bytes calldata args)
        internal
        pure
        returns (uint256 floor, uint256 ceiling, uint32 maxStaleness, address feed)
    {
        floor = args.at(0).asU256();
        ceiling = args.at(32).asU256();
        maxStaleness = args.at(64).asU32();
        feed = args.at(68).asAddress();
    }

    function exec(Context memory, bytes calldata args) internal view {
        (uint256 floor, uint256 ceiling, uint32 maxStaleness, address feed) = parse(args);
        IPriceOracle oracle = IPriceOracle(feed);
        (, int256 answer,, uint256 updatedAt,) = oracle.latestRoundData();
        require(answer > 0, OracleAnswerNonPositive(answer));
        if (block.timestamp > updatedAt + uint256(maxStaleness)) revert OracleStale(updatedAt);

        uint8 oracleDecimals = oracle.decimals();
        uint256 px = answer.toUint256();
        if (oracleDecimals < DECIMALS) px = px * 10 ** (DECIMALS - oracleDecimals);
        else if (oracleDecimals > DECIMALS) px = px / 10 ** (oracleDecimals - DECIMALS);

        if (px < floor || px >= ceiling) revert EnvelopeClosed(px);
    }
}
