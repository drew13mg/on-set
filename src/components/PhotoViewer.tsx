import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PhotoImage } from "@/components/PhotoImage";
import type { LocationPhotoRow } from "@/lib/sync/model";
import { clampIndex } from "@/lib/scouting";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Props = {
  photos: LocationPhotoRow[];
  /** Index to open at; null = closed. */
  startIndex: number | null;
  onClose: () => void;
  onEditNote: (photo: LocationPhotoRow) => void;
};

/** Pinching in past this scale closes full screen. */
const CLOSE_SCALE = 0.82;

function BackArrow() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="M12 19l-7-7 7-7" />
    </Svg>
  );
}

/** Where a "contain"-fitted photo actually sits on screen. */
function fittedRect(photo: LocationPhotoRow, width: number, height: number) {
  const iw = photo.width || width;
  const ih = photo.height || height;
  const k = Math.min(width / iw, height / ih);
  const w = iw * k;
  const h = ih * k;
  return { left: (width - w) / 2, top: (height - h) / 2, width: w, height: h };
}

/** One full-screen photo that follows a two-finger pinch; pinching in closes the viewer. The note sits on the photo. */
function Page({ photo, width, height, onPinchClose }: { photo: LocationPhotoRow; width: number; height: number; onPinchClose: () => void }) {
  const insets = useSafeAreaInsets();
  const rect = fittedRect(photo, width, height);
  const noteBottom = Math.max(height - (rect.top + rect.height) + space.md, insets.bottom + space.lg);
  const noteSide = Math.max(rect.left + space.md, space.md);
  const scale = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.4, Math.min(3, e.scale));
    })
    .onEnd(() => {
      if (scale.value < CLOSE_SCALE) {
        scale.value = withTiming(0.3, { duration: 140 });
        runOnJS(onPinchClose)();
      } else {
        scale.value = withSpring(1, { damping: 18, stiffness: 180 });
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: Math.min(1, 0.4 + scale.value) }));

  return (
    <GestureDetector gesture={pinch}>
      <Animated.View style={[{ width, height }, style]}>
        <PhotoImage photo={photo} fit="contain" style={{ width, height, backgroundColor: "transparent" }} />
        {photo.note ? (
          <View pointerEvents="none" style={[styles.note, { left: noteSide, right: noteSide, bottom: noteBottom }]}>
            <Text style={styles.noteText}>{photo.note}</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

/** Full-screen photos: swipe left/right to move, pinch in or tap the back arrow to exit. */
export function PhotoViewer({ photos, startIndex, onClose, onEditNote }: Props) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex ?? 0);
  const listRef = useRef<FlatList<LocationPhotoRow>>(null);
  const visible = startIndex !== null && photos.length > 0;

  useEffect(() => {
    if (startIndex !== null) setIndex(clampIndex(startIndex, photos.length));
  }, [startIndex, photos.length]);

  // Close if every photo is gone (e.g. a teammate deleted them).
  useEffect(() => {
    if (visible && photos.length === 0) onClose();
  }, [visible, photos.length, onClose]);

  // Track the photo in view while swiping (not just when the swipe settles).
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = clampIndex(Math.round(e.nativeEvent.contentOffset.x / width), photos.length);
      setIndex((cur) => (cur === i ? cur : i));
    },
    [width, photos.length],
  );

  const current = photos[clampIndex(index, photos.length)];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait", "landscape"]}>
      <GestureHandlerRootView style={styles.root}>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={clampIndex(startIndex ?? 0, photos.length)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={onScroll}
          scrollEventThrottle={32}
          renderItem={({ item }) => <Page photo={item} width={width} height={height} onPinchClose={onClose} />}
          accessibilityLabel="Photos, swipe left or right"
        />

        {/* Top bar: back arrow (top left), position, note */}
        <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <BackArrow />
          </Pressable>
          <Text style={styles.counter}>
            {clampIndex(index, photos.length) + 1} / {photos.length}
          </Text>
          <Pressable
            onPress={() => current && onEditNote(current)}
            hitSlop={12}
            style={styles.noteBtn}
            accessibilityRole="button"
          >
            <Text style={[type.label, { color: colors.text }]}>{current?.note ? "Edit note" : "Add note"}</Text>
          </Pressable>
        </SafeAreaView>

      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,13,17,0.55)",
    marginTop: space.sm,
  },
  counter: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    backgroundColor: "rgba(10,13,17,0.55)",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: space.sm,
  },
  noteBtn: {
    paddingHorizontal: space.md,
    height: 36,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(10,13,17,0.55)",
    marginTop: space.sm,
  },
  note: { position: "absolute", backgroundColor: "rgba(10,13,17,0.72)", borderRadius: radius.md, padding: space.md },
  noteText: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.text },
});
