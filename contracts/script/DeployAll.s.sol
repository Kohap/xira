// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/XIRA.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        XIRA xira = new XIRA();
        console.log("--- XIRA Contract Deployed ---");
        console.log("Address:", address(xira));
        console.log("Owner:", xira.owner());
        console.log("");

        string[15] memory symbols = [
            "NVDAx", "TSLAx", "AAPLx", "MSFTx", "GOOGLx",
            "AMZNx", "METAx", "SPYx", "QQQx", "AMDx",
            "INTCx", "NFLXx", "BAx", "JPMx", "XOMx"
        ];

        address[15] memory tokenAddrs = [
            address(0x1111111111111111111111111111111111111111),
            address(0x2222222222222222222222222222222222222222),
            address(0x3333333333333333333333333333333333333333),
            address(0x4444444444444444444444444444444444444444),
            address(0x5555555555555555555555555555555555555555),
            address(0x6666666666666666666666666666666666666666),
            address(0x7777777777777777777777777777777777777777),
            address(0x8888888888888888888888888888888888888888),
            address(0x9999999999999999999999999999999999999999),
            address(0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa),
            address(0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB),
            address(0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC),
            address(0xDDdDddDdDdddDDddDDddDDDDdDdDDdDDdDDDDDDd),
            address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE),
            address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
        ];

        console.log("--- Registering 15 xStocks ---");
        for (uint256 i = 0; i < symbols.length; i++) {
            xira.registerAsset(tokenAddrs[i], symbols[i]);
            console.log("  Registered:", symbols[i], "at", tokenAddrs[i]);
        }

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
        console.log("XIRA Contract:", address(xira));
        console.log("All 15 assets registered.");
        console.log("Ready for attestation updates.");
        console.log("Explorer: https://www.okx.com/web3/explorer/xlayer-test/address/");
        console.log(address(xira));
        console.log("========================================");
    }
}
