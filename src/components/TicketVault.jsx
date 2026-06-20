import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle, Clock, Download, MapPin, Ticket, X, XCircle } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CardSkeleton, EmptyState, ErrorState, LoginRequired } from '@/components/SectionStates';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=600&auto=format&fit=crop';

const STATUS_CONFIG = {
  valid: { label: 'Válido',  color: '#22c55e', Icon: CheckCircle },
  ready: { label: 'Listo',   color: 'rgba(255,255,255,0.85)', Icon: CheckCircle },
  used:  { label: 'Usado',   color: 'rgba(255,255,255,0.25)', Icon: XCircle },
};

function qrPayload(ticket) {
  return `polyfauna://ticket/${ticket.id}`;
}

async function generateTicketPDF(ticket, qrCanvas) {
  const event = ticket.events;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85, 170] });

  // Background
  doc.setFillColor(8, 13, 9);
  doc.rect(0, 0, 85, 170, 'F');

  // Accent bar top
  doc.setFillColor(220, 220, 220);
  doc.rect(0, 0, 85, 1.5, 'F');

  // Header: event image
  try {
    const imgRes = await fetch(event?.image_url || FALLBACK);
    const imgBlob = await imgRes.blob();
    const imgDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(imgBlob);
    });
    doc.addImage(imgDataUrl, 'JPEG', 0, 1.5, 85, 40, undefined, 'FAST');
  } catch (_) { /* skip image on error */ }

  // Brand label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(200, 200, 200);
  doc.text('POLYFAUNA', 7, 50);

  // Event title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  const title = (event?.title || 'Evento').toUpperCase();
  doc.text(title, 85 / 2, 60, { align: 'center', maxWidth: 72 });

  // Date & Venue
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  if (event?.date) {
    const dateStr = new Date(event.date).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    doc.text(dateStr, 85 / 2, 67, { align: 'center', maxWidth: 72 });
  }
  if (event?.venue) {
    doc.text(event.venue, 85 / 2, 72, { align: 'center', maxWidth: 72 });
  }

  // Dashed separator
  doc.setDrawColor(50, 60, 55);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(7, 78, 78, 78);

  // QR code — from the canvas ref passed in
  const qrX = (85 - 48) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 3, 82, 54, 54, 3, 3, 'F');
  if (qrCanvas) {
    const qrDataUrl = qrCanvas.toDataURL('image/png');
    doc.addImage(qrDataUrl, 'PNG', qrX, 85, 48, 48);
  }

  // Ticket type badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text((ticket.ticket_type || 'GA').toUpperCase(), 85 / 2, 142, { align: 'center' });

  // Ticket number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(80, 90, 85);
  doc.text(`# ${ticket.ticket_number?.slice(0, 24) || ''}`, 85 / 2, 148, { align: 'center' });

  // Second separator
  doc.setDrawColor(50, 60, 55);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(7, 153, 78, 153);

  // Status
  const statusColors = { valid: [34, 197, 94], ready: [220, 220, 220], used: [80, 90, 85] };
  const sc = statusColors[ticket.status] || statusColors.valid;
  doc.setFillColor(...sc);
  doc.circle(12, 159, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...sc);
  doc.text((STATUS_CONFIG[ticket.status]?.label || 'Válido').toUpperCase(), 16, 160);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(50, 60, 55);
  doc.text('Muestra este QR en la entrada del evento.', 85 / 2, 165, { align: 'center' });

  const safeTitle = (event?.title || 'ticket').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`polyfauna_${safeTitle}.pdf`);
}

