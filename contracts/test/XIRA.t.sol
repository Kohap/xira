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

    event AttestationUpdated(
        address indexed asset,
        uint8 score,
        uint8 confidence,
        bytes32 evidenceHash,
        uint64 timestamp,
        bool anomaly,
        string modelVersion
    );

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

        uint256 count = xira.historyCount(mockToken);
        assertEq(count, 1, "history count increments");
        XIRA.Attestation[] memory hist = xira.getHistory(mockToken);
        assertEq(hist.length, 1);
        assertEq(hist[0].score, 65);
    }

    function test_UpdateEmitsEventWithEvidenceHash() public {
        vm.prank(owner);
        xira.setAuthorizedUpdater(updater, true);

        bytes32 hash = bytes32(uint256(0xDEADBEEF));
        vm.expectEmit(true, false, false, true, address(xira));
        emit AttestationUpdated(
            mockToken, 65, 80, hash, uint64(block.timestamp), false, "v1.0.0"
        );

        vm.prank(updater);
        xira.updateAttestation(mockToken, 65, 80, hash, "v1.0.0", false, "");
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

    function test_RevertWhen_UpdateToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("XIRA: zero address");
        xira.updateAttestation(address(0), 50, 80, bytes32(0), "v1.0.0", false, "");
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

    function _update(address asset, uint8 score) internal {
        vm.prank(owner);
        xira.updateAttestation(asset, score, 80, bytes32(uint256(score)), "v1.0.0", false, "");
    }

    function test_HistoryKeepsOrder() public {
        vm.prank(owner);
        xira.setAuthorizedUpdater(updater, true);
        vm.startPrank(updater);
        for (uint8 i = 0; i < 3; i++) {
            xira.updateAttestation(mockToken, 10 + i, 80, bytes32(0), "v1.0.0", false, "");
        }
        vm.stopPrank();

        XIRA.Attestation[] memory hist = xira.getHistory(mockToken);
        assertEq(hist.length, 3, "three entries kept");
        assertEq(hist[0].score, 10);
        assertEq(hist[1].score, 11);
        assertEq(hist[2].score, 12, "newest last");
    }

    function test_HistoryCapsAtTwenty() public {
        for (uint256 i = 1; i <= 25; i++) {
            _update(mockToken, uint8(i));
        }
        XIRA.Attestation[] memory hist = xira.getHistory(mockToken);
        assertEq(hist.length, 20, "capped at 20");
        assertEq(hist[0].score, 6, "oldest retained entry");
        assertEq(hist[19].score, 25, "newest entry last");
        assertEq(xira.historyCount(mockToken), 25);
    }

    function testFuzz_HistoryOrder(uint256 updates) public {
        updates = bound(updates, 1, 200);
        for (uint256 i = 0; i < updates; i++) {
            _update(mockToken, uint8(i % 100));
        }
        XIRA.Attestation[] memory hist = xira.getHistory(mockToken);
        uint256 expectedLen = updates < 20 ? updates : 20;
        assertEq(hist.length, expectedLen, "length is min(updates, 20)");
        assertEq(hist[expectedLen - 1].score, uint8((updates - 1) % 100), "newest last");
        for (uint256 i = 1; i < expectedLen; i++) {
            assertEq(
                hist[i].score,
                (hist[i - 1].score + 1) % 100,
                "entries remain contiguous and ordered"
            );
        }
    }

    function testFuzz_ScoreStored(uint8 score) public {
        vm.assume(score <= 100);
        _update(mockToken, score);
        assertEq(xira.getScore(mockToken), score);
    }

    function test_BatchUpdateAttestations() public {
        XIRA.AttestationInput[] memory inputs = new XIRA.AttestationInput[](2);
        inputs[0] = XIRA.AttestationInput({
            asset: address(0x100),
            score: 30,
            confidence: 85,
            evidenceHash: bytes32(uint256(1)),
            modelVersion: "v1.0.0",
            anomaly: false,
            anomalyReason: ""
        });
        inputs[1] = XIRA.AttestationInput({
            asset: address(0x200),
            score: 70,
            confidence: 75,
            evidenceHash: bytes32(uint256(2)),
            modelVersion: "v1.0.0",
            anomaly: true,
            anomalyReason: "volume spike"
        });

        vm.prank(owner);
        xira.batchUpdateAttestations(inputs);

        assertEq(xira.getScore(address(0x100)), 30);
        assertEq(xira.getScore(address(0x200)), 70);
        (
            uint8 score,
            ,
            ,
            ,
            ,
            bool anomaly,
            string memory reason
        ) = xira.getLatestAttestation(address(0x200));
        assertEq(score, 70);
        assertTrue(anomaly);
        assertEq(reason, "volume spike");
    }

    function test_RevertWhen_UnauthorizedBatchUpdate() public {
        XIRA.AttestationInput[] memory inputs = new XIRA.AttestationInput[](1);
        inputs[0] = XIRA.AttestationInput({
            asset: address(0x100),
            score: 30,
            confidence: 80,
            evidenceHash: bytes32(0),
            modelVersion: "v1.0.0",
            anomaly: false,
            anomalyReason: ""
        });

        vm.prank(stranger);
        vm.expectRevert("XIRA: caller is not authorized");
        xira.batchUpdateAttestations(inputs);
    }

    function test_RevertWhen_BatchUpdateToZeroAddress() public {
        XIRA.AttestationInput[] memory inputs = new XIRA.AttestationInput[](1);
        inputs[0] = XIRA.AttestationInput({
            asset: address(0),
            score: 30,
            confidence: 80,
            evidenceHash: bytes32(0),
            modelVersion: "v1.0.0",
            anomaly: false,
            anomalyReason: ""
        });

        vm.prank(owner);
        vm.expectRevert("XIRA: zero address");
        xira.batchUpdateAttestations(inputs);
    }

    function test_RegisterAsset() public {
        vm.prank(owner);
        xira.registerAsset(mockToken, "NVDAx");
        string[] memory symbols = xira.getAllTrackedSymbols();
        assertEq(symbols.length, 1);
        assertEq(symbols[0], "NVDAx");
        assertEq(xira.symbolAddresses("NVDAx"), mockToken);
    }

    function test_RevertWhen_RegisterSameSymbolTwice() public {
        vm.startPrank(owner);
        xira.registerAsset(mockToken, "NVDAx");
        vm.expectRevert("XIRA: symbol already registered");
        xira.registerAsset(address(0x200), "NVDAx");
        vm.stopPrank();
    }

    function test_GetAllTrackedAssetsWithScores() public {
        vm.startPrank(owner);
        xira.registerAsset(address(0x100), "NVDAx");
        xira.registerAsset(address(0x200), "TSLAx");
        xira.updateAttestation(address(0x100), 30, 80, bytes32(0), "v1.0.0", false, "");
        xira.updateAttestation(address(0x200), 70, 75, bytes32(0), "v1.0.0", false, "");
        vm.stopPrank();

        (
            address[] memory assets,
            string[] memory symbols,
            uint8[] memory scores,
            uint64[] memory timestamps
        ) = xira.getAllTrackedAssetsWithScores();

        assertEq(assets.length, 2);
        assertEq(symbols[0], "NVDAx");
        assertEq(assets[0], address(0x100));
        assertEq(scores[0], 30);
        assertEq(timestamps[0] > 0, true);
        assertEq(symbols[1], "TSLAx");
        assertEq(assets[1], address(0x200));
        assertEq(scores[1], 70);
    }
}
