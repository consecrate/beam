"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<(message: string, action?: Toast["action"], ms?: number) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, action?: Toast["action"], ms = 5000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
