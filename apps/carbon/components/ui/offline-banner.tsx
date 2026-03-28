"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initialize with current state
    setIsOnline(navigator.onLine);

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          role="alert"
          aria-live="assertive"
          className="fixed top-0 left-0 right-0 z-[150] bg-amber-500 text-amber-950 px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Connexion perdue. Vos données sont sauvegardées localement.</span>
        </motion.div>
      )}

      {isOnline && showReconnected && (
        <motion.div
          key="reconnected"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[150] bg-[var(--color-success)] text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
        >
          <Wifi className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Connexion rétablie.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
