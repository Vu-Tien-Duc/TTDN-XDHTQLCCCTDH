import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  HelpCircle,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import leaveService, { LeaveBalanceData } from '../../services/leave.service';
import { LeaveType } from '../../types';
import LeaveBalanceCard from '../../components/leave/LeaveBalanceCard';
import { useAuth } from '../../contexts/AuthContext';

export const CreateLeavePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Quản trị viên (Admin) không áp dụng tạo đơn, chuyển hướng về Hộp duyệt đơn
  useEffect(() => {
    if (user?.role === 'admin') {
      toast('Quản trị viên giữ quyền phê duyệt, không áp dụng tạo đơn cá nhân.', {
        icon: 'ℹ',
        id: 'admin-redirect',
      });
      navigate('/leave/approvals', { replace: true });
    }
  }, [user, navigate]);

  const [type, setType] = useState<LeaveType>('nghi_phep');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [balance, setBalance] = useState<LeaveBalanceData | null>(null);

  useEffect(() => {
    leaveService.getLeaveBalance().then((res) => {
      if (res.success && res.data) {
        setBalance(res.data);
      }
    }).catch(() => {});
  }, [refreshTrigger]);

  // Tính số ngày nghỉ dự kiến chuẩn xác theo ngày lịch
  let calculatedDays = 0;
  if (startDate && endDate) {
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    const sUtc = Date.UTC(sY, sM - 1, sD);
    const eUtc = Date.UTC(eY, eM - 1, eD);
    if (eUtc >= sUtc) {
      calculatedDays = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Giới hạn 10MB
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Dung lượng file tối đa là 10MB.');
      return;
    }

    // Kiểm tra định dạng
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(selected.type)) {
      toast.error('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP) hoặc tài liệu (PDF, DOC, DOCX).');
      return;
    }

    setFile(selected);
    if (selected.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(selected));
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.error('Vui lòng chọn ngày bắt đầu và kết thúc.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('Ngày kết thúc không thể trước ngày bắt đầu.');
      return;
    }

    if (reason.trim().length < 5 || reason.trim().length > 500) {
      toast.error('Lý do phải có độ dài từ 5 đến 500 ký tự.');
      return;
    }

    // Kiểm tra hạn mức phép năm nếu là loại 'nghi_phep'
    if (type === 'nghi_phep' && balance) {
      if (balance.remainingDays <= 0) {
        toast.error('Bạn đã sử dụng hết quỹ phép năm (0 ngày còn lại). Vui lòng chọn loại đơn "Đăng ký dạy bù" hoặc "Xin đổi ca".');
        return;
      }
      if (calculatedDays > balance.remainingDays) {
        toast.error(`Số ngày xin nghỉ (${calculatedDays} ngày) vượt quá số ngày phép còn lại (${balance.remainingDays} ngày).`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let attachmentUrl: string | undefined = undefined;

      // 1. Upload file nếu có
      if (file) {
        toast.loading('Đang tải lên file minh chứng...', { id: 'upload' });
        try {
          const uploadRes = await leaveService.uploadAttachment(file);
          toast.dismiss('upload');
          if (uploadRes.success && uploadRes.data?.fileUrl) {
            attachmentUrl = uploadRes.data.fileUrl;
          } else {
            toast.error(uploadRes.message || 'Tải file minh chứng thất bại. Vui lòng thử lại.');
            setIsSubmitting(false);
            return;
          }
        } catch {
          toast.dismiss('upload');
          toast.error('Tải file minh chứng thất bại. Vui lòng thử lại.');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Gửi đơn
      const payload = {
        type,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl,
      };

      const res = await leaveService.createLeaveRequest(payload);

      if (res.success) {
        toast.success('Gửi đơn xin nghỉ thành công! Đơn đang chờ xét duyệt.', {
          icon: '🎉',
          duration: 4000,
        });
        setRefreshTrigger((prev) => prev + 1);
        // Chuyển hướng sang danh sách đơn của tôi
        setTimeout(() => {
          navigate('/leave/my-requests');
        }, 1200);
      } else {
        toast.error(res.message || 'Không thể tạo đơn xin nghỉ.');
      }
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Lỗi khi gửi đơn xin nghỉ.';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickReasons = [
    'Nghỉ ốm / Khám sức khỏe',
    'Công tác ngoài trường',
    'Việc gia đình có phép',
    'Tham gia hội thảo khoa học',
  ];

  const handleAddQuickReason = (text: string) => {
    if (!reason.trim()) {
      setReason(text);
    } else if (!reason.includes(text)) {
      setReason((prev) => `${prev.trim()}; ${text}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              Biểu Mẫu Số Hóa
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Quy trình cấp Trường & Khoa</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5 tracking-tight">
            Tạo Đơn Xin Nghỉ Phép / Dạy Bù / Đổi Ca
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            Điền thông tin thời gian, giải trình lý do và đính kèm văn bản minh chứng để Trưởng đơn vị xét duyệt.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/leave/my-requests')}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition-all shrink-0 flex items-center justify-center gap-2 shadow-xs"
        >
          <FileCheck2 className="w-4 h-4 text-slate-600" />
          <span>Lịch Sử Đơn Của Tôi</span>
        </button>
      </div>

      {/* 2. QUỸ NGÀY PHÉP NĂM 2026: ĐẶT TRÊN CÙNG ĐỂ CẢ WEB APP VÀ MOBILE APP ĐỀU THẤY NGAY LẬP TỨC */}
      <LeaveBalanceCard refreshTrigger={refreshTrigger} />

      {/* 3. Main Form & Side Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Form Column (8 Cols on Desktop, Full on Mobile) */}
        <div className="lg:col-span-8">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-6 sm:space-y-7"
          >
            {/* 1. Chọn loại đơn */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-mono">
                  1
                </span>
                Chọn Loại Đơn Áp Dụng <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    val: 'nghi_phep',
                    title: 'Nghỉ phép thường',
                    desc: 'Trừ vào quỹ 12 ngày phép năm',
                    icon: Calendar,
                    badge: 'Quỹ phép',
                    color: 'text-blue-600',
                  },
                  {
                    val: 'day_bu',
                    title: 'Đăng ký dạy bù',
                    desc: 'Dạy bù cho tiết đã xin nghỉ',
                    icon: Clock,
                    badge: 'Bù giờ',
                    color: 'text-amber-600',
                  },
                  {
                    val: 'doi_ca',
                    title: 'Xin đổi ca dạy',
                    desc: 'Hoán đổi ca với giảng viên khác',
                    icon: FileText,
                    badge: 'Hoán đổi',
                    color: 'text-indigo-600',
                  },
                ].map((item) => {
                  const isSelected = type === item.val;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.val}
                      onClick={() => setType(item.val as LeaveType)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between select-none ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Chọn ngày bắt đầu & kết thúc */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-mono">
                  2
                </span>
                Khoảng Thời Gian Xin Nghỉ <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Từ ngày (Ngày bắt đầu)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setStartDate(newStart);
                      if (endDate && endDate < newStart) {
                        setEndDate(newStart);
                      }
                    }}
                    required
                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Đến ngày (Ngày kết thúc)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    min={startDate}
                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Dự kiến số ngày nghỉ & dự phóng số dư phép */}
              {calculatedDays > 0 && (
                <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-xs sm:text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Dự kiến xin nghỉ trong:</span>
                    <strong className="text-base font-extrabold text-blue-700 font-mono">
                      {calculatedDays} ngày
                    </strong>
                  </div>

                  {type === 'nghi_phep' && balance && (
                    <div className="pt-1.5 border-t border-blue-200/60 flex flex-wrap items-center justify-between text-xs text-blue-800">
                      <span>Số dư quỹ phép sau khi duyệt dự kiến:</span>
                      <strong
                        className={`font-mono ${
                          balance.remainingDays - calculatedDays < 0
                            ? 'text-rose-600 font-bold'
                            : 'text-emerald-700 font-bold'
                        }`}
                      >
                        {Math.max(0, balance.remainingDays - calculatedDays)} ngày
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Cảnh báo hạn mức quỹ phép */}
              {type === 'nghi_phep' && balance && balance.remainingDays <= 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Bạn đã sử dụng hết <strong>{balance.annualLeaveQuota || 12} ngày phép năm</strong>. Vui lòng chuyển sang "Đăng ký dạy bù" hoặc "Xin đổi ca dạy".
                  </span>
                </div>
              )}

              {type === 'nghi_phep' && balance && balance.remainingDays > 0 && calculatedDays > balance.remainingDays && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Số ngày xin nghỉ (<strong>{calculatedDays} ngày</strong>) vượt quá số ngày phép còn lại (<strong>{balance.remainingDays} ngày khả dụng</strong>).
                  </span>
                </div>
              )}
            </div>

            {/* 3. Nhập lý do */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-mono">
                    3
                  </span>
                  Lý Do Nghỉ / Giải Trình <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {reason.trim().length} / 500 ký tự
                </span>
              </div>

              {/* Quick Reason Suggestions Chips (Tối ưu nhập nhanh 1 chạm cho mobile) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Gợi ý nhanh:</span>
                {quickReasons.map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => handleAddQuickReason(qr)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-medium border border-slate-200 transition-colors"
                  >
                    + {qr}
                  </button>
                ))}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do chi tiết (VD: Nghỉ ốm điều trị tại bệnh viện, công tác ngoài trường, bận việc gia đình...)"
                rows={3}
                required
                maxLength={500}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* 4. Upload minh chứng */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-mono">
                  4
                </span>
                Tải Lên File Minh Chứng (Nếu Có)
              </label>

              {!file ? (
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <UploadCloud className="w-9 h-9 text-slate-400 group-hover:text-blue-600 transition-colors mb-2" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 text-center">
                    Nhấp để chọn file hoặc kéo thả vào đây
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 text-center">
                    Định dạng: JPG, PNG, WEBP, PDF, DOCX (Tối đa 10MB)
                  </span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {filePreview && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-44 bg-slate-100 flex items-center justify-center">
                  <img src={filePreview} alt="Preview" className="max-h-44 object-contain" />
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Đang gửi đơn lên hệ thống...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Gửi Đơn Xin Xét Duyệt
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Info Column (4 Cols on Desktop, Full on Mobile) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Guidelines */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              Quy Chế & Thời Gian Xử Lý
            </h4>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>
                  Giảng viên/nhân viên được hưởng <strong>12 ngày phép năm</strong> nguyên lương theo Bộ luật Lao động & Quy chế Nhà trường.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>
                  Đơn xin nghỉ của Giảng viên do <strong>Trưởng Khoa</strong> phê duyệt trực tiếp trên hệ thống.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>
                  Đơn của Trưởng Khoa bắt buộc do <strong>Ban Giám Hiệu / Quản trị viên</strong> phê duyệt.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5"></span>
                <span>
                  Khi đơn được duyệt (APPROVED), hệ thống tự động đồng bộ sang bảng điểm danh thành <strong>Nghỉ có phép (EXCUSED_ABSENCE)</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* SLA Response Time */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Thời Gian Phản Hồi Dự Kiến</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Trưởng đơn vị sẽ xem xét và phản hồi trong vòng <strong>24h - 48h làm việc</strong>. Bạn sẽ nhận được thông báo qua Email và tại mục <strong>Lịch sử đơn</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateLeavePage;
