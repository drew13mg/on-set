import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PromptModal } from "@/components/PromptModal";
import { ProjectHeaderRight } from "@/components/SettingsButton";
import { useProjectClips } from "@/lib/clips-store";
import { useProjectEquipment } from "@/lib/equipment-store";
import { useProjectTranscriptions } from "@/lib/transcriptions-store";
import { useLocations } from "@/lib/scouting-store";
import { useActiveShotList, useShotLists } from "@/lib/shots-store";
import { progress } from "@/lib/equipment";
import { useCurrentProject, useProjects } from "@/lib/projects-store";
import { useNow } from "@/lib/useNow";
import { formatTimeOfDay } from "@/lib/clips";
import { colors, radius, space, type } from "@/lib/theme";

type ToolRoute = "/project/[id]/transcribe" | "/project/[id]/clips" | "/project/[id]/sun" | "/project/[id]/equipment" | "/project/[id]/locations" | "/project/[id]/shot-lists";
type Tool = { title: string; description: string; route: ToolRoute; meta?: string };

/** A project's tools. New ON SET tools get added to the list below. */
export default function ProjectHome() {
  const { id, project } = useCurrentProject();
  const { renameProject } = useProjects();
  const { clips } = useProjectClips(id);
  const { list: transcriptions } = useProjectTranscriptions(id);
  const { locations } = useLocations(id);
  const { lists: shotLists } = useShotLists(id);
  const { list: activeShots } = useActiveShotList(id);
  const { list: gear, reload: reloadGear } = useProjectEquipment(id);
  useFocusEffect(useCallback(() => reloadGear(), [reloadGear]));
  const gearProgress = progress(gear);
  const now = useNow();
  const [renaming, setRenaming] = useState(false);

  const tools: Tool[] = [
    {
      title: "Transcribe",
      description: "Named transcriptions with Mark In / Mark Out at time of day. Email transcript + clips.",
      route: "/project/[id]/transcribe",
      meta: transcriptions.length ? `${transcriptions.length} saved` : undefined,
    },
    {
      title: "Clips",
      description: "Every clip in the project, grouped by transcription.",
      route: "/project/[id]/clips",
      meta: clips.length === 1 ? "1 saved" : `${clips.length} saved`,
    },
    {
      title: "Sun Tracker",
      description: "Where the sun will be at any time and date, with live weather on location.",
      route: "/project/[id]/sun",
    },
    {
      title: "Equipment",
      description: "Build the gear list from saved equipment, then check items off as they arrive.",
      route: "/project/[id]/equipment",
      meta: gearProgress.total ? `${gearProgress.have}/${gearProgress.total} checked` : undefined,
    },
    {
      title: "Location Scouting",
      description: "Places you're considering: up to 10 photos each, photo notes and location notes.",
      route: "/project/[id]/locations",
      meta: locations.length ? (locations.length === 1 ? "1 location" : `${locations.length} locations`) : undefined,
    },
    {
      title: "Shot List",
      description: "Numbered shot tiles; start a list, then mark shots active and done as you shoot.",
      route: "/project/[id]/shot-lists",
      meta: activeShots ? `Active: ${activeShots.name}` : shotLists.length ? `${shotLists.length} list${shotLists.length === 1 ? "" : "s"}` : undefined,
    },
  ];

  if (!project) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={[type.body, { color: colors.muted, marginTop: space.xl }]}>This project no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <ProjectHeaderRight projectId={id}>
              <Text style={[type.time, { color: colors.muted }]}>{formatTimeOfDay(now)}</Text>
            </ProjectHeaderRight>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => setRenaming(true)} style={styles.titleRow} accessibilityHint="Rename project">
          <Text style={[type.title, styles.title]} numberOfLines={2}>
            {project.name}
          </Text>
          <Text style={[type.label, { color: colors.text }]}>Rename</Text>
        </Pressable>

        <Text style={[type.label, styles.section]}>Tools</Text>
        <View style={styles.list}>
          {tools.map((t) => (
            <Pressable
              key={t.title}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: t.route, params: { id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardTop}>
                <Text style={type.heading}>{t.title}</Text>
                {t.meta ? <Text style={type.small}>{t.meta}</Text> : null}
              </View>
              <Text style={[type.small, styles.cardBody]}>{t.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <PromptModal
        visible={renaming}
        title="Rename project"
        initialValue={project.name}
        onCancel={() => setRenaming(false)}
        onSave={(name) => {
          renameProject(id, name);
          setRenaming(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  content: { paddingBottom: space.xxl },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingTop: space.sm, paddingBottom: space.xl },
  title: { flex: 1, letterSpacing: 0.5 },
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
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardBody: { marginTop: space.xs, lineHeight: 19 },
});
