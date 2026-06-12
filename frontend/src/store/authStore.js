import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      // Convenience getters
      isSuperAdmin: () => get().user?.role === 'SUPER_ADMIN',
      isTenantAdmin: () => get().user?.role === 'TENANT_ADMIN',
      isStaff: () => get().user?.role === 'STAFF',
      hasRole: (...roles) => roles.includes(get().user?.role),
    }),
    {
      name: 'mashroute-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
