import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncEngine, type Remote, type RemoteRow } from "../src/lib/sync/engine.ts";
import { uuid } from "../src/lib/sync/model.ts";

/** In-memory stand-in for the database. `canOpen` plays the role of the access rules. */
class FakeServer {
  tables = new Map<string, Map<string, RemoteRow>>();
  tick = 0;
  failNext = false;
  table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }
  client(user: string, canOpen: (projectId: string, user: string) => boolean = () => true): Remote {
    const visible = (table: string, r: RemoteRow) =>
      table === "projects" ? canOpen(String(r.id), user) : table === "equipment_library" ? r.user_id === user : canOpen(String(r.project_id), user);
    return {
      upsert: async (table, rows) => {
        if (this.failNext) {
          this.failNext = false;
          throw new Error("offline");
        }
        for (const r of rows) {
          const cur = this.table(table).get(String(r.id));
          if (cur && Number(cur.updated_ms) > Number(r.updated_ms)) continue; // server keeps the newest change
          const stamp = String(++this.tick).padStart(8, "0");
          this.table(table).set(String(r.id), {
            ...cur,
            ...r,
            ...(table === "projects" && !cur ? { owner_id: user } : {}),
            ...(table === "equipment_library" ? { user_id: user } : {}),
            server_updated_at: stamp,
          });
        }
      },
      pullSince: async (table, cursor) =>
        [...this.table(table).values()].filter((r) => visible(table, r) && (!cursor || String(r.server_updated_at) >= cursor)),
      pullProject: async (table, pid) => [...this.table(table).values()].filter((r) => r.project_id === pid && canOpen(pid, user)),
      accessibleProjectIds: async () =>
        [...this.table("projects").values()].filter((r) => !r.deleted && canOpen(String(r.id), user)).map((r) => String(r.id)),
    };
  }
}

let t = 1000;
const clock = () => ++t;

const newProject = (e: SyncEngine, name: string) =>
  e.put("projects", { id: uuid(), name, createdAt: 1, equipmentSavedAt: null, sunPlace: null });

test("uuid format", () => {
  const id = uuid();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(uuid(), id);
});

test("works offline, uploads everything once connected", async () => {
  const server = new FakeServer();
  const a = new SyncEngine(undefined, clock);
  const p = newProject(a, "Media Day");
  const tr = a.put("transcriptions", { id: uuid(), projectId: p.id, name: "Locker room", createdAt: 1 });
  a.put("lines", { id: uuid(), projectId: p.id, transcriptionId: tr.id, text: "Quiet on set", at: 5 });
  assert.equal(a.status.pending, 3);
  await a.sync(); // no remote yet: nothing happens
  assert.equal(a.status.pending, 3);
  a.setRemote(server.client("alice"));
  await a.sync();
  assert.equal(a.status.pending, 0);
  assert.equal(server.table("transcript_lines").size, 1);
  assert.equal(server.table("projects").get(p.id)?.owner_id, "alice");
});

test("a teammate sees changes and edits flow back", async () => {
  const server = new FakeServer();
  const a = new SyncEngine(undefined, clock);
  const b = new SyncEngine(undefined, clock);
  a.setRemote(server.client("alice"));
  b.setRemote(server.client("bob"));
  const p = newProject(a, "Media Day");
  const clip = a.put("clips", { id: uuid(), projectId: p.id, name: "Coach", inAt: 1, outAt: 2, transcript: "", createdAt: 1 });
  await a.sync();
  await b.sync();
  assert.equal(b.get("clips", clip.id)?.name, "Coach");
  b.patch("clips", clip.id, { name: "Coach – defense" });
  await b.sync();
  await a.sync();
  assert.equal(a.get("clips", clip.id)?.name, "Coach – defense");
  assert.equal(a.status.pending, 0);
});

test("most recent change wins a conflict", async () => {
  const server = new FakeServer();
  const a = new SyncEngine(undefined, clock);
  const b = new SyncEngine(undefined, clock);
  a.setRemote(server.client("alice"));
  b.setRemote(server.client("bob"));
  const p = newProject(a, "Media Day");
  await a.sync();
  await b.sync();
  a.patch("projects", p.id, { name: "Older edit (A offline)" }); // earlier
  b.patch("projects", p.id, { name: "Newer edit (B)" }); // later
  await b.sync();
  await a.sync(); // A's older unsent edit loses to B's newer one
  assert.equal(a.get("projects", p.id)?.name, "Newer edit (B)");
  assert.equal(server.table("projects").get(p.id)?.name, "Newer edit (B)");
  b.patch("projects", p.id, { name: "B again" });
  a.patch("projects", p.id, { name: "A newest" });
  await b.sync();
  await a.sync();
  await b.sync();
  assert.equal(a.get("projects", p.id)?.name, "A newest");
  assert.equal(b.get("projects", p.id)?.name, "A newest");
});

