'use client';

import { useState } from 'react';
import { Settings, Users, Columns3, Tag, Layers, Type, Smile, Webhook, Link2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import GeneralSettings from './GeneralSettings';
import MembersSettings from './MembersSettings';
import StatusesSettings from './StatusesSettings';
import ServicesSettings from './ServicesSettings';
import CategoriesSettings from './CategoriesSettings';
import TicketTypesSettings from './TicketTypesSettings';
import QuickReactionsSettings from './QuickReactionsSettings';
import WebhookSettings from './WebhookSettings';
import ClockifySettings from './ClockifySettings';
import WhatsAppSettings from './WhatsAppSettings';

type SettingsTab = 'general' | 'members' | 'statuses' | 'services' | 'categories' | 'ticket_types' | 'reactions' | 'webhooks' | 'clockify' | 'whatsapp';

const tabs: { key: SettingsTab; label: string; icon: React.ElementType; section?: string }[] = [
  { key: 'general', label: 'Geral', icon: Settings },
  { key: 'members', label: 'Membros', icon: Users },
  { key: 'statuses', label: 'Colunas (Status)', icon: Columns3 },
  { key: 'services', label: 'Serviços/Produtos', icon: Tag },
  { key: 'categories', label: 'Categorias', icon: Layers },
  { key: 'ticket_types', label: 'Tipos de ticket', icon: Type },
  { key: 'reactions', label: 'Reações rápidas', icon: Smile },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook, section: 'Integrações' },
  { key: 'clockify', label: 'Clockify', icon: Link2, section: 'Integrações' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, section: 'Integrações' },
];

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="mb-6 text-xl font-bold text-white">Configurações</h1>

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            const showSection = tab.section && (index === 0 || tabs[index - 1]?.section !== tab.section);
            return (
              <div key={tab.key}>
                {showSection && (
                  <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {tab.section}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition',
                    active
                      ? 'bg-accent/15 text-white'
                      : 'text-slate-400 hover:bg-input/30 hover:text-slate-200'
                  )}
                >
                  <Icon size={15} className={active ? 'text-accent' : 'text-slate-500'} />
                  {tab.label}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'members' && <MembersSettings />}
          {activeTab === 'statuses' && <StatusesSettings />}
          {activeTab === 'services' && <ServicesSettings />}
          {activeTab === 'categories' && <CategoriesSettings />}
          {activeTab === 'ticket_types' && <TicketTypesSettings />}
          {activeTab === 'reactions' && <QuickReactionsSettings />}
          {activeTab === 'webhooks' && <WebhookSettings />}
          {activeTab === 'clockify' && <ClockifySettings />}
          {activeTab === 'whatsapp' && <WhatsAppSettings />}
        </div>
      </div>
    </div>
  );
}
