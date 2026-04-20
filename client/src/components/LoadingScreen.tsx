import { Home } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#0b1017] via-[#101826] to-[#0b1017]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-white/15" />
          <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-transparent border-t-white/80 animate-spin" />
          <div className="absolute -inset-2 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Home className="w-7 h-7 text-white/90" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-tight">PropSwipe</h1>
          <p className="mt-1 text-white/70 text-sm">Loading your feed</p>
        </div>

        <div className="w-56 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 bg-white/60 animate-[shimmer_1.4s_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
