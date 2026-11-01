import { ArrowUpRight, Check, CheckCircle2, Clock3, MessageCircle, MoreHorizontal, Phone, QrCode, RefreshCw, Send, Settings2, Smartphone, Users } from 'lucide-react';
import { useGetBotConfig, useGetBotOverview, useGetWhatsappStatus } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { PageIntro, SectionLabel, SkeletonBlock } from '@/components/shell';

function formatTime(dateValue: string) {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function StatusPill({ status }: { status: string }) {
  const isLive = status === 'active';
  const isPaused = status === 'paused';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isLive ? 'bg-primary/10 text-primary' : isPaused ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`} data-testid="status-bot">
    <span className={`size-1.5 rounded-full ${isLive ? 'dot-live bg-primary' : isPaused ? 'bg-accent-foreground/50' : 'bg-muted-foreground/60'}`} />
    {isLive ? 'Live and listening' : isPaused ? 'Paused' : 'Not connected'}
  </span>;
}

export default function Home() {
  const overviewQuery = useGetBotOverview();
  const configQuery = useGetBotConfig();
  const whatsappQuery = useGetWhatsappStatus();
  const overview = overviewQuery.data;
  const config = configQuery.data;
  const whatsapp = whatsappQuery.data;
  const dashboardStatus = whatsapp?.status === 'connected'
    ? 'active'
    : whatsapp?.status === 'qr' || whatsapp?.status === 'starting'
      ? 'not_connected'
      : overview?.botStatus || (config?.isActive ? 'active' : 'paused');

  return (
    <div data-testid="page-overview">
      <PageIntro
        eyebrow="Monday, October 14 · Morning brief"
        title="Good morning, Avery."
        description="Your assistant is keeping the line warm. Here is the pulse of your WhatsApp channel."
        action={<Link href="/test" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md shadow-primary/15 transition-transform hover:-translate-y-0.5" data-testid="link-open-test"><Send size={15} /> Send a test</Link>}
      />

      {overviewQuery.isError ? (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm" data-testid="error-overview"><span>We could not load the latest bot pulse.</span><button onClick={() => overviewQuery.refetch()} className="inline-flex items-center gap-2 font-bold text-destructive" data-testid="button-retry-overview"><RefreshCw size={14} /> Try again</button></div>
      ) : null}

      {whatsapp?.status === 'qr' && whatsapp.qrImage ? (
        <section className="mb-7 flex flex-col gap-5 rounded-2xl border border-primary/25 bg-sidebar p-5 text-sidebar-foreground shadow-xl shadow-[hsl(197_34%_17%_/_0.12)] sm:flex-row sm:items-center sm:p-6" data-testid="card-whatsapp-qr">
          <div className="flex size-[180px] shrink-0 items-center justify-center self-center rounded-xl bg-white p-3 sm:self-auto">
            <img src={whatsapp.qrImage} alt="QR code untuk menghubungkan WhatsApp" className="size-full" />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sidebar-primary"><QrCode size={16} /><span className="mono text-[10px] font-bold uppercase tracking-[0.16em]">Scan untuk menghubungkan</span></div>
            <h2 className="text-lg font-bold">Hubungkan WhatsApp Anda</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-sidebar-foreground/65">Buka WhatsApp di HP → Perangkat tertaut → Tautkan perangkat, lalu scan QR di samping. QR akan diperbarui otomatis jika kedaluwarsa.</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-sidebar-foreground/75"><Smartphone size={14} /> Bot menunggu pemindaian dari ponsel Anda</div>
          </div>
        </section>
      ) : null}

      {whatsapp?.status === 'connected' ? (
        <div className="mb-7 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm" data-testid="banner-whatsapp-connected">
          <CheckCircle2 className="text-primary" size={18} />
          <div><span className="font-bold">WhatsApp sudah terhubung.</span><span className="ml-1 text-muted-foreground">Bot siap menerima perintah dari nomor Anda.</span></div>
        </div>
      ) : null}

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-sidebar p-5 text-sidebar-foreground shadow-xl shadow-[hsl(197_34%_17%_/_0.12)] sm:col-span-2 xl:col-span-1" data-testid="card-health">
          <div className="mb-7 flex items-start justify-between"><span className="mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/55">Bot health</span><MoreHorizontal size={17} className="text-sidebar-foreground/40" /></div>
          {overviewQuery.isLoading ? <SkeletonBlock className="h-9 w-32 bg-sidebar-accent" /> : <div className="text-2xl font-bold tracking-[-0.04em]">{config?.name || 'Your assistant'}</div>}
          <div className="mt-4"><StatusPill status={dashboardStatus} /></div>
          <div className="mt-7 border-t border-sidebar-border pt-3 text-[11px] text-sidebar-foreground/55">{config?.whatsappNumber || 'WhatsApp number not connected'}</div>
        </div>
        {[
          { label: 'Conversations', value: overview?.totalConversations, detail: 'all time', icon: Users, tone: 'bg-accent' },
          { label: 'Messages today', value: overview?.messagesToday, detail: 'since midnight', icon: MessageCircle, tone: 'bg-secondary' },
          { label: 'Response rate', value: overview ? `${overview.responseRate}%` : undefined, detail: 'last 30 days', icon: Check, tone: 'bg-primary/10' },
        ].map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md" data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
            <div className="mb-7 flex items-center justify-between"><span className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span><span className={`flex size-8 items-center justify-center rounded-lg ${tone} text-foreground/70`}><Icon size={16} /></span></div>
            {overviewQuery.isLoading ? <SkeletonBlock className="h-9 w-20" /> : <div className="text-3xl font-bold tracking-[-0.05em]" data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value ?? '—'}</div>}
            <div className="mt-3 text-xs text-muted-foreground">{detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-card-border bg-card shadow-sm" data-testid="section-recent-activity">
          <div className="flex items-center justify-between border-b border-card-border px-5 py-4 sm:px-6"><SectionLabel meta="live feed">Recent activity</SectionLabel><Link href="/conversations" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline" data-testid="link-view-conversations">View conversations <ArrowUpRight size={14} /></Link></div>
          {overviewQuery.isLoading ? <div className="space-y-4 p-6"><SkeletonBlock className="h-12 w-full" /><SkeletonBlock className="h-12 w-full" /><SkeletonBlock className="h-12 w-full" /></div> : overview?.recentActivity?.length ? <div className="divide-y divide-card-border">{overview.recentActivity.map((item) => (
            <div className="flex gap-4 px-5 py-4 transition-colors hover:bg-muted/35 sm:px-6" key={item.id} data-testid={`activity-item-${item.id}`}>
              <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${item.type === 'message' ? 'bg-secondary text-primary' : item.type === 'connection' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{item.type === 'message' ? <MessageCircle size={15} /> : item.type === 'connection' ? <Phone size={15} /> : <Settings2 size={15} />}</div>
              <div className="min-w-0 flex-1"><p className="text-sm leading-5 text-foreground">{item.text}</p><p className="mono mt-1 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{formatTime(item.createdAt)} · {item.type}</p></div>
            </div>
          ))}</div> : <div className="px-6 py-14 text-center" data-testid="empty-recent-activity"><div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Clock3 size={19} /></div><p className="text-sm font-semibold">Your activity stream is quiet</p><p className="mt-1 text-xs text-muted-foreground">New messages and bot events will appear here.</p></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm" data-testid="card-readiness">
          <div className="border-b border-card-border px-5 py-4 sm:px-6"><SectionLabel meta="setup">Launch readiness</SectionLabel></div>
          <div className="p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-4"><div className="relative flex size-[72px] items-center justify-center rounded-full border-[7px] border-secondary"><div className="absolute inset-[-7px] rounded-full border-[7px] border-primary border-b-transparent border-l-transparent" /><span className="text-lg font-bold">3/4</span></div><div><div className="font-bold">Nearly ready</div><p className="mt-1 text-xs leading-5 text-muted-foreground">A few thoughtful details make a better first hello.</p></div></div>
            <div className="space-y-3">
              {[
                { label: 'Bot identity', done: Boolean(config?.name), href: '/settings' },
                { label: 'Instructions', done: Boolean(config?.systemPrompt), href: '/settings' },
                { label: 'Greeting message', done: Boolean(config?.greeting), href: '/settings' },
                { label: 'WhatsApp connection', done: Boolean(config?.whatsappNumber), href: '/settings' },
              ].map((item) => <Link href={item.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-muted" key={item.label} data-testid={`link-readiness-${item.label.toLowerCase().replaceAll(' ', '-')}`}><span className={`flex size-5 items-center justify-center rounded-full ${item.done ? 'bg-primary text-primary-foreground' : 'border border-border text-transparent'}`}>{item.done ? <Check size={12} /> : <span className="size-1.5 rounded-full bg-border" />}</span><span className={item.done ? 'text-muted-foreground line-through' : 'font-semibold'}>{item.label}</span><ArrowUpRight className="ml-auto size-3.5 text-muted-foreground/60" /></Link>)}
            </div>
          </div>
          <div className="border-t border-card-border bg-muted/45 px-5 py-3 text-[11px] text-muted-foreground sm:px-6">Tip: bots with a specific fallback feel more human.</div>
        </section>
      </div>
    </div>
  );
}