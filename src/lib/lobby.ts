// Realtime Database layer for online multiplayer lobbies.
//
// lobbies/{code}
//   leader: uid                       (author; reassigned if they leave)
//   status: waiting | playing | paused | finished
//   settings: { dimension }           (leader-controlled)
//   pausedReason: string | null
//   createdAt: number
//   members/{uid}: { nickname, joinedAt }   (membership == presence; onDisconnect removes)
//   game: { dimension, tiles[], open[], matchedBy{idx:uid}, turnUid, turnOrder[], scores{}, resolving, finished, winnerUid }
//   chat/{pushId}: { uid, name, text, at }  (lives under the lobby, so it's deleted with it)
import { get, push, ref, remove, runTransaction, serverTimestamp, set, update } from "firebase/database";
import { rtdb } from "lib/firebase";
import { mixFaces, shuffle } from "utils/helpers";

export const MAX_PLAYERS = 5;

export type LobbyStatus = "waiting" | "playing" | "paused" | "finished";

export interface LobbyMember {
  nickname: string;
  joinedAt: number;
}

export interface LobbyGame {
  dimension: number;
  tiles: string[];
  open: number[];
  matchedBy: Record<string, string>;
  turnUid: string;
  turnOrder: string[];
  scores: Record<string, number>;
  resolving?: boolean;
  finished?: boolean;
  winnerUid?: string; // a uid, or "tie"
}

export interface ChatMessage {
  uid?: string;
  name?: string;
  text: string;
  at: number;
  system?: boolean; // automated lobby message (join/leave/winner), no sender
}

export interface Lobby {
  leader: string;
  status: LobbyStatus;
  settings: {
    dimension: number;
    imageSetIds?: string[] | null;
    imageSetName?: string | null;
    images?: string[] | null;
  };
  pausedReason?: string | null;
  members?: Record<string, LobbyMember>;
  game?: LobbyGame | null;
  chat?: Record<string, ChatMessage>;
  createdAt?: number;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function genCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/**
 * A flat deck (each face twice) for the board. `images` (a selected set) are
 * mixed with emojis; with none, it's all emojis.
 */
export function buildDeck(dimension: number, images: string[] = []): string[] {
  const pairs = (dimension * dimension) / 2;
  const faces = mixFaces(images, pairs);
  return shuffle([...faces, ...faces]);
}

function lref(code: string) {
  return ref(rtdb!, `lobbies/${code}`);
}

export async function createLobby(uid: string, nickname: string, dimension: number): Promise<string> {
  if (!rtdb) throw new Error("Realtime Database not configured");
  let code = genCode();
  if ((await get(lref(code))).exists()) code = genCode();
  await set(lref(code), {
    leader: uid,
    status: "waiting",
    settings: { dimension },
    pausedReason: null,
    members: { [uid]: { nickname, joinedAt: Date.now() } },
    createdAt: serverTimestamp(),
  });
  return code;
}

/** Join a lobby, enforcing the player cap atomically. */
export async function joinLobby(
  code: string,
  uid: string,
  nickname: string
): Promise<{ ok: boolean; error?: string }> {
  if (!rtdb) return { ok: false, error: "Realtime Database not configured" };
  // Don't create a lobby for a bad code (the transaction below would otherwise).
  if (!(await get(lref(code))).exists()) return { ok: false, error: "Lobby not found" };

  let full = false;
  const res = await runTransaction(
    ref(rtdb, `lobbies/${code}/members`),
    (members: Record<string, LobbyMember> | null) => {
      const m = members || {};
      if (m[uid]) return m; // already in — no change
      if (Object.keys(m).length >= MAX_PLAYERS) {
        full = true;
        return; // abort: lobby full
      }
      m[uid] = { nickname, joinedAt: Date.now() };
      return m;
    }
  );
  if (full || !res.committed) return { ok: false, error: "Lobby is full (max 5 players)" };
  return { ok: true };
}

export async function updateLobby(code: string, updates: Record<string, unknown>) {
  if (!rtdb) return;
  await update(lref(code), updates);
}

export async function removeMember(code: string, uid: string) {
  if (!rtdb) return;
  await remove(ref(rtdb, `lobbies/${code}/members/${uid}`));
}

export async function removeLobby(code: string) {
  if (!rtdb) return;
  await remove(lref(code));
}

export async function sendChatMessage(code: string, uid: string, name: string, text: string): Promise<void> {
  if (!rtdb) return;
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  await push(ref(rtdb, `lobbies/${code}/chat`), {
    uid,
    name: name.slice(0, 16) || "Player",
    text: clean,
    at: serverTimestamp(),
  });
}

/** An automated lobby message (player joined/left, winner announced). */
export async function sendSystemMessage(code: string, text: string): Promise<void> {
  if (!rtdb) return;
  await push(ref(rtdb, `lobbies/${code}/chat`), { system: true, text: text.slice(0, 120), at: serverTimestamp() });
}

/** Members sorted oldest-first (used for leader election + turn order). */
export function membersByAge(members: Record<string, LobbyMember> | undefined): string[] {
  if (!members) return [];
  return Object.keys(members).sort((a, b) => (members[a].joinedAt ?? 0) - (members[b].joinedAt ?? 0));
}
