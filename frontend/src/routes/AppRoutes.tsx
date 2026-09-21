import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute, UnauthorizedPage } from './ProtectedRoute';

// Hiển thị bộ nạp trang mượt mà trong khi tải các chunk mã nguồn (Lazy Loading)
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400 animate-in fade-in">
    <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-semibold text-slate-500">Đang tải phân hệ...</span>
  </div>
);

// 1. Tải tĩnh trang đăng nhập chính để người dùng mở ứng dụng tức thì không phải chờ
import { LoginPage } from '../pages/auth/LoginPage';

// 2. Code-Splitting: Lazy loading các trang tính năng nặng để giảm bundle chính
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const DepartmentsPage = lazy(() => import('../pages/admin/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const ShiftsPage = lazy(() => import('../pages/admin/ShiftsPage').then((m) => ({ default: m.ShiftsPage })));
const UsersPage = lazy(() => import('../pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const SchedulesPage = lazy(() => import('../pages/schedule/SchedulesPage').then((m) => ({ default: m.SchedulesPage })));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const AttendanceCheckInPage = lazy(() => import('../pages/AttendanceCheckInPage').then((m) => ({ default: m.AttendanceCheckInPage })));
const AttendanceHistoryPage = lazy(() => import('../pages/AttendanceHistoryPage').then((m) => ({ default: m.AttendanceHistoryPage })));
const FaceRegistrationPage = lazy(() => import('../pages/FaceRegistrationPage').then((m) => ({ default: m.FaceRegistrationPage })));
const FaceCheckInKiosk = lazy(() => import('../pages/FaceCheckInKiosk').then((m) => ({ default: m.FaceCheckInKiosk })));

// Phân hệ Đơn từ & Báo cáo & AI
const CreateLeavePage = lazy(() => import('../pages/leave/CreateLeavePage'));
const MyLeaveRequestsPage = lazy(() => import('../pages/leave/MyLeaveRequestsPage'));
const LeaveApprovalsPage = lazy(() => import('../pages/leave/LeaveApprovalsPage'));
const AttendanceDashboardPage = lazy(() => import('../pages/dashboard/AttendanceDashboardPage'));
const AiInspectorPage = lazy(() => import('../pages/ai/AiInspectorPage'));

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* 1. Tuyến đường công khai */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/kiosk" element={<FaceCheckInKiosk />} />

          {/* 2. Tuyến đường bảo vệ bắt buộc đăng nhập */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* Dashboard & Tổng quan */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/dashboard/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'truongkhoa']}>
                    <AttendanceDashboardPage />
                  </ProtectedRoute>
                }
              />

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

              {/* Báo cáo thống kê (Admin & Trưởng khoa) */}
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
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
