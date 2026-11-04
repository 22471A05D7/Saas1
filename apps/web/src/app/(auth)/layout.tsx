/** Centered, marketing-free shell for the sign-in and sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[26rem]">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lift">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 7 12 3 4 7v10l8 4 8-4V7Z" />
                <path d="m4 7 8 4 8-4" />
              </svg>
            </div>
            <h1 className="mt-3.5 text-lg font-semibold tracking-tight text-ink">StockFlow</h1>
            <p className="mt-1 text-sm text-ink-muted">Inventory management for growing teams</p>
          </div>
          {children}
        </div>
      </div>
      <footer className="pb-6 text-center text-xs text-ink-subtle">
        StockFlow · Multi-tenant inventory management
      </footer>
    </div>
  );
}
