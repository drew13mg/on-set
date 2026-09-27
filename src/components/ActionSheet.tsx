import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, space, type } from "@/lib/theme";

export type SheetAction = { label: string; onPress: () => void; destructive?: boolean };

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
};

/** Bottom menu of choices (used for press-and-hold options). Works the same on iOS, Android and web. */
export function ActionSheet({ visible, title, message, actions, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait", "landscape"]}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <SafeAreaView edges={["bottom"]} style={styles.wrap}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {title || message ? (
              <View style={styles.header}>
                {title ? <Text style={[type.heading, styles.center]} numberOfLines={2}>{title}</Text> : null}
                {message ? <Text style={[type.small, styles.center]}>{message}</Text> : null}
              </View>
            ) : null}
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}
                accessibilityRole="button"
              >
                <Text style={[type.button, { color: a.destructive ? colors.record : colors.text }]}>{a.label}</Text>
              </Pressable>
            ))}
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && { backgroundColor: colors.surfaceRaised }]}
            accessibilityRole="button"
          >
            <Text style={[type.button, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,13,17,0.72)", justifyContent: "flex-end" },
  wrap: { padding: space.md, gap: space.sm },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  header: {
    padding: space.lg,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  center: { textAlign: "center" },
  row: {
    alignItems: "center",
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
});
