import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarDays,
  FilePlus2,
  FileText,
  FileCheck2,
  BarChart3,
  Bot,
  ShieldAlert,
  Bell,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { axiosClient } from '../api/axiosClient';
import { Role } from '../types';
import { ROLE_LABELS, cn } from '../utils';
import { toast } from 'react-hot-toast';
import AiChatWidget from '../components/ai/AiChatWidget';

interface SidebarMenuItem {
  title: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  allowedRoles: Role[];
  description: string;
  highlight?: boolean;
}

const MENU_ITEMS: SidebarMenuItem[] = [
  {
    title: 'Bảng Điều Khiển',
    path: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['truongkhoa', 'giangvien', 'nhanvien'],
    description: 'Tổng quan chỉ số & lịch trình',
  },
  {
    title: 'Cơ Cấu Tổ Chức',
    path: '/departments',
    icon: Building2,
    allowedRoles: ['admin'],
    description: 'Quản lý Trường > Khoa > Bộ môn',
  },
  {
    title: 'Quản Lý Cán Bộ',
    path: '/users',
    icon: Users,
    allowedRoles: ['admin', 'truongkhoa'],
    description: 'Danh sách nhân sự & tài khoản',
  },
  {
    title: 'Danh Mục Ca Dạy',
    path: '/shifts',
    icon: Clock,
    allowedRoles: ['admin'],
    description: 'Khung giờ ca học & ngưỡng trễ',
  },
  {
    title: 'Lịch Giảng Dạy & Công Tác',
    path: '/schedules',
    icon: CalendarDays,
    allowedRoles: ['truongkhoa', 'giangvien', 'nhanvien'],
    description: 'Thời khóa biểu & lịch học kỳ',
  },
  {
    title: 'Tạo Đơn Xin Nghỉ',
    path: '/leave/create',
    icon: FilePlus2,
    allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    description: 'Nghỉ phép, dạy bù & đổi ca',
  },
  {
    title: 'Đơn Nghỉ Của Tôi',
    path: '/leave/my-requests',
    icon: FileText,
    allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    description: 'Theo dõi tiến độ duyệt đơn',
  },
  {
    title: 'Hộp Duyệt Đơn',
    path: '/leave/approvals',
    icon: FileCheck2,
    badge: 'Quản lý',
    allowedRoles: ['admin', 'truongkhoa'],
    description: 'Phê duyệt đơn nghỉ của khoa',
  },
  {
    title: 'Báo Cáo & Thống Kê',
    path: '/reports',
    icon: BarChart3,
    allowedRoles: ['admin', 'truongkhoa'],
    description: 'Tổng hợp công tháng & tỷ lệ',
  },
  {
    title: 'Trợ Lý Thanh Tra AI',
    path: '/ai-assistant',
    icon: Bot,
    badge: 'AI ✨',
    highlight: true,
    allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    description: 'Giám sát & truy vấn thông minh',
  },
  {
    title: 'Nhật Ký Kiểm Toán',
    path: '/audit-logs',
    icon: ShieldAlert,
    allowedRoles: ['admin'],
    description: 'Truy vết thao tác nhạy cảm',
  },
];

