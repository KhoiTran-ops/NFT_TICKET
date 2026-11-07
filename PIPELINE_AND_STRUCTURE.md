# Encore / Vé Lại — Pipeline & Cấu trúc dự án

> Dựa trên `IDEA_CONCERT_TICKET_P2P.md`. Đây là đề xuất kỹ thuật cho MVP hackathon trên **Avalanche Fuji (C-Chain)**.
> Các lựa chọn stack bên dưới là mặc định hợp lý, đội có thể thay (ví dụ Hardhat thay Foundry) mà không ảnh hưởng kiến trúc.

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────── Frontend (Next.js) ────────────────────────────┐
│  /market   /my-tickets        /issuer (Nhà phát hành)     /scanner (Soát vé)│
└───────┬─────────────────────────────┬──────────────────────────────┬──────┘
        │ REST / WebSocket            │ đọc trạng thái (viem)        │ quét QR động
┌───────▼─────────────────────────────▼──────────────────────────────▼──────┐
│                         Backend (Node + TypeScript)                        │
│  Auth (email OTP) · Wallet/Relayer (trả gas) · QR Service (mã 30s, ký HMAC)│
│  Check-in Service (khóa nguyên tử) · Indexer (nghe event contract)         │
│  DB off-chain: PII, user↔wallet, gate token, cache trạng thái vé           │
└───────┬───────────────────────────────────────────────────────────────────┘
        │ ethers/viem (relayer ký tx)
┌───────▼──────────────── Avalanche Fuji C-Chain (Solidity) ─────────────────┐
│  EventRegistry  ──►  TicketRegistry (ERC-721 khóa chuyển tự do)            │
│                          ▲                                                  │
│  ResaleEscrow  ──────────┘  (chỉ escrow được chuyển vé)   MockStable (ERC20)│
└────────────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc phân tách:**

| Ở trên chain | Ở off-chain (backend/DB) |
|---|---|
| Chủ sở hữu vé, trạng thái vé, số lần đã chuyển | Email, SĐT, tên, CCCD |
| Chính sách resale (giá trần, số lần, hạn chót) | Mã QR vào cổng đang hoạt động |
| Listing, escrow, giải ngân, hoàn tiền | Khóa ví custodial (mã hóa) — chỉ cho demo |
| Lịch sử phát hành / chuyển / thu hồi / sử dụng (event) | Cache đọc nhanh cho UI |

---

## 2. Pipeline nghiệp vụ (end-to-end)

### 2.1 Phát hành vé gốc

```
Platform admin ──addIssuer()──► EventRegistry
Issuer ──createEvent(policy)──► EventRegistry      policy = {resaleAllowed, priceCap, maxTransfers, transferDeadline}
Issuer ──batchIssue(eventId, owners[], faceValues[])──► TicketRegistry  → status = Active
Backend Indexer nghe TicketIssued → cập nhật DB → hiện vé trong /my-tickets
```

### 2.2 Đăng bán & mua resale

```
A (seller) ──list(ticketId, price, expiry)──► ResaleEscrow
   contract kiểm tra: A là owner · vé Active · chưa Listed · price ≤ priceCap
                      · transferCount < maxTransfers · now < transferDeadline · A không phải issuer
   → TicketRegistry.status = Listed (khóa vé, không list/chuyển song song được)

B (buyer) ──approve(stable) + buy(listingId)──► ResaleEscrow
   contract: kéo tiền của B → chuyển vé A→B → status = Active, transferCount++
             → trả A (price − fee), phí vào treasury — TẤT CẢ trong 1 giao dịch
   → emit TicketTransferred → Backend vô hiệu mọi gate token cũ của A

Nhánh lỗi:
   - B2 mua cùng lúc → tx thứ hai revert (listing không còn Open)       [demo #5]
   - Listing hết hạn / A hủy → cancel() → vé về Active
   - Giá vượt trần → list() revert "PriceAboveCap"                       [demo #2]
```

> **Quyết định thiết kế:** mua theo kiểu *atomic swap 1 giao dịch* thay vì escrow 2 bước. An toàn hơn (không có trạng thái treo) và đơn giản hơn. Nếu đội muốn demo "hoàn tiền khi hết hạn", thêm chế độ tùy chọn `commitBuy()` → `finalize()` trước `deadline`, nếu không thì `refund()`. Khuyến nghị: làm atomic trước, 2 bước là stretch goal.

