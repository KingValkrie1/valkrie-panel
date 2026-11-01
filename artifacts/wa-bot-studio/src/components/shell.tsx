import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Moon,
  Menu,
  MessageCircle,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: Activity },
  { href: '/control-center', label: 'Control center', icon: BarChart3 },
  { href: '/conversations', label: 'Conversations', icon: MessageCircle },
  { href: '/test', label: 'Test your bot', icon: Sparkles },
  { href: '/settings', label: 'Bot settings', icon: Settings },
  { href: '/about', label: 'Tentang Aku', icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    const saved = window.localStorage.getItem('wa-bot-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const activePath = location.startsWith('/conversations') ? '/conversations' : location === '/' ? '/dashboard' : location;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    window.localStorage.setItem('wa-bot-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const displayName = 'UI preview';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell grain flex text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl shadow-[hsl(197_34%_17%_/_0.16)] transition-transform duration-300 lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-9 flex items-center justify-between px-3">
          <Link href="/dashboard" className="flex items-center gap-3" data-testid="link-brand">
            <span className="relative flex size-10 items-center justify-center rounded-[13px] bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-[hsl(161_58%_50%_/_0.18)]">
              <Bot size={21} strokeWidth={2.3} />
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-sidebar bg-accent" />
            </span>
            <span>
              <span className="block text-[15px] font-bold tracking-[-0.02em]">WA Bot Studio</span>
              <span className="mono mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/55">operations console</span>
            </span>
          </Link>
          <button className="rounded-lg p-2 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspace</div>
        <nav className="space-y-1" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = activePath === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}
                data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
              >
                <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={15} className="text-sidebar-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="mono text-[9px] uppercase tracking-[0.15em] text-sidebar-foreground/50">Channel</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-sidebar-primary">
                <span className="dot-live size-1.5 rounded-full bg-sidebar-primary" /> Live
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary"><MessageCircle size={16} /></span>
              <div>
                <div className="text-xs font-semibold">WhatsApp</div>
                <div className="mono mt-0.5 text-[10px] text-sidebar-foreground/50">QR session</div>
              </div>
            </div>
          </div>
          <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-help-settings">
            <CircleHelp size={16} />
            <span>Need a hand?</span>
            <ChevronRight size={14} className="ml-auto" />
          </Link>
          <div className="relative flex items-center gap-3 border-t border-sidebar-border px-3 pt-4">
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-bold text-accent-foreground">{initials}</span>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold">{displayName}</div>
              <div className="mono truncate text-[9px] text-sidebar-foreground/45">UI preview mode</div>
            </div>
            <button onClick={() => setAccountOpen((open) => !open)} className="ml-auto rounded-md p-1 text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Open account menu" data-testid="button-account-menu"><ClipboardList size={14} /></button>
            {accountOpen && <div className="absolute bottom-12 right-0 w-56 rounded-xl border border-sidebar-border bg-sidebar-accent p-3 shadow-xl" data-testid="menu-account"><div className="text-[11px] font-bold">{displayName}</div><div className="mt-1 truncate text-[10px] text-sidebar-foreground/55">Backend data is optional</div><Link href="/settings" onClick={() => setAccountOpen(false)} className="mt-3 block rounded-lg bg-sidebar-primary px-2.5 py-2 text-center text-[10px] font-bold text-sidebar-primary-foreground" data-testid="link-account-settings">Open settings</Link></div>}
          </div>
        </div>
      </aside>

      {menuOpen && <button className="fixed inset-0 z-20 bg-[hsl(197_34%_17%_/_0.34)] lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" data-testid="button-navigation-overlay" />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-border/75 bg-background/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={20} /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>All systems operational</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="mono hidden text-[10px] text-muted-foreground/70 sm:inline">LAST SYNC 2 MIN AGO</span>
            <button onClick={() => setDark((value) => !value)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={dark ? 'Use light mode' : 'Use dark mode'} data-testid="button-theme-toggle">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <span className="size-7 rounded-full border-2 border-accent bg-primary/10" aria-hidden="true" />
          </div>
        </header>
        <main className="page-enter mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">{children}</main>
      </div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <div className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
        <h1 className="text-[clamp(1.9rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.045em] text-foreground">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, meta }: { children: ReactNode; meta?: string }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold tracking-[-0.01em]">{children}</h2>{meta && <span className="mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{meta}</span>}</div>;
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} aria-label="Loading" data-testid="loading-skeleton" />;
}