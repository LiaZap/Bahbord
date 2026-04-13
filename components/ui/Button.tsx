import { cn } from '@/lib/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export default function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition',
        variant === 'primary' ? 'bg-accent text-slate-950 hover:bg-blue-500' : 'bg-white/10 text-slate-100 hover:bg-white/15',
        className
      )}
      {...props}
    />
  );
}
