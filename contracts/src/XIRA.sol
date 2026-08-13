// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

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

    struct AttestationInput {
        address asset;
        uint8 score;
        uint8 confidence;
        bytes32 evidenceHash;
        string modelVersion;
        bool anomaly;
        string anomalyReason;
    }

    uint256 private constant MAX_HISTORY = 20;

    address public owner;
    bool public paused;
    /// Minimum seconds between attestations per asset (0 = disabled).
    uint256 public minAttestationInterval;
    mapping(address => bool) public authorizedUpdaters;
    mapping(address => Attestation) public latestAttestation;
    mapping(address => address) public assetAddresses;
    mapping(string => address) public symbolAddresses;
    mapping(address => Attestation[MAX_HISTORY]) internal historyRing;
    mapping(address => uint256) public historyCount;
    string[] public trackedSymbols;

    event AttestationUpdated(
        address indexed asset,
        uint8 score,
        uint8 confidence,
        bytes32 evidenceHash,
        uint64 timestamp,
        bool anomaly,
        string modelVersion
    );
    event UpdaterAuthorized(address indexed updater, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AssetRegistered(address indexed tokenAddr, string symbol);
    event AssetUnregistered(address indexed tokenAddr, string symbol);
    event Paused(address indexed account, bool state);

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

    modifier whenNotPaused() {
        require(!paused, "XIRA: paused");
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

    /// Emergency stop for all attestation writes. Readers stay open.
    function setPaused(bool state) external onlyOwner {
        paused = state;
        emit Paused(msg.sender, state);
    }

    /// Per-asset cooldown between attestations, so a compromised hot key
    /// cannot spam writes or burn the oracle's gas budget.
    function setMinAttestationInterval(uint256 intervalSeconds) external onlyOwner {
        minAttestationInterval = intervalSeconds;
    }

    function registerAsset(address tokenAddr, string calldata symbol) external onlyOwner {
        require(tokenAddr != address(0), "XIRA: zero address");
        require(assetAddresses[tokenAddr] == address(0), "XIRA: token already registered");
        require(!isSymbolTracked(symbol), "XIRA: symbol already registered");
        assetAddresses[tokenAddr] = tokenAddr;
        symbolAddresses[symbol] = tokenAddr;
        trackedSymbols.push(symbol);
        emit AssetRegistered(tokenAddr, symbol);
    }

    /// Lifecycle management: remove an asset from the registry. Historical
    /// attestations stay readable; new writes for the token revert.
    function unregisterAsset(string calldata symbol) external onlyOwner {
        address token = symbolAddresses[symbol];
        require(token != address(0), "XIRA: symbol not registered");
        delete symbolAddresses[symbol];
        delete assetAddresses[token];
        for (uint256 i = 0; i < trackedSymbols.length; i++) {
            if (keccak256(abi.encodePacked(trackedSymbols[i])) == keccak256(abi.encodePacked(symbol))) {
                trackedSymbols[i] = trackedSymbols[trackedSymbols.length - 1];
                trackedSymbols.pop();
                break;
            }
        }
        emit AssetUnregistered(token, symbol);
    }

    function updateAttestation(
        address asset,
        uint8 score,
        uint8 confidence,
        bytes32 evidenceHash,
        string calldata modelVersion,
        bool anomaly,
        string calldata anomalyReason
    ) external onlyAuthorized whenNotPaused {
        _writeAttestation(asset, score, confidence, evidenceHash, modelVersion, anomaly, anomalyReason);
    }

    function _writeAttestation(
        address asset,
        uint8 score,
        uint8 confidence,
        bytes32 evidenceHash,
        string memory modelVersion,
        bool anomaly,
        string memory anomalyReason
    ) internal {
        require(asset != address(0), "XIRA: zero address");
        require(assetAddresses[asset] == asset, "XIRA: asset not registered");
        require(score <= 100, "XIRA: score > 100");
        require(confidence <= 100, "XIRA: confidence > 100");

        uint64 ts = uint64(block.timestamp);
        if (minAttestationInterval > 0 && latestAttestation[asset].timestamp != 0) {
            require(
                ts - latestAttestation[asset].timestamp >= minAttestationInterval,
                "XIRA: attestation too soon"
            );
        }

        Attestation memory a = Attestation({
            score: score,
            confidence: confidence,
            evidenceHash: evidenceHash,
            timestamp: ts,
            modelVersion: modelVersion,
            anomaly: anomaly,
            anomalyReason: anomalyReason
        });

        latestAttestation[asset] = a;
        _pushHistory(asset, a);

        emit AttestationUpdated(asset, score, confidence, evidenceHash, a.timestamp, anomaly, modelVersion);
    }

    function batchUpdateAttestations(AttestationInput[] calldata inputs)
        external
        onlyAuthorized
        whenNotPaused
    {
        uint256 n = inputs.length;
        for (uint256 i = 0; i < n; i++) {
            _writeAttestation(
                inputs[i].asset,
                inputs[i].score,
                inputs[i].confidence,
                inputs[i].evidenceHash,
                inputs[i].modelVersion,
                inputs[i].anomaly,
                inputs[i].anomalyReason
            );
        }
    }

    function _pushHistory(address asset, Attestation memory a) internal {
        historyRing[asset][historyCount[asset] % MAX_HISTORY] = a;
        historyCount[asset]++;
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

    function getHistory(address asset) external view returns (Attestation[] memory) {
        uint256 count = historyCount[asset];
        uint256 n = count > MAX_HISTORY ? MAX_HISTORY : count;
        Attestation[] memory out = new Attestation[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = historyRing[asset][(count - n + i) % MAX_HISTORY];
        }
        return out;
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

    function getAllTrackedAssetsWithScores()
        external
        view
        returns (
            address[] memory assets,
            string[] memory symbols,
            uint8[] memory scores,
            uint64[] memory timestamps
        )
    {
        uint256 n = trackedSymbols.length;
        assets = new address[](n);
        symbols = new string[](n);
        scores = new uint8[](n);
        timestamps = new uint64[](n);
        for (uint256 i = 0; i < n; i++) {
            address asset = symbolAddresses[trackedSymbols[i]];
            Attestation storage a = latestAttestation[asset];
            assets[i] = asset;
            symbols[i] = trackedSymbols[i];
            scores[i] = a.score;
            timestamps[i] = a.timestamp;
        }
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
