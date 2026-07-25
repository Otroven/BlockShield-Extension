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
        vm.expectEmit(true, true, true, true);
        emit IOriginalContent.ContentRegistered(pHash, alice, s_sampleMetadataURI, block.timestamp);
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);
    }

    function testEmitsWhitelistUpdatedEvent() public {
        string memory testText = "testText";
        bytes32 pHash = keccak256(abi.encodePacked(testText));

        address alice = makeAddr("alice");
        vm.expectEmit(true, true, true, true);
        emit IOriginalContent.WhitelistUpdated(pHash, s_sampleAllowedDomains[0], true);
        vm.prank(alice);
        originalContent.registerContent(pHash, s_sampleMetadataURI, s_sampleAllowedDomains);
    }


}
