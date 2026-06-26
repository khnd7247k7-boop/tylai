import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export interface KeyboardInsetsValue {
  /** Current keyboard height in px (0 when hidden) */
  keyboardHeight: number;
}

const defaultValue: KeyboardInsetsValue = { keyboardHeight: 0 };

const KeyboardInsetsContext = createContext<KeyboardInsetsValue>(defaultValue);

/**
 * Global keyboard height (single listener tree-wide). Use for modals, bottom sheets,
 * and any layout that must sit above the keyboard on Android (overlays do not resize).
 */
export function KeyboardInsetsProvider({ children }: { children: React.ReactNode }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const value = useMemo(() => ({ keyboardHeight }), [keyboardHeight]);

  return (
    <KeyboardInsetsContext.Provider value={value}>{children}</KeyboardInsetsContext.Provider>
  );
}

export function useKeyboardInsets(): KeyboardInsetsValue {
  return useContext(KeyboardInsetsContext);
}
