# Proton CRM v1.2.0 需求文檔

> 我已閱讀並明確接受填寫須知內容。
> 本文檔僅描述功能實現，不涉及敏感信息。

---

## 1、基礎信息

| 字段 | 內容 |
|------|------|
| 期望交付測試時間 | 待定（與 PMX 協商確認） |
| 所屬生態 | Proton CRM 內部管理系統 |
| 終端用戶所屬部門 | 銷售團隊（Sales / Sales Manager） |
| 需求描述 | 儀表盤時間範圍篩選、每週復盤、團隊活動量統計、全頁面中英文切換、分享鏈接提交錯誤診斷修復 |
| 爲什麼做 | ① 管理層需要按時間維度查看業績趨勢（MRR 環比、Pipeline 漏斗）<br>② 每週自動生成團隊復盤報告，減少手動匯報<br>③ 銷售團隊使用英語為主，需要完整英文界面<br>④ 銷售通過分享鏈接提交新客戶時失敗無提示，無法定位問題 |
| 需求實現了什麽功能 | ① 儀表盤支持按今天/本週/本月/本季度/自定義日期範圍篩選所有 KPI<br>② 新增每週復盤頁面，自動聚合團隊活動量與 MRR 數據<br>③ 全部 8 個頁面支持中英文切換（含免登錄分享頁）<br>④ 分享鏈接提交失敗時顯示後端真實錯誤信息 |
| 解決了什麽問題 | ① 儀表盤之前只能看總量，無法對比不同時間段<br>② 每週復盤需要手動從多個頁面拼湊數據<br>③ 英文用戶無法使用系統<br>④ 分享鏈接提交失敗只顯示「提交失敗」，銷售不知道缺了哪個字段 |

---

## 2、Flow chart

### 儀表盤時間篩選流程

```
用戶選擇時間範圍（今天/本週/本月/本季度/自定義）
  ↓
前端攜帶 range + startDate + endDate 參數調用 GET /api/dashboard
  ↓
後端按時間範圍篩選：
  - Customer 總數（排除 ARCHIVED）
  - 活躍訂閱 / MRR（按 startDate/endDate 過濾）
  - MRR 趨勢（按月聚合）
  - Pipeline 漏斗（各階段狀態統計）
  - 健康度分布（實際有記錄的客戶總數）
  ↓
返回帶時間範圍過濾的聚合數據
  ↓
前端渲染儀表盤卡片 + 折線圖 + 漏斗圖 + 餅圖
```

### 每週復盤數據聚合流程

```
打開 /weekly-review 頁面
  ↓
前端調用 GET /api/team-stats（攜帶 weekStart/weekEnd 參數）
  ↓
後端聚合：
  - WeeklyMetricSnapshot 讀取本周 MRR/客戶數/健康度
  - Lead 表計本周新增線索
  - Visit 表計本周拜訪數
  - Communication 表計本周溝通數
  - Pipeline 表計本周 WON/LOST 單
  - User.targetMRR 計算 MRR 達成率
  ↓
同時調取上一周對比數據（可選）
  ↓
前端渲染週報卡片 + 團隊活動量表 + WoW 環比箭頭
```

### 分享鏈接提交流程

```
銷售打開分享鏈接（免登錄，URL 帶 token）
  ↓
前端調用 GET /api/public/share?token=xxx 驗證 token
  ↓
後端通過 prisma.user.findUnique({ where: { shareToken } }) 驗證
  ↓
驗證通過 → 展示表單
  ↓
銷售填寫并提交
  ↓
前端 POST /api/public/leads（body 帶 token + 表單數據）
  ↓
後端校驗：
  ① token 是否存在且非空
  ② 餐廳名稱是否存在且非空（trim 後）
  ③ 電話號碼是否存在且非空（trim 後）
  ④ 通過 token 查 User 獲取負責銷售 id
  ⑤ 事務創建：Lead → Customer → MerchantProfile → Pipeline
  ↓
成功 → 返回創建結果 → 前端顯示成功提示
失敗 → 返回 { error: "具體錯誤信息" } → 前端 message.error 顯示
```

---

## 3、Requirements