### 2.3 Vào cổng

```
B mở /my-tickets → backend tạo gate token: {ticketId, owner, nonce, exp = now+30s} ký HMAC
   (chỉ cấp nếu owner on-chain == ví của B và status == Active)
QR tự làm mới mỗi ~20s.

Scanner quét → POST /checkin
   1. Kiểm chữ ký + exp + nonce chưa dùng
   2. Đối chiếu owner on-chain (hoặc cache đã đồng bộ) == owner trong token
   3. UPDATE tickets SET used=true WHERE id=? AND used=false   ← nguyên tử, chống 2 cổng
   4. Relayer gọi TicketRegistry.markUsed(ticketId) (async) → status = Used
   → trả ✅ / ❌ (lý do: hết hạn, đã dùng, không còn là chủ, bị thu hồi)
```

### 2.4 Thu hồi (quyền hạn chế của issuer)

```
Issuer ──revoke(ticketId, reasonCode)──► TicketRegistry   (chỉ khi vé không Listed; có reasonCode + event)
Issuer ──cancelEvent(eventId)──► EventRegistry → mọi listing mở bị hủy, người mua đang chờ nhận lại tiền
```

---

## 3. State machine

### Vé (`TicketRegistry`)

```
          issue()
   ∅ ───────────────► Active ◄──────────── cancel()/expire ───┐
                       │  │                                    │
              markUsed │  │ list()                             │
                       ▼  ▼                                    │
                     Used  Listed ─────────────────────────────┘
                              │ buy()  → Active (owner mới, transferCount++)
   Active/Listed ── revoke() ──► Revoked     (Used và Revoked là trạng thái cuối)
```

### Listing (`ResaleEscrow`)

`Open → Sold` · `Open → Cancelled` (seller hủy / event bị hủy) · `Open → Expired` (quá `expiry`)

---

## 4. Smart contract — interface đề xuất

```solidity
// EventRegistry.sol
function addIssuer(address issuer) external onlyAdmin;
function createEvent(Policy calldata p, string calldata metadataURI) external onlyIssuer returns (uint256 eventId);
function setScanner(uint256 eventId, address scanner, bool ok) external onlyEventIssuer(eventId);
function cancelEvent(uint256 eventId, bytes32 reason) external onlyEventIssuer(eventId);
struct Policy { bool resaleAllowed; uint96 priceCapBps; uint8 maxTransfers; uint64 transferDeadline; }

// TicketRegistry.sol  (ERC-721, override _update: chỉ cho mint, burn hoặc ESCROW chuyển)
function batchIssue(uint256 eventId, address[] calldata to, uint256[] calldata faceValue) external;
function setListed(uint256 id, bool listed) external onlyEscrow;
function escrowTransfer(uint256 id, address from, address to) external onlyEscrow;
function markUsed(uint256 id) external onlyScanner;
function revoke(uint256 id, bytes32 reason) external onlyEventIssuer;
event TicketIssued(uint256 indexed id, uint256 indexed eventId, address to);
event TicketTransferred(uint256 indexed id, address from, address to, uint8 transferCount);
event TicketUsed(uint256 indexed id); event TicketRevoked(uint256 indexed id, bytes32 reason);

// ResaleEscrow.sol  (ReentrancyGuard, SafeERC20)
function list(uint256 ticketId, uint256 price, uint64 expiry) external returns (uint256 listingId);
function cancel(uint256 listingId) external;
function buy(uint256 listingId) external;          // atomic swap
function expire(uint256 listingId) external;       // ai cũng gọi được sau expiry
event Listed(...); event Sold(...); event ListingCancelled(...);
```

**Ràng buộc quyền (mục 4 của brief):** issuer **không** có hàm nào để list/buy/đổi giá/chuyển vé người khác/rút escrow; `list()` và `buy()` có `require(!eventRegistry.isIssuer(msg.sender))`. Ghi rõ trong README là ràng buộc này không chặn được issuer dùng ví khác.

**Test bắt buộc (Foundry):** giá vượt trần, quá số lần chuyển, quá hạn chót, hai người mua cùng listing, issuer cố list/buy, chuyển ERC-721 trực tiếp bị chặn, reentrancy khi buy, revoke vé đang Listed, markUsed bởi ví không phải scanner. Thêm fuzz test cho `price`/`fee`.

