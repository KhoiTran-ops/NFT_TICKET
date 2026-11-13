// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Lỗi dùng chung cho EventRegistry và TicketRegistry (custom error, rẻ gas hơn chuỗi revert).

error ZeroAddress();
error InvalidPolicy();
error EventNotFound(uint256 eventId);
error EventAlreadyCancelled(uint256 eventId);
error EventIsCancelled(uint256 eventId);
error NotEventIssuer(uint256 eventId, address caller);
error LengthMismatch();
error EmptyBatch();
error TicketNotFound(uint256 ticketId);
/// @param status giá trị `ITicketRegistry.Status` hiện tại (ép kiểu uint8)
error InvalidTicketStatus(uint256 ticketId, uint8 status);
error TransferRestricted();
error NotTicketOwner(uint256 ticketId, address account);
error ResaleNotAllowed(uint256 eventId);
error TransferDeadlinePassed(uint256 eventId);
error MaxTransfersReached(uint256 ticketId);
error IssuerCannotTrade(uint256 eventId, address account);
