import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-8 shadow-xl">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 mb-4 font-mono text-lg font-bold">
          404
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
          The requested page or market asset does not exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--foreground)] font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-[var(--card-border)] text-neutral-300 font-medium text-sm hover:bg-[var(--card-border)]/50 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
