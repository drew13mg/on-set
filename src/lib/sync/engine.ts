// Offline-first sync engine. Pure logic with a pluggable remote, tested in tests/sync.test.ts.
//
// - Every change is applied locally first and marked "dirty".
// - flush() uploads dirty rows (parents first). A row stays dirty if it changed again mid-upload.
// - pull() downloads rows changed on the server since the last pull, plus everything for
//   projects that were just shared with this user, and drops projects this user lost access to.
// - Conflicts: the most recent change wins (per row).
import { MAP, PROJECT_TABLES, REMOTE_NAME, TABLE_ORDER, type TableName, type Tables } from "./model.ts";

export type RemoteRow = Record<string, unknown>;

export interface Remote {
  upsert(table: string, rows: RemoteRow[]): Promise<void>;
  /** Rows (any project the user can open) whose server_updated_at is at or after the cursor. */
  pullSince(table: string, cursor: string | null): Promise<RemoteRow[]>;
  /** Every row of one project. */
  pullProject(table: string, projectId: string): Promise<RemoteRow[]>;
  /** Ids of non-deleted projects this user can open right now. */
  accessibleProjectIds(): Promise<string[]>;
}

type TableMap = { [T in TableName]: Record<string, Tables[T]> };
type DirtyMap = { [T in TableName]: Record<string, true> };

export type Snapshot = {
  tables: TableMap;
  dirty: DirtyMap;
  cursors: Partial<Record<TableName, string>>;
  /** Projects known to exist on the server for this user. */
  remoteProjects: Record<string, true>;
};

const emptyTables = () => Object.fromEntries(TABLE_ORDER.map((t) => [t, {}]));

export const emptySnapshot = (): Snapshot => ({
  tables: emptyTables() as TableMap,
  dirty: emptyTables() as DirtyMap,
  cursors: {},
  remoteProjects: {},
});

export type SyncStatus = { pending: number; lastSyncedAt: number | null; error: string | null; syncing: boolean };

type NewRow<T extends TableName> = Omit<Tables[T], "updatedMs" | "deleted"> & { deleted?: boolean };

const CHUNK = 400;

export class SyncEngine {
  state: Snapshot;
  remote: Remote | null = null;
  status: SyncStatus = { pending: 0, lastSyncedAt: null, error: null, syncing: false };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private clock: () => number;

  constructor(initial?: Snapshot, clock: () => number = Date.now) {
    this.state = initial ?? emptySnapshot();
    this.clock = clock;
    this.status.pending = this.countDirty();
  }

