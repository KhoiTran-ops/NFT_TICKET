// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IEventRegistry
/// @notice Đăng ký sự kiện và issuer (ban tổ chức) on-chain. PIPELINE mục 4, PRODUCT_CONTEXT 2.4.
interface IEventRegistry {
    /// @notice Chính sách bán lại của sự kiện.
    /// @dev Giá trị cụ thể (tỷ lệ trần, số lần chuyển, hạn chót) chưa chốt (DECISIONS "Đang mở", NFT-07):
    ///      issuer truyền vào khi tạo sự kiện, contract chỉ kiểm tra tối thiểu.
    struct Policy {
        bool resaleAllowed;
        /// Trần giá bán lại theo basis point của giá cơ bản (15000 = 150%).
        uint96 priceCapBps;
        /// Số lần chuyển nhượng tối đa mỗi vé.
        uint8 maxTransfers;
        /// Hạn chót chuyển nhượng (unix time). 0 = không giới hạn.
        uint64 transferDeadline;
    }

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event EventCreated(uint256 indexed eventId, address indexed issuer, string metadataURI);
    event EventCancelled(uint256 indexed eventId, bytes32 reason);

    function addIssuer(address issuer) external;
    function removeIssuer(address issuer) external;
    function createEvent(Policy calldata policy, string calldata metadataURI) external returns (uint256 eventId);
    function cancelEvent(uint256 eventId, bytes32 reason) external;

    function exists(uint256 eventId) external view returns (bool);
    function isIssuer(address account) external view returns (bool);
    function issuerOf(uint256 eventId) external view returns (address);
    function policyOf(uint256 eventId) external view returns (Policy memory);
    function isCancelled(uint256 eventId) external view returns (bool);
}
