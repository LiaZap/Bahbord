export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-6">
        <img src="/logo-bahtech.svg" alt="BahTech" className="h-12 object-contain animate-pulse" />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-blue-500/60"
               style={{ animation: 'loading-bar 1.2s ease-in-out infinite' }} />
        </div>
      </div>
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); width: 33%; }
          50% { width: 66%; }
          100% { transform: translateX(400%); width: 33%; }
        }
      `}</style>
    </div>
  );
}
