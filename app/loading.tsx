export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo-bah.svg" alt="Bah!" className="h-10 w-10 rounded-xl object-contain" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-border/30">
          <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-accent"
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
