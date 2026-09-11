# CRM Agent MCP Server

提供 4 个 MCP Tools，统一封装 CRM 数据查询能力给 AI Agent、AI Manager、AI Camera 和第三方系统。

## 快速启动

```bash
# 1. 安装依赖（如果还没装）
npm install @modelcontextprotocol/sdk zod

# 2. 设置环境变量
export API_TOKEN="your-integration-token"
export API_BASE_URL="http://localhost:3000"

# 3. 启动（stdio 模式）
npx tsx mcp/mcp-server.ts

# SSE 模式（HTTP 端点）
npx tsx mcp/mcp-server.ts --sse
```

## 与 Claude Desktop 集成

在 `~/.claude/settings.json` 或 Claude Desktop 配置中添加：

```json
{
  "mcpServers": {
    "crm": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/crm-app/mcp/mcp-server.ts"],
      "env": {
        "API_TOKEN": "your-token",
        "API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

## 4 个 Tools

### 1. `search_customers`
按产品兴趣、开通状态、区域、销售筛选客户。

### 2. `get_customer_profile`
一次返回单客户完整画像。

### 3. `get_customer_stats`
聚合统计：count 按 product/interest/region/follower/status/tier/deployment 分组。
也支持 GMV / Orders / Revenue / MRR 聚合。

### 4. `get_operating_metrics`
复用 v1.3.0 Operating Dashboard 逻辑，返回 Registered/Active/Paid Stores、Product Usage、GMV、Orders、Revenue 等。

## 工具调用

在 Claude Desktop 中，Agent 会自动发现并调用这些工具。
