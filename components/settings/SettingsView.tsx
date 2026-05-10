'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Settings, Users, Building2, Columns3, Tag, Layers, Type, Smile, Shield, ClipboardCheck, Webhook, Link2, MessageCircle, Zap, Share2, FileSearch, FileText, Repeat, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import GeneralSettings from './GeneralSettings';
import MembersSettings from './MembersSettings';
import StatusesSettings from './StatusesSettings';
import ServicesSettings from './ServicesSettings';
import CategoriesSettings from './CategoriesSettings';
import TicketTypesSettings from './TicketTypesSettings';
import QuickReactionsSettings from './QuickReactionsSettings';
import ClientsSettings from './ClientsSettings';
import WebhookSettings from './WebhookSettings';
import ClockifySettings from './ClockifySettings';
import WhatsAppSettings from './WhatsAppSettings';
import PermissionsSettings from './PermissionsSettings';
import ApprovalsSettings from './ApprovalsSettings';
import AutomationsSettings from './AutomationsSettings';
import ShareLinksSettings from './ShareLinksSettings';
import AuditSettings from './AuditSettings';
import TicketTemplatesSettings from './TicketTemplatesSettings';
import RecurringTicketsSettings from './RecurringTicketsSettings';

type SettingsTab = 'general' | 'clients' | 'members' | 'statuses' | 'services' | 'categories' | 'ticket_types' | 'ticket_templates' | 'reactions' | 'permissions' | 'approvals' | 'share' | 'audit' | 'automations' | 'recurring' | 'webhooks' | 'clockify' | 'whatsapp';

const tabs: { key: SettingsTab; label: string; icon: React.ElementType; section?: string }[] = [
  { key: 'general', label: 'Geral', icon: Settings },
  { key: 'clients', label: 'Clientes', icon: Building2 },
  { key: 'members', label: 'Membros', icon: Users },
  { key: 'statuses', label: 'Colunas (Status)', icon: Columns3 },
  { key: 'services', label: 'Serviços/Produtos', icon: Tag },
  { key: 'categories', label: 'Categorias', icon: Layers },
  { key: 'ticket_types', label: 'Tipos de ticket', icon: Type },
  { key: 'ticket_templates', label: 'Templates de ticket', icon: FileText },
  { key: 'reactions', label: 'Reações rápidas', icon: Smile },
  { key: 'permissions', label: 'Permissões', icon: Shield, section: 'Segurança' },
  { key: 'approvals', label: 'Aprovações', icon: ClipboardCheck, section: 'Segurança' },
  { key: 'share', label: 'Compartilhar', icon: Share2, section: 'Segurança' },
  { key: 'audit', label: 'Auditoria', icon: FileSearch, section: 'Segurança' },
  { key: 'automations', label: 'Automações', icon: Zap, section: 'Automações' },
  { key: 'recurring', label: 'Tickets recorrentes', icon: Repeat, section: 'Automações' },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook, section: 'Integrações' },
  { key: 'clockify', label: 'Clockify', icon: Link2, section: 'Integrações' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, section: 'Integrações' },
];

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-8 space-y-2">
        <p className="page-eyebrow">Workspace · Configurações</p>
        <h1 className="page-title">
          Ajustes do <span className="em">workspace.</span>
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Sidebar navigation — scroll horizontal em mobile (<lg), vertical em desktop */}
        <nav
          className="
            -mx-2 px-2 flex flex-row gap-1 overflow-x-auto
            lg:mx-0 lg:px-0 lg:flex-col lg:gap-0 lg:overflow-visible
            lg:w-48 lg:shrink-0 lg:space-y-0.5
            scrollbar-thin
          "
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            const showSection = tab.section && (index === 0 || tabs[index - 1]?.section !== tab.section);
            return (
              <div key={tab.key} className="shrink-0 lg:shrink lg:w-full">
                {showSection && (
                  <div className="hidden lg:block mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {tab.section}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition whitespace-nowrap',
                    active
                      ? 'bg-accent/15 text-white'
                      : 'text-slate-400 hover:bg-input/30 hover:text-slate-200'
                  )}
                >
                  <Icon size={15} className={active ? 'text-accent' : 'text-slate-500'} />
                  {tab.label}
                </button>
                {/* SLA aparece como link dedicado (página própria) logo após "Tickets recorrentes"
                    pra ficar agrupado em "Automações". */}
                {tab.key === 'recurring' && (
                  <Link
                    // typedRoutes só registra rotas existentes na hora do build —
                    // até a próxima geração de tipos, casteamos pra string literal.
                    href={'/settings/sla' as Route}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium text-slate-400 transition hover:bg-input/30 hover:text-slate-200 whitespace-nowrap"
                  >
                    <Clock size={15} className="text-slate-500" />
                    SLA
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'clients' && <ClientsSettings />}
          {activeTab === 'members' && <MembersSettings />}
          {activeTab === 'statuses' && <StatusesSettings />}
          {activeTab === 'services' && <ServicesSettings />}
          {activeTab === 'categories' && <CategoriesSettings />}
          {activeTab === 'ticket_types' && <TicketTypesSettings />}
          {activeTab === 'ticket_templates' && <TicketTemplatesSettings />}
          {activeTab === 'reactions' && <QuickReactionsSettings />}
          {activeTab === 'permissions' && <PermissionsSettings />}
          {activeTab === 'approvals' && <ApprovalsSettings />}
          {activeTab === 'share' && <ShareLinksSettings />}
          {activeTab === 'audit' && <AuditSettings />}
          {activeTab === 'automations' && <AutomationsSettings />}
          {activeTab === 'recurring' && <RecurringTicketsSettings />}
          {activeTab === 'webhooks' && <WebhookSettings />}
          {activeTab === 'clockify' && <ClockifySettings />}
          {activeTab === 'whatsapp' && <WhatsAppSettings />}
        </div>
      </div>
    </div>
  );
}
