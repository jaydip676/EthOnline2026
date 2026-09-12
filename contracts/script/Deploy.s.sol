// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {AQUA, WETH_BASE, USDC_BASE, CHAINLINK_ETH_USD_BASE} from "../src/libraries/Constants.sol";
import {LadderRouter} from "../src/LadderRouter.sol";
import {GridManager} from "../src/GridManager.sol";
import {LadderLens} from "../src/LadderLens.sol";
import {ChainlinkAdapter} from "../src/oracle/ChainlinkAdapter.sol";

/// @notice Deploys Ladder against official Aqua on Base. Real WETH/USDC + Chainlink.
contract DeployScript is Script {
    struct Deployed {
        address router;
        address gridManager;
        address lens;
        address chainlinkAdapter;
        address treasury;
    }

    function run() external {
        require(block.chainid == 8453, "Ladder deploys on Base only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(AQUA.code.length > 0, "official Aqua missing on Base");

        Deployed memory d = _broadcast(pk);
        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            _write(d);
        } else {
            console2.log("dry-run; skip writing deployments.json");
            console2.log("router", d.router);
            console2.log("gridManager", d.gridManager);
            console2.log("lens", d.lens);
        }
    }

    function _broadcast(uint256 pk) internal returns (Deployed memory d) {
        address deployer = vm.addr(pk);
        d.treasury = deployer;

        vm.startBroadcast(pk);
        d.chainlinkAdapter = address(new ChainlinkAdapter(CHAINLINK_ETH_USD_BASE));
        d.router = address(new LadderRouter(AQUA, WETH_BASE, d.chainlinkAdapter, d.treasury, deployer));
        d.gridManager = address(new GridManager(LadderRouter(payable(d.router))));
        d.lens = address(new LadderLens(LadderRouter(payable(d.router)), GridManager(d.gridManager), IAqua(AQUA)));
        vm.stopBroadcast();
    }

    function _write(Deployed memory d) internal {
        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", uint256(8453));
        vm.serializeAddress(obj, "aqua", AQUA);
        vm.serializeAddress(obj, "router", d.router);
        vm.serializeAddress(obj, "gridManager", d.gridManager);
        vm.serializeAddress(obj, "lens", d.lens);
        vm.serializeAddress(obj, "weth", WETH_BASE);
        vm.serializeAddress(obj, "usdc", USDC_BASE);
        vm.serializeAddress(obj, "chainlinkAdapter", d.chainlinkAdapter);
        vm.serializeAddress(obj, "treasury", d.treasury);
        string memory json = vm.serializeUint(obj, "startBlock", block.number);
        vm.writeJson(json, "../frontend/lib/deployments.json");
        console2.log("wrote ../frontend/lib/deployments.json");
        console2.log(json);
    }
}
