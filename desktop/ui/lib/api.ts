const API_BASE = "http://localhost:3001/api"
const API_ORIGIN = "http://localhost:3001"

export function stockSupplyImageUrl(image: string | null): string | null {
  if (!image) return null
  if (image.startsWith("http")) return image
  return `${API_ORIGIN}${image}`
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  PKT: "packets",
  L: "litres",
  ML: "ml",
  PCS: "pieces",
}

export function formatUnitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit
}

export function formatQuantityWithUnit(quantity: number | string, unit: string): string {
  const num = Number(quantity)
  const label = formatUnitLabel(unit)
  const display = num % 1 === 0 ? num.toString() : num.toFixed(2)
  return `${display} ${label}`
}

export function formatSupplyDescription(supply: { name: string; unit: string; currentStock: number | string }): string {
  const stock = Number(supply.currentStock)
  const unit = UNIT_LABELS[supply.unit] ?? supply.unit.toLowerCase()
  const quantity = stock % 1 === 0 ? stock.toString() : stock.toFixed(2)
  const suffix = stock === 1 ? unit.replace(/s$/, "") : unit
  return `${quantity} ${suffix} of ${supply.name}`
}

async function apiFetch(path: string, options?: RequestInit) {
  const isFormData = options?.body instanceof FormData
  const res = await fetch(`${API_BASE}${path}`, {
    ...(isFormData ? {} : { headers: { "Content-Type": "application/json" } }),
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Stock Supply ───────────────────────────────────────────────────────────

export async function getStockSupplies(departmentId?: string): Promise<StockSupply[]> {
  if (window.electron?.stockSupply?.getAll) {
    return window.electron.stockSupply.getAll(departmentId)
  }
  const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ""
  return apiFetch(`/stock-supplies${query}`)
}

export async function getStockSupplyById(id: string): Promise<StockSupply> {
  if (window.electron?.stockSupply?.getById) {
    return window.electron.stockSupply.getById(id)
  }
  return apiFetch(`/stock-supplies/${id}`)
}

export async function createStockSupply(data: StockSupplyCreateData, imageFile?: File) {
  if (imageFile) {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value))
    })
    formData.append("image", imageFile)
    return apiFetch("/stock-supplies", { method: "POST", body: formData })
  }
  if (window.electron?.stockSupply?.create) {
    return window.electron.stockSupply.create(data)
  }
  return apiFetch("/stock-supplies", { method: "POST", body: JSON.stringify(data) })
}

export async function updateStockSupply(id: string, data: StockSupplyUpdateData, imageFile?: File) {
  if (imageFile) {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value))
    })
    formData.append("image", imageFile)
    return apiFetch(`/stock-supplies/${id}`, { method: "PUT", body: formData })
  }
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

// ─── Departments ────────────────────────────────────────────────────────────

export async function getDepartments(): Promise<Department[]> {
  if (window.electron?.department?.getAll) {
    return window.electron.department.getAll()
  }
  return apiFetch("/departments")
}

export async function getDepartmentById(id: string): Promise<Department> {
  if (window.electron?.department?.getById) {
    return window.electron.department.getById(id)
  }
  return apiFetch(`/departments/${id}`)
}

export async function createDepartment(data: CreateDepartmentData): Promise<Department> {
  if (window.electron?.department?.create) {
    return window.electron.department.create(data)
  }
  return apiFetch("/departments", { method: "POST", body: JSON.stringify(data) })
}

export async function updateDepartment(id: string, data: UpdateDepartmentData): Promise<Department> {
  if (window.electron?.department?.update) {
    return window.electron.department.update(id, data)
  }
  return apiFetch(`/departments/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteDepartment(id: string): Promise<void> {
  if (window.electron?.department?.delete) {
    return window.electron.department.delete(id)
  }
  return apiFetch(`/departments/${id}`, { method: "DELETE" })
}

// ─── Cooking Records ────────────────────────────────────────────────────────

export async function getCookingRecords(date?: string, stockSupplyId?: string): Promise<CookingRecord[]> {
  if (window.electron?.cookingRecord?.getAll) {
    return window.electron.cookingRecord.getAll(stockSupplyId)
  }
  const params = new URLSearchParams()
  if (date) params.set("date", date)
  if (stockSupplyId) params.set("stockSupplyId", stockSupplyId)
  const query = params.toString() ? `?${params.toString()}` : ""
  return apiFetch(`/cooking-records${query}`)
}

export async function createCookingRecord(data: CreateCookingRecordData): Promise<CookingRecord> {
  if (window.electron?.cookingRecord?.create) {
    return window.electron.cookingRecord.create(data)
  }
  return apiFetch("/cooking-records", { method: "POST", body: JSON.stringify(data) })
}

export async function updateCookingRecord(id: string, data: UpdateCookingRecordData): Promise<CookingRecord> {
  return apiFetch(`/cooking-records/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteCookingRecord(id: string): Promise<void> {
  if (window.electron?.cookingRecord?.delete) {
    return window.electron.cookingRecord.delete(id)
  }
  return apiFetch(`/cooking-records/${id}`, { method: "DELETE" })
}

// ─── Kitchen Inventory (new endpoint) ───────────────────────────────────────

export async function getKitchenInventoryList(): Promise<KitchenStockItem[]> {
  return apiFetch("/kitchen/inventory")
}

// ─── Kitchen Inventory ──────────────────────────────────────────────────────

export async function getKitchenInventory(stockSupplyId: string): Promise<KitchenInventory> {
  if (window.electron?.stockSupply?.getKitchenInventory) {
    return window.electron.stockSupply.getKitchenInventory(stockSupplyId)
  }
  return apiFetch(`/stock-supplies/${stockSupplyId}/kitchen-inventory`)
}

// ─── Low Stock ──────────────────────────────────────────────────────────────

export async function getLowStockSupplies(): Promise<StockSupply[]> {
  if (window.electron?.stockSupply?.getLowStockSupplies) {
    return window.electron.stockSupply.getLowStockSupplies()
  }
  return apiFetch("/stock-supplies/low-stock")
}

export async function getLowStockCount(): Promise<{ count: number }> {
  if (window.electron?.stockSupply?.getLowStockCount) {
    return window.electron.stockSupply.getLowStockCount()
  }
  return apiFetch("/stock-supplies/low-stock-count")
}

// ─── Kitchen Config ─────────────────────────────────────────────────────────

export async function getKitchenConfig(): Promise<KitchenConfigItem[]> {
  if (window.electron?.kitchen?.getConfig) {
    return window.electron.kitchen.getConfig()
  }
  return apiFetch("/kitchen-config")
}

export async function saveKitchenConfig(id: string, data: KitchenConfigData): Promise<KitchenConfigItem> {
  if (window.electron?.kitchen?.saveConfig) {
    return window.electron.kitchen.saveConfig(id, data)
  }
  return apiFetch(`/kitchen-config/${id}`, { method: "PUT", body: JSON.stringify(data) })
}
