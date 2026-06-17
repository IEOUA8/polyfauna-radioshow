import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=600&auto=format&fit=crop';

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function excerpt(text, max = 120) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

function ArticleCard({ article, index, featured }) {
  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="col-span-full rounded-2xl overflow-hidden relative group cursor-pointer"
        style={{ minHeight: 280, border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <img
          src={article.featured_image_url || FALLBACK}
          alt={article.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
        <div className="relative z-10 p-8 flex flex-col justify-end h-full" style={{ minHeight: 280 }}>
          {article.category && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#00CFFF' }}>
              {article.category}
            </span>
          )}
          <h2 className="text-2xl font-black text-white leading-tight max-w-xl">{article.title}</h2>
          <p className="text-sm text-white/60 mt-2 max-w-lg">{excerpt(article.content, 160)}</p>
          <div className="flex items-center gap-3 mt-4 text-xs text-white/40">
            {article.author && <span>{article.author}</span>}
            {article.created_at && <span>{formatDate(article.created_at)}</span>}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
      style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,207,255,0.2)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={article.featured_image_url || FALLBACK}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {article.category && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,207,255,0.15)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.2)' }}
          >
            {article.category}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-bold text-white leading-tight">{article.title}</h3>
        <p className="text-xs text-white/40 line-clamp-3 leading-relaxed flex-1">{excerpt(article.content)}</p>
        <div className="flex items-center justify-between pt-2 text-[10px] text-white/30">
          {article.author && <span>{article.author}</span>}
          {article.created_at && <span>{formatDate(article.created_at)}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export default function BlogSection() {
  const [activeCategory, setActiveCategory] = useState('Todos');

  const { data: articles, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('blog_articles').select('*').order('created_at', { ascending: false }),
    []
  );

  const categories = useMemo(() => {
    if (!articles) return ['Todos'];
    const unique = [...new Set(articles.map((a) => a.category).filter(Boolean))];
    return ['Todos', ...unique];
  }, [articles]);

  const filtered = useMemo(() => {
    if (!articles) return [];
    return activeCategory === 'Todos' ? articles : articles.filter((a) => a.category === activeCategory);
  }, [articles, activeCategory]);

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Blog</h1>
        <p className="text-sm text-white/40 mt-1">Artículos, crónicas y notas del universo PolyFauna.</p>
      </div>

      {/* Category filter */}
      {!loading && !error && categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                background: activeCategory === cat ? '#00CFFF' : 'rgba(255,255,255,0.05)',
                color: activeCategory === cat ? '#080B14' : 'rgba(255,255,255,0.5)',
                border: activeCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading && <CardSkeleton count={4} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState label="No hay artículos aún" icon={FileText} />
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((article, i) => (
            <ArticleCard key={article.id} article={article} index={i} featured={i === 0 && activeCategory === 'Todos'} />
          ))}
        </div>
      )}
    </div>
  );
}