export const MainLayout: React.FC = () => {
  const { user, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  // Danh sách tài khoản demo phục vụ hội đồng nghiệm thu & kiểm thử
  const demoAccounts = [
    {
      role: 'admin',
      name: 'Ban Giám Hiệu (Admin)',
      email: 'daihocdtd@gmail.com',
      badge: 'Admin',
    },
    {
      role: 'truongkhoa',
      name: 'Trưởng Khoa CNTT',
      email: 'truongkhoa.cntt@university.edu.vn',
      badge: 'Trưởng Khoa',
    },
    {
      role: 'giangvien',
      name: 'TS. Trần Thị Bích',
      email: 'giangvien.bich@university.edu.vn',
      badge: 'Giảng Viên',
    },
  ];

  const handleQuickSwitch = async (email: string) => {
    setIsSwitchingAccount(true);
    try {
      const res = (await axiosClient.post('/auth/login', {
        email,
        password: 'password123',
      })) as unknown as {
        success: boolean;
        message?: string;
        data?: { accessToken: string; user: import('../types').User };
      };

      if (res.success && res.data) {
        login(res.data.accessToken, res.data.user);
        toast.success(`Đã chuyển sang: ${res.data.user.fullName} (${res.data.user.role})`, {
          icon: '🔄',
        });
      }
    } catch {
      toast.error('Không thể chuyển đổi tài khoản demo. Vui lòng kiểm tra backend.');
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  // Lọc danh sách menu dựa theo vai trò của người dùng
  const visibleMenuItems = MENU_ITEMS.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Đã đăng xuất khỏi hệ thống.');
      navigate('/login');
    } catch {
      toast.error('Lỗi khi đăng xuất.');
    }
  };

  // Xác định tiêu đề trang hiện tại
  const currentMenuItem = MENU_ITEMS.find((item) =>
    location.pathname === item.path ||
    (item.path !== '/' && item.path !== '/dashboard' && location.pathname.startsWith(item.path))
  );
  const pageTitle = currentMenuItem ? currentMenuItem.title : 'Bảng Điều Khiển';

  // Lấy màu sắc đặc trưng theo vai trò
  const getRoleBadgeStyle = (role?: Role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'truongkhoa':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'giangvien':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'nhanvien':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Rút gọn họ tên thành chữ cái đầu viết hoa cho avatar
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ========================================================= */}
      {/* 1. SIDEBAR (Khung trái) */}
      {/* ========================================================= */}

      {/* Backdrop mờ khi mở Sidebar trên Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity print:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 shadow-xl lg:shadow-none print:hidden',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xs tracking-tight text-white leading-none">ĐH CÔNG NGHỆ & KHOA HỌC</h1>
              <p className="text-[10px] text-blue-400 font-medium tracking-wide mt-1">HỆ THỐNG QUẢN LÝ CHẤM CÔNG</p>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card Mini in Sidebar */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300 font-bold text-sm flex items-center justify-center">
            {getInitials(user?.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'Người dùng'}</p>
            <span
              className={cn(
                'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1',
                getRoleBadgeStyle(user?.role)
              )}
            >
              {user ? ROLE_LABELS[user.role] : 'Khách'}
            </span>
          </div>
        </div>

        {/* Quick Demo Switcher inside Sidebar for Mobile/Tablet */}
        <div className="px-3 pb-2 xl:hidden">
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chuyển tài khoản demo:</p>
            <div className="grid grid-cols-3 gap-1">
              {demoAccounts.map((acc) => {
                const isActive = user?.email === acc.email;
                return (
                  <button
                    key={acc.email}
                    disabled={isSwitchingAccount || isActive}
                    onClick={() => handleQuickSwitch(acc.email)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[10px] font-bold text-center transition',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                    )}
                  >
                    {acc.badge}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation Menu List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Phân hệ chức năng
          </div>

          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all',
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                      : item.highlight
                      ? 'text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 hover:bg-indigo-900/40 hover:text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{item.title}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold',
                        item.highlight
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                          : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Phiên bản v1.0.0</span>
            </span>
            <a
              href="/api-docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-blue-400 transition"
              title="Mở tài liệu Swagger API"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT WRAPPER */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ========================================================= */}
        {/* HEADER (Thanh điều hướng trên) */}
        {/* ========================================================= */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs print:hidden">
          {/* Trái: Nút bật Sidebar trên Mobile & Tiêu đề Trang */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{pageTitle}</h2>
              <p className="hidden sm:block text-xs text-slate-500">Hệ thống Quản lý Chấm công & Lịch công tác ĐH</p>
            </div>
          </div>

          {/* Phải: Demo Quick Switcher + Chuông thông báo + Profile User + Nút Đăng xuất */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Demo Account Switcher (Header) */}
            <div className="hidden xl:flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Demo:</span>
              {demoAccounts.map((acc) => {
                const isActive = user?.email === acc.email;
                return (
                  <button
                    key={acc.email}
                    disabled={isSwitchingAccount || isActive}
                    onClick={() => handleQuickSwitch(acc.email)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    {acc.badge}
                  </button>
                );
              })}
            </div>

            {/* Chuông Thông Báo */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                className="relative p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition"
                title="Thông báo hệ thống"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white ring-1 ring-rose-500" />
              </button>

              {/* Popover thông báo */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <h4 className="text-sm font-bold text-slate-900">Thông báo mới</h4>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        2 chưa đọc
                      </span>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 transition cursor-pointer border border-slate-100">
                        <p className="font-semibold text-slate-800">Đơn xin nghỉ phép đã được phê duyệt</p>
                        <p className="text-slate-500 mt-0.5">Trưởng khoa đã duyệt đơn xin nghỉ phép ngày mai của bạn.</p>
                        <span className="text-[10px] text-slate-400 mt-1.5 block">10 phút trước</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 transition cursor-pointer border border-slate-100">
                        <p className="font-semibold text-slate-800">Nhắc nhở chấm công ca sáng</p>
                        <p className="text-slate-500 mt-0.5">Ca dạy Tiết 1-4 tại Phòng A2-301 bắt đầu lúc 07:00.</p>
                        <span className="text-[10px] text-slate-400 mt-1.5 block">1 giờ trước</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Pill & Actions */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {getInitials(user?.fullName)}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                    {user?.fullName || 'Người dùng'}
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight">
                    {user ? ROLE_LABELS[user.role] : 'Cán bộ'}
                  </span>
                </div>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user?.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      <span
                        className={cn(
                          'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-2',
                          getRoleBadgeStyle(user?.role)
                        )}
                      >
                        {user ? ROLE_LABELS[user.role] : 'Cán bộ'}
                      </span>
                    </div>

                    <div className="p-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất tài khoản</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Nút Đăng Xuất Nhanh Ngoài Header */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition border border-rose-100"
              title="Đăng xuất khỏi phiên làm việc"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* NỘI DUNG CHÍNH CỦA TRANG (Page Content Outlet) */}
        {/* ========================================================= */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. TRỢ LÝ AI NỔI (Floating AI Chat Widget) */}
      {/* ========================================================= */}
      <div className="print:hidden">
        <AiChatWidget />
      </div>
    </div>
  );
};

export default MainLayout;
