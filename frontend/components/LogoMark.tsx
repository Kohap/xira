// XIRA brand mark — five-block cross with motion trail, on a grey
// vignette tile. Fixed colors by design; works on dark and light headers.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width={size}
      height={size}
      className="shrink-0 rounded-lg"
      style={{ width: size, height: size }}
      role="img"
      aria-label="XIRA"
    >
      <defs>
        <linearGradient id="xira-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#737373" />
          <stop offset="50%" stopColor="#555555" />
          <stop offset="100%" stopColor="#2a2a2a" />
        </linearGradient>
      </defs>

      <rect width="500" height="500" fill="url(#xira-bg)" />

      <g fill="#0b0b0b">
        <rect x="120" y="140" width="80" height="80" rx="10" />
        <rect x="210" y="210" width="80" height="80" rx="10" />
        <rect x="120" y="280" width="80" height="80" rx="10" />
        <rect x="300" y="140" width="80" height="80" rx="10" />
        <rect x="300" y="280" width="80" height="80" rx="10" />

        <rect x="393" y="140" width="20" height="80" rx="6" />
        <rect x="424" y="140" width="20" height="80" rx="6" />
        <rect x="393" y="280" width="20" height="80" rx="6" />
        <rect x="424" y="280" width="20" height="80" rx="6" />
      </g>
    </svg>
  );
}
