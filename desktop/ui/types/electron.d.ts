interface Accompaniment {
  id: string
  name: string
  category: string
  description: string | null
  price: number | null
  image: string
  isDefault: boolean
  createdAt: string
}

interface AccompanimentCreateData {
  name: string
  category: string
  description?: string
  price?: number
  image?: string
  isDefault?: boolean
}

type AccompanimentUpdateData = Partial<AccompanimentCreateData>;

interface MealType {
  id: string;
  name: string;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  images: string[];
  stock: number;
  price: number;
  availablePlates?: number;
  numReviews: number;
  isAvailable: boolean;
  banner: string | null;
  createdAt: string;
  starchId: string | null;
  vegetableId: string | null;
  mealTypes: string[];
  starch: { name: string; price: number } | null;
  vegetable: { name: string; price: number } | null;
}

interface MenuCreateData {
  name: string;
  slug?: string;
  category: string;
  stock?: number;
  price: number;
  mealTypes: string[];
  starchId?: string | null;
  vegetableId?: string | null;
}

type MenuUpdateData = Partial<MenuCreateData>;

interface OrderAccompaniment {
  id: string;
  name: string;
  category: string;
  price: number | null;
  isDefault: boolean;
}

interface OrderLineItem {
  menuItem: MenuItem;
  quantity: number;
  starch: OrderAccompaniment | null;
  vegetable: OrderAccompaniment | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: string | null;
  image: string | null;
  role: "admin" | "waiter" | "store" | "kitchen";
  isActive: boolean;
  platform: string | null;
  address: unknown;
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LoginResponse {
  user: User;
}

interface StockSupply {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  unit: "KG" | "PKT" | "L" | "ML" | "PCS";
  currentStock: number;
  reorderLevel: number | null;
  image: string | null;
  isMenuStock: boolean;
  platesPerUnit: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  menus?: { id: string; name: string }[];
  departments?: Department[];
}

interface StockSupplyCreateData {
  name: string;
  slug?: string;
  description?: string;
  unit: "KG" | "PKT" | "L" | "ML" | "PCS";
  currentStock?: number;
  reorderLevel?: number;
  isMenuStock?: boolean;
  menuIds?: string[];
  departmentIds?: string[];
}

interface StockSupplyUpdateData {
  name?: string;
  slug?: string;
  description?: string;
  unit?: "KG" | "PKT" | "L" | "ML" | "PCS";
  currentStock?: number;
  reorderLevel?: number;
  isActive?: boolean;
  isMenuStock?: boolean;
  menuIds?: string[];
  departmentIds?: string[];
}

type StockRequestStatus = "PENDING" | "PARTIAL" | "COMPLETED";

interface StockRequestItem {
  id: string;
  stockRequestId: string;
  stockSupplyId: string;
  quantityRequested: number;
  quantityDelivered: number;
  createdAt: string;
  updatedAt: string;
  stockSupply: StockSupply;
}

interface StockRequest {
  id: string;
  requestedById: string;
  department: string;
  status: StockRequestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy: { id: string; name: string };
  items: StockRequestItem[];
  fulfillments?: StockFulfillment[];
}

interface CreateStockRequestData {
  requestedById: string;
  department: string;
  notes?: string;
  items: { stockSupplyId: string; quantityRequested: number }[];
}

interface FulfillStockRequestData {
  fulfilledById: string;
  notes?: string;
  items: { stockRequestItemId: string; quantityDelivered: number }[];
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  DepartmentStockSupply?: DepartmentStockSupply[];
}

interface DepartmentStockSupply {
  id: string;
  departmentId: string;
  stockSupplyId: string;
  createdAt: string;
  stockSupply?: { id: string; name: string; unit: string; currentStock?: number };
}

interface CreateDepartmentData {
  name: string;
  description?: string;
}

type UpdateDepartmentData = Partial<CreateDepartmentData>;

interface StockFulfillment {
  id: string;
  stockRequestId: string;
  fulfilledById: string;
  notes: string | null;
  createdAt: string;
  fulfilledBy: { id: string; name: string };
  items: StockFulfillmentItem[];
}

interface StockFulfillmentItem {
  id: string;
  stockFulfillmentId: string;
  stockRequestItemId: string;
  quantityDelivered: number;
  createdAt: string;
}

interface CookingRecord {
  id: string;
  stockSupplyId: string;
  quantityCooked: number;
  platesExpected: number;
  platesActual: number | null;
  cookedDate: string;
  cookedById: string;
  notes: string | null;
  createdAt: string;
  stockSupply: { id: string; name: string; unit: string; platesPerUnit: number | null; menus: { id: string; name: string }[] };
  cookedBy: { id: string; name: string };
  assignments: CookingRecordAssignment[];
  availablePlates?: number;
}

interface CookingRecordAssignment {
  id: string;
  cookingRecordId: string;
  menuId: string;
  quantityPlates: number;
  createdAt: string;
  menu: { id: string; name: string; slug: string; images: string[] };
}

interface CreateCookingRecordData {
  stockSupplyId: string;
  quantityCooked: number;
  platesActual?: number;
  cookedById: string;
  notes?: string;
}

interface UpdateCookingRecordData {
  quantityCooked?: number;
  platesActual?: number;
  notes?: string;
}

interface CookedMenuItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  images: string[];
  stockSupply: {
    id: string;
    name: string;
    unit: string;
    platesPerUnit: number | null;
    image: string | null;
  } | null;
  cooking: {
    totalProduced: number;
    totalAssigned: number;
    totalAvailable: number;
  };
}

