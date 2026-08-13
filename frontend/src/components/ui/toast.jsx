import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { create } from 'zustand';

// Simple toast store
export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 5000);
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message, description) =>
    useToastStore.getState().addToast({ variant: 'success', title: message, description }),
  error: (message, description) =>
    useToastStore.getState().addToast({ variant: 'error', title: message, description }),
  info: (message, description) =>
    useToastStore.getState().addToast({ variant: 'info', title: message, description }),
  warning: (message, description) =>
    useToastStore.getState().addToast({ variant: 'warning', title: message, description }),
};

const icons = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map(({ id, title, description, variant = 'info' }) => (
        <ToastPrimitive.Root
          key={id}
          open
          onOpenChange={(open) => { if (!open) removeToast(id); }}
          className={cn(
            'group pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-border bg-background p-4 shadow-premium',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-right-full'
          )}
        >
          <div className="mt-0.5">{icons[variant]}</div>
          <div className="flex-1 space-y-0.5">
            <ToastPrimitive.Title className="text-sm font-semibold">{title}</ToastPrimitive.Title>
            {description && (
              <ToastPrimitive.Description className="text-xs text-muted-foreground">
                {description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            onClick={() => removeToast(id)}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}
