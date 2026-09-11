// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {
    AQUA,
    WETH_BASE,
    USDC_BASE,
    CHAINLINK_ETH_USD_BASE,
    WETH_SEPOLIA,
    CHAINLINK_ETH_USD_SEPOLIA
} from "../src/libraries/Constants.sol";
import {LadderRouter} from "../src/LadderRouter.sol";
import {GridManager} from "../src/GridManager.sol";
import {LadderLens} from "../src/LadderLens.sol";
import {ChainlinkAdapter} from "../src/oracle/ChainlinkAdapter.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys Ladder against official Aqua. Base uses real WETH/USDC + Chainlink.
contract DeployScript is Script {
    struct Deployed {
        address router;
        address gridManager;
        address lens;
        address chainlinkAdapter;
        address mockOracle;
        address weth;
        address usdc;
        address treasury;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IAqua aqua = IAqua(AQUA);
        require(address(aqua).code.length > 0, "official Aqua missing on this chain");

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

        uint256 chainId = block.chainid;
        address weth;
        address feed;
        if (chainId == 8453) {
            weth = WETH_BASE;
            d.weth = WETH_BASE;
            d.usdc = USDC_BASE;
            feed = CHAINLINK_ETH_USD_BASE;
        } else {
            weth = WETH_SEPOLIA;
            feed = CHAINLINK_ETH_USD_SEPOLIA;
        }

        vm.startBroadcast(pk);
        d.chainlinkAdapter = address(new ChainlinkAdapter(feed));
        if (chainId != 8453) {
            MockERC20 w = new MockERC20("Wrapped Ether", "WETH", 18);
            MockERC20 u = new MockERC20("USD Coin", "USDC", 6);
            d.weth = address(w);
            d.usdc = address(u);
            bool wethIsA = d.weth < d.usdc;
            d.mockOracle = address(new MockOracle(int256(wethIsA ? uint256(2500e18) : uint256(1e36 / 2500e18)), 18, "ETH / USD"));
        }
        address envelopeFeed = d.mockOracle == address(0) ? d.chainlinkAdapter : d.mockOracle;
        d.router = address(new LadderRouter(AQUA, weth, envelopeFeed, d.treasury, deployer));
        d.gridManager = address(new GridManager(LadderRouter(payable(d.router))));
        d.lens = address(new LadderLens(LadderRouter(payable(d.router)), GridManager(d.gridManager), IAqua(AQUA)));
        vm.stopBroadcast();
    }

    function _write(Deployed memory d) internal {
        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "aqua", AQUA);
        vm.serializeAddress(obj, "router", d.router);
        vm.serializeAddress(obj, "gridManager", d.gridManager);
        vm.serializeAddress(obj, "lens", d.lens);
        vm.serializeAddress(obj, "weth", d.weth);
        vm.serializeAddress(obj, "usdc", d.usdc);
        vm.serializeAddress(obj, "chainlinkAdapter", d.chainlinkAdapter);
        vm.serializeAddress(obj, "mockOracle", d.mockOracle);
        vm.serializeAddress(obj, "treasury", d.treasury);
        string memory json = vm.serializeUint(obj, "startBlock", block.number);
        vm.writeJson(json, "../frontend/lib/deployments.json");
        console2.log(json);
    }
}
