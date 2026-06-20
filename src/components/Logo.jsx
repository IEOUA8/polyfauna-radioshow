import React from 'react';

const Logo = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-16',
    md: 'h-20',
    lg: 'h-24',
    xl: 'h-32'
  };

  return (
    <img
      src="/logo-header.png"
      alt="POLYFAUNA - Radio · Podcasts · Events"
      className={`${sizes[size]} w-auto object-contain transition-all duration-300 ${className}`}
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  );
};

export default Logo;