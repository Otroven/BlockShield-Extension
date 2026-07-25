// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IOriginalContent} from "./IOriginalContent.sol";

contract OriginalContent is IOriginalContent {
    mapping(bytes32 pHash => ContentRecord) public records;
    mapping(bytes32 pHash => mapping (string domain => bool isAllowed)) public domainWhitelist;

    function registerContent(
        bytes32 pHash,
        string memory metadataURI,
        string[] memory allowedDomains
    ) external {
        if (pHash == bytes32(0)) {
            revert OriginalContent__InvalidZeroPHash();
        }

        if (records[pHash].creator != address(0)) {
            revert OriginalContent__ContentAlreadyRegistered();
        }

        
        records[pHash] = ContentRecord({
            creator: msg.sender,
            pHash: pHash,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            isActive: true
        });

        for (uint256 i = 0; i < allowedDomains.length; i++) {
            domainWhitelist[pHash][allowedDomains[i]] = true;
            emit WhitelistAdded(pHash, allowedDomains[i]);
        }

        emit ContentRegistered(pHash, msg.sender, metadataURI, block.timestamp);
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


}
