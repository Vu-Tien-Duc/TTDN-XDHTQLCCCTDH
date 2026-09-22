import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
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

  // Xử lý đăng xuất (thu hồi token và dọn dẹp storage)
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('[AuthContext] Lỗi khi gọi API logout:', error);
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

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
      // Nếu phiên làm việc đã hết hạn do không hoạt động quá lâu
      if (tokenStorage.isSessionExpired()) {
        tokenStorage.clear();
        setUser(null);
        setIsLoading(false);
        return;
      }

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

  // Giám sát hoạt động người dùng để phát hiện phiên không hoạt động quá lâu (Inactivity Timeout)
  useEffect(() => {
    if (!user) return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const handleUserActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        tokenStorage.updateActivity();
        throttleTimer = null;
      }, 10000); // Throttle 10s một lần
    };

    const checkInactivity = () => {
      if (tokenStorage.isSessionExpired()) {
        console.warn('[AuthContext] Phiên làm việc đã hết hạn do không hoạt động quá lâu.');
        logout();
        toast.error('Phiên làm việc đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.', {
          id: 'inactivity-timeout',
          duration: 5000,
        });
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkInactivity);

    // Kiểm tra định kỳ mỗi 30 giây
    const intervalId = setInterval(checkInactivity, 30000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkInactivity);
      clearInterval(intervalId);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [user, logout]);

  // Xử lý khi đăng nhập thành công
  const login = (token: string, newUser: User, _refreshToken?: string) => {
    tokenStorage.clear();
    tokenStorage.setAccessToken(token);
    tokenStorage.setUser(newUser);
    tokenStorage.updateActivity();
    setUser(newUser);

    // Đồng bộ ngay thông tin hồ sơ chi tiết (avatar, department populated) nếu thiếu
    if (!newUser.avatar) {
      refreshUser();
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
