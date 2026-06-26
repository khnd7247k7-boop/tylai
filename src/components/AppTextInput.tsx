import React, { forwardRef } from 'react';
import {
  Platform,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';

/** Defaults that keep native copy / paste / cut / select / select-all working. */
export const APP_TEXT_INPUT_DEFAULTS = {
  contextMenuHidden: false,
  /** Keep focus & selection stable inside scroll views and swipe layouts. */
  rejectResponderTermination: true,
  /** Allow platform spell-check / autocorrect menus where applicable. */
  spellCheck: true,
} as const satisfies Partial<TextInputProps>;

const WEB_EDITABLE_STYLE =
  Platform.OS === 'web'
    ? ({
        userSelect: 'text',
        WebkitUserSelect: 'text',
        cursor: 'text',
      } as unknown as TextStyle)
    : ({} as TextStyle);

function mergeStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (Platform.OS !== 'web') return style;
  if (style == null) return WEB_EDITABLE_STYLE;
  if (Array.isArray(style)) return [WEB_EDITABLE_STYLE, ...style];
  return [WEB_EDITABLE_STYLE, style];
}

export const AppTextInput = forwardRef<RNTextInput, TextInputProps>(function AppTextInput(
  { contextMenuHidden, rejectResponderTermination, spellCheck, style, ...rest },
  ref
) {
  return (
    <RNTextInput
      ref={ref}
      {...APP_TEXT_INPUT_DEFAULTS}
      contextMenuHidden={contextMenuHidden ?? APP_TEXT_INPUT_DEFAULTS.contextMenuHidden}
      rejectResponderTermination={
        rejectResponderTermination ?? APP_TEXT_INPUT_DEFAULTS.rejectResponderTermination
      }
      spellCheck={spellCheck ?? APP_TEXT_INPUT_DEFAULTS.spellCheck}
      style={mergeStyle(style)}
      {...rest}
    />
  );
});
