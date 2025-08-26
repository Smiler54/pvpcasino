import { cn } from "@/lib/utils";

interface CrownIconProps {
  className?: string;
  variant?: 'default' | 'small' | 'large';
}

export const CrownIcon = ({ className, variant = 'default' }: CrownIconProps) => {
  const sizeClasses = {
    small: "w-8 h-8",
    default: "w-12 h-12", 
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
        viewBox="0 0 60 40" 
        className="w-full h-full drop-shadow-lg"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Crown */}
        <g transform="translate(30, 20)">
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

        {/* Gradients */}
        <defs>
          <linearGradient id="crownGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--crypto-gold))" />
            <stop offset="100%" stopColor="hsl(45 80% 45%)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};