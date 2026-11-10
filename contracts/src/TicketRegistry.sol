// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IEventRegistry} from "./interfaces/IEventRegistry.sol";
import {ITicketRegistry} from "./interfaces/ITicketRegistry.sol";
import {
    ZeroAddress,
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
} from "./libraries/Errors.sol";

/// @title TicketRegistry
/// @notice Vé NFT (ERC-721). Không chuyển tự do: chỉ mint (issuer) và `escrowTransfer` (ESCROW_ROLE) đổi chủ.
/// @dev Quyền (PRODUCT_CONTEXT 2.4):
///      - issuer của sự kiện: `batchIssue`, `revoke`.
///      - `SCANNER_ROLE` (ví relayer backend, không phát cho nhân sự cổng): `markUsed`.
///      - `ESCROW_ROLE` (contract ResaleEscrow, Sprint 3): `setListed`, `escrowTransfer`.
///      Vé không chứa dữ liệu cá nhân; metadata công khai không có PII (PRODUCT_CONTEXT 6).
contract TicketRegistry is ERC721, AccessControl, ITicketRegistry {
    bytes32 public constant SCANNER_ROLE = keccak256("SCANNER_ROLE");
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    IEventRegistry public immutable eventRegistry;

    /// @notice ID vé kế tiếp (bắt đầu từ 1).
    uint256 public nextTicketId = 1;

    mapping(uint256 id => Ticket) private _tickets;

    /// @dev Bật trong `escrowTransfer` để `_update` cho phép đổi chủ.
    bool private _escrowTransferring;

    constructor(address admin, IEventRegistry registry) ERC721("NFT Ticket", "NFTT") {
        if (admin == address(0) || address(registry) == address(0)) revert ZeroAddress();
        eventRegistry = registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ----------------------------------------------------------------- issuer

    /// @notice Phát hành vé cho danh sách người nhận (sau khi thanh toán sơ cấp thành công).
    function batchIssue(uint256 eventId, address[] calldata to, uint256[] calldata faceValue)
        external
        returns (uint256 firstId)
    {
        if (to.length == 0) revert EmptyBatch();
        if (to.length != faceValue.length) revert LengthMismatch();
        _requireEventIssuer(eventId);
        if (eventRegistry.isCancelled(eventId)) revert EventIsCancelled(eventId);

        firstId = nextTicketId;
        for (uint256 i = 0; i < to.length; ++i) {
            uint256 id = nextTicketId++;
            _tickets[id] = Ticket({eventId: eventId, faceValue: faceValue[i], transferCount: 0, status: Status.Active});
            // _mint thay vì _safeMint: không gọi ra ngoài (tránh reentrancy), người nhận là ví EOA/custodial.
            _mint(to[i], id);
            emit TicketIssued(id, eventId, to[i]);
        }
    }

    /// @notice Issuer thu hồi một vé gian lận. Không thu hồi được vé đang rao (Listed).
    function revoke(uint256 id, bytes32 reason) external {
        Ticket storage t = _require(id);
        _requireEventIssuer(t.eventId);
        _requireNotCancelled(t.eventId);
        _requireStatus(id, t, Status.Active);
        t.status = Status.Revoked;
        emit TicketRevoked(id, reason);
    }

    // ---------------------------------------------------------------- scanner

    /// @notice Đánh dấu vé đã dùng sau khi backend check-in (nguyên tử ở DB, on-chain cập nhật sau).
    function markUsed(uint256 id) external onlyRole(SCANNER_ROLE) {
        Ticket storage t = _require(id);
        _requireNotCancelled(t.eventId);
        _requireStatus(id, t, Status.Active);
        t.status = Status.Used;
        emit TicketUsed(id);
    }

    // ----------------------------------------------------------------- escrow

    /// @notice Khóa (Active → Listed) hoặc mở khóa (Listed → Active) vé khi rao/hủy rao.
    function setListed(uint256 id, bool listed) external onlyRole(ESCROW_ROLE) {
        Ticket storage t = _require(id);
        _requireNotCancelled(t.eventId);
        if (listed) {
            _requireStatus(id, t, Status.Active);
            t.status = Status.Listed;
        } else {
            _requireStatus(id, t, Status.Listed);
            t.status = Status.Active;
        }
        emit TicketListed(id, listed);
    }

    /// @notice Chuyển vé đang rao sang người mua/người thắng. Vé về `Active`, `transferCount` tăng.
    function escrowTransfer(uint256 id, address from, address to) external onlyRole(ESCROW_ROLE) {
        Ticket storage t = _require(id);
        uint256 eventId = t.eventId;
        _requireNotCancelled(eventId);
        _requireStatus(id, t, Status.Listed);
        if (to == address(0)) revert ZeroAddress();
        if (_ownerOf(id) != from) revert NotTicketOwner(id, from);

        IEventRegistry.Policy memory p = eventRegistry.policyOf(eventId);
        if (!p.resaleAllowed) revert ResaleNotAllowed(eventId);
        if (p.transferDeadline != 0 && block.timestamp >= p.transferDeadline) revert TransferDeadlinePassed(eventId);
        if (t.transferCount >= p.maxTransfers) revert MaxTransfersReached(id);

        // Ban tổ chức không giao dịch vé sự kiện của mình (PRODUCT_CONTEXT 2.3.4).
        // Không chặn được issuer dùng ví khác — backend kiểm tra thêm theo tài khoản.
        address issuer = eventRegistry.issuerOf(eventId);
        if (to == issuer) revert IssuerCannotTrade(eventId, to);
        if (from == issuer) revert IssuerCannotTrade(eventId, from);

        t.transferCount += 1;
        t.status = Status.Active;

        _escrowTransferring = true;
        _transfer(from, to, id);
        _escrowTransferring = false;

        emit TicketTransferred(id, from, to, t.transferCount);
    }

    // ------------------------------------------------------------------ views

    function statusOf(uint256 id) public view returns (Status) {
        Ticket storage t = _tickets[id];
        if (t.status == Status.None) revert TicketNotFound(id);
        if (t.status != Status.Revoked && eventRegistry.isCancelled(t.eventId)) return Status.Void;
        return t.status;
    }

    function ticketOf(uint256 id) external view returns (Ticket memory ticket) {
        ticket = _tickets[id];
        ticket.status = statusOf(id);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    // --------------------------------------------------------------- internal

    /// @dev Chặn mọi chuyển nhượng ERC-721 trực tiếp (transferFrom/safeTransferFrom).
    ///      Chỉ cho mint (from = 0) và chuyển qua `escrowTransfer`. Không có burn.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && !_escrowTransferring) revert TransferRestricted();
        return super._update(to, tokenId, auth);
    }

    function _require(uint256 id) private view returns (Ticket storage t) {
        t = _tickets[id];
        if (t.status == Status.None) revert TicketNotFound(id);
    }

    function _requireEventIssuer(uint256 eventId) private view {
        // issuerOf revert EventNotFound nếu sự kiện không tồn tại.
        if (eventRegistry.issuerOf(eventId) != msg.sender || !eventRegistry.isIssuer(msg.sender)) {
            revert NotEventIssuer(eventId, msg.sender);
        }
    }

    function _requireNotCancelled(uint256 eventId) private view {
        if (eventRegistry.isCancelled(eventId)) revert EventIsCancelled(eventId);
    }

    function _requireStatus(uint256 id, Ticket storage t, Status expected) private view {
        if (t.status != expected) revert InvalidTicketStatus(id, uint8(t.status));
    }
}
