export default function XiraMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width="100%"
      height="100%"
      className={className}
      aria-label="XIRA"
      role="img"
    >
      <defs>
        <linearGradient id="xira-mark-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#737373" />
          <stop offset="100%" stopColor="#2a2a2a" />
        </linearGradient>
      </defs>
      <rect width="500" height="500" fill="url(#xira-mark-bg)" />
      <g fill="#0b0b0b">
        <rect x="60" y="80" width="140" height="140" rx="16" />
        <rect x="220" y="240" width="140" height="140" rx="16" />
        <rect x="60" y="400" width="140" height="140" rx="16" transform="translate(0, -120)" />
        <rect x="380" y="80" width="140" height="140" rx="16" />
        <rect x="380" y="400" width="140" height="140" rx="16" transform="translate(0, -120)" />
        <rect x="540" y="80" width="35" height="140" rx="10" />
        <rect x="595" y="80" width="35" height="140" rx="10" />
        <rect x="540" y="280" width="35" height="140" rx="10" />
        <rect x="595" y="280" width="35" height="140" rx="10" />
      </g>
    </svg>
  );
}