interface KitchenStockItem {
  id: string;
  name: string;
  slug: string;
  unit: string;
  isMenuStock: boolean;
  platesPerUnit: number | null;
  image: string | null;
  menu: { id: string; name: string; slug: string; images: string[] } | null;
  totalOrdered: number;
  totalCooked: number;
  rawStockPending: number;
  totalPlatesProduced: number;
  lastCookedDate: string | null;
}

interface KitchenInventory {
  id: string;
  name: string;
  unit: string;
  isMenuStock: boolean;
  platesPerUnit: number | null;
  menus: { id: string; name: string }[];
  totalReceived: number;
  totalCooked: number;
  kitchenInventory: number;
}

interface KitchenConfigItem {
  id: string;
  name: string;
  unit: string;
  image: string | null;
  currentStock: number;
  reorderLevel: number | null;
  isMenuStock: boolean;
  platesPerUnit: number | null;
  menus: { id: string; name: string }[];
}

interface KitchenConfigData {
  platesPerUnit?: number;
  menuIds?: string[];
}

type PosPrinterTransport = "usb" | "lan";
type PosPrinterRole = "customer" | "kitchen" | "bar";

interface PosPrinter {
  id: string;
  name: string;
  transport: PosPrinterTransport;
  role: PosPrinterRole;
  deviceName?: string;
  host?: string;
  port?: number;
}

interface PosPrinterConfig {
  printers: PosPrinter[];
}

interface ElectronAPI {
  subscribeStatistics: (callback: (statistics: any) => void) => void;
  getStaticData: () => void;
  mealType: {
    getAll: () => Promise<MealType[]>;
    getById: (id: string) => Promise<MealType>;
    create: (data: { name: string; sortOrder?: number }) => Promise<MealType>;
    update: (id: string, data: { name?: string; sortOrder?: number }) => Promise<MealType>;
    delete: (id: string) => Promise<{ message: string }>;
  };
  menu: {
    getAll: () => Promise<MenuItem[]>;
    getById: (id: string) => Promise<MenuItem>;
    getByMealType: (mealType: string) => Promise<MenuItem[]>;
    create: (data: MenuCreateData) => Promise<MenuItem>;
    update: (id: string, data: MenuUpdateData) => Promise<MenuItem>;
    delete: (id: string) => Promise<{ message: string }>;
  };
  auth: {
    login: (pin: string) => Promise<LoginResponse>;
    logout: () => Promise<{ message: string }>;
  };
  stockSupply: {
    getAll: (departmentId?: string) => Promise<StockSupply[]>;
    getById: (id: string) => Promise<StockSupply>;
    create: (data: StockSupplyCreateData) => Promise<StockSupply>;
    update: (id: string, data: StockSupplyUpdateData) => Promise<StockSupply>;
    delete: (id: string) => Promise<{ message: string; id: string }>;
    getLowStockCount: () => Promise<{ count: number }>;
    getStockCount: () => Promise<{ count: number }>;
    getKitchenInventory: (id: string) => Promise<KitchenInventory>;
  };
  stockRequest: {
    getAll: (status?: string) => Promise<StockRequest[]>;
    getById: (id: string) => Promise<StockRequest>;
    create: (data: CreateStockRequestData) => Promise<StockRequest>;
    fulfill: (id: string, data: FulfillStockRequestData) => Promise<StockRequest>;
  };
  department: {
    getAll: () => Promise<Department[]>;
    getById: (id: string) => Promise<Department>;
    create: (data: CreateDepartmentData) => Promise<Department>;
    update: (id: string, data: UpdateDepartmentData) => Promise<Department>;
    delete: (id: string) => Promise<{ message: string }>;
  };
  cookingRecord: {
    getAll: (stockSupplyId?: string) => Promise<CookingRecord[]>;
    create: (data: CreateCookingRecordData) => Promise<CookingRecord>;
    delete: (id: string) => Promise<{ message: string }>;
  };
  kitchen: {
    getConfig: () => Promise<KitchenConfigItem[]>;
    saveConfig: (id: string, data: KitchenConfigData) => Promise<KitchenConfigItem>;
  };
  printer: {
    getConfig: () => Promise<PosPrinterConfig>;
    saveConfig: (config: PosPrinterConfig) => Promise<PosPrinterConfig>;
    listDevices: () => Promise<string[]>;
  };
}

interface Window {
  electron: ElectronAPI;
}
