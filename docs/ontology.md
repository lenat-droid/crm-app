# CRM Ontology — Proton 餐飲科技客戶關係管理

> 領域：美國餐飲科技軟體銷售 CRM
> 目標用戶：10+ 人銷售團隊（中/英文），管理 400,000+ 餐廳客戶
> 產品線：POS 收銀、PS 官網建置、SMT、AI Cam、平台托管、OME、智能機器人
> 版本: v2.0 (Phase 1-2 完成)
> 最後更新: 2026-06-04

---

## 1. 領域總覽（Domain Overview）

本 CRM 為一家面向美國中式/亞洲餐廳的餐飲科技公司設計，核心業務是管理從**線索獲取 → 銷售跟進 → 產品售出 → 售後服務 → 健康度監控**的完整生命周期。

與通用 CRM 的關鍵差異：
1. **產品興趣矩陣**：每個客戶對 7 條產品線各有獨立的 6 級興趣程度，而非單一的商機狀態
2. **Pipeline 1:1**：一個客戶最多一條活躍銷售管道，成交歸檔後關閉
3. **動態產品目錄**：產品從硬編碼改為 ProductCatalog 動態管理，前端自動適配
4. **SaaS 核心指標**：訂閱管理（MRR/續約/流失）是系統核心能力
5. **健康度評分**：4 維度加權計算，主動預警高流失風險客戶
6. **匿名分享機制**：UUID shareToken 支援免登錄的公眾頁面（速報 / 線索登記）

---

## 2. 實體類別（Entity Taxonomy）

### 2.1 核心實體總覽

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User (用戶 / 銷售人員)                        │
│   角色: ADMIN / SALES_MGR / SALES  |  可產生 shareToken 匿名分享     │
└─────────┬───────────────────────────────────────────────────────────┘
           │
     ┌─────┼──────────┬──────────────┬──────────────┬──────────────┐
     │     │ 1         │ 0..*         │ 0..*          │ 0..*         │
     │跟進 │           │登記          │分配工單        │請求導出       │
     ▼     ▼           ▼              ▼              ▼
┌──────────┴──┐  ┌──────────┐  ┌──────────────┐  ┌───────────┐
│  Customer   │  │  Lead    │  │ SupportTicket│  │ ExportJob │
│  (客戶)     │◄─┤ (線索)   │  │ (客服工單)    │  │ (導出任務) │
│  400k+ 餐廳  │  │          │  └──────────────┘  └───────────┘
└──┬───┬───┬──┘  └──────────┘
   │   │   │         ▲
   │   │   │         │ PRODUCT_INTEREST (雙寫)
   │   │   │         │
   │   │   └─────────┼──────────────────┐
   │   │             │                  │
   │ 1 │ 1           │          ┌──────────────┐
   │   │             │          │ProductCatalog│
   │   ▼             │          │ (產品目錄)    │
   │ ┌────────┐      │          └──────┬───────┘
   │ │Pipeline│      │                 │
   │ │(1:1)   │      │                 │
   │ └───┬────┘      │                 │
   │     │ 1         │                 │
   │     ▼           │                 │
   │ ┌──────────┐    │    ┌────────────┐│
   │ │Comm-     │    │    │Subscription││
   │ │unication │    │    │ (訂閱)     │┘
   │ └──────────┘    │    └────────────┘
   │                 │         │
   │ 1:1             │    ┌────┴────┐
   ▼                 │    ▼         ▼
┌──────────┐         │ ┌──────────┐ ┌──────────────┐
│Merchant  │         │ │SignNowDoc│ │CustomerHealth│
│Profile   │         │ │(簽約文件) │ │Score (健康度)│
│(商家檔案) │         │ └──────────┘ └──────────────┘
└──────────┘         │
                     │
               ┌─────┴─────┐
               │  Visit /  │
               │ VisitLog  │
               │ (拜訪記錄) │
               └───────────┘
