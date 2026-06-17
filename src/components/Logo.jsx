import React from 'react';

const Logo = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-10 md:h-12',
    md: 'h-14 md:h-16',
    lg: 'h-20 md:h-24',
    xl: 'h-28 md:h-32'
  };

  return (
    <img
      src="https://horizons-cdn.hostinger.com/10bae3d0-65c5-4143-a035-ea5739b83edd/497ae30794802b018f3a8fc9eba56314.png"
      alt="POLYFAUNA - Fractal Radio / Experimental Electronic Broadcast"
      className={`${sizes[size]} w-auto object-contain transition-all duration-300 ${className}`}
    />
  );
};

export default Logo;