---

## 5. Cấu trúc thư mục (monorepo)

```
Team1_hackathon/
├── IDEA_CONCERT_TICKET_P2P.md
├── PIPELINE_AND_STRUCTURE.md
├── README.md                      # cách chạy, link contract trên Snowtrace/Fuji, giới hạn đã biết
├── package.json                   # pnpm workspaces
├── pnpm-workspace.yaml
├── .env.example
├── .github/workflows/
│   ├── contracts.yml              # forge fmt --check, forge build, forge test
│   └── apps.yml                   # lint + typecheck + build frontend/backend
│
├── contracts/                     # Foundry
│   ├── foundry.toml               # solc 0.8.24; evm_version kiểm tra theo docs Avalanche hiện hành
│   ├── src/
│   │   ├── EventRegistry.sol
│   │   ├── TicketRegistry.sol
│   │   ├── ResaleEscrow.sol
│   │   ├── mocks/MockStable.sol   # token thanh toán demo, có faucet
│   │   └── libraries/Errors.sol
│   ├── test/
│   │   ├── EventRegistry.t.sol
│   │   ├── TicketRegistry.t.sol
│   │   ├── ResaleEscrow.t.sol
│   │   └── e2e/DemoScenario.t.sol # chạy đúng 6 bước demo
│   ├── script/
│   │   ├── Deploy.s.sol           # deploy + nối địa chỉ các contract
│   │   └── SeedDemo.s.sol         # 1 issuer, 1 event, ~30 vé, ví A/B, scanner
│   └── deployments/fuji.json      # địa chỉ đã deploy (frontend/backend đọc file này)
│
├── packages/
│   └── shared/                    # dùng chung FE + BE
│       ├── abi/                   # ABI export tự động từ contracts/out
│       ├── src/addresses.ts
│       ├── src/types.ts           # TicketStatus, ListingStatus, Policy
│       └── src/chain.ts           # cấu hình Fuji (chainId 43113, RPC)
│
├── backend/                       # Node + TS (Fastify/NestJS) + Prisma
│   ├── prisma/schema.prisma       # User, Wallet, TicketCache, GateToken, CheckIn, IndexerCursor
│   ├── src/
│   │   ├── main.ts
│   │   ├── config/
│   │   ├── modules/
│   │   │   ├── auth/              # email OTP → JWT
│   │   │   ├── wallet/            # ví custodial demo (khóa mã hóa) / hoặc liên kết ví ngoài
│   │   │   ├── relayer/           # gửi tx thay user, trả gas AVAX
│   │   │   ├── tickets/           # đọc vé, list, buy (gọi relayer)
│   │   │   ├── issuer/            # tạo event, phát hành, revoke
│   │   │   ├── gate/              # tạo QR động (HMAC, 30s, nonce)
│   │   │   └── checkin/           # xác thực + khóa nguyên tử + markUsed
│   │   ├── indexer/               # nghe event contract → cập nhật TicketCache, hủy gate token cũ
│   │   └── lib/chain.ts
│   └── test/
│
├── frontend/                      # Next.js (App Router) + Tailwind + wagmi/viem
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── market/                # danh sách listing, chi tiết, mua
│   │   ├── my-tickets/            # vé của tôi, đăng bán, hiện QR động
│   │   ├── issuer/                # tạo event, cấu hình policy, phát hành, revoke
│   │   ├── scanner/               # camera quét QR, kết quả ✅/❌
│   │   └── verify/[ticketId]/     # trang công khai: nguồn gốc + lịch sử + link explorer
│   ├── components/
│   ├── hooks/
│   └── lib/api.ts
│
└── docs/
    ├── demo-script.md             # kịch bản 6 bước + câu nói khi pitch
    ├── threat-model.md
    ├── interview-guide.md         # câu hỏi phỏng vấn người mua/bán/issuer (mục 9 brief)
    └── architecture.png
```

---

## 6. Pipeline phát triển (theo giai đoạn)

Giả định hackathon ~48 giờ, đội 4 người: **SC** (smart contract), **BE** (backend), **FE** (frontend), **PM/Pitch** (research, demo, slide). Điều chỉnh mốc giờ theo thời lượng thực tế.

