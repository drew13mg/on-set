import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { addDays, formatDateKey, type DateKey } from "@/lib/tz";
import { colors, radius, space, type } from "@/lib/theme";

type Props = {
  value: DateKey;
  today: DateKey;
  onChange: (key: DateKey) => void;
};

const toDate = (key: DateKey) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Day stepper with a calendar on tap (iOS / Android). */
export function DateRow({ value, today, onChange }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(toDate(value));

  const openCalendar = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: "date",
        onChange: (e, d) => {
          if (e.type === "set" && d) onChange(toKey(d));
        },
      });
    } else if (Platform.OS === "ios") {
      setDraft(toDate(value));
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(addDays(value, -1))} hitSlop={8} style={styles.step} accessibilityLabel="Previous day">
        <Text style={[type.heading, styles.chev]}>‹</Text>
      </Pressable>
      <Pressable onPress={openCalendar} style={styles.center} accessibilityLabel="Choose date">
        <Text style={type.heading}>{formatDateKey(value)}</Text>
        {value !== today ? (
          <Pressable onPress={() => onChange(today)} hitSlop={8}>
            <Text style={[type.label, { color: colors.text }]}>Today</Text>
          </Pressable>
        ) : (
          <Text style={type.label}>Today</Text>
        )}
      </Pressable>
      <Pressable onPress={() => onChange(addDays(value, 1))} hitSlop={8} style={styles.step} accessibilityLabel="Next day">
        <Text style={[type.heading, styles.chev]}>›</Text>
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                themeVariant="dark"
                accentColor={colors.sun}
                onChange={(_e, d) => d && setDraft(d)}
              />
              <Pressable
                onPress={() => {
                  onChange(toKey(draft));
                  setIosOpen(false);
                }}
                style={styles.done}
              >
                <Text style={[type.button, { color: colors.bg }]}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  step: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  chev: { fontSize: 26, lineHeight: 28, color: colors.muted },
  center: { flex: 1, alignItems: "center", gap: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(10,13,17,0.72)", justifyContent: "center", padding: space.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  done: {
    marginTop: space.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
