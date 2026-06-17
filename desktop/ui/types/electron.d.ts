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
  accompanyId: string | null;
  vegetableId: string | null;
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
    create: (data: MenuCreateData) => Promise<MenuItem>;
    update: (id: string, data: MenuUpdateData) => Promise<MenuItem>;
    delete: (id: string) => Promise<{ message: string }>;
  };
}

interface Window {
  electron: ElectronAPI;
}
