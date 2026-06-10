"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "context/AuthProvider";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.2C12.3 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.3 0-11.7-3.8-13.6-9.1l-7.9 6.2C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

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
