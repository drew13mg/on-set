import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import type { LocationPhotoRow } from "@/lib/sync/model";
import { usePhotoSource } from "@/lib/photo-sync";
import { colors, space, type } from "@/lib/theme";

type Props = {
  photo: LocationPhotoRow;
  fit?: ImageContentFit;
  style?: object;
  /** Small "note" badge on thumbnails. */
  showNoteBadge?: boolean;
};

/** A location photo from this phone or the cloud, with a placeholder while a teammate's upload finishes. */
export function PhotoImage({ photo, fit = "cover", style, showNoteBadge }: Props) {
  const { source, waiting } = usePhotoSource(photo);
  return (
    <View style={[styles.box, style]}>
      {source ? (
        <Image source={source} contentFit={fit} style={StyleSheet.absoluteFill} transition={150} cachePolicy="disk" accessibilityLabel={photo.note || "Location photo"} />
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.faint} />
          {waiting ? <Text style={[type.small, { color: colors.faint, fontSize: 11 }]}>Uploading…</Text> : null}
        </View>
      )}
      {showNoteBadge && photo.note ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>NOTE</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: colors.surfaceRaised },
  placeholder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: space.xs },
  badge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(10,13,17,0.75)",
  },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
});
