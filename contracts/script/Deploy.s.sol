// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/XIRA.sol";

contract DeployXIRA is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        XIRA xira = new XIRA();

        console.log("XIRA deployed at:", address(xira));
        console.log("Owner:", xira.owner());

        vm.stopBroadcast();
    }
}
