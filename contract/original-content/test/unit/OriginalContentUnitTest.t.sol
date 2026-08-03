// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {IOriginalContent} from "../../src/IOriginalContent.sol";
import {OriginalContent} from "../../src/OriginalContent.sol";
import {DeployOriginalContent} from "../../script/DeployOriginalContent.s.sol";

contract OriginalContentUnitTest is Test {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant REGISTER_CONTENT_TYPEHASH =
        keccak256(
            "RegisterContent(bytes32 pHash,address creator,bytes32 metadataURIHash,bytes32 allowedHostsHash,uint256 nonce,uint256 deadline)"
        );
    bytes32 private constant NAME_HASH = keccak256(bytes("OriginalContent"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));

    OriginalContent originalContent;
    string s_sampleMetadataURI;
    string[] s_sampleAllowedHosts;
    address s_creator;
    uint256 s_creatorKey;

    function setUp() public {
        DeployOriginalContent deployer = new DeployOriginalContent();
        originalContent = deployer.run();

        (s_creator, s_creatorKey) = makeAddrAndKey("creator");
        s_sampleMetadataURI = "ipfs://sample-metadata";
        s_sampleAllowedHosts.push("sampledomain1.com");
    }

    function testIfPHashIsZero() public {
        vm.expectRevert(IOriginalContent.OriginalContent__InvalidZeroPHash.selector);
        originalContent.registerContent(bytes32(0), s_creator, s_sampleMetadataURI, s_sampleAllowedHosts, 0, "");
    }

    function testIfContentIsAlreadyRegistered() public {
        bytes32 pHash = keccak256("testText");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.expectRevert(IOriginalContent.OriginalContent__ContentAlreadyRegistered.selector);
        originalContent.registerContent(pHash, s_creator, s_sampleMetadataURI, s_sampleAllowedHosts, 0, "");
    }

    function testEmitsContentRegisteredEvent() public {
        bytes32 pHash = keccak256("testText");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _signRegisterPayload(
            s_creatorKey,
            pHash,
            s_creator,
            s_sampleMetadataURI,
            s_sampleAllowedHosts,
            originalContent.nonces(s_creator),
            deadline
        );

        vm.expectEmit(true, true, false, true);
        emit IOriginalContent.ContentRegistered(pHash, s_creator, s_sampleMetadataURI, block.timestamp);
        originalContent.registerContent(pHash, s_creator, s_sampleMetadataURI, s_sampleAllowedHosts, deadline, signature);
    }

    function testEmitsWhitelistAddedEvent() public {
        bytes32 pHash = keccak256("testText9999");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _signRegisterPayload(
            s_creatorKey,
            pHash,
            s_creator,
            s_sampleMetadataURI,
            s_sampleAllowedHosts,
            originalContent.nonces(s_creator),
            deadline
        );

        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistAdded(pHash, "sampledomain1.com");
        originalContent.registerContent(pHash, s_creator, s_sampleMetadataURI, s_sampleAllowedHosts, deadline, signature);
    }

    function testIfContentIsNotRegistered() public {
        bytes32 pHash = keccak256("testText3333");
        vm.expectRevert(IOriginalContent.OriginalContent__ContentNotRegistered.selector);
        originalContent.updateWhitelist(pHash, s_sampleAllowedHosts[0], true);
    }

    function testIfNotContentCreator() public {
        bytes32 pHash = keccak256("testText4444");
        address bob = makeAddr("bob");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.prank(bob);
        vm.expectRevert(IOriginalContent.OriginalContent__NotContentCreator.selector);
        originalContent.updateWhitelist(pHash, s_sampleAllowedHosts[0], true);
    }

    function testIfDomainIsEmpty() public {
        bytes32 pHash = keccak256("testText5555");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.prank(s_creator);
        vm.expectRevert(IOriginalContent.OriginalContent__ShouldNotBeEmptyDomain.selector);
        originalContent.updateWhitelist(pHash, "", true);
    }

    function testIfDomainIsWhitelisted() public {
        bytes32 pHash = keccak256("testText6666");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.prank(s_creator);
        originalContent.updateWhitelist(pHash, "domainupdated.com", true);
        assertTrue(originalContent.isDomainWhitelisted(pHash, "domainupdated.com"));
    }

    function testIfDomainIsNotWhitelisted() public {
        bytes32 pHash = keccak256("testText7777");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.prank(s_creator);
        originalContent.updateWhitelist(pHash, s_sampleAllowedHosts[0], false);
        assertFalse(originalContent.isDomainWhitelisted(pHash, s_sampleAllowedHosts[0]));
    }

    function testIfContentIsRegistered() public {
        bytes32 pHash = keccak256("testText8888");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        (
            address creator,
            bytes32 storedPHash,
            string memory storedMetadataURI,
            uint256 createdAt,
            bool isActive
        ) = originalContent.records(pHash);

        assertEq(creator, s_creator);
        assertEq(storedPHash, pHash);
        assertEq(storedMetadataURI, s_sampleMetadataURI);
        assertEq(createdAt, block.timestamp);
        assertEq(isActive, true);
    }

    function testEmitsWhitelistUpdatedEvent() public {
        bytes32 pHash = keccak256("testText101010");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.prank(s_creator);
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistUpdated(pHash, "sampledomain2.com", true);
        originalContent.updateWhitelist(pHash, "SampleDomain2.com", true);
    }

    function testEmitsWhitelistUpdatedEventWhenRemovingDomain() public {
        bytes32 pHash = keccak256("testText111111");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleMetadataURI, s_sampleAllowedHosts);

        vm.prank(s_creator);
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistUpdated(pHash, "sampledomain1.com", false);
        originalContent.updateWhitelist(pHash, " sampledomain1.com ", false);
    }

    function _registerContent(
        bytes32 pHash,
        address creator,
        uint256 creatorKey,
        string memory metadataURI,
        string[] memory allowedHosts
    ) private {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _signRegisterPayload(
            creatorKey, pHash, creator, metadataURI, allowedHosts, originalContent.nonces(creator), deadline
        );
        originalContent.registerContent(pHash, creator, metadataURI, allowedHosts, deadline, signature);
    }

    function _signRegisterPayload(
        uint256 signerKey,
        bytes32 pHash,
        address payloadCreator,
        string memory payloadMetadataURI,
        string[] memory allowedHosts,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes memory signature) {
        bytes32 digest = _buildDigest(pHash, payloadCreator, payloadMetadataURI, allowedHosts, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _buildDigest(
        bytes32 pHash,
        address payloadCreator,
        string memory payloadMetadataURI,
        string[] memory allowedHosts,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_CONTENT_TYPEHASH,
                pHash,
                payloadCreator,
                keccak256(bytes(payloadMetadataURI)),
                _hashAllowedHosts(allowedHosts),
                nonce,
                deadline
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(originalContent))
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
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
            revert IOriginalContent.OriginalContent__ShouldNotBeEmptyDomain();
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
                revert IOriginalContent.OriginalContent__InvalidDomainFormat();
            }
            normalized[i] = ch;
        }

        if (normalized[0] == 0x2E || normalized[normalized.length - 1] == 0x2E) {
            revert IOriginalContent.OriginalContent__InvalidDomainFormat();
        }

        uint256 labelLength = 0;
        for (uint256 i = 0; i < normalized.length; i++) {
            bytes1 ch = normalized[i];
            if (ch == 0x2E) {
                if (labelLength == 0 || normalized[i - 1] == 0x2D) {
                    revert IOriginalContent.OriginalContent__InvalidDomainFormat();
                }
                labelLength = 0;
                continue;
            }

            if (labelLength == 0 && ch == 0x2D) {
                revert IOriginalContent.OriginalContent__InvalidDomainFormat();
            }

            labelLength++;
            if (labelLength > 63) {
                revert IOriginalContent.OriginalContent__InvalidDomainFormat();
            }
        }

        if (normalized[normalized.length - 1] == 0x2D) {
            revert IOriginalContent.OriginalContent__InvalidDomainFormat();
        }

        return string(normalized);
    }

    function _isWhitespace(bytes1 ch) private pure returns (bool) {
        return ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D;
    }
}
