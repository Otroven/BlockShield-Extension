// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {IOriginalContent} from "../../src/IOriginalContent.sol";
import {OriginalContent} from "../../src/OriginalContent.sol";
import {DeployOriginalContent} from "../../script/DeployOriginalContent.s.sol";

contract OriginalContentUnitTest is Test {
    OriginalContent originalContent;
    string s_sampleMetadataURI;
    string[] s_sampleAllowedDomains;


    function setUp() public {
        DeployOriginalContent deployer = new DeployOriginalContent();
        originalContent = deployer.run();

        s_sampleMetadataURI = "uri";
        s_sampleAllowedDomains.push("sampleDomain1");
    }

    function testIfPHashIsZero() public {
        vm.expectRevert(IOriginalContent.OriginalContent__InvalidZeroPHash.selector);
        originalContent.registerContent(bytes32(0), s_sampleMetadataURI, s_sampleAllowedDomains);
    }

    function testIfContentIsAlreadyRegistered() public {
        string memory testText = "testText";
        bytes32 pHash = keccak256(abi.encodePacked(testText));
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);
        vm.expectRevert(IOriginalContent.OriginalContent__ContentAlreadyRegistered.selector);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);
    }

    function testEmitsContentRegisteredEvent() public {
        string memory testText = "testText";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.expectEmit(true, true, false, true);
        emit IOriginalContent.ContentRegistered(pHash, alice, s_sampleMetadataURI, block.timestamp);
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);
    }

    function testEmitsWhitelistAddedEvent() public {
        string memory testText = "testText9999";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistAdded(pHash, "sampleDomain1");

        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);
    }

    function testIfContentIsNotRegistered() public {
        string memory testText = "testText3333";
        bytes32 pHash = keccak256(abi.encodePacked(testText));
        vm.expectRevert(IOriginalContent.OriginalContent__ContentNotRegistered.selector);
        originalContent.updateWhitelist(pHash, s_sampleAllowedDomains[0], true);
    }
    
    function testIfNotContentCreator() public {
        string memory testText = "testText4444";
        bytes32 pHash = keccak256(abi.encodePacked(testText));
        
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);

        vm.prank(bob);
        vm.expectRevert(IOriginalContent.OriginalContent__NotContentCreator.selector);
        originalContent.updateWhitelist(pHash, s_sampleAllowedDomains[0], true);
    }

    function testIfDomainIsEmpty() public {
        string memory testText = "testText5555";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);


        vm.prank(alice);
        vm.expectRevert(IOriginalContent.OriginalContent__ShouldNotBeEmptyDomain.selector);
        originalContent.updateWhitelist(pHash, "", true);
    }

    function testIfDomainIsWhitelisted() public {
        string memory testText = "testText6666";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);

        vm.prank(alice);
        string memory domainToBeUpdated = "domainToBeUpdated";
        originalContent.updateWhitelist(pHash, domainToBeUpdated, true);

        bool isWhitelisted = originalContent.isDomainWhitelisted(pHash, domainToBeUpdated);
        assertEq(isWhitelisted, true);
    }

    function testIfDomainIsNotWhitelisted() public {
        string memory testText = "testText7777";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);

        vm.prank(alice);
        originalContent.updateWhitelist(pHash, s_sampleAllowedDomains[0], false);

        bool isWhitelisted = originalContent.isDomainWhitelisted(pHash, s_sampleAllowedDomains[0]);
        assertEq(isWhitelisted, false);
    }

    function testIfContentIsRegistered() public {
        string memory testText = "testText8888";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);

        (
            address creator,
            bytes32 storedPHash,
            string memory storedMetadataURI,
            uint256 createdAt,
            bool isActive
        ) = originalContent.records(pHash);

        assertEq(creator, alice);
        assertEq(storedPHash, pHash);
        assertEq(storedMetadataURI, s_sampleMetadataURI);
        assertEq(createdAt, block.timestamp);
        assertEq(isActive, true);
    }

    function testEmitsWhitelistUpdatedEvent() public {
        string memory testText = "testText101010";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        string memory domainToBeUpdated = "sampleDomain2";

        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistUpdated(pHash, domainToBeUpdated, true);
        originalContent.updateWhitelist(pHash, domainToBeUpdated, true);
    }

    function testEmitsWhitelistUpdatedEventWhenRemovingDomain() public {
        string memory testText = "testText111111";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        string memory domainToBeUpdated = s_sampleAllowedDomains[0];

        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IOriginalContent.WhitelistUpdated(pHash, domainToBeUpdated, false);
        originalContent.updateWhitelist(pHash, domainToBeUpdated, false);
    }

}
