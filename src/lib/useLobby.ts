"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get, onDisconnect, onValue, ref, set } from "firebase/database";
import { rtdb } from "lib/firebase";
import {
  buildDeck,
  joinLobby,
  membersByAge,
  removeLobby,
  removeMember,
  sendChatMessage,
  sendSystemMessage,
  updateLobby,
  type Lobby,
  type LobbyGame,
  type LobbyMember,
} from "lib/lobby";

export interface UseLobby {
  lobby: Lobby | null;
  loaded: boolean;
  joinError: string | null;
  kicked: boolean;
  isLeader: boolean;
  isMyTurn: boolean;
  isSpectator: boolean;
  setNickname: (nickname: string) => void;
  setDimension: (dimension: number) => void;
  setImageSet: (ids: string[], images: string[], name: string | null) => void;
  startGame: (dimension?: number) => void;
  restartGame: (dimension?: number) => void;
  setPaused: (paused: boolean) => void;
  flip: (index: number) => void;
  kick: (uid: string) => void;
  sendChat: (text: string) => void;
  leave: () => Promise<void>;
}

export function useLobby(code: string, uid: string | undefined, myNickname: string): UseLobby {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftRef = useRef(false);
  const joinedOk = useRef(false);
  const wasMember = useRef(false);
  const prevMembers = useRef<Record<string, LobbyMember>>({});
  const membersInited = useRef(false);
  const nickRef = useRef(myNickname);
  nickRef.current = myNickname;

  // Subscribe to the lobby (includes members, game, chat).
  useEffect(() => {
    if (!rtdb || !code || !uid) return;
    leftRef.current = false;
    const unsub = onValue(ref(rtdb, `lobbies/${code}`), (snap) => {
      setLobby(snap.exists() ? (snap.val() as Lobby) : null);
      setLoaded(true);
    });
    return () => unsub();
  }, [code, uid]);

  // Join once, capacity-checked. Only a successful join arms presence re-adds.
  useEffect(() => {
    if (!rtdb || !code || !uid) return;
    let active = true;
    joinLobby(code, uid, nickRef.current).then((r) => {
      if (!active) return;
      if (r.ok) joinedOk.current = true;
      else setJoinError(r.error || "Could not join lobby");
    });
    return () => {
      active = false;
    };
  }, [code, uid]);

  // Presence: arm onDisconnect cleanup, and re-establish membership on reconnect —
  // but ONLY if we legitimately joined (prevents cap bypass and ghost lobbies).
  useEffect(() => {
    if (!rtdb || !code || !uid) return;
    const memberRef = ref(rtdb, `lobbies/${code}/members/${uid}`);
    const lobbyRef = ref(rtdb, `lobbies/${code}`);
    const unsub = onValue(ref(rtdb, ".info/connected"), async (snap) => {
      if (snap.val() !== true || leftRef.current) return;
      try {
        if (joinedOk.current && !leftRef.current && !(await get(memberRef)).exists()) {
          // Only re-establish into a lobby that still exists; never recreate an
          // abandoned one (which would leave a bare, statusless lobby).
          const lobbySnap = await get(lobbyRef);
          if (!lobbySnap.exists() || !(lobbySnap.val() as Lobby)?.leader) return;
          await set(memberRef, { nickname: nickRef.current || "Guest", joinedAt: Date.now() });
        }
        await onDisconnect(memberRef).remove();
      } catch {
        /* best-effort presence */
      }
    });
    return () => unsub();
  }, [code, uid]);

  // Reconcile membership changes: kick detection, leader transfer, pause, cleanup.
  useEffect(() => {
    if (!rtdb || !lobby || !uid || leftRef.current) return;
    const members = lobby.members || {};
    const order = membersByAge(members);

    if (members[uid]) wasMember.current = true;

    // We were in the lobby but are no longer a member (and didn't leave): we were kicked.
    if (joinedOk.current && wasMember.current && !members[uid]) {
      leftRef.current = true;
      setKicked(true);
      try {
        onDisconnect(ref(rtdb, `lobbies/${code}/members/${uid}`)).cancel();
        onDisconnect(ref(rtdb, `lobbies/${code}`)).cancel();
      } catch {
        /* ignore */
      }
      return;
    }

    if (order.length === 0) return;
    const oldest = order[0];

    // Announce joins/leaves in chat. Single writer (oldest present member); the
    // first snapshot only seeds, so existing members aren't announced as joining.
    const prev = prevMembers.current;
    if (!membersInited.current) {
      membersInited.current = true;
    } else if (oldest === uid) {
      for (const u of Object.keys(members)) {
        if (!prev[u]) sendSystemMessage(code, `${members[u]?.nickname || "A player"} joined`);
      }
      for (const u of Object.keys(prev)) {
        if (!members[u]) sendSystemMessage(code, `${prev[u]?.nickname || "A player"} left`);
      }
    }
    prevMembers.current = members;

    // Leader left -> the oldest remaining member promotes itself.
    if (!members[lobby.leader]) {
      if (oldest === uid) updateLobby(code, { leader: uid });
      return;
    }

    if (lobby.status !== "waiting") {
      if (order.length === 1) {
        // A game ended/paused and everyone but the leader left -> return to the
        // waiting room, where the lone leader picks a size and waits for players.
        if (oldest === uid) updateLobby(code, { status: "waiting", game: null, pausedReason: null });
      } else if (lobby.status === "playing" && lobby.game) {
        // An active player left mid-game (2+ still here) -> pause (single writer).
        const gone = (lobby.game.turnOrder || []).filter((u) => !members[u]);
        if (gone.length && oldest === uid) {
          updateLobby(code, { status: "paused", pausedReason: "A player disconnected or left" });
        }
      }
    }

    // Last one standing -> remove the whole lobby (and its chat) on disconnect.
    const lobbyRef = ref(rtdb, `lobbies/${code}`);
    if (order.length === 1 && order[0] === uid) {
      onDisconnect(lobbyRef).remove().catch(() => {});
    } else {
      onDisconnect(lobbyRef).cancel().catch(() => {});
    }
  }, [lobby, uid, code]);

  const setNickname = useCallback(
    (nickname: string) => {
      if (!uid) return;
      updateLobby(code, { [`members/${uid}/nickname`]: nickname.slice(0, 16) || "Guest" });
    },
    [code, uid]
  );

  const setDimension = useCallback(
    (dimension: number) => {
      if (lobby?.leader !== uid) return;
      updateLobby(code, { "settings/dimension": dimension });
    },
    [code, uid, lobby?.leader]
  );

  const setImageSet = useCallback(
    (ids: string[], images: string[], name: string | null) => {
      if (lobby?.leader !== uid) return;
      const on = images.length > 0;
      updateLobby(code, {
        "settings/imageSetIds": on ? ids : null,
        "settings/imageSetName": on ? name : null,
        "settings/images": on ? images : null,
      });
    },
    [code, uid, lobby?.leader]
  );

  // Leader-only pause/resume, synced to all clients via the lobby status.
  // Uses the "__host__" reason to distinguish from a disconnect-pause.
  const setPaused = useCallback(
    (paused: boolean) => {
      if (lobby?.leader !== uid) return;
      if (paused) {
        if (lobby?.status !== "playing") return;
        updateLobby(code, { status: "paused", pausedReason: "__host__" });
      } else {
        if (lobby?.status !== "paused") return;
        updateLobby(code, { status: "playing", pausedReason: null });
      }
    },
    [code, uid, lobby?.leader, lobby?.status]
  );

  // Deal a fresh board for everyone currently in the lobby (start, restart, or
  // a new game that folds in any spectators who joined mid-game).
  const startGame = useCallback(
    (dimensionOverride?: number) => {
      if (!lobby || lobby.leader !== uid) return;
      const order = membersByAge(lobby.members);
      if (order.length < 2) return; // need at least two players
      const dimension = dimensionOverride ?? lobby.settings?.dimension ?? 4;
      const scores: Record<string, number> = {};
      order.forEach((u) => (scores[u] = 0));
      const game: LobbyGame = {
        dimension,
        tiles: buildDeck(dimension, lobby.settings?.images || []),
        open: [],
        matchedBy: {},
        turnUid: order[0],
        turnOrder: order,
        scores,
        resolving: false,
        finished: false,
      };
      // Persist the chosen size too, so the waiting room reflects it next time.
      updateLobby(code, { status: "playing", pausedReason: null, "settings/dimension": dimension, game });
    },
    [lobby, uid, code]
  );

  const flip = useCallback(
    (index: number) => {
      const g = lobby?.game;
      if (!lobby || !g || !uid) return;
      if (lobby.status !== "playing" || g.resolving || g.turnUid !== uid) return;
      const open = g.open || [];
      if (open.length >= 2 || open.includes(index) || g.matchedBy?.[index] !== undefined) return;

      if (open.length === 0) {
        updateLobby(code, { "game/open": [index] });
        return;
      }

      const a = open[0];
      const b = index;
      updateLobby(code, { "game/open": [a, b], "game/resolving": true });
      const match = g.tiles[a] === g.tiles[b];
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
      resolveTimer.current = setTimeout(
        () => {
          if (match) {
            const score = (g.scores?.[uid] ?? 0) + 1;
            const updates: Record<string, unknown> = {
              [`game/matchedBy/${a}`]: uid,
              [`game/matchedBy/${b}`]: uid,
              [`game/scores/${uid}`]: score,
              "game/open": [],
              "game/resolving": false,
            };
            let finishMsg: string | null = null;
            if (Object.keys(g.matchedBy || {}).length + 2 >= g.tiles.length) {
              const finalScores = { ...(g.scores || {}), [uid]: score };
              const max = Math.max(...Object.values(finalScores));
              const leaders = Object.keys(finalScores).filter((u) => finalScores[u] === max);
              updates["game/finished"] = true;
              updates["game/winnerUid"] = leaders.length > 1 ? "tie" : leaders[0];
              updates["status"] = "finished";
              finishMsg =
                leaders.length > 1
                  ? "🤝 It's a tie!"
                  : `🏆 ${lobby.members?.[leaders[0]]?.nickname || "Player"} wins!`;
            }
            updateLobby(code, updates);
            if (finishMsg) sendSystemMessage(code, finishMsg);
          } else {
            const turnOrder = g.turnOrder || [];
            const here = lobby.members || {};
            const start = turnOrder.indexOf(uid);
            let next = uid;
            for (let k = 1; k <= turnOrder.length; k++) {
              const cand = turnOrder[(start + k) % turnOrder.length];
              if (here[cand]) {
                next = cand;
                break;
              }
            }
            updateLobby(code, { "game/open": [], "game/resolving": false, "game/turnUid": next });
          }
        },
        match ? 450 : 950
      );
    },
    [lobby, uid, code]
  );

  const kick = useCallback(
    (target: string) => {
      if (!lobby || lobby.leader !== uid || lobby.status !== "waiting" || target === uid) return;
      removeMember(code, target);
    },
    [lobby, uid, code]
  );

  const sendChat = useCallback(
    (text: string) => {
      if (!uid) return;
      // Use the player's current lobby nickname (which they can edit), not the
      // profile/initial fallback.
      const name = lobby?.members?.[uid]?.nickname || nickRef.current || "Guest";
      sendChatMessage(code, uid, name, text);
    },
    [code, uid, lobby]
  );

  const leave = useCallback(async () => {
    if (!uid || !lobby) return;
    leftRef.current = true;
    const order = membersByAge(lobby.members);
    if (order.length <= 1 && order[0] === uid) {
      await removeLobby(code);
    } else {
      await removeMember(code, uid);
    }
  }, [uid, lobby, code]);

  useEffect(() => {
    return () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
    };
  }, []);

  const inGame = lobby?.status !== "waiting" && !!lobby?.game;
  const isSpectator =
    !!uid && !!lobby && inGame && !(lobby.game?.turnOrder || []).includes(uid);

  return {
    lobby,
    loaded,
    joinError,
    kicked,
    isLeader: !!uid && lobby?.leader === uid,
    isMyTurn: !!uid && lobby?.game?.turnUid === uid && lobby?.status === "playing",
    isSpectator,
    setNickname,
    setDimension,
    setImageSet,
    startGame,
    restartGame: startGame,
    setPaused,
    flip,
    kick,
    sendChat,
    leave,
  };
}
