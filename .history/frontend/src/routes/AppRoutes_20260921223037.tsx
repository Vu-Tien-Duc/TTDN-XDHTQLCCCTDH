import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute, UnauthorizedPage } from './ProtectedRoute';

// Các trang từ HEAD (Phân hệ A & B)
import {
  LoginPage,
  DashboardPage,
  DepartmentsPage,
  ShiftsPage,
  UsersPage,
  SchedulesPage,
  ProfilePage,
  AuditLogsPage,
  AttendanceCheckInPage,
  FaceRegistrationPage,
  FaceCheckInKiosk,
  AttendanceHistoryPage,
} from '../pages';

// Các trang từ DUY (Phân hệ C & AI)
import CreateLeavePage from '../pages/leave/CreateLeavePage';
import MyLeaveRequestsPage from '../pages/leave/MyLeaveRequestsPage';
import LeaveApprovalsPage from '../pages/leave/LeaveApprovalsPage';
import AttendanceDashboardPage from '../pages/dashboard/AttendanceDashboardPage';
import AiInspectorPage from '../pages/ai/AiInspectorPage';

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Tuyến đường công khai: Mặc định vào thẳng trang đăng nhập khi mở ứng dụng */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/kiosk" element={<FaceCheckInKiosk />} />

        {/* 2. Tuyến đường bảo vệ bắt buộc đăng nhập */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
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

            {/* Đăng ký Face ID (Chỉ Admin) */}
            <Route
              path="/face-registration"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <FaceRegistrationPage />
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
            <Route path="/attendance/check-in" element={<AttendanceCheckInPage />} />
            <Route path="/attendance/history" element={<AttendanceHistoryPage />} />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                  <AttendanceDashboardPage />
                </ProtectedRoute>
              }
            />

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

        {/* 3. Catch-all: Chuyển về trang đăng nhập */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
