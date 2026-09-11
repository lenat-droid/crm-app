#!/usr/bin/env tsx
/**
 * CRM Agent MCP Server
 *
 * Provides 4 tools for AI agents to query CRM data without direct DB access.
 * All tools wrap existing REST APIs (Integration + Operating Dashboard).
 *
 * Usage (stdio):
 *   npx tsx mcp/mcp-server.ts
 *
 * SSE mode (for HTTP):
 *   API_BASE_URL=http://localhost:3000 API_TOKEN=xxx npx tsx mcp/mcp-server.ts --sse
 *
 * Environment:
 *   API_BASE_URL — REST API base (default: http://localhost:3000)
 *   API_TOKEN    — Admin API token (same as INTEGRATION_API_TOKEN)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { z } from "zod"

// ── Helpers ──

const BASE = process.env.API_BASE_URL || "http://localhost:3000"
const TOKEN = process.env.API_TOKEN || ""

async function apiGet(path: string, query: Record<string, string | number | undefined> = {}) {
  const parts = [path]
  const qs: string[] = []
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") continue
    qs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  if (qs.length) parts.push(`?${qs.join("&")}`)

  const url = `${BASE}${parts.join("")}`
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (TOKEN) headers["x-api-token"] = TOKEN

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json() as Promise<any>
}

// ── Server setup ──

const server = new McpServer({
  name: "crm-agent",
  version: "1.3.1",
})

// ═══════════════════════════════════════════════════════════
// Tool 1: search_customers
// ═══════════════════════════════════════════════════════════

server.registerTool(
  "search_customers",
  {
    title: "Search Customers",
    description:
      "Find customers matching product interest, deployment status, region, or sales person. " +
      "Supports complex filters like 'interested in A but not deployed with A' or 'has product A but exclude product B'.",
    inputSchema: {
      product: z.string().optional().describe(
        'Product key to filter by interest: "pos", "aiManager", "smt", "pocketStore", "loyalty", "ome", "smartRobot"'
      ),
      interestLevel: z.enum([
        "NOT_CONTACTED",
        "NOT_INTERESTED",
        "AWARE",
        "INTERESTED",
        "HIGH_INTENT",
        "PURCHASED",
      ]).optional().describe(
        "Interest level filter (requires product). E.g. HIGH_INTENT to find customers with high intent."
      ),
      hasProduct: z.array(z.object({
        key: z.string().describe("Product key"),
        status: z.enum(["ACTIVE", "CHURNED", "PAUSED"]).optional().describe("Deployment status, default ACTIVE"),
      })).optional().describe(
        'Customers who HAVE these products deployed. Example: [{ "key": "pos", "status": "ACTIVE" }]'
      ),
      excludeProduct: z.array(z.object({
        key: z.string().describe("Product key"),
        status: z.enum(["ACTIVE", "CHURNED", "PAUSED"]).optional().describe("Deployment status"),
      })).optional().describe(
        'Customers who do NOT have these products deployed. Same format as hasProduct.'
      ),
      interestedButNotDeployed: z.object({
        interestProduct: z.string().describe("Product they are interested in"),
        interestLevel: z.enum([
          "AWARE", "INTERESTED", "HIGH_INTENT", "PURCHASED",
        ]).describe("Minimum interest level (AWARE or above = interested)"),
        deployedProduct: z.string().optional().describe(
          'If set, only return customers WITHOUT this product. Example: interestProduct="aiManager", deployedProduct="pos" → interested in AI Manager but have POS deployed.'
        ),
      }).optional().describe(
        'Find customers interested in a product but not yet deployed with it. ' +
        "Example: { interestProduct: 'aiManager', interestLevel: 'HIGH_INTENT' } — customers who want AI Manager but don't have it."
      ),
      region: z.string().optional().describe("Region filter, e.g. 'LA EAST'"),
      followerId: z.number().optional().describe("Sales person ID"),
      customerStatus: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().describe(
        "Customer status. Default ACTIVE. Use ALL to include archived."
      ),
      tier: z.enum(["ENTERPRISE", "MID_MARKET", "SMB"]).optional().describe("Customer tier"),
      from: z.string().optional().describe("Start date (ISO format) — filters by customer createdAt"),
      to: z.string().optional().describe("End date (ISO format)"),
      pageSize: z.number().optional().describe("Items per page (default 50, max 500)").default(50),
      includeDeployments: z.boolean().optional().describe("Include product deployment array (default true)").default(true),
      includeSubscriptions: z.boolean().optional().describe("Include active subscriptions (default false)").default(false),
    },
  },
  async (params: any) => {
    const q: Record<string, string | number | undefined> = {}

    // Build query from all params
    if (params.product) q.product = params.product
    if (params.interestLevel) q.interestLevel = params.interestLevel
    if (params.region) q.region = params.region
    if (params.followerId) q.followerId = params.followerId
    if (params.customerStatus) q.customerStatus = params.customerStatus
    if (params.tier) q.tier = params.tier
    if (params.from) q.from = params.from
    if (params.to) q.to = params.to
    q.pageSize = params.pageSize || 50
    q.includeDeployments = params.includeDeployments ? "true" : undefined
    q.includeSubscriptions = params.includeSubscriptions ? "true" : undefined

    // Complex: interestedButNotDeployed
    if (params.interestedButNotDeployed) {
      const ibn = params.interestedButNotDeployed
      q.product = ibn.interestProduct
      q.interestLevel = ibn.interestLevel
      if (ibn.deployedProduct) {
        q.deploymentProduct = ibn.deployedProduct
        q.deploymentStatus = "ACTIVE"
      }
    }

    // Complex: hasProduct (AND — must have ALL listed)
    if (params.hasProduct && params.hasProduct.length > 0) {
      // For hasProduct, we query each and intersect client-side
      // But we want API-side filtering, so we do sequential narrowing
      const allCustomers = new Map<number, any>()

      for (const hp of params.hasProduct) {
        q.deploymentProduct = hp.key
        q.deploymentStatus = hp.status || "ACTIVE"
        if (q.product) delete q.product
        if (q.interestLevel) delete q.interestLevel
        const result: any = await apiGet("/api/integration/customers", q)
        const ids = new Map<number, any>()
        for (const c of result.data || []) {
          ids.set(c.id, c)
        }
        // Intersect
        for (const id of Array.from(allCustomers.keys())) {
          if (!ids.has(id)) allCustomers.delete(id)
        }
        for (const [id, c] of Array.from(ids)) {
          if (!allCustomers.has(id)) allCustomers.set(id, c)
        }
      }

      // Apply excludeProduct filter on top
      if (params.excludeProduct && params.excludeProduct.length > 0) {
        for (const ep of params.excludeProduct) {
          q.deploymentProduct = ep.key
          q.deploymentStatus = "ACTIVE"
          if (q.product) delete q.product
          if (q.interestLevel) delete q.interestLevel
          const result: any = await apiGet("/api/integration/customers", q)
          const excludedIds = new Set<number>()
          for (const c of result.data || []) {
            excludedIds.add(c.id)
          }
          for (const id of Array.from(allCustomers.keys())) {
            if (excludedIds.has(id)) allCustomers.delete(id)
          }
        }
      }

      const data = Array.from(allCustomers.values())
      return {
        content: [{ type: "text", text: JSON.stringify({
          total: data.length,
          customers: data,
        }) }],
      }
    }

    // Complex: excludeProduct (without hasProduct)
    if (params.excludeProduct && params.excludeProduct.length > 0) {
      // Exclude: get all matching customers, then remove those with excluded products
      q.deploymentProduct = params.excludeProduct[0].key
      q.deploymentStatus = params.excludeProduct[0].status || "ACTIVE"
      if (q.product) delete q.product
      if (q.interestLevel) delete q.interestLevel
      const result: any = await apiGet("/api/integration/customers", q)
      const excludedIds = new Set<number>()
      for (const c of result.data || []) {
        excludedIds.add(c.id)
      }

      // Get total and re-filter
      // For simplicity, do a count-based approach: exclude count is the result
      // Actually, we need to return non-excluded customers.
      // Strategy: fetch all candidates, then remove excluded.
      // Since we don't have a "get all then subtract" endpoint, we use the exclude approach:
      // fetch candidates, for each excluded product, subtract.
      // This requires two passes. Let's do it differently:

      // Get base customers
      if (params.product && params.interestLevel) {
        q.product = params.product
        q.interestLevel = params.interestLevel
      } else if (params.product) {
        q.product = params.product
      }
      delete q.deploymentProduct
      delete q.deploymentStatus

      const baseResult: any = await apiGet("/api/integration/customers", { ...q, pageSize: 500 })
      const baseIds = new Set(baseResult.data?.map((c: any) => c.id) || [])

      // Subtract excluded
      for (const ep of params.excludeProduct) {
        q.deploymentProduct = ep.key
        q.deploymentStatus = ep.status || "ACTIVE"
        const exclResult: any = await apiGet("/api/integration/customers", {
          ...q,
          pageSize: 500,
          includeDeployments: "true",
        })
        for (const c of exclResult.data || []) {
          baseIds.delete(c.id)
        }
        delete q.deploymentProduct
        delete q.deploymentStatus
      }

      const data = (baseResult.data || []).filter((c: any) => baseIds.has(c.id))
      return {
        content: [{ type: "text", text: JSON.stringify({
          total: data.length,
          customers: data,
        }) }],
      }
    }

    const result: any = await apiGet("/api/integration/customers", q)
    return {
      content: [{ type: "text", text: JSON.stringify({
        total: result.pagination?.total ?? result.total ?? 0,
        page: result.pagination?.page ?? result.page ?? 1,
        pageSize: result.pagination?.pageSize ?? result.pageSize ?? 50,
        customers: result.data ?? result.customers ?? [],
      }) }],
    }
  }
)

// ═══════════════════════════════════════════════════════════
// Tool 2: get_customer_profile
// ═══════════════════════════════════════════════════════════

server.registerTool(
  "get_customer_profile",
  {
    title: "Get Customer Profile",
    description:
      "Get a single customer's complete profile including basic info, product interest matrix, " +
      "product deployments, active subscriptions, recent transactions, revenue records, and merchant profile.",
    inputSchema: {
      customerId: z.number().describe("Customer ID"),
    },
  },
  async (params: any) => {
    const result: any = await apiGet(`/api/integration/customers/${params.customerId}`)
    return {
      content: [{ type: "text", text: JSON.stringify({ customer: result.data }) }],
    }
  }
)

// ═══════════════════════════════════════════════════════════
// Tool 3: get_customer_stats
// ═══════════════════════════════════════════════════════════

server.registerTool(
  "get_customer_stats",
  {
    title: "Get Customer Stats",
    description:
      "Get aggregated customer counts and metrics. Supports grouping by product, interest level, " +
      "region, follower, status, tier, and deployment. Can also get GMV, orders, revenue, MRR metrics.",
    inputSchema: {
      metric: z.enum([
        "customer_count",
        "customer_count_by_product",
        "customer_count_by_interest",
        "customer_count_by_region",
        "customer_count_by_follower",
        "customer_count_by_status",
        "customer_count_by_tier",
        "customer_count_by_deployment",
        "gmv_total",
        "orders_total",
        "revenue_total",
        "revenue_by_product",
        "mrr_total",
        "mrr_by_product",
        "deployment_count",
      ]).describe(
        "The metric to compute. Use customer_count_by_interest with a product filter " +
        "to get counts by interest level for a specific product."
      ),
      product: z.string().optional().describe(
        'Product key for product-scoped metrics: "pos", "aiManager", "smt", "pocketStore", "loyalty", "ome", "smartRobot"'
      ),
      interestLevel: z.enum([
        "NOT_CONTACTED",
        "NOT_INTERESTED",
        "AWARE",
        "INTERESTED",
        "HIGH_INTENT",
        "PURCHASED",
      ]).optional().describe("Filter by interest level (used with customer_count metric)"),
      region: z.string().optional().describe("Region filter"),
      followerId: z.number().optional().describe("Sales person ID filter"),
      customerStatus: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().describe("Customer status filter"),
      deploymentProduct: z.string().optional().describe("Filter by deployment product key"),
      deploymentStatus: z.enum(["ACTIVE", "CHURNED", "PAUSED"]).optional().describe("Deployment status filter"),
      from: z.string().optional().describe("Start date (ISO format)"),
      to: z.string().optional().describe("End date (ISO format)"),
    },
  },
  async (params: any) => {
    const q: Record<string, string | number | undefined> = { metric: params.metric }
    if (params.product) q.product = params.product
    if (params.interestLevel) q.interestLevel = params.interestLevel
    if (params.region) q.region = params.region
    if (params.followerId) q.followerId = params.followerId
    if (params.customerStatus) q.customerStatus = params.customerStatus
    if (params.deploymentProduct) q.deploymentProduct = params.deploymentProduct
    if (params.deploymentStatus) q.deploymentStatus = params.deploymentStatus
    if (params.from) q.from = params.from
    if (params.to) q.to = params.to

    const result: any = await apiGet("/api/integration/stats", q)
    return {
      content: [{ type: "text", text: JSON.stringify({ metric: result.metric, data: result.data }) }],
    }
  }
)

// ═══════════════════════════════════════════════════════════
// Tool 4: get_operating_metrics
// ═══════════════════════════════════════════════════════════

server.registerTool(
  "get_operating_metrics",
  {
    title: "Get Operating Metrics",
    description:
      "Get business operating KPIs: registered/active/paid stores, product usage, GMV, orders, " +
      "revenue, revenue mix, and monthly trends. Reuses the v1.3.0 Operating Dashboard logic.",
    inputSchema: {
      period: z.enum(["daily", "weekly", "monthly", "custom"]).optional().describe(
        "Time period. Default monthly. Use 'custom' with from/to."
      ),
      from: z.string().optional().describe("Start date (ISO format, required with period=custom)"),
      to: z.string().optional().describe("End date (ISO format, required with period=custom)"),
      product: z.string().optional().describe(
        'Filter by product key for revenue/GMV breakdown: "pos", "aiManager", "smt", "pocketStore", "loyalty"'
      ),
      region: z.string().optional().describe("Region filter"),
    },
  },
  async (params: any) => {
    const q: Record<string, string | undefined> = {}
    if (params.period) q.period = params.period
    if (params.from) q.from = params.from
    if (params.to) q.to = params.to
    if (params.product) q.product = params.product
    if (params.region) q.region = params.region

    const result: any = await apiGet("/api/operating", q)
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    }
  }
)

// ═══════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════

async function main() {
  const transport = process.argv.includes("--sse")
    ? new SSEServerTransport("/mcp", process.stdout as any)
    : new StdioServerTransport()

  await server.connect(transport)
  console.error("CRM Agent MCP Server running")
}

main().catch(err => {
  console.error("FATAL:", err)
  process.exit(1)
})
