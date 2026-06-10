"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "context/AuthProvider";
import GoogleIcon from "components/GoogleIcon";

export default function TopNav() {
  const pathname = usePathname();
  const { user, profile, loading, enabled, isAdmin, signIn, signOutUser } = useAuth();

  // The menu, leaderboard, game and lobby screens have their own headers/nav.
  if (
    pathname === "/" ||
    pathname?.startsWith("/game") ||
    pathname?.startsWith("/lobby") ||
    pathname?.startsWith("/leaderboard")
  )
    return null;

  return (
    <div className="fixed right-0 top-0 z-30 flex items-center gap-2 p-3 text-sm">
      <Link
        href="/leaderboard"
        className="rounded-md px-3 py-1.5 font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        Leaderboard
      </Link>

      {!enabled ? (
        <span
          className="rounded-md bg-white/5 px-3 py-1.5 text-slate-400"
          title="Set NEXT_PUBLIC_FIREBASE_* in .env.local to enable login"
        >
          Login unavailable
        </span>
      ) : loading ? (
        <span className="rounded-md px-3 py-1.5 text-slate-500">…</span>
      ) : user && !user.isAnonymous ? (
        <>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 font-medium text-[#f5c542] transition-colors hover:bg-white/10"
            >
              Admin
            </Link>
          )}
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 transition-colors hover:bg-white/10"
          >
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#7c83ff] text-xs font-bold text-[#0b101d]">
                {(profile?.nickname || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="max-w-[8rem] truncate font-medium text-slate-100">
              {profile?.nickname || "Profile"}
            </span>
          </Link>
          <button
            onClick={signOutUser}
            className="rounded-md px-3 py-1.5 font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </>
      ) : (
        <button
          onClick={signIn}
          className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 font-medium text-slate-800 shadow transition-colors hover:bg-slate-100"
        >
          <GoogleIcon />
          Log in
        </button>
      )}
    </div>
  );
}
