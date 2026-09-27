import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useClips } from "@/lib/clips-store";
import { useNow } from "@/lib/useNow";
import { formatTimeOfDay } from "@/lib/clips";
import { colors, radius, space, type } from "@/lib/theme";

type Tool = { title: string; description: string; href?: Href; meta?: string };

export default function Home() {
  const { clips } = useClips();
  const now = useNow();

  // New ON SET tools get added to this list as they're built.
  const tools: Tool[] = [
    {
      title: "Transcribe",
      description: "Live speech-to-text with Mark In / Mark Out at time of day.",
      href: "/transcribe",
    },
    {
      title: "Clips",
      description: "Named IN/OUT marks with the dialogue heard between them.",
      href: "/clips",
      meta: clips.length === 1 ? "1 saved" : `${clips.length} saved`,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={type.title}>ON SET</Text>
        <Text style={[type.time, styles.clock]}>{formatTimeOfDay(now)}</Text>
      </View>
      <Text style={[type.label, styles.section]}>Tools</Text>
      <View style={styles.list}>
        {tools.map((t) => (
          <Pressable
            key={t.title}
            accessibilityRole="button"
            disabled={!t.href}
            onPress={() => t.href && router.push(t.href)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed, !t.href && styles.cardDisabled]}
          >
            <View style={styles.cardTop}>
              <Text style={type.heading}>{t.title}</Text>
              {t.meta ? <Text style={type.small}>{t.meta}</Text> : null}
            </View>
            <Text style={[type.small, styles.cardBody]}>{t.description}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  clock: { color: colors.muted },
  section: { marginBottom: space.md },
  list: { gap: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardPressed: { backgroundColor: colors.surfaceRaised },
  cardDisabled: { opacity: 0.5 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardBody: { marginTop: space.xs, lineHeight: 19 },
});