```

### 2.2 實體定義

---

#### User (用戶)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK, auto |
| email | String | 登錄郵箱 | Unique, required |
| name | String | 姓名 | required |
| password | String | bcrypt 加密 | required |
| role | String | 角色 | `ADMIN` / `SALES_MGR` / `SALES` |
| region | String? | 負責區域 | nullable |
| phone | String? | 電話 | nullable |
| active | Boolean | 是否啟用 | default true |
| shareToken | String? | 匿名分享 token | Unique, nullable |
| createdAt | DateTime | 創建時間 | auto |
| updatedAt | DateTime | 更新時間 | auto |

**業務規則**：
- `ADMIN` 可查看/修改所有數據；`SALES_MGR` 只能查看自己 region 內的數據；`SALES` 只能操作自己跟進的客戶
- `active=false` 的用戶無法登錄
- `shareToken` 用於匿名分享連結（每日速報 / 線索登記），通過 `/api/public/` 端點訪問
- 關聯：customers[], pipelines[], communications[], visits[], visitLogs[], leads[], subscriptions[], assignedTickets[], createdSegments[], exportJobs[], customerLogs[]

---

#### Customer (客戶)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| sapId | String? | SAP 系統 ID | nullable |
| name | String | 餐廳名稱 | required |
| city | String? | 所在城市 | |
| region | String? | 業務區域劃分 | 受控詞表 |
| address | String? | 地址 | |
| area | String? | 片區 | |
| storePhone | String? | 店鋪電話 | |
| floorManager | String? | 樓面負責人 | |
| floorManagerPhone | String? | 樓面電話 | |
| merchantContact | String? | 商家負責人 | |
| merchantContactPhone | String? | 負責人電話 | |
| keyman | String? | Keyman | |
| website | String? | 官網 | |
| type | String? | 餐飲類型 | 受控詞表 |
| storeType | String? | 店鋪類型 | `單店` / `連鎖` |
| storeSize | String? | 店鋪規模 | |
| notes | String? | 備註 | |

**400k-scale 縱向擴展字段**：

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| status | String | 客戶狀態 | `ACTIVE` / `INACTIVE` / `ARCHIVED` (default ACTIVE) |
| tier | String | 客戶分層 | `ENTERPRISE` / `MID_MARKET` / `SMB` (default SMB) |
| source | String? | 數據來源 | `IMPORT` / `LEAD_CONVERSION` / `MANUAL` / `API` / `PARTNER` |
| onboardingStatus | String | 上線狀態 | `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED` |
| healthScore | Float? | 計算後健康度分數 | 0-100 |
| chatwootContactId | Int? | Chatwoot 對應聯繫人 ID | |
| firstPurchasedAt | DateTime? | 首次購買日期 | |
| lastActivityAt | DateTime? | 最近活動日期 | |

**產品興趣矩陣（7 個 denormalized 字段）**：
| 屬性 | 預設值 | 說明 |
|------|--------|------|
| posStatus | NOT_CONTACTED | POS 收銀系統 |
| psWebsiteStatus | NOT_CONTACTED | PS 官網建置 |
| smtStatus | NOT_CONTACTED | SMT 電話接單 |
| platformManagedStatus | NOT_CONTACTED | 平台托管 |
| aiCamStatus | NOT_CONTACTED | AI Cam |
| omeStatus | NOT_CONTACTED | OME |
| smartRobotStatus | NOT_CONTACTED | 智能機器人 |

**其他**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| contactStatus | String? | 整體接觸狀態：`合作中` / `已建联` / `已流失` |
| followerId | Int? | 跟進人 → User, nullable |
| createdAt | DateTime | 創建時間 |
| updatedAt | DateTime | 更新時間 |

**業務規則**：
- `contactStatus` 與 Pipeline 狀態自動同步（成交歸檔 → 合作中，流失 → 已流失）
- 一個客戶只能有一個跟進人（followerId）
- `source=ARCHIVED` 的客戶在默認列表中隱藏（軟刪除），可通過篩選顯示
- 7 個 denormalized 產品字段保留至 Phase 3，與 ProductInterest 新表雙寫並存
- 關聯：pipeline, productInterests[], subscriptions[], supportTickets[], healthScoreObj, visits[], visitLogs[], leads[], signNowDocuments[], customerLogs[]

---

#### Pipeline (銷售管道)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | Unique FK (1:1) |
| salesPersonId | Int? | 銷售 → User | FK |
| status | String | 管道階段 | `⚠️` / `已建联` / `初步有意向` / `合作中` |
| active | Boolean | 是否活躍 | default true；false 表示已歸檔/關閉 |
| closedAt | DateTime? | 關閉時間 | nullable |
| smt | String? | SMT 產品跟進備註 | |
| psWebsite | String? | PS 官網跟進備註 | |
| aiCam | String? | AI Cam 跟進備註 | |
| agencyManaged | String? | 平台托管跟進備註 | |
| lastContactDate | DateTime? | 最近聯繫日期 | |
| notes | String? | 備註 | |
| createdAt | DateTime | 創建時間 | |
| updatedAt | DateTime | 更新時間 | |

**業務規則**：
- Customer ↔ Pipeline 是 **1:1** 關係（一個客戶最多一條 active pipeline）
- Pipeline 狀態變更 → 自動同步 Customer.contactStatus
- Pipeline 關閉(`active=false`)時記錄 closedAt，關閉原因通過 closeReason 區分：WON(成交) / LOST(流失)
- 成交歸檔後彈出訂閱創建模態框
- 關聯：communications[]

---

#### Communication (溝通記錄)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| pipelineId | Int | 所屬管道 → Pipeline | FK |
| contactDate | DateTime | 聯繫日期 | |
| record | String | 溝通內容 | |
| contactOrder | Int | 第 N 次聯繫 | auto-increment per pipeline |
| createdById | Int? | 登記人 → User | FK |
| createdBy | User? | 登記人關係 | |
| createdAt | DateTime | 創建時間 | |

**業務規則**：
- `contactOrder` 在同一 Pipeline 內自動遞增
- 按 `contactOrder` 升序排列形成**溝通時間線**
- `createdBy` 在溝通記錄 UI 中顯示登記人姓名

---

#### Visit (拜訪記錄)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | FK |
| visitDate | DateTime | 拜訪日期 | |
| visitedById | Int? | 拜訪人 → User | FK |
| outcome | String? | 結果 | 受控詞表 |
| notes | String? | 備註 | |
| createdAt | DateTime | 創建時間 | |

**業務規則**：
- Visit 是輕量級拜訪記錄，與 Pipeline 無直接關聯
- 每次拜訪獨立記錄，用於統計拜訪頻率

---

#### VisitLog (詳細拜訪日誌)

| 屬性 | 類型 | 說明 |
|------|------|------|
| id | Int | 主鍵 |
| customerId | Int | 客戶 → Customer |
| visitDate | DateTime | 拜訪日期 |
| visitedById | Int? | 拜訪人 → User |
| restaurantNeeds | String? | 餐廳需求 |
| posBrand | String? | POS 品牌 |
| posMonthlyFee | String? | POS 月費 |
| posTransactionRate | String? | POS 交易費率 |
| posContractEnd | String? | POS 合約到期 |
| scanToOrder | Boolean | 是否支援掃碼點餐 |
| kiosk | Boolean | 是否有自助點餐機 |
| hasCameras | Boolean? | 是否有監控攝影機 |
| cameraPurpose | String? | 攝影機用途 |
| cameraMonthlyFee | String? | 攝影機月費 |
| dailyPhoneOrders | String? | 每日電話訂單數 |
| missedCalls | Boolean? | 是否漏接電話 |
| estimatedMissedCalls | String? | 估計漏接數 |
| biggestPainPoint | String? | 最大痛點 |
| otherNotes | String? | 其他備註 |
| posDevicePhoto | String? | POS 設備照片路徑 |
| menuBoardPhoto | String? | 菜單牌照片路徑 |

**業務規則**：
- VisitLog 是詳細版拜訪記錄，包含競品 POS 調研數據

---

#### Lead (線索)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int? | 轉化後關聯的客戶 | FK, nullable |
| name | String | 商家名稱 | required |
| phone | String? | 電話 | |
| contactPerson | String? | 聯繫人 | |
| foodType | String? | 餐飲類型 | |
| posBrand | String? | 當前 POS 品牌 | |
| needs | String? | 需求描述 | |
| status | String | 線索狀態 | `new` / `contacted` / `converted` / `closed` |
| source | String? | 線索來源 | `WEBSITE` / `REFERRAL` / `COLD_CALL` / `EVENT` / `PARTNER` / `OTHER` |
| score | Int? | 線索評分 | 0-100 (auto-calculated) |
| notes | String? | 備註 | |
| registeredById | Int? | 登記人 → User | FK |
| visitDate | DateTime? | 希望拜訪時間 | |
| createdAt | DateTime | 創建時間 | |
| updatedAt | DateTime | 更新時間 | |

**業務規則**：
- Lead → Customer 轉化在 **Prisma $transaction** 中原子執行：創建 Customer → 標記 Lead converted → 創建 Pipeline
- 轉化後 Lead 不再可編輯
- 公眾端 `/api/public/leads` 支援免登錄提交線索（透過 shareToken 認證），自動 REFERRAL 來源 + converted 狀態 + Customer/Pipeline 創建

---

#### ProductCatalog (產品目錄)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| key | String | 產品標識 key | Unique: `posStatus` / `smtStatus` 等 |
| name | String | 產品名稱 | `POS` / `SMT` 等 |
| category | String? | 產品類別 | `CORE` / `ADDON` / `SERVICE` / `HARDWARE` |
| active | Boolean | 是否啟用 | default true |
| sortOrder | Int | 排序 | default 0 |
| createdAt | DateTime | 創建時間 | |
| updatedAt | DateTime | 更新時間 | |

**業務規則**：
- 取代原有 7 個硬編碼產品字段，支援 Admin 動態管理產品線
- active=false 的產品不顯示在前端統計和下拉選單中
- 種子數據包含 7 個初始產品，key 對應 Customer 上的 denormalized 字段名
- 關聯：productInterests[], subscriptions[]

---

#### ProductInterest (產品興趣矩陣 — 規格化)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | FK, onDelete Cascade |
| productId | Int | 產品 → ProductCatalog | FK, onDelete Cascade |
| status | String | 興趣程度 | `NOT_CONTACTED` / `NOT_INTERESTED` / `AWARE` / `INTERESTED` / `HIGH_INTENT` / `PURCHASED` |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

**業務規則**：
- `@@unique([customerId, productId])` — 每個客戶對每個產品只有一條記錄
- 與 Customer 上的 7 個 denormalized 字段**雙寫並存**，Phase 3 驗證新表完全採用後才移除 denormalized 字段
- 新增產品興趣時同步寫入規範表和 denormalized 字段

---

#### Subscription (訂閱)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | FK, onDelete Cascade |
| productId | Int | 產品 → ProductCatalog | FK |
| plan | String | 方案週期 | `MONTHLY` / `QUARTERLY` / `SEMI_ANNUAL` / `ANNUAL` |
| billingType | String | 收費類型 | `RECURRING` (週期性) / `ONE_TIME` (一次性) |
| oneTimeAmount | Float? | 一次性金額 | USD, billingType=ONE_TIME 時使用 |
| status | String | 訂閱狀態 | `ACTIVE` / `CANCELLED` / `EXPIRED` / `TRIALING` / `PENDING_SIGNATURE` |
| mrr | Float | MRR 金額 | USD, 週期性訂閱必填 |
| currency | String | 幣種 | default `USD` |
| startDate | DateTime | 開始日期 | |
| endDate | DateTime? | 結束日期 | |
| cancelledAt | DateTime? | 取消日期 | |
| trialEndDate | DateTime? | 試用結束日期 | |
| autoRenew | Boolean | 自動續約 | default true (ONE_TIME 預設 false) |
| notes | String? | 備註 | |
| salesPersonId | Int? | 銷售 → User | FK |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

**業務規則**：
- `mrr` 用於聚合計算總 MRR（所有 ACTIVE subscription.mrr 之和）
- `billingType=ONE_TIME` 時無 MRR、不自動續約
- `endDate` 用於到期提醒（即將到期頁）
- Index: [customerId], [status], [endDate]
- 關聯：signNowDocuments[]

---

#### SupportTicket (客服工單)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | FK, onDelete Cascade |
| subject | String | 工單主題 | |
| status | String | 工單狀態 | `OPEN` / `RESOLVED` / `CLOSED` / `PENDING` |
| priority | String | 優先級 | `LOW` / `MEDIUM` / `HIGH` / `URGENT` |
| source | String? | 來源 | `CHATWOOT` / `EMAIL` / `MANUAL` / `PHONE` |
| chatwootConvId | Int? | Chatwoot 對話 ID | |
| csatScore | Int? | CSAT 滿意度 | 1-5 |
| assignedToId | Int? | 分配給 → User | FK |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |
| resolvedAt | DateTime? | 解決時間 | |

**業務規則**：
- Chatwoot 集成預留字段：source=CHATWOOT / chatwootConvId
- Index: [customerId], [status], [assignedToId]
- 關聯：messages[]

---

#### TicketMessage (工單消息)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| ticketId | Int | 工單 → SupportTicket | FK, onDelete Cascade |
| content | String | 消息內容 | |
| authorType | String | 作者類型 | `AGENT` / `CUSTOMER` / `SYSTEM` |
| isFromCustomer | Boolean | 是否來自客戶 | default false |
| createdAt | DateTime | | |

---

#### CustomerHealthScore (客戶健康度評分)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | Unique FK |
| overallScore | Float | 綜合評分 | 0-100 |
| engagementScore | Float? | 互動度 | 基於活動近因 |
| productAdoptionScore | Float? | 產品採用度 | 基於 INTERESTED+ 的產品比例 |
| supportHealthScore | Float? | 客服健康度 | 基於工單量 + CSAT |
| subscriptionHealth | Float? | 訂閱健康度 | 基於付款時效 |
| churnRisk | String | 流失風險 | `LOW` / `MEDIUM` / `HIGH` |
| calculatedAt | DateTime | 計算時間 | |
| createdAt | DateTime | | |

**業務規則**：
- 評分算法：`overallScore = engagement × 0.30 + productAdoption × 0.25 + supportHealth × 0.25 + subscriptionHealth × 0.20`
- 硬觸發：≥5 open tickets → HIGH；≤7 days to expire → HIGH；>180 days idle → HIGH
- 通過 `/api/customer-health?recalculate=true` 重新計算

---

#### CustomerLog (客戶編輯歷史)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | FK, onDelete Cascade |
| fieldName | String | 變更字段 | e.g. "name", "contactStatus" |
| oldValue | String? | 舊值 | |
| newValue | String? | 新值 | |
| changedById | Int? | 操作人 → User | FK |
| createdAt | DateTime | 變更時間 | |

**業務規則**：
- 自動記錄：PATCH `/api/customers/[id]` 時比對前後值自動寫入
- 跳過內部字段（product interest 字段、updatedAt 等）
- Index: [customerId], [customerId, createdAt]

---

#### MerchantProfile (商家檔案 — 1:1 擴展)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | Unique FK, onDelete Cascade |

**外部平台 ID**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| kitchChatId | String? | Kitch Chat 唯一識別 |
| yelpId | String? | Yelp biz id |
| googleId | String? | Google Place id |
| psId | String? | Pocket Store id |

**結構化地址**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| street | String? | 街道名稱 |
| streetNumber | String? | 門牌號 |
| state | String? | 州 |
| zipCode | String? | 郵編 |
| country | String? | 國家 |
| lat | Float? | 緯度 |
| lng | Float? | 經度 |

**商家詳情**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| chineseName | String? | 餐館中文名 |
| email | String? | 郵箱 |
| logoUrl | String? | LOGO URL |
| bannerUrl | String? | Banner URL |

**營運數據**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| priceLevel | Int? | 價位 1-4 ($-$$$$) |
| rating | Float? | 評分 0-5 |
| menuUrl | String? | 菜單 URL |
| googleAiDesc | String? | Google AI 描述 |
| aiDesc | String? | AI 編輯摘要 |

**營業資訊**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| businessStatus | String? | `OPERATIONAL` / `CLOSED_TEMPORARILY` / `CLOSED_PERMANENTLY` |
| openingHours | String? | JSON: [{day, open, close}] |
| specialHours | String? | JSON: [{date, open, close}] |

**特徵標籤**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| features | String? | JSON: 集中存放 40+ 個 boolean 功能標記 |

**元數據**：
| 屬性 | 類型 | 說明 |
|------|------|------|
| lastSyncedAt | DateTime? | 最後從外部同步時間 |
| dataSource | String? | `GOOGLE` / `HIFOOD` / `OME` / `MANUAL` / `MERCHANT` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**業務規則**：
- 1:1 與 Customer 關聯，在客戶創建時自動生成空 Profile
- 與 Customer 表的 CRM 字段職責分離：Customer 管銷售/產品/跟進，MerchantProfile 管商家資訊/外部數據
- 支援多渠道數據來源（Google Places / Hifood / 商家自助 / 銷售錄入）
- `features` JSON 字段包含所有 boolean 功能標記（付款方式、供餐服務、環境設施等），避免 50+ 獨立布爾欄位
- Index: [yelpId], [googleId], [state]

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| name | String | 分群名稱 | Unique |
| description | String? | 描述 | |
| queryConfig | String? | JSON 過濾條件 | 動態分群的篩選配置 |
| isDynamic | Boolean | 是否動態分群 | default true |
| customerCount | Int | 客戶數量 | default 0 |
| createdById | Int? | 創建人 → User | FK |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

---

#### SignNowDocument (簽約文件 — 預留)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| customerId | Int | 客戶 → Customer | FK |
| subscriptionId | Int? | 關聯訂閱 → Subscription | FK |
| documentName | String | 文件名稱 | |
| signNowDocId | String? | SignNow 平台文檔 ID | |
| status | String | 簽約狀態 | `DRAFT` / `SENT` / `SIGNED` / `EXPIRED` / `DECLINED` |
| signedByCustomerAt | DateTime? | 客戶簽署時間 | |
| expiresAt | DateTime? | 過期時間 | |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

**備註**：模型已定義，API 集成待 Phase 3 實現。

---

#### ExportJob (導出任務)

| 屬性 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | Int | 主鍵 | PK |
| type | String | 導出類型 | `CUSTOMERS` / `SUBSCRIPTIONS` / `TICKETS` / `LEADS` |
| status | String | 任務狀態 | `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` |
| filters | String? | JSON 過濾條件 | |
| fileUrl | String? | 文件路徑 | |
| fileSize | Int? | 文件大小(bytes) | |
| rowCount | Int? | 導出行數 | |
| error | String? | 錯誤信息 | |
| requestedById | Int? | 請求人 → User | FK |
| createdAt | DateTime | | |
| completedAt | DateTime? | 完成時間 | |

---

## 3. 受控詞彙（Controlled Vocabularies）

### 3.1 User.role
```
ADMIN      — 管理員：全部權限，用戶管理，系統配置
SALES_MGR  — 銷售主管：管理區域內團隊數據，查看業績
SALES      — 銷售：管理自己跟進的客戶和記錄
```

### 3.2 Customer.region（業務區域）
```
LA EAST | LA DOWNTOWN | LA WEST | ORANGE COUNTY
WESTERN INLAND EMPIRE | SOUTH BAY | OUT OF CALIFORNIA
```

### 3.3 Customer.type（餐飲類型）
```
茶餐廳 | 正餐 | 酒樓 | 火鍋 | 快餐 | 其他
```

### 3.4 Customer.storeType（店鋪類型）
```
單店 | 連鎖
```

### 3.5 Customer.contactStatus（整體接觸狀態）
```
合作中  — 已達成合作
已建联  — 已建立聯繫但未合作
已流失  — 曾合作但已流失
```

### 3.6 Customer.status（客戶狀態）
```
ACTIVE    — 活躍客戶（默認）
INACTIVE  — 非活躍
ARCHIVED  — 已歸檔（軟刪除）
```

### 3.7 Customer.tier（客戶分層）
```
ENTERPRISE  — 大型企業客戶
MID_MARKET  — 中型客戶
SMB         — 小型/長尾客戶（默認）
```

### 3.8 Customer.source（數據來源）
```
IMPORT          — 批量匯入
LEAD_CONVERSION — 線索轉化
MANUAL          — 手動創建
API             — API 創建
PARTNER         — 合作夥伴導入
```

### 3.9 Customer.onboardingStatus（上線狀態）
```
NOT_STARTED — 未開始
IN_PROGRESS — 進行中
COMPLETED   — 已完成
```

### 3.10 Pipeline.status（管道階段）
```
⚠️          — 待跟進（初始/擱置）
已建联      — 已建立聯繫
初步有意向  — 客戶表現出初步興趣
合作中      — 已達成合作/交易
```

### 3.11 Lead.status（線索狀態）
```
new        — 新線索
contacted  — 已聯繫
converted  — 已轉化為客戶
closed     — 已關閉（無效）
```

### 3.12 Lead.source（線索來源）
```
WEBSITE     — 網站
REFERRAL    — 推薦（公眾端提交）
COLD_CALL   — 陌生拜訪
EVENT       — 活動
PARTNER     — 合作夥伴
OTHER       — 其他
```

### 3.13 Product Interest Status（興趣級別，6 級）
```
NOT_CONTACTED   — 未接觸    Not Contacted
NOT_INTERESTED  — 無興趣    Not Interested
AWARE           — 已了解    Aware
INTERESTED      — 感興趣    Interested
HIGH_INTENT     — 高意向    High Intent
PURCHASED       — 已購買    Purchased
```

### 3.14 ProductCatalog.category
```
CORE     — 核心產品
ADDON    — 附加服務
SERVICE  — 服務類
HARDWARE — 硬體
```

### 3.15 Subscription.plan（方案週期）
```
MONTHLY       — 月付
QUARTERLY     — 季付
SEMI_ANNUAL   — 半年付
ANNUAL        — 年付
```

### 3.16 Subscription.status
```
ACTIVE            — 活躍
CANCELLED         — 已取消
EXPIRED           — 已過期
TRIALING          — 試用中
PENDING_SIGNATURE — 待簽約
```

### 3.17 Subscription.billingType
```
RECURRING  — 週期性收費（按月/季/年）
ONE_TIME   — 一次性收費
```

### 3.18 SupportTicket.status
```
OPEN     — 開啟
RESOLVED — 已解決
CLOSED   — 已關閉
PENDING  — 待定
```

### 3.19 SupportTicket.priority
```
LOW    — 低
MEDIUM — 中
HIGH   — 高
URGENT — 緊急
```

### 3.20 CustomerHealthScore.churnRisk
```
LOW     — 低風險 (overallScore ≥ 70)
MEDIUM  — 中風險 (overallScore ≥ 40)
HIGH    — 高風險 (overallScore < 40)
```
**硬觸發**：≥5 open tickets / ≤7 days to expire / >180 days idle → 強制 HIGH

### 3.21 SignNowDocument.status
```
DRAFT    — 草稿
SENT     — 已發送
SIGNED   — 已簽署
EXPIRED  — 已過期
DECLINED — 已拒絕
```

### 3.22 ExportJob.type
```
CUSTOMERS     — 客戶導出
SUBSCRIPTIONS — 訂閱導出
TICKETS       — 工單導出
LEADS         — 線索導出
```

### 3.23 ExportJob.status
```
PENDING    — 待處理
PROCESSING — 處理中
COMPLETED  — 已完成
FAILED     — 失敗
```

### 3.24 MerchantProfile.dataSource
```
GOOGLE   — 從 Google Places API 自動填充
HIFOOD   — 從 Hifood 系統同步
OME      — 從 OME 系統同步
MANUAL   — 手動錄入（預設）
MERCHANT — 商家自助填寫
```

### 3.25 MerchantProfile.businessStatus
```
OPERATIONAL          — 營業中
CLOSED_TEMPORARILY   — 暫停營業
CLOSED_PERMANENTLY   — 永久關閉
```

### 3.26 Visit.outcome（拜訪結果）
```
Interested, needs follow-up   — 感興趣，需跟進
Not interested for now        — 暫無興趣
Rejected directly             — 直接拒絕
Met owner/manager             — 見到負責人
Did not meet owner/manager    — 未見到負責人
```

---

## 4. 產品興趣矩陣（Product Interest Matrix）

這是本 CRM 的核心概念。每個客戶對多條產品線各有獨立的興趣程度，而非傳統 CRM 的單一商機狀態。

### 4.1 產品線

| 字段名（Denormalized） | 產品 Key | 產品名稱 | 類別 | 說明 |
|------------------------|----------|----------|------|------|
| `posStatus` | `posStatus` | POS | CORE | 餐廳 POS 硬體+軟體 |
| `psWebsiteStatus` | `psWebsiteStatus` | PS 官網 | ADDON | 餐廳官網建置與託管 |
| `smtStatus` | `smtStatus` | SMT | CORE | 電話接單系統 |
| `aiCamStatus` | `aiCamStatus` | AI Cam | HARDWARE | AI 攝影機（客流分析、安全監控）|
| `platformManagedStatus` | `platformManagedStatus` | 平台托管 | SERVICE | 外賣平台（Uber/DoorDash）託管運營 |
| `omeStatus` | `omeStatus` | OME | ADDON | 其他餐飲軟體服務 |
| `smartRobotStatus` | `smartRobotStatus` | 智能機器人 | ADDON | AI 電話點餐機器人 |

**目前**：7 個 denormalized 字段（存儲在 Customer 上）+ ProductInterest 規範表雙寫。
**未來**：ProductCatalog 動態管理，可新增/修改/禁用產品。

### 4.2 興趣級別（6 級）

| 值 | 中文 | English | 含義 |
|----|------|---------|------|
| `NOT_CONTACTED` | 未接觸 | Not Contacted | 尚未觸及此產品 |
| `NOT_INTERESTED` | 無興趣 | Not Interested | 明確表示不需要 |
| `AWARE` | 已了解 | Aware | 已介紹產品，客戶了解中 |
| `INTERESTED` | 感興趣 | Interested | 客戶表現興趣，考慮中 |
| `HIGH_INTENT` | 高意向 | High Intent | 購買意願強烈，進入談判 |
| `PURCHASED` | 已購買 | Purchased | 已成交/合作中 |

### 4.3 興趣級別與 Pipeline 的映射關係

```
Pipeline 階段          → Customer.contactStatus
────────────────────────────────────────────
⚠️ 待跟進              → （不變）
已建联                → 已建联
初步有意向            → 已建联
合作中                → 合作中
成交歸檔 (WON)        → 合作中
流失 (LOST)           → 已流失
```

### 4.4 產品潛力指標

```
潛在客戶數 = INTERESTED + HIGH_INTENT
轉化率     = PURCHASED / (PURCHASED + INTERESTED + HIGH_INTENT) × 100%
滲透率     = PURCHASED / Total Active Customers × 100%
健康產品採用率 = 客戶中 INTERESTED+ 產品數 / 總產品數
```

---

## 5. 業務流程（Business Processes）

### 5.1 線索到客戶轉化（Lead → Customer）

```
[新建線索] → POST /api/leads    or     [公眾端] → POST /api/public/leads
    │                                        │ (透過 shareToken 認證)
    │  status = new / converted              │ 自動 converted + Customer + Pipeline
    ▼                                        ▼
