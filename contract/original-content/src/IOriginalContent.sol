// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;


/**
 * @title Interface OriginalContent Contract
 * @author Otroven
 *
 * Before implementing contract, design interface
 * a. Define Events
 * b. Define Errors
 * c. Design Data Type
 * d. Design Functions
 */
interface IOriginalContent {
    
    /**
     ************************************************************************************
     *********************************** Define Events **********************************
     ************************************************************************************
     */

    /**
     * @notice : Emit when original content successfully registered
     */
    event ContentRegistered(
        bytes32 indexed pHash,
        address indexed creator,
        string metadataURI,
        uint256 createdAt
    );

       /**
     * @notice : Emit when white list domain added
     */
    event WhitelistAdded(
        bytes32 indexed pHash,
        string domain
    );

    /**
     * @notice : Emit when white list domain has changed
     */
    event WhitelistUpdated(
        bytes32 indexed pHash,
        string domain,
        bool allowed
    );

    /**
     ************************************************************************************
     *********************************** Define Errors **********************************
     ************************************************************************************
     */
    error OriginalContent__InvalidZeroPHash();
    error OriginalContent__ContentAlreadyRegistered();
    error OriginalContent__ContentNotRegistered();
    error OriginalContent__NotContentCreator();
    error OriginalContent__ShouldNotBeEmptyDomain();
    error OriginalContent__InvalidDomainFormat();
    error OriginalContent__ContentNotExists();
    error OriginalContent__InvalidSignature();
    error OriginalContent__SignatureExpired();
    error OriginalContent__InvalidCreator();

    /**
     ************************************************************************************
     *********************************** Design Data Types ******************************
     ************************************************************************************
     */

    /**
     * @notice Struct representing the record of a registered content
     * @param creator Wallet address of the content creator
     * @param pHash Perceptual hash of the media
     * @param metadataURI URI link pointing to the metadata (e.g., IPFS)
     * @param createdAt Timestamp when the content was registered
     * @param isActive Status indicating if the record is currently valid
     */
    struct ContentRecord {
      address creator;
      bytes32 pHash;
      string metadataURI;
      uint256 createdAt;
      bool isActive;  
    }



    /**
     ************************************************************************************
     *********************************** Design Functions *******************************
     ************************************************************************************
     */


    /**
     * @notice Registers original content with its pHash, metadata URI, and allowed hosts.
     * @dev State-changing function. Track results using the `ContentRegistered` event.
     * @param pHash Perceptual hash value of the media
     * @param creator Original creator address that signs typed data
     * @param metadataURI IPFS or external URL containing metadata
     * @param allowedHosts List of host domains authorized to host/display the content
     * @param deadline Signature expiry timestamp
     * @param signature EIP-712 typed-data signature from creator
     */
    function registerContent(
        bytes32 pHash,
        address creator,
        string memory metadataURI,
        string[] memory allowedHosts,
        uint256 deadline,
        bytes memory signature
    ) external;

    /**
     * @notice Adds or removes a domain from the whitelist for a specific pHash.
     * @param pHash Perceptual hash of the target content
     * @param domain Host domain to be configured
     * @param allowed True to grant authorization, false to revoke
     */
    function updateWhitelist(
        bytes32 pHash,
        string memory domain,
        bool allowed
    ) external;

    /**
     * @notice Fetches the full content record by pHash.
     * @param pHash Perceptual hash of the media
     * @return ContentRecord struct containing creator, pHash, metadataURI, createdAt, and isActive
     */
    function getContent(bytes32 pHash) external view returns (ContentRecord memory);

    /**
     * @notice Checks if a specific domain is authorized for the given pHash.
     * @param pHash Perceptual hash of the media
     * @param domain Host domain to check
     * @return True if authorized, false otherwise
     */
    function isDomainWhitelisted(bytes32 pHash, string memory domain) external view returns (bool);

    /**
     * @notice Returns the current EIP-712 nonce for `creator`.
     * @param creator Creator address used as signer.
     */
    function nonces(address creator) external view returns (uint256);
}
