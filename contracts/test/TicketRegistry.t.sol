// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {BaseTest} from "./Base.t.sol";
import {IEventRegistry} from "../src/interfaces/IEventRegistry.sol";
import {ITicketRegistry} from "../src/interfaces/ITicketRegistry.sol";
import {
    EventIsCancelled,
    NotEventIssuer,
    LengthMismatch,
    EmptyBatch,
    TicketNotFound,
    InvalidTicketStatus,
    TransferRestricted,
    NotTicketOwner,
    ResaleNotAllowed,
    TransferDeadlinePassed,
    MaxTransfersReached,
    IssuerCannotTrade
} from "../src/libraries/Errors.sol";

contract TicketRegistryTest is BaseTest {
    uint256 internal eventId;

    function setUp() public override {
        super.setUp();
        eventId = _createEvent();
    }

    // ------------------------------------------------------------- batchIssue

    function test_BatchIssue() public {
        address[] memory to = new address[](2);
        to[0] = alice;
        to[1] = bob;
        uint256[] memory values = new uint256[](2);
        values[0] = FACE_VALUE;
        values[1] = 700_000;

        vm.expectEmit(true, true, false, true, address(tickets));
        emit ITicketRegistry.TicketIssued(1, eventId, alice);
        vm.prank(issuer);
        uint256 firstId = tickets.batchIssue(eventId, to, values);

        assertEq(firstId, 1);
        assertEq(tickets.ownerOf(1), alice);
        assertEq(tickets.ownerOf(2), bob);
        ITicketRegistry.Ticket memory t = tickets.ticketOf(2);
        assertEq(t.eventId, eventId);
        assertEq(t.faceValue, 700_000);
        assertEq(t.transferCount, 0);
        assertEq(uint8(t.status), uint8(ITicketRegistry.Status.Active));
        assertEq(tickets.nextTicketId(), 3);
    }

    function test_RevertWhen_NonIssuerIssues() public {
        address[] memory to = new address[](1);
        to[0] = alice;
        uint256[] memory values = new uint256[](1);
        values[0] = FACE_VALUE;
        vm.expectRevert(abi.encodeWithSelector(NotEventIssuer.selector, eventId, stranger));
        vm.prank(stranger);
        tickets.batchIssue(eventId, to, values);
    }

    function test_RevertWhen_OtherIssuerIssuesForEvent() public {
        address[] memory to = new address[](1);
        to[0] = alice;
        uint256[] memory values = new uint256[](1);
        values[0] = FACE_VALUE;
        vm.expectRevert(abi.encodeWithSelector(NotEventIssuer.selector, eventId, otherIssuer));
        vm.prank(otherIssuer);
        tickets.batchIssue(eventId, to, values);
    }

    function test_RevertWhen_RemovedIssuerIssues() public {
        vm.prank(admin);
        events.removeIssuer(issuer);
        address[] memory to = new address[](1);
        to[0] = alice;
        uint256[] memory values = new uint256[](1);
        values[0] = FACE_VALUE;
        vm.expectRevert(abi.encodeWithSelector(NotEventIssuer.selector, eventId, issuer));
        vm.prank(issuer);
        tickets.batchIssue(eventId, to, values);
    }

    function test_RevertWhen_BatchLengthMismatchOrEmpty() public {
        address[] memory to = new address[](2);
        uint256[] memory values = new uint256[](1);
        vm.startPrank(issuer);
        vm.expectRevert(LengthMismatch.selector);
        tickets.batchIssue(eventId, to, values);
        vm.expectRevert(EmptyBatch.selector);
        tickets.batchIssue(eventId, new address[](0), new uint256[](0));
        vm.stopPrank();
    }

    function test_RevertWhen_IssueForCancelledEvent() public {
        vm.prank(admin);
        events.cancelEvent(eventId, "r");
        address[] memory to = new address[](1);
        to[0] = alice;
        uint256[] memory values = new uint256[](1);
        vm.expectRevert(abi.encodeWithSelector(EventIsCancelled.selector, eventId));
        vm.prank(issuer);
        tickets.batchIssue(eventId, to, values);
    }

    // ------------------------------------------------------ khóa chuyển tự do

    function test_RevertWhen_DirectTransfer() public {
        uint256 id = _issue(eventId, alice);
        vm.expectRevert(TransferRestricted.selector);
        vm.prank(alice);
        tickets.transferFrom(alice, bob, id);
    }

    function test_RevertWhen_DirectSafeTransferEvenIfApproved() public {
        uint256 id = _issue(eventId, alice);
        vm.prank(alice);
        tickets.setApprovalForAll(stranger, true);
        vm.expectRevert(TransferRestricted.selector);
        vm.prank(stranger);
        tickets.safeTransferFrom(alice, bob, id);
    }

    function test_RevertWhen_IssuerOrAdminMovesTicketDirectly() public {
        uint256 id = _issue(eventId, alice);
        vm.expectRevert();
        vm.prank(issuer);
        tickets.transferFrom(alice, issuer, id);
        vm.expectRevert();
        vm.prank(admin);
        tickets.transferFrom(alice, admin, id);
        assertEq(tickets.ownerOf(id), alice);
    }

    // ------------------------------------------------------------- markUsed

    function test_ScannerMarksUsed() public {
        uint256 id = _issue(eventId, alice);
        vm.expectEmit(true, false, false, false, address(tickets));
        emit ITicketRegistry.TicketUsed(id);
        vm.prank(scanner);
        tickets.markUsed(id);
        assertEq(uint8(tickets.statusOf(id)), uint8(ITicketRegistry.Status.Used));
    }

    function test_RevertWhen_MarkUsedByNonScanner() public {
        uint256 id = _issue(eventId, alice);
        bytes32 role = tickets.SCANNER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, issuer, role));
        vm.prank(issuer);
        tickets.markUsed(id);
    }

    function test_RevertWhen_MarkUsedTwice() public {
        uint256 id = _issue(eventId, alice);
        vm.startPrank(scanner);
        tickets.markUsed(id);
        vm.expectRevert(abi.encodeWithSelector(InvalidTicketStatus.selector, id, uint8(ITicketRegistry.Status.Used)));
        tickets.markUsed(id);
        vm.stopPrank();
    }

    /// Vé đang rao không vào cổng được (PRODUCT_CONTEXT 3.1 bước 4).
    function test_RevertWhen_MarkUsedListedTicket() public {
        uint256 id = _issue(eventId, alice);
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(InvalidTicketStatus.selector, id, uint8(ITicketRegistry.Status.Listed)));
        vm.prank(scanner);
        tickets.markUsed(id);
    }

    function test_RevertWhen_MarkUsedUnknownTicket() public {
        vm.expectRevert(abi.encodeWithSelector(TicketNotFound.selector, 999));
        vm.prank(scanner);
        tickets.markUsed(999);
    }

    // ------------------------------------------------------- escrow transfer

    function test_EscrowListUnlistAndTransfer() public {
        uint256 id = _issue(eventId, alice);

        _list(id);
        assertEq(uint8(tickets.statusOf(id)), uint8(ITicketRegistry.Status.Listed));
        vm.prank(escrow);
        tickets.setListed(id, false);
        assertEq(uint8(tickets.statusOf(id)), uint8(ITicketRegistry.Status.Active));

        _list(id);
        vm.expectEmit(true, false, false, true, address(tickets));
        emit ITicketRegistry.TicketTransferred(id, alice, bob, 1);
        vm.prank(escrow);
        tickets.escrowTransfer(id, alice, bob);

        assertEq(tickets.ownerOf(id), bob);
        ITicketRegistry.Ticket memory t = tickets.ticketOf(id);
        assertEq(t.transferCount, 1);
        assertEq(uint8(t.status), uint8(ITicketRegistry.Status.Active));
    }

    function test_RevertWhen_NonEscrowListsOrTransfers() public {
        uint256 id = _issue(eventId, alice);
        bytes32 role = tickets.ESCROW_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, role));
        vm.prank(alice);
        tickets.setListed(id, true);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, issuer, role));
        vm.prank(issuer);
        tickets.escrowTransfer(id, alice, issuer);
    }

    function test_RevertWhen_EscrowTransferNotListed() public {
        uint256 id = _issue(eventId, alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidTicketStatus.selector, id, uint8(ITicketRegistry.Status.Active)));
        vm.prank(escrow);
        tickets.escrowTransfer(id, alice, bob);
    }

    function test_RevertWhen_EscrowTransferWrongFrom() public {
        uint256 id = _issue(eventId, alice);
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(NotTicketOwner.selector, id, carol));
        vm.prank(escrow);
        tickets.escrowTransfer(id, carol, bob);
    }

    function test_RevertWhen_MaxTransfersReached() public {
        IEventRegistry.Policy memory p = _policy();
        p.maxTransfers = 2;
        uint256 ev = _createEvent(p);
        uint256 id = _issue(ev, alice);

        _escrowMove(id, alice, bob); // A → B
        _escrowMove(id, bob, carol); // B → C
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(MaxTransfersReached.selector, id));
        vm.prank(escrow);
        tickets.escrowTransfer(id, carol, alice);
    }

    function test_RevertWhen_TransferDeadlinePassed() public {
        uint256 id = _issue(eventId, alice);
        _list(id);
        vm.warp(events.policyOf(eventId).transferDeadline);
        vm.expectRevert(abi.encodeWithSelector(TransferDeadlinePassed.selector, eventId));
        vm.prank(escrow);
        tickets.escrowTransfer(id, alice, bob);
    }

    function test_RevertWhen_ResaleNotAllowed() public {
        IEventRegistry.Policy memory p = _policy();
        p.resaleAllowed = false;
        uint256 ev = _createEvent(p);
        uint256 id = _issue(ev, alice);
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(ResaleNotAllowed.selector, ev));
        vm.prank(escrow);
        tickets.escrowTransfer(id, alice, bob);
    }

    /// Ban tổ chức không giao dịch vé sự kiện của mình (PRODUCT_CONTEXT 2.3.4).
    function test_RevertWhen_IssuerBuysOwnEventTicket() public {
        uint256 id = _issue(eventId, alice);
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(IssuerCannotTrade.selector, eventId, issuer));
        vm.prank(escrow);
        tickets.escrowTransfer(id, alice, issuer);
    }

    function test_RevertWhen_IssuerSellsOwnEventTicket() public {
        uint256 id = _issue(eventId, issuer);
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(IssuerCannotTrade.selector, eventId, issuer));
        vm.prank(escrow);
        tickets.escrowTransfer(id, issuer, bob);
    }

    function test_OtherOrganizerCanBuyTicketOfAnotherEvent() public {
        uint256 id = _issue(eventId, alice);
        _escrowMove(id, alice, otherIssuer);
        assertEq(tickets.ownerOf(id), otherIssuer);
    }

    // ---------------------------------------------------------------- revoke

    function test_IssuerRevokesActiveTicket() public {
        uint256 id = _issue(eventId, alice);
        vm.expectEmit(true, false, false, true, address(tickets));
        emit ITicketRegistry.TicketRevoked(id, "fraud");
        vm.prank(issuer);
        tickets.revoke(id, "fraud");
        assertEq(uint8(tickets.statusOf(id)), uint8(ITicketRegistry.Status.Revoked));
    }

    function test_RevertWhen_RevokeListedTicket() public {
        uint256 id = _issue(eventId, alice);
        _list(id);
        vm.expectRevert(abi.encodeWithSelector(InvalidTicketStatus.selector, id, uint8(ITicketRegistry.Status.Listed)));
        vm.prank(issuer);
        tickets.revoke(id, "fraud");
    }

    function test_RevertWhen_NonIssuerRevokes() public {
        uint256 id = _issue(eventId, alice);
        vm.expectRevert(abi.encodeWithSelector(NotEventIssuer.selector, eventId, otherIssuer));
        vm.prank(otherIssuer);
        tickets.revoke(id, "fraud");
    }

    // --------------------------------------------------------- hủy sự kiện

    /// PRODUCT_CONTEXT 3.3 bước 6: vé Void ngay khi duyệt hủy, kể cả vé đang rao hoặc đã dùng.
    function test_CancelEventVoidsTickets() public {
        uint256 active = _issue(eventId, alice);
        uint256 listed = _issue(eventId, bob);
        uint256 used = _issue(eventId, carol);
        uint256 revoked = _issue(eventId, carol);
        _list(listed);
        vm.prank(scanner);
        tickets.markUsed(used);
        vm.prank(issuer);
        tickets.revoke(revoked, "fraud");

        vm.prank(admin);
        events.cancelEvent(eventId, "organizer_request");

        assertEq(uint8(tickets.statusOf(active)), uint8(ITicketRegistry.Status.Void));
        assertEq(uint8(tickets.statusOf(listed)), uint8(ITicketRegistry.Status.Void));
        assertEq(uint8(tickets.statusOf(used)), uint8(ITicketRegistry.Status.Void));
        assertEq(uint8(tickets.statusOf(revoked)), uint8(ITicketRegistry.Status.Revoked));
        assertEq(uint8(tickets.ticketOf(active).status), uint8(ITicketRegistry.Status.Void));
    }

    function test_RevertWhen_ActionsOnCancelledEvent() public {
        uint256 id = _issue(eventId, alice);
        uint256 listed = _issue(eventId, bob);
        _list(listed);
        vm.prank(admin);
        events.cancelEvent(eventId, "r");

        bytes memory err = abi.encodeWithSelector(EventIsCancelled.selector, eventId);
        vm.expectRevert(err);
        vm.prank(scanner);
        tickets.markUsed(id);
        vm.expectRevert(err);
        vm.prank(escrow);
        tickets.setListed(id, true);
        vm.expectRevert(err);
        vm.prank(escrow);
        tickets.escrowTransfer(listed, bob, carol);
        vm.expectRevert(err);
        vm.prank(issuer);
        tickets.revoke(id, "r");
    }

    // ------------------------------------------------------------------ misc

    function test_SupportsInterfaces() public view {
        assertTrue(tickets.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(tickets.supportsInterface(0x5b5e139f)); // ERC-721 Metadata
        assertTrue(tickets.supportsInterface(type(IAccessControl).interfaceId));
    }

    function test_RevertWhen_StatusOfUnknownTicket() public {
        vm.expectRevert(abi.encodeWithSelector(TicketNotFound.selector, 7));
        tickets.statusOf(7);
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_BatchIssueAssignsSequentialIds(uint8 count, uint96 faceValue) public {
        uint256 n = bound(count, 1, 50);
        address[] memory to = new address[](n);
        uint256[] memory values = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            to[i] = address(uint160(0x1000 + i));
            values[i] = faceValue;
        }
        vm.prank(issuer);
        uint256 first = tickets.batchIssue(eventId, to, values);
        for (uint256 i = 0; i < n; ++i) {
            assertEq(tickets.ownerOf(first + i), to[i]);
            assertEq(tickets.ticketOf(first + i).faceValue, faceValue);
        }
        assertEq(tickets.balanceOf(to[0]), 1);
    }

    function testFuzz_TransferCountNeverExceedsPolicy(uint8 maxTransfers, uint8 attempts) public {
        uint8 limit = uint8(bound(maxTransfers, 0, 10));
        uint256 tries = bound(attempts, 0, 12);
        IEventRegistry.Policy memory p = _policy();
        p.maxTransfers = limit;
        uint256 ev = _createEvent(p);
        address holder = alice;
        uint256 id = _issue(ev, holder);

        for (uint256 i = 0; i < tries; ++i) {
            address next = address(uint160(0x2000 + i));
            _list(id);
            vm.prank(escrow);
            if (i < limit) {
                tickets.escrowTransfer(id, holder, next);
                holder = next;
            } else {
                vm.expectRevert(abi.encodeWithSelector(MaxTransfersReached.selector, id));
                tickets.escrowTransfer(id, holder, next);
                vm.prank(escrow);
                tickets.setListed(id, false);
            }
        }
        assertLe(tickets.ticketOf(id).transferCount, limit);
        assertEq(tickets.ownerOf(id), holder);
    }
}
