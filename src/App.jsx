import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import ProtectedRoute from '@/components/ProtectedRoute';

const PolyfaunaOS     = lazy(() => import('@/components/PolyfaunaOS'));
const LoginPage       = lazy(() => import('@/pages/LoginPage'));
const SignupPage      = lazy(() => import('@/pages/SignupPage'));
const UserDashboard   = lazy(() => import('@/pages/UserDashboard'));
const AdminDashboard  = lazy(() => import('@/pages/AdminDashboard'));
const ValidatePage    = lazy(() => import('@/pages/ValidatePage'));
const EventPublicPage = lazy(() => import('@/pages/EventPublicPage'));
const VercelTelemetry = lazy(() => import('@/components/VercelTelemetry'));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070C0B]">
      <Loader2 className="w-7 h-7 animate-spin text-white/50" aria-label="Cargando" />
    </div>
  );
}

function DeferredTelemetry({ beforeSend }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const schedule = () => {
      const run = () => setReady(true);
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run, { timeout: 3500 });
      } else {
        window.setTimeout(run, 2500);
      }
    };

    if (document.readyState === 'complete') {
      schedule();
      return undefined;
    }

    window.addEventListener('load', schedule, { once: true });
    return () => window.removeEventListener('load', schedule);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <VercelTelemetry beforeSend={beforeSend} />
    </Suspense>
  );
}

function ArtistRouteRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/?section=artists&artist=${encodeURIComponent(slug || '')}`} replace />;
}

function App() {
  const redactTelemetry = (event) => {
    try {
      const url = new URL(event.url);
      if (/^\/(admin|dashboard|validate)(\/|$)/.test(url.pathname)) return null;
      url.search = '';
      url.hash = '';
      return { ...event, url: url.toString() };
    } catch (_) {
      return null;
    }
  };

  return (
    <>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
      <TooltipProvider delayDuration={400}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/signup"   element={<SignupPage />} />
            <Route path="/validate" element={<ValidatePage />} />
            <Route path="/artist/:slug" element={<ArtistRouteRedirect />} />
            <Route path="/e/:eventId"   element={<EventPublicPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin', 'promoter', 'club']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/*" element={<PolyfaunaOS />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
      </AuthProvider>
    </Router>
    <DeferredTelemetry beforeSend={redactTelemetry} />
    </>
  );
}

export default App;