| 序號 | Story ID | User Story | Functional Requirement ID | Functional Requirement | Notes |
|------|----------|------------|--------------------------|----------------------|-------|
| 1 | S-01 | As a 銷售主管（SALES_MGR），我想要在儀表盤選擇不同時間範圍查看數據，以便對比本周/本月業績變化 | FR-01 | 儀表盤頂部增加時間篩選器：今天/本週/本月/本季度/自定義日期範圍 | 前端組件：Select + RangePicker + 刷新按鈕 |
| 2 | S-01 | As a 銷售主管，我想要 MRR 卡片顯示周環比/月環比箭頭，以便快速判斷收入走勢 | FR-02 | MRR 卡片計算當前週/月 vs 上一週/月的變化百分比，向上↑綠色，向下↓紅色 | 需要後端返回上一週/月 MRR 對比值 |
| 3 | S-01 | As a 銷售主管，我想要 Pipeline 顯示為真漏斗圖，以便看清各階段佔比和贏率 | FR-03 | Pipeline 漏斗圖顯示各階段（⚠️待跟進/已建聯/初步有意向/合作中）的客戶數和百分比，顯示總贏率（won / (won + lost)） | 儀表盤頁面 |
| 4 | S-01 | As a 銷售主管，我想要 MRR 趨勢圖按篩選範圍動態展示，而不是固定 12 個月 | FR-04 | MRR 趨勢折線圖根據篩選範圍返回對應月份的 MRR 數據，不再硬編碼 | 儀表盤頁面 |
| 5 | S-02 | As a 銷售主管，我想要每週自動生成團隊復盤報告，以便減少手動匯報工作 | FR-05 | 新增 /weekly-review 頁面，自動聚合本周 MRR/新簽/流失/Pipeline/成交丟單/客戶構成/健康度 | 前端組件：統計卡片 + 表格 |
| 6 | S-02 | As a 銷售主管，我想要復盤頁面顯示上週期對比環比箭頭，以便判斷趨勢 | FR-06 | 每週復盤頁面可選顯示上一週對比數據，WoW 環比用↑↓箭頭標識 | 調用 GET /api/team-stats 攜帶上週期參數 |
| 7 | S-02 | As a 銷售主管，我想要團隊活動量表顯示每人新增線索/拜訪/溝通/成交/丟單/MRR 達成率，以便評估團隊表現 | FR-07 | 團隊活動量表聚合每人本周活動數據，計算 mrr/targetMRR 達成率 | 需要 User 表有 targetMRR 字段 |
| 8 | S-02 | As a 管理員（ADMIN），我想要手動觸發週度指標快照計算，以便補充歷史或修正數據 | FR-08 | 新增 POST /api/metrics/snapshot 端點，自動計算本周 MRR/客戶數/活動量/健康度快照 | 幂等：同周多次調用不重複寫入 |
| 9 | S-03 | As a 英語用戶（銷售或主管），我想要系統界面可以切換成英文，以便我能用母語操作系統 | FR-09 | 所有頁面右上角增加 ZH/EN 切換按鈕，語言偏好保存在 localStorage，下次打開自動記憶 | 覆蓋儀表盤、新建線索、每日速報、記錄時間線等所有頁面 |
| 10 | S-03 | As a 英語用戶，我想要側邊欄導航菜單全部翻譯成英文，以便我能看懂菜單 | FR-10 | AppLayout 菜單組拆分為 zh/en 兩組，角色標籤翻譯為 Admin/Sales Mgr/Sales，登出按鈕翻譯 | 側邊欄組件 |
| 11 | S-03 | As a 英語用戶，我想要記錄時間線頁面所有類型標籤和篩選 Tab 都是英文，以便我能理解 | FR-11 | RecordTypeNav 組件的選項和記錄時間線頁面的狀態 Tag 按語言切換 | 前端組件 |
| 12 | S-04 | As a 外部銷售（未登錄），我想要通過分享鏈接提交新客户線索，以便他們不用註冊就能填寫 | FR-12 | 新增 /leads/share/[token] 頁面，免登錄填寫表單，通過 URL token 驗證負責人 | 分享鏈接場景 |
| 13 | S-04 | As a 外部銷售，我想要提交失敗時看到具體原因（缺字段/無效 token 等），以便我能修正後重新提交 | FR-13 | 前端讀取 API 響應體中的 error 字段並顯示為 message.error；後端校驗 token/name/phone 必填 + trim | 分享鏈接場景 |
| 14 | S-04 | As a 銷售主管，我想要分享鏈接提交的成功客戶自動關聯到我的帳號，以便系統知道是誰帶來的客戶 | FR-14 | 後端通過 token 查找 User，創建時設置 registeredById 和 salesPersonId | API: POST /api/public/leads |
| 15 | S-04 | As a 外部銷售（未登錄），我想要快速速報分享頁（免登錄）支持中英文切換，以便我用熟悉的語言填寫 | FR-15 | 新增 /quick-checkin/share/[token] 頁面，含語言切換按鈕，所有表單標籤/步驟標題/錯誤提示中英對齊 | 分享鏈接場景 |
| 16 | S-05 | As a 管理員，我想要儀表盤客戶總數排除已歸檔客戶，以便數據與列表頁保持一致 | FR-16 | 儀表盤客戶總數計數時添加 where: { status: { not: 'ARCHIVED' } } | 儀表盤 API |
| 17 | S-05 | As a 管理員，我想要儀表盤健康度分布餅圖分母使用實際有健康度記錄的客戶總數，以便百分比準確 | FR-17 | 健康度分布環圖計算分母時用 healthScoreObj 非空的客戶數，而非客戶總數 | 儀表盤 API |