[銷售跟進] → PATCH /api/leads (status=contacted)
    │
    │  判斷為有效客戶
    ▼
[一鍵轉化] → PATCH /api/leads (action=convert)
    │
    ├──→ $transaction({
    │     Customer.create (從 Lead 數據映射)
    │     Lead.update (status=converted, 關聯 customerId)
    │     Pipeline.create (status=已建联)
    │   })
    │
    └──→ 成功返回 { customer, lead, pipeline }
         失敗 → 全部回滾
```

### 5.2 Pipeline 狀態變更 → 客戶狀態同步

```
PATCH /api/pipelines (status=合作中, active=false, closeReason=WON)
    │
    ├──→ Pipeline.active = false, Pipeline.closedAt = now
    ├──→ Customer.contactStatus = 合作中
    └──→ 前端彈出「創建訂閱」模態框

PATCH /api/pipelines (active=false, closeReason=LOST)
    │
    ├──→ Pipeline.active = false, Pipeline.closedAt = now
    └──→ Customer.contactStatus = 已流失（從合作中欄位流失）
       → 或 Customer.contactStatus = 已建联（從其他欄位流失）

PATCH /api/pipelines (status=已建联)
    │
    ├──→ Pipeline.status = 已建联
    └──→ Customer.contactStatus = 已建联
