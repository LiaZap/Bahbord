import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-slate-500">
        <Icon size={24} />
      </div>
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
