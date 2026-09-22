import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  User,
  UserCheck,
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
  ChevronLeft,
  Sparkles,
  ExternalLink,
  ScanFace,
  History,
  Scan,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { axiosClient } from '../api/axiosClient';
import { Role } from '../types';
import { ROLE_LABELS, cn, getSafeMediaUrl } from '../utils';
import { toast } from 'react-hot-toast';
import AiChatWidget from '../components/ai/AiChatWidget';
import { UserAvatar } from '../components';

interface SidebarMenuItem {
  title: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  allowedRoles: Role[];
  description: string;
  highlight?: boolean;
}

interface SidebarMenuGroup {
  groupId: string;
  groupTitle: string;
  items: SidebarMenuItem[];
}

const MENU_GROUPS: SidebarMenuGroup[] = [
  {
    groupId: 'overview',
    groupTitle: 'Tổng Quan',
    items: [
      {
        title: 'Bảng Điều Khiển',
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
        description: 'Tổng quan chỉ số & lịch trình',
      },
    ],
  },
  {
    groupId: 'academic',
    groupTitle: 'Giảng Dạy & Điểm Danh',
    items: [
      {
        title: 'Lịch Giảng Dạy & Công Tác',
        path: '/schedules',
        icon: CalendarDays,
        allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
        description: 'Thời khóa biểu & ca công tác',
      },
      {
        title: 'Điểm Danh Chấm Công',
        path: '/attendance/check-in',
        icon: UserCheck,
        allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
        description: 'Check-in & Check-out ca dạy',
      },
      {
        title: 'Lịch Sử Chấm Công',
        path: '/attendance/history',
        icon: History,
        allowedRoles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
        description: 'Tra cứu lịch sử & ảnh minh chứng',
      },
      {
        title: 'Kiosk Điểm Danh',
        path: '/kiosk',
        icon: ScanFace,
        badge: 'Kiosk',
        allowedRoles: ['admin', 'truongkhoa'],
        description: 'Màn hình Kiosk sảnh trường',
      },
    ],
  },
  {
    groupId: 'leave',
    groupTitle: 'Đơn Từ & Nghỉ Phép',
    items: [
      {
        title: 'Tạo Đơn Xin Nghỉ',
        path: '/leave/create',
        icon: FilePlus2,
        allowedRoles: ['truongkhoa', 'giangvien', 'nhanvien'],
        description: 'Nghỉ phép, dạy bù & đổi ca',
      },
      {
        title: 'Đơn Nghỉ Của Tôi',
        path: '/leave/my-requests',
        icon: FileText,
        allowedRoles: ['truongkhoa', 'giangvien', 'nhanvien'],
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
    ],
  },
  {
    groupId: 'administration',
    groupTitle: 'Quản Trị Tổ Chức',
    items: [
      {
        title: 'Cơ Cấu Tổ Chức',
        path: '/departments',
        icon: Building2,
        allowedRoles: ['admin'],
        description: 'Trường > Khoa > Bộ môn',
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
        title: 'Đăng Ký Face ID',
        path: '/face-registration',
        icon: Scan,
        badge: 'Mới',
        allowedRoles: ['admin'],
        description: 'Đăng ký vector khuôn mặt 128 số',
      },
    ],
  },
  {
    groupId: 'reports_ai',
    groupTitle: 'Báo Cáo & Hệ Thống AI',
    items: [
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
    ],
  },
];

const MENU_ITEMS = MENU_GROUPS.flatMap((group) => group.items);

export const MainLayout: React.FC = () => {
  const { user, logout, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: 'attendance' | 'leave' | 'report' | 'schedule' | 'system';
    status: 'success' | 'warning' | 'danger' | 'info';
    timestamp: string;
    link: string;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

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
    {
      role: 'nhanvien',
      name: 'Đỗ Thu Hà',
      email: 'nhanvien.ha@university.edu.vn',
      badge: 'Nhân Viên',
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

  // Lấy dữ liệu thông báo thực tế từ CSDL & email hệ thống
  const fetchRealNotifications = async () => {
    try {
      setIsLoadingNotifications(true);
      const lastRead = localStorage.getItem(`last_read_noti_${user?._id}`);
      const params = lastRead ? `?lastReadAt=${encodeURIComponent(lastRead)}` : '';
      const res = (await axiosClient.get(`/notifications${params}`)) as unknown as {
        success: boolean;
        data?: {
          total: number;
          unreadCount: number;
          notifications: Array<{
            id: string;
            title: string;
            message: string;
            type: 'attendance' | 'leave' | 'report' | 'schedule' | 'system';
            status: 'success' | 'warning' | 'danger' | 'info';
            timestamp: string;
            link: string;
          }>;
        };
      };

      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[Notifications] Lỗi tải thông báo thực tế:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  React.useEffect(() => {
    if (user) {
      fetchRealNotifications();
    }
  }, [user]);

  const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0) return 'Vừa xong';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  // Lọc danh sách menu phẳng & lọc nhóm phân cấp theo vai trò của người dùng
  const visibleMenuItems = MENU_ITEMS.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  const visibleMenuGroups = React.useMemo(() => {
    if (!user) return [];
    return MENU_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.allowedRoles.includes(user.role)),
    })).filter((group) => group.items.length > 0);
  }, [user]);

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
  const pageTitle =
    location.pathname === '/profile'
      ? 'Hồ Sơ Cán Bộ & Cá Nhân'
      : currentMenuItem
      ? currentMenuItem.title
      : 'Bảng Điều Khiển';

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
          'fixed lg:static inset-y-0 left-0 z-50 bg-gradient-to-b from-slate-950 via-[#0a1228] to-slate-950 text-slate-200 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl lg:shadow-none print:hidden select-none',
          isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72',
          'w-72 max-w-[calc(100vw-3rem)]',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* 1. Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
          {isSidebarCollapsed ? (
            <Link
              to="/dashboard"
              className="w-full flex items-center justify-center group relative py-1"
              title="ĐH Công Nghệ & Khoa Học - Bảng điều khiển"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              {/* Tooltip khi thu gọn */}
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold rounded-xl shadow-xl border border-slate-700 whitespace-nowrap hidden group-hover:block z-50 pointer-events-none">
                ĐH Công Nghệ & Khoa Học
              </div>
            </Link>
          ) : (
            <>
              <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-xs tracking-tight text-white leading-none truncate">
                    ĐH CÔNG NGHỆ & KHOA HỌC
                  </h1>
                  <p className="text-[10px] text-blue-400 font-semibold tracking-wide mt-1 truncate">
                    HỆ THỐNG QUẢN LÝ CHẤM CÔNG
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                {/* Nút thu gọn Sidebar trên Desktop */}
                <button
                  onClick={toggleSidebarCollapse}
                  className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                  title="Thu gọn thanh menu"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>

                {/* Nút đóng Sidebar trên Mobile */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Đóng menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 2. User Card Mini in Sidebar */}
        {isSidebarCollapsed ? (
          <div className="my-3 flex flex-col items-center justify-center">
            <Link
              to="/profile"
              className="relative group p-1 rounded-2xl hover:bg-slate-800/60 transition"
              title={`${user?.fullName || 'Người dùng'} (${user ? ROLE_LABELS[user.role] : 'Cán bộ'})`}
            >
              <UserAvatar
                user={user}
                src={user?.avatar}
                avatarUrl={user?.avatar}
                name={user?.fullName || 'Cán bộ'}
                size="md"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950 absolute bottom-1 right-1" />
              {/* Tooltip khi thu gọn */}
              <div className="absolute left-full ml-3.5 px-3 py-2 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl shadow-2xl border border-slate-700 whitespace-nowrap hidden group-hover:block z-50 pointer-events-none">
                <div className="font-bold text-slate-100">{user?.fullName}</div>
                <div className="text-[10px] text-blue-400 font-medium">{user ? ROLE_LABELS[user.role] : 'Cán bộ'}</div>
              </div>
            </Link>
          </div>
        ) : (
          <div className="p-3 mx-3 my-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3 shadow-xs backdrop-blur-sm group/user">
            <Link to="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition">
              <div className="relative shrink-0">
                <UserAvatar
                  user={user}
                  src={user?.avatar}
                  avatarUrl={user?.avatar}
                  name={user?.fullName || 'Cán bộ'}
                  size="md"
                />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 absolute bottom-0 right-0" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user?.fullName || 'Người dùng'}
                </p>
                <span
                  className={cn(
                    'inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full border mt-1 truncate',
                    getRoleBadgeStyle(user?.role)
                  )}
                >
                  {user ? ROLE_LABELS[user.role] : 'Khách'}
                </span>
              </div>
            </Link>

            {/* Phím tắt thao tác nhanh */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover/user:opacity-100 transition-opacity">
              <Link
                to="/profile"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Hồ sơ cá nhân"
              >
                <User className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Categorized Navigation Menu List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3 custom-scrollbar">
          {visibleMenuGroups.map((group, groupIndex) => {
            return (
              <div key={group.groupId} className="space-y-1">
                {/* Tiêu đề nhóm */}
                {isSidebarCollapsed ? (
                  groupIndex > 0 && <div className="border-t border-slate-800/80 my-2 mx-2" />
                ) : (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{group.groupTitle}</span>
                    <span className="text-[9px] text-slate-400 font-mono font-medium">({group.items.length})</span>
                  </div>
                )}

                {/* Danh sách mục trong nhóm */}
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (isSidebarCollapsed) {
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all relative group',
                            isActive
                              ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
                              : item.highlight
                              ? 'text-indigo-300 bg-indigo-950/40 border border-indigo-500/25 hover:bg-indigo-900/40 hover:text-white'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                          )
                        }
                      >
                        <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />

                        {/* Chấm badge nhỏ khi thu gọn */}
                        {item.badge && (
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full absolute top-1.5 right-1.5 ring-2 ring-slate-950',
                              item.highlight ? 'bg-indigo-400' : 'bg-amber-400'
                            )}
                          />
                        )}

                        {/* Floating Tooltip hiển thị sang phải khi thu gọn */}
                        <div className="absolute left-full ml-3.5 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold rounded-xl shadow-2xl border border-slate-700/80 whitespace-nowrap hidden group-hover:flex items-center gap-2 z-50 pointer-events-none animate-in fade-in slide-in-from-left-2">
                          <span>{item.title}</span>
                          {item.badge && (
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded text-[9px] font-bold',
                                item.highlight
                                  ? 'bg-indigo-500/30 text-indigo-300'
                                  : 'bg-amber-400/20 text-amber-300'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </NavLink>
                    );
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150',
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white font-semibold shadow-md shadow-blue-600/25 ring-1 ring-white/10'
                            : item.highlight
                            ? 'text-indigo-300 bg-indigo-950/40 border border-indigo-500/25 hover:bg-indigo-900/40 hover:text-white hover:border-indigo-400/40'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        )
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">{item.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge && (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight',
                              item.highlight
                                ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                                : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 group-hover:text-white" />
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 4. Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center justify-center gap-2">
              <button
                onClick={toggleSidebarCollapse}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition group relative"
                title="Mở rộng thanh menu"
              >
                <PanelLeftOpen className="w-5 h-5 text-blue-400" />
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold rounded-xl shadow-xl border border-slate-700 whitespace-nowrap hidden group-hover:block z-50 pointer-events-none">
                  Mở rộng thanh menu
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-medium">Phiên bản v1.0.0</span>
              </span>

              <div className="flex items-center gap-2">
                <a
                  href="/api-docs"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] hover:text-blue-400 transition"
                  title="Mở tài liệu Swagger API"
                >
                  <span>API</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                {/* Nút thu gọn Sidebar ở footer */}
                <button
                  onClick={toggleSidebarCollapse}
                  className="hidden lg:flex p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Thu gọn menu"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
          {/* Trái: Nút bật Sidebar trên Mobile / Thu gọn trên Desktop & Tiêu đề Trang */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Nút bật Sidebar trên Mobile */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition"
              title="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Nút Thu gọn / Mở rộng Sidebar trên Desktop */}
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition"
              title={isSidebarCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-blue-600" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-500" />
              )}
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{pageTitle}</h2>
              <p className="hidden sm:block text-xs text-slate-500">Hệ thống Quản lý Chấm công & Lịch công tác ĐH</p>
            </div>
          </div>

          {/* Phải: Chuông thông báo thực tế + Profile User + Nút Đăng xuất */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Chuông Thông Báo Thực Tế */}
            <div className="relative">
              <button
                onClick={() => {
                  const nextState = !showNotifications;
                  setShowNotifications(nextState);
                  setShowUserMenu(false);
                  if (nextState) {
                    if (user?._id) {
                      localStorage.setItem(`last_read_noti_${user._id}`, new Date().toISOString());
                    }
                    setUnreadCount(0);
                    fetchRealNotifications();
                  }
                }}
                className="relative p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition"
                title="Thông báo hệ thống & email"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Popover thông báo thực tế */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">Thông báo hệ thống & Email</h4>
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          {notifications.length} bản ghi
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (user?._id) {
                              localStorage.setItem(`last_read_noti_${user._id}`, new Date().toISOString());
                            }
                            setUnreadCount(0);
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition"
                        >
                          Đã đọc
                        </button>
                        <button
                          onClick={fetchRealNotifications}
                          disabled={isLoadingNotifications}
                          className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition"
                        >
                          {isLoadingNotifications ? 'Đang tải...' : 'Làm mới'}
                        </button>
                      </div>
                    </div>

                    {isLoadingNotifications ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Đang đồng bộ dữ liệu thông báo...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Chưa có thông báo mới. Mọi cập nhật điểm danh, duyệt đơn và email báo cáo sẽ hiển thị ở đây.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                        {notifications.map((item) => {
                          const getBadgeBg = (st: string) => {
                            switch (st) {
                              case 'success':
                                return 'bg-emerald-50 border-emerald-200 text-emerald-700';
                              case 'warning':
                                return 'bg-amber-50 border-amber-200 text-amber-700';
                              case 'danger':
                                return 'bg-rose-50 border-rose-200 text-rose-700';
                              case 'info':
                              default:
                                return 'bg-blue-50 border-blue-200 text-blue-700';
                            }
                          };

                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                setShowNotifications(false);
                                if (item.link) {
                                  navigate(item.link);
                                }
                              }}
                              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer border border-slate-200/80 group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition">
                                  {item.title}
                                </p>
                                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0', getBadgeBg(item.status))}>
                                  {item.type === 'attendance' ? 'Điểm danh' : item.type === 'leave' ? 'Đơn nghỉ' : item.type === 'schedule' ? 'Lịch dạy' : 'Báo cáo Email'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {item.message}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1.5 block font-medium">
                                {getTimeAgo(item.timestamp)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                <UserAvatar
                  user={user}
                  src={user?.avatar}
                  avatarUrl={user?.avatar}
                  name={user?.fullName || 'Cán bộ'}
                  size="sm"
                />
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
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      <UserAvatar
                        user={user}
                        src={user?.avatar}
                        avatarUrl={user?.avatar}
                        name={user?.fullName || 'Cán bộ'}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{user?.fullName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                        <span
                          className={cn(
                            'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1',
                            getRoleBadgeStyle(user?.role)
                          )}
                        >
                          {user ? ROLE_LABELS[user.role] : 'Cán bộ'}
                        </span>
                      </div>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                      >
                        <User className="w-4 h-4 text-slate-500" />
                        <span>Hồ sơ & Đổi mật khẩu</span>
                      </Link>

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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 bg-slate-50">
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