/* ── QR Modal ── */
function QRModal({ ticket, onClose }) {
  const event  = ticket.events;
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.valid;
  const StatusIcon = status.Icon;
  const isUsed = ticket.status === 'used';
  const [downloading, setDownloading] = useState(false);
  const qrCanvasRef = useRef(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateTicketPDF(ticket, qrCanvasRef.current);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(4,7,7,0.92)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative max-w-sm w-full rounded-3xl overflow-hidden"
          style={{ background: 'rgba(8, 13, 9, 0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header image */}
          <div className="relative h-32 overflow-hidden">
            <img src={event?.image_url || FALLBACK} alt={event?.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080E09] via-black/40 to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-4 flex flex-col items-center gap-5">
            {/* Event info */}
            <div className="w-full text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {ticket.ticket_type || 'GA'}
              </p>
              <h2 className="text-lg font-black text-white leading-tight">
                {event?.title || 'Evento'}
              </h2>
              {event?.date && (
                <p className="text-xs text-white/40 mt-1">
                  {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {event.venue && ` · ${event.venue}`}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div
              className="p-4 rounded-2xl flex items-center justify-center"
              style={{
                background: isUsed ? 'rgba(255,255,255,0.04)' : '#ffffff',
                filter:     isUsed ? 'grayscale(1) opacity(0.25)' : 'none',
                transition: 'all 0.3s',
              }}
            >
              <QRCodeSVG
                value={qrPayload(ticket)}
                size={200}
                bgColor="#ffffff"
                fgColor="#080B14"
                level="H"
                includeMargin={false}
              />
            </div>

            {isUsed && (
              <p className="text-xs font-bold text-white/30 -mt-2">Esta entrada ya fue usada</p>
            )}

            {/* Status + ticket number */}
            <div className="w-full flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <StatusIcon className="w-3.5 h-3.5" style={{ color: status.color }} />
                <span className="text-xs font-bold" style={{ color: status.color }}>{status.label}</span>
              </div>
              <span className="text-[10px] font-mono text-white/30">#{ticket.ticket_number?.slice(0, 16)}</span>
            </div>

            {/* Dashed divider */}
            <div className="w-full border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Download button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
              style={{ background: 'rgba(32,199,232,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(32,199,232,0.2)' }}
            >
              {downloading
                ? <><Clock className="w-4 h-4 animate-spin" /> Generando PDF…</>
                : <><Download className="w-4 h-4" /> Descargar ticket PDF</>
              }
            </button>

            <p className="text-[11px] text-white/25 text-center -mt-2">
              Muestra este QR en la entrada del evento.
              <br />Válido solo para el portador del ticket.
            </p>
          </div>

          {/* Hidden canvas for PDF QR generation */}
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={qrPayload(ticket)}
              size={200}
              bgColor="#ffffff"
              fgColor="#080B14"
              level="H"
              includeMargin={false}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Ticket Card ── */
function TicketCard({ ticket, index, onShowQR }) {
  const event  = ticket.events;
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.valid;
  const StatusIcon = status.Icon;
  const isUsed = ticket.status === 'used';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Event image header */}
      <div className="relative h-36 overflow-hidden">
        <img src={event?.image_url || FALLBACK} alt={event?.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {ticket.ticket_type || 'GA'}
            </p>
            <p className="text-base font-black text-white leading-tight mt-0.5 truncate">
              {event?.title || 'Evento'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusIcon className="w-3.5 h-3.5" style={{ color: status.color }} />
            <span className="text-xs font-bold" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Ticket body */}
      <div className="px-4 py-3 flex items-stretch gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          {event?.date && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {event?.venue && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
          <p className="text-[10px] text-white/25 font-mono pt-1"># {ticket.ticket_number?.slice(0, 16)}</p>
        </div>

        {/* QR thumbnail — click to expand */}
        <button
          type="button"
          onClick={() => onShowQR(ticket)}
          className="w-16 h-16 shrink-0 rounded-xl flex items-center justify-center self-center transition-all hover:scale-105 active:scale-95"
          style={{
            background: isUsed ? 'rgba(255,255,255,0.04)' : '#ffffff',
            border:     isUsed ? '1px solid rgba(255,255,255,0.06)' : 'none',
            filter:     isUsed ? 'grayscale(1) opacity(0.25)' : 'none',
            padding: '6px',
          }}
          title="Ver QR"
        >
          <QRCodeSVG
            value={qrPayload(ticket)}
            size={44}
            bgColor="#ffffff"
            fgColor="#080B14"
            level="H"
            includeMargin={false}
          />
        </button>
      </div>

      {/* Perforation line */}
      <div className="mx-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-white/25">Toca el QR para expandir y descargar</span>
        <span className="text-[10px] font-mono" style={{ color: status.color }}>{ticket.status?.toUpperCase()}</span>
      </div>
    </motion.div>
  );
}

/* ── Main Component ── */
export default function TicketVault() {
  const { currentUser } = useAuth();
  const [activeTicket, setActiveTicket] = useState(null);

  const { data: tickets, loading, error, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('user_tickets').select('*, events(title, date, venue, image_url)').eq('user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para ver tus entradas." /></div>;

  return (
    <>
      <div className="p-5 space-y-5">
        <div>
          <h1 className="text-xl font-black text-white">Ticket Vault</h1>
          <p className="text-sm text-white/40 mt-1">Tus entradas para los próximos eventos.</p>
        </div>

        {loading && <CardSkeleton count={3} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && (!tickets || tickets.length === 0) && (
          <EmptyState label="No tienes entradas aún" icon={Ticket} />
        )}
        {!loading && !error && tickets && tickets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket, i) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={i}
                onShowQR={setActiveTicket}
              />
            ))}
          </div>
        )}
      </div>

      {activeTicket && (
        <QRModal ticket={activeTicket} onClose={() => setActiveTicket(null)} />
      )}
    </>
  );
}
