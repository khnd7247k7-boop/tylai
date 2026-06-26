import { Keyboard } from 'react-native';

export function dismissKeyboard(): void {
  Keyboard.dismiss();
}

/**
 * Use as `Pressable` / `TouchableWithoutFeedback` `onPress` on a full-screen wrapper
 * so taps that are not handled by a focused field or deeper control dismiss the keyboard.
 * (Same effect as {@link dismissKeyboard}; named for readability at callsites.)
 */
export function tapOutsideToDismissKeyboard(): void {
  Keyboard.dismiss();
}
