// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/XIRA.sol";

contract DeployV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory catalogPath = "../catalogs/asset_catalog.deploy.json";
        if (vm.envOr("XIRA_CATALOG_PATH", false)) {
            catalogPath = vm.envString("XIRA_CATALOG_PATH");
        }

        string memory raw = vm.readFile(catalogPath);
        string[] memory symbols = vm.parseJsonStringArray(raw, ".symbols");
        string[] memory addresses = vm.parseJsonStringArray(raw, ".addresses");
        require(symbols.length == addresses.length, "XIRA: catalog mismatch");

        vm.startBroadcast(deployerPrivateKey);

        XIRA xira = new XIRA();
        console.log("--- XIRA V2 Contract Deployed ---");
        console.log("Address:", address(xira));
        console.log("Owner:", xira.owner());
        console.log("");

        console.log("--- Registering assets from catalog ---");
        for (uint256 i = 0; i < symbols.length; i++) {
            xira.registerAsset(_toAddress(addresses[i]), symbols[i]);
            console.log("  Registered:", symbols[i]);
        }
        console.log("  Total registered:", symbols.length);

        console.log("");
        console.log("--- Deployer as authorized updater ---");
        xira.setAuthorizedUpdater(vm.addr(deployerPrivateKey), true);
        console.log("  Authorized:", vm.addr(deployerPrivateKey));

        console.log("");
        console.log("--- Write cooldown: 60s per asset ---");
        xira.setMinAttestationInterval(60);
        console.log("  minAttestationInterval =", xira.minAttestationInterval());

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("XIRA V2 Contract:", address(xira));
        console.log("Catalog-driven registration + pause + write cooldown live.");
        console.log("Explorer: https://www.okx.com/web3/explorer/xlayer/address/");
        console.log(address(xira));
        console.log("========================================");
    }

    function _toAddress(string memory s) internal pure returns (address) {
        bytes memory b = bytes(s);
        require(b.length == 42 && b[0] == bytes1("0") && b[1] == bytes1("x"), "XIRA: bad address");
        uint160 acc = 0;
        for (uint256 i = 2; i < 42; i++) {
            uint8 c = uint8(b[i]);
            uint8 d;
            if (c >= 48 && c <= 57) d = c - 48;
            else if (c >= 97 && c <= 102) d = c - 87;
            else if (c >= 65 && c <= 70) d = c - 55;
            else revert("XIRA: bad hex");
            acc = acc * 16 + d;
        }
        return address(acc);
    }
}