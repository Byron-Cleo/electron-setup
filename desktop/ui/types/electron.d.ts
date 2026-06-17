interface MealType {
  id: string;
  name: string;
  sortOrder: number;
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
}

interface Window {
  electron: ElectronAPI;
}
