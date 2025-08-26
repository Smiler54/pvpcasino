import React, { useState } from 'react';

interface CoinIconProps {
  side: 'heads' | 'tails';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Preload images for faster display
const headsImage = '/lovable-uploads/105aa71c-7531-4a7e-bab4-142cbad338d9.png';
const tailsImage = '/lovable-uploads/cb546342-bd06-4ad4-b5cd-a81ce18a44fb.png';

// Create image objects to preload
if (typeof window !== 'undefined') {
  const preloadHeads = new Image();
  preloadHeads.src = headsImage;
  const preloadTails = new Image();
  preloadTails.src = tailsImage;
}

export const CoinIcon: React.FC<CoinIconProps> = ({ 
  side, 
  size = 'sm', 
  className = '' 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const imageSrc = side === 'heads' ? headsImage : tailsImage;

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
      {!imageLoaded && (
        <div className="w-full h-full bg-muted rounded-full animate-pulse flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground">
            {side === 'heads' ? 'H' : 'T'}
          </span>
        </div>
      )}
      <img 
        src={imageSrc}
        alt={side === 'heads' ? 'Heads' : 'Tails'}
        className={`w-full h-full object-contain rounded-full transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0 absolute'
        }`}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
        loading="eager"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageLoaded(true)} // Show placeholder if image fails
      />
    </div>
  );
};