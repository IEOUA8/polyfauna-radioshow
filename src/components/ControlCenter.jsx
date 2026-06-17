import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, LogOut, Mail, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs font-semibold text-white/80">{value || '—'}</span>
    </div>
  );
}

export default function ControlCenter() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para acceder al Control Center." /></div>;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Sesión cerrada', description: 'Hasta pronto.' });
    navigate('/login');
  };

  const isAdmin = currentUser.user_metadata?.role === 'admin' || currentUser.email?.includes('admin');

  return (
    <div className="p-5 space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-black text-white">Control Center</h1>
        <p className="text-sm text-white/40 mt-1">Ajustes y preferencias de tu cuenta.</p>
      </div>

      {/* Avatar + name */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-5 rounded-2xl"
        style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shrink-0"
          style={{ background: 'linear-gradient(135deg, #00CFFF33, #7B5CF033)', color: '#00CFFF' }}
        >
          {currentUser.user_metadata?.name?.slice(0, 1)?.toUpperCase() || currentUser.email?.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-white">
            {currentUser.user_metadata?.name || currentUser.email?.split('@')[0]}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#00CFFF' }}>Wave Citizen</p>
        </div>
        {isAdmin && (
          <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded shrink-0" style={{ background: 'rgba(0,207,255,0.12)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.2)' }}>
            ADMIN
          </span>
        )}
      </motion.div>

      {/* Account info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Información de cuenta</p>
        </div>
        <div className="px-5 pb-4">
          <InfoRow label="Email" value={currentUser.email} />
          <InfoRow label="ID de usuario" value={currentUser.id?.slice(0, 16) + '…'} />
          <InfoRow
            label="Cuenta creada"
            value={currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('es-CO') : null}
          />
          <InfoRow label="Último acceso" value={
            currentUser.last_sign_in_at
              ? new Date(currentUser.last_sign_in_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
              : null
          } />
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="space-y-2"
      >
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-xl text-sm font-semibold transition-colors text-white"
            style={{ background: 'rgba(0,207,255,0.07)', border: '1px solid rgba(0,207,255,0.15)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,207,255,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,207,255,0.07)')}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4" style={{ color: '#00CFFF' }} />
              Panel de Administración
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/30" />
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl text-sm font-semibold text-red-400 transition-colors"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
}
