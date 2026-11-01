import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/shell';
import Home from '@/pages/home';
import ControlCenter from '@/pages/control-center';
import Conversations from '@/pages/conversations';
import Settings from '@/pages/settings';
import TestBot from '@/pages/test';
import About from '@/pages/about';
import NotFound from '@/pages/not-found';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#238b6f',
    colorForeground: '#17323a',
    colorMutedForeground: '#65767b',
    colorDanger: '#c4483e',
    colorBackground: '#fbfcf7',
    colorInput: '#f4f7f1',
    colorInputForeground: '#17323a',
    colorNeutral: '#d6e1db',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-card rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-foreground',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground',
    formFieldLabel: 'text-foreground',
    footerActionLink: 'text-primary',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-primary',
    alertText: 'text-foreground',
    logoBox: 'mb-3',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-border bg-background',
    formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    formFieldInput: 'border-input bg-background text-foreground',
    footerAction: 'border-border',
    dividerLine: 'bg-border',
    alert: 'border-border bg-muted',
    otpCodeFieldInput: 'border-input bg-background text-foreground',
    formFieldRow: 'text-foreground',
    main: 'text-foreground',
  },
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/control-center" component={ControlCenterPage} />
      <Route path="/conversations/:id" component={ConversationsPage} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/test" component={TestPage} />
      <Route path="/about" component={AboutPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HomeRedirect() {
  return <Redirect to="/dashboard" />;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <RoutedErrorBoundary>{children}</RoutedErrorBoundary>
    </AppShell>
  );
}

function DashboardPage() {
  return <ProtectedPage><Home /></ProtectedPage>;
}

function ControlCenterPage() {
  return <ProtectedPage><ControlCenter /></ProtectedPage>;
}
function ConversationsPage() {
  return <ProtectedPage><Conversations /></ProtectedPage>;
}

function SettingsPage() {
  return <ProtectedPage><Settings /></ProtectedPage>;
}

function TestPage() {
  return <ProtectedPage><TestBot /></ProtectedPage>;
}

function AboutPage() {
  return <ProtectedPage><About /></ProtectedPage>;
}

function SignInPage() {
  if (!clerkPubKey) return <Redirect to="/dashboard" />;
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  if (!clerkPubKey) return <Redirect to="/dashboard" />;
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkQueryCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserRef = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserRef.current !== undefined && previousUserRef.current !== userId) queryClient.clear();
    previousUserRef.current = userId;
  }), [addListener]);
  return null;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    );
  }
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Selamat datang kembali', subtitle: 'Masuk untuk membuka WA Bot Studio' } },
        signUp: { start: { title: 'Buat akun Anda', subtitle: 'Mulai kelola bot WhatsApp dengan aman' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryCacheInvalidator />
        <Router />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkApp />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
