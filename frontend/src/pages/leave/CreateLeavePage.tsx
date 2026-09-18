import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calendar,
  Clock,
  FileCheck2,
  FileText,
  HelpCircle,
  Paperclip,
  Send,
  UploadCloud,
  X,
} from 'lucide-react';
import leaveService from '../../services/leave.service';
import { LeaveType } from '../../types';
import LeaveBalanceCard from '../../components/leave/LeaveBalanceCard';

export const CreateLeavePage: React.FC = () => {
  const navigate = useNavigate();

  const [type, setType] = useState<LeaveType>('nghi_phep');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Tính số ngày nghỉ dự kiến
  let calculatedDays = 0;
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
      calculatedDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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

    setIsSubmitting(true);

    try {
      let attachmentUrl: string | undefined = undefined;

      // 1. Upload file nếu có
      if (file) {
        toast.loading('Đang tải lên file minh chứng...', { id: 'upload' });
        const uploadRes = await leaveService.uploadAttachment(file);
        toast.dismiss('upload');
        if (uploadRes.success && uploadRes.data?.fileUrl) {
          attachmentUrl = uploadRes.data.fileUrl;
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              Biểu Mẫu Số Hóa
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">Quy trình cấp Trường & Khoa</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Tạo Đơn Xin Nghỉ Phép / Dạy Bù / Đổi Ca
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Điền đầy đủ thông tin thời gian, lý do và đính kèm văn bản/ảnh minh chứng hợp lệ để Trưởng đơn vị xét duyệt.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/leave/my-requests')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-2"
        >
          <FileCheck2 className="w-4 h-4" />
          Xem Đơn Của Tôi
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column (2 Cols) */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6"
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
                  },
                  {
                    val: 'day_bu',
                    title: 'Đăng ký dạy bù',
                    desc: 'Dạy bù cho tiết đã xin nghỉ',
                    icon: Clock,
                  },
                  {
                    val: 'doi_ca',
                    title: 'Xin đổi ca dạy',
                    desc: 'Hoán đổi ca với giảng viên khác',
                    icon: FileText,
                  },
                ].map((item) => {
                  const isSelected = type === item.val;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.val}
                      onClick={() => setType(item.val as LeaveType)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">{item.desc}</p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Từ ngày (Ngày bắt đầu)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {calculatedDays > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center justify-between">
                  <span>Dự kiến xin nghỉ trong:</span>
                  <strong className="text-sm font-extrabold">{calculatedDays} ngày</strong>
                </div>
              )}
            </div>

            {/* 3. Nhập lý do */}
            <div className="space-y-2">
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

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do chi tiết (VD: Nghỉ ốm điều trị tại bệnh viện, công tác đào tạo ngoài trường, bận việc gia đình...)"
                rows={4}
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
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-2" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                    Nhấp để chọn file hoặc kéo thả vào đây
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
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
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Paperclip className="w-5 h-5" />
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
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {filePreview && (
                <div className="rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-100 flex items-center justify-center">
                  <img src={filePreview} alt="Preview" className="max-h-48 object-contain" />
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
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

        {/* Right Info Column (1 Col) */}
        <div className="space-y-6">
          {/* Leave Balance Card (Task 4) */}
          <LeaveBalanceCard refreshTrigger={refreshTrigger} />

          {/* Guidelines */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              Quy Chế Nghỉ Phép Đại Học
            </h4>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>Giảng viên/nhân viên được hưởng <strong>12 ngày phép năm</strong> hưởng nguyên lương.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>Đơn xin nghỉ của Giảng viên do <strong>Trưởng Khoa</strong> phê duyệt.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>Đơn của Trưởng Khoa bắt buộc do <strong>Ban Giám Hiệu / Admin</strong> phê duyệt.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                <span>Ngay khi đơn được duyệt, các tiết dạy tương ứng tự động chuyển sang <strong>Nghỉ có phép</strong>.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateLeavePage;
