import {
  BookOpen, CheckCircle2, Bug, Zap, FileText,
  Star, Lightbulb, Shield, Rocket, Flag, Target, Wrench, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const typeConfig: Record<string, { icon: typeof BookOpen; bg: string; text: string }> = {
  'história': { icon: BookOpen, bg: 'bg-blue-500/15', text: 'text-blue-400' },
  'historia': { icon: BookOpen, bg: 'bg-blue-500/15', text: 'text-blue-400' },
  'story': { icon: BookOpen, bg: 'bg-blue-500/15', text: 'text-blue-400' },
  'tarefa': { icon: CheckCircle2, bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  'task': { icon: CheckCircle2, bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  'bug': { icon: Bug, bg: 'bg-red-500/15', text: 'text-red-400' },
  'epic': { icon: Zap, bg: 'bg-violet-500/15', text: 'text-violet-400' },
  'melhoria': { icon: Star, bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'improvement': { icon: Star, bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'ideia': { icon: Lightbulb, bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  'idea': { icon: Lightbulb, bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  'segurança': { icon: Shield, bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'security': { icon: Shield, bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'feature': { icon: Rocket, bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  'milestone': { icon: Flag, bg: 'bg-pink-500/15', text: 'text-pink-400' },
  'objetivo': { icon: Target, bg: 'bg-teal-500/15', text: 'text-teal-400' },
  'manutenção': { icon: Wrench, bg: 'bg-slate-500/15', text: 'text-slate-400' },
  'incidente': { icon: AlertCircle, bg: 'bg-red-500/15', text: 'text-red-400' },
};

const emojiMap: Record<string, string> = {
  '📘': 'história',
  '✅': 'tarefa',
  '🐛': 'bug',
  '⚡': 'epic',
  '⭐': 'melhoria',
  '💡': 'ideia',
  '🛡️': 'segurança',
  '🚀': 'feature',
};

// Gera cor a partir do nome para tipos desconhecidos
const fallbackColors = [
  { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  { bg: 'bg-lime-500/15', text: 'text-lime-400' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' },
  { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

interface TicketTypeIconProps {
  typeName?: string | null;
  typeIcon?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showBackground?: boolean;
}

export default function TicketTypeIcon({ typeName, typeIcon, size = 'sm', showBackground = true }: TicketTypeIconProps) {
  const key = typeName?.toLowerCase() || emojiMap[typeIcon || ''] || '';
  const known = typeConfig[key];

  // Para tipos desconhecidos: usar FileText com cor baseada no hash do nome
  const fallback = fallbackColors[hashString(key) % fallbackColors.length];
  const config = known || { icon: FileText, bg: fallback.bg, text: fallback.text };
  const Icon = config.icon;

  const sizes = {
    sm: { container: 'h-5 w-5', icon: 14 },
    md: { container: 'h-6 w-6', icon: 16 },
    lg: { container: 'h-8 w-8', icon: 20 },
  };

  const s = sizes[size];

  if (!showBackground) {
    return <Icon size={s.icon} className={config.text} />;
  }

  return (
    <div className={cn('flex items-center justify-center rounded', s.container, config.bg)}>
      <Icon size={s.icon} strokeWidth={2} className={config.text} />
    </div>
  );
}
