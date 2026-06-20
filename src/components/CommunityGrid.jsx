import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop';

const STATUS_COLORS = ['#22c55e', '#20C7E8', '#F59E0B', 'rgba(255,255,255,0.2)'];

function MemberCard({ member, index }) {
  const status = STATUS_COLORS[index % STATUS_COLORS.length];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl p-4 flex flex-col items-center text-center gap-2 cursor-pointer transition-colors group"
      style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(32,199,232,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-full overflow-hidden">
          <img
            src={member.image_url || FALLBACK}
            alt={member.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        </div>
        <span
          className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
          style={{ background: status, borderColor: '#080E09' }}
        />
      </div>
      <div className="min-w-0 w-full">
        <p className="text-xs font-bold text-white truncate">{member.name}</p>
        {member.type && (
          <p className="text-[10px] text-white/40 truncate mt-0.5">{member.type}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function CommunityGrid() {
  const { data: members, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('artists').select('id, name, bio, image_url, type').limit(24),
    []
  );

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Community Grid</h1>
        <p className="text-sm text-white/40 mt-1">Artistas y miembros activos de la comunidad PolyFauna.</p>
      </div>

      {loading && <CardSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && (!members || members.length === 0) && (
        <EmptyState label="La comunidad está creciendo…" icon={LayoutGrid} />
      )}
      {!loading && !error && members && members.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#22c55e' }} /> Online</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#20C7E8' }} /> En vivo</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#F59E0B' }} /> Grabando</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {members.map((member, i) => (
              <MemberCard key={member.id} member={member} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
