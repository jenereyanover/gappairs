// Firestore data access for profiles, game history, and leaderboards.
//
// Collections:
//   users/{uid}              -> { nickname, vsWins, vsGames, soloGames, gamesPlayed, createdAt, updatedAt }
//   users/{uid}/games/{id}   -> a single finished-game record (private to the owner)
//   soloScores/{uid}_{dim}   -> { uid, nickname, dimension, bestMs } (one per player+grid, public)
//
// Public profile docs intentionally hold only a nickname + aggregate stats (no email /
// real name); display name + avatar come from the Firebase Auth user object client-side.
import { db } from "lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";

export interface UserProfile {
  uid: string;
  nickname: string;
  vsWins: number;
  vsGames: number;
  soloGames: number;
  gamesPlayed: number;
  isAdmin: boolean; // set manually in the Firestore console
}

export interface GameRecord {
  id?: string;
  mode: "solo" | "vs";
  dimension: number;
  players: number;
  timeMs: number;
  moves?: number; // solo
  won?: boolean; // solo: always true; vs: did the signed-in player (Player 1) win
  winnerName?: string; // vs
  scores?: number[]; // vs
  createdAtMs?: number; // filled from Firestore timestamp for display
}

export interface SoloScore {
  uid: string;
  nickname: string;
  dimension: number;
  bestMs: number;
}

const MAX_NICK = 16;
export const cleanNickname = (n: string) => n.trim().slice(0, MAX_NICK);

/** Read a public profile, or null. */
export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    nickname: d.nickname ?? "Player",
    vsWins: d.vsWins ?? 0,
    vsGames: d.vsGames ?? 0,
    soloGames: d.soloGames ?? 0,
    gamesPlayed: d.gamesPlayed ?? 0,
    isAdmin: d.isAdmin === true,
  };
}

/** Create the profile doc on first sign-in; returns the profile either way. */
export async function ensureProfile(user: User): Promise<UserProfile | null> {
  if (!db) return null;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const nickname = cleanNickname(user.displayName || "Player");
    await setDoc(ref, {
      nickname,
      vsWins: 0,
      vsGames: 0,
      soloGames: 0,
      gamesPlayed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return fetchProfile(user.uid);
}

/** Update the player's nickname (and keep solo-leaderboard rows in sync). */
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  if (!db) return;
  const nick = cleanNickname(nickname) || "Player";
  await setDoc(doc(db, "users", uid), { nickname: nick, updatedAt: serverTimestamp() }, { merge: true });
  const rows = await getDocs(query(collection(db, "soloScores"), where("uid", "==", uid)));
  await Promise.all(rows.docs.map((r) => updateDoc(r.ref, { nickname: nick })));
}

/** Persist a finished game: history entry + stat counters + solo best time. */
export async function saveGameResult(uid: string, nickname: string, rec: GameRecord): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, "users", uid, "games"), { ...rec, createdAt: serverTimestamp() });

  const stats: Record<string, unknown> = { gamesPlayed: increment(1), updatedAt: serverTimestamp() };
  if (rec.mode === "vs") {
    stats.vsGames = increment(1);
    if (rec.won) stats.vsWins = increment(1);
  } else {
    stats.soloGames = increment(1);
  }
  await setDoc(doc(db, "users", uid), stats, { merge: true });

  if (rec.mode === "solo") {
    const ref = doc(db, "soloScores", `${uid}_${rec.dimension}`);
    const prev = await getDoc(ref);
    if (!prev.exists() || rec.timeMs < (prev.data().bestMs ?? Infinity)) {
      await setDoc(ref, {
        uid,
        nickname: cleanNickname(nickname) || "Player",
        dimension: rec.dimension,
        bestMs: rec.timeMs,
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/** Most recent games for a player. */
export async function fetchUserGames(uid: string, n = 20): Promise<GameRecord[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "users", uid, "games"), orderBy("createdAt", "desc"), limit(n)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      mode: data.mode,
      dimension: data.dimension,
      players: data.players,
      timeMs: data.timeMs,
      moves: data.moves,
      won: data.won,
      winnerName: data.winnerName,
      scores: data.scores,
      createdAtMs: data.createdAt?.toMillis?.() ?? undefined,
    } as GameRecord;
  });
}

/** This player's best solo times (one per grid size they've cleared). */
export async function fetchPlayerSoloBests(uid: string): Promise<SoloScore[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "soloScores"), where("uid", "==", uid)));
  return snap.docs
    .map((d) => d.data() as SoloScore)
    .sort((a, b) => a.dimension - b.dimension);
}

/**
 * Solo leaderboard for one grid size. Uses where + limit (no composite index
 * needed) and sorts client-side.
 */
export async function fetchSoloLeaderboard(dimension: number, n = 15): Promise<SoloScore[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, "soloScores"), where("dimension", "==", dimension), limit(100))
  );
  return snap.docs
    .map((d) => d.data() as SoloScore)
    .sort((a, b) => a.bestMs - b.bestMs)
    .slice(0, n);
}

/** VS-wins leaderboard. */
export async function fetchVsLeaderboard(n = 15): Promise<UserProfile[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "users"), orderBy("vsWins", "desc"), limit(n)));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) }))
    .filter((u) => (u.vsWins ?? 0) > 0);
}
