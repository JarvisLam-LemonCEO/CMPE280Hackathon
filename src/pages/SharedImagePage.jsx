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
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { addSharedToGallery } from "../lib/sharing";

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
        return;
      }

      setLoading(true);

      try {
        const snap = await getDoc(doc(db, "uploads", imageId));
        if (!active) return;

        if (snap.exists() && snap.data()?.isShared) {
          setImage({ id: snap.id, ...snap.data() });
        } else {
          setImage(null);
        }
      } catch (err) {
        console.error("shared image load failed", err);
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
  const isOwner = Boolean(user && image?.ownerUid && image.ownerUid === user.uid);
  const alreadyAdded = Boolean(
    user && Array.isArray(image?.sharedWith) && image.sharedWith.includes(user.uid),
  );

  const handleSignInToAdd = () => {
    navigate(
      `/auth?mode=login&next=${encodeURIComponent(`/shared/${imageId}`)}`,
    );
  };

  const handleAddToGallery = async () => {
    if (!user || !image?.id || isThemeImage) return;
    setAddState("loading");
    setAddError("");
    try {
      const result = await addSharedToGallery({
        uploadId: image.id,
        currentUid: user.uid,
      });
      if (!result.ok) {
        if (result.reason === "already-added") {
          setAddError("Already in your gallery.");
        } else if (result.reason === "is-owner") {
          setAddError("This is your own photo.");
        } else {
          setAddError("This photo is no longer available.");
        }
        setAddState("error");
        return;
      }
      setAddState("added");
      navigate("/user-home");
    } catch (err) {
      console.error("add shared to gallery failed", err);
      setAddError("Could not add to your gallery.");
      setAddState("error");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(resolveSharedImageLink(imageId));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("copy shared link failed", err);
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6 text-slate-600 dark:bg-[#1a2035] dark:text-slate-300">
        <p>Loading shared image...</p>
      </main>
    );
  }

  if (!image) {
    return (
      <main className="min-h-screen bg-[#f6f7fb] px-6 py-10 text-slate-900 dark:bg-[#1a2035] dark:text-white">
        <section className="mx-auto max-w-4xl section-card">
          <div className="flex items-center gap-3 text-[#28457a]">
            <ImageIcon size={22} />
            <p className="page-label">Shared image</p>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-[#0f172f] dark:text-white">
            This image link is unavailable
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#64748b] dark:text-slate-400">
            The image may have been deleted or hasn&apos;t been shared
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
    <main className="min-h-screen bg-[#f6f7fb] px-6 py-10 text-slate-900 dark:bg-[#1a2035] dark:text-white sm:px-10 lg:px-16">
      <section className="page-container">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={16} />
            <span>Back to PixelVault</span>
          </Link>

          <button onClick={handleCopyLink} className="btn-primary-sm">
            <span className="inline-flex items-center gap-2">
              <Copy size={16} />
              {copyState === "copied"
                ? "Link copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy share link"}
            </span>
          </button>
        </div>

        <article className="overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-[#222b45] dark:ring-slate-700 lg:grid lg:grid-cols-[minmax(0,1.4fr)_420px]">
          <div className="bg-black">
            <img
              src={image.url}
              alt={image.title}
              className="h-full max-h-[75vh] w-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-between p-8">
            <div>
              <span className="card-theme-badge">{image.themeLabel}</span>
              <h1 className="mt-4 text-3xl font-bold text-[#0f172f] dark:text-white">
                {image.title}
              </h1>
              {image.subtitle && (
                <p className="mt-3 text-[16px] leading-7 text-[#64748b] dark:text-slate-400">
                  {image.subtitle}
                </p>
              )}

              {image.ownerName && (
                <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Shared by {image.ownerName}
                </p>
              )}
            </div>

            <div className="mt-8 space-y-3">
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
                      This is your photo
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
                            : "Add to my photos"}
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
                Open image file
              </a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