  // ---------- subscriptions ----------
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.status = { ...this.status, pending: this.countDirty() };
    for (const fn of this.listeners) fn();
  }

  // ---------- reads ----------
  /** Live (non-deleted) rows. */
  all<T extends TableName>(table: T): Tables[T][] {
    return Object.values(this.state.tables[table]).filter((r) => !r.deleted) as Tables[T][];
  }
  get<T extends TableName>(table: T, id: string): Tables[T] | undefined {
    const r = this.state.tables[table][id] as Tables[T] | undefined;
    return r && !r.deleted ? r : undefined;
  }
  isDirty(table: TableName, id: string): boolean {
    return !!this.state.dirty[table][id];
  }

  // ---------- local writes ----------
  private stamp(table: TableName, id: string): number {
    const prev = this.state.tables[table][id];
    return Math.max(this.clock(), (prev?.updatedMs ?? 0) + 1);
  }

  put<T extends TableName>(table: T, row: NewRow<T>): Tables[T] {
    const full = { deleted: false, ...row, updatedMs: this.stamp(table, row.id) } as Tables[T];
    (this.state.tables[table] as Record<string, Tables[T]>)[row.id] = full;
    (this.state.dirty[table] as Record<string, true>)[row.id] = true;
    this.emit();
    return full;
  }

  /** Several writes with one notification (e.g. equipment list changes). */
  batch(fn: () => void) {
    const saved = this.emit;
    let changed = false;
    this.emit = () => {
      changed = true;
    };
    try {
      fn();
    } finally {
      this.emit = saved;
      if (changed) this.emit();
    }
  }

  patch<T extends TableName>(table: T, id: string, changes: Partial<Tables[T]>): Tables[T] | undefined {
    const cur = this.state.tables[table][id] as Tables[T] | undefined;
    if (!cur) return undefined;
    return this.put(table, { ...cur, ...changes, id } as NewRow<T>);
  }

  remove(table: TableName, id: string) {
    const cur = this.state.tables[table][id];
    if (!cur || cur.deleted) return;
    this.patch(table, id, { deleted: true } as Partial<Tables[typeof table]>);
  }

  /** Forget a project and everything in it on this device only (lost access, left project). */
  purgeProject(projectId: string) {
    delete this.state.tables.projects[projectId];
    delete this.state.dirty.projects[projectId];
    delete this.state.remoteProjects[projectId];
    for (const t of PROJECT_TABLES) {
      const rows = this.state.tables[t] as Record<string, { projectId: string }>;
      for (const [id, r] of Object.entries(rows)) {
        if (r.projectId === projectId) {
          delete rows[id];
          delete this.state.dirty[t][id];
        }
      }
    }
    this.emit();
  }

  /** Wipe everything (sign out). */
  reset() {
    this.state = emptySnapshot();
    this.status = { pending: 0, lastSyncedAt: null, error: null, syncing: false };
    this.emit();
  }

  /** Replace the device copy (e.g. loaded from storage on launch). */
  load(snapshot: Snapshot) {
    // Saved copies from older app versions may lack newer tables.
    const base = emptySnapshot();
    this.state = {
      ...base,
      ...snapshot,
      tables: { ...base.tables, ...snapshot.tables },
      dirty: { ...base.dirty, ...snapshot.dirty },
    };
    this.emit();
  }

  // ---------- merging server rows ----------
  /** Apply a server row unless this device has a newer unsent change. Returns true if applied. */
  merge<T extends TableName>(table: T, remoteRow: RemoteRow, notify = true): boolean {
    const incoming = MAP[table].fromRemote(remoteRow) as Tables[T];
    const rows = this.state.tables[table] as Record<string, Tables[T]>;
    const local = rows[incoming.id];
    if (table === "projects") this.state.remoteProjects[incoming.id] = true;
    if (local && this.state.dirty[table][incoming.id] && local.updatedMs > incoming.updatedMs) return false;
    if (local && !this.state.dirty[table][incoming.id] && local.updatedMs > incoming.updatedMs) return false;
    rows[incoming.id] = { ...local, ...incoming };
    if (!local || local.updatedMs <= incoming.updatedMs) delete this.state.dirty[table][incoming.id];
    if (notify) this.emit();
    return true;
  }

  // ---------- network ----------
  setRemote(remote: Remote | null) {
    this.remote = remote;
  }

  /** Upload, download, upload again. Calls made while running are coalesced into one more run. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.runOnce();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce() {
    if (!this.remote) return;
    this.status = { ...this.status, syncing: true };
    this.emit();
    try {
      await this.flush();
      await this.pull();
      await this.flush();
      this.status = { ...this.status, error: null, lastSyncedAt: this.clock() };
    } catch (e) {
      this.status = { ...this.status, error: e instanceof Error ? e.message : String(e) };
    } finally {
      this.status = { ...this.status, syncing: false };
      this.emit();
    }
  }

  async flush(): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    let firstError: unknown = null;
    for (const t of TABLE_ORDER) {
      const ids = Object.keys(this.state.dirty[t]);
      for (let i = 0; i < ids.length; i += CHUNK) {
        const rows = ids
          .slice(i, i + CHUNK)
          .map((id) => this.state.tables[t][id])
          .filter(Boolean) as Tables[typeof t][];
        if (!rows.length) continue;
        const sent = rows.map((r) => [r.id, r.updatedMs] as const);
        try {
          await remote.upsert(REMOTE_NAME[t], rows.map((r) => (MAP[t].toRemote as (x: typeof r) => RemoteRow)(r)));
          for (const [id, ms] of sent) {
            if (this.state.tables[t][id]?.updatedMs === ms) delete this.state.dirty[t][id];
            if (t === "projects") this.state.remoteProjects[id] = true;
          }
        } catch (e) {
          firstError ??= e;
        }
      }
    }
    this.emit();
    if (firstError) throw firstError;
  }

  async pull(): Promise<void> {
    const remote = this.remote;
    if (!remote) return;
    const accessible = new Set(await remote.accessibleProjectIds());

    // Projects this user can no longer open (unshared, left, deleted by owner).
    for (const pid of Object.keys(this.state.remoteProjects)) {
      if (!accessible.has(pid)) this.purgeProjectQuiet(pid);
    }
    const newlyShared = [...accessible].filter((pid) => !this.state.remoteProjects[pid]);
    const hadCursor = TABLE_ORDER.map((t) => !!this.state.cursors[t]);

    for (const t of TABLE_ORDER) {
      const rows = await remote.pullSince(REMOTE_NAME[t], this.state.cursors[t] ?? null);
      let max = this.state.cursors[t] ?? "";
      for (const r of rows) {
        if (t !== "projects" && t !== "library" && !accessible.has(String(r.project_id))) continue;
        this.merge(t, r, false);
        const at = String(r.server_updated_at ?? "");
        if (at > max) max = at;
      }
      if (max) this.state.cursors[t] = max;
    }

    // Projects shared since the last pull: fetch their full history (older rows are behind the cursors).
    if (hadCursor.some(Boolean)) {
      for (const pid of newlyShared) {
        for (const t of PROJECT_TABLES) {
          for (const r of await remote.pullProject(REMOTE_NAME[t], pid)) this.merge(t, r, false);
        }
      }
    }
    for (const pid of accessible) this.state.remoteProjects[pid] = true;
    this.emit();
  }

  private purgeProjectQuiet(pid: string) {
    const saved = this.emit;
    this.emit = () => {};
    try {
      this.purgeProject(pid);
    } finally {
      this.emit = saved;
    }
  }

  private countDirty(): number {
    return TABLE_ORDER.reduce((n, t) => n + Object.keys(this.state.dirty[t]).length, 0);
  }
}
