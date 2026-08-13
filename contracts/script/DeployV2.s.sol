// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/XIRA.sol";

contract DeployV2 is Script {
    struct Asset {
        address token;
        string symbol;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        XIRA xira = new XIRA();
        console.log("--- XIRA V2 Contract Deployed ---");
        console.log("Address:", address(xira));
        console.log("Owner:", xira.owner());
        console.log("");

        Asset[15] memory assets = [
            Asset(address(0xc845b2894dBddd03858fd2D643B4eF725fE0849d), "NVDAx"),
            Asset(address(0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0), "TSLAx"),
            Asset(address(0x9d275685dC284C8eB1C79f6ABA7a63Dc75ec890a), "AAPLx"),
            Asset(address(0x5621737f42dAE558b81269FcB9E9E70c19Aa6b35), "MSFTx"),
            Asset(address(0xe92f673Ca36C5E2Efd2DE7628f815f84807e803F), "GOOGLx"),
            Asset(address(0x3557Ba345B01EFa20A1bdDC61F573BFD87195081), "AMZNx"),
            Asset(address(0x96702be57Cd9777f835117a809C7124fe4ec989A), "METAx"),
            Asset(address(0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48), "SPYx"),
            Asset(address(0xa753A7395cAe905Cd615Da0B82A53E0560f250af), "QQQx"),
            Asset(address(0x3522513E5F146a2006e2901b05f16B2821485E19), "AMDx"),
            Asset(address(0xf8A80D1cb9cFD70D03D655D9dF42339846F3B3C8), "INTCx"),
            Asset(address(0xA6a65AC27E76cD53cB790473E4345c46e5eBf961), "NFLXx"),
            Asset(address(0xDDdDddDdDdddDDddDDddDDDDdDdDDdDDdDDDDDDd), "BAx"),
            Asset(address(0xD9FC3E075d45254a1D834fEa18AF8041207DeA0A), "JPMx"),
            Asset(address(0xEEdb0273c5Af792745180e9fF568cD01550fFA13), "XOMx")
        ];

        console.log("--- Registering 15 xStocks with real EVM addresses ---");
        for (uint256 i = 0; i < assets.length; i++) {
            xira.registerAsset(assets[i].token, assets[i].symbol);
            console.log("  Registered:", assets[i].symbol);
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
        console.log("XIRA V2 Contract:", address(xira));
        console.log("History ring buffer + batch updates + pause + write cooldown live.");
        console.log("Explorer: https://www.okx.com/web3/explorer/xlayer-test/address/");
        console.log(address(xira));
        console.log("========================================");
    }
}
