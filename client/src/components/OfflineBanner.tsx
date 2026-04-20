import { WifiOff, RefreshCw } from "lucide-react";
import { useNetwork } from "@/hooks/use-network";

interface OfflineBannerProps {
  onReconnect?: () => void;
}

export default function OfflineBanner({ onReconnect }: OfflineBannerProps) {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[200]">
      <div className="mx-auto max-w-5xl px-4 py-2 mt-2">
        <div className="bg-amber-500 text-black rounded-xl shadow border border-amber-600/50 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">You are offline. Changes will not be saved.</span>
          </div>
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="flex items-center gap-1 text-sm font-semibold hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


