import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Building,
} from 'lucide-react';
import { ShiftConfig } from '../../types';
import { shiftConfigApi, CreateShiftPayload, UpdateShiftPayload } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

// Schema validate form bằng Zod
const shiftSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Tên ca phải có ít nhất 2 ký tự')
      .max(100, 'Tên ca không được vượt quá 100 ký tự'),
    startTime: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Giờ bắt đầu phải có định dạng HH:mm'),
    endTime: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Giờ kết thúc phải có định dạng HH:mm'),
    lateThresholdMinutes: z
      .number()
      .min(0, 'Ngưỡng trễ không được âm')
      .max(120, 'Ngưỡng trễ tối đa 120 phút'),
    earlyExitThresholdMinutes: z
      .number()
      .min(0, 'Ngưỡng về sớm không được âm')
      .max(120, 'Ngưỡng về sớm tối đa 120 phút')
      .optional(),
    isActive: z.boolean(),
  })
  .refine((data: { startTime: string; endTime: string }) => data.startTime < data.endTime, {
    message: 'Giờ bắt đầu ca phải diễn ra trước giờ kết thúc ca',
    path: ['endTime'],
  });

type ShiftFormData = z.infer<typeof shiftSchema>;

export const ShiftsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Trạng thái Modal Thêm / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedShift, setSelectedShift] = useState<ShiftConfig | null>(null);

  // Trạng thái Modal Xóa
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<ShiftConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hook Form với Zod Resolver
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: '',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    },
  });

  // Tải danh sách ca làm việc từ API
  const fetchShifts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await shiftConfigApi.getAll();
      setShifts(res.data || []);
    } catch (err: unknown) {
      console.error('[ShiftsPage] Lỗi tải ca làm việc:', err);
      toast.error('Không thể tải danh sách ca làm việc từ máy chủ.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Mở modal thêm ca mới
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedShift(null);
    reset({
      name: '',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Mở modal sửa ca
  const handleOpenEditModal = (shift: ShiftConfig) => {
    setModalMode('edit');
    setSelectedShift(shift);
    reset({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateThresholdMinutes: shift.lateThresholdMinutes ?? 15,
      earlyExitThresholdMinutes: shift.earlyExitThresholdMinutes ?? 15,
      isActive: shift.isActive !== undefined ? shift.isActive : true,
    });
    setIsModalOpen(true);
  };

  // Xử lý gửi Form (Thêm hoặc Cập nhật)
  const onSubmit = async (data: ShiftFormData) => {
    try {
      if (modalMode === 'create') {
        const payload: CreateShiftPayload = {
          name: data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          lateThresholdMinutes: data.lateThresholdMinutes,
          earlyExitThresholdMinutes: data.earlyExitThresholdMinutes,
        };
        await shiftConfigApi.create(payload);
        toast.success(`Đã thêm mới ca "${data.name}" thành công!`);
      } else if (selectedShift) {
        const payload: UpdateShiftPayload = {
          name: data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          lateThresholdMinutes: data.lateThresholdMinutes,
          earlyExitThresholdMinutes: data.earlyExitThresholdMinutes,
          isActive: data.isActive,
        };
        await shiftConfigApi.update(selectedShift._id, payload);
        toast.success(`Đã cập nhật ca "${data.name}" thành công!`);
      }
      setIsModalOpen(false);
      fetchShifts();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Lỗi khi lưu thông tin ca làm việc.');
    }
  };

  // Xử lý Xóa ca làm việc
  const handleDelete = async () => {
    if (!shiftToDelete) return;
    try {
      setIsDeleting(true);
      await shiftConfigApi.delete(shiftToDelete._id);
      toast.success(`Đã xóa ca "${shiftToDelete.name}" thành công.`);
      setDeleteModalOpen(false);
      setShiftToDelete(null);
      fetchShifts();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(
        apiErr.response?.data?.message ||
          'Không thể xóa ca này (có thể do đang có Lịch giảng dạy liên kết).'
      );
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
    } else if (name.toLowerCase().includes('hành chính')) {
      return <Building className="w-5 h-5 text-emerald-500" />;
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
            <span>Thời Khóa Biểu & Khung Giờ Làm Việc</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Cấu Hình Ca Làm Việc (Shift Config)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Định nghĩa thời gian ca giảng dạy/hành chính, ngưỡng trễ và quy tắc tự động đánh giá điểm danh.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchShifts}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-xs"
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

      {/* Cards Tóm Tắt Nhanh Khung Giờ Chuẩn */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 rounded-3xl border border-amber-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Ca Sáng</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Tiết 1 - 4 (07:00 - 11:30)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ngưỡng trễ: 15 phút</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-rose-50/50 p-5 rounded-3xl border border-orange-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-600 flex items-center justify-center">
            <Sunset className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Ca Chiều</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Tiết 5 - 8 (13:00 - 17:30)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ngưỡng trễ: 15 phút</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-5 rounded-3xl border border-indigo-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Ca Tối</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Tiết 9 - 12 (18:00 - 21:30)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Học kỳ phụ / VB2</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 rounded-3xl border border-emerald-200/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Hành Chính</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">08:00 - 17:00</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Phòng ban & Chuyên viên</p>
          </div>
        </div>
      </div>

      {/* Bảng Danh Sách Ca Làm Việc */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Danh Sách Ca Làm Việc Hiện Hữu ({shifts.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống tự động đối chiếu khung ca để xác định trạng thái Check-in (Đúng giờ / Muộn)
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500">Đang tải danh sách ca...</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Chưa có cấu hình ca làm việc nào. Bấm &quot;Thêm Ca Mới&quot; để tạo ca đầu tiên.
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {shifts.map((shift) => (
                <div key={shift._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 shrink-0">
                        {getShiftIcon(shift.name, shift.startTime)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{shift.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Mã: #{shift._id.slice(-6).toUpperCase()}
                        </p>
                      </div>
                    </div>
                    {shift.isActive !== false ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Áp Dụng</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold shrink-0">
                        <span>Tạm Ngưng</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800">
                      <span>{shift.startTime}</span>
                      <span className="text-slate-400">⟶</span>
                      <span>{shift.endTime}</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Trễ tối đa: <span className="font-bold text-slate-800">{shift.lateThresholdMinutes ?? 15} phút</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                      <button
                        onClick={() => handleOpenEditModal(shift)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Chỉnh sửa</span>
                      </button>
                      <button
                        onClick={() => {
                          setShiftToDelete(shift);
                          setDeleteModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa ca</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Tên Ca Làm Việc</th>
                  <th className="py-4 px-6">Khung Giờ Bắt Đầu - Kết Thúc</th>
                  <th className="py-4 px-6">Ngưỡng Trễ Cho Phép</th>
                  <th className="py-4 px-6">Trạng Thái</th>
                  {isAdmin && <th className="py-4 px-6 text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift) => (
                  <tr key={shift._id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                          {getShiftIcon(shift.name, shift.startTime)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{shift.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Mã: {shift._id.slice(-6).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono font-bold text-xs text-slate-800">
                        <span>{shift.startTime}</span>
                        <span className="text-slate-400">⟶</span>
                        <span>{shift.endTime}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm">
                          {shift.lateThresholdMinutes ?? 15}
                        </span>
                        <span className="text-slate-500 text-[11px]">phút (Grace Period)</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {shift.isActive !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đang Áp Dụng</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold">
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
        </>
        )}
      </div>

      {/* ======================================================= */}
      {/* MODAL THÊM / CẬP NHẬT CA LÀM VIỆC (REACT-HOOK-FORM + ZOD) */}
      {/* ======================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Tạo Mới Ca Làm Việc' : 'Cập Nhật Cấu Hình Ca'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Tên ca */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên Ca Học / Ca Làm Việc *
                </label>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="Ví dụ: Ca Sáng (Tiết 1 - 4)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && (
                  <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.name.message}</p>
                )}
              </div>

              {/* Giờ bắt đầu & kết thúc */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giờ Bắt Đầu (HH:mm) *
                  </label>
                  <input
                    type="time"
                    {...register('startTime')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.startTime && (
                    <p className="text-rose-500 text-[11px] mt-1 font-medium">
                      {errors.startTime.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Giờ Kết Thúc (HH:mm) *
                  </label>
                  <input
                    type="time"
                    {...register('endTime')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.endTime && (
                    <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.endTime.message}</p>
                  )}
                </div>
              </div>

              {/* Ngưỡng trễ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Số Phút Cho Phép Đi Muộn *</span>
                  <span className="text-[11px] font-normal text-slate-400">Grace Period</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    {...register('lateThresholdMinutes', { valueAsNumber: true })}
                    className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    phút
                  </div>
                </div>
                {errors.lateThresholdMinutes && (
                  <p className="text-rose-500 text-[11px] mt-1 font-medium">
                    {errors.lateThresholdMinutes.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-500" />
                  <span>Sau ngưỡng này, hệ thống sẽ tự động chuyển trạng thái sang ĐI MUỘN (LATE).</span>
                </p>
              </div>

              {/* Trạng thái áp dụng */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveShift"
                  {...register('isActive')}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="isActiveShift" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt áp dụng ca làm việc này
                </label>
              </div>

              {/* Action Buttons */}
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
              Bạn có chắc chắn muốn xóa{' '}
              <span className="font-bold text-slate-800">&quot;{shiftToDelete.name}&quot;</span>?
              Hệ thống sẽ chặn thao tác nếu ca này đang có Lịch giảng dạy liên kết trong học kỳ.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
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
