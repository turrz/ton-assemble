import Logo from './Logo';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-tg-bg px-4">
      <div className="flex flex-col items-center gap-8">
        <div className="animate-loading-pulse">
          <Logo size={80} showText />
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#0088CC] to-[#00C6A0] animate-loading-bar" />
          </div>
          <p className="text-sm text-tg-hint">Loading…</p>
        </div>
      </div>
    </div>
  );
}
