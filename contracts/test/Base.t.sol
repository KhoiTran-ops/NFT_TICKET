// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EventRegistry} from "../src/EventRegistry.sol";
import {TicketRegistry} from "../src/TicketRegistry.sol";
import {IEventRegistry} from "../src/interfaces/IEventRegistry.sol";

/// @dev Fixture dùng chung: admin nền tảng, issuer, relayer (scanner), escrow giả lập, người dùng A/B/C.
abstract contract BaseTest is Test {
    EventRegistry internal events;
    TicketRegistry internal tickets;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal otherIssuer = makeAddr("otherIssuer");
    address internal scanner = makeAddr("scanner");
    address internal escrow = makeAddr("escrow");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant FACE_VALUE = 500_000; // 500.000đ, đơn vị nhỏ nhất

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        events = new EventRegistry(admin);
        tickets = new TicketRegistry(admin, events);

        vm.startPrank(admin);
        events.addIssuer(issuer);
        events.addIssuer(otherIssuer);
        tickets.grantRole(tickets.SCANNER_ROLE(), scanner);
        tickets.grantRole(tickets.ESCROW_ROLE(), escrow);
        vm.stopPrank();
    }

    function _policy() internal view returns (IEventRegistry.Policy memory) {
        // 150% / 3 lần / hạn 30 ngày: giá trị tạm theo DECISIONS "Đang mở", chỉ dùng cho test.
        return IEventRegistry.Policy({
            resaleAllowed: true,
            priceCapBps: 15_000,
            maxTransfers: 3,
            transferDeadline: uint64(block.timestamp + 30 days)
        });
    }

    function _createEvent() internal returns (uint256 eventId) {
        vm.prank(issuer);
        eventId = events.createEvent(_policy(), "ipfs://event-metadata");
    }

    function _createEvent(IEventRegistry.Policy memory p) internal returns (uint256 eventId) {
        vm.prank(issuer);
        eventId = events.createEvent(p, "ipfs://event-metadata");
    }

    function _issue(uint256 eventId, address to) internal returns (uint256 id) {
        address[] memory recipients = new address[](1);
        recipients[0] = to;
        uint256[] memory values = new uint256[](1);
        values[0] = FACE_VALUE;
        vm.prank(issuer);
        id = tickets.batchIssue(eventId, recipients, values);
    }

    function _list(uint256 id) internal {
        vm.prank(escrow);
        tickets.setListed(id, true);
    }

    function _escrowMove(uint256 id, address from, address to) internal {
        _list(id);
        vm.prank(escrow);
        tickets.escrowTransfer(id, from, to);
    }
}
