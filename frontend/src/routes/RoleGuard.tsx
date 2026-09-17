import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Role } from '../types';
import { tokenStorage } from '../utils';

export interface RoleGuardProps {
  allowedRoles?: Role[];
  children?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const location = useLocation();
  const token = tokenStorage.getAccessToken();
  const user = tokenStorage.getUser();

  // 1. Chưa đăng nhập -> Chuyển về màn hình đăng nhập
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Nếu có chỉ định quyền truy cập nhưng user không đủ quyền
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const ProtectedRoute = RoleGuard;
export default RoleGuard;
