// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ITicketRegistry
/// @notice Vé ERC-721 khóa chuyển tự do. Chỉ mint hoặc escrow được đổi chủ. PIPELINE mục 3–4.
interface ITicketRegistry {
    /// @dev `None` = chưa tồn tại. `Used`, `Revoked`, `Void` là trạng thái cuối.
    ///      `Void` không lưu riêng từng vé: mọi vé (trừ `Revoked`) của sự kiện đã hủy đọc ra là `Void`.
    enum Status {
        None,
        Active,
        Listed,
        Used,
        Revoked,
        Void
    }

    struct Ticket {
        uint256 eventId;
        /// Giá cơ bản theo đơn vị nhỏ nhất, dùng tính trần bán lại.
        uint256 faceValue;
        uint8 transferCount;
        Status status;
    }

    event TicketIssued(uint256 indexed id, uint256 indexed eventId, address to);
    event TicketTransferred(uint256 indexed id, address from, address to, uint8 transferCount);
    event TicketListed(uint256 indexed id, bool listed);
    event TicketUsed(uint256 indexed id);
    event TicketRevoked(uint256 indexed id, bytes32 reason);

    function batchIssue(uint256 eventId, address[] calldata to, uint256[] calldata faceValue)
        external
        returns (uint256 firstId);
    function setListed(uint256 id, bool listed) external;
    function escrowTransfer(uint256 id, address from, address to) external;
    function markUsed(uint256 id) external;
    function revoke(uint256 id, bytes32 reason) external;

    function statusOf(uint256 id) external view returns (Status);
    function ticketOf(uint256 id) external view returns (Ticket memory);
}
