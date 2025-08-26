import { cn } from "@/lib/utils";

interface PVPLogoProps {
  className?: string;
  variant?: 'default' | 'small' | 'large';
}

export const PVPLogo = ({ className, variant = 'default' }: PVPLogoProps) => {
  const sizeClasses = {
    small: "w-10 h-10",
    default: "w-14 h-14", 
    large: "w-16 h-16"
  };

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center",
        sizeClasses[variant],
        className
      )}
    >
      <svg 
        viewBox="0 0 100 115" 
        className="w-full h-full drop-shadow-lg"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Crown */}
        <g transform="translate(50, 15)">
          {/* Crown base */}
          <path
            d="M-25 5 L-15 -10 L-5 0 L5 -15 L15 0 L25 -10 L25 5 Z"
            fill="url(#crownGradient)"
          />
          {/* Crown jewels */}
          <circle cx="-15" cy="-5" r="2" fill="hsl(var(--crypto-blue))" />
          <circle cx="0" cy="-8" r="2.5" fill="hsl(var(--crypto-red))" />
          <circle cx="15" cy="-5" r="2" fill="hsl(var(--crypto-green))" />
        </g>

        {/* Shield */}
        <path
          d="M50 25 L15 35 L15 70 C15 78 30 90 50 95 C70 90 85 78 85 70 L85 35 Z"
          fill="url(#shieldGradient)"
        />

        {/* Inner shield background */}
        <path
          d="M50 30 L20 38 L20 67 C20 73 32 82 50 87 C68 82 80 73 80 67 L80 38 Z"
          fill="hsl(var(--card))"
          opacity="0.9"
        />

        {/* PVP Text */}
        <text
          x="50"
          y="63"
          textAnchor="middle"
          className="fill-foreground font-bold text-[26px]"
          style={{ fontFamily: 'system-ui, sans-serif', fontWeight: '900', letterSpacing: '1px' }}
        >
          PVP
        </text>

        {/* Shine effect */}
        <path
          d="M30 40 Q50 35 70 45 Q50 50 30 55 Z"
          fill="url(#shineGradient)"
          opacity="0.3"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="crownGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--crypto-gold))" />
            <stop offset="100%" stopColor="hsl(45 80% 45%)" />
          </linearGradient>
          
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--muted))" />
            <stop offset="50%" stopColor="hsl(var(--background))" />
            <stop offset="100%" stopColor="hsl(var(--muted))" />
          </linearGradient>
          
          <linearGradient id="shineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="hsl(var(--foreground))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};