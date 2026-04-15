'use client';

import { cn } from '@/lib/utils/cn';

const gradients = [
  'from-blue-600 to-blue-500',
  'from-violet-600 to-purple-500',
  'from-emerald-600 to-green-500',
  'from-amber-600 to-orange-500',
  'from-rose-600 to-pink-500',
  'from-cyan-600 to-teal-500',
  'from-indigo-600 to-blue-500',
  'from-fuchsia-600 to-pink-500',
];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

const sizeMap = {
  xs: { wh: 'h-[18px] w-[18px]', text: 'text-[7px]', px: 18 },
  sm: { wh: 'h-6 w-6', text: 'text-[8px]', px: 24 },
  md: { wh: 'h-8 w-8', text: 'text-[10px]', px: 32 },
  lg: { wh: 'h-10 w-10', text: 'text-[12px]', px: 40 },
} as const;

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ name, imageUrl, size = 'md', className }: AvatarProps) {
  const s = sizeMap[size];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        title={name}
        className={cn('shrink-0 rounded-full object-cover', s.wh, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white',
        s.wh,
        s.text,
        nameToColor(name),
        className
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
