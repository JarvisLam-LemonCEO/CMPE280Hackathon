import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { allThemeImages } from "../data/galleryData";
import FilePreview from "../components/FilePreview";
import { contentTypeOf, isImg, isVid } from "../components/fileTypeUtils";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { addSharedToGallery } from "../lib/sharing";
import { measureTrace, trackEvent } from "../lib/telemetry";

const resolveSharedImageLink = (imageId) =>
  `${window.location.origin}/shared/${encodeURIComponent(imageId)}`;

export default function SharedImagePage() {
  const { imageId = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState("idle");
  const [addState, setAddState] = useState("idle");
  const [addError, setAddError] = useState("");

  const themeImage = useMemo(
    () => allThemeImages.find((item) => item.id === imageId) || null,
    [imageId],
  );

  useEffect(() => {
    let active = true;

    async function loadImage() {
      if (themeImage) {
        setImage(themeImage);
        setLoading(false);
        trackEvent("shared_image_view", {
          source: "theme",
          content_type: "image",
        });
        return;
      }

      setLoading(true);

      try {
        const sharedItem = await measureTrace("load_shared_image", async (activeTrace) => {
          const uploadSnap = await getDoc(doc(db, "uploads", imageId));
          if (uploadSnap.exists() && uploadSnap.data()?.isShared) {
            const data = uploadSnap.data();
            const mimeType = String(data.mimeType || "").toLowerCase();
            const isSupportedResourceType =
              !data.resourceType || ["image", "video"].includes(data.resourceType);
            const isSupportedMime =
              !mimeType ||
              mimeType.startsWith("image/") ||
              mimeType.startsWith("video/");

            if (!isSupportedResourceType || !isSupportedMime) return null;

            const resourceType =
              data.resourceType === "video" || mimeType.startsWith("video/")
                ? "video"
                : "image";

            const normalized = {
              ...data,
              resourceType,
              mimeType: data.mimeType || "image/*",
              originalFilename: data.originalFilename || data.title || "",
              annotations: data.annotations || [],
              annotationOverlayUrl: data.annotationOverlayUrl || "",
            };
            if (!isImg(normalized) && !isVid(normalized)) return null;
            const contentType = contentTypeOf(normalized);
            activeTrace?.putAttribute("content_type", contentType);
            return {
              id: uploadSnap.id,
              collectionName: "uploads",
              contentType,
              data: normalized,
            };
          }

          const videoSnap = await getDoc(doc(db, "videos", imageId));
          if (videoSnap.exists() && videoSnap.data()?.isShared) {
            const data = videoSnap.data();
            activeTrace?.putAttribute("content_type", "video");
            return {
              id: videoSnap.id,
              collectionName: "videos",
              contentType: "video",
              data: {
                ...data,
                resourceType: "video",
                mimeType: data.mimeType || "video/mp4",
                originalFilename:
                  data.originalFilename ||
                  `${data.title || "generated-video"}.mp4`,
              },
            };
          }

          return null;
        });
        if (!active) return;

        if (sharedItem) {
          setImage({
            id: sharedItem.id,
            ...sharedItem.data,
            contentType: sharedItem.contentType,
            isGeneratedVideo: sharedItem.collectionName === "videos",
            themeLabel:
              sharedItem.contentType === "video"
                ? "Video"
                : sharedItem.data.themeLabel || "Shared media",
          });
          trackEvent("shared_image_view", {
            source: "public_link",
            content_type: sharedItem.contentType,
          });
        } else {
          setImage(null);
          trackEvent("shared_image_unavailable", { source: "public_link" });
        }
      } catch (err) {
        console.error("shared image load failed", err);
        trackEvent("shared_image_load_failed", {
          error_code: err?.code || err?.name || "error",
        });
        if (active) setImage(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadImage();

    return () => {
      active = false;
    };
  }, [imageId, themeImage]);

  const isThemeImage = Boolean(themeImage);
  const contentType = image?.contentType || contentTypeOf(image);
  const contentLabel = contentType === "video" ? "video" : "photo";
  const storageContentType = image?.isGeneratedVideo ? "video" : "image";
  const openFileLabel = `Open ${contentLabel} file`;
  const isOwner = Boolean(user && image?.ownerUid && image.ownerUid === user.uid);
  const alreadyAdded = Boolean(
    user && Array.isArray(image?.sharedWith) && image.sharedWith.includes(user.uid),
  );

  const handleSignInToAdd = () => {
    trackEvent("shared_image_signin_click", { content_type: contentType });
    navigate(
      `/auth?mode=login&next=${encodeURIComponent(`/shared/${imageId}`)}`,
    );
  };

  const handleAddToGallery = async () => {
    if (!user || !image?.id || isThemeImage) return;
    setAddState("loading");
    setAddError("");
    trackEvent("shared_gallery_add_start", { content_type: contentType });
    try {
      const result = await addSharedToGallery({
        uploadId: image.id,
        currentUid: user.uid,
        contentType: storageContentType,
      });
      if (!result.ok) {
        if (result.reason === "already-added") {
          setAddError("Already in your gallery.");
        } else if (result.reason === "is-owner") {
          setAddError(`This is your own ${contentLabel}.`);
        } else {
          setAddError(`This ${contentLabel} is no longer available.`);
        }
        setAddState("error");
        trackEvent("shared_gallery_add_blocked", {
          reason: result.reason || "unknown",
        });
        return;
      }
      setAddState("added");
      trackEvent("shared_gallery_add_success", { content_type: contentType });
      navigate("/user-home");
    } catch (err) {
      console.error("add shared to gallery failed", err);
      trackEvent("shared_gallery_add_failed", {
        error_code: err?.code || err?.name || "error",
      });
      setAddError("Could not add to your gallery.");
      setAddState("error");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(resolveSharedImageLink(imageId));
      setCopyState("copied");
      trackEvent("shared_link_copy", { source: "shared_page" });
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("copy shared link failed", err);
      trackEvent("shared_link_copy_failed", {
        error_code: err?.code || err?.name || "error",
      });
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6 text-slate-600 dark:bg-[#1a2035] dark:text-slate-300">
        <p>Loading shared media...</p>
      </main>
    );
  }

  if (!image) {
    return (
      <main className="min-h-screen bg-[#f6f7fb] px-6 py-10 text-slate-900 dark:bg-[#1a2035] dark:text-white">
        <section className="mx-auto max-w-4xl section-card">
          <div className="flex items-center gap-3 text-[#28457a]">
            <ImageIcon size={22} />
            <p className="page-label">Shared media</p>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-[#0f172f] dark:text-white">
            This shared link is unavailable
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#64748b] dark:text-slate-400">
            The item may have been deleted or hasn&apos;t been shared
            publicly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/" className="btn-primary">
              Go Home
            </Link>
            <Link
              to="/auth?mode=login"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Sign In
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-slate-900 dark:bg-[#1a2035] dark:text-white sm:px-10 sm:py-10 lg:px-16">
      <section className="page-container">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to PixelVault</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <button onClick={handleCopyLink} className="btn-primary-sm">
            <span className="inline-flex items-center gap-2">
              <Copy size={16} />
              <span className="hidden sm:inline">
                {copyState === "copied"
                  ? "Link copied"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy share link"}
              </span>
              <span className="sm:hidden">
                {copyState === "copied" ? "Copied" : "Copy link"}
              </span>
            </span>
          </button>
        </div>

        <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-[#222b45] dark:ring-slate-700 sm:rounded-[32px] lg:grid lg:grid-cols-[minmax(0,1.4fr)_420px]">
          <div className="flex items-center justify-center bg-black">
            <FilePreview
              file={image}
              alt={image.title}
              fit="contain"
              className="h-[60vh] w-full bg-black lg:h-[75vh]"
              heightClass="h-[60vh] lg:h-[75vh]"
            />
          </div>

          <div className="flex flex-col justify-between p-5 sm:p-8">
            <div>
              <span className="card-theme-badge">{image.themeLabel}</span>
              <h1 className="mt-3 text-2xl font-bold text-[#0f172f] dark:text-white sm:mt-4 sm:text-3xl">
                {image.title}
              </h1>
              {image.subtitle && (
                <p className="mt-3 text-[15px] leading-6 text-[#64748b] dark:text-slate-400 sm:text-[16px] sm:leading-7">
                  {image.subtitle}
                </p>
              )}

              {image.ownerName && (
                <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Shared by {image.ownerName}
                </p>
              )}
              {image.originalFilename && (
                <p className="mt-2 break-all text-sm text-slate-500 dark:text-slate-400">
                  File: {image.originalFilename}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-3 sm:mt-8">
              {!isThemeImage && !authLoading && (
                <>
                  {!user ? (
                    <button
                      onClick={handleSignInToAdd}
                      className="btn-primary w-full"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus size={16} />
                        Sign in to add
                      </span>
                    </button>
                  ) : isOwner ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-center text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      This is your {contentLabel}
                    </div>
                  ) : alreadyAdded ? (
                    <button
                      disabled
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                    >
                      Already in your gallery
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToGallery}
                      disabled={addState === "loading"}
                      className="btn-primary w-full disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus size={16} />
                        {addState === "loading"
                          ? "Adding..."
                          : addState === "added"
                            ? "Added!"
                            : "Add to my gallery"}
                      </span>
                    </button>
                  )}
                  {addState === "error" && addError && (
                    <p className="text-center text-xs font-semibold text-red-500">
                      {addError}
                    </p>
                  )}
                </>
              )}

              <button onClick={handleCopyLink} className="btn-primary w-full">
                <span className="inline-flex items-center gap-2">
                  <Copy size={16} />
                  {copyState === "copied" ? "Link copied" : "Copy share link"}
                </span>
              </button>

              <a
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ExternalLink size={16} />
                {openFileLabel}
              </a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
