const API_BASE = "http://localhost:3001/api"

// ─── Helpers ────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  G: "g",
  L: "litres",
  ML: "ml",
  PCS: "pieces",
}

export function formatSupplyDescription(supply: { name: string; unit: string; currentStock: number | string }): string {
  const stock = Number(supply.currentStock)
  const unit = UNIT_LABELS[supply.unit] ?? supply.unit.toLowerCase()
  const quantity = stock % 1 === 0 ? stock.toString() : stock.toFixed(2)
  const suffix = stock === 1 ? unit.replace(/s$/, "") : unit
  return `${quantity} ${suffix} of ${supply.name}`
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Stock Supply Category ──────────────────────────────────────────────────

export async function getStockSupplyCategories(): Promise<StockSupplyCategory[]> {
  if (window.electron?.stockSupplyCategory?.getAll) {
    return window.electron.stockSupplyCategory.getAll()
  }
  return apiFetch("/stock-supply-categories")
}

export async function getStockSupplyCategoryById(id: string): Promise<StockSupplyCategory> {
  if (window.electron?.stockSupplyCategory?.getById) {
    return window.electron.stockSupplyCategory.getById(id)
  }
  return apiFetch(`/stock-supply-categories/${id}`)
}

export async function createStockSupplyCategory(data: StockSupplyCategoryCreateData) {
  if (window.electron?.stockSupplyCategory?.create) {
    return window.electron.stockSupplyCategory.create(data)
  }
  return apiFetch("/stock-supply-categories", { method: "POST", body: JSON.stringify(data) })
}

export async function updateStockSupplyCategory(id: string, data: StockSupplyCategoryUpdateData) {
  if (window.electron?.stockSupplyCategory?.update) {
    return window.electron.stockSupplyCategory.update(id, data)
  }
  return apiFetch(`/stock-supply-categories/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteStockSupplyCategory(id: string) {
  if (window.electron?.stockSupplyCategory?.delete) {
    return window.electron.stockSupplyCategory.delete(id)
  }
  return apiFetch(`/stock-supply-categories/${id}`, { method: "DELETE" })
}

// ─── Stock Supply ───────────────────────────────────────────────────────────

export async function getStockSupplies(): Promise<StockSupply[]> {
  if (window.electron?.stockSupply?.getAll) {
    return window.electron.stockSupply.getAll()
  }
  return apiFetch("/stock-supplies")
}

export async function getStockSupplyById(id: string): Promise<StockSupply> {
  if (window.electron?.stockSupply?.getById) {
    return window.electron.stockSupply.getById(id)
  }
  return apiFetch(`/stock-supplies/${id}`)
}

export async function createStockSupply(data: StockSupplyCreateData) {
  if (window.electron?.stockSupply?.create) {
    return window.electron.stockSupply.create(data)
  }
  return apiFetch("/stock-supplies", { method: "POST", body: JSON.stringify(data) })
}

export async function updateStockSupply(id: string, data: StockSupplyUpdateData) {
  if (window.electron?.stockSupply?.update) {
    return window.electron.stockSupply.update(id, data)
  }
  return apiFetch(`/stock-supplies/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteStockSupply(id: string) {
  if (window.electron?.stockSupply?.delete) {
    return window.electron.stockSupply.delete(id)
  }
  return apiFetch(`/stock-supplies/${id}`, { method: "DELETE" })
}

// ─── Stock Requests ──────────────────────────────────────────────────────────

export async function getStockRequests(status?: string): Promise<StockRequest[]> {
  if (window.electron?.stockRequest?.getAll) {
    return window.electron.stockRequest.getAll(status)
  }
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiFetch(`/stock-requests${query}`)
}

export async function getStockRequestById(id: string): Promise<StockRequest> {
  if (window.electron?.stockRequest?.getById) {
    return window.electron.stockRequest.getById(id)
  }
  return apiFetch(`/stock-requests/${id}`)
}

export async function createStockRequest(data: CreateStockRequestData): Promise<StockRequest> {
  if (window.electron?.stockRequest?.create) {
    return window.electron.stockRequest.create(data)
  }
  return apiFetch("/stock-requests", { method: "POST", body: JSON.stringify(data) })
}

export async function fulfillStockRequest(id: string, data: FulfillStockRequestData): Promise<StockRequest> {
  if (window.electron?.stockRequest?.fulfill) {
    return window.electron.stockRequest.fulfill(id, data)
  }
  return apiFetch(`/stock-requests/${id}/fulfill`, { method: "PUT", body: JSON.stringify(data) })
}
