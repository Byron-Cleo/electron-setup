function resolveApiOrigin(): string {
  if (import.meta.env.VITE_API_ORIGIN) return import.meta.env.VITE_API_ORIGIN
  return "http://localhost:3001"
}

const API_ORIGIN = resolveApiOrigin()
const API_BASE = import.meta.env.VITE_API_BASE ?? `${API_ORIGIN}/api`

export function stockSupplyImageUrl(image: string | null): string | null {
  if (!image) return null
  if (image.startsWith("http")) return image
  return `${API_ORIGIN}${image}`
}

// Resolves menu/accompaniment image paths so they work in both the dev server and
// the packaged Electron build. All menu images live in the backend uploads folder
// (backend/uploads/menu-items), served at /uploads/menu-items. Legacy
// "images/sample-meals/..." paths (from before the move) are mapped by filename.
export function menuImageUrl(url: string | null): string | null {
  if (!url) return null
  if (/^(https?:|data:|blob:|file:)/i.test(url)) return url
  const clean = url.trim().replace(/^(\.\.?\/)+/, "").replace(/^\/+/, "")
  if (clean.includes("images/sample-meals/")) {
    return `${API_ORIGIN}/uploads/menu-items/${clean.split("/").pop()}`
  }
  if (clean.startsWith("uploads/")) return `${API_ORIGIN}/${clean}`
  return `${API_ORIGIN}/uploads/menu-items/${clean}`
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
      if ((key === "departmentIds" || key === "menuIds") && Array.isArray(value)) {
        formData.append(key, JSON.stringify(value))
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
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
      if ((key === "departmentIds" || key === "menuIds") && Array.isArray(value)) {
        formData.append(key, JSON.stringify(value))
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
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
    await window.electron.department.delete(id)
    return
  }
  return apiFetch(`/departments/${id}`, { method: "DELETE" })
}

// ─── Cooking Records ────────────────────────────────────────────────────────

export async function getCookingRecords(stockSupplyId?: string): Promise<CookingRecord[]> {
  if (window.electron?.cookingRecord?.getAll) {
    return window.electron.cookingRecord.getAll(stockSupplyId)
  }
  const params = new URLSearchParams()
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
    await window.electron.cookingRecord.delete(id)
    return
  }
  return apiFetch(`/cooking-records/${id}`, { method: "DELETE" })
}

// ─── Kitchen Inventory (new endpoint) ───────────────────────────────────────

export async function getKitchenInventoryList(): Promise<KitchenStockItem[]> {
  return apiFetch("/kitchen/inventory")
}

// ─── Cooking Assignments ────────────────────────────────────────────────────

export async function getCookingAssignments(date?: string): Promise<CookingRecord[]> {
  return apiFetch(`/cooking-assignments/available${date ? `?date=${date}` : ""}`)
}

export async function createCookingAssignment(data: { cookingRecordId?: string; stockSupplyId?: string; date?: string; menuId: string; quantityPlates: number }) {
  return apiFetch("/cooking-assignments", { method: "POST", body: JSON.stringify(data) })
}

