import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../utils';

export interface Column<T> {
  header: string;
  key?: string;
  className?: string;
  render?: (item: T, index: number) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  rowKey?: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'Không có dữ liệu hiển thị.',
  emptyIcon,
  rowKey,
  onRowClick,
  className,
}: TableProps<T>) {
  return (
    <div className={cn('w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table Header */}
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {columns.map((col, index) => (
                <th key={index} className={cn('py-3.5 px-4', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 5 }).map((_, rIndex) => (
                <tr key={`skeleton-${rIndex}`} className="animate-pulse">
                  {columns.map((_, cIndex) => (
                    <td key={`skeleton-${rIndex}-${cIndex}`} className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      {emptyIcon || <Inbox className="w-6 h-6" />}
                    </div>
                    <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((item, rowIndex) => {
                const key = rowKey ? rowKey(item, rowIndex) : rowIndex;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={cn(
                      'hover:bg-slate-50/80 transition-colors',
                      onRowClick ? 'cursor-pointer' : ''
                    )}
                  >
                    {columns.map((col, colIndex) => (
                      <td key={colIndex} className={cn('py-3.5 px-4 align-middle', col.className)}>
                        {col.render
                          ? col.render(item, rowIndex)
                          : col.key
                          ? String((item as Record<string, unknown>)[col.key] ?? '-')
                          : '-'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
