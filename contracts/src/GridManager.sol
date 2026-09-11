// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Salt} from "swap-vm/src/instructions/Controls.sol";
import {MakerTraitsLib} from "swap-vm/src/libs/MakerTraits.sol";
import {TakerTraitsLib} from "swap-vm/src/libs/TakerTraits.sol";
import {ISwapVM} from "swap-vm/src/interfaces/ISwapVM.sol";

import {OracleEnvelope} from "./instructions/OracleEnvelope.sol";
import {WalletGuard} from "./instructions/WalletGuard.sol";
import {RungQuote} from "./instructions/RungQuote.sol";
import {ProtocolFee} from "./instructions/ProtocolFee.sol";
import {GridLib} from "./libraries/GridLib.sol";
import {LadderRouter} from "./LadderRouter.sol";

/// @notice Program factory and registry. Not a custodian — Aqua.ship is maker-only.
contract GridManager {
    using GridLib for GridLib.GridParams;

    event GridRegistered(
        address indexed maker,
        uint256 indexed gridId,
        address tokenA,
        address tokenB,
        bytes32[] hashes
    );

    struct Grid {
        address tokenA;
        address tokenB;
        bytes32[] hashes;
        GridLib.GridParams params;
        uint64 registeredAt;
        bool active;
    }

    LadderRouter public immutable router;

    mapping(address maker => Grid[]) internal _grids;

    error UnknownGrid();
    error HashMismatch();

    constructor(LadderRouter router_) {
        router = router_;
    }

    function gridCount(address maker) external view returns (uint256) {
        return _grids[maker].length;
    }

    function getGrid(
        address maker,
        uint256 gridId
    ) external view returns (Grid memory) {
        if (gridId >= _grids[maker].length) revert UnknownGrid();
        return _grids[maker][gridId];
    }

    /// @dev Spec order: envelope → guards → quote → fee → salt.
    function buildRungProgram(
        GridLib.GridParams memory p,
        uint256 rungIndex
    ) public pure returns (bytes memory) {
        GridLib.validate(p);
        bytes memory program = OracleEnvelope.build(
            GridLib.envelopeFloor(p),
            GridLib.envelopeCeiling(p),
            p.maxStaleness,
            p.oracle
        );
        program = bytes.concat(
            program,
            WalletGuard.build(p.weth, p.maxShareBps, p.aqua)
        );
        program = bytes.concat(
            program,
            WalletGuard.build(p.usdc, p.maxShareBps, p.aqua)
        );
        program = bytes.concat(
            program,
            RungQuote.build(
                GridLib.level(p, rungIndex),
                GridLib.halfSpread(p),
                GridLib.bidCap(p),
                GridLib.askCap(p),
                p.wethDecimals,
                p.usdcDecimals,
                GridLib.wethIsTokenA(p)
            )
        );
        program = bytes.concat(
            program,
            ProtocolFee.build(p.protocolFeeBps, p.treasury)
        );
        program = bytes.concat(program, Salt.build(GridLib.salt(p, rungIndex)));
        return program;
    }

    function buildRungOrder(
        GridLib.GridParams memory p,
        uint256 rungIndex
    ) public pure returns (ISwapVM.Order memory) {
        return
            _aquaOrder(
                p.maker,
                GridLib.tokenA(p),
                GridLib.tokenB(p),
                buildRungProgram(p, rungIndex)
            );
    }

    function previewGrid(
        GridLib.GridParams memory p
    )
        external
        view
        returns (
            bytes[] memory programs,
            bytes32[] memory hashes,
            uint256[] memory usdcCaps,
            uint256[] memory ethCaps
        )
    {
        GridLib.validate(p);
        uint256 n = p.rungCount;
        programs = new bytes[](n);
        hashes = new bytes32[](n);
        usdcCaps = new uint256[](n);
        ethCaps = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            programs[i] = buildRungProgram(p, i);
            hashes[i] = router.hash(buildRungOrder(p, i));
            usdcCaps[i] = GridLib.bidCap(p);
            ethCaps[i] = GridLib.askCap(p);
        }
    }

    function registerGrid(
        address tokenA_,
        address tokenB_,
        bytes32[] calldata hashes,
        GridLib.GridParams calldata p
    ) external returns (uint256 gridId) {
        GridLib.GridParams memory params = p;
        params.maker = msg.sender;
        GridLib.validate(params);
        if (hashes.length != params.rungCount) revert HashMismatch();
        for (uint256 i; i < hashes.length; ++i) {
            if (hashes[i] != router.hash(buildRungOrder(params, i)))
                revert HashMismatch();
        }
        if (tokenA_ > tokenB_) (tokenA_, tokenB_) = (tokenB_, tokenA_);

        Grid storage g = _grids[msg.sender].push();
        g.tokenA = tokenA_;
        g.tokenB = tokenB_;
        g.hashes = hashes;
        g.params = params;
        g.registeredAt = uint64(block.timestamp);
        g.active = true;
        gridId = _grids[msg.sender].length - 1;
        emit GridRegistered(msg.sender, gridId, tokenA_, tokenB_, hashes);
    }

    function markInactive(uint256 gridId) external {
        if (gridId >= _grids[msg.sender].length) revert UnknownGrid();
        _grids[msg.sender][gridId].active = false;
    }

    function buildTakerData(
        address taker,
        bool isExactIn,
        bool isAToB,
        bool allowPartialFill
    ) external pure returns (bytes memory) {
        return
            TakerTraitsLib.build(
                TakerTraitsLib.Args({
                    taker: taker,
                    isExactIn: isExactIn,
                    shouldUnwrapWeth: false,
                    isStrictThresholdAmount: false,
                    isFirstTransferFromTaker: false,
                    useTransferFromAndAquaPush: true,
                    isAToB: isAToB,
                    allowPartialFill: allowPartialFill,
                    threshold: "",
                    to: address(0),
                    deadline: 0,
                    hasPreTransferInCallback: false,
                    hasPreTransferOutCallback: false,
                    preTransferInHookData: "",
                    postTransferInHookData: "",
                    preTransferOutHookData: "",
                    postTransferOutHookData: "",
                    preTransferInCallbackData: "",
                    preTransferOutCallbackData: "",
                    instructionsArgs: "",
                    signature: ""
                })
            );
    }

    function _aquaOrder(
        address maker,
        address tokenA_,
        address tokenB_,
        bytes memory program
    ) internal pure returns (ISwapVM.Order memory order) {
        if (tokenA_ > tokenB_) (tokenA_, tokenB_) = (tokenB_, tokenA_);
        order = MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: maker,
                receiver: address(0),
                tokenA: tokenA_,
                tokenB: tokenB_,
                shouldUnwrapWeth: false,
                useAquaInsteadOfSignature: true,
                allowZeroAmountIn: false,
                hasPreTransferInHook: false,
                hasPostTransferInHook: false,
                hasPreTransferOutHook: false,
                hasPostTransferOutHook: false,
                preTransferInTarget: address(0),
                preTransferInData: "",
                postTransferInTarget: address(0),
                postTransferInData: "",
                preTransferOutTarget: address(0),
                preTransferOutData: "",
                postTransferOutTarget: address(0),
                postTransferOutData: "",
                program: program
            })
        );
    }
}
