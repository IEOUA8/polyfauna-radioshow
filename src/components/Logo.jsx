import React from 'react';

const ASSETS = {
  header:       '/icons/logo-header.svg',      // sidebar / topbar — proporciones definitivas
  full:         '/icons/logo-horizontal.svg',  // lockup amplio (splash, merch)
  vertical:     '/icons/logo-vertical.svg',
  wordmark:     '/icons/wordmark.svg',
  symbol:       '/icons/symbol-white.svg',     // organismo fino (decorativo)
  'symbol-ui':  '/icons/symbol-ui.svg',        // organismo bold (UI, tamaños pequeños)
};

const FALLBACK = '/icons/logo-header.svg';

const HEIGHTS = {
  xs: 'h-8',
  sm: 'h-10',
  md: 'h-[42px]',
  lg: 'h-14',
  xl: 'h-20',
};

// Variantes que rellenan el ancho del contenedor (h-auto)
const WIDE_VARIANTS = new Set(['header', 'full', 'wordmark']);

const Logo = ({ size = 'md', variant = 'header', className = '' }) => {
  const isWide = WIDE_VARIANTS.has(variant);

  const baseClass = isWide
    ? `w-full h-auto object-contain object-left block transition-all duration-300 ${className}`
    : `${HEIGHTS[size] ?? HEIGHTS.md} w-auto object-contain transition-all duration-300 ${className}`;

  const handleError = (e) => {
    if (e.currentTarget.dataset.fallback !== 'true') {
      e.currentTarget.dataset.fallback = 'true';
      e.currentTarget.src = FALLBACK;
    }
  };

  if (variant === 'responsive') {
    return (
      <>
        <img
          src={ASSETS.header}
          onError={handleError}
          alt="POLYFAUNA — Radio · Podcasts · Events"
          className={`hidden xs:block w-full h-auto object-contain object-left ${className}`}
          draggable={false}
        />
        <img
          src={ASSETS['symbol-ui']}
          onError={handleError}
          alt="POLYFAUNA"
          className={`block xs:hidden ${HEIGHTS[size] ?? HEIGHTS.md} w-auto object-contain ${className}`}
          draggable={false}
        />
      </>
    );
  }

  const src = ASSETS[variant] ?? ASSETS.header;
  const isSymbol = variant === 'symbol' || variant === 'symbol-ui';
  const alt = isSymbol ? 'POLYFAUNA' : 'POLYFAUNA — Radio · Podcasts · Events';

  return (
    <img
      src={src}
      onError={handleError}
      alt={alt}
      className={baseClass}
      draggable={false}
    />
  );
};

export default Logo;
