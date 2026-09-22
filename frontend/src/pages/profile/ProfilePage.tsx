import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Building2,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Camera,
  LogOut,
  Sparkles,
  Info,
  ScanFace,
  UploadCloud,
  FileText,
  Clock,
  Check,
  Smartphone,
  Laptop,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS, showErrorToast, tokenStorage, getSafeMediaUrl } from '../../utils';
import { authService, leaveService, LeaveBalanceData } from '../../services';
import { Button, Badge, UserAvatar } from '../../components';

type TabType = 'overview' | 'biometrics' | 'security';

export const ProfilePage: React.FC = () => {
  const { user, logout, setUser, refreshUser } = useAuth();
  const role = user?.role || 'giangvien';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // State leave balance
  const [balance, setBalance] = useState<LeaveBalanceData | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);

  // Avatar / Face ID Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Load Leave Balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await leaveService.getLeaveBalance();
        if (res.success && res.data) {
          setBalance(res.data);
        }
      } catch {
        // Fallback im lặng
      } finally {
        setLoadingBalance(false);
      }
    };
    fetchBalance();
  }, []);

  // Xử lý upload ảnh mẫu khuôn mặt (Face ID) / Avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB.');
      return;
    }

    setUploadingAvatar(true);
    const toastId = toast.loading('Đang tải lên và đồng bộ ảnh mẫu Face ID...');
    try {
      const uploadRes = await leaveService.uploadAttachment(file);
      if (!uploadRes.success || (!uploadRes.data?.fullUrl && !uploadRes.data?.fileUrl)) {
        throw new Error(uploadRes.message || 'Tải ảnh lên máy chủ thất bại.');
      }
      const rawAvatarUrl = uploadRes.data?.fullUrl || uploadRes.data?.fileUrl || '';
      const newAvatarUrl = getSafeMediaUrl(rawAvatarUrl);

      const updateRes = await authService.updateAvatar(newAvatarUrl);
      if (updateRes.success) {
        const savedAvatarUrl = getSafeMediaUrl(updateRes.data?.avatar || newAvatarUrl);
        if (user) {
          const updatedUser = { ...user, avatar: savedAvatarUrl };
          setUser(updatedUser);
          tokenStorage.setUser(updatedUser);
        }
        await refreshUser();
        toast.success('Cập nhật ảnh mẫu khuôn mặt thành công!', { id: toastId, icon: '📸' });
      }
    } catch (err) {
      toast.dismiss(toastId);
      showErrorToast(err, 'Không thể cập nhật ảnh khuôn mặt. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: 'Chưa nhập', color: 'bg-slate-200', textCol: 'text-slate-400', percent: 0 };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, text: 'Rất yếu', color: 'bg-rose-500', textCol: 'text-rose-500', percent: 20 };
    if (score === 2) return { score: 2, text: 'Yếu', color: 'bg-orange-500', textCol: 'text-orange-500', percent: 40 };
    if (score === 3) return { score: 3, text: 'Trung bình', color: 'bg-amber-500', textCol: 'text-amber-500', percent: 60 };
    if (score === 4) return { score: 4, text: 'Mạnh', color: 'bg-blue-500', textCol: 'text-blue-500', percent: 80 };
    return { score: 5, text: 'Rất an toàn', color: 'bg-emerald-500', textCol: 'text-emerald-500', percent: 100 };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // Handle password submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Vui lòng điền đầy đủ tất cả các trường mật khẩu.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp nhau.');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    setSubmittingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.', { icon: '🔑' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showErrorToast(err, 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const departmentName =
    user?.departmentId && typeof user.departmentId === 'object' && 'name' in user.departmentId
      ? user.departmentId.name
      : 'Trường Đại học';

  // Format Quỹ phép
  const remainingDays = balance?.remainingDays ?? user?.annualLeaveQuota ?? 12;
  const annualQuota = balance?.annualLeaveQuota ?? user?.annualLeaveQuota ?? 12;
  const usedDays = balance?.daysUsed || 0;
  const leavePercentage = Math.min(100, Math.max(0, (remainingDays / (annualQuota || 1)) * 100));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 px-3 sm:px-4 lg:px-6">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* 1. Header Banner & Profile Summary Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 p-5 sm:p-7 text-white shadow-xl shadow-indigo-950/15 border border-slate-800">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-56 h-56 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-5 text-center md:text-left">
          {/* Avatar with Camera Trigger */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
            <div className="relative inline-flex shrink-0">
              <UserAvatar
                user={user}
                avatarUrl={user?.avatar}
                size="2xl"
                className="ring-4 ring-white/20 shadow-2xl rounded-2xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Thay đổi ảnh đại diện & ảnh mẫu Face ID"
                aria-label="Thay đổi ảnh đại diện"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center shadow-lg border-2 border-slate-900 transition-all cursor-pointer z-10"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* User Core Meta */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/25 text-blue-200 text-xs font-semibold border border-blue-400/30">
                  <Shield className="w-3 h-3 text-blue-300" />
                  {ROLE_LABELS[role] || 'Cán bộ'}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {user?.fullName || 'Hồ Sơ Cán Bộ'}
              </h1>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-1 gap-x-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{departmentName}</span>
                </span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{user?.email || '—'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
            <Badge variant={user?.isActive !== false ? 'success' : 'danger'} size="md" className="backdrop-blur-sm bg-emerald-500/15 border-emerald-400/30 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
              {user?.isActive !== false ? 'Tài khoản hoạt động' : 'Tài khoản tạm khóa'}
            </Badge>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="md:mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-200 transition-colors border border-white/10"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-300" />
              <span>Đổi ảnh mẫu</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Responsive Segmented Tab Bar (Touch-friendly for mobile, sleek on desktop) */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <UserIcon className={`w-4 h-4 ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-400'}`} />
          <span>Hồ Sơ & Quỹ Phép</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('biometrics')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'biometrics'
              ? 'bg-white text-emerald-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ScanFace className={`w-4 h-4 ${activeTab === 'biometrics' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>Khuôn Mặt Face ID</span>
          {user?.avatar ? (
            <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-emerald-500" />
          ) : (
            <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'security'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <KeyRound className={`w-4 h-4 ${activeTab === 'security' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span>Bảo Mật & Mật Khẩu</span>
        </button>
      </div>

      {/* 3. Tab Content Area */}

      {/* TAB 1: OVERVIEW & LEAVE BALANCE */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Card: Chi tiết hồ sơ cán bộ */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Thông Tin Cá Nhân & Công Tác</h3>
                  <p className="text-[11px] text-slate-500">Dữ liệu được quản lý đồng bộ theo hồ sơ nhà trường</p>
                </div>
              </div>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                Chính chủ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Họ và tên cán bộ</span>
                <span className="font-bold text-slate-900 text-sm">{user?.fullName || '—'}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Địa chỉ Email trường</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 break-all">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {user?.email || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Khoa / Đơn vị công tác</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {departmentName}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Vai trò tài khoản</span>
                <span className="inline-block font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {ROLE_LABELS[role] || 'Cán bộ'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Trạng thái tài khoản</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${user?.isActive !== false ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{user?.isActive !== false ? 'Đang hoạt động' : 'Tạm khóa'}</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Xác thực bảo mật</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${user?.isVerified ? 'text-blue-600' : 'text-amber-600'}`}>
                  {user?.isVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{user?.isVerified ? 'Đã xác thực email' : 'Chưa xác thực email'}</span>
                </span>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Cần cập nhật thông tin phòng ban hoặc chức vụ?</p>
                <p className="text-[11px] text-blue-700">
                  Vui lòng liên hệ Phòng Tổ chức - Hành chính hoặc Quản trị viên để được điều chỉnh thông tin chính xác trên hồ sơ điện tử.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Quỹ Phép Năm & Thao Tác Nghỉ Phép */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Quỹ Phép Trong Năm</h3>
                </div>
                <span className="text-[11px] font-mono text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                  Năm {new Date().getFullYear()}
                </span>
              </div>

              {loadingBalance ? (
                <div className="h-28 bg-slate-50 animate-pulse rounded-2xl" />
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50/60 p-4 rounded-2xl border border-indigo-100/80 text-center">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                      Số ngày phép còn khả dụng
                    </span>
                    <div className="mt-1 flex items-baseline justify-center gap-1.5">
                      <span className="text-4xl font-black text-indigo-600 tracking-tight">
                        {remainingDays}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">ngày</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Tỷ lệ khả dụng:</span>
                      <span className="text-indigo-600">{Math.round(leavePercentage)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${leavePercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Đã sử dụng</span>
                      <span className="font-bold text-slate-800 text-sm">{usedDays} ngày</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Tổng định mức</span>
                      <span className="font-bold text-slate-800 text-sm">{annualQuota} ngày</span>
                    </div>
                  </div>

                  <Link
                    to="/leaves"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors border border-indigo-200/60"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Nộp đơn xin nghỉ phép</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Status Pill Card */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-200/60 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-emerald-900">Điểm danh Kiosk đã sẵn sàng</p>
                <p className="text-[11px] text-emerald-700">
                  {user?.avatar
                    ? 'Ảnh mẫu khuôn mặt đã nạp thành công, bạn có thể điểm danh ngay.'
                    : 'Chưa có ảnh khuôn mặt. Vui lòng cập nhật ở tab Khuôn Mặt Face ID.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BIOMETRICS & FACE ID */}
      {activeTab === 'biometrics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Left Column: Biometric HUD Portrait */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Ảnh Mẫu Nhận Diện Khuôn Mặt</h3>
              </div>
              {user?.avatar ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Đã kích hoạt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Chưa nạp
                </span>
              )}
            </div>

            {/* High-Tech Biometric HUD Box */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-2.5 shadow-inner group">
              {/* Corner brackets */}
              <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-emerald-400 z-20 pointer-events-none" />
              <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-emerald-400 z-20 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-emerald-400 z-20 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-emerald-400 z-20 pointer-events-none" />

              {/* Top Sensor Tag */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <span className="bg-slate-900/90 backdrop-blur-md text-[10px] font-mono text-emerald-400 px-3 py-0.5 rounded-full border border-emerald-500/30 tracking-wider flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI TINYFACE 128-D
                </span>
              </div>

              {user?.avatar ? (
                <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden flex items-center justify-center bg-slate-900">
                  <img
                    src={getSafeMediaUrl(user.avatar)}
                    alt={user.fullName || 'Ảnh mẫu Face ID'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white/90">
                    <span className="font-mono text-[11px] text-emerald-300 flex items-center gap-1.5 font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Mẫu đã sẵn sàng
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono bg-slate-900/80 px-2 py-0.5 rounded-md border border-white/10">
                      128 Feature Dims
                    </span>
                  </div>
                </div>
              ) : (
                <div className="aspect-4/3 w-full rounded-xl flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 to-slate-950 text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 shadow-inner">
                    <ScanFace className="w-8 h-8 text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Chưa nạp ảnh khuôn mặt</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                      Tải lên một bức ảnh chân dung rõ mặt để hệ thống nhận diện điểm danh tại Kiosk.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs sm:text-sm py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white flex items-center justify-center gap-2 font-semibold shadow-md shadow-emerald-900/20"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{user?.avatar ? 'Tải lên ảnh mẫu mới (Đổi ảnh)' : 'Chọn ảnh mẫu từ thiết bị'}</span>
              </Button>
            </div>
          </div>

          {/* Right Column: AI Specs & Guidelines */}
          <div className="lg:col-span-7 space-y-6">
            {/* Guidelines Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Hướng Dẫn Chuẩn Chụp Ảnh Khuôn Mặt</h3>
                  <p className="text-[11px] text-slate-500">Giúp hệ thống điểm danh Kiosk nhận diện chính xác 99.8%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-950 block">Ánh sáng đầy đủ, rõ nét</span>
                    <span className="text-emerald-800 text-[11px] leading-tight block mt-0.5">
                      Chụp trong môi trường có ánh sáng tự nhiên, không bị ngược sáng hoặc bóng che khuôn mặt.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-950 block">Nhìn thẳng chính diện</span>
                    <span className="text-emerald-800 text-[11px] leading-tight block mt-0.5">
                      Mắt nhìn thẳng camera, không nghiêng đầu quá 15 độ, không nhắm mắt.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-950 block">Không đeo khẩu trang / kính râm</span>
                    <span className="text-amber-800 text-[11px] leading-tight block mt-0.5">
                      Bỏ kính đen, mũ rộng vành hoặc vật cản che khuất mắt, mũi, miệng khi chụp.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-950 block">Chỉ có 1 khuôn mặt</span>
                    <span className="text-amber-800 text-[11px] leading-tight block mt-0.5">
                      Ảnh không có người khác lọt vào khung hình để tránh nhận nhầm vector sinh trắc.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical AI Specifications */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold">Thông Số Thuật Toán Điểm Danh</h4>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Model TinyFace 0.2
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Độ dài Vector</span>
                  <span className="font-bold text-white mt-0.5 block text-sm">128 Chiều (Dims)</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Ngưỡng so khớp (Threshold)</span>
                  <span className="font-bold text-emerald-400 mt-0.5 block text-sm">≤ 0.55 Euclidean</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Tốc độ trích xuất</span>
                  <span className="font-bold text-white mt-0.5 block text-sm">~ 120ms / khung hình</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Mẫu nhận diện khuôn mặt được mã hóa một chiều thành vector 128 đặc trưng toán học, không lưu giữ nguyên mẫu hình ảnh thô trái phép, đảm bảo tuyệt đối quyền riêng tư và an toàn dữ liệu cá nhân theo tiêu chuẩn ISO/IEC 30107-3.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & PASSWORD CHANGE */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Left Column: Form Đổi Mật Khẩu */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Đổi Mật Khẩu Đăng Nhập</h3>
                <p className="text-xs text-slate-500">
                  Khuyến nghị cập nhật mật khẩu định kỳ mỗi 6 tháng để bảo vệ tài khoản
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Mật khẩu hiện tại */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mật khẩu hiện tại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu đang dùng"
                    className="w-full text-xs sm:text-sm pl-10 pr-10 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự (kết hợp chữ hoa, số, ký tự đặc biệt)"
                    className="w-full text-xs sm:text-sm pl-10 pr-10 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator Bar */}
                {newPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Độ mạnh mật khẩu:</span>
                      <span className={`font-semibold ${passwordStrength.textCol}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại chính xác mật khẩu mới"
                    className="w-full text-xs sm:text-sm pl-10 pr-10 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Rule hint */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Quy tắc bảo mật mật khẩu:</span>
                </p>
                <p>• Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.</p>
                <p>• Khuyến nghị kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt để chống dò đoán.</p>
              </div>

              <div className="pt-2 flex sm:justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submittingPassword}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-md font-semibold"
                >
                  Lưu thay đổi mật khẩu
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column: Session Info & Safe Logout */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold">Phiên Làm Việc An Toàn</h4>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  JWT Active
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-300">Thiết bị hiện tại:</span>
                  </div>
                  <span className="font-semibold text-white">Trình duyệt Web</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span className="text-slate-300">Hạn Access Token:</span>
                  </div>
                  <span className="font-semibold text-white">15 phút (Auto-refresh)</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300">Chuẩn mã hóa:</span>
                  </div>
                  <span className="font-semibold text-white">Bcrypt Cost 12</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Nếu bạn đang dùng máy tính công cộng hoặc điện thoại người khác, hãy đăng xuất ngay sau khi hoàn tất công việc.
                </div>

                <Button
                  variant="danger"
                  size="md"
                  onClick={logout}
                  className="w-full text-xs sm:text-sm py-2.5 rounded-2xl flex items-center justify-center gap-2 font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất tài khoản an toàn</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
