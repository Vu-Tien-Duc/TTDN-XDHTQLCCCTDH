import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { axiosClient } from '../api/axiosClient';
import MainLayout from '../layouts/MainLayout';
import CreateLeavePage from '../pages/leave/CreateLeavePage';
import MyLeaveRequestsPage from '../pages/leave/MyLeaveRequestsPage';
import LeaveApprovalsPage from '../pages/leave/LeaveApprovalsPage';
import AttendanceDashboardPage from '../pages/dashboard/AttendanceDashboardPage';
import AiInspectorPage from '../pages/ai/AiInspectorPage';
import RoleGuard from './RoleGuard';

export const AppRoutes: React.FC = () => {
  const { user, login, isLoading } = useAuth();

  // Tự động khởi tạo phiên đăng nhập với Giảng viên mẫu nếu chưa có phiên
  useEffect(() => {
    const autoInitDemoAuth = async () => {
      if (!user && !isLoading) {
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
          // Bỏ qua lỗi nếu backend chưa seed
        }
      }
    };

    autoInitDemoAuth();
  }, [user, isLoading, login]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Default redirect to Dashboard */}
          <Route index element={<Navigate to="/dashboard/reports" replace />} />

          {/* Task 5 & 6: Dashboard & Reports */}
          <Route path="dashboard/reports" element={<AttendanceDashboardPage />} />

          {/* Task 1: Create Leave Request */}
          <Route path="leave/create" element={<CreateLeavePage />} />

          {/* Task 2: My Requests */}
          <Route path="leave/my-requests" element={<MyLeaveRequestsPage />} />

          {/* Task 3: Approvals (Dean & Admin) */}
          <Route
            path="leave/approvals"
            element={
              <RoleGuard allowedRoles={['admin', 'truongkhoa']}>
                <LeaveApprovalsPage />
              </RoleGuard>
            }
          />

          {/* Task 7: Gemini AI Inspector */}
          <Route path="ai-assistant" element={<AiInspectorPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard/reports" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
