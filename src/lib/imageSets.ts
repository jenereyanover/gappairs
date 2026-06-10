// Firestore layer for admin-managed image sets (categories of uploaded images).
//
//   imageSets/{id} -> { name, images: [{url, publicId}], status, createdBy, createdAt }
//
// `status` is "published" | "draft": only published sets appear in the game's
// tile-pack picker. Sets without a status field are treated as published (so
// pre-existing sets keep showing). Public read (players pick a set when creating
// a game); writes are admin-only, enforced by Firestore rules.
import { db } from "lib/firebase";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

export type ImageSetStatus = "published" | "draft";

export interface ImageItem {
  url: string;
  publicId: string;
}

export interface ImageSet {
  id: string;
  name: string;
  images: ImageItem[];
  status: ImageSetStatus;
}

export async function fetchImageSets(): Promise<ImageSet[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "imageSets"), orderBy("name")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? "Untitled",
      images: (data.images ?? []) as ImageItem[],
      status: (data.status as ImageSetStatus) ?? "published",
    };
  });
}

export async function fetchImageSet(id: string): Promise<ImageSet | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "imageSets", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name ?? "Untitled",
    images: (data.images ?? []) as ImageItem[],
    status: (data.status as ImageSetStatus) ?? "published",
  };
}

export async function createImageSet(name: string, uid: string): Promise<string> {
  if (!db) throw new Error("Firestore not configured");
  const ref = await addDoc(collection(db, "imageSets"), {
    name: name.trim().slice(0, 40) || "Untitled",
    images: [],
    status: "draft" as ImageSetStatus,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Rename a set. */
export async function renameImageSet(id: string, name: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "imageSets", id), { name: name.trim().slice(0, 40) || "Untitled" });
}

/** Publish or unpublish a set (only published sets show in the game picker). */
export async function setImageSetStatus(id: string, status: ImageSetStatus): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "imageSets", id), { status });
}

export async function addImagesToSet(id: string, images: ImageItem[]): Promise<void> {
  if (!db || !images.length) return;
  await updateDoc(doc(db, "imageSets", id), { images: arrayUnion(...images) });
}

export async function removeImageFromSet(id: string, image: ImageItem): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "imageSets", id), { images: arrayRemove(image) });
}

export async function deleteImageSet(id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "imageSets", id));
}
