// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract XIRA {
    struct Attestation {
        uint8 score;
        uint8 confidence;
        bytes32 evidenceHash;
        uint64 timestamp;
        string modelVersion;
        bool anomaly;
        string anomalyReason;
    }

    address public owner;
    mapping(address => bool) public authorizedUpdaters;
    mapping(address => Attestation) public latestAttestation;
    mapping(address => address) public assetAddresses;
    string[] public trackedSymbols;

    event AttestationUpdated(
        address indexed asset,
        uint8 score,
        uint8 confidence,
        bool anomaly,
        uint64 timestamp
    );
    event UpdaterAuthorized(address indexed updater, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AssetRegistered(address indexed tokenAddr, string symbol);

    modifier onlyOwner() {
        require(msg.sender == owner, "XIRA: caller is not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedUpdaters[msg.sender],
            "XIRA: caller is not authorized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "XIRA: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized);
    }

    function registerAsset(address tokenAddr, string calldata symbol) external onlyOwner {
        require(tokenAddr != address(0), "XIRA: zero address");
        require(!isSymbolTracked(symbol), "XIRA: symbol already registered");
        assetAddresses[tokenAddr] = tokenAddr;
        trackedSymbols.push(symbol);
        emit AssetRegistered(tokenAddr, symbol);
    }

    function updateAttestation(
        address asset,
        uint8 score,
        uint8 confidence,
        bytes32 evidenceHash,
        string calldata modelVersion,
        bool anomaly,
        string calldata anomalyReason
    ) external onlyAuthorized {
        require(asset != address(0), "XIRA: zero address");
        require(score <= 100, "XIRA: score > 100");
        require(confidence <= 100, "XIRA: confidence > 100");

        latestAttestation[asset] = Attestation({
            score: score,
            confidence: confidence,
            evidenceHash: evidenceHash,
            timestamp: uint64(block.timestamp),
            modelVersion: modelVersion,
            anomaly: anomaly,
            anomalyReason: anomalyReason
        });

        emit AttestationUpdated(asset, score, confidence, anomaly, uint64(block.timestamp));
    }

    function getLatestAttestation(address asset)
        external
        view
        returns (
            uint8 score,
            uint8 confidence,
            bytes32 evidenceHash,
            uint64 timestamp,
            string memory modelVersion,
            bool anomaly,
            string memory anomalyReason
        )
    {
        Attestation storage a = latestAttestation[asset];
        return (a.score, a.confidence, a.evidenceHash, a.timestamp, a.modelVersion, a.anomaly, a.anomalyReason);
    }

    function getScore(address asset) external view returns (uint8 score) {
        return latestAttestation[asset].score;
    }

    function getScoreBatch(address[] calldata assets)
        external
        view
        returns (uint8[] memory scores)
    {
        uint256 len = assets.length;
        scores = new uint8[](len);
        for (uint256 i = 0; i < len; i++) {
            scores[i] = latestAttestation[assets[i]].score;
        }
        return scores;
    }

    function getAllTrackedSymbols() external view returns (string[] memory) {
        return trackedSymbols;
    }

    function isSymbolTracked(string memory symbol) internal view returns (bool) {
        for (uint256 i = 0; i < trackedSymbols.length; i++) {
            if (keccak256(abi.encodePacked(trackedSymbols[i])) == keccak256(abi.encodePacked(symbol))) {
                return true;
            }
        }
        return false;
    }
}