| Giai đoạn | Mốc | Việc | Đầu ra / Định nghĩa xong |
|---|---|---|---|
| **0. Chốt thiết kế** | 0–3h | Chốt interface contract (mục 4), schema DB, API contract, wireframe 4 màn | `packages/shared/types.ts` + OpenAPI nháp; mọi người code song song được |
| **1. Contract lõi** | 3–14h | SC: 3 contract + MockStable + test đầy đủ | `forge test` xanh, coverage các nhánh lỗi |
| | | BE: auth, Prisma, khung module, mock chain | API chạy với dữ liệu giả |
| | | FE: UI 4 màn với mock API | Click qua được toàn bộ flow |
| | | PM: phỏng vấn người dùng, khảo sát official resale | Ghi chép trong `docs/` |
| **2. Deploy & tích hợp** | 14–26h | SC: deploy Fuji, `SeedDemo`, export ABI | `deployments/fuji.json`, verify trên explorer |
| | | BE: relayer, indexer, list/buy thật | Mua vé thật trên Fuji qua API |
| | | FE: nối API thật, trang verify | Flow A bán → B mua chạy end-to-end |
| **3. Vào cổng** | 26–34h | BE: gate token + check-in nguyên tử + markUsed | Quét lại / mã cũ của A bị từ chối |
| | | FE: QR động, scanner bằng camera | Demo bằng 2 điện thoại |
| **4. Cứng hóa** | 34–42h | Kịch bản lỗi: giá vượt trần, mua đồng thời, hết hạn, issuer cố giao dịch | `DemoScenario.t.sol` + chạy tay trên Fuji |
| **5. Demo & pitch** | 42–48h | Quay video dự phòng, slide, README, chạy thử 3 lần | Demo < 5 phút, không phụ thuộc mạng yếu |

**Stretch goals (chỉ làm khi xong giai đoạn 4):** escrow 2 bước có hoàn tiền; embedded wallet (Privy/thirdweb/Web3Auth) thay ví custodial; ERC-2771 meta-tx; trang thống kê pilot (mục 11 brief).

---

## 7. Pipeline CI/CD

```
push / PR
  ├─ contracts.yml : forge fmt --check → forge build → forge test -vv (+ gas report)
  └─ apps.yml      : pnpm install → lint → typecheck → build backend & frontend

merge vào main
  ├─ (thủ công) forge script Deploy.s.sol --rpc-url fuji --broadcast --verify
  │      → commit deployments/fuji.json → script copy ABI sang packages/shared
  ├─ frontend → Vercel (preview mỗi PR)
  └─ backend  → Render/Railway (Postgres managed) hoặc chạy local + ngrok khi demo
```

Biến môi trường (`.env.example`): `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `GATE_HMAC_SECRET`, `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL`. Không commit khóa; ví deployer/relayer chỉ chứa AVAX testnet từ faucet.

---

## 8. Ánh xạ kịch bản demo ↔ thành phần

| Bước demo (mục 8 brief) | Contract / hàm | Màn hình |
|---|---|---|
| 1. Issuer tạo event, phát hành, đặt cap | `createEvent`, `batchIssue` | `/issuer` |
| 2. A list giá hợp lệ; thử vượt trần bị từ chối | `list` → revert `PriceAboveCap` | `/my-tickets` |
| 3. B mua; vé A mất hiệu lực | `buy` (atomic) | `/market` |
| 4. B quét thành công; quét lại / mã cũ A bị từ chối | backend `checkin` + `markUsed` | `/scanner` |
| 5. Hai người mua cùng lúc / listing hết hạn | tx thứ 2 revert; `expire` | 2 trình duyệt song song |
| 6. Xem tx trên explorer Fuji | event log | `/verify/[ticketId]` |

---

## 9. Rủi ro kỹ thuật cần theo dõi

- **Nguồn sự thật khi check-in:** DB khóa nguyên tử nhanh hơn chain; chain được cập nhật sau qua `markUsed`. Nếu tx `markUsed` lỗi, cần retry queue — ghi rõ trong threat model.
- **Ví custodial là demo-only:** nói thẳng khi pitch; hướng sản phẩm thật là embedded/smart wallet.
- **Indexer lệch trạng thái:** UI luôn đọc lại owner on-chain trước khi cấp gate token, không tin hoàn toàn vào cache.
- **Phụ thuộc mạng khi demo:** chuẩn bị video quay sẵn và ví đã nạp đủ AVAX testnet + MockStable.
