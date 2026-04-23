import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Custom PWA install prompt banner shown when the app is not installed
export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const DISMISSED_KEY = "pwa_install_prompt_dismissed";

  useEffect(() => {
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    const installedFlag = localStorage.getItem("pwa_installed") === "true";
    const dismissedFlag = localStorage.getItem(DISMISSED_KEY) === "true";

    if (isStandalone || installedFlag || dismissedFlag) {
      setVisible(false);
      return;
    }

    const onBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISSED_KEY) === "true") {
        return;
      }
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);

    const onAppInstalled = () => {
      localStorage.setItem("pwa_installed", "true");
      localStorage.removeItem(DISMISSED_KEY);
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", onAppInstalled);

    // Also react to display-mode changes (e.g., open as standalone)
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => {
      if (media?.matches) {
        localStorage.setItem("pwa_installed", "true");
        setVisible(false);
      }
    };
    media?.addEventListener?.("change", onDisplayModeChange as any);

    // Fallback: if event doesn't fire (e.g., iOS), still show a gentle banner
    const fallbackTimer = window.setTimeout(() => {
      const nowStandalone = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
      const nowInstalledFlag = localStorage.getItem("pwa_installed") === "true";
      const nowDismissedFlag = localStorage.getItem(DISMISSED_KEY) === "true";
      if (!deferredPrompt && !nowStandalone && !nowInstalledFlag && !nowDismissedFlag) {
        setVisible(true);
      }
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled);
      media?.removeEventListener?.("change", onDisplayModeChange as any);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {}
      setDeferredPrompt(null);
      // Keep it visible on next page load if not installed; hide for now
      setVisible(false);
    } else {
      // Fallback instructions
      alert("To install: Open browser menu and tap 'Add to Home screen'.");
      setVisible(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] w-full">
      <div className="bg-black/80 text-white backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-white/10 flex items-center gap-3 flex-wrap justify-between">
        <div className="text-sm">
          Install PropSwipe for quicker access and a better experience.
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleInstall} className="bg-white text-black hover:bg-white/90 h-8 px-3">
            Install
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.setItem(DISMISSED_KEY, "true");
              setVisible(false);
            }}
            className="text-white hover:bg-white/10 h-8 px-3"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}


