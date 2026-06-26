import React from 'react';
import { Platform, Text as RNText, type TextProps, type TextStyle, type StyleProp } from 'react-native';

type Props = TextProps & {
  /** When true (default), users can select and copy this text. */
  selectable?: boolean;
};

const WEB_SELECTABLE_STYLE =
  Platform.OS === 'web'
    ? ({
        userSelect: 'text',
        WebkitUserSelect: 'text',
      } as unknown as TextStyle)
    : ({} as TextStyle);

function mergeStyle(style: StyleProp<TextStyle>, selectable: boolean): StyleProp<TextStyle> {
  if (!selectable || Platform.OS !== 'web') return style;
  if (style == null) return WEB_SELECTABLE_STYLE;
  if (Array.isArray(style)) return [WEB_SELECTABLE_STYLE, ...style];
  return [WEB_SELECTABLE_STYLE, style];
}

/**
 * Text wrapper — `selectable` defaults to true so labels, notes, and coach copy can be copied.
 * Pass `selectable={false}` for decorative UI chrome.
 */
export function AppText({ selectable = true, style, ...rest }: Props) {
  return (
    <RNText selectable={selectable} style={mergeStyle(style, selectable)} {...rest} />
  );
}
