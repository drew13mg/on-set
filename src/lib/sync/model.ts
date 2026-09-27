// Shared-data model for sync. Pure (no React / network), tested in tests/sync.test.ts.
//
// Every synced row has an id (uuid), updatedMs (client time of last change) and a
// soft-delete flag so deletions reach other devices too.
import type { Place } from "../location-types.ts";

export type Synced = { id: string; updatedMs: number; deleted: boolean };

export type ProjectRow = Synced & {
  name: string;
  createdAt: number;
  ownerId?: string;
  equipmentSavedAt: number | null;
  sunPlace: Place | null;
};
export type TranscriptionRow = Synced & { projectId: string; name: string; createdAt: number };
export type LineRow = Synced & { projectId: string; transcriptionId: string; text: string; at: number };
export type ClipRow = Synced & {
  projectId: string;
  transcriptionId?: string;
  name: string;
  inAt: number;
  outAt: number;
  transcript: string;
  createdAt: number;
};
export type EquipmentRow = Synced & {
  projectId: string;
  name: string;
  libraryId?: string;
  have: boolean;
  position: number;
};
export type LibraryRow = Synced & { name: string };

export type Tables = {
  projects: ProjectRow;
  transcriptions: TranscriptionRow;
  lines: LineRow;
  clips: ClipRow;
  equipment: EquipmentRow;
  library: LibraryRow;
};
export type TableName = keyof Tables;

/** Upload order: parents before children so foreign keys are satisfied. */
export const TABLE_ORDER: TableName[] = ["projects", "transcriptions", "lines", "clips", "equipment", "library"];
/** Tables whose rows belong to a project. */
export const PROJECT_TABLES: TableName[] = ["transcriptions", "lines", "clips", "equipment"];

export const REMOTE_NAME: Record<TableName, string> = {
  projects: "projects",
  transcriptions: "transcriptions",
  lines: "transcript_lines",
  clips: "clips",
  equipment: "equipment_items",
  library: "equipment_library",
};

type RemoteRow = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const optStr = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Local ⇄ database field mapping for each table. */
export const MAP: { [T in TableName]: { toRemote: (r: Tables[T]) => RemoteRow; fromRemote: (r: RemoteRow) => Tables[T] } } = {
  projects: {
    toRemote: (r) => ({
      id: r.id,
      name: r.name,
      created_ms: r.createdAt,
      updated_ms: r.updatedMs,
      deleted: r.deleted,
      equipment_saved_ms: r.equipmentSavedAt,
      sun_place: r.sunPlace,
    }),
    fromRemote: (r) => ({
      id: String(r.id),
      name: String(r.name),
      createdAt: num(r.created_ms),
      updatedMs: num(r.updated_ms),
      deleted: !!r.deleted,
      ownerId: optStr(r.owner_id),
      equipmentSavedAt: r.equipment_saved_ms == null ? null : num(r.equipment_saved_ms),
      sunPlace: (r.sun_place as Place | null) ?? null,
    }),
  },
  transcriptions: {
    toRemote: (r) => ({ id: r.id, project_id: r.projectId, name: r.name, created_ms: r.createdAt, updated_ms: r.updatedMs, deleted: r.deleted }),
    fromRemote: (r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      name: String(r.name),
      createdAt: num(r.created_ms),
      updatedMs: num(r.updated_ms),
      deleted: !!r.deleted,
    }),
  },
  lines: {
    toRemote: (r) => ({
      id: r.id,
      project_id: r.projectId,
      transcription_id: r.transcriptionId,
      text: r.text,
      at_ms: r.at,
      updated_ms: r.updatedMs,
      deleted: r.deleted,
    }),
    fromRemote: (r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      transcriptionId: String(r.transcription_id),
      text: String(r.text),
      at: num(r.at_ms),
      updatedMs: num(r.updated_ms),
      deleted: !!r.deleted,
    }),
  },
  clips: {
    toRemote: (r) => ({
      id: r.id,
      project_id: r.projectId,
      transcription_id: r.transcriptionId ?? null,
      name: r.name,
      in_ms: r.inAt,
      out_ms: r.outAt,
      transcript: r.transcript,
      created_ms: r.createdAt,
      updated_ms: r.updatedMs,
      deleted: r.deleted,
    }),
    fromRemote: (r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      transcriptionId: optStr(r.transcription_id),
      name: String(r.name),
      inAt: num(r.in_ms),
      outAt: num(r.out_ms),
      transcript: String(r.transcript ?? ""),
      createdAt: num(r.created_ms),
      updatedMs: num(r.updated_ms),
      deleted: !!r.deleted,
    }),
  },
  equipment: {
    toRemote: (r) => ({
      id: r.id,
      project_id: r.projectId,
      name: r.name,
      library_id: r.libraryId ?? null,
      have: r.have,
      position: r.position,
      updated_ms: r.updatedMs,
      deleted: r.deleted,
    }),
    fromRemote: (r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      name: String(r.name),
      libraryId: optStr(r.library_id),
      have: !!r.have,
      position: num(r.position),
      updatedMs: num(r.updated_ms),
      deleted: !!r.deleted,
    }),
  },
  library: {
    toRemote: (r) => ({ id: r.id, name: r.name, updated_ms: r.updatedMs, deleted: r.deleted }),
    fromRemote: (r) => ({ id: String(r.id), name: String(r.name), updatedMs: num(r.updated_ms), deleted: !!r.deleted }),
  },
};

export { uuid } from "../id.ts";
