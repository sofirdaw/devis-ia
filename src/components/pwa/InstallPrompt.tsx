"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });
  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
    );
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Écouter l'événement Chrome/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || dismissed) return null;

  return (
    <>
      {/* Pop-up / Bannière Chrome & Android */}
      {deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 z-50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center font-bold text-white shrink-0">
              IA
            </div>
            <div>
              <p className="text-sm font-semibold">Installer Devis IA</p>
              <p className="text-xs text-slate-300">
                Utilisez l&apos;application 100% hors-ligne sur votre écran d&apos;accueil.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors shadow-sm"
            >
              Installer
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Guide d'installation spécifique iOS Safari */}
      {isIOS && (
        <div className="fixed bottom-4 left-4 right-4 bg-white p-4 rounded-2xl shadow-2xl border border-gray-200 z-50 flex items-center justify-between gap-3 text-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <p className="text-xs font-bold">Installer sur iPhone / iPad</p>
              <p className="text-[11px] text-gray-500">
                Appuyez sur <span className="font-semibold text-primary-600">Partager ⎋</span> puis{" "}
                <span className="font-semibold text-primary-600">
                  &quot;Sur l&apos;écran d&apos;accueil&quot; ➕
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 p-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
