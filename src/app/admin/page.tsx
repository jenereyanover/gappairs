"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import classNames from "classnames";
import { useAuth } from "context/AuthProvider";
import {
  addImagesToSet,
  createImageSet,
  deleteImageSet,
  fetchImageSets,
  removeImageFromSet,
  type ImageItem,
  type ImageSet,
} from "lib/imageSets";
import { cldThumb, cloudinaryEnabled, uploadToCloudinary } from "lib/cloudinary";

export default function AdminPage() {
  const { user, loading, loggedIn, isAdmin, signIn } = useAuth();
  const [sets, setSets] = useState<ImageSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoadingSets(true);
    fetchImageSets()
      .then(setSets)
      .catch(() => setSets([]))
      .finally(() => setLoadingSets(false));
  };
  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin]);

  const onCreate = async () => {
    if (!user || !newName.trim()) return;
    try {
      await createImageSet(newName, user.uid);
      setNewName("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create set");
    }
  };

  const onUpload = async (setId: string, files: FileList | File[] | null) => {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setBusy(setId);
    setError(null);
    try {
      const uploaded: ImageItem[] = [];
      for (const f of images) uploaded.push(await uploadToCloudinary(f));
      await addImagesToSet(setId, uploaded);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Shell><p className="text-slate-400">Loading…</p></Shell>;
  if (!loggedIn) {
    return (
      <Shell>
        <Notice text="Log in with Google to access the admin area.">
          <button onClick={signIn} className="mt-4 rounded-md bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100">
            Log in with Google
          </button>
        </Notice>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell>
        <Notice text="You don't have admin access. An admin can set isAdmin: true on your user doc in Firestore.">
          <Link href="/" className="mt-4 inline-block rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400">
            Back to menu
          </Link>
        </Notice>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <Link href="/" className="text-sm text-slate-400 hover:text-white">
        ← Back to menu
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Image sets</h1>
      <p className="mt-1 text-sm text-slate-400">
        Group uploaded images into sets. Players can pick a set when creating a game — it mixes with emojis.
      </p>

      {!cloudinaryEnabled && (
        <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300 ring-1 ring-amber-500/30">
          Cloudinary isn’t configured — set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{" "}
          <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in <code>.env.local</code> to enable uploads.
        </p>
      )}
      {error && <p className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}

      {/* Create a set */}
      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          placeholder="New set name (e.g. Animals)"
          className="flex-1 rounded-md bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
        />
        <button
          onClick={onCreate}
          disabled={!newName.trim()}
          className="rounded-md bg-indigo-500 px-4 py-2 font-medium transition-colors hover:bg-indigo-400 disabled:opacity-50"
        >
          Create set
        </button>
      </div>

      {/* Sets */}
      <div className="mt-6 space-y-5">
        {loadingSets ? (
          <p className="text-slate-400">Loading…</p>
        ) : sets.length === 0 ? (
          <p className="text-slate-500">No sets yet — create one above.</p>
        ) : (
          sets.map((s) => (
            <section key={s.id} className="rounded-xl bg-slate-800 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {s.name} <span className="text-sm font-normal text-slate-500">· {s.images.length} images</span>
                </h2>
                <button onClick={() => deleteImageSet(s.id).then(reload)} className="text-xs text-rose-300 hover:underline">
                  Delete set
                </button>
              </div>
              {s.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.images.map((img) => (
                    <div key={img.publicId} className="group relative h-16 w-16 overflow-hidden rounded-md ring-1 ring-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cldThumb(img.url, 120)} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeImageFromSet(s.id, img).then(reload)}
                        className="absolute right-0 top-0 rounded-bl bg-black/60 px-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Dropzone
                onFiles={(files) => onUpload(s.id, files)}
                busy={busy === s.id}
                disabled={!cloudinaryEnabled}
              />
            </section>
          ))
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-slate-900 px-4 pb-12 pt-20 text-slate-100">
      <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>{children}</div>
    </main>
  );
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-800 p-6 text-center">
      <p className="text-slate-300">{text}</p>
      {children}
    </div>
  );
}

function Dropzone({
  onFiles,
  busy,
  disabled,
}: {
  onFiles: (files: FileList | File[]) => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        if (disabled || busy) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled || busy) return;
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && !busy && inputRef.current?.click()}
      className={classNames(
        "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
        disabled
          ? "cursor-not-allowed border-slate-700 text-slate-600"
          : over
          ? "border-indigo-400 bg-indigo-500/10 text-indigo-200"
          : "border-slate-600 text-slate-400 hover:border-indigo-400 hover:text-indigo-300"
      )}
    >
      {busy ? (
        "Uploading…"
      ) : (
        <>
          <span className="text-2xl">⬆️</span>
          <span className="mt-1">
            {over ? "Drop to upload" : "Drag & drop images here, or click to choose"}
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
