import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

export interface ProtectedRouteProps {
  allowedRoles?: Role[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // 1. Khi đang kiểm tra token / nạp thông tin user
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Đang xác thực thông tin đăng nhập...</p>
        </div>
      </div>
    );
  }

  // 2. Chưa đăng nhập -> Chuyển hướng về trang đăng nhập và lưu lại đường dẫn gốc
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Đã đăng nhập nhưng không có vai trò phù hợp
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 text-rose-600 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Truy cập bị từ chối (403)</h2>
        <p className="text-slate-600 text-sm mb-6">
          Tài khoản của bạn không có đủ quyền hạn để truy cập vào phân hệ này. Vui lòng liên hệ Quản trị viên để được cấp quyền.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm"
        >
          Quay lại Bảng điều khiển
        </Link>
      </div>
    </div>
  );
};

export const RoleGuard = ProtectedRoute;
export default ProtectedRoute;

