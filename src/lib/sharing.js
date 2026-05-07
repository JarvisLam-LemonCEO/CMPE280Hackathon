import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  documentId,
} from "firebase/firestore";
import { db } from "./firebase";
import { measureTrace } from "./telemetry";

const collectionForContent = (contentType = "image") =>
  contentType === "video" ? "videos" : "uploads";

// Find a user's UID by their email. Returns null if not found.
export async function findUidByEmail(email) {
  return measureTrace("find_user_by_email", async (activeTrace) => {
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return null;
    const q = query(collection(db, "users"), where("email", "==", normalized));
    const snap = await getDocs(q);
    activeTrace?.putMetric("result_count", snap.size);
    if (snap.empty) return null;
    return snap.docs[0].id;
  });
}

// Owner shares a photo with another user by email.
// Returns { ok: true, recipientUid } on success,
// { ok: false, reason: "not-found" | "already-shared" | "self" } otherwise.
export async function shareWithEmail({
  uploadId,
  ownerUid,
  recipientEmail,
  contentType = "image",
}) {
  return measureTrace("share_with_email", async (activeTrace) => {
    activeTrace?.putAttribute("content_type", contentType);
    const recipientUid = await findUidByEmail(recipientEmail);
    if (!recipientUid) return { ok: false, reason: "not-found" };
    if (recipientUid === ownerUid) return { ok: false, reason: "self" };

    const ref = doc(db, collectionForContent(contentType), uploadId);
    const snap = await getDoc(ref);
    const sharedWith = snap.data()?.sharedWith ?? [];
    activeTrace?.putMetric("shared_with_count", sharedWith.length);
    if (sharedWith.includes(recipientUid)) {
      return { ok: false, reason: "already-shared" };
    }

    await updateDoc(ref, { sharedWith: arrayUnion(recipientUid) });
    return { ok: true, recipientUid };
  });
}

// Recipient adds a shared photo to their gallery.
// Returns { ok: true } or { ok: false, reason: "not-found" | "already-added" | "is-owner" }.
export async function addSharedToGallery({
  uploadId,
  currentUid,
  contentType = "image",
}) {
  return measureTrace("add_shared_to_gallery", async (activeTrace) => {
    activeTrace?.putAttribute("content_type", contentType);
    const ref = doc(db, collectionForContent(contentType), uploadId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, reason: "not-found" };
    const data = snap.data();
    if (data.ownerUid === currentUid) return { ok: false, reason: "is-owner" };
    const sharedWith = data.sharedWith ?? [];
    activeTrace?.putMetric("shared_with_count", sharedWith.length);
    if (sharedWith.includes(currentUid)) {
      return { ok: false, reason: "already-added" };
    }
    await updateDoc(ref, { sharedWith: arrayUnion(currentUid) });
    return { ok: true };
  });
}

// Recipient removes a shared photo from their gallery.
export async function removeFromMyGallery({
  uploadId,
  currentUid,
  contentType = "image",
}) {
  await measureTrace("remove_from_my_gallery", async () => {
    await updateDoc(doc(db, collectionForContent(contentType), uploadId), {
      sharedWith: arrayRemove(currentUid),
    });
  });
}

// Given an array of UIDs, fetch their user docs.
// Returns array of { uid, email, displayName, photoURL }.
// Uses Firestore "in" query (max 30 ids per batch, so chunk if needed).
export async function getUsersByUids(uids) {
  return measureTrace("get_users_by_uids", async (activeTrace) => {
    if (!uids || uids.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    const all = [];
    for (const chunk of chunks) {
      const q = query(collection(db, "users"), where(documentId(), "in", chunk));
      const snap = await getDocs(q);
      snap.forEach((d) => all.push({ uid: d.id, ...d.data() }));
    }
    activeTrace?.putMetric("requested_count", uids.length);
    activeTrace?.putMetric("result_count", all.length);
    activeTrace?.putMetric("batch_count", chunks.length);
    return all;
  });
}

// Toggle the public-link visibility (`isShared` field).
export async function setIsShared(uploadId, isShared, contentType = "image") {
  await measureTrace("set_public_share_access", async (activeTrace) => {
    activeTrace?.putAttribute("is_shared", isShared ? "true" : "false");
    activeTrace?.putAttribute("content_type", contentType);
    await updateDoc(doc(db, collectionForContent(contentType), uploadId), { isShared });
  });
}

// Owner removes a specific UID from sharedWith.
export async function unshareWithUser(uploadId, uidToRemove, contentType = "image") {
  await measureTrace("unshare_with_user", async () => {
    await updateDoc(doc(db, collectionForContent(contentType), uploadId), {
      sharedWith: arrayRemove(uidToRemove),
    });
  });
}
