import { Linking, Platform, Share } from "react-native";
import * as MailComposer from "expo-mail-composer";

/**
 * Open an email with the given subject and plain-text body.
 * Uses the phone's mail app when set up; otherwise falls back to the share
 * sheet (Gmail, Outlook, Messages, Notes...) so the text can still go out.
 */
export async function emailText(subject: string, body: string): Promise<"mail" | "share" | "failed"> {
  try {
    if (Platform.OS === "web") {
      await Linking.openURL(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      return "mail";
    }
    if (await MailComposer.isAvailableAsync()) {
      await MailComposer.composeAsync({ subject, body });
      return "mail";
    }
    await Share.share({ title: subject, message: body }, { subject, dialogTitle: subject });
    return "share";
  } catch (e) {
    console.warn("Email failed", e);
    return "failed";
  }
}
