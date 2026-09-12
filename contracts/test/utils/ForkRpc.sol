// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {AQUA} from "../../src/libraries/Constants.sol";

abstract contract ForkRpc is Test {
    function forkAqua() internal {
        vm.createSelectFork(_rpc());
        require(AQUA.code.length > 0, "official Aqua missing on Base fork");
    }

    function _rpc() internal view returns (string memory) {
        try vm.envString("BASE_RPC_URL") returns (string memory url) {
            if (bytes(url).length > 0) return url;
        } catch {}
        return "https://mainnet.base.org";
    }
}
