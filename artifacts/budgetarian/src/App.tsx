import { useEffect, useRef, type ComponentType } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "./pages/home";
import Layout from "./components/layout/Layout";
import Expenses from "./pages/expenses";
import Dashboard from "./pages/dashboard";
import Goals from "./pages/goals";
import Tips from "./pages/tips";
import Installments from "./pages/installments";
import Warranties from "./pages/warranties";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function resolveClerkProxyUrl(): string | undefined {
  if (import.meta.env.VITE_CLERK_PROXY_URL) return import.meta.env.VITE_CLERK_PROXY_URL;
  if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
    return `${window.location.origin}/api/__clerk`;
  }
  return undefined;
}

const clerkProxyUrl = resolveClerkProxyUrl();

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

function SignInPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem', marginBottom: '4rem' }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem', marginBottom: '4rem' }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function AppRoutes() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/expenses"><ProtectedRoute component={Expenses} /></Route>
      <Route path="/goals"><ProtectedRoute component={Goals} /></Route>
      <Route path="/installments"><ProtectedRoute component={Installments} /></Route>
      <Route path="/warranties"><ProtectedRoute component={Warranties} /></Route>
      <Route path="/tips"><ProtectedRoute component={Tips} /></Route>

      <Route>
        <div className="p-8 text-center">404 Not Found</div>
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
