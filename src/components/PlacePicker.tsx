import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { currentPlace, LocationDeniedError, searchPlaces, type Place } from "@/lib/location";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Props = {
  visible: boolean;
  onPick: (place: Place) => void;
  onClose: () => void;
  canClose: boolean;
};

/** Choose where to track the sun: the phone's location, or a typed address / place. */
export function PlacePicker({ visible, onPick, onClose, canClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState<"gps" | "search" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMessage(null);
      setBusy(null);
    }
  }, [visible]);

  const useGps = async () => {
    setBusy("gps");
    setMessage(null);
    try {
      onPick(await currentPlace());
    } catch (e) {
      setMessage(
        e instanceof LocationDeniedError
          ? "Location access is off. Turn it on for ON SET in Settings, or type an address below."
          : "Couldn't get your location. Try again or type an address.",
      );
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy("search");
    setMessage(null);
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (!found.length) setMessage("No matches. Try adding a city or country.");
    } catch {
      setMessage("Search isn't available right now. Check your connection.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={canClose ? onClose : undefined}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <Text style={type.heading}>Location</Text>
            {canClose ? (
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={[type.label, { color: colors.text }]}>Close</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={useGps}
            disabled={busy !== null}
            style={({ pressed }) => [styles.gpsBtn, pressed && { opacity: 0.85 }]}
          >
            {busy === "gps" ? <ActivityIndicator color={colors.bg} /> : null}
            <Text style={[type.button, { color: colors.bg }]}>Use current location</Text>
          </Pressable>

          <Text style={[type.label, styles.or]}>Or enter an address</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Address, city or landmark"
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              onSubmitEditing={search}
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Address"
            />
            <Pressable
              onPress={search}
              disabled={busy !== null}
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.85 }]}
            >
              {busy === "search" ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[type.button, { color: colors.text }]}>Find</Text>
              )}
            </Pressable>
          </View>

          {message ? <Text style={[type.small, styles.message]}>{message}</Text> : null}

          <FlatList
            data={results}
            keyExtractor={(p, i) => `${p.lat},${p.lon},${i}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.surfaceRaised }]}
              >
                <Text style={type.body}>{item.name}</Text>
                {item.subtitle ? <Text style={type.small}>{item.subtitle}</Text> : null}
              </Pressable>
            )}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.lg,
  },
  gpsBtn: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  or: { marginTop: space.xl, marginBottom: space.sm },
  searchRow: { flexDirection: "row", gap: space.sm },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  searchBtn: {
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    justifyContent: "center",
  },
  message: { marginTop: space.md, color: colors.markOut },
  result: {
    marginTop: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 2,
  },
});
