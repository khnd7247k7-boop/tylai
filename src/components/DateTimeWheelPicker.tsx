import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollWheelPicker } from './ScrollWheelPicker';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const PERIODS = ['AM', 'PM'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDate(date: Date, maximumDate: Date): Date {
  if (date.getTime() > maximumDate.getTime()) return new Date(maximumDate);
  return date;
}

function buildYearOptions(maximumDate: Date): number[] {
  const maxYear = maximumDate.getFullYear();
  const minYear = maxYear - 3;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y += 1) years.push(y);
  return years;
}

function toHour24(hour12: number, period: string): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

interface DateTimeWheelPickerProps {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
}

export function DateTimeWheelPicker({
  value,
  onChange,
  maximumDate = new Date(),
}: DateTimeWheelPickerProps) {
  const years = useMemo(() => buildYearOptions(maximumDate), [maximumDate.getFullYear()]);
  const month = value.getMonth();
  const year = value.getFullYear();
  const day = value.getDate();
  const days = useMemo(
    () => Array.from({ length: daysInMonth(year, month) }, (_, i) => String(i + 1)),
    [year, month]
  );

  const hour24 = value.getHours();
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const minute = value.getMinutes();

  const update = (patch: Partial<{ year: number; month: number; day: number; hour24: number; minute: number }>) => {
    const next = new Date(value);
    const y = patch.year ?? next.getFullYear();
    const m = patch.month ?? next.getMonth();
    const maxDay = daysInMonth(y, m);
    const d = Math.min(patch.day ?? next.getDate(), maxDay);
    next.setFullYear(y, m, d);
    const h = patch.hour24 ?? next.getHours();
    const min = patch.minute ?? next.getMinutes();
    next.setHours(h, min, 0, 0);
    onChange(clampDate(next, maximumDate));
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <ScrollWheelPicker
          items={MONTHS}
          selectedIndex={month}
          onSelect={(index) => update({ month: index, day: Math.min(day, daysInMonth(year, index)) })}
          width={64}
        />
        <ScrollWheelPicker
          items={days}
          selectedIndex={Math.min(day - 1, days.length - 1)}
          onSelect={(index) => update({ day: index + 1 })}
          width={52}
        />
        <ScrollWheelPicker
          items={years.map(String)}
          selectedIndex={Math.max(0, years.indexOf(year))}
          onSelect={(index) => {
            const nextYear = years[index];
            update({ year: nextYear, day: Math.min(day, daysInMonth(nextYear, month)) });
          }}
          width={72}
        />
      </View>
      <View style={styles.timeRow}>
        <ScrollWheelPicker
          items={HOURS_12}
          selectedIndex={hour12 - 1}
          onSelect={(index) => update({ hour24: toHour24(index + 1, period) })}
          width={52}
        />
        <Text style={styles.colon}>:</Text>
        <ScrollWheelPicker
          items={MINUTES}
          selectedIndex={minute}
          onSelect={(index) => update({ minute: index })}
          width={52}
        />
        <ScrollWheelPicker
          items={PERIODS}
          selectedIndex={period === 'PM' ? 1 : 0}
          onSelect={(index) => update({ hour24: toHour24(hour12, PERIODS[index]) })}
          width={64}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  colon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 2,
  },
});
