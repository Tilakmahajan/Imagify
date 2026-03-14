"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = crypto.randomUUID();
      // Only keep the latest toast
      setToasts([{ id, message, type, duration }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const toast = useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      addToast(message, type, duration);
    },
    [addToast]
  );

  const value = useMemo<ToastContextType>(
    () => ({
      toast,
      success: (m) => addToast(m, "success"),
      error: (m) => addToast(m, "error"),
      info: (m) => addToast(m, "info"),
    }),
    [toast, addToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 left-4 right-4 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
        style={{ maxWidth: "400px", margin: "0 auto" }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  id,
  message,
  type,
  onDismiss,
}: Toast & { onDismiss: () => void }) {
  const styles = {
    success: {
      background: "linear-gradient(135deg, rgba(0,255,148,0.95), rgba(0,200,255,0.9))",
      color: "#000",
      border: "1px solid rgba(255,255,255,0.3)",
    },
    error: {
      background: "linear-gradient(135deg, rgba(255,61,127,0.95), rgba(124,58,255,0.9))",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.2)",
    },
    info: {
      background: "rgba(0,0,0,0.9)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.15)",
    },
  };

  return (
    <div
      role="alert"
      className="pointer-events-auto w-full rounded-xl px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-sm"
      style={{ ...styles[type], animation: "fade-in-up 0.3s ease-out" }}
    >
      {message}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (m: string) => {},
      success: (m: string) => {},
      error: (m: string) => {},
      info: (m: string) => {},
    };
  }
  return ctx;
}
