import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PageIntro, SectionLabel, SkeletonBlock } from '@/components/shell';

type ActivityItem = { id: number; type: string; text: string; createdAt: string };
type Summary = {
  stats: { totalUsers: number; activeUsers: number; totalConversations: number; totalMessages: number; messagesToday: number; aiRepliesToday: number; responseRate: number };
  bot: { name: string; active: boolean; model: string };
  whatsapp: { status: string; connectedNumber: string | null; hasQr: boolean };
  api: { openaiConfigured: boolean; openaiKeyMasked: string };
  activity: ActivityItem[];
};
type SearchResults = {
  conversations: Array<{ id: number; label: string; detail: string; createdAt: string }>;
  messages: Array<{ id: number; conversationId: number; label: string; detail: string; createdAt: string }>;
  activity: Array<{ id: number; label: string; detail: string; createdAt: string }>;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`size-2 rounded-full ${active ? 'dot-live bg-primary' : 'bg-muted-foreground/40'}`} />;
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{children}</button>;
}

export default function ControlCenter() {
  const [tab, setTab] = useState<'analytics' | 'search' | 'notifications' | 'security' | 'backup'>('analytics');
  const [search, setSearch] = useState('');
  const [readNotifications, setReadNotifications] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('wa-read-notifications') || '[]') as number[]; } catch { return []; }
  });
  const summaryQuery = useQuery({ queryKey: ['/api/workspace/summary'], queryFn: () => getJson<Summary>('/api/workspace/summary'), refetchInterval: 15_000 });
  const searchQuery = useQuery({ queryKey: ['/api/workspace/search', search], queryFn: () => getJson<SearchResults>(`/api/workspace/search?q=${encodeURIComponent(search)}`), enabled: search.trim().length > 1 });
  const summary = summaryQuery.data;
  const notifications = summary?.activity ?? [];
  const unreadCount = notifications.filter((item) => !readNotifications.includes(item.id)).length;
  const metrics: Array<{ label: string; value: number; icon: LucideIcon; detail: string }> = summary ? [
    { label: 'Total users', value: summary.stats.totalUsers, icon: Users, detail: 'registered workspace accounts' },
    { label: 'Active users', value: summary.stats.activeUsers, icon: UserRound, detail: 'currently active session' },
    { label: 'Total messages', value: summary.stats.totalMessages, icon: MessageCircle, detail: `${summary.stats.messagesToday} received today` },
    { label: 'AI replies today', value: summary.stats.aiRepliesToday, icon: Sparkles, detail: `${summary.stats.responseRate}% response rate` },
  ] : [];

  const chart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of notifications) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    return Array.from(counts.entries()).slice(0, 5);
  }, [notifications]);

  function markRead(id: number) {
    const next = [...new Set([...readNotifications, id])];
    setReadNotifications(next);
    localStorage.setItem('wa-read-notifications', JSON.stringify(next));
  }

  function markAllRead() {
    const next = notifications.map((item) => item.id);
    setReadNotifications(next);
    localStorage.setItem('wa-read-notifications', JSON.stringify(next));
  }

  async function downloadBackup() {
    const response = await fetch('/api/workspace/export', { credentials: 'include' });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wa-bot-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div data-testid="page-control-center">
    <PageIntro eyebrow="Workspace / Operations" title="Control center" description="Monitor the team, bot health, AI usage, security signals, and workspace data from one place." action={<div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-bold text-primary"><StatusDot active={summary?.whatsapp.status === 'connected'} /> {summary?.whatsapp.status === 'connected' ? 'WhatsApp connected' : 'WhatsApp needs attention'}</div>} />

    <div className="mb-7 flex flex-wrap gap-1.5 rounded-2xl border border-card-border bg-card p-1.5 shadow-sm">
      <TabButton active={tab === 'analytics'} onClick={() => setTab('analytics')}><span className="inline-flex items-center gap-2"><BarChart3 size={14} /> Analytics</span></TabButton>
      <TabButton active={tab === 'search'} onClick={() => setTab('search')}><span className="inline-flex items-center gap-2"><Search size={14} /> Search</span></TabButton>
      <TabButton active={tab === 'notifications'} onClick={() => setTab('notifications')}><span className="inline-flex items-center gap-2"><Bell size={14} /> Notifications {unreadCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">{unreadCount}</span>}</span></TabButton>
      <TabButton active={tab === 'security'} onClick={() => setTab('security')}><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> Security</span></TabButton>
      <TabButton active={tab === 'backup'} onClick={() => setTab('backup')}><span className="inline-flex items-center gap-2"><Archive size={14} /> Backup & API</span></TabButton>
    </div>

    {summaryQuery.isError && <div className="mb-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">Control center belum bisa memuat data terbaru. Pastikan sesi login dan API server aktif.</div>}
    {summaryQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /></div> : summary && <>
      {tab === 'analytics' && <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon, detail }) => <div key={label} className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="mb-6 flex items-center justify-between"><span className="mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{label}</span><span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary"><Icon size={16} /></span></div><div className="text-3xl font-bold tracking-[-.05em]">{value}</div><div className="mt-2 text-xs text-muted-foreground">{detail}</div></div>)}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
          <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6"><SectionLabel meta="usage signals">Activity distribution</SectionLabel><div className="space-y-4">{chart.length ? chart.map(([type, count]) => <div key={type}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold capitalize">{type}</span><span className="mono text-muted-foreground">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(12, (count / Math.max(...chart.map(([, value]) => value))) * 100)}%` }} /></div></div>) : <div className="py-12 text-center text-sm text-muted-foreground">Belum ada aktivitas untuk dianalisis.</div>}</div></section>
          <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6"><SectionLabel meta="live status">System pulse</SectionLabel><div className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-xs"><span className="flex items-center gap-2"><Wifi size={14} /> WhatsApp</span><span className="flex items-center gap-2 font-bold"><StatusDot active={summary.whatsapp.status === 'connected'} /> {summary.whatsapp.status}</span></div><div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-xs"><span className="flex items-center gap-2"><Sparkles size={14} /> AI provider</span><span className="font-bold text-primary">{summary.api.openaiConfigured ? 'Configured' : 'Needs key'}</span></div><div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-xs"><span className="flex items-center gap-2"><BotIcon /> Bot runtime</span><span className="font-bold">{summary.bot.active ? 'Active' : 'Paused'}</span></div></div><Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">Open bot settings <Activity size={14} /></Link></section>
        </div>
      </div>}

      {tab === 'search' && <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-7"><SectionLabel meta="real-time search">Users, chats, messages, activity</SectionLabel><div className="relative mb-6"><Search className="absolute left-3 top-3 text-muted-foreground" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-10 pr-10" placeholder="Cari nama, nomor, isi pesan, atau aktivitas…" autoFocus />{search && <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X size={16} /></button>}</div>{!search.trim() ? <div className="py-14 text-center text-sm text-muted-foreground">Ketik minimal dua karakter untuk mencari di workspace.</div> : searchQuery.isLoading ? <SkeletonBlock className="h-24" /> : searchQuery.data && <div className="grid gap-6 md:grid-cols-3">{([{ label: 'Conversations', items: searchQuery.data.conversations, icon: MessageCircle }, { label: 'Messages', items: searchQuery.data.messages, icon: Sparkles }, { label: 'Activity', items: searchQuery.data.activity, icon: Activity }] as Array<{ label: string; items: Array<{ id: number; label: string; detail: string; createdAt: string }>; icon: LucideIcon }>).map(({ label, items, icon: Icon }) => <div key={label}><h3 className="mb-3 flex items-center gap-2 text-xs font-bold"><Icon size={14} className="text-primary" /> {label} <span className="mono ml-auto text-[10px] text-muted-foreground">{items.length}</span></h3><div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl bg-muted/60 p-3"><div className="line-clamp-2 text-xs font-semibold">{item.label}</div><div className="mt-1 truncate text-[10px] text-muted-foreground">{item.detail} · {dateLabel(item.createdAt)}</div></div>)}</div></div>)}</div>}</section>}

      {tab === 'notifications' && <section className="rounded-2xl border border-card-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-card-border px-5 py-4 sm:px-6"><SectionLabel meta={`${unreadCount} unread`}>Notification center</SectionLabel><button onClick={markAllRead} className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"><Check size={14} /> Mark all read</button></div>{notifications.length ? <div className="divide-y divide-card-border">{notifications.map((item) => { const read = readNotifications.includes(item.id); return <button onClick={() => markRead(item.id)} key={item.id} className={`flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/45 sm:px-6 ${read ? 'opacity-60' : ''}`}><span className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg ${read ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'}`}><Bell size={15} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.text}</span><span className="mono mt-1 block text-[9px] uppercase tracking-[.08em] text-muted-foreground">{item.type} · {dateLabel(item.createdAt)}</span></span>{!read && <span className="mt-2 size-2 rounded-full bg-primary" />}</button>; })}</div> : <div className="px-6 py-14 text-center text-sm text-muted-foreground">Belum ada notifikasi.</div>}</section>}

      {tab === 'security' && <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-7"><SectionLabel meta="account protection">Security overview</SectionLabel><div className="mb-5 flex items-center gap-4 rounded-2xl bg-primary/5 p-4"><div className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-accent-foreground"><UserRound size={19} /></div><div><div className="text-sm font-bold">UI preview</div><div className="mt-1 text-xs text-muted-foreground">No account required for preview</div></div><CheckCircle2 className="ml-auto text-primary" size={19} /></div><div className="space-y-3"><SecurityRow icon={LockKeyhole} title="Clerk session" detail="Session cookie is managed securely by Clerk" status="Protected" /><SecurityRow icon={ShieldCheck} title="API rate limiting" detail="Requests are limited per client window" status="Active" /><SecurityRow icon={KeyRound} title="API key exposure" detail="Provider keys never leave the server" status={summary.api.openaiConfigured ? 'Masked' : 'Not configured'} /></div></section><section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-7"><SectionLabel meta="access management">Account controls</SectionLabel><p className="text-sm leading-6 text-muted-foreground">Kelola profil, email, password, dan perangkat login melalui menu akun. MFA dan logout semua perangkat tersedia dari pengaturan keamanan akun Clerk.</p><div className="mt-6 rounded-xl border border-border bg-muted/45 p-4"><div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} className="text-primary" /> Workspace protected</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Semua endpoint bot dan data percakapan memerlukan sesi terautentikasi.</p></div></section></div>}

      {tab === 'backup' && <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-7"><SectionLabel meta="data portability">Backup & restore</SectionLabel><div className="flex items-start gap-4 rounded-2xl bg-secondary/60 p-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Archive size={19} /></span><div><div className="text-sm font-bold">Export workspace backup</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Unduh konfigurasi bot, percakapan, pesan, dan activity log dalam JSON. API key tidak pernah ikut diekspor.</p></div></div><button onClick={() => void downloadBackup()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground hover:-translate-y-0.5"><Download size={15} /> Download backup</button><p className="mt-3 text-center text-[10px] text-muted-foreground">Simpan file backup di lokasi pribadi yang aman.</p></section><section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-7"><SectionLabel meta="provider health">API management</SectionLabel><div className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-border p-4"><div><div className="text-xs font-bold">OpenAI API</div><div className="mt-1 text-[11px] text-muted-foreground">{summary.api.openaiKeyMasked}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${summary.api.openaiConfigured ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{summary.api.openaiConfigured ? 'Ready' : 'Needs setup'}</span></div><div className="flex items-center justify-between rounded-xl border border-border p-4"><div><div className="text-xs font-bold">WhatsApp session</div><div className="mt-1 text-[11px] text-muted-foreground">{summary.whatsapp.connectedNumber || 'Belum ada nomor tertaut'}</div></div><span className="flex items-center gap-1.5 text-[10px] font-bold"><StatusDot active={summary.whatsapp.status === 'connected'} /> {summary.whatsapp.status}</span></div></div><Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">Configure bot & AI <ArrowIcon /></Link></section></div>}
    </>}
  </div>;
}

function SecurityRow({ icon: Icon, title, detail, status }: { icon: typeof LockKeyhole; title: string; detail: string; status: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border p-3"><span className="flex size-8 items-center justify-center rounded-lg bg-muted text-primary"><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{title}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{detail}</span></span><span className="text-[10px] font-bold text-primary">{status}</span></div>;
}

function BotIcon() {
  return <BotGlyph />;
}

function BotGlyph() {
  return <span className="inline-block size-3 rounded-[4px] border-2 border-primary" />;
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}