import { useEffect, useMemo, useRef, useState } from "react";
import { X, Globe, Lock, Link2, Send, ChevronDown } from "lucide-react";
import {
  shareWithEmail,
  unshareWithUser,
  setIsShared,
  getUsersByUids,
} from "../lib/sharing";
import { trackEvent } from "../lib/telemetry";
import { contentTypeOf } from "./fileTypeUtils";

function Avatar({ user, size = 32 }) {
  const initial = (
    user?.displayName?.[0] ||
    user?.email?.[0] ||
    "?"
  ).toUpperCase();

  // Stable color from string
  const colors = [
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-fuchsia-500",
    "bg-teal-500",
  ];
  const seed = (user?.uid || user?.email || "?")
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = colors[seed % colors.length];

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || user.email || ""}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white font-semibold ${color}`}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.4) }}
    >
      {initial}
    </div>
  );
}

export default function ShareDialog({
  open,
  onClose,
  upload,
  currentUser,
}) {
  const overlayRef = useRef(null);
  const inputRef = useRef(null);

  const [emailValue, setEmailValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // {kind: "error"|"success", text}

  const [people, setPeople] = useState([]);
  const [ownerUserDoc, setOwnerUserDoc] = useState(null);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const [accessOpen, setAccessOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = Boolean(
    currentUser?.uid && upload?.ownerUid && currentUser.uid === upload.ownerUid,
  );
  const contentType = contentTypeOf(upload);
  const contentLabel = contentType === "video" ? "video" : "photo";
  const storageContentType = upload?.isGeneratedVideo ? "video" : "image";

  const sharedWithKey = (upload?.sharedWith ?? []).join(",");

  // Close on Escape
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset when upload changes / closes
  useEffect(() => {
    if (!open) {
      setEmailValue("");
      setStatusMsg(null);
      setAccessOpen(false);
      setCopied(false);
    } else {
      trackEvent("share_dialog_open", {
        content_type: contentType,
        is_owner: isOwner,
      });
    }
  }, [open, upload?.id, isOwner, contentType]);

  // Load owner + viewer user docs
  useEffect(() => {
    if (!open || !upload) return;
    let cancelled = false;
    setLoadingPeople(true);

    const ownerUid = upload.ownerUid;
    const viewerUids = upload.sharedWith ?? [];
    const idsToFetch = Array.from(
      new Set([ownerUid, ...viewerUids].filter(Boolean)),
    );

    getUsersByUids(idsToFetch)
      .then((docs) => {
        if (cancelled) return;
        const owner = docs.find((u) => u.uid === ownerUid) || null;
        const viewers = docs.filter((u) => u.uid !== ownerUid);
        setOwnerUserDoc(owner);
        setPeople(viewers);
      })
      .catch((err) => {
        console.error("ShareDialog load users failed", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingPeople(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, upload, sharedWithKey]);

  const ownerRow = useMemo(() => {
    if (!upload) return null;
    return {
      uid: upload.ownerUid,
      displayName:
        ownerUserDoc?.displayName || upload.ownerName || ownerUserDoc?.email || "Owner",
      email: ownerUserDoc?.email || "",
      photoURL: ownerUserDoc?.photoURL || "",
    };
  }, [upload, ownerUserDoc]);

  if (!open || !upload) return null;

  const handleAddByEmail = async (e) => {
    e.preventDefault();
    const email = emailValue.trim();
    if (!email || !currentUser || submitting) return;

    setSubmitting(true);
    setStatusMsg(null);
    trackEvent("share_email_start", { content_type: contentType });

    try {
      const result = await shareWithEmail({
        uploadId: upload.id,
        ownerUid: currentUser.uid,
        recipientEmail: email,
        contentType: storageContentType,
      });

      if (!result.ok) {
        const reason = result.reason;
        const text =
          reason === "not-found"
            ? "No user found with that email"
            : reason === "self"
              ? "You can't share with yourself"
              : reason === "already-shared"
                ? "Already shared with that user"
                : `Could not share ${contentLabel}`;
        setStatusMsg({ kind: "error", text });
        trackEvent("share_email_blocked", {
          reason,
          content_type: contentType,
        });
        return;
      }

      // Refresh local people list optimistically
      try {
        const fetched = await getUsersByUids([result.recipientUid]);
        if (fetched.length > 0) {
          setPeople((prev) => {
            if (prev.some((p) => p.uid === fetched[0].uid)) return prev;
            return [...prev, fetched[0]];
          });
        }
      } catch {
        /* non-fatal */
      }

      setEmailValue("");
      setStatusMsg({ kind: "success", text: "Shared!" });
      trackEvent("share", {
        method: "email",
        content_type: contentType,
      });
      window.setTimeout(() => {
        setStatusMsg((cur) => (cur && cur.kind === "success" ? null : cur));
      }, 2000);
    } catch (err) {
      console.error("shareWithEmail failed", err);
      trackEvent("share_email_failed", {
        content_type: contentType,
        error_code: err?.code || err?.name || "error",
      });
      setStatusMsg({ kind: "error", text: `Could not share ${contentLabel}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveViewer = async (uid) => {
    if (!isOwner) return;
    try {
      await unshareWithUser(upload.id, uid, storageContentType);
      setPeople((prev) => prev.filter((p) => p.uid !== uid));
      trackEvent("share_remove_viewer", { content_type: contentType });
    } catch (err) {
      console.error("unshareWithUser failed", err);
      trackEvent("share_remove_viewer_failed", {
        content_type: contentType,
        error_code: err?.code || err?.name || "error",
      });
    }
  };

  const handleSetAccess = async (nextIsShared) => {
    setAccessOpen(false);
    if (!isOwner) return;
    if (Boolean(upload.isShared) === Boolean(nextIsShared)) return;
    try {
      await setIsShared(upload.id, Boolean(nextIsShared), storageContentType);
      trackEvent("share_access_update", {
        content_type: contentType,
        is_shared: Boolean(nextIsShared),
      });
    } catch (err) {
      console.error("setIsShared failed", err);
      trackEvent("share_access_update_failed", {
        content_type: contentType,
        error_code: err?.code || err?.name || "error",
      });
    }
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/shared/${upload.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      trackEvent("share_link_copy", { content_type: contentType });
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("copy link failed", err);
      trackEvent("share_link_copy_failed", {
        content_type: contentType,
        error_code: err?.code || err?.name || "error",
      });
    }
  };

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${upload.title}`}
        className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-[#2a3655] dark:ring-slate-700"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-[#0f172f] dark:text-white">
              Share &ldquo;{upload.title}&rdquo;
            </h2>
            <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
              Add people via email or copy a link
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="shrink-0 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {/* Add by email row */}
          {isOwner && (
            <form onSubmit={handleAddByEmail} className="mb-2">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="Add people by email"
                  disabled={submitting}
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#28457a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !emailValue.trim()}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#28457a] px-4 text-sm font-semibold text-white transition hover:bg-[#1d3456] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
              {statusMsg && (
                <p
                  className={`mt-2 text-xs font-medium ${
                    statusMsg.kind === "error"
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {statusMsg.text}
                </p>
              )}
            </form>
          )}

          {/* People with access */}
          <div className="mt-4">
            <p className="text-sm font-semibold text-[#0f172f] dark:text-slate-200">
              People with access
            </p>
            <ul className="mt-3 space-y-2">
              {/* Owner */}
              {ownerRow && (
                <li className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Avatar user={ownerRow} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#0f172f] dark:text-slate-100">
                      {ownerRow.displayName}
                      {currentUser?.uid === ownerRow.uid && (
                        <span className="ml-1 text-slate-500 dark:text-slate-400">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {ownerRow.email ? `${ownerRow.email} · ` : ""}Owner
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Owner
                  </span>
                </li>
              )}

              {/* Viewers */}
              {loadingPeople && people.length === 0 && (upload.sharedWith?.length ?? 0) > 0 && (
                <li className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Loading people…
                </li>
              )}

              {people.map((p) => (
                <li
                  key={p.uid}
                  className="flex items-center gap-3 rounded-xl px-2 py-2"
                >
                  <Avatar user={p} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#0f172f] dark:text-slate-100">
                      {p.displayName || p.email || "User"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {p.email ? `${p.email} · ` : ""}Viewer
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleRemoveViewer(p.uid)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}

              {!loadingPeople && people.length === 0 && (
                <li className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                  No one else has access yet.
                </li>
              )}
            </ul>
          </div>

          {/* Divider */}
          <div className="my-5 border-t border-slate-200 dark:border-slate-700" />

          {/* General access */}
          <div>
            <p className="text-sm font-semibold text-[#0f172f] dark:text-slate-200">
              General access
            </p>

            <div className="relative mt-3 flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  upload.isShared
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {upload.isShared ? <Globe size={18} /> : <Lock size={18} />}
              </div>

              <div className="min-w-0 flex-1">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setAccessOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#0f172f] hover:underline dark:text-slate-100"
                  >
                    {upload.isShared ? "Anyone with the link" : "Restricted"}
                    <ChevronDown size={14} />
                  </button>
                ) : (
                  <p className="text-sm font-medium text-[#0f172f] dark:text-slate-100">
                    {upload.isShared ? "Anyone with the link" : "Restricted"}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {upload.isShared
                    ? "Anyone on the internet with the link can view"
                    : "Only people with access can open the link"}
                </p>
              </div>

              {accessOpen && isOwner && (
                <div
                  className="absolute left-12 right-0 top-10 z-10 max-w-[18rem] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-[#222b45] dark:ring-slate-700 sm:right-auto sm:w-72"
                >
                  <button
                    type="button"
                    onClick={() => handleSetAccess(false)}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
                      !upload.isShared
                        ? "bg-slate-50 dark:bg-slate-700/60"
                        : ""
                    }`}
                  >
                    <Lock size={16} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>
                      <span className="block font-medium text-[#0f172f] dark:text-slate-100">
                        Restricted
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Only people you add
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAccess(true)}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
                      upload.isShared ? "bg-slate-50 dark:bg-slate-700/60" : ""
                    }`}
                  >
                    <Globe
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    <span>
                      <span className="block font-medium text-[#0f172f] dark:text-slate-100">
                        Anyone with the link
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Can view
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Link2 size={14} />
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#28457a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d3456]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
