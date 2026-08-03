// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IOriginalContent} from "./IOriginalContent.sol";

contract OriginalContent is IOriginalContent {
    uint256 private constant SECP256K1N_DIV_2 =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant REGISTER_CONTENT_TYPEHASH =
        keccak256(
            "RegisterContent(bytes32 pHash,address creator,bytes32 metadataURIHash,bytes32 allowedDomainsHash,uint256 nonce,uint256 deadline)"
        );
    bytes32 private constant NAME_HASH = keccak256(bytes("OriginalContent"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));

    mapping(bytes32 pHash => ContentRecord) public records;
    mapping(bytes32 pHash => mapping (string domain => bool isAllowed)) public domainWhitelist;
    mapping(address creator => uint256 nonce) public nonces;

    function registerContent(
        bytes32 pHash,
        address creator,
        string memory metadataURI,
        string[] memory allowedDomains,
        uint256 deadline,
        bytes memory signature
    ) external {
        if (pHash == bytes32(0)) {
            revert OriginalContent__InvalidZeroPHash();
        }

        if (creator == address(0)) {
            revert OriginalContent__InvalidCreator();
        }

        if (records[pHash].creator != address(0)) {
            revert OriginalContent__ContentAlreadyRegistered();
        }

        if (block.timestamp > deadline) {
            revert OriginalContent__SignatureExpired();
        }

        uint256 nonce = nonces[creator];
        bytes32 digest = _buildDigest(pHash, creator, metadataURI, allowedDomains, nonce, deadline);
        address recoveredSigner = _recoverSigner(digest, signature);
        if (recoveredSigner != creator) {
            revert OriginalContent__InvalidSignature();
        }
        nonces[creator] = nonce + 1;

        
        records[pHash] = ContentRecord({
            creator: creator,
            pHash: pHash,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            isActive: true
        });

        for (uint256 i = 0; i < allowedDomains.length; i++) {
            _validateDomain(allowedDomains[i]);
            domainWhitelist[pHash][allowedDomains[i]] = true;
            emit WhitelistAdded(pHash, allowedDomains[i]);
        }

        emit ContentRegistered(pHash, creator, metadataURI, block.timestamp);
    }

    function updateWhitelist(
        bytes32 pHash,
        string memory domain,
        bool allowed
    ) external {
        if (records[pHash].creator == address(0)) {
            revert OriginalContent__ContentNotRegistered();
        }

        if (records[pHash].creator != msg.sender) {
            revert OriginalContent__NotContentCreator();
        }

        if (bytes(domain).length == 0) {
            revert OriginalContent__ShouldNotBeEmptyDomain();
        }
        _validateLowercase(domain);

        domainWhitelist[pHash][domain] = allowed;
        emit WhitelistUpdated(pHash, domain, allowed);
    }

    function getContent(bytes32 pHash) external view returns (ContentRecord memory) {
        if (records[pHash].creator == address(0)) {
            revert OriginalContent__ContentNotExists();
        }

        return records[pHash];
    }

    function isDomainWhitelisted(bytes32 pHash, string memory domain) external view returns (bool) {
        if (records[pHash].creator == address(0)) {
            revert OriginalContent__ContentNotExists();
        }

        return domainWhitelist[pHash][domain];
    }

    function _buildDigest(
        bytes32 pHash,
        address creator,
        string memory metadataURI,
        string[] memory allowedDomains,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_CONTENT_TYPEHASH,
                pHash,
                creator,
                keccak256(bytes(metadataURI)),
                _hashAllowedDomains(allowedDomains),
                nonce,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _domainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this))
        );
    }

    function _hashAllowedDomains(string[] memory allowedDomains) private pure returns (bytes32) {
        bytes32[] memory domainHashes = new bytes32[](allowedDomains.length);
        for (uint256 i = 0; i < allowedDomains.length; i++) {
            domainHashes[i] = keccak256(bytes(allowedDomains[i]));
        }
        return keccak256(abi.encodePacked(domainHashes));
    }

    function _validateDomain(string memory domain) private pure {
        if (bytes(domain).length == 0) {
            revert OriginalContent__ShouldNotBeEmptyDomain();
        }
        _validateLowercase(domain);
    }

    function _validateLowercase(string memory domain) private pure {
        bytes memory domainBytes = bytes(domain);
        for (uint256 i = 0; i < domainBytes.length; i++) {
            bytes1 ch = domainBytes[i];
            if (ch >= 0x41 && ch <= 0x5A) {
                revert OriginalContent__DomainMustBeLowercase();
            }
        }
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) private pure returns (address) {
        if (signature.length != 65) {
            revert OriginalContent__InvalidSignature();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            revert OriginalContent__InvalidSignature();
        }
        if (uint256(s) > SECP256K1N_DIV_2) {
            revert OriginalContent__InvalidSignature();
        }

        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) {
            revert OriginalContent__InvalidSignature();
        }
        return signer;
    }


}
