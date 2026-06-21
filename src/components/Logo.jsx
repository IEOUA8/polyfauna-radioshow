import React from 'react';

// Rutas de assets de marca (colocar archivos en public/icons/ per brand guide)
const ASSETS = {
  full:     '/icons/logo-horizontal.svg',
  vertical: '/icons/logo-vertical.svg',
  wordmark: '/icons/wordmark.svg',
  symbol:   '/icons/symbol-white.svg',
};

// Fallback mientras los SVG no estén colocados
const FALLBACK = '/logo-header.png';

const HEIGHTS = {
  xs: 'h-16',
  sm: 'h-16',
  md: 'h-20',
  lg: 'h-24',
  xl: 'h-32',
};

/**
 * Logo component per Polyfauna brand guide (v1.0 2026)
 *
 * variant:
 *  'full'      — lockup horizontal completo con tagline (≥1024px)
 *  'wordmark'  — solo "POLYFAUNA" sin símbolo
 *  'symbol'    — solo el organismo (<480px / íconos)
 *  'vertical'  — lockup vertical (splash, merch)
 *  'responsive'— cambia entre full (desktop) y symbol (móvil compacto) vía CSS
 *
 * size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 */
const Logo = ({ size = 'md', variant = 'full', className = '' }) => {
  const heightClass = HEIGHTS[size] ?? HEIGHTS.md;
  const baseStyle = { filter: 'brightness(0) invert(1)' };
  const baseClass = `${heightClass} w-auto object-contain transition-all duration-300 ${className}`;

  const handleError = (e) => {
    if (e.currentTarget.dataset.fallback !== 'true') {
      e.currentTarget.dataset.fallback = 'true';
      e.currentTarget.src = FALLBACK;
    }
  };

  if (variant === 'responsive') {
    // brand guide §7: full en desktop, symbol en móvil compacto
    return (
      <>
        {/* ≥480px — logo horizontal completo */}
        <img
          src={ASSETS.full}
          onError={handleError}
          alt="POLYFAUNA — Radio · Podcasts · Events"
          className={`hidden xs:block ${baseClass}`}
          style={baseStyle}
          draggable={false}
        />
        {/* <480px — solo el organismo (símbolo) */}
        <img
          src={ASSETS.symbol}
          onError={handleError}
          alt="POLYFAUNA"
          className={`block xs:hidden ${heightClass} w-auto object-contain ${className}`}
          style={baseStyle}
          draggable={false}
        />
      </>
    );
  }

  const src = ASSETS[variant] ?? ASSETS.full;
  const alt = variant === 'symbol' ? 'POLYFAUNA' : 'POLYFAUNA — Radio · Podcasts · Events';

  return (
    <img
      src={src}
      onError={handleError}
      alt={alt}
      className={baseClass}
      style={baseStyle}
      draggable={false}
    />
  );
};

export default Logo;
