// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IEventRegistry} from "./interfaces/IEventRegistry.sol";
import {ZeroAddress, InvalidPolicy, EventNotFound, EventAlreadyCancelled} from "./libraries/Errors.sol";

/// @title EventRegistry
/// @notice Quản lý issuer và sự kiện on-chain.
/// @dev Quyền (PRODUCT_CONTEXT 2.4):
///      - `DEFAULT_ADMIN_ROLE` (ví nền tảng): thêm/bớt issuer, hủy sự kiện.
///      - `ISSUER_ROLE` (ví ban tổ chức, cấp khi KYB được duyệt): tạo sự kiện.
///      `cancelEvent` để admin gọi (relayer của nền tảng, sau khi `platform_admin` duyệt) để giữ tách nhiệm vụ
///      2.3.4 on-chain. PRODUCT_CONTEXT 2.4 ghi `cancelEvent` thuộc ISSUER_ROLE — mâu thuẫn, xem worklog lead.
contract EventRegistry is AccessControl, IEventRegistry {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct EventData {
        address issuer;
        bool cancelled;
        Policy policy;
        string metadataURI;
    }

    /// @notice ID sự kiện kế tiếp (bắt đầu từ 1; 0 = không tồn tại).
    uint256 public nextEventId = 1;

    mapping(uint256 eventId => EventData) private _events;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ------------------------------------------------------------------ admin

    function addIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (issuer == address(0)) revert ZeroAddress();
        if (_grantRole(ISSUER_ROLE, issuer)) emit IssuerAdded(issuer);
    }

    /// @dev Issuer bị gỡ không tạo sự kiện / phát hành vé mới được; sự kiện cũ vẫn giữ `issuerOf`.
    function removeIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_revokeRole(ISSUER_ROLE, issuer)) emit IssuerRemoved(issuer);
    }

    /// @notice Hủy sự kiện. Mọi vé (trừ đã thu hồi) chuyển `Void`; hoàn tiền xử lý ở escrow/backend.
    function cancelEvent(uint256 eventId, bytes32 reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        EventData storage e = _get(eventId);
        if (e.cancelled) revert EventAlreadyCancelled(eventId);
        e.cancelled = true;
        emit EventCancelled(eventId, reason);
    }

    // ----------------------------------------------------------------- issuer

    function createEvent(Policy calldata policy, string calldata metadataURI)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 eventId)
    {
        if (policy.resaleAllowed && policy.priceCapBps == 0) revert InvalidPolicy();
        // forge-lint: disable-next-line(block-timestamp)
        if (policy.transferDeadline != 0 && policy.transferDeadline <= block.timestamp) revert InvalidPolicy();

        eventId = nextEventId++;
        EventData storage e = _events[eventId];
        e.issuer = msg.sender;
        e.policy = policy;
        e.metadataURI = metadataURI;
        emit EventCreated(eventId, msg.sender, metadataURI);
    }

    // ------------------------------------------------------------------ views

    function exists(uint256 eventId) public view returns (bool) {
        return _events[eventId].issuer != address(0);
    }

    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    function issuerOf(uint256 eventId) external view returns (address) {
        return _get(eventId).issuer;
    }

    function policyOf(uint256 eventId) external view returns (Policy memory) {
        return _get(eventId).policy;
    }

    function isCancelled(uint256 eventId) external view returns (bool) {
        return _get(eventId).cancelled;
    }

    function metadataURIOf(uint256 eventId) external view returns (string memory) {
        return _get(eventId).metadataURI;
    }

    // --------------------------------------------------------------- internal

    function _get(uint256 eventId) private view returns (EventData storage e) {
        e = _events[eventId];
        if (e.issuer == address(0)) revert EventNotFound(eventId);
    }
}
