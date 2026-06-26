import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from './AppTextInput';
import { AppTheme } from '../theme/appVisualTheme';
import { getCoachResponse } from '../services/geminiService';
import { PremiumRequiredError } from '../utils/subscription';
import { useToast } from './ToastProvider';
import { sanitizeCoachHealthContext } from '../utils/healthContextPrivacy';

export type CoachChatMessage = { id: string; role: 'user' | 'coach'; text: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface AICoachChatProps {
  healthData: Record<string, unknown>;
  dailyMindsetPrompt?: string | null;
  onInputFocus?: () => void;
}

export const AICoachChat: React.FC<AICoachChatProps> = ({ healthData, dailyMindsetPrompt, onInputFocus }) => {
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef<CoachChatMessage[]>([]);
  messagesRef.current = messages;

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
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [messages, loading, dailyMindsetPrompt]);

  const sendWithText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: CoachChatMessage = { id: newId(), role: 'user', text: trimmed };
      const priorForApi = messagesRef.current.map((m) => ({ role: m.role, text: m.text }));
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
    [loading, safeHealth, mindfulMeta.mindfulMinutesForModel]
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
    void sendWithText('Give me a 1-minute mindfulness exercise.');
  }, [sendWithText]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.card}>
        <Text style={styles.welcome}>
          Ask about training, recovery, or habits. Replies use your dashboard and Health snapshot when available.
        </Text>
        {mindfulMeta.coachMock && (
          <Text style={styles.mockBanner}>Mock mindful minutes are on — change this in Settings → AI Coach (testing).</Text>
        )}
        {!!dailyMindsetPrompt?.trim() && (
          <View style={styles.stateOfMindBanner}>
            <Text style={styles.stateOfMindLabel}>State of mind</Text>
            <Text style={styles.stateOfMindText}>{dailyMindsetPrompt.trim()}</Text>
          </View>
        )}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowCoach]}
            >
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
                <Text
                  selectable
                  style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}
                >
                  {m.text}
                </Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={[styles.row, styles.rowCoach]}>
              <View style={[styles.bubble, styles.bubbleCoach, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color={AppTheme.accent} />
                <Text style={styles.thinkingLabel}>Thinking…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.humanBtn}
          onPress={requestHuman}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        >
          <Text style={styles.humanBtnText}>Request Human Coach</Text>
        </TouchableOpacity>

        {showMindfulNudge && (
          <TouchableOpacity style={styles.mindfulCard} onPress={onMindfulCardPress} activeOpacity={0.85}>
            <Text style={styles.mindfulCardTitle}>Daily Mindset</Text>
            <Text style={styles.mindfulCardBody}>
              You haven't logged any mindful minutes today. Want a 1-minute reset?
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message your coach…"
            placeholderTextColor={AppTheme.textFaint}
            value={input}
            onChangeText={setInput}
            onFocus={onInputFocus}
            editable={!loading}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
            textAlignVertical="top"
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
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    overflow: 'hidden',
  },
  welcome: {
    fontSize: 12,
    lineHeight: 16,
    color: AppTheme.textMuted,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  mockBanner: {
    fontSize: 11,
    lineHeight: 15,
    color: '#fbbf24',
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  stateOfMindBanner: {
    marginHorizontal: 10,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    letterSpacing: 0.4,
  },
  stateOfMindText: {
    fontSize: 12,
    lineHeight: 16,
    color: AppTheme.textSecondary,
  },
  messages: {
    maxHeight: 280,
    minHeight: 160,
  },
  messagesContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  row: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowCoach: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bubbleUser: {
    backgroundColor: 'rgba(0, 255, 136, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.45)',
  },
  bubbleCoach: {
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  bubbleText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 12,
    fontWeight: '600',
  },
  humanBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  humanBtnText: {
    color: '#4dabf7',
    fontSize: 12,
    fontWeight: '700',
  },
  mindfulCard: {
    marginHorizontal: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: AppTheme.bgElevated,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: AppTheme.bgElevated,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    backgroundColor: AppTheme.inputBg,
    color: AppTheme.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: AppTheme.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: AppTheme.accentDark,
    fontWeight: '800',
    fontSize: 13,
  },
});
