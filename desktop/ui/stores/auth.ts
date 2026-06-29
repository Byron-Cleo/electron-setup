import { create } from "zustand";

const API_BASE = "http://localhost:3001/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

async function apiLogin(pin: string): Promise<LoginResponse> {
  if (window.electron?.auth) {
    return window.electron.auth.login(pin);
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Login failed");
  }
  return res.json();
}

async function apiLogout(): Promise<void> {
  if (window.electron?.auth) {
    await window.electron.auth.logout();
    return;
  }
  await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  login: async (pin: string) => {
    set({ loading: true, error: null });
    try {
      const { user } = await apiLogin(pin);
      set({ user, loading: false });
    } catch {
      set({ error: "Invalid PIN. Please try again.", loading: false });
    }
  },
  logout: async () => {
    try {
      await apiLogout();
    } finally {
      set({ user: null, error: null });
    }
  },
  clearError: () => set({ error: null }),
}));
