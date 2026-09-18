import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Role, User } from '../types';
import { tokenStorage } from '../utils';
import { authService } from '../services/authService';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  hasRole: (roles: Role | Role[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => tokenStorage.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hàm tải lại thông tin người dùng từ server
  const refreshUser = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const userData = await authService.getMe();
      if (userData) {
        setUser(userData);
        tokenStorage.setUser(userData);
      }
    } catch (error) {
      console.error('[AuthContext] Lỗi khi làm mới thông tin user:', error);
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  // Khởi tạo phiên đăng nhập khi tải ứng dụng
  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        await refreshUser();
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  // Xử lý khi đăng nhập thành công
  const login = (token: string, newUser: User, _refreshToken?: string) => {
    tokenStorage.clear();
    tokenStorage.setAccessToken(token);
    tokenStorage.setUser(newUser);
    setUser(newUser);
  };

  // Xử lý đăng xuất
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('[AuthContext] Lỗi khi gọi API logout:', error);
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  };

  // Kiểm tra vai trò của người dùng
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
        refreshUser,
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
