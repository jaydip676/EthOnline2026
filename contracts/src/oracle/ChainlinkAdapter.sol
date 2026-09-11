// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

/// @notice Forwards AggregatorV3 calls. Production: pass this address as the envelope feed.
contract ChainlinkAdapter is IPriceOracle {
    IPriceOracle public immutable source;

    constructor(address source_) {
        source = IPriceOracle(source_);
    }

    function decimals() external view returns (uint8) {
        return source.decimals();
    }

    function description() external view returns (string memory) {
        return source.description();
    }

    function version() external view returns (uint256) {
        return source.version();
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return source.latestRoundData();
    }

    function getRoundData(uint80 roundId)
        external
        view
        returns (uint80 id, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return source.getRoundData(roundId);
    }
}
