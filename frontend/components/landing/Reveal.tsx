"use client";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

// Content is always visible by default; no entrance animation gates it.
// Kept as a plain wrapper so call sites stay unchanged.
export function Reveal({ children, className = "" }: RevealProps) {
  return <div className={className}>{children}</div>;
}
