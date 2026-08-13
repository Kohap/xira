export function BuiltOnXLayerBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "8px",
        padding: "6px 8px 6px 6px",
        color: "#a1a1aa",
        fontWeight: 400,
        fontSize: "13px",
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="16" height="16" aria-hidden="true">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#737373" />
            <stop offset="50%" stopColor="#555555" />
            <stop offset="100%" stopColor="#2a2a2a" />
          </linearGradient>
        </defs>
        <rect width="500" height="500" fill="url(#bgGrad)" />
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
      Built on X Layer
    </span>
  );
}