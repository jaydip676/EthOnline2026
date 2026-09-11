// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Settable Chainlink-shaped feed. Tests / local demo only.
contract MockOracle is IPriceOracle {
    int256 internal _answer;
    uint8 internal _decimals;
    uint256 internal _updatedAt;
    uint80 internal _roundId;
    string internal _description;

    constructor(
        int256 initialAnswer,
        uint8 decimals_,
        string memory description_
    ) {
        _decimals = decimals_;
        _description = description_;
        _set(initialAnswer, block.timestamp);
    }

    function setPrice(int256 answer_) external {
        _set(answer_, block.timestamp);
    }

    function setPriceAndTimestamp(int256 answer_, uint256 updatedAt_) external {
        _set(answer_, updatedAt_);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external view returns (string memory) {
        return _description;
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }

    function getRoundData(
        uint80
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }

    function _set(int256 answer_, uint256 updatedAt_) internal {
        _answer = answer_;
        _updatedAt = updatedAt_;
        unchecked {
            ++_roundId;
        }
    }
}
