// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

/// @notice Test khung: xác nhận Foundry + forge-std chạy được trên CI (TIC-27/TIC-28).
/// Xóa khi đã có test thật của EventRegistry/TicketRegistry (Sprint 1).
contract ScaffoldTest is Test {
    function test_ToolchainWorks() public pure {
        assertEq(uint256(1) + 1, 2);
    }
}
