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
            "RegisterContent(bytes32 pHash,address creator,bytes32 metadataURIHash,bytes32 allowedHostsHash,uint256 nonce,uint256 deadline)"
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
        string[] memory allowedHosts,
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
        bytes32 digest = _buildDigest(pHash, creator, metadataURI, allowedHosts, nonce, deadline);
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

        for (uint256 i = 0; i < allowedHosts.length; i++) {
            string memory normalizedHost = _normalizeHost(allowedHosts[i]);
            domainWhitelist[pHash][normalizedHost] = true;
            emit WhitelistAdded(pHash, normalizedHost);
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

        string memory normalizedHost = _normalizeHost(domain);

        domainWhitelist[pHash][normalizedHost] = allowed;
        emit WhitelistUpdated(pHash, normalizedHost, allowed);
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

        string memory normalizedHost = _normalizeHost(domain);
        return domainWhitelist[pHash][normalizedHost];
    }

    function _buildDigest(
        bytes32 pHash,
        address creator,
        string memory metadataURI,
        string[] memory allowedHosts,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_CONTENT_TYPEHASH,
                pHash,
                creator,
                keccak256(bytes(metadataURI)),
                _hashAllowedHosts(allowedHosts),
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

    function _hashAllowedHosts(string[] memory allowedHosts) private pure returns (bytes32) {
        bytes32[] memory hostHashes = new bytes32[](allowedHosts.length);
        for (uint256 i = 0; i < allowedHosts.length; i++) {
            string memory normalizedHost = _normalizeHost(allowedHosts[i]);
            hostHashes[i] = keccak256(bytes(normalizedHost));
        }
        return keccak256(abi.encodePacked(hostHashes));
    }

    function _normalizeHost(string memory domain) private pure returns (string memory) {
        bytes memory raw = bytes(domain);
        uint256 start = 0;
        uint256 end = raw.length;

        while (start < end && _isWhitespace(raw[start])) {
            start++;
        }
        while (end > start && _isWhitespace(raw[end - 1])) {
            end--;
        }

        if (end == start) {
            revert OriginalContent__ShouldNotBeEmptyDomain();
        }

        bytes memory normalized = new bytes(end - start);
        for (uint256 i = 0; i < normalized.length; i++) {
            bytes1 ch = raw[start + i];
            if (ch >= 0x41 && ch <= 0x5A) {
                ch = bytes1(uint8(ch) + 32);
            }

            bool isLower = ch >= 0x61 && ch <= 0x7A;
            bool isDigit = ch >= 0x30 && ch <= 0x39;
            bool isDot = ch == 0x2E;
            bool isHyphen = ch == 0x2D;
            if (!(isLower || isDigit || isDot || isHyphen)) {
                revert OriginalContent__InvalidDomainFormat();
            }
            normalized[i] = ch;
        }

        if (normalized[0] == 0x2E || normalized[normalized.length - 1] == 0x2E) {
            revert OriginalContent__InvalidDomainFormat();
        }

        uint256 labelLength = 0;
        for (uint256 i = 0; i < normalized.length; i++) {
            bytes1 ch = normalized[i];
            if (ch == 0x2E) {
                if (labelLength == 0 || normalized[i - 1] == 0x2D) {
                    revert OriginalContent__InvalidDomainFormat();
                }
                labelLength = 0;
                continue;
            }

            if (labelLength == 0 && ch == 0x2D) {
                revert OriginalContent__InvalidDomainFormat();
            }

            labelLength++;
            if (labelLength > 63) {
                revert OriginalContent__InvalidDomainFormat();
            }
        }

        if (normalized[normalized.length - 1] == 0x2D) {
            revert OriginalContent__InvalidDomainFormat();
        }

        return string(normalized);
    }

    function _isWhitespace(bytes1 ch) private pure returns (bool) {
        return ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D;
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