export async function updateCookingAssignment(id: string, data: { quantityPlates: number }) {
  return apiFetch(`/cooking-assignments/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteCookingAssignment(id: string) {
  return apiFetch(`/cooking-assignments/${id}`, { method: "DELETE" })
}

// ─── Menu ───────────────────────────────────────────────────────────────────

export async function getMenus(): Promise<MenuItem[]> {
  if (window.electron?.menu?.getAll) {
    return window.electron.menu.getAll()
  }
  return apiFetch("/menu")
}

export async function getMenuByMealType(mealPeriod: string): Promise<MenuItem[]> {
  if (window.electron?.menu?.getByMealType) {
    return window.electron.menu.getByMealType(mealPeriod)
  }
  return apiFetch(`/menu?mealType=${encodeURIComponent(mealPeriod)}`)
}

export async function getMenuImages(): Promise<string[]> {
  if (window.electron?.menu?.listImages) {
    return (await window.electron.menu.listImages()).images
  }
  const res = await apiFetch("/menu/images")
  return (res as { images: string[] }).images ?? []
}

export async function getMenuById(id: string): Promise<MenuItem> {
  if (window.electron?.menu?.getById) {
    return window.electron.menu.getById(id)
  }
  return apiFetch(`/menu/${id}`)
}

export async function createMenu(data: MenuCreateData): Promise<MenuItem> {
  if (window.electron?.menu?.create) {
    return window.electron.menu.create(data)
  }
  return apiFetch("/menu", { method: "POST", body: JSON.stringify(data) })
}

export async function uploadMenuImage(imageFile: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append("image", imageFile)
  return apiFetch("/menu/upload", { method: "POST", body: formData })
}

export async function getCookedMenus(date?: string): Promise<CookedMenuItem[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  return apiFetch(`/menu/cooked${query}`)
}

export async function updateMenu(id: string, data: Partial<MenuCreateData>): Promise<MenuItem> {
  return apiFetch(`/menu/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function updateMenuAvailability(id: string, isAvailable: boolean): Promise<MenuItem> {
  return apiFetch(`/menu/${id}/availability`, { method: "PUT", body: JSON.stringify({ isAvailable }) })
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
  return apiFetch("/stock-supplies/low-stock")
}

export async function getLowStockCount(): Promise<{ count: number }> {
  if (window.electron?.stockSupply?.getLowStockCount) {
    return window.electron.stockSupply.getLowStockCount()
  }
  return apiFetch("/stock-supplies/low-stock-count")
}

export async function getStockCount(): Promise<{ count: number }> {
  if (window.electron?.stockSupply?.getStockCount) {
    return window.electron.stockSupply.getStockCount()
  }
  return apiFetch("/stock-supplies/count")
}

// ─── Accompaniments ─────────────────────────────────────────────────────────

export async function getAccompaniments(): Promise<Accompaniment[]> {
  return apiFetch("/accompaniments")
}

export async function createAccompaniment(data: AccompanimentCreateData): Promise<Accompaniment> {
  return apiFetch("/accompaniments", { method: "POST", body: JSON.stringify(data) })
}

export async function updateAccompaniment(id: string, data: AccompanimentUpdateData): Promise<Accompaniment> {
  return apiFetch(`/accompaniments/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function getMealTypes(): Promise<MealType[]> {
  if (window.electron?.mealType?.getAll) {
    return window.electron.mealType.getAll()
  }
  return apiFetch("/meal-types")
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

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function createOrder(data: CreateOrderData): Promise<Order> {
  if (window.electron?.order?.create) {
    return window.electron.order.create(data)
  }
  return apiFetch("/orders", { method: "POST", body: JSON.stringify(data) })
}

export async function getOrderCount(): Promise<number> {
  const res = await apiFetch("/orders/count")
  return res.count
}

export async function getOrders(orderNumber?: number): Promise<Order[]> {
  const query = orderNumber !== undefined ? `?orderNumber=${encodeURIComponent(orderNumber)}` : ""
  return apiFetch(`/orders${query}`)
}

export async function voidOrder(orderId: string, voidedById: string, reason?: string): Promise<Order> {
  return apiFetch(`/orders/${orderId}/void`, {
    method: "POST",
    body: JSON.stringify({ voidedById, reason }),
  })
}

export async function updateOrderPayment(orderId: string, paymentMethod: "cash" | "mpesa", paymentType?: "SINGLE" | "BATCH", batchId?: string): Promise<Order> {
  return apiFetch(`/orders/${orderId}/payment`, {
    method: "PATCH",
    body: JSON.stringify({ paymentMethod, paymentType, batchId }),
  })
}

export async function previewReceipt(data: ReceiptData): Promise<string> {
  if (window.electron?.print?.preview) {
    return window.electron.print.preview(data)
  }
  throw new Error("Receipt preview is only available in the desktop app")
}

export async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  if (window.electron?.print?.receipt) {
    return window.electron.print.receipt(data)
  }
  return { ok: true }
}

export async function previewShiftReport(data: ShiftReportData): Promise<string> {
  if (window.electron?.print?.previewShiftReport) {
    return window.electron.print.previewShiftReport(data)
  }
  throw new Error("Shift report preview is only available in the desktop app")
}

export async function printShiftReport(data: ShiftReportData): Promise<PrintResult> {
  if (window.electron?.print?.printShiftReport) {
    return window.electron.print.printShiftReport(data)
  }
  return { ok: true }
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

export async function openShift(type: ShiftType, openedById: string): Promise<Shift> {
  return apiFetch("/shifts/open", {
    method: "POST",
    body: JSON.stringify({ type, openedById }),
  })
}

export async function closeShift(shiftId: string, closedById: string): Promise<Shift> {
  return apiFetch(`/shifts/${shiftId}/close`, {
    method: "POST",
    body: JSON.stringify({ closedById }),
  })
}

export async function getCurrentShift(): Promise<Shift | null> {
  return apiFetch("/shifts/current")
}

export async function getShift(shiftId: string): Promise<Shift> {
  return apiFetch(`/shifts/${shiftId}`)
}

export async function listShifts(date?: string): Promise<Shift[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  return apiFetch(`/shifts${query}`)
}

export async function autoCloseShifts(): Promise<AutoCloseResult> {
  return apiFetch("/shifts/auto-close", { method: "POST" })
}

export async function getShiftReport(shiftId: string): Promise<ShiftReport> {
  return apiFetch(`/reports/shift/${shiftId}`)
}

export async function getVoidReport(date: string): Promise<VoidReportWaiter[]> {
  const data = (await apiFetch(
    `/reports/voids?date=${encodeURIComponent(date)}`
  )) as { date: string; waiters: VoidReportWaiter[] }
  return data.waiters
}

// ─── POS Printer Config ──────────────────────────────────────────────────────

const PRINTER_STORAGE_KEY = "eraeva.printers.v1"

export async function getPrinterConfig(): Promise<PosPrinterConfig> {
  if (window.electron?.printer?.getConfig) {
    return window.electron.printer.getConfig()
  }
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PosPrinterConfig) : { printers: [] }
  } catch {
    return { printers: [] }
  }
}

export async function savePrinterConfig(config: PosPrinterConfig): Promise<PosPrinterConfig> {
  if (window.electron?.printer?.saveConfig) {
    return window.electron.printer.saveConfig(config)
  }
  localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(config))
  return config
}

export async function listPrinterDevices(): Promise<string[]> {
  if (window.electron?.printer?.listDevices) {
    return window.electron.printer.listDevices()
  }
  return []
}

export async function checkPrinterStatus(printer: PosPrinter): Promise<PrinterStatus> {
  if (window.electron?.printer?.checkStatus) {
    return window.electron.printer.checkStatus(printer)
  }
  return { online: null, reason: "Status unavailable in browser mode" }
}

export async function testPrinter(printer: PosPrinter): Promise<PrintResult> {
  if (window.electron?.printer?.test) {
    return window.electron.printer.test(printer)
  }
  return { ok: false, error: "Test print is only available in the desktop app" }
}

// ─── Server Config ───────────────────────────────────────────────────────────

const SERVER_STORAGE_KEY = "eraeva.server-config.v1"

function toApiBase(value: string): string {
  const v = value.trim().replace(/\/+$/, "")
  return v.endsWith("/api") ? v : `${v}/api`
}

export async function getServerConfig(): Promise<ServerConfig> {
  if (window.electron?.serverConfig?.getConfig) {
    return window.electron.serverConfig.getConfig()
  }
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ServerConfig) : {}
  } catch {
    return {}
  }
}

export async function saveServerConfig(config: ServerConfig): Promise<ServerConfig> {
  if (window.electron?.serverConfig?.saveConfig) {
    return window.electron.serverConfig.saveConfig(config)
  }
  localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(config))
  return config
}

export async function getServerApiBase(): Promise<string> {
  if (window.electron?.serverConfig?.getApiBase) {
    return window.electron.serverConfig.getApiBase()
  }
  const config = await getServerConfig()
  if (config.serverUrl) return toApiBase(config.serverUrl)
  return import.meta.env.VITE_API_BASE ?? `${API_ORIGIN}/api`
}

export async function testServerConnection(): Promise<ServerStatus> {
  if (window.electron?.serverConfig?.test) {
    return window.electron.serverConfig.test()
  }
  const base = await getServerApiBase()
  const origin = base.replace(/\/api$/, "")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${origin}/health`, { signal: controller.signal })
    return { online: res.ok, reason: res.ok ? "Server reachable" : `HTTP ${res.status}` }
  } catch (err) {
    return { online: false, reason: err instanceof Error ? err.message : "Unreachable" }
  } finally {
    clearTimeout(timer)
  }
}

// ─── User Management ────────────────────────────────────────────────────────

export async function getUsers(): Promise<AdminUser[]> {
  return apiFetch("/users")
}

export async function createUser(data: AdminUserCreateData): Promise<AdminUser> {
  return apiFetch("/users", { method: "POST", body: JSON.stringify(data) })
}

export async function updateUser(id: string, data: AdminUserUpdateData): Promise<AdminUser> {
  return apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteUser(id: string): Promise<{ message: string }> {
  return apiFetch(`/users/${id}`, { method: "DELETE" })
}
