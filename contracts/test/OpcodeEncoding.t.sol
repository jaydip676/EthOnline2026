// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Opcode} from "swap-vm/src/libs/OpcodeList.sol";
import {Salt} from "swap-vm/src/instructions/Controls.sol";

import {OracleEnvelope} from "../src/instructions/OracleEnvelope.sol";
import {WalletGuard} from "../src/instructions/WalletGuard.sol";
import {RungQuote} from "../src/instructions/RungQuote.sol";
import {ProtocolFee} from "../src/instructions/ProtocolFee.sol";
import {GridLib} from "../src/libraries/GridLib.sol";

contract OpcodeEncodingTest is Test {
    function test_oracleEnvelopeSlot() public pure {
        bytes memory encoded = OracleEnvelope.build(2400e18, 2600e18, 3600, address(0xFEED));
        assertEq(uint8(encoded[0]), uint8(Opcode._27));
        assertEq(uint8(encoded[1]), 88);
    }

    function test_walletGuardSlot() public pure {
        bytes memory encoded = WalletGuard.build(address(0xA), 2_000, address(0xB));
        assertEq(uint8(encoded[0]), uint8(Opcode._28));
        assertEq(uint8(encoded[1]), 42);
    }

    function test_rungQuoteSlot() public pure {
        bytes memory encoded = RungQuote.build(2500e18, 10e18, 1e6, 1e18, 18, 6, true);
        assertEq(uint8(encoded[0]), uint8(Opcode._52));
        assertEq(uint8(encoded[1]), 131);
    }

    function test_protocolFeeSlot() public pure {
        bytes memory encoded = ProtocolFee.build(5_000, address(0xFEE));
        assertEq(uint8(encoded[0]), uint8(Opcode._72));
        assertEq(uint8(encoded[1]), 23);
    }

    function test_saltStillPresent() public pure {
        bytes memory encoded = Salt.build(uint64(7));
        assertEq(uint8(encoded[0]), uint8(Opcode.Salt));
    }

    function test_gridGeometry() public pure {
        GridLib.GridParams memory p;
        p.spot = 2500e18;
        p.rangeBps = 600;
        p.envelopeBps = 1_000;
        p.rungCount = 8;
        p.maxShareBps = 2_000;
        p.maker = address(1);
        p.weth = address(2);
        p.usdc = address(3);
        p.oracle = address(4);
        GridLib.validate(p);

        uint256 lo = GridLib.low(p);
        uint256 hi = GridLib.high(p);
        assertEq(lo, 2350e18);
        assertEq(hi, 2650e18);
        assertEq(GridLib.level(p, 0), lo);
        assertEq(GridLib.level(p, 7), lo + GridLib.spacing(p) * 7);
        assertEq(GridLib.halfSpread(p) * 2, GridLib.spacing(p));
        assertEq(GridLib.envelopeFloor(p), 2250e18);
        assertEq(GridLib.envelopeCeiling(p), 2750e18);
    }
}
