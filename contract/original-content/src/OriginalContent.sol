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
            emit WhitelistUpdated(pHash, allowedDomains[i], true);
        }

        emit ContentRegistered(pHash, msg.sender, metadataURI, block.timestamp);
    }

    function updateWhitelist(
        bytes32 pHash,
        string memory domain,
        bool allowed
    ) external {}

    function getContent(bytes32 pHash) external view returns (ContentRecord memory) {}

    function isDomainWhitelisted(bytes32 pHash, string memory domain) external view returns (bool) {}


    

}
