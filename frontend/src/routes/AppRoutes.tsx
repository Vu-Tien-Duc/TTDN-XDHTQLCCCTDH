import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { axiosClient } from '../api/axiosClient';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute, UnauthorizedPage } from './ProtectedRoute';

// Các trang từ HEAD (Phân hệ A & B)
import {
  LoginPage,
  DashboardPage,
  PlaceholderPage,
  DepartmentsPage,
  ShiftsPage,
  UsersPage,
  SchedulesPage,
  ProfilePage,
  AuditLogsPage,
} from '../pages';

// Các trang từ DUY (Phân hệ C & AI)
import CreateLeavePage from '../pages/leave/CreateLeavePage';
import MyLeaveRequestsPage from '../pages/leave/MyLeaveRequestsPage';
import LeaveApprovalsPage from '../pages/leave/LeaveApprovalsPage';
import AttendanceDashboardPage from '../pages/dashboard/AttendanceDashboardPage';
import AiInspectorPage from '../pages/ai/AiInspectorPage';

export const AppRoutes: React.FC = () => {
  const { user, login, isLoading } = useAuth();

  // Tự động khởi tạo phiên demo Giảng viên nếu chưa đăng nhập và không ở trang login
  useEffect(() => {
    const autoInitDemoAuth = async () => {
      const isAuthPath =
        window.location.pathname === '/login' ||
        window.location.pathname === '/unauthorized';

      if (!user && !isLoading && !isAuthPath) {
        try {
          const res = (await axiosClient.post('/auth/login', {
            email: 'giangvien.bich@university.edu.vn',
            password: 'password123',
          })) as unknown as {
            success: boolean;
            data?: { accessToken: string; user: import('../types').User };
          };

          if (res.success && res.data) {
            login(res.data.accessToken, res.data.user);
          }
        } catch {
          // Bỏ qua nếu backend chưa seed dữ liệu
        }
      }
    };

    autoInitDemoAuth();
  }, [user, isLoading, login]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Tuyến đường công khai */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* 2. Tuyến đường bảo vệ bắt buộc đăng nhập */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard & Tổng quan */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/reports" element={<AttendanceDashboardPage />} />

            {/* Hồ sơ cá nhân */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* Phân hệ Quản trị Tổ chức & Nhân sự */}
            <Route
              path="/departments"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DepartmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />

            {/* Phân hệ Ca làm việc & Lịch công tác */}
            <Route
              path="/shifts"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ShiftsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/attendance" element={<AttendanceDashboardPage />} />

            {/* Phân hệ Đơn từ nghỉ phép (Phân hệ C) */}
            <Route
              path="/leave-requests"
              element={
                <ProtectedRoute allowedRoles={['truongkhoa', 'giangvien', 'nhanvien']}>
                  <MyLeaveRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leave/create"
              element={
                <ProtectedRoute allowedRoles={['truongkhoa', 'giangvien', 'nhanvien']}>
                  <CreateLeavePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leave/my-requests"
              element={
                <ProtectedRoute allowedRoles={['truongkhoa', 'giangvien', 'nhanvien']}>
                  <MyLeaveRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leave/approvals"
              element={
                <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                  <LeaveApprovalsPage />
                </ProtectedRoute>
              }
            />

            {/* Báo cáo thống kê */}
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                  <AttendanceDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Trợ lý Gemini AI */}
            <Route path="/ai-assistant" element={<AiInspectorPage />} />

            {/* Nhật ký kiểm toán hệ thống */}
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        {/* 3. Catch-all: Chuyển về Dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
