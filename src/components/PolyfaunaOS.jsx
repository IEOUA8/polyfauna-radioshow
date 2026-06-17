import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Command,
  Disc3,
  Headphones,
  LayoutGrid,
  Mail,
  Maximize2,
  MessageSquare,
  Mic2,
  Minus,
  Pause,
  Play,
  Radio,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Logo from '@/components/Logo';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const appCatalog = [
  { id: 'radio', label: 'Radio Console', short: 'Radio', icon: Radio, tone: 'text-accent' },
  { id: 'community', label: 'Community Grid', short: 'Community', icon: Users, tone: 'text-secondary' },
  { id: 'messages', label: 'Signal Inbox', short: 'Inbox', icon: MessageSquare, tone: 'text-primary-foreground' },
  { id: 'events', label: 'Event Terminal', short: 'Events', icon: CalendarDays, tone: 'text-accent' },
  { id: 'artists', label: 'Artists & Labels', short: 'Network', icon: Disc3, tone: 'text-secondary' },
  { id: 'control', label: 'Control Center', short: 'Control', icon: Settings, tone: 'text-muted-foreground' },
];

const windowLayouts = {
  radio: { x: '5%', y: '9%', w: 'min(680px, 56vw)' },
  community: { x: '42%', y: '13%', w: 'min(620px, 48vw)' },
  messages: { x: '13%', y: '48%', w: 'min(560px, 46vw)' },
  events: { x: '50%', y: '48%', w: 'min(560px, 42vw)' },
  artists: { x: '23%', y: '20%', w: 'min(720px, 58vw)' },
  control: { x: '35%', y: '28%', w: 'min(560px, 44vw)' },
};

const communityNodes = [
  { name: 'Laura Mendez', type: 'Artist', status: 'online', signal: 92, tags: ['house', 'live'] },
  { name: 'Colectivo Beats', type: 'Collective', status: 'online', signal: 86, tags: ['breakbeat', 'pereira'] },
  { name: 'Nebula Label', type: 'Label', status: 'syncing', signal: 78, tags: ['releases', 'ambient'] },
  { name: 'Club Sonido', type: 'Promoter', status: 'online', signal: 83, tags: ['events', 'booking'] },
  { name: 'Maria Valencia', type: 'Artist', status: 'away', signal: 69, tags: ['ambient', 'visual'] },
];

const messages = [
  { from: 'Club Sonido', role: 'Promoter', subject: 'Lineup invitation for Frequencies', time: '09:42', unread: true },
  { from: 'Nebula Label', role: 'Label', subject: 'Premiere request for new compilation', time: '08:18', unread: true },
  { from: 'Laura Mendez', role: 'Artist', subject: 'Shared a private live session', time: 'Yesterday', unread: false },
  { from: 'Colectivo Beats', role: 'Collective', subject: 'Community room proposal', time: 'Friday', unread: false },
];

const events = [
  { title: 'Frequencies Festival', city: 'Pereira', date: 'Dec 21, 2026', status: 'Booking open' },
  { title: 'Nocturnal Interfaces', city: 'Manizales', date: 'Jan 09, 2027', status: 'Lineup review' },
  { title: 'Signal Room: Ambient Night', city: 'Online', date: 'Jan 16, 2027', status: 'Live room' },
];

const artists = [
  { name: 'DJ Fractal', type: 'Resident', reach: '24.8K', affinity: 96 },
  { name: 'Sofia Luna', type: 'Artist', reach: '12.1K', affinity: 88 },
  { name: 'Nebula Label', type: 'Label', reach: '31.2K', affinity: 91 },
  { name: 'Colectivo Beats', type: 'Collective', reach: '18.4K', affinity: 84 },
];

