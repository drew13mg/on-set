import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, space } from "@/lib/theme";

export function GearIcon({ size = 22, color = colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

/** Project settings, always in the top-right corner of every project screen. */
export function SettingsButton({ projectId }: { projectId: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/project/[id]/settings", params: { id: projectId } })}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Project settings"
      style={({ pressed }) => [styles.gear, pressed && { opacity: 0.6 }]}
    >
      <GearIcon />
    </Pressable>
  );
}

/** A screen's own header buttons, with the settings button always last (far right). */
export function ProjectHeaderRight({ projectId, children }: { projectId: string; children?: ReactNode }) {
  return (
    <View style={styles.row}>
      {children}
      <SettingsButton projectId={projectId} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  gear: { paddingLeft: space.xs, paddingRight: space.sm },
});
