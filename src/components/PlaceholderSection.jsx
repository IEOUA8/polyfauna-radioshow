import React from 'react';
import {
  CalendarDays,
  Disc3,
  LayoutGrid,
  MessageSquare,
  SlidersHorizontal,
  Ticket,
} from 'lucide-react';

const ICONS = {
  community: LayoutGrid,
  inbox: MessageSquare,
  artists: Disc3,
  tickets: Ticket,
  settings: SlidersHorizontal,
  events: CalendarDays,
};

export default function PlaceholderSection({ id, label }) {
  const Icon = ICONS[id] || LayoutGrid;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,207,255,0.08)', border: '1px solid rgba(0,207,255,0.15)' }}
      >
        <Icon className="w-7 h-7" style={{ color: '#00CFFF' }} />
      </div>
      <div>
        <h2 className="text-xl font-black text-white">{label}</h2>
        <p className="text-sm text-white/40 mt-1 max-w-xs">
          Esta sección está en construcción. Próximamente disponible.
        </p>
      </div>
    </div>
  );
}
