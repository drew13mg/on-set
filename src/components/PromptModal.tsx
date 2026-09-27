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
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  saveLabel?: string;
  /** Several lines of text (notes). */
  multiline?: boolean;
  /** Character limit, with a live counter. */
  maxLength?: number;
  onSave: (value: string) => void;
  onCancel: () => void;
};

/** Small pop-up asking for one line of text (project name, rename, ...). */
export function PromptModal({
  visible,
  title,
  message,
  placeholder,
  initialValue = "",
  saveLabel = "Save",
  multiline = false,
  maxLength,
  onSave,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent supportedOrientations={["portrait", "landscape"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={type.heading}>{title}</Text>
          {message ? <Text style={type.small}>{message}</Text> : null}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            autoFocus
            selectTextOnFocus={!multiline}
            multiline={multiline}
            returnKeyType={multiline ? "default" : "done"}
            onSubmitEditing={multiline ? undefined : () => onSave(value)}
            style={[styles.input, multiline && styles.multiline]}
            maxLength={maxLength}
            accessibilityLabel={title}
          />
          {maxLength ? (
            <Text style={[type.small, styles.counter, value.length >= maxLength && { color: colors.markOut }]}>
              {value.length} / {maxLength}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.btn, styles.ghost, pressed && styles.pressed]}>
              <Text style={[type.button, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
              style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
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
  backdrop: { flex: 1, backgroundColor: "rgba(10,13,17,0.72)", justifyContent: "center", padding: space.lg },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.xl,
    gap: space.lg,
  },
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
  multiline: { minHeight: 140, maxHeight: 280, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", marginTop: -space.sm, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: space.md },
  btn: { flex: 1, alignItems: "center", paddingVertical: space.md, borderRadius: radius.md },
  ghost: { backgroundColor: colors.surfaceRaised },
  primary: { backgroundColor: colors.accent },
  pressed: { opacity: 0.8 },
});
