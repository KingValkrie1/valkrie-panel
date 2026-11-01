import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-5">
      <div className="max-w-sm text-center" data-testid="page-not-found">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Compass size={26} /></div>
        <div className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Signal lost · 404</div>
        <h1 className="mt-3 text-2xl font-bold tracking-[-0.04em]">That view is not on the map.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The address may have moved, but your bot is still right where you left it.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground" data-testid="link-back-overview"><ArrowLeft size={14} /> Back to overview</Link>
      </div>
    </div>
  );
}
