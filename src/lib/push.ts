// Push notifications for shot updates (Done / Active), sent by the server to everyone on a
// project except whoever made the change. This file handles the device side: permission,
// registering the device's Expo push token, the Android channel, and opening the right
// shot list when a notification is tapped.
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { supabase } from "./supabase";

const supported = Platform.OS === "ios" || Platform.OS === "android";
export const SHOT_CHANNEL = "shots";

let currentToken: string | null = null;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(SHOT_CHANNEL, {
    name: "Shot updates",
    description: "When someone marks a shot done or active",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
  });
}

/** The EAS project ID, written into app.json by `eas init`. */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function register(): Promise<boolean> {
  const projectId = easProjectId();
  if (!projectId) {
    console.warn("[push] No EAS project ID yet. Run `eas init` so devices can get push tokens.");
    return false;
  }
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc("register_push_token", { push_token: token, device_platform: Platform.OS });
    if (error) throw error;
    currentToken = token;
    return true;
  } catch (e) {
    console.warn("[push] Couldn't register for notifications", e);
    return false;
  }
}

export type PushPermission = "granted" | "undetermined" | "denied" | "unsupported";

export async function pushPermission(): Promise<PushPermission> {
  if (!supported) return "unsupported";
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

/**
 * Ask to send shot notifications (shows the system prompt the first time) and register this device.
 * Returns the resulting permission.
 */
export async function enableShotNotifications(): Promise<PushPermission> {
  if (!supported) return "unsupported";
  await ensureChannel(); // Android 13+ only shows the prompt once a channel exists
  let perm = await pushPermission();
  if (perm === "undetermined") {
    const r = await Notifications.requestPermissionsAsync();
    perm = r.granted ? "granted" : r.canAskAgain ? "undetermined" : "denied";
  }
  if (perm === "granted") await register();
  return perm;
}

/** On sign-out: stop this device getting the signed-out person's notifications. */
export async function unregisterPush() {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  await supabase.rpc("unregister_push_token", { push_token: token }).then(
    () => {},
    () => {},
  );
}

function openFromNotification(n: Notifications.Notification) {
  const url = n.request.content.data?.url;
  if (typeof url === "string" && url.startsWith("/project/")) router.push(url as never);
}

/**
 * Root-level: while signed in, keep this device registered (if notifications are already
 * allowed) and open the shot list when a notification is tapped.
 */
export function usePushNotifications(signedInUserId: string | null) {
  useEffect(() => {
    if (!supported || !signedInUserId) return;
    let cancelled = false;
    (async () => {
      if ((await pushPermission()) === "granted" && !cancelled) {
        await ensureChannel();
        await register();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedInUserId]);

  useEffect(() => {
    if (!supported) return;
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) openFromNotification(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => openFromNotification(r.notification));
    return () => sub.remove();
  }, []);
}

/** Whether shot notifications are on for a project (per person; stored on the server). */
export function useShotNotifications(projectId: string, enabled: boolean) {
  const [muted, setMuted] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabase
      .from("notification_mutes")
      .select("project_id")
      .eq("project_id", projectId)
      .then(({ data, error }) => {
        if (!cancelled && !error) setMuted((data ?? []).length > 0);
      });
    pushPermission().then((p) => !cancelled && setPermission(p));
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled]);

  const setOn = useCallback(
    async (on: boolean) => {
      setMuted(!on);
      if (on) setPermission(await enableShotNotifications());
      const { error } = on
        ? await supabase.from("notification_mutes").delete().eq("project_id", projectId)
        : await supabase.from("notification_mutes").upsert({ project_id: projectId }, { ignoreDuplicates: true });
      if (error) setMuted(on); // put the switch back
    },
    [projectId],
  );

  return { on: muted == null ? null : !muted, permission, setOn };
}
