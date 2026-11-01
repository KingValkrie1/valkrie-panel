import { FormEvent, useState } from 'react';
import { Bot, Check, LoaderCircle, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { useSimulateBotMessage } from '@workspace/api-client-react';
import { PageIntro } from '@/components/shell';

type ChatMessage = { role: 'user' | 'assistant'; content: string; createdAt: string };
const starter: ChatMessage[] = [{ role: 'assistant', content: 'Halo, saya Nara. Saya siap membantu menjawab pertanyaan pelanggan Anda.', createdAt: 'now' }];

function getAiErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return 'AI gagal membalas. Coba lagi sebentar.';
  }
  const data = error.data;
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return 'AI gagal membalas. Coba lagi sebentar.';
}

export default function TestBot() {
  const [messages, setMessages] = useState<ChatMessage[]>(starter);
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const simulate = useSimulateBotMessage();
  const send = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || simulate.isPending) return;
    setMessages((current) => [...current, { role: 'user', content, createdAt: new Date().toISOString() }]);
    setDraft('');
    simulate.mutate({ data: { message: content, conversationId } }, { onSuccess: (reply) => { setConversationId(reply.conversationId); setMessages((current) => [...current, { role: 'assistant', content: reply.reply, createdAt: reply.createdAt }]); } });
  };
  const reset = () => { setMessages(starter); setConversationId(null); setDraft(''); };
  return <div data-testid="page-test"><PageIntro eyebrow="Sandbox / Live model" title="Talk to your bot" description="Try the exact experience your customers will have. Messages here use your saved instructions and model." action={<button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted" data-testid="button-reset-test"><RotateCcw size={14} /> New test</button>} />
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm" data-testid="test-chat">
         <div className="flex items-center gap-3 border-b border-card-border bg-sidebar px-5 py-4 text-sidebar-foreground sm:px-7"><span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Bot size={19} /></span><div className="flex-1"><div className="text-xs font-bold">Nara · test channel</div><div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-sidebar-foreground/55"><span className="size-1.5 rounded-full bg-sidebar-primary" /> Replies are private</div></div><span className="mono text-[9px] uppercase tracking-[0.1em] text-sidebar-foreground/45">WhatsApp</span></div>
         <div className="scrollbar-thin flex min-h-[430px] flex-col gap-5 overflow-y-auto bg-[hsl(187_27%_91%_/_0.38)] p-5 sm:p-8">{messages.map((message, index) => <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`} key={`${message.createdAt}-${index}`} data-testid={`test-message-${index}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${message.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-sidebar text-sidebar-primary'}`}>{message.role === 'user' ? <UserRound size={14} /> : <Bot size={15} />}</span><div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'rounded-tr-sm bg-accent/75' : 'rounded-tl-sm bg-card'}`}><p>{message.content}</p><p className="mono mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">{message.createdAt === 'now' ? 'just now' : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}{message.role === 'assistant' && <Check size={10} />}</p></div></div>)}{simulate.isPending && <div className="flex gap-3" data-testid="status-bot-thinking"><span className="flex size-8 items-center justify-center rounded-full bg-sidebar text-sidebar-primary"><Bot size={15} /></span><div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-sm"><span className="flex gap-1"><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" /><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:100ms]" /><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:200ms]" /></span></div></div>}{simulate.isError && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive" data-testid="error-test-message">{getAiErrorMessage(simulate.error)}</div>}</div>
        <form onSubmit={send} className="flex gap-2 border-t border-card-border bg-card p-4 sm:p-5"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message to Haven…" className="field h-11 flex-1" data-testid="input-test-message" /><button disabled={!draft.trim() || simulate.isPending} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send message" data-testid="button-send-test-message">{simulate.isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}</button></form>
      </section>
      <aside className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6" data-testid="card-test-notes"><div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Sparkles size={18} /></div><h2 className="text-sm font-bold">A useful gut check</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Ask the questions a real customer would. Watch for tone, accuracy, and whether the fallback feels like a helpful handoff.</p><div className="mt-6 space-y-2">{['What time do you close today?', 'Can I move my appointment?', 'I need something you do not offer.'].map((prompt) => <button key={prompt} onClick={() => setDraft(prompt)} className="block w-full rounded-xl border border-border px-3 py-2.5 text-left text-[11px] font-semibold transition-colors hover:border-primary/40 hover:bg-secondary" data-testid={`button-suggestion-${prompt.slice(0, 10).replaceAll(' ', '-').toLowerCase()}`}>{prompt}</button>)}</div><div className="mt-6 border-t border-border pt-5"><div className="flex items-center justify-between text-[10px]"><span className="mono uppercase tracking-[0.12em] text-muted-foreground">Session</span><span className="font-bold text-primary">{conversationId ? `#${conversationId}` : 'Not started'}</span></div></div></aside>
    </div>
  </div>;
}