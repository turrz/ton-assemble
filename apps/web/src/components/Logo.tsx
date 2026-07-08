interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

/** TonAssemble logo: hexagon (unusual shape), no letter */
export default function Logo({ className = '', size = 40, showText = false }: LogoProps) {
  const s = size;
  const id = `logo-grad-${s}`;
  // Flat-top hexagon centered in 40x40: top (20,4), right-top (38,12), right-bottom (38,28), bottom (20,36), left-bottom (2,28), left-top (2,12)
  const path = 'M20 4 L38 12 L38 28 L20 36 L2 28 L2 12 Z';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={s}
        height={s}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        <path d={path} fill={`url(#${id})`} />
        <defs>
          <linearGradient id={id} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0088CC" />
            <stop offset="0.6" stopColor="#00B4A7" />
            <stop offset="1" stopColor="#00C6A0" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className="text-[1rem] font-semibold tracking-tight text-tg-text whitespace-nowrap">TonAssemble</span>
      )}
    </div>
  );
}
