/**
 * Searchable exercise catalog picker for correcting / substituting exercise names.
 * User picks a catalog row (or custom name), then taps Save so the change always commits.
 */
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from '../AppTextInput';
import { AppTheme } from '../../theme/appVisualTheme';
import { searchExerciseCatalog } from '../../utils/exerciseNameMatch';

type Props = {
  visible: boolean;
  /** Seed for search (OCR text, current exercise name, etc.). */
  rawName: string;
  currentName: string;
  suggestions?: string[];
  /** Optional hint under the title (e.g. "From photo: …"). */
  contextHint?: string;
  saveLabel?: string;
  onClose: () => void;
  onSelect: (name: string) => void;
};

export default function ExerciseNamePickerModal({
  visible,
  rawName,
  currentName,
  suggestions = [],
  contextHint,
  saveLabel = 'Save',
  onClose,
  onSelect,
}: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [pendingName, setPendingName] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!visible) return;
    const seed = rawName?.trim() || currentName?.trim() || '';
    setQuery(seed);
    setPendingName(currentName?.trim() || seed);
  }, [visible, rawName, currentName]);

  const results = useMemo(
    () => searchExerciseCatalog(deferredQuery, 50),
    [deferredQuery]
  );

  const quickPicks = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of suggestions) {
      const key = name.toLowerCase();
      if (!name.trim() || seen.has(key) || key === currentName.toLowerCase()) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= 6) break;
    }
    return out;
  }, [suggestions, currentName]);

  const customName = query.trim();
  const showCustom =
    Boolean(customName) &&
    !results.some((n) => n.toLowerCase() === customName.toLowerCase());

  const canSave = Boolean(pendingName.trim());
  const hint =
    contextHint ??
    (rawName.trim() && rawName.trim().toLowerCase() !== currentName.trim().toLowerCase()
      ? `From photo: ${rawName.trim()}`
      : rawName.trim()
        ? `Current: ${rawName.trim()}`
        : '');

  const commit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSelect(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Change exercise</Text>
          <View style={styles.headerSpacer} />
        </View>

        {hint ? (
          <Text style={styles.rawHint} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t.trim()) setPendingName(t.trim());
            }}
            placeholder="Search exercises…"
            placeholderTextColor={AppTheme.textFaint}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        {quickPicks.length > 0 ? (
          <View style={styles.quickBlock}>
            <Text style={styles.quickLabel}>Suggested matches</Text>
            <View style={styles.chipRow}>
              {quickPicks.map((name) => {
                const selected = name.toLowerCase() === pendingName.toLowerCase();
                return (
                  <Pressable
                    key={name}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => {
                      setPendingName(name);
                      setQuery(name);
                    }}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextSelected]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {showCustom ? (
          <TouchableOpacity
            style={[
              styles.customRow,
              customName.toLowerCase() === pendingName.toLowerCase() && styles.customRowSelected,
            ]}
            onPress={() => setPendingName(customName)}
            activeOpacity={0.85}
          >
            <Text style={styles.customTitle}>Use custom name</Text>
            <Text style={styles.customName} numberOfLines={1}>
              {customName}
            </Text>
          </TouchableOpacity>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>No catalog matches. Type a custom name above, then Save.</Text>
          }
          renderItem={({ item }) => {
            const selected = item.toLowerCase() === pendingName.toLowerCase();
            return (
              <TouchableOpacity
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => {
                  setPendingName(item);
                  setQuery(item);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.rowText, selected && styles.rowTextSelected]} numberOfLines={2}>
                  {item}
                </Text>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.footer}>
          <Text style={styles.footerPreview} numberOfLines={1}>
            {pendingName.trim() ? `Selected: ${pendingName.trim()}` : 'Select an exercise'}
          </Text>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={() => commit(pendingName)}
            disabled={!canSave}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
          >
            <Text style={styles.saveBtnText}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
  },
  cancel: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 64,
  },
  title: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: { minWidth: 64 },
  rawHint: {
    color: AppTheme.textFaint,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  search: {
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: AppTheme.textPrimary,
    fontSize: 16,
  },
  quickBlock: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickLabel: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipSelected: {
    borderColor: AppTheme.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
  },
  chipText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: AppTheme.accent,
  },
  customRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.35)',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  customRowSelected: {
    borderColor: AppTheme.accent,
  },
  customTitle: {
    color: AppTheme.accent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  customName: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  empty: {
    color: AppTheme.textFaint,
    textAlign: 'center',
    padding: 24,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  rowSelected: {
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
  },
  rowText: {
    flex: 1,
    color: AppTheme.textPrimary,
    fontSize: 15,
  },
  rowTextSelected: {
    color: AppTheme.accent,
    fontWeight: '700',
  },
  check: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppTheme.bgElevated,
    gap: 10,
  },
  footerPreview: {
    color: AppTheme.textMuted,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: AppTheme.radiusButton,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: AppTheme.accentDark,
    fontSize: 16,
    fontWeight: '800',
  },
});
