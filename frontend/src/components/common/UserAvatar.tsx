import React, { useState } from 'react';
import { getSafeMediaUrl } from '../../utils';

export interface UserAvatarProps {
  user?: {
    fullName?: string;
    avatar?: string | null;
    email?: string;
  } | null;
  src?: string | null;
  avatarUrl?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showStatus?: boolean;
  isActive?: boolean;
}

// Bảng màu pastel nhất quán theo hash của tên hoặc email
const COLOR_PALETTES = [
  { bg: 'bg-blue-100 text-blue-700 border-blue-200' },
  { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { bg: 'bg-violet-100 text-violet-700 border-violet-200' },
  { bg: 'bg-amber-100 text-amber-700 border-amber-200' },
  { bg: 'bg-rose-100 text-rose-700 border-rose-200' },
  { bg: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
];

const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase();
};

const getColorPalette = (seed?: string) => {
  if (!seed) return COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
};

const SIZE_MAP = {
  xs: {
    container: 'w-6 h-6 text-[10px] rounded-lg',
    status: 'w-1.5 h-1.5 bottom-0 right-0',
  },
  sm: {
    container: 'w-8 h-8 text-xs rounded-xl',
    status: 'w-2 h-2 bottom-0 right-0',
  },
  md: {
    container: 'w-10 h-10 text-xs rounded-xl',
    status: 'w-2.5 h-2.5 bottom-0 right-0',
  },
  lg: {
    container: 'w-12 h-12 text-sm rounded-2xl',
    status: 'w-3 h-3 bottom-0.5 right-0.5',
  },
  xl: {
    container: 'w-16 h-16 text-lg rounded-2xl',
    status: 'w-3.5 h-3.5 bottom-0.5 right-0.5',
  },
  '2xl': {
    container: 'w-20 h-20 sm:w-24 sm:h-24 text-2xl rounded-2xl',
    status: 'w-4 h-4 bottom-0.5 right-0.5',
  },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  src,
  avatarUrl,
  name,
  size = 'md',
  className = '',
  showStatus = false,
  isActive = true,
}) => {
  const [hasError, setHasError] = useState(false);

  const rawUrl = src || avatarUrl || user?.avatar;

  React.useEffect(() => {
    setHasError(false);
  }, [rawUrl]);

  const safeUrl = rawUrl ? getSafeMediaUrl(rawUrl) : '';
  const displayName = name || user?.fullName || user?.email || 'Người dùng';
  const initials = getInitials(displayName);
  const palette = getColorPalette(displayName);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  const hasImage = Boolean(safeUrl && !hasError);

  return (
    <div className={`relative inline-flex shrink-0 ${sizeConfig.container} ${className}`}>
      <div
        className={`w-full h-full rounded-[inherit] flex items-center justify-center font-bold overflow-hidden border select-none transition-transform ${
          hasImage ? 'bg-slate-100 border-slate-200/80 shadow-xs' : `${palette.bg}`
        }`}
      >
        {hasImage ? (
          <img
            src={safeUrl}
            alt={displayName}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {showStatus && (
        <span
          className={`absolute rounded-full ring-2 ring-white ${sizeConfig.status} ${
            isActive ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
          title={isActive ? 'Hoạt động' : 'Không hoạt động'}
        />
      )}
    </div>
  );
};

export default UserAvatar;