```

### 5.3 每日速報流程（Quick Check-in）

```
[內部使用] → 登錄後打開 /quick-checkin
    │
    ├──→ 選擇客戶 → 登記溝通 → 更新產品興趣
    │
[分享連結] → 管理員生成每位 sales 的 share URL
    │
    ├──→ /quick-checkin/share/{shareToken}
    │
    └──→ 免登錄 Web App
         → 自動載入該 sales 的客戶列表
         → 選擇客戶 → 填寫溝通記錄 + 產品興趣
         → POST /api/public/share (token 驗證)
         → 自動查找/創建 Pipeline → 添加 Communication → 更新 ProductInterest
```

### 5.4 公眾線索登記流程（Leads Share）

```
Admin 生成分享連結 → /leads/share/{shareToken}
    │
    ▼
公眾端打開（免登錄，手機友好）
    │
    ├──→ 填寫：商家名稱*、電話、聯繫人、餐飲類型、POS 品牌、需求、拜訪時間
    │
    └──→ POST /api/public/leads
         → $transaction({
             Lead.create (source=REFERRAL, status=converted)
             Customer.create (從 lead 映射)
             Pipeline.create (status=已建联, salesPersonId=token user)
           })
```

### 5.5 拜訪記錄流程

```
[新建拜訪] → GET /api/customers?pageSize=100 (載入客戶列表)
    │
    ├──→ 選擇客戶、日期、結果
    └──→ POST /api/visits

