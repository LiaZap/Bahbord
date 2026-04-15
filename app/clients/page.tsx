'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Building2, Package, Users, Trash2, X, Mail, Phone, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ── Types ──────────────────────────────────────────────────
interface Client {
  id: string;
  name: string;
  color: string;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  organization_id: string | null;
  organization_name: string | null;
  ticket_count: number;
}

interface Organization {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  client_count: number;
}

interface Product {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
  client_count: number;
}

type Tab = 'clients' | 'organizations' | 'products';

// ── Main Page ──────────────────────────────────────────────
export default function ClientsPage() {
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    try {
      const [c, o, p] = await Promise.all([
        fetch('/api/clients').then((r) => r.json()),
        fetch('/api/organizations').then((r) => r.json()),
        fetch('/api/products').then((r) => r.json()),
      ]);
      setClients(c);
      setOrgs(o);
      setProducts(p);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'clients', label: 'Clientes', icon: Users, count: clients.length },
    { key: 'organizations', label: 'Organizacoes', icon: Building2, count: orgs.length },
    { key: 'products', label: 'Produtos', icon: Package, count: products.length },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Clientes</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie clientes, organizacoes e produtos</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-surface2 p-1 w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium transition',
                active
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon size={15} className={active ? 'text-accent' : 'text-slate-500'} />
              {t.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                active ? 'bg-accent/20 text-accent' : 'bg-white/[0.04] text-slate-600'
              )}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'clients' && <ClientsTab clients={clients} orgs={orgs} onRefresh={fetchAll} />}
      {tab === 'organizations' && <OrganizationsTab orgs={orgs} onRefresh={fetchAll} />}
      {tab === 'products' && <ProductsTab products={products} onRefresh={fetchAll} />}
    </div>
  );
}

// ── Clients Tab ────────────────────────────────────────────
function ClientsTab({ clients, orgs, onRefresh }: { clients: Client[]; orgs: Organization[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orgId, setOrgId] = useState('');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contact_email?.toLowerCase().includes(q) ||
        c.organization_name?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  function resetForm() {
    setName(''); setColor('#6366f1'); setEmail(''); setPhone(''); setOrgId('');
    setShowForm(false); setSelectedClient(null);
  }

  function openEdit(c: Client) {
    setSelectedClient(c);
    setName(c.name);
    setColor(c.color);
    setEmail(c.contact_email || '');
    setPhone(c.contact_phone || '');
    setOrgId(c.organization_id || '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const body: Record<string, unknown> = {
      name: name.trim(), color, contact_email: email || null,
      contact_phone: phone || null, organization_id: orgId || null,
    };
    if (selectedClient) {
      body.id = selectedClient.id;
      await fetch('/api/clients', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    resetForm();
    onRefresh();
  }

  async function handleToggleActive(c: Client) {
    await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
    });
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este cliente?')) return;
    const res = await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clientes..."
            className="w-full rounded-md border border-border/40 bg-surface2 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={15} />
          Novo cliente
        </button>
      </div>

      {message && (
        <div className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{message}</div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="rounded-lg border border-accent/30 bg-surface2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{selectedClient ? 'Editar cliente' : 'Novo cliente'}</h3>
            <button onClick={resetForm} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Nome</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Cor</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border-0 bg-transparent" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">E-mail</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Telefone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(51) 99999-0000" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Organizacao</label>
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none">
                <option value="">Sem organizacao</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
              {selectedClient ? 'Salvar' : 'Criar'}
            </button>
            <button onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-300">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-surface2">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nome</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Organizacao</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">E-mail</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Telefone</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Tickets</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => openEdit(c)}
                className="border-b border-border/20 transition cursor-pointer hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium text-slate-200">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-[13px]">{c.organization_name || '-'}</td>
                <td className="px-4 py-3 text-slate-400 text-[13px]">
                  {c.contact_email ? (
                    <span className="flex items-center gap-1"><Mail size={12} className="text-slate-600" />{c.contact_email}</span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-slate-400 text-[13px]">
                  {c.contact_phone ? (
                    <span className="flex items-center gap-1"><Phone size={12} className="text-slate-600" />{c.contact_phone}</span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
                    {c.ticket_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(c); }}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition',
                      c.is_active ? 'bg-success/20 text-success' : 'bg-slate-700/50 text-slate-500'
                    )}
                  >
                    {c.is_active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                    className="text-slate-600 transition hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Organizations Tab ──────────────────────────────────────
function OrganizationsTab({ orgs, onRefresh }: { orgs: Organization[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [message, setMessage] = useState('');

  function resetForm() {
    setName(''); setDomain(''); setShowForm(false); setEditId(null);
  }

  function openEdit(o: Organization) {
    setEditId(o.id);
    setName(o.name);
    setDomain(o.domain || '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const body: Record<string, unknown> = { name: name.trim(), domain: domain || null };
    if (editId) {
      body.id = editId;
      await fetch('/api/organizations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    resetForm();
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta organizacao?')) return;
    const res = await fetch(`/api/organizations?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span />
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={15} />
          Nova organizacao
        </button>
      </div>

      {message && (
        <div className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{message}</div>
      )}

      {showForm && (
        <div className="rounded-lg border border-accent/30 bg-surface2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{editId ? 'Editar organizacao' : 'Nova organizacao'}</h3>
            <button onClick={resetForm} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Nome</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} placeholder="Nome da organizacao" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Dominio</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} placeholder="empresa.com.br" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
              {editId ? 'Salvar' : 'Criar'}
            </button>
            <button onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-300">Cancelar</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-surface2">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nome</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dominio</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Clientes</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr
                key={o.id}
                onClick={() => openEdit(o)}
                className="border-b border-border/20 transition cursor-pointer hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-slate-500" />
                    <span className="font-medium text-slate-200">{o.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-[13px]">
                  {o.domain ? (
                    <span className="flex items-center gap-1"><ExternalLink size={12} className="text-slate-600" />{o.domain}</span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
                    {o.client_count}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
                    className="text-slate-600 transition hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  Nenhuma organizacao cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Products Tab ───────────────────────────────────────────
function ProductsTab({ products, onRefresh }: { products: Product[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [description, setDescription] = useState('');

  function resetForm() {
    setName(''); setColor('#6366f1'); setDescription(''); setShowForm(false);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color, description: description || null }),
    });
    resetForm();
    onRefresh();
  }

  async function handleToggle(p: Product) {
    await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este produto?')) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span />
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={15} />
          Novo produto
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-accent/30 bg-surface2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Novo produto</h3>
            <button onClick={resetForm} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Nome</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Cor</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border-0 bg-transparent" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Descricao</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descricao do produto..." className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60 resize-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Criar</button>
            <button onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-300">Cancelar</button>
          </div>
        </div>
      )}

      {/* Product cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="group rounded-lg border border-border/40 bg-surface2 p-5 transition hover:border-white/[0.12]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <h3 className="text-[15px] font-semibold text-white">{p.name}</h3>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {p.description && (
              <p className="mb-3 text-[13px] text-slate-400 line-clamp-2">{p.description}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{p.client_count} cliente{p.client_count !== 1 ? 's' : ''}</span>
              <button
                onClick={() => handleToggle(p)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition',
                  p.is_active ? 'bg-success/20 text-success' : 'bg-slate-700/50 text-slate-500'
                )}
              >
                {p.is_active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 py-8 text-center text-sm text-slate-500">
            Nenhum produto cadastrado
          </div>
        )}
      </div>
    </div>
  );
}
