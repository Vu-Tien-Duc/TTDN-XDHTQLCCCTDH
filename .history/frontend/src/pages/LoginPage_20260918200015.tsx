import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  ShieldCheck,
  Award,
  Sparkles,
  CalendarCheck,
  Building2,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

interface QuickAccount {
  label: string;
  roleTitle: string;
  role: 'admin' | 'truongkhoa' | 'giangvien' | 'nhanvien';
  email: string;
  badgeStyle: string;
  desc: string;
}

const QUICK_ACCOUNTS: QuickAccount[] = [
  {
    label: 'Admin IT (Server)',
    roleTitle: 'Quản trị viên IT',
    role: 'admin',
    email: 'daihocdtd@gmail.com',
    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300',
    desc: 'Quản trị server, cấu hình ca, cấp tài khoản toàn trường',
  },
  {
    label: 'Admin HR (Nhân sự)',
    roleTitle: 'Trưởng phòng HC-TH',
    role: 'admin',
    email: 'admin.hr@university.edu.vn',
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300',
    desc: 'Quản lý nhân sự, quỹ ngày phép & báo cáo chấm công',
  },
  {
    label: 'Trưởng Khoa CNTT & CĐS',
    roleTitle: 'Trưởng Khoa',
    role: 'truongkhoa',
    email: 'truongkhoa.cntt@university.edu.vn',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
    desc: 'Duyệt đơn nghỉ/dạy bù, theo dõi chấm công giảng viên khoa',
  },
  {
    label: 'Giảng Viên KTPM',
    roleTitle: 'Giảng viên',
    role: 'giangvien',
    email: 'giangvien.bich@university.edu.vn',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300',
    desc: 'Điểm danh theo lịch giảng dạy (schedules), gửi đơn phép',
  },
  {
    label: 'Chuyên Viên Đào Tạo',
    roleTitle: 'Nhân viên hành chính',
    role: 'nhanvien',
    email: 'nhanvien.ha@university.edu.vn',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300',
    desc: 'Đi làm ca hành chính 8h-17h, quản lý thời khóa biểu',
  },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState(() => localStorage.getItem('edu_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('edu_remembered_email'));
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Nếu đã đăng nhập trước đó, tự động chuyển về trang chủ / dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleQuickSelect = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('password123');
    toast('Đã nạp thông tin tài khoản mẫu!', {
      icon: '✨',
      duration: 2000,
    });
  };

  const resetForgotPasswordState = () => {
    setForgotMode(false);
    setForgotEmail('');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpSent(false);
    setForgotLoading(false);
  };

  const handleForgotPasswordRequest = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Vui lòng nhập email đã đăng ký trên hệ thống.');
      return;
    }

    try {
      setForgotLoading(true);
      await authService.forgotPassword(normalizedEmail);
      setOtpSent(true);
      setEmail(normalizedEmail);
      toast.success('Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      toast.error(apiError.response?.data?.message || 'Không thể gửi mã OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();

    if (!normalizedEmail || !otpCode.trim()) {
      toast.error('Vui lòng nhập email và mã OTP.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setForgotLoading(true);
      await authService.resetPassword({
        email: normalizedEmail,
        otp: otpCode.trim(),
        newPassword,
      });
      toast.success('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.');
      resetForgotPasswordState();
      setPassword('');
      setEmail(normalizedEmail);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      toast.error(apiError.response?.data?.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() && !password) {
      toast.error('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    if (!email.trim()) {
      toast.error('Vui lòng nhập Email giảng viên / cán bộ.');
      return;
    }
    if (!password) {
      toast.error('Vui lòng nhập Mật khẩu.');
      return;
    }

    try {
      setIsLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const res = await authService.login({
        email: normalizedEmail,
        password,
      });

      const responseData = res.data;
      const token = responseData.token || responseData.accessToken;
      const user = responseData.user;
      const refreshToken = responseData.refreshToken;

      if (!token || !user) {
        throw new Error('Dữ liệu phản hồi từ máy chủ không hợp lệ.');
      }

      // Xử lý ghi nhớ email
      if (rememberMe) {
        localStorage.setItem('edu_remembered_email', normalizedEmail);
      } else {
        localStorage.removeItem('edu_remembered_email');
      }

      login(token, user, refreshToken);

      toast.success(`Đăng nhập thành công! Chào mừng ${user.fullName}`);

      // Lấy URL trước đó người dùng muốn truy cập (nếu có)
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      console.error('[LoginPage] Lỗi đăng nhập:', err);
      // Trích xuất thông báo lỗi chuẩn xác từ backend
      const apiError = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage =
        apiError.response?.data?.message ||
        apiError.message ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      toast.error(errorMessage, { duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* CỘT TRÁI: Hero Banner giới thiệu (ẩn trên mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Gradients & Glow Accents */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

        {/* Logo & Tên Trường */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/10">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg tracking-tight text-white leading-tight">
              TRƯỜNG ĐẠI HỌC CÔNG NGHỆ & KHOA HỌC
            </h2>
            <p className="text-xs text-blue-300/90 font-semibold tracking-wider uppercase mt-0.5">
              Hệ Thống Quản Lý Chấm Công, Lịch Dạy & Nghỉ Phép
            </p>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 my-auto py-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold mb-6 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Chuyển Đổi Số Nhân Sự & Đào Tạo</span>
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Quản Lý Chấm Công <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Chuẩn Hóa Đa Phân Quyền
            </span>
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            Nền tảng tích hợp tự động đối soát ca dạy cho Giảng viên, chấm công hành chính cho Chuyên viên, phê duyệt đơn nghỉ phép điện tử và báo cáo nhân sự theo thời gian thực.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:border-slate-600 transition">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">RBAC 4 Nhóm Vai Trò</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Admin IT/HR, Trưởng Khoa, Giảng Viên và Chuyên Viên hành chính.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:border-slate-600 transition">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2.5">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">Điểm Danh Theo Lịch</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Khớp thời khóa biểu ca học, tính đi muộn theo ngưỡng Grace Period.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:border-slate-600 transition">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5">
                <Building2 className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">Cây 14 Đơn Vị Tổ Chức</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Ban Giám Hiệu $\rightarrow$ 4 Phòng Ban $\rightarrow$ 4 Khoa $\rightarrow$ 8 Bộ Môn.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:border-slate-600 transition">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-xs">Duyệt Phép & Trừ Quỹ</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Tự động tính ngày phép động, phân cấp phê duyệt Trưởng khoa & Admin.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-4">
          <span>© {new Date().getFullYear()} Đại học Công Nghệ & Khoa Học.</span>
          <span className="font-mono text-slate-500">Express 5 + Vite + React 19</span>
        </div>
      </div>

      {/* CỘT PHẢI: Form Đăng Nhập & Tài khoản Mẫu */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-10 bg-slate-900/40 backdrop-blur-xl">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-9 text-slate-800 border border-slate-100">
          {/* Header Mobile / Title */}
          <div className="text-center mb-6">
            <div className="lg:hidden inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg mb-3">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Đăng Nhập Hệ Thống</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">Cổng thông tin Cán bộ, Giảng viên & Nhân viên</p>
          </div>

          {/* Form */}
          {forgotMode ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                <div className="font-bold mb-1">Đặt lại mật khẩu bằng OTP</div>
                <div>Admin cấp tài khoản là flow chính, còn OTP dùng cho quên mật khẩu / xác minh bảo mật.</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email đăng ký
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Nhập email của bạn"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleForgotPasswordRequest}
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-xs bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transition disabled:opacity-60"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Gửi mã OTP</span>
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mã OTP
                    </label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Nhập 6 chữ số"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Xác nhận mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={forgotLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-60"
                  >
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Đặt lại mật khẩu</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={resetForgotPasswordState}
                className="w-full text-center text-[11px] font-semibold text-slate-600 hover:text-slate-800"
              >
                Quay lại đăng nhập
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Input Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Giảng Viên / Cán Bộ
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vidu: gv.nam@university.edu.vn"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Input Mật Khẩu */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mật Khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email.trim());
                      setForgotMode(true);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu (mặc định: password123)"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Ghi nhớ đăng nhập */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600 font-medium">Ghi nhớ phiên đăng nhập</span>
                </label>
              </div>

              {/* Nút Đăng Nhập */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] transition shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xác thực thông tin...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Đăng Nhập Ngay</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Hộp Tài Khoản Mẫu Nhanh (1-Click Fill) */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Tài khoản mẫu theo vai trò (1-Click điền):</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">Pass: password123</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickSelect(acc.email)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition ${acc.badgeStyle}`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold truncate text-slate-800">{acc.label}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-white/80 border border-slate-200/60 uppercase">
                        {acc.roleTitle}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5">{acc.email}</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 shrink-0">Chọn</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
