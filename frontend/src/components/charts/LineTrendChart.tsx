import React, { useState } from 'react';

export interface TrendPoint {
  label: string; // VD: 'Tuần 1', 'Tuần 2' hoặc 'Tháng 1'
  rate: number;  // Tỷ lệ % đúng giờ
  lateRate: number; // Tỷ lệ % đi muộn
}

interface LineTrendChartProps {
  data: TrendPoint[];
  title?: string;
  height?: number;
}

export const LineTrendChart: React.FC<LineTrendChartProps> = ({
  data,
  title = 'Xu Hướng Chuyên Cần & Tỷ Lệ Đi Muộn',
  height = 240,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm text-center text-slate-400 text-xs">
        Không có dữ liệu xu hướng
      </div>
    );
  }

  const paddingX = 40;
  const paddingY = 30;
  const chartHeight = height - paddingY * 2;
  const svgWidth = Math.max(data.length * 70 + paddingX * 2, 360);
  const stepX = (svgWidth - paddingX * 2) / (data.length - 1 || 1);

  // Tính tọa độ các điểm
  const onTimePoints = data.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = paddingY + chartHeight - (d.rate / 100) * chartHeight;
    return { x, y, val: d.rate };
  });

  const latePoints = data.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = paddingY + chartHeight - (d.lateRate / 100) * chartHeight;
    return { x, y, val: d.lateRate };
  });

  const buildPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    return pts.reduce((acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`), '');
  };

  const onTimePath = buildPath(onTimePoints);
  const latePath = buildPath(latePoints);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> % Đúng giờ
          </span>
          <span className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> % Đi muộn
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width="100%" height={height} viewBox={`0 0 ${svgWidth} ${height}`} className="overflow-visible">
          {/* Lưới ngang định chuẩn 0%, 25%, 50%, 75%, 100% */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = paddingY + chartHeight - (pct / 100) * chartHeight;
            return (
              <g key={pct}>
                <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
                <text x={paddingX - 8} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Đường Đúng Giờ (Emerald) */}
          <path d={onTimePath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Đường Đi Muộn (Amber) */}
          <path d={latePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" />

          {/* Các điểm tròn dữ liệu */}
          {data.map((item, idx) => {
            const ptOnTime = onTimePoints[idx];
            const ptLate = latePoints[idx];
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx((prev) => (prev === idx ? null : idx))}
                className="cursor-pointer"
              >
                {/* Đường dóng dọc khi hover */}
                {isHovered && (
                  <line
                    x1={ptOnTime.x}
                    y1={paddingY}
                    x2={ptOnTime.x}
                    y2={paddingY + chartHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point OnTime */}
                <circle
                  cx={ptOnTime.x}
                  cy={ptOnTime.y}
                  r={isHovered ? 6 : 4}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />

                {/* Point Late */}
                <circle
                  cx={ptLate.x}
                  cy={ptLate.y}
                  r={isHovered ? 5 : 3.5}
                  fill="#ffffff"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />

                {/* Nhãn trục X */}
                <text
                  x={ptOnTime.x}
                  y={paddingY + chartHeight + 18}
                  fill="#64748b"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  textAnchor="middle"
                >
                  {item.label}
                </text>

                {/* Tooltip khi hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={ptOnTime.x - 45}
                      y={Math.min(ptOnTime.y, ptLate.y) - 34}
                      width={90}
                      height={26}
                      fill="#0f172a"
                      rx={4}
                    />
                    <text
                      x={ptOnTime.x}
                      y={Math.min(ptOnTime.y, ptLate.y) - 17}
                      fill="#ffffff"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Đúng: {item.rate}% | Muộn: {item.lateRate}%
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

export default LineTrendChart;
