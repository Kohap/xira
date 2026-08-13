export default function XiraMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width="24"
      height="24"
      className={className}
      aria-label="XIRA"
      role="img"
    >
      <rect width="500" height="500" fill="transparent" />
      <g fill="#ffffff">
        <rect x="60" y="80" width="140" height="140" rx="16" />
        <rect x="220" y="240" width="140" height="140" rx="16" />
        <rect x="60" y="280" width="140" height="140" rx="16" />
        <rect x="380" y="80" width="140" height="140" rx="16" />
        <rect x="380" y="280" width="140" height="140" rx="16" />
        <rect x="540" y="80" width="35" height="140" rx="10" />
        <rect x="595" y="80" width="35" height="140" rx="10" />
        <rect x="540" y="280" width="35" height="140" rx="10" />
        <rect x="595" y="280" width="35" height="140" rx="10" />
      </g>
    </svg>
  );
}