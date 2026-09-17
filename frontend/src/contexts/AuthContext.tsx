import React, { createContext, useContext, useEffect, useState } from 'react';
import { Role, User } from '../types';
import { tokenStorage } from '../utils';
import { axiosClient } from '../api/axiosClient';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  hasRole: (roles: Role | Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => tokenStorage.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        try {
          const res = (await axiosClient.get('/auth/me')) as unknown as { success: boolean; data: User };
          const userData = res?.data;
          if (userData) {
            setUser(userData);
            tokenStorage.setUser(userData);
          }
        } catch {
          tokenStorage.clear();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (accessToken: string, newUser: User) => {
    tokenStorage.setAccessToken(accessToken);
    tokenStorage.setUser(newUser);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await axiosClient.post('/auth/logout');
    } catch {
      // Bỏ qua lỗi nếu logout backend thất bại
    } finally {
      tokenStorage.clear();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const hasRole = (roles: Role | Role[]): boolean => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
