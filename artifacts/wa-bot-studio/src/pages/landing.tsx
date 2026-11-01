import { ArrowRight, Bot, CheckCircle2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

const highlights = [
  'Hubungkan WhatsApp lewat QR, tanpa Twilio',
  'Atur personality dan instruksi AI dari satu panel',
  'Pantau percakapan, status koneksi, dan aktivitas bot',
];

export default function Landing() {
  return (
    <main className="min-h-[100dvh] bg-background px-5 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[13px] bg-sidebar text-sidebar-primary"><Bot size={21} /></span>
            <span><strong className="block text-sm">WA Bot Studio</strong><span className="mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">WhatsApp AI control room</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground">Masuk</Link>
             <Link href="/sign-up" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/15 hover:-translate-y-0.5">Buat akun</Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-primary"><Sparkles size={13} /> AI WhatsApp workspace</div>
            <h1 className="max-w-2xl text-[clamp(2.6rem,7vw,5.8rem)] font-bold leading-[.96] tracking-[-.07em]">Kelola bot WhatsApp dengan <span className="text-primary">lebih tenang.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Satu ruang kerja untuk menghubungkan WhatsApp pribadi atau bisnis, mengatur AI, membaca percakapan, dan melihat kesehatan bot secara real-time.</p>
            <div className="mt-8 flex flex-wrap gap-3">
               <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5">Mulai sekarang <ArrowRight size={15} /></Link>
               <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-xs font-bold hover:bg-muted">Saya sudah punya akun</Link>
            </div>
            <div className="mt-10 space-y-3">
              {highlights.map((item) => <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground"><CheckCircle2 size={16} className="text-primary" /> {item}</div>)}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-primary/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-2xl shadow-sidebar/20 sm:p-7">
              <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary/15 text-sidebar-primary"><MessageCircle size={18} /></span><div><div className="text-xs font-bold">WhatsApp channel</div><div className="mono text-[9px] uppercase tracking-widest text-sidebar-foreground/45">secure session</div></div></div><span className="flex items-center gap-1.5 rounded-full bg-sidebar-primary/10 px-2.5 py-1 text-[10px] font-bold text-sidebar-primary"><span className="dot-live size-1.5 rounded-full bg-sidebar-primary" /> Ready</span></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-sidebar-accent p-4"><div className="mono text-[9px] uppercase tracking-widest text-sidebar-foreground/45">AI replies</div><div className="mt-3 text-3xl font-bold">98.4%</div><div className="mt-1 text-[10px] text-sidebar-foreground/50">last 30 days</div></div><div className="rounded-2xl bg-sidebar-accent p-4"><div className="mono text-[9px] uppercase tracking-widest text-sidebar-foreground/45">Protection</div><div className="mt-3 flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} className="text-sidebar-primary" /> Active</div><div className="mt-1 text-[10px] text-sidebar-foreground/50">session secured</div></div></div>
              <div className="mt-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-sidebar-foreground/70"><Bot size={14} className="text-sidebar-primary" /> Nara is listening</div><div className="space-y-2"><div className="ml-8 rounded-xl rounded-tl-sm bg-sidebar-primary/15 px-3 py-2 text-[11px] text-sidebar-foreground/75">Halo! Ada yang bisa saya bantu?</div><div className="mr-8 rounded-xl rounded-tr-sm bg-sidebar px-3 py-2 text-[11px] text-sidebar-foreground/60">.ai bantu ringkas chat terakhir</div></div></div>
            </div>
          </div>
        </section>
        <footer className="flex flex-col gap-2 border-t border-border py-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>WA Bot Studio · private workspace</span><span>Baileys QR · AI-ready · built for operators</span></footer>
      </div>
    </main>
  );
}