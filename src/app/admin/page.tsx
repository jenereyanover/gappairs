"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "context/AuthProvider";
import {
  addImagesToSet,
  createImageSet,
  deleteImageSet,
  fetchImageSets,
  removeImageFromSet,
  renameImageSet,
  setImageSetStatus,
  type ImageItem,
  type ImageSet,
} from "lib/imageSets";
import { cldThumb, cloudinaryEnabled, uploadToCloudinary } from "lib/cloudinary";
import { ACCENT, ACCENT2, GRAD, RADIUS, SCREEN_BG, PANEL_BG, hexA } from "lib/arcade";

const R = RADIUS;
const REC_COUNT = 8; // recommended images per set
const label: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: "#7a83a0", marginBottom: 12 };
const card: React.CSSProperties = { background: "rgba(17,24,40,.6)", border: "1px solid rgba(255,255,255,.08)", borderRadius: R + 6, padding: "clamp(18px,2.5vw,24px)" };

interface Staged {
  id: string;
  previewUrl: string;
  file: File;
}

export default function AdminPage() {
  const { user, loading, loggedIn, isAdmin, signIn } = useAuth();
  const [sets, setSets] = useState<ImageSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [name, setName] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyAdd, setBusyAdd] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);
  const nid = () => `s-${Date.now()}-${++idRef.current}`;

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !expandedId) window.history.length > 1 ? window.history.back() : undefined;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedId]);

  // ---- new-set staging (upload on Save) ----
  const stageFiles = (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setStaged((arr) => [...arr, { id: nid(), previewUrl: String(e.target?.result || ""), file }]);
      reader.readAsDataURL(file);
    });
  };
  const removeStaged = (id: string) => setStaged((arr) => arr.filter((s) => s.id !== id));
  const canSave = name.trim().length > 0 && staged.length >= 2 && cloudinaryEnabled;
  const savePack = async () => {
    if (!canSave || !user || saving) return;
    setSaving(true);
    setError(null);
    try {
      const items: ImageItem[] = [];
      for (const s of staged) items.push(await uploadToCloudinary(s.file));
      const id = await createImageSet(name, user.uid);
      await addImagesToSet(id, items);
      setName("");
      setStaged([]);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save set");
    } finally {
      setSaving(false);
    }
  };

  // ---- existing-set edits ----
  const togglePublish = async (s: ImageSet) => {
    const next = s.status === "published" ? "draft" : "published";
    setSets((arr) => arr.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    try {
      await setImageSetStatus(s.id, next);
    } catch {
      reload();
    }
  };
  const deletePack = async (id: string) => {
    setSets((arr) => arr.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    try {
      await deleteImageSet(id);
    } catch {
      reload();
    }
  };
  const renameLocal = (id: string, nm: string) => setSets((arr) => arr.map((x) => (x.id === id ? { ...x, name: nm } : x)));
  const commitRename = (id: string, nm: string) => renameImageSet(id, nm).catch(() => reload());
  const addToExisting = async (id: string, fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length || !cloudinaryEnabled) return;
    setBusyAdd(id);
    setError(null);
    try {
      const items: ImageItem[] = [];
      for (const f of files) items.push(await uploadToCloudinary(f));
      await addImagesToSet(id, items);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyAdd(null);
    }
  };
  const removeFromExisting = (id: string, image: ImageItem) => {
    setSets((arr) => arr.map((x) => (x.id === id ? { ...x, images: x.images.filter((i) => i.publicId !== image.publicId) } : x)));
    removeImageFromSet(id, image).catch(() => reload());
  };

  if (loading) return <Shell><Centered>Loading…</Centered></Shell>;
  if (!loggedIn) {
    return (
      <Shell>
        <Notice text="Log in with Google to access the admin area.">
          <button onClick={signIn} style={loginBtn}>Log in with Google</button>
        </Notice>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell>
        <Notice text="You don't have admin access. An admin can set isAdmin: true on your user doc in Firestore.">
          <Link href="/" style={backLink}>← Back to menu</Link>
        </Notice>
      </Shell>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SCREEN_BG, color: "#e8ecf6", overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(20px,4vw,40px) clamp(18px,4vw,40px) 60px" }}>
        <Link href="/" className="lb-back" style={{ color: "#9aa3ba", fontSize: 15, fontWeight: 600, textDecoration: "none", padding: "4px 0", display: "inline-flex", alignItems: "center", gap: 8 }}>
          ← Back to menu
        </Link>
        <h1 className="font-display" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "clamp(28px,5vw,42px)", fontWeight: 700, letterSpacing: "-.01em", margin: "14px 0 4px" }}>
          <span>🗂️</span> Tile Packs
        </h1>
        <p style={{ color: "#8b94a8", fontSize: 14.5, margin: "0 0 24px" }}>Upload and manage the image sets players match in a game.</p>

        {!cloudinaryEnabled && (
          <p style={{ background: "rgba(245,197,66,.1)", border: "1px solid rgba(245,197,66,.3)", borderRadius: R, padding: "12px 14px", fontSize: 13.5, color: "#f5c542", marginBottom: 18 }}>
            Cloudinary isn’t configured — set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in <code>.env.local</code> to enable uploads.
          </p>
        )}
        {error && (
          <p style={{ background: "rgba(244,63,94,.12)", border: "1px solid rgba(244,63,94,.35)", borderRadius: R, padding: "12px 14px", fontSize: 13.5, color: "#ff7a8f", marginBottom: 18 }}>{error}</p>
        )}

        <div className="ad-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 22, alignItems: "start" }}>
          {/* New image set */}
          <div style={card}>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 18px" }}>New image set</h2>
            <div style={label}>SET NAME</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landmarks, Animals…"
              maxLength={32}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: R - 4, padding: "11px 13px", color: "#e8ecf6", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 18 }}
            />
            <div style={{ ...label, display: "flex", justifyContent: "space-between" }}>
              <span>IMAGES</span>
              <span style={{ color: staged.length >= REC_COUNT ? "#4ade80" : "#6b7488" }}>
                {staged.length} added{staged.length < REC_COUNT ? ` · ${REC_COUNT}+ recommended` : " ✓"}
              </span>
            </div>
            <DropZone onFiles={stageFiles} disabled={!cloudinaryEnabled} big />
            {staged.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 14 }}>
                {staged.map((s) => (
                  <Thumb key={s.id} src={s.previewUrl} onRemove={() => removeStaged(s.id)} />
                ))}
              </div>
            )}
            <button
              onClick={savePack}
              disabled={!canSave || saving}
              className="c-start font-display"
              style={{ width: "100%", marginTop: 18, background: canSave && !saving ? GRAD : "rgba(255,255,255,.06)", color: canSave && !saving ? "#fff" : "#56607a", border: "none", borderRadius: R - 2, padding: 14, fontWeight: 800, fontSize: 15.5, letterSpacing: ".03em", cursor: canSave && !saving ? "pointer" : "default", boxShadow: canSave && !saving ? `0 0 30px -8px ${hexA(ACCENT, 0.9)}` : "none" }}
            >
              {saving ? "Saving…" : "＋ Save image set"}
            </button>
            {!canSave && !saving && (
              <div style={{ fontSize: 12, color: "#6b7488", marginTop: 10, textAlign: "center" }}>Add a name and at least 2 images to save.</div>
            )}
          </div>

          {/* Existing sets */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Image sets</h2>
              <span style={{ fontSize: 12.5, color: "#6b7488" }}>{sets.length} total</span>
            </div>
            {loadingSets ? (
              <p style={{ color: "#6b7488", fontSize: 13.5 }}>Loading…</p>
            ) : sets.length === 0 ? (
              <p style={{ color: "#6b7488", fontSize: 13.5 }}>No sets yet — create one on the left.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sets.map((p) => {
                  const expanded = expandedId === p.id;
                  const published = p.status === "published";
                  return (
                    <div key={p.id} style={{ borderRadius: R - 2, background: "rgba(255,255,255,.025)", border: `1px solid ${expanded ? hexA(ACCENT2, 0.45) : "rgba(255,255,255,.07)"}`, transition: "all .3s", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px" }}>
                        <button
                          onClick={() => setExpandedId((e) => (e === p.id ? null : p.id))}
                          aria-label="Expand set"
                          style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#9aa3ba", cursor: "pointer", fontFamily: "inherit", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .2s", transform: expanded ? "rotate(90deg)" : "none" }}
                        >
                          ▶
                        </button>
                        <div onClick={() => setExpandedId((e) => (e === p.id ? null : p.id))} style={{ display: "flex", gap: 4, flex: "0 0 auto", cursor: "pointer" }}>
                          {p.images.slice(0, 3).map((im, j) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={j} src={cldThumb(im.url, 90)} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", background: "rgba(255,255,255,.06)" }} />
                          ))}
                          {p.images.length === 0 && <span style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#56607a" }}>🖼</span>}
                        </div>
                        <div onClick={() => setExpandedId((e) => (e === p.id ? null : p.id))} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#e8ecf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: 12.5, color: "#6b7488", marginTop: 2 }}>{p.images.length} {p.images.length === 1 ? "image" : "images"}</div>
                        </div>
                        <button
                          onClick={() => togglePublish(p)}
                          style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, background: published ? "rgba(74,222,128,.12)" : "rgba(255,255,255,.05)", border: `1px solid ${published ? "rgba(74,222,128,.4)" : "rgba(255,255,255,.12)"}`, color: published ? "#4ade80" : "#9aa3ba", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: 999, background: published ? "#4ade80" : "#6b7488" }} />
                          {published ? "Published" : "Draft"}
                        </button>
                        <button
                          onClick={() => deletePack(p.id)}
                          aria-label="Delete set"
                          style={{ flex: "0 0 auto", width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#8b94a8", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          🗑
                        </button>
                      </div>
                      {expanded && (
                        <PackEditPanel
                          pack={p}
                          busy={busyAdd === p.id}
                          onRename={(nm) => renameLocal(p.id, nm)}
                          onRenameCommit={() => commitRename(p.id, p.name)}
                          onAddImages={(files) => addToExisting(p.id, files)}
                          onRemoveImage={(im) => removeFromExisting(p.id, im)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 760px) { .ad-grid { grid-template-columns: 1fr !important; } } .ad-thumb:hover .ad-rm { opacity: 1; }`}</style>
    </div>
  );
}

function PackEditPanel({
  pack,
  busy,
  onRename,
  onRenameCommit,
  onAddImages,
  onRemoveImage,
}: {
  pack: ImageSet;
  busy: boolean;
  onRename: (name: string) => void;
  onRenameCommit: () => void;
  onAddImages: (files: FileList | File[]) => void;
  onRemoveImage: (image: ImageItem) => void;
}) {
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: "#7a83a0", marginBottom: 9 };
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", padding: "16px 16px 18px", background: "rgba(0,0,0,.15)" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={lbl}>SET TITLE</div>
        <input
          value={pack.name}
          onChange={(e) => onRename(e.target.value)}
          onBlur={onRenameCommit}
          maxLength={32}
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: R - 4, padding: "10px 12px", color: "#e8ecf6", fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none" }}
        />
      </div>
      <div style={{ ...lbl, display: "flex", justifyContent: "space-between" }}>
        <span>IMAGES</span>
        <span style={{ color: "#6b7488" }}>{pack.images.length} {pack.images.length === 1 ? "image" : "images"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: 8 }}>
        {pack.images.map((im) => (
          <Thumb key={im.publicId} src={cldThumb(im.url, 120)} onRemove={() => onRemoveImage(im)} />
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <DropZone onFiles={onAddImages} disabled={!cloudinaryEnabled} busy={busy} compact />
      </div>
    </div>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="ad-thumb" style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: R - 5, overflow: "hidden", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove image"
        className="ad-rm"
        style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 6, border: "none", background: "rgba(8,12,22,.8)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, opacity: 0.85 }}
      >
        ✕
      </button>
    </div>
  );
}

function DropZone({
  onFiles,
  disabled,
  busy,
  big,
  compact,
}: {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
  busy?: boolean;
  big?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const blocked = disabled || busy;
  return (
    <div
      onClick={() => !blocked && ref.current?.click()}
      onDragOver={(e) => { if (blocked) return; e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!blocked && e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      style={{
        border: `1.5px dashed ${over ? ACCENT2 : "rgba(255,255,255,.18)"}`,
        background: over ? hexA(ACCENT2, 0.08) : "rgba(255,255,255,.02)",
        borderRadius: compact ? R - 4 : R,
        padding: compact ? "12px" : "26px 16px",
        textAlign: "center",
        cursor: blocked ? "not-allowed" : "pointer",
        color: blocked ? "#56607a" : "#aeb6c8",
        fontSize: compact ? 12.5 : 14,
        fontWeight: 700,
        transition: "all .15s",
      }}
    >
      {busy ? (
        "Uploading…"
      ) : compact ? (
        "＋ Add images"
      ) : (
        <>
          <div style={{ fontSize: big ? 26 : 22, marginBottom: 8 }}>⬆️</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{over ? "Drop to upload" : "Drop images here or click to browse"}</div>
          <div style={{ fontSize: 12, color: "#6b7488", marginTop: 4, fontWeight: 500 }}>PNG, JPG, or SVG · square works best</div>
        </>
      )}
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: SCREEN_BG, color: "#e8ecf6", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(440px, 100%)" }}>{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#9aa3ba", textAlign: "center" }}>{children}</p>;
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: PANEL_BG, border: "1px solid rgba(255,255,255,.1)", borderRadius: RADIUS + 4, padding: 28, textAlign: "center", boxShadow: "0 30px 70px -30px rgba(0,0,0,.8)" }}>
      <p style={{ color: "#cdd4e2", margin: "0 0 14px" }}>{text}</p>
      {children}
    </div>
  );
}

const loginBtn: React.CSSProperties = { background: "#fff", color: "#1a1f2e", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const backLink: React.CSSProperties = { display: "inline-block", color: "#9aa3ba", fontSize: 14, fontWeight: 600, textDecoration: "none" };