test("deletes reach other devices", async () => {
  const server = new FakeServer();
  const a = new SyncEngine(undefined, clock);
  const b = new SyncEngine(undefined, clock);
  a.setRemote(server.client("alice"));
  b.setRemote(server.client("bob"));
  const p = newProject(a, "P");
  const item = a.put("equipment", { id: uuid(), projectId: p.id, name: "C-stand", have: false, position: 1 });
  await a.sync();
  await b.sync();
  assert.ok(b.get("equipment", item.id));
  b.remove("equipment", item.id);
  await b.sync();
  await a.sync();
  assert.equal(a.get("equipment", item.id), undefined);
  assert.equal(a.all("equipment").length, 0);
});

test("a project shared later arrives with its full history", async () => {
  const server = new FakeServer();
  const shared = new Set<string>();
  const access = (pid: string, user: string) => user === "alice" || shared.has(pid);
  const a = new SyncEngine(undefined, clock);
  const b = new SyncEngine(undefined, clock);
  a.setRemote(server.client("alice", access));
  b.setRemote(server.client("bob", access));
  const mine = newProject(b, "Bob's own");
  await b.sync(); // bob has cursors now
  const p = newProject(a, "Media Day");
  a.put("lines", { id: uuid(), projectId: p.id, transcriptionId: "t", text: "old line", at: 1 });
  await a.sync();
  await b.sync();
  assert.equal(b.get("projects", p.id), undefined);
  shared.add(p.id);
  shared.add(mine.id);
  await b.sync();
  assert.equal(b.get("projects", p.id)?.name, "Media Day");
  assert.equal(b.all("lines").length, 1);
});

test("losing access removes the project from the device", async () => {
  const server = new FakeServer();
  let bobAllowed = true;
  const access = (_pid: string, user: string) => user === "alice" || bobAllowed;
  const a = new SyncEngine(undefined, clock);
  const b = new SyncEngine(undefined, clock);
  a.setRemote(server.client("alice", access));
  b.setRemote(server.client("bob", access));
  const p = newProject(a, "Media Day");
  a.put("clips", { id: uuid(), projectId: p.id, name: "c", inAt: 1, outAt: 2, transcript: "", createdAt: 1 });
  await a.sync();
  await b.sync();
  assert.equal(b.all("clips").length, 1);
  bobAllowed = false;
  await b.sync();
  assert.equal(b.get("projects", p.id), undefined);
  assert.equal(b.all("clips").length, 0);
});

test("failed upload keeps changes pending; edits during upload stay dirty", async () => {
  const server = new FakeServer();
  const a = new SyncEngine(undefined, clock);
  a.setRemote(server.client("alice"));
  const p = newProject(a, "P");
  server.failNext = true;
  await a.sync();
  assert.ok(a.status.error);
  assert.equal(a.isDirty("projects", p.id), true);
  await a.sync();
  assert.equal(a.status.error, null);
  assert.equal(a.isDirty("projects", p.id), false);

  // Change the row while an upload is in flight
  const remote = server.client("alice");
  a.setRemote({
    ...remote,
    upsert: async (table, rows) => {
      a.patch("projects", p.id, { name: "changed mid-upload" });
      await remote.upsert(table, rows);
    },
  });
  a.patch("projects", p.id, { name: "first" });
  await a.flush();
  assert.equal(a.isDirty("projects", p.id), true);
});

test("personal equipment library syncs only to its owner", async () => {
  const server = new FakeServer();
  const a1 = new SyncEngine(undefined, clock);
  const a2 = new SyncEngine(undefined, clock);
  const b = new SyncEngine(undefined, clock);
  a1.setRemote(server.client("alice"));
  a2.setRemote(server.client("alice"));
  b.setRemote(server.client("bob"));
  a1.put("library", { id: uuid(), name: "Sony FX6" });
  await a1.sync();
  await a2.sync();
  await b.sync();
  assert.equal(a2.all("library").length, 1);
  assert.equal(b.all("library").length, 0);
});

test("snapshot round-trips through JSON", () => {
  const a = new SyncEngine(undefined, clock);
  newProject(a, "P");
  const restored = new SyncEngine(JSON.parse(JSON.stringify(a.state)), clock);
  assert.equal(restored.all("projects").length, 1);
  assert.equal(restored.status.pending, 1);
});
