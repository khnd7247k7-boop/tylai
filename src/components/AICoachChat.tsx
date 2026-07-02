import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTextInput as TextInput } from './AppTextInput';
import { AppTheme } from '../theme/appVisualTheme';
import { getCoachResponse, getGeminiSetupHint, isGeminiApiKeyConfigured } from '../services/geminiService';
import { PremiumRequiredError } from '../utils/subscription';
import { useToast } from './ToastProvider';
import { sanitizeCoachHealthContext } from '../utils/healthContextPrivacy';
import { useKeyboardInsets } from '../keyboard/KeyboardInsetsContext';
import {
  appendCoachChatHistory,
  formatCoachHistoryWhen,
  loadCoachChatHistory,
  type CoachHistoryEntry,
} from '../utils/coachChatHistory';

export type CoachChatMessage = { id: string; role: 'user' | 'coach'; text: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface AICoachChatProps {
  healthData: Record<string, unknown>;
  dailyMindsetPrompt?: string | null;
}

export const AICoachChat: React.FC<AICoachChatProps> = ({ healthData, dailyMindsetPrompt }) => {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboardInsets();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [history, setHistory] = useState<CoachHistoryEntry[]>([]);
  const [pinnedQuery, setPinnedQuery] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef<CoachChatMessage[]>([]);
  const scrollToEndNextRef = useRef(false);
  messagesRef.current = messages;

  const geminiReady = isGeminiApiKeyConfigured();

  const mindfulMeta = useMemo(() => {
    const m = healthData.mindful as
      | {
          minutesTodayAggregated?: number;
          dataSource?: string;
          nativeReadSucceeded?: boolean;
          coachMockHealth?: boolean;
        }
      | undefined;
    const known = m?.dataSource === 'healthkit_aggregate' && m?.nativeReadSucceeded === true;
    const minutes = known ? Math.max(0, Number(m?.minutesTodayAggregated ?? 0)) : 0;
    const mindfulMinutesForModel: number | null = known ? minutes : null;
    return { known, minutes, mindfulMinutesForModel, coachMock: !!m?.coachMockHealth };
  }, [healthData]);

  const safeHealth = useMemo(() => sanitizeCoachHealthContext(healthData), [healthData]);

  useEffect(() => {
    loadCoachChatHistory().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    requestAnimationFrame(() => {
      if (scrollToEndNextRef.current) {
        scrollRef.current?.scrollToEnd({ animated: true });
        scrollToEndNextRef.current = false;
      } else {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    });
  }, [messages, loading, modalOpen]);

  const openModal = useCallback((seed?: CoachChatMessage[], queryPin?: string | null) => {
    scrollToEndNextRef.current = false;
    if (seed?.length) {
      setMessages(seed);
      setPinnedQuery(queryPin ?? seed.find((m) => m.role === 'user')?.text ?? null);
    } else {
      setPinnedQuery(null);
    }
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setInput('');
    setPinnedQuery(null);
  }, []);

  const openHistoryEntry = useCallback(
    (entry: CoachHistoryEntry) => {
      openModal(
        [
          { id: `${entry.id}-q`, role: 'user', text: entry.query },
          { id: `${entry.id}-a`, role: 'coach', text: entry.reply },
        ],
        entry.query
      );
    },
    [openModal]
  );

  const persistExchange = useCallback(async (query: string, reply: string) => {
    const entry: CoachHistoryEntry = {
      id: newId(),
      query,
      reply,
      createdAt: new Date().toISOString(),
    };
    const next = await appendCoachChatHistory(entry);
    setHistory(next);
  }, []);

  const sendWithText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (!modalOpen) setModalOpen(true);
      setPinnedQuery(null);

      if (!geminiReady) {
        scrollToEndNextRef.current = true;
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'user', text: trimmed },
          { id: newId(), role: 'coach', text: getGeminiSetupHint() },
        ]);
        return;
      }

      const userMsg: CoachChatMessage = { id: newId(), role: 'user', text: trimmed };
      const priorForApi = messagesRef.current.map((m) => ({ role: m.role, text: m.text }));
      scrollToEndNextRef.current = true;
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const reply = await getCoachResponse(
          trimmed,
          safeHealth,
          priorForApi,
          mindfulMeta.mindfulMinutesForModel
        );
        setMessages((prev) => [...prev, { id: newId(), role: 'coach', text: reply }]);
        scrollToEndNextRef.current = true;
        await persistExchange(trimmed, reply);
      } catch (e) {
        if (e instanceof PremiumRequiredError) {
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: 'coach',
              text: 'AI Coach is part of TYL Premium. Open More → TYL Premium or Settings → Subscription to upgrade.',
            },
          ]);
          return;
        }
        const msg = e instanceof Error ? e.message : 'Something went wrong.';
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'coach',
            text: `I could not reach the coach right now. ${msg}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, safeHealth, mindfulMeta.mindfulMinutesForModel, geminiReady, modalOpen, persistExchange]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    await sendWithText(text);
  }, [input, loading, sendWithText]);

  const requestHuman = useCallback(() => {
    showToast('Notifying your coach...', 'info', 2200);
  }, [showToast]);

  const showMindfulNudge =
    mindfulMeta.known && mindfulMeta.minutes === 0 && !loading;

  const onMindfulCardPress = useCallback(() => {
    openModal();
    void sendWithText('Give me a 1-minute mindfulness exercise.');
  }, [openModal, sendWithText]);

  const renderHistoryRow = () => {
    if (history.length === 0) return null;
    return (
      <View style={styles.modalHistoryWrap}>
        <Text style={styles.historyLabel}>Previous searches</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyScroll}
          keyboardShouldPersistTaps="handled"
        >
          {history.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.historyChip}
              onPress={() => openHistoryEntry(entry)}
              activeOpacity={0.85}
            >
              <Text style={styles.historyChipQuery} numberOfLines={3}>
                {entry.query}
              </Text>
              <Text style={styles.historyChipReply} numberOfLines={2}>
                {entry.reply}
              </Text>
              <Text style={styles.historyChipWhen}>{formatCoachHistoryWhen(entry.createdAt)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderMessageList = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.modalMessages}
      contentContainerStyle={styles.modalMessagesContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {messages.length === 0 && !loading ? (
        <View style={styles.modalEmpty}>
          <Text style={styles.modalEmptyTitle}>Your wellness coach</Text>
          <Text style={styles.modalEmptyBody}>
            Ask about training, nutrition, recovery, or habits. Replies use your dashboard snapshot when available.
          </Text>
          {!!dailyMindsetPrompt?.trim() && (
            <View style={styles.stateOfMindBanner}>
              <Text style={styles.stateOfMindLabel}>Today's mindset</Text>
              <Text style={styles.stateOfMindText}>{dailyMindsetPrompt.trim()}</Text>
            </View>
          )}
        </View>
      ) : null}
      {messages.map((m, idx) => {
        if (pinnedQuery && idx === 0 && m.role === 'user') return null;
        return (
        <View key={m.id} style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowCoach]}>
          {m.role === 'coach' ? (
            <View style={styles.coachAvatar}>
              <Text style={styles.coachAvatarText}>AI</Text>
            </View>
          ) : null}
          <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
            {m.role === 'coach' ? (
              <Text style={styles.coachRoleLabel}>Coach</Text>
            ) : (
              <Text style={styles.userRoleLabel}>You</Text>
            )}
            <Text selectable style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>
              {m.text}
            </Text>
          </View>
        </View>
        );
      })}
      {loading ? (
        <View style={[styles.row, styles.rowCoach]}>
          <View style={styles.coachAvatar}>
            <Text style={styles.coachAvatarText}>AI</Text>
          </View>
          <View style={[styles.bubble, styles.bubbleCoach, styles.thinkingBubble]}>
            <ActivityIndicator size="small" color={AppTheme.accent} />
            <Text style={styles.thinkingLabel}>Thinking…</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <>
      <Pressable style={styles.previewCard} onPress={() => openModal()} accessibilityRole="button">
        <View style={styles.previewGlow} pointerEvents="none" />
        <View style={styles.previewHeader}>
          <View style={styles.previewTitleRow}>
            <View style={styles.previewIconWrap}>
              <Text style={styles.previewIcon}>✦</Text>
            </View>
            <View style={styles.previewTitleCol}>
              <Text style={styles.previewTitle}>AI Coach</Text>
              <Text style={styles.previewSubtitle}>Tap for full-screen chat</Text>
            </View>
          </View>
          <View style={styles.previewOpenPill}>
            <Text style={styles.previewOpenPillText}>Open</Text>
          </View>
        </View>
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeModal}>
        <SafeAreaView style={styles.modalRoot} edges={['left', 'right', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.modalColumn}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity
                onPress={closeModal}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
              <View style={styles.modalHeaderCenter}>
                <Text style={styles.modalTitle}>AI Coach</Text>
                <Text style={styles.modalTitleSub}>Full-screen · saved searches below</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setMessages([]);
                  setInput('');
                  setPinnedQuery(null);
                  scrollToEndNextRef.current = false;
                }}
                style={styles.modalClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalClearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {!!pinnedQuery?.trim() && (
              <View style={styles.pinnedQueryBar}>
                <Text style={styles.pinnedQueryLabel}>Your question</Text>
                <Text style={styles.pinnedQueryText} selectable>
                  {pinnedQuery.trim()}
                </Text>
              </View>
            )}

            {renderHistoryRow()}

            {showMindfulNudge && messages.length === 0 && !loading ? (
              <TouchableOpacity
                style={[styles.mindfulCard, styles.mindfulCardInModal]}
                onPress={onMindfulCardPress}
                activeOpacity={0.85}
              >
                <Text style={styles.mindfulCardTitle}>Daily Mindset</Text>
                <Text style={styles.mindfulCardBody}>
                  No mindful minutes logged today — tap for a 1-minute reset.
                </Text>
              </TouchableOpacity>
            ) : null}

            {!geminiReady ? (
              <Text style={[styles.configBanner, styles.modalNoticeBanner]}>{getGeminiSetupHint()}</Text>
            ) : null}
            {mindfulMeta.coachMock ? (
              <Text style={[styles.mockBanner, styles.modalNoticeBanner]}>
                Mock mindful minutes on — Settings → AI Coach (testing).
              </Text>
            ) : null}

            <View style={styles.modalBody}>
              {renderMessageList()}
            </View>

            <TouchableOpacity style={styles.humanBtn} onPress={requestHuman} activeOpacity={0.75}>
              <Text style={styles.humanBtnText}>Request Human Coach</Text>
            </TouchableOpacity>

            <View
              style={[
                styles.inputRow,
                {
                  paddingBottom: Math.max(
                    insets.bottom,
                    Platform.OS === 'android' ? keyboardHeight : 0,
                    10
                  ),
                },
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Message your coach…"
                placeholderTextColor={AppTheme.textFaint}
                value={input}
                onChangeText={setInput}
                editable={!loading}
                multiline
                maxLength={2000}
                returnKeyType="default"
                blurOnSubmit={false}
                textAlignVertical="top"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                onPress={send}
                disabled={!input.trim() || loading}
                activeOpacity={0.8}
              >
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  previewCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 136, 0.45)',
    padding: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  previewGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 255, 136, 0.06)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 136, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  previewIcon: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  previewTitleCol: {
    flex: 1,
  },
  previewTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  previewSubtitle: {
    color: AppTheme.accent,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  previewOpenPill: {
    backgroundColor: AppTheme.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  previewOpenPillText: {
    color: AppTheme.accentDark,
    fontSize: 13,
    fontWeight: '800',
  },
  modalHistoryWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  historyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: AppTheme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  historyScroll: {
    gap: 8,
    paddingRight: 4,
  },
  historyChip: {
    maxWidth: 220,
    backgroundColor: AppTheme.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyChipQuery: {
    fontSize: 13,
    lineHeight: 18,
    color: AppTheme.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyChipReply: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginBottom: 6,
  },
  historyChipWhen: {
    fontSize: 10,
    color: AppTheme.textFaint,
  },
  configBanner: {
    fontSize: 11,
    lineHeight: 15,
    color: '#fbbf24',
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  mockBanner: {
    fontSize: 11,
    lineHeight: 15,
    color: '#fbbf24',
    fontWeight: '600',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  mindfulCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
  },
  mindfulCardInModal: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  modalNoticeBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  mindfulCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: AppTheme.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mindfulCardBody: {
    fontSize: 12,
    lineHeight: 16,
    color: AppTheme.textSecondary,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalColumn: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  modalCloseBtn: {
    minWidth: 56,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalCloseText: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  modalTitleSub: {
    color: AppTheme.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  modalClearBtn: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modalClearText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  pinnedQueryBar: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.35)',
  },
  pinnedQueryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: AppTheme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pinnedQueryText: {
    fontSize: 16,
    lineHeight: 23,
    color: AppTheme.textPrimary,
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
  },
  modalMessages: {
    flex: 1,
  },
  modalMessagesContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalEmpty: {
    paddingVertical: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  modalEmptyTitle: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalEmptyBody: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  stateOfMindBanner: {
    marginTop: 16,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(77, 171, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.35)',
  },
  stateOfMindLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7ec8ff',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stateOfMindText: {
    fontSize: 13,
    lineHeight: 18,
    color: AppTheme.textSecondary,
  },
  row: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowCoach: {
    justifyContent: 'flex-start',
  },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  coachAvatarText: {
    fontSize: 10,
    fontWeight: '900',
    color: AppTheme.accent,
  },
  coachRoleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: AppTheme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  userRoleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7ec8ff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    textAlign: 'right',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: 'rgba(0, 255, 136, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
  },
  bubbleCoach: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  bubbleText: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  bubbleTextUser: {
    color: AppTheme.textPrimary,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingLabel: {
    marginLeft: 10,
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  humanBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  humanBtnText: {
    color: '#4dabf7',
    fontSize: 13,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 12,
    backgroundColor: '#111',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    backgroundColor: AppTheme.inputBg,
    color: AppTheme.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: AppTheme.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: AppTheme.accentDark,
    fontWeight: '800',
    fontSize: 14,
  },
});
