import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { ShiftConfig } from '../types';
import { shiftService, ShiftPayload } from '../services/shiftService';
import { useAuth } from '../contexts/AuthContext';

export const ShiftsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Thêm / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedShift, setSelectedShift] = useState<ShiftConfig | null>(null);

  const [formData, setFormData] = useState<ShiftPayload>({
    name: '',
    startTime: '07:00',
    endTime: '11:30',
    lateThresholdMinutes: 15,
    earlyExitThresholdMinutes: 15,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Xóa
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<ShiftConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchShifts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await shiftService.getAllShifts();
      setShifts(data || []);
    } catch (err) {
      console.error('[ShiftsPage] Lỗi tải ca làm việc:', err);
      toast.error('Không thể tải danh sách ca làm việc.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedShift(null);
    setFormData({
      name: '',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (shift: ShiftConfig) => {
    setModalMode('edit');
    setSelectedShift(shift);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateThresholdMinutes: shift.lateThresholdMinutes || 15,
      earlyExitThresholdMinutes: shift.earlyExitThresholdMinutes || 15,
      isActive: shift.isActive !== undefined ? shift.isActive : true,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.startTime || !formData.endTime) {
      toast.error('Vui lòng điền đầy đủ tên ca, giờ bắt đầu và giờ kết thúc.');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      toast.error('Giờ bắt đầu ca phải trước giờ kết thúc ca.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalMode === 'create') {
        await shiftService.createShift(formData);
        toast.success(`Đã tạo mới ca "${formData.name}" thành công!`);
      } else if (selectedShift) {
        await shiftService.updateShift(selectedShift._id, formData);
        toast.success(`Đã cập nhật ca "${formData.name}" thành công!`);
      }
      setIsModalOpen(false);
      fetchShifts();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể lưu ca làm việc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!shiftToDelete) return;
    try {
      setIsDeleting(true);
      await shiftService.deleteShift(shiftToDelete._id);
      toast.success(`Đã xóa ca "${shiftToDelete.name}" thành công.`);
      setDeleteModalOpen(false);
      setShiftToDelete(null);
      fetchShifts();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể xóa ca này (có thể do đang gắn với Lịch học).');
    } finally {
      setIsDeleting(false);
    }
  };

  // Xác định biểu tượng ca học dựa theo tên / giờ
  const getShiftIcon = (name: string, startTime: string) => {
    const hour = parseInt(startTime.split(':')[0], 10);
    if (name.toLowerCase().includes('sáng') || hour < 12) {
      return <Sun className="w-5 h-5 text-amber-500" />;
    } else if (name.toLowerCase().includes('chiều') || (hour >= 12 && hour < 18)) {
      return <Sunset className="w-5 h-5 text-orange-500" />;
    }
    return <Moon className="w-5 h-5 text-indigo-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4" />
            <span>Thời Khóa Biểu & Khung Giờ</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Danh Mục Ca Dạy & Ca Làm Việc
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cấu hình thời gian chuẩn cho các tiết học, ngưỡng trễ và quy tắc chấm công điểm danh.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchShifts}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Ca Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Cards Tóm Tắt Nhanh */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 rounded-3xl border border-amber-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Ca Sáng</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Tiết 1 - 4 (07:00 - 11:30)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ngưỡng tính muộn: 15 phút</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-rose-50/50 p-5 rounded-3xl border border-orange-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-600 flex items-center justify-center">
            <Sunset className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Ca Chiều</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Tiết 5 - 8 (12:30 - 17:00)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ngưỡng tính muộn: 15 phút</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-5 rounded-3xl border border-indigo-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Ca Tối / Tự Học</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Tiết 9 - 12 (17:30 - 21:00)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Dành cho lớp văn bằng 2 & cao học</p>
          </div>
        </div>
      </div>

      {/* Bảng Danh Sách Ca Làm Việc */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800">Danh Sách Ca Học Chuẩn ({shifts.length})</h3>
          </div>
          <span className="text-xs text-slate-400">Sắp xếp theo giờ bắt đầu sớm nhất</span>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500">Đang tải danh sách ca...</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Chưa có ca làm việc nào. Bấm &quot;Thêm Ca Mới&quot; để thiết lập.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Tên Ca Làm Việc</th>
                  <th className="py-3.5 px-6">Khung Giờ Bắt Đầu - Kết Thúc</th>
                  <th className="py-3.5 px-6">Ngưỡng Trễ Cho Phép</th>
                  <th className="py-3.5 px-6">Trạng Thái</th>
                  {isAdmin && <th className="py-3.5 px-6 text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift) => (
                  <tr key={shift._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          {getShiftIcon(shift.name, shift.startTime)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{shift.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {shift._id.slice(-6)}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 font-mono font-bold text-xs text-slate-800">
                        <span>{shift.startTime}</span>
                        <span className="text-slate-400">⟶</span>
                        <span>{shift.endTime}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{shift.lateThresholdMinutes || 15}</span>
                        <span className="text-slate-500 text-[11px]">phút tính từ giờ bắt đầu</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {shift.isActive !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đang Áp Dụng</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold">
                          <span>Tạm Ngưng</span>
                        </span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(shift)}
                            className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition"
                            title="Chỉnh sửa ca"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setShiftToDelete(shift);
                              setDeleteModalOpen(true);
                            }}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa ca"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* MODAL THÊM / CẬP NHẬT CA LÀM VIỆC */}
      {/* ======================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Tạo Mới Ca Làm Việc' : 'Cập Nhật Cấu Hình Ca'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Tên ca */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên Ca Học / Ca Làm Việc *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Ca Sáng (Tiết 1 - 4)"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Giờ bắt đầu & kết thúc */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giờ Bắt Đầu (HH:mm) *
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giờ Kết Thúc (HH:mm) *
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Ngưỡng trễ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Số Phút Cho Phép Đi Muộn *</span>
                  <span className="text-[11px] font-normal text-slate-400">Ngưỡng Grace Period</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.lateThresholdMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, lateThresholdMinutes: parseInt(e.target.value, 10) || 0 })
                    }
                    required
                    className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    phút
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-500" />
                  <span>Sau thời gian này, hệ thống sẽ tự động tính trạng thái ĐI MUỘN (LATE).</span>
                </p>
              </div>

              {/* Trạng thái áp dụng */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveShift"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="isActiveShift" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt áp dụng ca làm việc này
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo Ca Mới' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL XÁC NHẬN XÓA CA */}
      {/* ======================================================= */}
      {deleteModalOpen && shiftToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa ca làm việc?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa <span className="font-bold text-slate-800">&quot;{shiftToDelete.name}&quot;</span>?
              Hệ thống sẽ chặn xóa nếu ca này đang được xếp lịch cho giảng viên.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsPage;
