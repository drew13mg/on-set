// Sharing: people, saved user groups and invite codes. These need a connection and a
// signed-in account (the database's access rules decide who can do what).
import { supabase } from "./supabase";
import { uuid } from "./id";
export { formatCode, parseEmails } from "./sharing-text";

export type Person = {
  email: string;
  name: string | null;
  via: "owner" | "direct" | "group";
  groupName: string | null;
  isOwner: boolean;
  isMe: boolean;
};

export type LinkedGroup = { id: string; name: string; memberCount: number; isMine: boolean };
export type UserGroup = { id: string; name: string; members: string[] };

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function listPeople(projectId: string): Promise<Person[]> {
  const { data, error } = await supabase.rpc("project_people", { p: projectId });
  fail(error);
  const rows = (data ?? []) as {
    email: string;
    display_name: string | null;
    via: Person["via"];
    group_name: string | null;
    is_owner: boolean;
    is_me: boolean;
  }[];
  return rows
    .map((r) => ({
      email: r.email,
      name: r.display_name,
      via: r.via,
      groupName: r.group_name,
      isOwner: r.is_owner,
      isMe: r.is_me,
    }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

export async function listLinkedGroups(projectId: string): Promise<LinkedGroup[]> {
  const { data, error } = await supabase.rpc("project_group_names", { p: projectId });
  fail(error);
  return ((data ?? []) as { group_id: string; name: string; member_count: number; is_mine: boolean }[]).map((g) => ({
    id: g.group_id,
    name: g.name,
    memberCount: g.member_count,
    isMine: g.is_mine,
  }));
}

export async function addPeople(projectId: string, emails: string[]) {
  if (!emails.length) return;
  const { error } = await supabase
    .from("project_members")
    .upsert(emails.map((email) => ({ project_id: projectId, email })), { onConflict: "project_id,email", ignoreDuplicates: true });
  fail(error);
}

export async function removePerson(projectId: string, email: string) {
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("email", email);
  fail(error);
}

export async function linkGroup(projectId: string, groupId: string) {
  const { error } = await supabase
    .from("project_groups")
    .upsert({ project_id: projectId, group_id: groupId }, { onConflict: "project_id,group_id", ignoreDuplicates: true });
  fail(error);
}

export async function unlinkGroup(projectId: string, groupId: string) {
  const { error } = await supabase.from("project_groups").delete().eq("project_id", projectId).eq("group_id", groupId);
  fail(error);
}

export async function inviteCode(projectId: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_invite", { p: projectId });
  fail(error);
  return String(data);
}

export async function joinWithCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_project", { invite_code: code });
  if (error) throw new Error(/isn't valid/.test(error.message) ? "That code isn't valid. Check it and try again." : error.message);
  return String(data);
}

// ---------- saved user groups ----------

export async function myGroups(): Promise<UserGroup[]> {
  const { data, error } = await supabase
    .from("user_groups")
    .select("id, name, group_members(email)")
    .eq("deleted", false)
    .order("name");
  fail(error);
  return ((data ?? []) as { id: string; name: string; group_members: { email: string }[] }[]).map((g) => ({
    id: g.id,
    name: g.name,
    members: g.group_members.map((m) => m.email).sort(),
  }));
}

/** Create or update a group. Projects linked to it follow its members automatically. */
export async function saveGroup(group: { id?: string; name: string; members: string[] }, before?: UserGroup): Promise<string> {
  const id = group.id ?? uuid();
  const name = group.name.trim() || "Untitled group";
  const { error } = await supabase.from("user_groups").upsert({ id, name, updated_ms: Date.now(), deleted: false }, { onConflict: "id" });
  fail(error);
  const old = new Set(before?.members ?? []);
  const next = new Set(group.members);
  const added = [...next].filter((e) => !old.has(e));
  const removed = [...old].filter((e) => !next.has(e));
  if (added.length) {
    const { error: e1 } = await supabase
      .from("group_members")
      .upsert(added.map((email) => ({ group_id: id, email })), { onConflict: "group_id,email", ignoreDuplicates: true });
    fail(e1);
  }
  if (removed.length) {
    const { error: e2 } = await supabase.from("group_members").delete().eq("group_id", id).in("email", removed);
    fail(e2);
  }
  return id;
}

export async function deleteGroup(id: string) {
  const { error } = await supabase.from("user_groups").delete().eq("id", id);
  fail(error);
}
