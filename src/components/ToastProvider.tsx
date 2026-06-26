import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '../theme/appVisualTheme';
import {
  installAppAlertBridge,
  registerNotificationBridge,
  type AppNotificationPayload,
  type NotificationAction,
} from '../utils/appNotificationBridge';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ActiveNotification = AppNotificationPayload & {
  id: string;
};

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  showNotification: (payload: AppNotificationPayload) => string;
  dismissNotification: (id?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

function typeStyles(type: ToastType | undefined) {
  switch (type) {
    case 'success':
      return { card: styles.cardSuccess, accent: '#00ff88' };
    case 'error':
      return { card: styles.cardError, accent: '#ff6b6b' };
    case 'warning':
      return { card: styles.cardWarning, accent: '#FFB84D' };
    case 'info':
    default:
      return { card: styles.cardInfo, accent: '#7EB6FF' };
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<ActiveNotification[]>([]);
  const [active, setActive] = useState<ActiveNotification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissNotification = useCallback(
    (id?: string, options?: { invokeOnDismiss?: boolean }) => {
      clearTimer();
      setActive((current) => {
        if (!current) return null;
        if (id && current.id !== id) return current;
        if (options?.invokeOnDismiss !== false) {
          current.onDismiss?.();
        }
        return null;
      });
      if (id) {
        setQueue((prev) => prev.filter((item) => item.id !== id));
      }
    },
    [clearTimer]
  );

  const showNotification = useCallback(
    (payload: AppNotificationPayload): string => {
      const id = `notice-${Date.now()}-${idCounter.current++}`;
      const entry: ActiveNotification = { ...payload, id };
      setQueue((prev) => [...prev, entry]);
      return id;
    },
    []
  );

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs: number = 2500) => {
      showNotification({
        lines: message.split('\n').filter(Boolean),
        type,
        durationMs,
        actions: [{ label: 'OK' }],
      });
    },
    [showNotification]
  );

  useEffect(() => {
    registerNotificationBridge(showNotification);
    installAppAlertBridge();
  }, [showNotification]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
  }, [active, queue]);

  useEffect(() => {
    clearTimer();
    if (!active) return;

    const autoDismiss = !active.persistent && active.durationMs != null && active.durationMs > 0;
    if (autoDismiss) {
      timerRef.current = setTimeout(
        () => dismissNotification(active.id, { invokeOnDismiss: true }),
        active.durationMs
      );
    }
    return clearTimer;
  }, [active, clearTimer, dismissNotification]);

  const runAction = useCallback(
    (action: NotificationAction) => {
      const currentId = active?.id;
      dismissNotification(currentId, { invokeOnDismiss: false });
      action.onPress?.();
    },
    [active?.id, dismissNotification]
  );

  const value = useMemo(
    () => ({ showToast, showNotification, dismissNotification }),
    [showToast, showNotification, dismissNotification]
  );

  const palette = typeStyles(active?.type);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {active ? (
        <View
          pointerEvents="box-none"
          style={[styles.host, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 8 : 12) }]}
        >
          <View style={[styles.card, palette.card]}>
            <View style={[styles.accentBar, { backgroundColor: palette.accent }]} />
            <View style={styles.content}>
              <View style={styles.headerRow}>
                {active.title ? <Text style={styles.title}>{active.title}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss notification"
                  onPress={() => dismissNotification(active.id, { invokeOnDismiss: true })}
                  hitSlop={10}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              {(active.lines ?? []).map((line, index) => (
                <Text key={`${active.id}-line-${index}`} style={styles.line}>
                  {line}
                </Text>
              ))}

              {active.actions && active.actions.length > 0 ? (
                <View style={styles.actions}>
                  {active.actions.map((action, index) => {
                    const isPrimary =
                      action.style !== 'cancel' && action.style !== 'destructive';
                    const isDestructive = action.style === 'destructive';
                    return (
                      <TouchableOpacity
                        key={`${action.label}-${index}`}
                        style={[
                          styles.actionBtn,
                          isPrimary && styles.actionBtnPrimary,
                          action.style === 'cancel' && styles.actionBtnSecondary,
                          isDestructive && styles.actionBtnDestructive,
                        ]}
                        onPress={() => runAction(action)}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.actionText,
                            isPrimary && styles.actionTextPrimary,
                            action.style === 'cancel' && styles.actionTextSecondary,
                            isDestructive && styles.actionTextDestructive,
                          ]}
                        >
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 300000,
    elevation: 300000,
    paddingHorizontal: 12,
    pointerEvents: 'box-none',
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  cardInfo: {
    backgroundColor: '#1a2330',
    borderColor: 'rgba(126, 182, 255, 0.35)',
  },
  cardSuccess: {
    backgroundColor: '#14241c',
    borderColor: 'rgba(0, 255, 136, 0.35)',
  },
  cardError: {
    backgroundColor: '#2a1717',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  cardWarning: {
    backgroundColor: '#2a2214',
    borderColor: 'rgba(255, 184, 77, 0.4)',
  },
  accentBar: {
    height: 3,
    width: '100%',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: '#ccc',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: -1,
  },
  line: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  actionBtnPrimary: {
    backgroundColor: AppTheme.accent,
    borderColor: AppTheme.accent,
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
  },
  actionBtnDestructive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionTextPrimary: {
    color: AppTheme.accentDark,
  },
  actionTextSecondary: {
    color: '#ccc',
  },
  actionTextDestructive: {
    color: '#ff8f8f',
  },
});