[查看拜訪] → GET /api/visits (列表)
    │
    └──→ 點擊客戶名稱 → /customers/:id (客戶詳情)
```

### 5.6 成交 → 訂閱創建流程

```
Kanban 看板: 「合作中」欄位 → 成交歸檔
    │
    ├──→ PATCH /api/pipelines (active=false, closeReason=WON)
    │
    ├──→ 前端彈出「創建訂閱」模態框
    │     ├── 產品 (searchable Select ← ProductCatalog)
    │     ├── 計費類型 (RECURRING / ONE_TIME)
    │     ├── 方案週期 / 一次性金額
    │     ├── 開始/結束日期
    │     └── 自動續約
    │
    └──→ POST /api/subscriptions → 關聯客戶 + 銷售

Kanban 看板: 「合作中」欄位 → 不再合作
    │
    ├──→ PATCH /api/pipelines (active=false, closeReason=LOST)
    └──→ Customer.contactStatus = 已流失
```

### 5.7 客戶歸檔流程

```
客戶列表 / 客戶詳情 → 歸檔操作
    │
    ├──→ PATCH /api/customers/[id] (status=ARCHIVED)
    ├──→ 從默認列表中隱藏
    └──→ 可恢復（改回 ACTIVE）

恢復：篩選「全部（含歸檔）」→ 點擊「恢復」
```

---

## 6. 權限模型（RBAC）

### 6.1 角色

| 角色 | 代碼 | 描述 | 數據可見範圍 |
|------|------|------|-------------|
| 管理員 | ADMIN | 系統管理員，擁有所有權限 | 全部數據 |
| 銷售主管 | SALES_MGR | 管理區域內銷售團隊 | 自己 region 內的數據 |
| 銷售 | SALES | 個人跟進客戶 | 自己 followerId 分配的客戶 |

### 6.2 角色權限矩陣

| 功能 | ADMIN | SALES_MGR | SALES |
|------|-------|-----------|-------|
| 儀表盤 | 全部統計 | 團隊統計（region 過濾） | 自己相關 |
| 客戶列表 | 全部 | Territory 內 | 被分配的 |
| 客戶詳情 | 可編輯 | Territory 內可編輯 | 被分配的可編輯 |
| 新建客戶 | ✅ | ✅ | ✅ |
| 客戶歸檔/恢復 | ✅ | ❌ | ❌ |
| 客戶分群管理 | ✅ | ✅ | ❌ |
| 批量導入/導出 | ✅ | ✅ | ❌ |
| 看板（Pipeline） | 全部 | 團隊（region 過濾） | 自己的 |
| 拜訪記錄 | 全部 | 團隊 | 自己的 |
| 線索管理 | 全部 | 團隊 | 自己的 |
| 訂閱管理 | 全部 | Territory 內 | 被分配的 |
| 工單查看 | 全部 | Territory 內 | 被分配的 |
| 產品目錄管理 | ✅ | ❌ | ❌ |
| 用戶管理 | ✅ | ❌ | ❌ |
| 速報分享連結 | ✅（生成所有 sales） | ✅（生成自己的） | ✅（生成自己的） |

### 6.3 數據範圍過濾（getDataScope）

實現在 `src/lib/auth-helpers.ts`，所有 list API 統一使用：

```typescript
ADMIN      → {}                          // 無過濾
SALES_MGR  → { region: user.region }     // 只看到自己區域
SALES      → { followerId: user.id }     // 只看到自己跟進的
```

### 6.4 已應用數據過濾的 API

| API | SALES 過濾 | SALES_MGR 過濾 |
|-----|-----------|---------------|
| GET /api/customers | followerId = userId | region = user.region |
| GET /api/customers/[id] | canAccessCustomer() | canAccessCustomer() |
| PATCH /api/customers/[id] | canAccessCustomer() | canAccessCustomer() |
| GET /api/pipelines | salesPersonId = userId | customer.region = user.region |
| GET /api/leads | registeredById = userId | 全部 |
| GET /api/subscriptions | salesPersonId = userId | customer.region = user.region |
| GET /api/support-tickets | assignedToId = userId | customer.region = user.region |
| GET /api/dashboard | followerId 過濾 | region 過濾 |
| GET /api/customer-health | customer.followerId = userId | customer.region = user.region |

---

## 7. 關鍵指標與報表（Key Metrics）

### 7.1 儀表盤指標（/api/dashboard）

| 指標 | 計算方式 | 數據源 |
|------|----------|--------|
| 總客戶數 | Customer.count (status != ARCHIVED) | Customer 表 |
| 活躍 Pipeline | Pipeline.count (active=true) | Pipeline 表 |
| 總線索數 | Lead.count | Lead 表 |
| 本月拜訪 | Visit.count (本月) | Visit 表 |
| 活躍訂閱數 | Subscription.count (status=ACTIVE) | Subscription 表 |
| 總 MRR | SUM(ACTIVE Subscription.mrr) | Subscription 表 |
| 流失風險分布 | CustomerHealthScore.churnRisk 分組計數 | CustomerHealthScore 表 |
| 平均健康度 | AVG(CustomerHealthScore.overallScore) | CustomerHealthScore 表 |
| 客戶分層分布 | Customer.tier 分組計數 | Customer 表 |
| 區域分布 | Customer.region 分組計數 | Customer 表 |
| Pipeline 階段分布 | Pipeline.status 分組計數 | Pipeline 表 |
| 線索狀態分布 | Lead.status 分組計數 | Lead 表 |
| 產品興趣分布 | Customer 各產品字段分組計數 | Customer（denormalized）|

### 7.2 產品潛力指標（按產品線）

```
未接觸   → Customer.count (productField = NOT_CONTACTED)
已購買   → Customer.count (productField = PURCHASED)
潛在客戶 → Customer.count (productField IN [INTERESTED, HIGH_INTENT])
轉化率   → PURCHASED / (PURCHASED + INTERESTED + HIGH_INTENT) × 100%
滲透率   → PURCHASED / Total Active Customers × 100%
```

### 7.3 Pipeline 指標

```
各階段客戶數 → Pipeline.groupBy(status)
平均跟進週期 → avg(lastContactDate - createdAt) per status 轉換
溝通頻率     → Communication.count per pipeline per month
```

### 7.4 健康度評分算法

```
overallScore = engagementScore × 0.30
             + productAdoptionScore × 0.25
             + supportHealthScore × 0.25
             + subscriptionHealth × 0.20

