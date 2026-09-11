// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Context} from "swap-vm/src/libs/VM.sol";
import {Simulator} from "@1inch/solidity-utils/contracts/mixins/Simulator.sol";
import {SwapVM} from "swap-vm/src/SwapVM.sol";
import {LadderOpcodes} from "./LadderOpcodes.sol";

/// @notice Redeployed SwapVM router pointed at official Aqua, with Ladder custom opcodes.
/// @dev Taker access is permissionless. A grid rung is a resting order.
///      `weth` is canonical chain WETH (Base / Sepolia), not a mock pair token.
contract LadderRouter is Simulator, SwapVM, LadderOpcodes {
    address public immutable CHAINLINK_FEED;
    address public immutable TREASURY;

    constructor(address aqua, address weth, address chainlinkFeed, address treasury, address owner)
        SwapVM(aqua, weth, owner, "Ladder", "1")
    {
        CHAINLINK_FEED = chainlinkFeed;
        TREASURY = treasury;
    }

    function _dispatch(Context memory ctx, uint256 opcode, bytes calldata args) internal override {
        _runOpcode(ctx, opcode, args);
    }
}
