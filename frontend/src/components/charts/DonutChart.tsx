import React, { useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  title?: string;
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  title = 'Cơ Cấu Chuyên Cần Theo Tỷ Lệ',
  size = 220,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm text-center text-slate-400 text-xs flex flex-col items-center justify-center min-h-[260px]">
        Chưa phát sinh dữ liệu chuyên cần
      </div>
    );
  }

  const radius = size / 2 - 24;
  const strokeWidth = 32;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <h4 className="text-sm font-bold text-slate-900 mb-4">{title}</h4>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {data.map((item, idx) => {
              if (item.value === 0) return null;
              const fraction = item.value / total;
              const strokeDasharray = `${fraction * circumference} ${circumference}`;
              const strokeDashoffset = -cumulativeAngle * circumference;
              cumulativeAngle += fraction;

              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center Info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {hoveredIdx !== null ? (
              <>
                <span className="text-xs font-semibold text-slate-500">{data[hoveredIdx].label}</span>
                <span className="text-xl font-extrabold text-slate-900">
                  {Math.round((data[hoveredIdx].value / total) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400">{data[hoveredIdx].value} lượt</span>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-slate-400">Tổng cộng</span>
                <span className="text-2xl font-black text-slate-800">{total}</span>
                <span className="text-[10px] text-slate-400">lượt chấm công</span>
              </>
            )}
          </div>
        </div>

        {/* Legend List */}
        <div className="space-y-2.5 w-full sm:w-auto">
          {data.map((item, idx) => {
            const percent = Math.round((item.value / total) * 100);
            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  hoveredIdx === idx ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-700">{item.label}</span>
                </div>
                <span className="text-slate-900 font-mono">
                  {item.value} ({percent}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DonutChart;
