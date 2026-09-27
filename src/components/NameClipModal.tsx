import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatDuration, formatTimeOfDay } from "@/lib/clips";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Props = {
  visible: boolean;
  title: string;
  inAt: number;
  outAt: number;
  defaultName: string;
  /** Pre-filled text (used when renaming an existing clip). */
  initialName?: string;
  saveLabel?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  cancelLabel?: string;
};

/** Pop-up shown after Mark Out (and for renaming) so the clip can be named. */
export function NameClipModal({
  visible,
  title,
  inAt,
  outAt,
  defaultName,
  initialName = "",
  saveLabel = "Save",
  cancelLabel = "Discard",
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const save = () => onSave(name);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <Text style={type.heading}>{title}</Text>

          <View style={styles.times}>
            <View style={styles.timeCol}>
              <Text style={[type.label, { color: colors.markIn }]}>In</Text>
              <Text style={type.time}>{formatTimeOfDay(inAt)}</Text>
            </View>
            <View style={styles.timeCol}>
              <Text style={[type.label, { color: colors.markOut }]}>Out</Text>
              <Text style={type.time}>{formatTimeOfDay(outAt)}</Text>
            </View>
            <View style={styles.timeCol}>
              <Text style={type.label}>Length</Text>
              <Text style={type.time}>{formatDuration(outAt - inAt)}</Text>
            </View>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={defaultName}
            placeholderTextColor={colors.faint}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={save}
            style={styles.input}
            accessibilityLabel="Clip name"
          />

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
            >
              <Text style={[type.button, { color: colors.muted }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={[type.button, { color: colors.bg }]}>{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 13, 17, 0.72)",
    justifyContent: "center",
    padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.xl,
    gap: space.lg,
  },
  times: { flexDirection: "row", justifyContent: "space-between" },
  timeCol: { gap: space.xs },
  input: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  actions: { flexDirection: "row", gap: space.md },
  btn: { flex: 1, alignItems: "center", paddingVertical: space.md, borderRadius: radius.md },
  btnGhost: { backgroundColor: colors.surfaceRaised },
  btnPrimary: { backgroundColor: colors.accent },
  pressed: { opacity: 0.8 },
});