engagementScore（互動度）:
  daysSinceLastActivity ≤ 7   → 100
  ≤ 30 → 80, ≤ 60 → 60, ≤ 90 → 40, ≤ 180 → 20, > 180 → 0

productAdoptionScore（產品採用）:
  產品興趣 ≥ INTERESTED 的比例
  ≥ 80% → 100, ≥ 60% → 80, ≥ 40% → 60, ≥ 20% → 40, ≥ 10% → 20

supportHealthScore（客服健康）:
  base = 100, -15 per open ticket, if ≥3 open → -20
  resolved bonus ≤ 15, CSAT adjust ±30

subscriptionHealth（訂閱健康）:
  no sub → 40 (new) / 20 (established)
  active sub → base 80, expiring penalty ≤ 40, loyalty bonus ≤ 20

churnRisk:
  ≥ 70 → LOW, ≥ 40 → MEDIUM, < 40 → HIGH
  hard trigger: ≥ 5 open tickets → HIGH
  hard trigger: ≤ 7 days to expire → HIGH
  hard trigger: > 180 days idle → HIGH
```

### 7.5 匿名分享指標

| 指標 | 計算方式 |
|------|----------|
| 速報連結使用次數 | Communication count by token user |
| 線索連結轉化率 | Lead count (source=REFERRAL) by token user |
| 分享連結數量 | User.shareToken count (not null) |

---

## 8. API 端點總覽

### 8.1 認證與公共端點

| 方法 | 路徑 | 說明 | 認證 |
|------|------|------|------|
| POST | `/api/auth/[...nextauth]` | 登錄認證 | 無 |
| GET | `/api/public/share?token=` | 驗證 token + 返回客戶列表 | shareToken |
| POST | `/api/public/share` | 匿名提交溝通記錄 + 產品興趣 | shareToken |
| POST | `/api/public/leads` | 匿名提交線索（自動轉化） | shareToken |

### 8.2 核心業務端點

| 方法 | 路徑 | 說明 | RBAC |
|------|------|------|------|
| GET | `/api/dashboard` | 儀表板聚合 13 項指標 | 全部（數據範圍過濾） |
| GET/POST | `/api/customers` | 客戶列表 + 新建 | 全部（數據範圍過濾） |
| GET/PATCH/DELETE | `/api/customers/[id]` | 客戶詳情/更新/刪除 | 全部 + 所有權檢查 |
| GET/POST/PATCH | `/api/pipelines` | Pipeline 列表/創建/更新/歸檔 | 全部（數據範圍過濾） |
| GET/POST/PATCH | `/api/leads` | 線索列表/創建/更新/轉化 | 全部（SALES 只看自己） |
| GET/POST | `/api/visits` | 拜訪列表/創建 | 全部 |
| GET | `/api/product-stats` | 產品興趣統計（groupBy 替代 count） | 全部 |
| GET | `/api/product-stats/[product]` | 某產品下鑽客戶列表 | 全部 |

### 8.3 Phase 2 新增端點

| 方法 | 路徑 | 說明 | RBAC |
|------|------|------|------|
| GET/POST/PATCH/DELETE | `/api/products` | 產品目錄 CRUD | Admin only for mutate |
| GET/POST | `/api/subscriptions` | 訂閱列表/創建 | 全部（數據範圍過濾） |
| GET/POST/PATCH/DELETE | `/api/support-tickets` | 工單 CRUD | 全部（數據範圍過濾） |
| GET/POST | `/api/support-tickets/[id]/messages` | 工單消息 | 全部 |
| GET/PATCH/DELETE | `/api/segments` | 分群 CRUD | 全部 |
| GET | `/api/segments/[id]` | 分群詳情 | 全部 |
| GET | `/api/customer-health` | 健康度列表 + 重新計算 | 全部（數據範圍過濾） |
| GET/POST/PATCH | `/api/exports` | 導出管理 | 全部 |
| GET/POST/PATCH | `/api/users` | 用戶管理 | Admin only |
| POST | `/api/users/share-token` | 生成/獲取用戶分享連結 | Admin only |
| GET | `/api/me/share` | 獲取當前用戶分享連結 | 需登錄 |
| POST | `/api/admin/import` | 數據導入 | Admin only |
| POST | `/api/upload` | 文件上傳 | 全部 |

### 8.4 通用 API 規範

**認證失敗**:
```json
{ "error": "Unauthorized" }  // 401
```

**權限不足**:
```json
{ "error": "Forbidden" }  // 403
```

**驗證失敗**:
```json
{ "error": "name is required" }  // 400
{ "error": "region must be one of: LA EAST, LA DOWNTOWN, ..." }  // 400
```

**分頁規範**:
| 參數 | 預設 | 最大 | 說明 |
|------|------|------|------|
| page | 1 | — | offset-based |
| pageSize | 20 | 200 | 每頁條數 |
| cursor | — | — | cursor-based（可選，覆蓋 offset）|

**回複分頁元數據**:
```json
{
  "data": [...],
  "total": 1500,
  "page": 1,
  "pageSize": 20,
  "nextCursor": 21
}
```

---

## 9. 頁面路由與導航結構

### 9.1 完整頁面一覽（24+ 個）

```
儀表板類
├── /dashboard                          核心儀表板（13 項指標）
├── /product-stats                      產品潛力看板（堆積圖 + 明細表）
└── /product-stats/[product]            某產品興趣客戶下鑽

