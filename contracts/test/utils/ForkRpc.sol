// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {AQUA} from "../../src/libraries/Constants.sol";

abstract contract ForkRpc is Test {
    function forkAqua() internal {
        string memory url = _rpc();
        vm.createSelectFork(url);
        if (AQUA.code.length == 0) {
            vm.createSelectFork(_sepolia());
        }
        require(AQUA.code.length > 0, "official Aqua missing on fork");
    }

    function _rpc() internal view returns (string memory) {
        try vm.envString("BASE_RPC_URL") returns (string memory url) {
            if (bytes(url).length > 0) return url;
        } catch {}
        return "https://base-rpc.publicnode.com";
    }

    function _sepolia() internal view returns (string memory) {
        try vm.envString("ETH_RPC_URL") returns (string memory url) {
            if (bytes(url).length > 0) return url;
        } catch {}
        return "https://ethereum-sepolia-rpc.publicnode.com";
    }
}
