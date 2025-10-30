import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info', durationMs: number = 2000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), Math.max(1000, durationMs));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <View style={[
          styles.toast,
          toast.type === 'success' ? styles.success : toast.type === 'error' ? styles.error : styles.info
        ]}>
          <Text style={styles.text}>{toast.message}</Text>
        </View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  success: {
    backgroundColor: 'rgba(0, 200, 120, 0.9)',
  },
  error: {
    backgroundColor: 'rgba(255, 80, 80, 0.9)',
  },
  info: {
    backgroundColor: 'rgba(180, 180, 180, 0.9)',
  },
});