客戶管理
├── /customers                          客戶列表（搜索/篩選/分頁/歸檔）
├── /customers/[id]                     客戶詳情（360 度視圖）
│   ├── 基本信息 + 產品興趣矩陣
│   ├── 溝通時間線（含登記人）
│   ├── 拜訪記錄
│   ├── 訂閱歷史
│   ├── 工單歷史
│   ├── 健康度儀表
│   ├── 編輯歷史（CustomerLog 時間軸）
│   └── 分群歸屬標籤

Pipeline 看板
├── /kanban                             看板（⚠️ / 已建联 / 初步有意向 / 合作中）
│   ├── 拖拽變更狀態
│   ├── 溝通記錄彈窗
│   ├── 成交歸檔 → 創建訂閱
│   └── 不再合作（流失流程）

拜訪記錄
├── /quick-checkin                      每日速報（內部）
├── /quick-checkin/share/[token]        每日速報（公眾分享，免登錄）
├── /visits                             拜訪記錄列表
└── /visits/new                         新建拜訪

線索管理
├── /leads                              線索列表
├── /leads/new                          新建線索
└── /leads/share/[token]                公眾線索登記（免登錄，手機友好）

Phase 2 新增
├── /subscriptions                      訂閱管理
├── /subscriptions/expiring             即將到期訂閱
├── /support-tickets                    工單列表
├── /support-tickets/[id]               工單詳情（含消息線程）
├── /customer-health                    健康度儀表板
├── /segments                           客戶分群列表
├── /segments/[id]                      分群下鑽
├── /products                           產品目錄管理（Admin）
└── /exports                            數據導出管理

