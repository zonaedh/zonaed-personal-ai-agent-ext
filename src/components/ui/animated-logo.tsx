import { cn } from '@/lib/cn';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AnimatedLogo({ size = 'md', className }: AnimatedLogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-10 w-10',
    xl: 'h-14 w-14',
  };

  const starSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-7 w-7',
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none shrink-0 group',
        sizeClasses[size],
        className,
      )}
    >
      {/* Outer ambient radiant glow aura */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 opacity-60 blur-md animate-pulse" />

      {/* Rotating gradient ring */}
      <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 opacity-75 blur-[1px] animate-[spin_8s_linear_infinite]" />

      {/* Core shiny card surface */}
      <div className="relative flex h-full w-full items-center justify-center rounded-full border border-white/40 bg-card/90 backdrop-blur-md shadow-sm transition-transform duration-300 group-hover:scale-105">
        {/* Animated sparkling 8-point geometric star icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            'text-primary fill-primary/20 transition-transform duration-500 animate-[pulse_3s_ease-in-out_infinite] group-hover:rotate-45',
            starSizes[size],
          )}
        >
          <path
            d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M12 3.5L13.5 8.5L18.5 10L13.5 11.5L12 16.5L10.5 11.5L5.5 10L10.5 8.5L12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Subtle micro sparkle in corner */}
          <circle cx="18" cy="6" r="1.5" fill="#38bdf8" className="animate-ping" />
        </svg>
      </div>
    </div>
  );
}
