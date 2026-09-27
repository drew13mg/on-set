import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { resizeTarget } from "./scouting";

const isWeb = Platform.OS === "web";
const photosDir = () => new Directory(Paths.document, "location-photos");

/** Shrink a picked/taken photo so its longest edge is 2048px, saved as JPEG. */
export async function preparePhoto(uri: string, width: number, height: number) {
  const ctx = ImageManipulator.manipulate(uri);
  const target = resizeTarget(width, height);
  if (target) ctx.resize(target);
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Keep the photo in the app's own storage so it survives restarts and works offline. */
export async function keepPhotoOnDevice(tempUri: string, photoId: string): Promise<string> {
  if (isWeb) return tempUri;
  const dir = photosDir();
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${photoId}.jpg`);
  if (dest.exists) dest.delete();
  await new File(tempUri).copy(dest);
  return dest.uri;
}

export function photoExistsOnDevice(uri: string | undefined): boolean {
  if (!uri) return false;
  if (isWeb) return true;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export async function readPhotoBytes(uri: string): Promise<Uint8Array> {
  if (isWeb) return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return new File(uri).bytes();
}

export function deletePhotoFromDevice(uri: string | undefined) {
  if (!uri || isWeb) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

/** Remove every stored photo file (sign out). */
export function clearPhotosFromDevice() {
  if (isWeb) return;
  try {
    const dir = photosDir();
    if (dir.exists) dir.delete();
  } catch {}
}
