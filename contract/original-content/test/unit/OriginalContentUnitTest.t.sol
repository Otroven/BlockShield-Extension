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
            "RegisterContent(bytes32 pHash,address creator,bytes32 allowedScopesHash,uint256 nonce,uint256 deadline)"
        );
    bytes32 private constant NAME_HASH = keccak256(bytes("OriginalContent"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));

    OriginalContent originalContent;
    string[] s_sampleAllowedScopes;
    address s_creator;
    uint256 s_creatorKey;

    function setUp() public {
        DeployOriginalContent deployer = new DeployOriginalContent();
        originalContent = deployer.run();

        (s_creator, s_creatorKey) = makeAddrAndKey("creator");
        s_sampleAllowedScopes.push("blog.naver.com/otroven");
    }

    function testIfPHashIsZero() public {
        vm.expectRevert(IOriginalContent.OriginalContent__InvalidZeroPHash.selector);
        originalContent.registerContent(bytes32(0), s_creator, s_sampleAllowedScopes, 0, "");
    }

    function testIfContentIsAlreadyRegistered() public {
        bytes32 pHash = keccak256("testText");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.expectRevert(IOriginalContent.OriginalContent__ContentAlreadyRegistered.selector);
        originalContent.registerContent(pHash, s_creator, s_sampleAllowedScopes, 0, "");
    }

    function testEmitsContentRegisteredEvent() public {
        bytes32 pHash = keccak256("testText");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _signRegisterPayload(
            s_creatorKey,
            pHash,
            s_creator,
            s_sampleAllowedScopes,
            originalContent.nonces(s_creator),
            deadline
        );

        vm.expectEmit(true, true, false, true);
        emit IOriginalContent.ContentRegistered(pHash, s_creator, block.timestamp);
        originalContent.registerContent(pHash, s_creator, s_sampleAllowedScopes, deadline, signature);
    }

    function testEmitsWhitelistAddedEvent() public {
        bytes32 pHash = keccak256("testText9999");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _signRegisterPayload(
            s_creatorKey,
            pHash,
            s_creator,
            s_sampleAllowedScopes,
            originalContent.nonces(s_creator),
            deadline
        );

        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistAdded(pHash, "blog.naver.com/otroven");
        originalContent.registerContent(pHash, s_creator, s_sampleAllowedScopes, deadline, signature);
    }

    function testIfContentIsNotRegistered() public {
        bytes32 pHash = keccak256("testText3333");
        vm.expectRevert(IOriginalContent.OriginalContent__ContentNotRegistered.selector);
        originalContent.updateWhitelist(pHash, s_sampleAllowedScopes[0], true);
    }

    function testIfNotContentCreator() public {
        bytes32 pHash = keccak256("testText4444");
        address bob = makeAddr("bob");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(bob);
        vm.expectRevert(IOriginalContent.OriginalContent__NotContentCreator.selector);
        originalContent.updateWhitelist(pHash, s_sampleAllowedScopes[0], true);
    }

    function testIfScopeIsEmpty() public {
        bytes32 pHash = keccak256("testText5555");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(s_creator);
        vm.expectRevert(IOriginalContent.OriginalContent__ShouldNotBeEmptyScope.selector);
        originalContent.updateWhitelist(pHash, "", true);
    }

    function testIfScopeIsWhitelisted() public {
        bytes32 pHash = keccak256("testText6666");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(s_creator);
        originalContent.updateWhitelist(pHash, "blog.naver.com/otroven/new", true);
        assertTrue(originalContent.isScopeWhitelisted(pHash, "blog.naver.com/otroven/new"));
    }

    function testIfScopeIsNotWhitelisted() public {
        bytes32 pHash = keccak256("testText7777");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(s_creator);
        originalContent.updateWhitelist(pHash, s_sampleAllowedScopes[0], false);
        assertFalse(originalContent.isScopeWhitelisted(pHash, s_sampleAllowedScopes[0]));
    }

    function testIfContentIsRegistered() public {
        bytes32 pHash = keccak256("testText8888");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        (
            address creator,
            bytes32 storedPHash,
            uint256 createdAt,
            bool isActive
        ) = originalContent.records(pHash);

        assertEq(creator, s_creator);
        assertEq(storedPHash, pHash);
        assertEq(createdAt, block.timestamp);
        assertEq(isActive, true);
    }

    function testEmitsWhitelistUpdatedEvent() public {
        bytes32 pHash = keccak256("testText101010");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(s_creator);
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistUpdated(pHash, "blog.naver.com/otroven/posting", true);
        originalContent.updateWhitelist(pHash, "Blog.Naver.com/Otroven/Posting", true);
    }

    function testEmitsWhitelistUpdatedEventWhenRemovingScope() public {
        bytes32 pHash = keccak256("testText111111");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(s_creator);
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistUpdated(pHash, "blog.naver.com/otroven", false);
        originalContent.updateWhitelist(pHash, " blog.naver.com/otroven/ ", false);
    }

    function testRegisterContentWithValidSignature() public {
        bytes32 pHash = keccak256("image-a");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _signRegisterPayload(
            s_creatorKey,
            pHash,
            s_creator,
            s_sampleAllowedScopes,
            originalContent.nonces(s_creator),
            deadline
        );
        address relayer = makeAddr("relayer");

        vm.prank(relayer);
        originalContent.registerContent(pHash, s_creator, s_sampleAllowedScopes, deadline, signature);

        IOriginalContent.ContentRecord memory record = originalContent.getContent(pHash);
        assertEq(record.creator, s_creator);
        assertEq(record.pHash, pHash);
        assertEq(originalContent.nonces(s_creator), 1);
    }

    function testRegisterContentRevertsOnExpiredSignature() public {
        bytes32 pHash = keccak256("image-b");
        uint256 deadline = block.timestamp;
        bytes memory signature = _signRegisterPayload(
            s_creatorKey,
            pHash,
            s_creator,
            s_sampleAllowedScopes,
            originalContent.nonces(s_creator),
            deadline
        );

        vm.warp(block.timestamp + 1);
        vm.expectRevert(IOriginalContent.OriginalContent__SignatureExpired.selector);
        originalContent.registerContent(pHash, s_creator, s_sampleAllowedScopes, deadline, signature);
    }

    function testRegisterContentRevertsOnInvalidSignature() public {
        bytes32 pHash = keccak256("image-c");
        uint256 deadline = block.timestamp + 1 days;
        (address wrongSigner, uint256 wrongSignerKey) = makeAddrAndKey("wrong-signer");
        bytes memory signature = _signRegisterPayload(
            wrongSignerKey,
            pHash,
            wrongSigner,
            s_sampleAllowedScopes,
            originalContent.nonces(s_creator),
            deadline
        );

        vm.expectRevert(IOriginalContent.OriginalContent__InvalidSignature.selector);
        originalContent.registerContent(pHash, s_creator, s_sampleAllowedScopes, deadline, signature);
    }

    function testRegisterContentRevertsOnReplay() public {
        bytes32 pHashA = keccak256("image-d-1");
        bytes32 pHashB = keccak256("image-d-2");
        uint256 deadline = block.timestamp + 1 days;
        uint256 nonce = originalContent.nonces(s_creator);
        bytes memory signature =
            _signRegisterPayload(s_creatorKey, pHashA, s_creator, s_sampleAllowedScopes, nonce, deadline);

        originalContent.registerContent(pHashA, s_creator, s_sampleAllowedScopes, deadline, signature);

        vm.expectRevert(IOriginalContent.OriginalContent__InvalidSignature.selector);
        originalContent.registerContent(pHashB, s_creator, s_sampleAllowedScopes, deadline, signature);
    }

    function testRegisterContentRevertsWhenCreatorIsZero() public {
        bytes32 pHash = keccak256("image-e");
        vm.expectRevert(IOriginalContent.OriginalContent__InvalidCreator.selector);
        originalContent.registerContent(pHash, address(0), s_sampleAllowedScopes, 0, "");
    }

    function testRegisterContentNormalizesScopes() public {
        bytes32 pHash = keccak256("image-f");
        string[] memory scopes = new string[](1);
        scopes[0] = "  Blog.Naver.COM/Otroven/Series-1/  ";
        _registerContent(pHash, s_creator, s_creatorKey, scopes);

        assertTrue(originalContent.isScopeWhitelisted(pHash, "blog.naver.com/otroven/series-1"));
        assertTrue(originalContent.isScopeWhitelisted(pHash, "  BLOG.NAVER.COM/OTROVEN/SERIES-1/ "));
    }

    function testRegisterContentRejectsUrlStyleScope() public {
        bytes32 pHash = keccak256("image-g");
        uint256 deadline = block.timestamp + 1 days;
        string[] memory scopes = new string[](1);
        scopes[0] = "https://blog.naver.com/path";

        vm.expectRevert(IOriginalContent.OriginalContent__InvalidScopeFormat.selector);
        originalContent.registerContent(pHash, s_creator, scopes, deadline, "");
    }

    function testUpdateWhitelistRejectsInvalidScope() public {
        bytes32 pHash = keccak256("image-h");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        vm.prank(s_creator);
        vm.expectRevert(IOriginalContent.OriginalContent__InvalidScopeFormat.selector);
        originalContent.updateWhitelist(pHash, "bad host", true);
    }

    function testDifferentPathIsNotWhitelisted() public {
        bytes32 pHash = keccak256("image-i");
        _registerContent(pHash, s_creator, s_creatorKey, s_sampleAllowedScopes);

        assertFalse(originalContent.isScopeWhitelisted(pHash, "blog.naver.com/another-author/post-1"));
    }

    function _registerContent(
        bytes32 pHash,
        address creator,
        uint256 creatorKey,
        string[] memory allowedScopes
    ) private {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature =
            _signRegisterPayload(creatorKey, pHash, creator, allowedScopes, originalContent.nonces(creator), deadline);
        originalContent.registerContent(pHash, creator, allowedScopes, deadline, signature);
    }

    function _signRegisterPayload(
        uint256 signerKey,
        bytes32 pHash,
        address payloadCreator,
        string[] memory allowedScopes,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes memory signature) {
        bytes32 digest = _buildDigest(pHash, payloadCreator, allowedScopes, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _buildDigest(
        bytes32 pHash,
        address payloadCreator,
        string[] memory allowedScopes,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_CONTENT_TYPEHASH,
                pHash,
                payloadCreator,
                _hashAllowedScopes(allowedScopes),
                nonce,
                deadline
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(originalContent))
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _hashAllowedScopes(string[] memory allowedScopes) private pure returns (bytes32) {
        bytes32[] memory scopeHashes = new bytes32[](allowedScopes.length);
        for (uint256 i = 0; i < allowedScopes.length; i++) {
            string memory normalizedScope = _normalizeScope(allowedScopes[i]);
            scopeHashes[i] = keccak256(bytes(normalizedScope));
        }
        return keccak256(abi.encodePacked(scopeHashes));
    }

    function _normalizeScope(string memory scope) private pure returns (string memory) {
        bytes memory raw = bytes(scope);
        uint256 start = 0;
        uint256 end = raw.length;

        while (start < end && _isWhitespace(raw[start])) {
            start++;
        }
        while (end > start && _isWhitespace(raw[end - 1])) {
            end--;
        }

        if (end == start) {
            revert IOriginalContent.OriginalContent__ShouldNotBeEmptyScope();
        }

        bytes memory normalized = new bytes(end - start);
        uint256 hostEnd = normalized.length;
        for (uint256 i = 0; i < normalized.length; i++) {
            bytes1 ch = raw[start + i];
            if (ch >= 0x41 && ch <= 0x5A) {
                ch = bytes1(uint8(ch) + 32);
            }

            bool isLower = ch >= 0x61 && ch <= 0x7A;
            bool isDigit = ch >= 0x30 && ch <= 0x39;
            bool isDot = ch == 0x2E;
            bool isHyphen = ch == 0x2D;
            bool isSlash = ch == 0x2F;
            bool isUnderscore = ch == 0x5F;
            bool isTilde = ch == 0x7E;
            bool isPercent = ch == 0x25;
            if (!(isLower || isDigit || isDot || isHyphen || isSlash || isUnderscore || isTilde || isPercent)) {
                revert IOriginalContent.OriginalContent__InvalidScopeFormat();
            }
            if (isSlash && hostEnd == normalized.length) {
                hostEnd = i;
            }
            normalized[i] = ch;
        }

        if (hostEnd == 0) {
            revert IOriginalContent.OriginalContent__InvalidScopeFormat();
        }
        if (normalized[0] == 0x2E || normalized[hostEnd - 1] == 0x2E) {
            revert IOriginalContent.OriginalContent__InvalidScopeFormat();
        }

        uint256 labelLength = 0;
        for (uint256 i = 0; i < hostEnd; i++) {
            bytes1 ch = normalized[i];
            if (ch == 0x2E) {
                if (labelLength == 0 || normalized[i - 1] == 0x2D || i + 1 == hostEnd) {
                    revert IOriginalContent.OriginalContent__InvalidScopeFormat();
                }
                labelLength = 0;
                continue;
            }

            if (labelLength == 0 && ch == 0x2D) {
                revert IOriginalContent.OriginalContent__InvalidScopeFormat();
            }

            labelLength++;
            if (labelLength > 63) {
                revert IOriginalContent.OriginalContent__InvalidScopeFormat();
            }
        }

        if (normalized[hostEnd - 1] == 0x2D) {
            revert IOriginalContent.OriginalContent__InvalidScopeFormat();
        }

        uint256 scopeEnd = normalized.length;
        while (scopeEnd > hostEnd && normalized[scopeEnd - 1] == 0x2F) {
            scopeEnd--;
        }

        for (uint256 i = hostEnd; i + 1 < scopeEnd; i++) {
            if (normalized[i] == 0x2F && normalized[i + 1] == 0x2F) {
                revert IOriginalContent.OriginalContent__InvalidScopeFormat();
            }
        }

        if (scopeEnd == hostEnd) {
            return string(_sliceBytes(normalized, 0, hostEnd));
        }
        if (normalized[hostEnd] != 0x2F) {
            revert IOriginalContent.OriginalContent__InvalidScopeFormat();
        }
        return string(_sliceBytes(normalized, 0, scopeEnd));
    }

    function _sliceBytes(bytes memory input, uint256 start, uint256 end) private pure returns (bytes memory) {
        bytes memory output = new bytes(end - start);
        for (uint256 i = 0; i < output.length; i++) {
            output[i] = input[start + i];
        }
        return output;
    }

    function _isWhitespace(bytes1 ch) private pure returns (bool) {
        return ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D;
    }
}
