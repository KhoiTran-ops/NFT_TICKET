// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {BaseTest} from "./Base.t.sol";
import {EventRegistry} from "../src/EventRegistry.sol";
import {IEventRegistry} from "../src/interfaces/IEventRegistry.sol";
import {ZeroAddress, InvalidPolicy, EventNotFound, EventAlreadyCancelled} from "../src/libraries/Errors.sol";

contract EventRegistryTest is BaseTest {
    function test_ConstructorRejectsZeroAdmin() public {
        vm.expectRevert(ZeroAddress.selector);
        new EventRegistry(address(0));
    }

    function test_AdminAddsAndRemovesIssuer() public {
        address newIssuer = makeAddr("newIssuer");
        vm.expectEmit(true, false, false, false, address(events));
        emit IEventRegistry.IssuerAdded(newIssuer);
        vm.prank(admin);
        events.addIssuer(newIssuer);
        assertTrue(events.isIssuer(newIssuer));

        vm.prank(admin);
        events.removeIssuer(newIssuer);
        assertFalse(events.isIssuer(newIssuer));
    }

    function test_RevertWhen_NonAdminAddsIssuer() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, events.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(stranger);
        events.addIssuer(stranger);
    }

    function test_RevertWhen_AddZeroIssuer() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(admin);
        events.addIssuer(address(0));
    }

    function test_IssuerCreatesEvent() public {
        vm.expectEmit(true, true, false, true, address(events));
        emit IEventRegistry.EventCreated(1, issuer, "ipfs://event-metadata");
        uint256 eventId = _createEvent();

        assertEq(eventId, 1);
        assertTrue(events.exists(eventId));
        assertEq(events.issuerOf(eventId), issuer);
        assertEq(events.metadataURIOf(eventId), "ipfs://event-metadata");
        IEventRegistry.Policy memory p = events.policyOf(eventId);
        assertEq(p.priceCapBps, 15_000);
        assertEq(p.maxTransfers, 3);
        assertFalse(events.isCancelled(eventId));
        assertEq(_createEvent(), 2);
    }

    function test_RevertWhen_NonIssuerCreatesEvent() public {
        IEventRegistry.Policy memory p = _policy();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, events.ISSUER_ROLE()
            )
        );
        vm.prank(stranger);
        events.createEvent(p, "x");
    }

    function test_RevertWhen_ResaleAllowedWithoutCap() public {
        IEventRegistry.Policy memory p = _policy();
        p.priceCapBps = 0;
        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(issuer);
        events.createEvent(p, "x");
    }

    function test_RevertWhen_TransferDeadlineInPast() public {
        IEventRegistry.Policy memory p = _policy();
        p.transferDeadline = uint64(block.timestamp);
        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(issuer);
        events.createEvent(p, "x");
    }

    function test_RemovedIssuerCannotCreateEvent() public {
        vm.prank(admin);
        events.removeIssuer(issuer);
        IEventRegistry.Policy memory p = _policy();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, issuer, events.ISSUER_ROLE())
        );
        vm.prank(issuer);
        events.createEvent(p, "x");
    }

    function test_AdminCancelsEvent() public {
        uint256 eventId = _createEvent();
        vm.expectEmit(true, false, false, true, address(events));
        emit IEventRegistry.EventCancelled(eventId, "organizer_request");
        vm.prank(admin);
        events.cancelEvent(eventId, "organizer_request");
        assertTrue(events.isCancelled(eventId));
    }

    function test_RevertWhen_CancelTwice() public {
        uint256 eventId = _createEvent();
        vm.startPrank(admin);
        events.cancelEvent(eventId, "r");
        vm.expectRevert(abi.encodeWithSelector(EventAlreadyCancelled.selector, eventId));
        events.cancelEvent(eventId, "r");
        vm.stopPrank();
    }

    /// Tách nhiệm vụ (PRODUCT_CONTEXT 2.3.4): issuer không tự hủy sự kiện, phải qua platform_admin.
    function test_RevertWhen_IssuerCancelsEvent() public {
        uint256 eventId = _createEvent();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, issuer, events.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(issuer);
        events.cancelEvent(eventId, "r");
    }

    function test_RevertWhen_EventNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(EventNotFound.selector, 42));
        events.issuerOf(42);
        vm.expectRevert(abi.encodeWithSelector(EventNotFound.selector, 42));
        vm.prank(admin);
        events.cancelEvent(42, "r");
        assertFalse(events.exists(42));
    }
}
