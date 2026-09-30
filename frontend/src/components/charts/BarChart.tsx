import React, { useState } from 'react';

export interface BarDataPoint {
  label: string;
  onTime: number;
  late: number;
  absent: number;
  excused?: number;
}

interface BarChartProps {
  data: BarDataPoint[];
  title?: string;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title = 'So Sánh Đúng Giờ vs Đi Muộn vs Vắng Mặt',
  height = 280,
}) => {
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
        Không có dữ liệu biểu đồ
      </div>
    );
  }

  // Tìm giá trị max để scale trục Y
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.onTime, d.late, d.absent, d.excused || 0)),
    5
  );
  const chartHeight = height - 60; // Dành 60px cho trục X và legend
  const barWidth = 14;
  const groupSpacing = 70;
  const svgWidth = Math.max(data.length * groupSpacing + 80, 360);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Đúng giờ
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Đi muộn
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Vắng mặt
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Có phép
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width="100%" height={height} viewBox={`0 0 ${svgWidth} ${height}`} className="overflow-visible">
          {/* Trục kẻ ngang ngầm định */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = chartHeight - ratio * (chartHeight - 20) + 10;
            const val = Math.round(ratio * maxVal);
            return (
              <g key={i}>
                <line x1={40} y1={y} x2={svgWidth - 20} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
                <text x={32} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Các nhóm cột */}
          {data.map((item, idx) => {
            const groupX = 60 + idx * groupSpacing;
            const isHovered = hoveredGroup === idx;

            const onTimeH = (item.onTime / maxVal) * (chartHeight - 20);
            const lateH = (item.late / maxVal) * (chartHeight - 20);
            const absentH = (item.absent / maxVal) * (chartHeight - 20);
            const excusedH = ((item.excused || 0) / maxVal) * (chartHeight - 20);

            const baseY = chartHeight + 10;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredGroup(idx)}
                onMouseLeave={() => setHoveredGroup(null)}
                onClick={() => setHoveredGroup((prev) => (prev === idx ? null : idx))}
                className="cursor-pointer transition-opacity"
              >
                {/* Highlight background khi hover */}
                {isHovered && (
                  <rect
                    x={groupX - 6}
                    y={10}
                    width={barWidth * 4 + 16}
                    height={chartHeight}
                    fill="#f8fafc"
                    rx={6}
                  />
                )}

                {/* Cột 1: Đúng giờ */}
                <rect
                  x={groupX}
                  y={baseY - onTimeH}
                  width={barWidth}
                  height={Math.max(onTimeH, 2)}
                  fill="#10b981"
                  rx={3}
                />

                {/* Cột 2: Đi muộn */}
                <rect
                  x={groupX + barWidth + 2}
                  y={baseY - lateH}
                  width={barWidth}
                  height={Math.max(lateH, 2)}
                  fill="#f59e0b"
                  rx={3}
                />

                {/* Cột 3: Vắng mặt */}
                <rect
                  x={groupX + (barWidth + 2) * 2}
                  y={baseY - absentH}
                  width={barWidth}
                  height={Math.max(absentH, 2)}
                  fill="#ef4444"
                  rx={3}
                />

                {/* Cột 4: Có phép */}
                <rect
                  x={groupX + (barWidth + 2) * 3}
                  y={baseY - excusedH}
                  width={barWidth}
                  height={Math.max(excusedH, 2)}
                  fill="#3b82f6"
                  rx={3}
                />

                {/* Nhãn trục X */}
                <text
                  x={groupX + barWidth * 2}
                  y={baseY + 18}
                  fill="#64748b"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  textAnchor="middle"
                >
                  {item.label}
                </text>

                {/* Tooltip hiển thị số khi hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={groupX - 10}
                      y={baseY - Math.max(onTimeH, lateH, absentH, excusedH) - 30}
                      width={80}
                      height={24}
                      fill="#0f172a"
                      rx={4}
                    />
                    <text
                      x={groupX + 30}
                      y={baseY - Math.max(onTimeH, lateH, absentH, excusedH) - 14}
                      fill="#ffffff"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Đ:{item.onTime} M:{item.late} V:{item.absent}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default BarChart;