---

## 項目部署（必填）

| 基礎信息 | 內容 |
|----------|------|
| 項目名稱 | Proton CRM v1.2.0 功能迭代 |
| 部署內容 | 將儀表盤時間篩選、每週復盤、全頁面中英文切換、分享鏈接提交修復功能部署上線 |
| 部署類型 | Web 應用（Next.js 前後端一體架構） |
| 打包模塊 | 內容 |
| 前端打包 | Next.js App Router 構建（`npm run build`），輸出 .next/ 靜態資源 |
| 域名配置 | [crm.sjfood.us](http://crm.sjfood.us)（實際以生產環境域名為準） |
| Gitlab 地址 | https://gitlab.sjfood.us/XXX |
| 是否有 Docker file | 是 |
| 前端打包詳細 | Node 18，使用 pnpm 構建，`pnpm build` |
| 後端打包詳細 | Next.js API Routes（內置服務器），`pnpm build` 自動編譯 |

### 數據庫

| 字段 | 內容 |
|------|------|
| 數據庫類型 | PostgreSQL（生產容器）/ SQLite（本地開發） |
| Schema 變更 | **純增量**：新增 `WeeklyMetricSnapshot` 表 + `User.targetMRR` + `User.targetCustomers` 兩個可空字段 |
| 數據遷移 | `prisma db push` 自動執行，不需手動 SQL |
| 回滾 | 舊代碼跑在新數據庫上完全正常，僅不讀取新表 |

### 環境變量（新增）

| 變量 | 說明 | 必填 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 連接字符串 | 是 |
| `NEXTAUTH_URL` | NextAuth 回調地址 | 是 |
| `NEXTAUTH_SECRET` | NextAuth 簽密 | 是 |

---

## 4、Acceptance criteria

| 相關字段 | 驗收標準 |
|----------|----------|
| **FR-01** 儀表盤時間篩選器 | 1. 儀表盤頂部出現時間篩選下拉框（今天/本週/本月/本季度/自定義）<br>2. 選擇快捷選項後，所有 KPI 卡片數據按該時間範圍刷新<br>3. 自定義日期範圍選擇器生效，起止日期正確傳遞到後端<br>4. 點擊刷新按鈕觸發數據重新拉取 |
| **FR-02** MRR 環比箭頭 | 1. MRR 卡片顯示當前週/月 vs 上一週/月的變化百分比<br>2. 上升用 ↑ 綠色，下降用 ↓ 紅色<br>3. 無變化（0%）時不顯示箭頭 |
| **FR-03** Pipeline 真漏斗 | 1. 儀表盤 Pipeline 區域顯示各階段客戶數和百分比<br>2. 漏斗圖底部顯示總贏率（won / (won + lost)）<br>3. 階段排序為：⚠️待跟進 → 已建聯 → 初步有意向 → 合作中 |
| **FR-04** MRR 趨勢動態範圍 | 1. MRR 趨勢折線圖不再固定顯示 12 個月<br>2. 折線圖橫軸月份數量與篩選範圍一致 |
| **FR-05** 每週復盤頁面 | 1. 訪問 /weekly-review 自動顯示本周數據<br>2. 頁面包含：MRR 統計卡片、Pipeline 狀態、成交/丟單、客戶構成、健康度<br>3. 底部顯示團隊活動量表 |
| **FR-06** 週期對比環比 | 1. 復盤頁面可選顯示上週期對比<br>2. WoW 環比用 ↑↓ 箭頭標識漲跌 |
| **FR-07** 團隊活動量 + 達成率 | 1. 團隊活動量表顯示每人：新增線索/拜訪/溝通/成交/丟單數<br>2. 顯示 MRR 達成率（mrr / targetMRR），有百分比值 |
| **FR-08** 週度快照手動觸發 | 1. ADMIN 調用 POST /api/metrics/snapshot 創建本周快照<br>2. 同一周多次調用不重複寫入（幂等）<br>3. 快照數據包含 MRR/客戶數/活動量/健康度 |
| **FR-09** 全頁面中英文切換 | 1. 所有頁面右上角顯示 ZH/EN 切換按鈕<br>2. 切換後立即生效，無需刷新<br>3. 語言偏好保存到 localStorage，下次打開自動恢復 |
| **FR-10** 側邊欄菜單翻譯 | 1. 中文模式：菜單為「工作台/看板/客戶管理/客戶資料」等<br>2. 英文模式：菜單為「Dashboard/Board/Customers/Customer Profile」等<br>3. 角色標籤翻譯：管理員/Admin、銷售主管/Sales Mgr、銷售/Sales<br>4. 登出按鈕翻譯：登出/Log Out |
| **FR-11** 記錄時間線翻譯 | 1. RecordTypeNav 選項切換：新建線索/New Lead、每日速報/Daily Check-in、拜訪記錄/Visit Records<br>2. 記錄時間線頁面的狀態 Tag 按語言顯示 |
| **FR-12** 分享鏈接提交新客户 | 1. 通過分享鏈接（免登錄）可以訪問線索填寫頁面<br>2. 表單包含：餐廳名稱、電話、聯系人、餐飲類型、POS 品牌、需求、備註、上門日期、地址、城市、郵編、網站<br>3. 提交成功後顯示成功提示 |
| **FR-13** 提交失敗顯示真實錯誤 | 1. 缺少餐廳名稱時，message.error 顯示 "Restaurant name is required"<br>2. 缺少電話時，message.error 顯示 "Phone number is required"<br>3. Token 無效時，message.error 顯示 "Invalid token"<br>4. Token 前後有空格時，系統自動 trim 容錯，不報錯 |
| **FR-14** 分享提交關聯銷售 | 1. 提交後 Lead 記錄的 registeredById 等於 token 對應的 User.id<br>2. Pipeline 記錄的 salesPersonId 等於 token 對應的 User.id<br>3. Customer 的 followerId 等於 token 對應的 User.id |
| **FR-15** 快速速報分享頁 i18n | 1. 免登錄速報分享頁右上角有 ZH/EN 切換<br>2. 所有表單標籤、步驟標題、產品興趣標籤按語言顯示<br>3. 提交成功/失敗提示按語言顯示 |
| **FR-16** 客戶總數排除歸檔 | 1. 儀表盤客戶總數等於所有 status != 'ARCHIVED' 的客戶數<br>2. 與客戶列表頁計數行為一致 |
| **FR-17** 健康度分布餅圖準確 | 1. 健康度環圖分母等於有健康度記錄的客戶總數<br>2. 三個分類（healthy/attention/atRisk）百分比之和為 100% |
