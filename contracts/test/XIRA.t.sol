// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {XIRA} from "../src/XIRA.sol";

contract XIRATest is Test {
    XIRA public xira;
    address public owner = address(1);
    address public updater = address(2);
    address public stranger = address(3);
    address public mockToken = address(0x100);

    function setUp() public {
        vm.prank(owner);
        xira = new XIRA();
    }

    function test_Constructor() public view {
        assertEq(xira.owner(), owner);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        xira.transferOwnership(address(4));
        assertEq(xira.owner(), address(4));
    }

    function test_RevertWhen_StrangerTransfersOwnership() public {
        vm.prank(stranger);
        vm.expectRevert("XIRA: caller is not owner");
        xira.transferOwnership(address(4));
    }

    function test_AuthorizeUpdater() public {
        vm.prank(owner);
        xira.setAuthorizedUpdater(updater, true);
        assertTrue(xira.authorizedUpdaters(updater));
    }

    function test_UpdateAttestation() public {
        vm.prank(owner);
        xira.setAuthorizedUpdater(updater, true);

        vm.prank(updater);
        xira.updateAttestation(
            mockToken,
            65,
            80,
            bytes32(uint256(0xABCD)),
            "v1.0.0",
            false,
            ""
        );

        (
            uint8 score,
            uint8 confidence,
            bytes32 evidenceHash,
            uint64 timestamp,
            string memory modelVersion,
            bool anomaly,
            string memory anomalyReason
        ) = xira.getLatestAttestation(mockToken);

        assertEq(score, 65);
        assertEq(confidence, 80);
        assertEq(evidenceHash, bytes32(uint256(0xABCD)));
        assertTrue(timestamp > 0);
        assertEq(modelVersion, "v1.0.0");
        assertFalse(anomaly);
        assertEq(anomalyReason, "");
    }

    function test_GetScore() public {
        vm.prank(owner);
        xira.updateAttestation(mockToken, 42, 90, bytes32(0), "v1.0.0", false, "");
        assertEq(xira.getScore(mockToken), 42);
    }

    function test_RevertWhen_ScoreExceedsMax() public {
        vm.prank(owner);
        vm.expectRevert("XIRA: score > 100");
        xira.updateAttestation(mockToken, 101, 90, bytes32(0), "v1.0.0", false, "");
    }

    function test_RevertWhen_ConfidenceExceedsMax() public {
        vm.prank(owner);
        vm.expectRevert("XIRA: confidence > 100");
        xira.updateAttestation(mockToken, 50, 101, bytes32(0), "v1.0.0", false, "");
    }

    function test_GetScoreBatch() public {
        vm.startPrank(owner);
        xira.updateAttestation(address(0x100), 30, 85, bytes32(0), "v1.0.0", false, "");
        xira.updateAttestation(address(0x200), 70, 75, bytes32(0), "v1.0.0", false, "");
        vm.stopPrank();

        address[] memory assets = new address[](2);
        assets[0] = address(0x100);
        assets[1] = address(0x200);

        uint8[] memory scores = xira.getScoreBatch(assets);
        assertEq(scores[0], 30);
        assertEq(scores[1], 70);
    }

    function test_RevertWhen_UnauthorizedUpdate() public {
        vm.prank(stranger);
        vm.expectRevert("XIRA: caller is not authorized");
        xira.updateAttestation(mockToken, 50, 80, bytes32(0), "v1.0.0", false, "");
    }

    function test_RegisterAsset() public {
        vm.prank(owner);
        xira.registerAsset(mockToken, "NVDAx");
        string[] memory symbols = xira.getAllTrackedSymbols();
        assertEq(symbols.length, 1);
        assertEq(symbols[0], "NVDAx");
    }
}
