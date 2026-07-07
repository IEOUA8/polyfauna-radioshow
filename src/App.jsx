import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { NowPlayingProvider } from '@/hooks/useNowPlaying';
import { TooltipProvider } from '@/components/ui/tooltip';
import ProtectedRoute from '@/components/ProtectedRoute';
import UsageTelemetry from '@/components/UsageTelemetry';
import { lazyImport } from '@/lib/lazyImport';

const PolyfaunaOS     = lazy(lazyImport(() => import('@/components/PolyfaunaOS')));
const LoginPage       = lazy(lazyImport(() => import('@/pages/LoginPage')));
const SignupPage      = lazy(lazyImport(() => import('@/pages/SignupPage')));
const UserDashboard   = lazy(lazyImport(() => import('@/pages/UserDashboard')));
const AdminDashboard  = lazy(lazyImport(() => import('@/pages/AdminDashboard')));
const ValidatePage    = lazy(lazyImport(() => import('@/pages/ValidatePage')));
const EventPublicPage  = lazy(lazyImport(() => import('@/pages/EventPublicPage')));
const ArtistPublicPage = lazy(lazyImport(() => import('@/pages/ArtistPublicPage')));
const OrganizerPublicPage = lazy(lazyImport(() => import('@/pages/OrganizerPublicPage')));
const VercelTelemetry  = lazy(lazyImport(() => import('@/components/VercelTelemetry')));

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

function ArtistAliasRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/profiles/${encodeURIComponent(slug || '')}`} replace />;
}

function InternalRouteRedirect({ section, param }) {
  const params = useParams();
  const value = params[param] || '';
  return <Navigate to={`/?section=${section}&${param}=${encodeURIComponent(value)}`} replace />;
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
      <UsageTelemetry />
      <AuthProvider>
        <NowPlayingProvider>
          <TooltipProvider delayDuration={400}>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/signup"   element={<SignupPage />} />
                <Route path="/validate" element={<ValidatePage />} />
                <Route path="/artist/:slug" element={<ArtistAliasRedirect />} />
                <Route path="/profiles/:slug" element={<ArtistPublicPage />} />
                <Route path="/organizadores/:slug" element={<OrganizerPublicPage />} />
                <Route path="/music/:album" element={<InternalRouteRedirect section="music" param="album" />} />
                <Route path="/podcasts/:podcast" element={<InternalRouteRedirect section="podcasts" param="podcast" />} />
                <Route path="/events/:event" element={<InternalRouteRedirect section="events" param="event" />} />
                <Route path="/entrevistas/:interview" element={<InternalRouteRedirect section="blog" param="interview" />} />
                <Route path="/e/:eventId"   element={<EventPublicPage />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['admin', 'promoter', 'club', 'artist', 'sello']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/*" element={<PolyfaunaOS />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
        </NowPlayingProvider>
      </AuthProvider>
    </Router>
    <DeferredTelemetry beforeSend={redactTelemetry} />
    </>
  );
}

export default App;
