interface Accompaniment {
  id: string
  name: string
  category: string
  price: number | null
  image: string | null
}

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
  brand: string;
  description: string;
  stock: number;
  price: number;
  rating: number;
  numReviews: number;
  isFeatured: boolean;
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
  brand: string;
  description: string;
  stock: number;
  price: number;
  isFeatured?: boolean;
}

type MenuUpdateData = Partial<MenuCreateData>;

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

interface StockSupplyCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { StockSupply: number };
}

interface StockSupplyCategoryCreateData {
  name: string;
  description?: string;
}

type StockSupplyCategoryUpdateData = Partial<StockSupplyCategoryCreateData>;

interface StockSupply {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  unit: "KG" | "G" | "L" | "ML" | "PCS";
  categoryId: string;
  currentStock: number;
  reorderLevel: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
}

interface StockSupplyCreateData {
  name: string;
  slug?: string;
  description?: string;
  unit: "KG" | "G" | "L" | "ML" | "PCS";
  categoryId: string;
  currentStock?: number;
  reorderLevel?: number;
}

interface StockSupplyUpdateData {
  name?: string;
  slug?: string;
  description?: string;
  unit?: "KG" | "G" | "L" | "ML" | "PCS";
  categoryId?: string;
  currentStock?: number;
  reorderLevel?: number;
  isActive?: boolean;
}

type StockRequestStatus = "PENDING" | "PARTIAL" | "APPROVED";

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
}

interface CreateStockRequestData {
  requestedById: string;
  department: string;
  notes?: string;
  items: { stockSupplyId: string; quantityRequested: number }[];
}

interface FulfillStockRequestData {
  items: { stockRequestItemId: string; quantityDelivered: number }[];
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
  stockSupplyCategory: {
    getAll: () => Promise<StockSupplyCategory[]>;
    getById: (id: string) => Promise<StockSupplyCategory>;
    create: (data: StockSupplyCategoryCreateData) => Promise<StockSupplyCategory>;
    update: (id: string, data: StockSupplyCategoryUpdateData) => Promise<StockSupplyCategory>;
    delete: (id: string) => Promise<{ message: string; id: string }>;
  };
  stockSupply: {
    getAll: () => Promise<StockSupply[]>;
    getById: (id: string) => Promise<StockSupply>;
    create: (data: StockSupplyCreateData) => Promise<StockSupply>;
    update: (id: string, data: StockSupplyUpdateData) => Promise<StockSupply>;
    delete: (id: string) => Promise<{ message: string; id: string }>;
  };
  stockRequest: {
    getAll: (status?: string) => Promise<StockRequest[]>;
    getById: (id: string) => Promise<StockRequest>;
    create: (data: CreateStockRequestData) => Promise<StockRequest>;
    fulfill: (id: string, data: FulfillStockRequestData) => Promise<StockRequest>;
  };
}

interface Window {
  electron: ElectronAPI;
}
