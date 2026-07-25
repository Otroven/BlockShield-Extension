// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {OriginalContent} from "../src/OriginalContent.sol";

contract DeployOriginalContent is Script {
    
    function run() public returns (OriginalContent) {
        vm.startBroadcast();
        OriginalContent deployer = new OriginalContent();
        vm.stopBroadcast();

        return deployer;
    }
}