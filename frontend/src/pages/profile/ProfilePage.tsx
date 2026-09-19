import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Building2,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Camera,
  RefreshCw,
  LogOut,
  Sparkles,
  Info,
  ScanFace,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS, formatDate, showErrorToast, tokenStorage } from '../../utils';
import { authService, leaveService, LeaveBalanceData } from '../../services';
import { Button, Badge } from '../../components';

export const ProfilePage: React.FC = () => {
  const { user, logout, setUser } = useAuth();
  const role = user?.role || 'giangvien';

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
        // Silent fallback to user profile default
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

    // Kiểm tra định dạng (ảnh)
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn định dạng file hình ảnh (PNG, JPG, JPEG, WEBP).');
      return;
    }

    // Giới hạn 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB.');
      return;
    }

    setUploadingAvatar(true);
    const toastId = toast.loading('Đang tải lên và đồng bộ ảnh mẫu Face ID...');
    try {
      // 1. Gọi API upload ảnh lên hệ thống
      const uploadRes = await leaveService.uploadAttachment(file);
      if (!uploadRes.success || !uploadRes.data?.fileUrl) {
        throw new Error(uploadRes.message || 'Tải ảnh lên máy chủ thất bại.');
      }
      const newAvatarUrl = uploadRes.data.fileUrl;

      // 2. Cập nhật đường dẫn avatar vào CSDL User
      const updateRes = await authService.updateAvatar(newAvatarUrl);
      if (updateRes.success) {
        if (user) {
          const updatedUser = { ...user, avatar: newAvatarUrl };
          setUser(updatedUser);
          tokenStorage.setUser(updatedUser);
        }
        toast.success('Cập nhật ảnh mẫu Face ID thành công!', { id: toastId, icon: '📸' });
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
      toast.success('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.', { icon: '🔑' });
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

  // Initials for Avatar
  const initials = (user?.fullName || 'CB')
    .split(' ')
    .slice(-2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/15 border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <img
                  src={user.avatar}
                  alt={user.fullName || 'Avatar'}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-lg border-2 border-white/30 shrink-0"
                />
                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
            ) : (
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white/20 shrink-0 cursor-pointer group relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {initials}
                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
            )}

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30 mb-1.5">
                <Shield className="w-3 h-3 text-blue-300" />
                <span>{ROLE_LABELS[role]}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {user?.fullName || 'Hồ Sơ Cán Bộ'}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{departmentName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success" size="md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
              Đang hoạt động
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Grid Layout: Left Info & Right Password */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account & Organization Details */}
        <div className="space-y-6">
          {/* General Information Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <UserIcon className="w-4 h-4 text-blue-600" />
              <span>Thông Tin Tài Khoản</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 font-medium block mb-0.5">Họ và tên</span>
                <span className="font-bold text-slate-800 text-sm">{user?.fullName || '—'}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-0.5">Địa chỉ Email</span>
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{user?.email || '—'}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-0.5">Vai trò hệ thống</span>
                <span className="font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg inline-block">
                  {ROLE_LABELS[role]}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-0.5">Đơn vị trực thuộc</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{departmentName}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-0.5">Trạng thái xác thực</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã kích hoạt & bảo mật</span>
                </span>
              </div>
            </div>
          </div>

          {/* Leave Quota Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Quỹ Phép Trong Năm</span>
            </h3>

            {loadingBalance ? (
              <div className="h-16 bg-slate-50 animate-pulse rounded-xl" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">Số ngày còn lại:</span>
                  <span className="text-2xl font-black text-indigo-600">
                    {balance?.remainingDays ?? user?.annualLeaveQuota ?? 12}{' '}
                    <span className="text-xs font-normal text-slate-400">ngày</span>
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (((balance?.remainingDays ?? 12) /
                            (balance?.annualLeaveQuota ?? user?.annualLeaveQuota ?? 12)) *
                            100)
                        )
                      )}%`,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 font-medium pt-1">
                  <span>Đã dùng: {balance?.daysUsed || 0} ngày</span>
                  <span>Tổng định mức: {balance?.annualLeaveQuota ?? user?.annualLeaveQuota ?? 12} ngày</span>
                </div>
              </div>
            )}
          </div>

          {/* Face ID Status Card (Interactive Biometric Portrait) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Dữ Liệu Khuôn Mặt (Face ID)</span>
              </h3>
              {user?.avatar ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Đã có ảnh mẫu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Chưa có ảnh mẫu
                </span>
              )}
            </div>

            {/* Biometric Frame & Image Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-2 shadow-inner group">
              {/* High-tech HUD Corner Brackets */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-emerald-400 z-20 pointer-events-none" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-emerald-400 z-20 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-emerald-400 z-20 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-emerald-400 z-20 pointer-events-none" />

              {/* Status Header Badge */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <span className="bg-slate-900/90 backdrop-blur-xs text-[10px] font-mono text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 tracking-wider flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BIOMETRIC 128-D
                </span>
              </div>

              {user?.avatar ? (
                <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden flex items-center justify-center bg-slate-900">
                  <img
                    src={user.avatar}
                    alt={user.fullName || 'Ảnh mẫu Face ID'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-white/90">
                    <span className="font-mono text-[10px] text-emerald-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Mẫu chuẩn đã lưu
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono">128 dims</span>
                  </div>
                </div>
              ) : (
                <div className="aspect-4/3 w-full rounded-xl flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-900 to-slate-950 text-slate-400 space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
                    <ScanFace className="w-8 h-8 text-emerald-400/80 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Chưa tải ảnh mẫu nhận diện</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-[210px] leading-tight">
                      Cần nạp ảnh chân dung chính diện để phục vụ điểm danh Face ID
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload / Change Photo Action */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs py-2 rounded-xl border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 font-medium"
              >
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>{user?.avatar ? 'Cập nhật lại ảnh mẫu Face ID' : 'Tải lên ảnh mẫu khuôn mặt'}</span>
              </Button>
            </div>

            {/* Specifications Details */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1.5 text-slate-600">
              <div className="flex justify-between items-center">
                <span>Thuật toán trích xuất:</span>
                <span className="font-semibold text-slate-800 font-mono">TinyFace + 128-D</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ngưỡng so khớp (Threshold):</span>
                <span className="font-semibold text-emerald-700 font-mono">≤ 0.55 (Euclidean)</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Mục đích sử dụng:</span>
                <span className="font-medium text-slate-700">Điểm danh Kiosk & Webcam</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Password Change Form & Security Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Password Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Đổi Mật Khẩu Đăng Nhập</h3>
                <p className="text-xs text-slate-500">
                  Cập nhật mật khẩu định kỳ giúp bảo vệ an toàn tài khoản và dữ liệu cá nhân.
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu đang sử dụng"
                    className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Xác nhận lại mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại chính xác mật khẩu mới"
                    className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Quy tắc bảo mật mật khẩu:</span>
                </p>
                <p>• Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.</p>
                <p>• Sau khi đổi mật khẩu thành công, vui lòng ghi nhớ để đăng nhập trong các lần tiếp theo.</p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submittingPassword}
                  className="bg-blue-600 hover:bg-blue-700 text-xs px-5 py-2.5 rounded-xl shadow-xs"
                >
                  Lưu thay đổi mật khẩu
                </Button>
              </div>
            </form>
          </div>

          {/* Security Overview & Session Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold">Phiên Làm Việc & Tiêu Chuẩn Bảo Mật</h4>
              </div>
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                JWT Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[11px]">Access Token</span>
                <span className="font-bold text-white mt-0.5 block">15 phút (Tự động refresh)</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[11px]">Refresh Token</span>
                <span className="font-bold text-white mt-0.5 block">7 ngày (HttpOnly Cookie)</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[11px]">Mã hóa CSDL</span>
                <span className="font-bold text-white mt-0.5 block">Bcrypt Cost 12</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
              <span>Đăng xuất khỏi hệ thống trên thiết bị này:</span>
              <Button
                variant="danger"
                size="sm"
                onClick={logout}
                className="text-xs py-1.5 px-3 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                <span>Đăng xuất</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
