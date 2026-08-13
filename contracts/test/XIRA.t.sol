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
        vm.startPrank(owner);
        xira = new XIRA();
        xira.registerAsset(mockToken, "MOCKx");
        xira.registerAsset(address(0x200), "DUMMYx");
        vm.stopPrank();
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
        xira.registerAsset(address(0x300), "NVDAx");
        string[] memory symbols = xira.getAllTrackedSymbols();
        assertEq(symbols.length, 3);
        assertEq(symbols[2], "NVDAx");
        assertEq(xira.symbolAddresses("NVDAx"), address(0x300));
        assertEq(xira.assetAddresses(address(0x300)), address(0x300));
    }

    function test_RevertWhen_RegisterSameSymbolTwice() public {
        vm.startPrank(owner);
        xira.registerAsset(address(0x300), "NVDAx");
        vm.expectRevert("XIRA: symbol already registered");
        xira.registerAsset(address(0x400), "NVDAx");
        vm.stopPrank();
    }

    function test_RevertWhen_RegisterSameTokenTwice() public {
        vm.prank(owner);
        vm.expectRevert("XIRA: token already registered");
        xira.registerAsset(mockToken, "OTHERx");
    }

    function test_RevertWhen_UpdateUnregisteredAsset() public {
        vm.prank(owner);
        vm.expectRevert("XIRA: asset not registered");
        xira.updateAttestation(address(0x300), 50, 80, bytes32(0), "v1.0.0", false, "");
    }

    function test_RevertWhen_BatchUpdateUnregisteredAsset() public {
        XIRA.AttestationInput[] memory inputs = new XIRA.AttestationInput[](1);
        inputs[0] = XIRA.AttestationInput({
            asset: address(0x300),
            score: 50,
            confidence: 80,
            evidenceHash: bytes32(0),
            modelVersion: "v1.0.0",
            anomaly: false,
            anomalyReason: ""
        });
        vm.prank(owner);
        vm.expectRevert("XIRA: asset not registered");
        xira.batchUpdateAttestations(inputs);
    }

    function test_PauseBlocksWrites() public {
        vm.prank(owner);
        xira.setPaused(true);
        assertTrue(xira.paused());
        vm.prank(owner);
        vm.expectRevert("XIRA: paused");
        xira.updateAttestation(mockToken, 50, 80, bytes32(0), "v1.0.0", false, "");
    }

    function test_PausedBlocksBatch() public {
        XIRA.AttestationInput[] memory inputs = new XIRA.AttestationInput[](1);
        inputs[0] = XIRA.AttestationInput({
            asset: mockToken,
            score: 50,
            confidence: 80,
            evidenceHash: bytes32(0),
            modelVersion: "v1.0.0",
            anomaly: false,
            anomalyReason: ""
        });
        vm.startPrank(owner);
        xira.setPaused(true);
        vm.expectRevert("XIRA: paused");
        xira.batchUpdateAttestations(inputs);
        vm.stopPrank();
    }

    function test_UnpauseResumesWrites() public {
        vm.startPrank(owner);
        xira.setPaused(true);
        vm.expectRevert("XIRA: paused");
        xira.updateAttestation(mockToken, 50, 80, bytes32(0), "v1.0.0", false, "");
        xira.setPaused(false);
        xira.updateAttestation(mockToken, 50, 80, bytes32(0), "v1.0.0", false, "");
        vm.stopPrank();
        assertEq(xira.getScore(mockToken), 50);
    }

    function test_RevertWhen_StrangerPauses() public {
        vm.prank(stranger);
        vm.expectRevert("XIRA: caller is not owner");
        xira.setPaused(true);
    }

    function test_MinIntervalEnforced() public {
        vm.startPrank(owner);
        xira.setAuthorizedUpdater(updater, true);
        xira.setMinAttestationInterval(60);
        vm.stopPrank();

        vm.prank(updater);
        xira.updateAttestation(mockToken, 40, 80, bytes32(0), "v1.0.0", false, "");

        vm.prank(updater);
        vm.expectRevert("XIRA: attestation too soon");
        xira.updateAttestation(mockToken, 41, 80, bytes32(0), "v1.0.0", false, "");

        vm.warp(block.timestamp + 61);
        vm.prank(updater);
        xira.updateAttestation(mockToken, 41, 80, bytes32(0), "v1.0.0", false, "");
        assertEq(xira.getScore(mockToken), 41);
    }

    function test_RevertWhen_StrangerSetsInterval() public {
        vm.prank(stranger);
        vm.expectRevert("XIRA: caller is not owner");
        xira.setMinAttestationInterval(60);
    }

    function test_GetAllTrackedAssetsWithScores() public {
        vm.startPrank(owner);
        xira.registerAsset(address(0x300), "NVDAx");
        xira.registerAsset(address(0x400), "TSLAx");
        xira.updateAttestation(address(0x300), 30, 80, bytes32(0), "v1.0.0", false, "");
        xira.updateAttestation(address(0x400), 70, 75, bytes32(0), "v1.0.0", false, "");
        vm.stopPrank();

        (
            address[] memory assets,
            string[] memory symbols,
            uint8[] memory scores,
            uint64[] memory timestamps
        ) = xira.getAllTrackedAssetsWithScores();

        assertEq(assets.length, 4);
        assertEq(symbols[0], "MOCKx");
        assertEq(assets[0], mockToken);
        assertEq(scores[0], 0, "no attestation yet -> 0");
        assertEq(symbols[2], "NVDAx");
        assertEq(assets[2], address(0x300));
        assertEq(scores[2], 30);
        assertEq(timestamps[2] > 0, true);
        assertEq(symbols[3], "TSLAx");
        assertEq(assets[3], address(0x400));
        assertEq(scores[3], 70);
    }
}
