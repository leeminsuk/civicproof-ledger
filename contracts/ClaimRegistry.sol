// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

contract ClaimRegistry {
    enum ClaimStatus {
        None,
        Registered
    }

    struct Claim {
        bytes32 commitmentHash;
        string metadataUri;
        uint256 registeredAt;
    }

    mapping(bytes32 => mapping(bytes32 => Claim)) private claims;
    mapping(bytes32 => uint256) public programClaimCounts;
    mapping(address => bool) private authorizedIssuers;

    address public owner;
    uint256 public duplicateAttempts;
    uint256 public totalClaims;

    error UnauthorizedIssuer(address issuer);
    error OwnableUnauthorizedAccount(address account);
    error InvalidInput();

    event ClaimRegistered(
        bytes32 indexed programId,
        bytes32 indexed nullifierHash,
        bytes32 commitmentHash,
        string metadataUri
    );

    event DuplicateDetected(
        bytes32 indexed programId,
        bytes32 indexed nullifierHash,
        bytes32 commitmentHash,
        string metadataUri
    );

    event IssuerAuthorizationUpdated(address indexed issuer, bool authorized);

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAuthorizationUpdated(msg.sender, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    modifier onlyAuthorizedIssuer() {
        if (!authorizedIssuers[msg.sender]) {
            revert UnauthorizedIssuer(msg.sender);
        }
        _;
    }

    function authorizeIssuer(address issuer, bool authorized) external onlyOwner {
        if (issuer == address(0)) {
            revert InvalidInput();
        }
        authorizedIssuers[issuer] = authorized;
        emit IssuerAuthorizationUpdated(issuer, authorized);
    }

    function isAuthorizedIssuer(address issuer) external view returns (bool) {
        return authorizedIssuers[issuer];
    }

    function registerClaim(
        bytes32 programId,
        bytes32 nullifierHash,
        bytes32 commitmentHash,
        string calldata metadataUri
    ) external onlyAuthorizedIssuer returns (bool accepted) {
        if (
            programId == bytes32(0) ||
            nullifierHash == bytes32(0) ||
            commitmentHash == bytes32(0) ||
            bytes(metadataUri).length == 0
        ) {
            revert InvalidInput();
        }

        Claim storage existing = claims[programId][nullifierHash];

        if (existing.registeredAt != 0) {
            duplicateAttempts += 1;
            emit DuplicateDetected(programId, nullifierHash, commitmentHash, metadataUri);
            return false;
        }

        claims[programId][nullifierHash] = Claim({
            commitmentHash: commitmentHash,
            metadataUri: metadataUri,
            registeredAt: block.timestamp
        });
        programClaimCounts[programId] += 1;
        totalClaims += 1;

        emit ClaimRegistered(programId, nullifierHash, commitmentHash, metadataUri);
        return true;
    }

    function claimStatus(bytes32 programId, bytes32 nullifierHash) external view returns (ClaimStatus) {
        return claims[programId][nullifierHash].registeredAt == 0 ? ClaimStatus.None : ClaimStatus.Registered;
    }

    function getClaim(bytes32 programId, bytes32 nullifierHash) external view returns (Claim memory) {
        return claims[programId][nullifierHash];
    }
}
