// Phase 13.D.1 (SYSTEM_REVIEW.md v2 / PLAN.md): replaces window.confirm() —
// a browser-native blocking dialog — with an async, themeable in-app one.
// Mount <ConfirmDialogProvider> once near the app root (alongside
// <Toaster />); call useConfirm() anywhere to get an async confirm(message)
// function, exactly like window.confirm() but returning a real Promise<boolean>
// instead of blocking the main thread.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'destructive' renders the confirm button red — use for deletes. */
  variant?: 'default' | 'destructive';
}

type ConfirmArg = string | ConfirmOptions;
type ConfirmFn = (arg: ConfirmArg) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Async replacement for window.confirm(message) — await the result. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm() must be used within <ConfirmDialogProvider>');
  return ctx;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((arg) => {
    const options: ConfirmOptions = typeof arg === 'string' ? { description: arg } : arg;
    return new Promise<boolean>((resolve) => setPending({ options, resolve }));
  }, []);

  const settle = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.options.title || 'Are you sure?'}</DialogTitle>
            <DialogDescription>{pending?.options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {pending?.options.cancelLabel || 'Cancel'}
            </Button>
            <Button
              onClick={() => settle(true)}
              className={pending?.options.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
            >
              {pending?.options.confirmLabel || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
