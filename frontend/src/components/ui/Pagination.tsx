import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  limit?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  limit,
}) => {
  if (totalPages <= 1 && !totalItems) return null;

  const startItem = totalItems !== undefined && limit ? (currentPage - 1) * limit + 1 : undefined;
  const endItem =
    totalItems !== undefined && limit ? Math.min(currentPage * limit, totalItems) : undefined;

  // Tính toán mảng trang hiển thị (tối đa 5 trang xung quanh currentPage)
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    const end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 border-t border-slate-200">
      {/* Thông tin số bản ghi */}
      <div className="text-xs text-slate-500">
        {totalItems !== undefined ? (
          <span>
            Hiển thị <span className="font-semibold text-slate-700">{startItem}</span> -{' '}
            <span className="font-semibold text-slate-700">{endItem}</span> trong tổng số{' '}
            <span className="font-semibold text-slate-700">{totalItems}</span> bản ghi
          </span>
        ) : (
          <span>
            Trang <span className="font-semibold text-slate-700">{currentPage}</span> / {totalPages}
          </span>
        )}
      </div>

      {/* Điều hướng trang */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              'min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors',
              page === currentPage
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
            )}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Trang tiếp"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