function PolyfaunaOS() {
  const navigate = useNavigate();
  const { currentUser, userRole, logout } = useAuth();
  const { toast } = useToast();
  const [openApps, setOpenApps] = useState(['radio', 'community', 'messages']);
  const [activeApp, setActiveApp] = useState('radio');
  const [minimizedApps, setMinimizedApps] = useState([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return appCatalog;
    return appCatalog.filter((app) => app.label.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const openApp = (id) => {
    setOpenApps((apps) => (apps.includes(id) ? apps : [...apps, id]));
    setMinimizedApps((apps) => apps.filter((appId) => appId !== id));
    setActiveApp(id);
    setCommandOpen(false);
  };

  const closeApp = (id) => {
    setOpenApps((apps) => {
      const nextApps = apps.filter((appId) => appId !== id);
      if (activeApp === id) {
        setActiveApp(nextApps[nextApps.length - 1] || 'radio');
      }
      return nextApps;
    });
    setMinimizedApps((apps) => apps.filter((appId) => appId !== id));
  };

  const minimizeApp = (id) => {
    setMinimizedApps((apps) => (apps.includes(id) ? apps : [...apps, id]));
  };

  const notifyDemo = (title) => {
    toast({
      title,
      description: 'Demo de interaccion. El siguiente paso es conectarlo con Supabase Realtime.',
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground font-sans">
      <Helmet>
        <title>POLYFAUNA OS - Cultural Broadcast System</title>
        <meta name="description" content="POLYFAUNA OS is an immersive desktop interface for electronic music communities, artists, labels, promoters and listeners." />
      </Helmet>

      <div className="fixed inset-0">
        <img
          src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2400&auto=format&fit=crop"
          alt="Immersive live electronic music environment"
          className="h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,8,8,0.98)_0%,rgba(13,18,17,0.88)_42%,rgba(33,12,35,0.76)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(20,184,166,0.2),transparent_34%),radial-gradient(circle_at_74%_30%,rgba(192,38,211,0.18),transparent_30%),radial-gradient(circle_at_54%_88%,rgba(245,158,11,0.12),transparent_34%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <SystemBar
        currentUser={currentUser}
        userRole={userRole}
        onCommand={() => setCommandOpen(true)}
        onLogin={() => navigate('/login')}
        onDashboard={() => navigate(userRole === 'admin' ? '/admin' : '/dashboard')}
        onLogout={handleLogout}
      />

      <main className="relative z-10 h-full overflow-y-auto md:overflow-hidden px-4 md:px-8 pt-20 pb-28">
        <DesktopShortcuts openApp={openApp} />

        <section className="hidden xl:block fixed right-6 top-24 bottom-28 w-72">
          <PresencePanel />
        </section>

        <AnimatePresence>
          {openApps.map((id) => {
            const app = appCatalog.find((item) => item.id === id);
            const minimized = minimizedApps.includes(id);
            if (!app || minimized) return null;

            return (
              <OSWindow
                key={id}
                app={app}
                active={activeApp === id}
                layout={windowLayouts[id]}
                onFocus={() => setActiveApp(id)}
                onClose={() => closeApp(id)}
                onMinimize={() => minimizeApp(id)}
              >
                <AppContent id={id} isPlaying={isPlaying} setIsPlaying={setIsPlaying} notifyDemo={notifyDemo} />
              </OSWindow>
            );
          })}
        </AnimatePresence>
      </main>

      <Dock
        openApps={openApps}
        minimizedApps={minimizedApps}
        activeApp={activeApp}
        openApp={openApp}
        onCommand={() => setCommandOpen(true)}
      />

      <CommandPalette
        open={commandOpen}
        query={query}
        setQuery={setQuery}
        apps={filteredApps}
        openApp={openApp}
        onClose={() => setCommandOpen(false)}
      />

      <Toaster />
    </div>
  );
}

function SystemBar({ currentUser, userRole, onCommand, onLogin, onDashboard, onLogout }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-14 border-b border-white/10 bg-black/35 backdrop-blur-2xl">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Logo size="sm" className="h-8 md:h-9" />
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <CircleDot className="h-3.5 w-3.5 text-accent animate-pulse" />
            <span>POLYFAUNA OS</span>
            <span className="text-white/20">/</span>
            <span>Broadcast layer active</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCommand}
          className="hidden sm:flex h-9 w-full max-w-md items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-muted-foreground hover:bg-white/10"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search users, artists, events, rooms...</span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px]">K</span>
        </button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-md text-muted-foreground hover:bg-white/10 hover:text-white">
            <Bell className="h-4 w-4" />
          </Button>
          {currentUser ? (
            <>
              <Button onClick={onDashboard} variant="ghost" className="hidden md:inline-flex rounded-md text-sm text-white hover:bg-white/10">
                {userRole === 'admin' ? 'Admin' : 'Dashboard'}
              </Button>
              <Button onClick={onLogout} variant="outline" className="rounded-md border-white/10 bg-white/5 text-white hover:bg-white/10">
                Logout
              </Button>
            </>
          ) : (
            <Button onClick={onLogin} variant="outline" className="rounded-md border-white/10 bg-white/5 text-white hover:bg-white/10">
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function DesktopShortcuts({ openApp }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-1 gap-3 md:w-24 md:absolute md:left-8 md:top-24">
      {appCatalog.slice(0, 5).map((app) => (
        <button
          key={app.id}
          type="button"
          onClick={() => openApp(app.id)}
          className="group flex md:flex-col items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] p-3 text-left md:text-center backdrop-blur-xl transition hover:bg-white/10"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/40 border border-white/10">
            <app.icon className={`h-5 w-5 ${app.tone}`} />
          </span>
          <span className="text-xs font-semibold text-white leading-tight">{app.short}</span>
        </button>
      ))}
    </div>
  );
}

function OSWindow({ app, active, layout, onFocus, onClose, onMinimize, children }) {
  return (
    <motion.section
      drag
      dragMomentum={false}
      onMouseDown={onFocus}
      initial={{ opacity: 0, scale: 0.96, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 18 }}
      transition={{ duration: 0.22 }}
      style={{ left: layout?.x, top: layout?.y, width: layout?.w }}
      className={`relative md:absolute mb-4 max-h-[74vh] overflow-hidden rounded-lg border backdrop-blur-2xl shadow-2xl ${
        active ? 'z-30 border-secondary/50 bg-[#111111]/88 shadow-secondary/10' : 'z-20 border-white/10 bg-[#111111]/76'
      } w-full md:w-auto`}
    >
      <div className="flex h-11 items-center justify-between border-b border-white/10 bg-white/[0.04] px-3">
        <div className="flex items-center gap-2 min-w-0">
          <app.icon className={`h-4 w-4 ${app.tone}`} />
          <span className="truncate text-sm font-bold text-white">{app.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onMinimize} className="h-7 w-7 rounded hover:bg-white/10">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded hover:bg-white/10">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 rounded hover:bg-destructive/20 hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="max-h-[calc(74vh-2.75rem)] overflow-y-auto">{children}</div>
    </motion.section>
  );
}

function AppContent({ id, isPlaying, setIsPlaying, notifyDemo }) {
  if (id === 'radio') return <RadioConsole isPlaying={isPlaying} setIsPlaying={setIsPlaying} notifyDemo={notifyDemo} />;
  if (id === 'community') return <CommunityGrid notifyDemo={notifyDemo} />;
  if (id === 'messages') return <SignalInbox notifyDemo={notifyDemo} />;
  if (id === 'events') return <EventTerminal notifyDemo={notifyDemo} />;
  if (id === 'artists') return <ArtistsNetwork notifyDemo={notifyDemo} />;
  return <ControlCenter notifyDemo={notifyDemo} />;
}

function RadioConsole({ isPlaying, setIsPlaying, notifyDemo }) {
  return (
    <div className="p-5">
      <div className="grid md:grid-cols-[1fr_180px] gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Live channel</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black text-white">Polyphonic Structures</h1>
          <p className="mt-2 text-sm text-muted-foreground">DJ Fractal is broadcasting to 247 connected listeners.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-muted-foreground">Signal health</p>
          <div className="mt-3 flex items-end gap-1 h-20">
            {[68, 42, 82, 56, 92, 48, 74, 64, 88, 52].map((height, index) => (
              <motion.div
                key={index}
                initial={{ height: 10 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.8, delay: index * 0.03, repeat: Infinity, repeatType: 'reverse' }}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-primary via-secondary to-accent"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-16 w-16 rounded-md bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center">
              <Radio className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white truncate">Deep Connections</p>
              <p className="text-sm text-muted-foreground truncate">Next: Maria Valencia / Ambient Dreams</p>
            </div>
          </div>
          <Button onClick={() => setIsPlaying(!isPlaying)} className="h-12 w-12 rounded-full bg-white text-black hover:bg-white/90" size="icon">
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>45:00</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[48%] rounded-full bg-gradient-to-r from-primary via-secondary to-accent" />
          </div>
          <span>120:00</span>
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-3 gap-3">
        {['Open live room', 'Ask host', 'Save session'].map((action) => (
          <Button key={action} onClick={() => notifyDemo(action)} variant="outline" className="rounded-md border-white/10 bg-white/5 text-white hover:bg-white/10">
            {action}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CommunityGrid({ notifyDemo }) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-secondary">Network layer</p>
          <h2 className="mt-2 text-2xl font-black text-white">Community Grid</h2>
        </div>
        <Badge className="bg-secondary/20 text-white border border-secondary/30">247 online</Badge>
      </div>

      <div className="mt-5 grid gap-3">
        {communityNodes.map((node) => (
          <button
            type="button"
            key={node.name}
            onClick={() => notifyDemo(`Open profile: ${node.name}`)}
            className="group rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-secondary/50 hover:bg-white/[0.07]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md bg-black/35 border border-white/10 flex items-center justify-center">
                  {node.type === 'Artist' ? <Mic2 className="h-5 w-5 text-accent" /> : <Building2 className="h-5 w-5 text-secondary" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{node.name}</p>
                  <p className="text-xs text-muted-foreground">{node.type} / {node.status}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-accent">{node.signal}%</p>
                <p className="text-[11px] text-muted-foreground">affinity</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {node.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-muted-foreground">#{tag}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SignalInbox({ notifyDemo }) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Direct messages</p>
          <h2 className="mt-2 text-2xl font-black text-white">Signal Inbox</h2>
        </div>
        <Button onClick={() => notifyDemo('Compose message')} size="icon" className="rounded-md bg-white text-black hover:bg-white/90">
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {messages.map((message) => (
          <button
            key={`${message.from}-${message.subject}`}
            type="button"
            onClick={() => notifyDemo(`Message: ${message.from}`)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-accent/50 hover:bg-white/[0.07]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {message.unread && <span className="h-2 w-2 rounded-full bg-accent" />}
                  <p className="font-bold text-white">{message.from}</p>
                </div>
                <p className="mt-1 text-xs text-secondary">{message.role}</p>
                <p className="mt-2 text-sm text-muted-foreground">{message.subject}</p>
              </div>
              <span className="text-xs text-muted-foreground">{message.time}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Input placeholder="Send a signal..." className="h-11 border-white/10 bg-black/25" />
        <Button onClick={() => notifyDemo('Send signal')} className="h-11 rounded-md bg-accent text-white hover:bg-accent/90">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EventTerminal({ notifyDemo }) {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Promoter console</p>
      <h2 className="mt-2 text-2xl font-black text-white">Event Terminal</h2>
      <div className="mt-5 space-y-3">
        {events.map((event) => (
          <button
            key={event.title}
            type="button"
            onClick={() => notifyDemo(`Open event: ${event.title}`)}
            className="w-full rounded-lg border border-white/10 bg-black/25 p-4 text-left transition hover:border-primary/60 hover:bg-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-white">{event.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{event.city} / {event.date}</p>
              </div>
              <Badge className="bg-primary/20 text-white border border-primary/30">{event.status}</Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ArtistsNetwork({ notifyDemo }) {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-secondary">Profiles</p>
      <h2 className="mt-2 text-2xl font-black text-white">Artists, Collectives & Labels</h2>
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        {artists.map((artist) => (
          <button
            key={artist.name}
            type="button"
            onClick={() => notifyDemo(`Open profile: ${artist.name}`)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-secondary/50 hover:bg-white/[0.07]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-white">{artist.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{artist.type}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reach {artist.reach}</span>
              <span className="font-bold text-accent">{artist.affinity}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent" style={{ width: `${artist.affinity}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ControlCenter({ notifyDemo }) {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">System</p>
      <h2 className="mt-2 text-2xl font-black text-white">Control Center</h2>
      <div className="mt-5 grid gap-3">
        {[
          ['Roles & permissions', Shield],
          ['Realtime channels', Zap],
          ['Community moderation', Check],
          ['Content registry', LayoutGrid],
        ].map(([label, Icon]) => (
          <button key={label} type="button" onClick={() => notifyDemo(label)} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left hover:bg-white/[0.07]">
            <span className="flex items-center gap-3 text-sm font-semibold text-white"><Icon className="h-4 w-4 text-accent" />{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PresencePanel() {
  return (
    <aside className="h-full rounded-lg border border-white/10 bg-black/30 p-4 backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Presence</p>
          <h2 className="mt-1 font-black text-white">Live network</h2>
        </div>
        <Sparkles className="h-5 w-5 text-secondary" />
      </div>
      <div className="mt-5 space-y-3">
        {communityNodes.slice(0, 4).map((node) => (
          <div key={node.name} className="flex items-center gap-3 rounded-md bg-white/[0.04] p-3">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{node.name}</p>
              <p className="text-xs text-muted-foreground">{node.type}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs text-muted-foreground">System notifications</p>
        <p className="mt-2 text-sm text-white">3 booking requests, 2 unread label messages, 1 live room waiting.</p>
      </div>
    </aside>
  );
}

function Dock({ openApps, minimizedApps, activeApp, openApp, onCommand }) {
  return (
    <nav className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-2xl shadow-2xl">
      <div className="flex items-center gap-2">
        <Button onClick={onCommand} size="icon" variant="ghost" className="rounded-md text-white hover:bg-white/10">
          <Command className="h-5 w-5" />
        </Button>
        <div className="h-8 w-px bg-white/10" />
        {appCatalog.map((app) => {
          const isOpen = openApps.includes(app.id);
          const isMinimized = minimizedApps.includes(app.id);
          const isActive = activeApp === app.id && !isMinimized;
          return (
            <button
              type="button"
              key={app.id}
              onClick={() => openApp(app.id)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-md border transition ${
                isActive ? 'border-secondary/50 bg-secondary/20' : 'border-white/10 bg-white/[0.04] hover:bg-white/10'
              }`}
              title={app.label}
            >
              <app.icon className={`h-5 w-5 ${app.tone}`} />
              {isOpen && <span className={`absolute -bottom-1 h-1.5 w-1.5 rounded-full ${isMinimized ? 'bg-muted-foreground' : 'bg-accent'}`} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CommandPalette({ open, query, setQuery, apps, openApp, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-24 backdrop-blur-sm"
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ y: -24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -24, scale: 0.98 }}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-[#111111]/95 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Open app, user, artist, event or room..."
                className="h-10 flex-1 bg-transparent text-base text-white outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="p-2">
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left hover:bg-white/10"
                >
                  <span className="flex items-center gap-3">
                    <app.icon className={`h-5 w-5 ${app.tone}`} />
                    <span className="font-semibold text-white">{app.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PolyfaunaOS;
