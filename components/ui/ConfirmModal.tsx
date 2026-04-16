'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

const variantStyles = {
  danger: {
    icon: 'bg-red-500/10 text-red-400',
    button: 'bg-red-600 hover:bg-red-500',
  },
  warning: {
    icon: 'bg-amber-500/10 text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-500',
  },
  info: {
    icon: 'bg-blue-500/10 text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-500',
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: { message: '' },
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  function handleClose(result: boolean) {
    state.resolve?.(result);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }

  const v = variantStyles[state.options.variant || 'danger'];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => handleClose(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full max-w-[400px] rounded-xl border border-white/[0.08] bg-[var(--modal-bg)] p-6 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`rounded-full p-3 mb-4 ${v.icon}`}>
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-[16px] font-semibold text-white mb-2">
                  {state.options.title || 'Confirmar ação'}
                </h3>
                <p className="text-[14px] text-slate-400 mb-6 leading-relaxed">
                  {state.options.message}
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-slate-300 transition hover:bg-white/[0.06]"
                  >
                    {state.options.cancelText || 'Cancelar'}
                  </button>
                  <button
                    autoFocus
                    onClick={() => handleClose(true)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white transition ${v.button}`}
                  >
                    {state.options.confirmText || 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