管理後臺 (Admin only)
├── /admin/users                        用戶管理（含分享連結生成）
└── /admin/import                       數據導入
```

### 9.2 導航結構（側邊欄）

```
📊 儀表板          /dashboard
📋 客戶管理         /customers
🎯 Pipeline 看板    /kanban
📝 拜訪記錄         /visits
✅ 每日速報         /quick-checkin
🔗 線索管理         /leads
📦 產品潛力         /product-stats
—— Phase 2 ——
💳 訂閱管理         /subscriptions
🎫 工單管理         /support-tickets
❤️ 健康度評分       /customer-health
🏷️ 客戶分群         /segments
📦 產品目錄         /products
📤 數據導出         /exports
—— 管理 ——
👥 用戶管理         /admin/users
📥 數據導入         /admin/import
```

---

## 10. 匿名分享機制（Share Link）

### 10.1 概述

CRM 支援兩類匿名分享連結，業務人員可將連結發送給客戶/合作夥伴，無需登錄即可提交數據。

### 10.2 連結類型

| 類型 | 路徑 | 用途 | 提交內容 |
|------|------|------|---------|
| 每日速報 | `/quick-checkin/share/{token}` | 客戶快速登記溝通 | 溝通記錄 + 產品興趣 |
| 線索登記 | `/leads/share/{token}` | 合作夥伴提交新線索 | 商家資訊 + 需求 |

### 10.3 認證流程

```
1. Admin → POST /api/users/share-token → 生成/獲取 UUID shareToken
2. 生成兩個 URL（quick-checkin + leads）
3. Admin 分發給對應的業務人員
4. 公眾訪問 URL → GET /api/public/share?token=xxx → 驗證 token → 返回 sales 信息 + 客戶列表
5. 提交數據 → POST /api/public/{share,leads} → token 查詢用戶 → 執行操作
```

### 10.4 管理員操作

- 在 `/admin/users` 頁面，每個非 ADMIN 用戶有「獲取連結」按鈕
- 彈出模態框顯示兩個連結的 TextArea + 複製按鈕
- 每個用戶對應一個共享連結（連結綁定 sales 身份，數據歸屬到該 sales）

---

## 11. 數據關係總結

### 11.1 模型關係圖

```
User 1 ──→ * Customer      (follower)
User 1 ──→ * Pipeline      (salesPerson)
User 1 ──→ * Communication (createdBy)
User 1 ──→ * Visit         (visitedBy)
User 1 ──→ * VisitLog      (visitedBy)
User 1 ──→ * Lead          (registeredBy)
User 1 ──→ * Subscription  (salesPerson, @relation "SubscriptionSalesPerson")
User 1 ──→ * SupportTicket (assignedTo, @relation "TicketAssignee")
User 1 ──→ * CustomerSegment (createdBy)
User 1 ──→ * ExportJob     (requestedBy)
User 1 ──→ * CustomerLog   (changedBy)

Customer 1 ──→ 0..1 Pipeline    (1:1, unique)
Customer 1 ──→ * Communication  (through Pipeline)
Customer 1 ──→ * Visit
Customer 1 ──→ * VisitLog
Customer 1 ──→ * Lead
Customer 1 ──→ * ProductInterest
Customer 1 ──→ * Subscription
Customer 1 ──→ * SupportTicket
Customer 1 ──→ 0..1 CustomerHealthScore (unique)
Customer 1 ──→ * SignNowDocument
Customer 1 ──→ * CustomerLog

ProductCatalog 1 ──→ * ProductInterest
ProductCatalog 1 ──→ * Subscription

Pipeline 1 ──→ * Communication    (contactOrder auto-increment)
Subscription 1 ──→ * SignNowDocument

SupportTicket 1 ──→ * TicketMessage
```

### 11.2 關鍵索引

| 表 | 索引 | 用途 |
|----|------|------|
| User | email (unique) | 登錄 |
| User | shareToken (unique) | 匿名分享 |
| Customer | followerId | 按跟進人查詢 |
| Customer | region | 按區域過濾 |
| Customer | status | 過濾歸檔客戶 |
| Customer | tier | 分層統計 |
| ProductInterest | [customerId, productId] (unique) | 防止重複 |
| Subscription | [customerId] | 客戶訂閱查詢 |
| Subscription | [status] | 活躍/取消過濾 |
| Subscription | [endDate] | 到期提醒 |
| SupportTicket | [customerId] | 客戶工單查詢 |
| SupportTicket | [status] | 待處理工單 |
| SupportTicket | [assignedToId] | 分配查詢 |
| CustomerHealthScore | customerId (unique) | 健康度查詢 |
| CustomerLog | [customerId, createdAt] | 編輯歷史時間軸 |

---

## 12. 現狀與路線圖

### Phase 1（已完成）
- Schema 增強（tier/status/source/onboardingStatus 等）
- 產品興趣矩陣雙寫（Customer denormalized + ProductInterest）
- 輸入驗證層（Zod type assertions）
- API 性能優化（product-stats 42→7 queries）
- Lead 轉化事務保護（$transaction）
- 權限隔離（getDataScope, 3 角色）
- ProductCatalog 動態產品目錄
- 產品種子數據、ProductInterest 回填腳本

### Phase 2（已完成）
- 訂閱管理（RECURRING / ONE_TIME + MRR）
- 客服工單 + 消息線程
- 客戶健康度評分（4 維度 + 3 級流失風險）
- 客戶分群（動態/靜態）
- 產品目錄 CRUD UI
- 儀表板擴展（13 項指標）
- 非同步 CSV 導出
- 客戶詳情增強（健康度/訂閱/工單/編輯歷史）
- 編輯歷史日誌（CustomerLog）
- 溝通記錄顯示登記人
- 成交歸檔 → 創建訂閱流程
- 不再合作/流失流程
- 客戶歸檔/恢復（軟刪除）
- 每日速報分享連結（免登錄 Web App）
- 公眾線索登記（免登錄 + 自動轉化）
- 管理後台分享連結生成

### Phase 2 Extended（規劃中）
- 可配置角色權限（RBAC 引擎 → 取代硬編碼）
- 第三方集成抽象層（Integration Gateway）
- AI Agent 認證 + 權限 + 審計
- 多租戶架構（Tenant 模型 + Row 隔離）

### Phase 3（未來）
- PostgreSQL 遷移（Enum + GIN index）
- 全文搜索引擎（Elasticsearch / Meilisearch）
- Job Queue（Redis + BullMQ）
- Materialized Views（儀表板加速）
- SignNow 電子簽章集成
- Chatwoot 工單自動同步
- React Query 遷移
- Server Components 遷移
