// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {EventRegistry} from "../src/EventRegistry.sol";
import {TicketRegistry} from "../src/TicketRegistry.sol";

/// @notice Deploy EventRegistry + TicketRegistry, cấp SCANNER_ROLE cho relayer, ghi địa chỉ ra `deployments/`.
/// @dev Biến môi trường (xem `.env.example`, KHÔNG commit giá trị thật):
///      - DEPLOYER_PRIVATE_KEY (bắt buộc): ví testnet có AVAX Fuji từ faucet.
///      - ADMIN_ADDRESS (tùy chọn, mặc định = deployer): giữ DEFAULT_ADMIN_ROLE.
///      - RELAYER_ADDRESS (tùy chọn): ví relayer backend, nhận SCANNER_ROLE. Chỉ cấp được khi admin = deployer.
///      Chạy: forge script script/Deploy.s.sol --rpc-url fuji --broadcast
contract Deploy is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;

    function run() external returns (EventRegistry events, TicketRegistry tickets) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address relayer = vm.envOr("RELAYER_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);
        events = new EventRegistry(admin);
        tickets = new TicketRegistry(admin, events);
        if (relayer != address(0) && admin == deployer) {
            tickets.grantRole(tickets.SCANNER_ROLE(), relayer);
        }
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("EventRegistry", address(events));
        console2.log("TicketRegistry", address(tickets));
        console2.log("admin", admin);

        _writeDeployment(events, tickets, admin, relayer);
    }

    function _writeDeployment(EventRegistry events, TicketRegistry tickets, address admin, address relayer) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "blockNumber", block.number);
        vm.serializeAddress(key, "admin", admin);
        vm.serializeAddress(key, "scanner", relayer);
        vm.serializeAddress(key, "EventRegistry", address(events));
        string memory json = vm.serializeAddress(key, "TicketRegistry", address(tickets));

        string memory file = block.chainid == FUJI_CHAIN_ID
            ? "deployments/fuji.json"
            : string.concat("deployments/local-", vm.toString(block.chainid), ".json");
        vm.writeJson(json, file);
        console2.log("written", file);
    }
}
