import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Bot,
  Building2,
  FileCheck2,
  FilePlus2,
  FileText,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { axiosClient } from '../api/axiosClient';
import { ROLE_LABELS } from '../utils';
import AiChatWidget from '../components/ai/AiChatWidget';

export const MainLayout: React.FC = () => {
  const { user, login, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  // Danh sách tài khoản demo phục vụ hội đồng nghiệm thu
  const demoAccounts = [
    {
      role: 'admin',
      name: 'Ban Giám Hiệu (Admin)',
      email: 'daihocdtd@gmail.com',
      badge: 'Toàn quyền',
    },
    {
      role: 'truongkhoa',
      name: 'Trưởng Khoa CNTT',
      email: 'truongkhoa.cntt@university.edu.vn',
      badge: 'Duyệt Khoa',
    },
    {
      role: 'giangvien',
      name: 'TS. Trần Thị Bích',
      email: 'giangvien.bich@university.edu.vn',
      badge: 'Nộp đơn',
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
        toast.success(`Đã chuyển đổi sang tài khoản: ${res.data.user.fullName} (${res.data.user.role})`, {
          icon: '🔄',
        });
      }
    } catch {
      toast.error('Không thể chuyển đổi tài khoản demo. Vui lòng kiểm tra seed data.');
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  const navItems = [
    {
      path: '/dashboard/reports',
      label: 'Dashboard & Báo Cáo',
      icon: BarChart3,
      roles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    },
    {
      path: '/leave/create',
      label: 'Tạo Đơn Xin Nghỉ',
      icon: FilePlus2,
      roles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    },
    {
      path: '/leave/my-requests',
      label: 'Đơn Nghỉ Của Tôi',
      icon: FileText,
      roles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    },
    {
      path: '/leave/approvals',
      label: 'Hộp Duyệt Đơn',
      icon: FileCheck2,
      badge: 'Quản lý',
      roles: ['admin', 'truongkhoa'],
    },
    {
      path: '/ai-assistant',
      label: 'Trợ Lý Thanh Tra AI',
      icon: Bot,
      highlight: true,
      roles: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & System Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/dashboard/reports" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
                  QUẢN LÝ CHẤM CÔNG ĐẠI HỌC
                </h1>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                  Phân Hệ C • Đơn Nghỉ Phép & Thống Kê
                </p>
              </div>
            </Link>
          </div>

          {/* Right Header Actions: Quick Switcher & User Profile */}
          <div className="flex items-center gap-3">
            {/* Demo Account Switcher */}
            <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
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

            {/* Current User Info */}
            {user && (
              <div className="flex items-center gap-2.5 pl-2 sm:border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  {user.fullName ? user.fullName.charAt(0) : 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-900 leading-none">{user.fullName}</p>
                  <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">
                    {ROLE_LABELS[user.role] || user.role}
                  </p>
                </div>

                <button
                  onClick={logout}
                  title="Đăng xuất"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col lg:flex-row gap-6">
        {/* Desktop Sidebar (Ẩn khi in) */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-4 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Danh Mục Chức Năng
            </div>

            {navItems.map((item) => {
              // Kiểm tra quyền
              const isAllowed = user && item.roles.includes(user.role);
              if (!isAllowed) return null;

              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : item.highlight
                      ? 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && !isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800">
                      {item.badge}
                    </span>
                  )}
                  {item.highlight && !isActive && (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Quick Info Box */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-100 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Bảo Mật & Phân Quyền
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Hệ thống kiểm soát thẩm quyền 2 lớp (Middleware token & Controller ownership). Cán bộ chỉ xem và xử lý đơn theo đúng thẩm quyền khoa.
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex">
            <div className="w-72 bg-white h-full p-4 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <span className="text-xs font-bold text-slate-900 uppercase">Menu Phân Hệ C</span>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-1">
                  {navItems.map((item) => {
                    const isAllowed = user && item.roles.includes(user.role);
                    if (!isAllowed) return null;

                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold ${
                          isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Demo switchers in mobile */}
              <div className="pt-4 border-t space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Chuyển tài khoản demo:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      onClick={() => {
                        handleQuickSwitch(acc.email);
                        setMobileMenuOpen(false);
                      }}
                      className="text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                    >
                      {acc.name} ({acc.badge})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Chat Assistant */}
      <div className="print:hidden">
        <AiChatWidget />
      </div>

      {/* Footer (Ẩn khi in) */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
        Hệ Thống Quản Lý Chấm Công Trường Đại Học • Phân Hệ C (Quản lý đơn từ, Audit Log, Báo cáo & Gemini AI)
      </footer>
    </div>
  );
};

export default MainLayout;
