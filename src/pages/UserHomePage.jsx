import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { themeById, themeData } from "../data/galleryData";
import { ThemeToggle } from "../ThemeContext";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { uploadToCloudinary } from "../lib/cloudinary";
import {
  Image as ImageIcon,
  LogOut,
  User,
  Trash2,
  Upload,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Share2,
  FolderPlus,
  Images,
  Pencil,
  Plus,
  Minus,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";



/* ------------------------------------ */
/* Utilities */
/* ------------------------------------ */

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const formatCommentDate = (timestamp) => {
  const ms = toMillis(timestamp);
  if (!ms) return "just now";
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(navigator.language, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const resolveShareLink = (imageId) =>
  `${window.location.origin}/shared/${encodeURIComponent(imageId)}`;

const isOwnedUpload = (image, user) =>
  Boolean(image?.ownerUid && user?.uid && image.ownerUid === user.uid);

/* ------------------------------------ */
/* Comment Component */
/* ------------------------------------ */

const ImageWithComments = ({ imageId, currentUid, onAdd, onDelete }) => {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!imageId) return undefined;

    const q = query(
      collection(db, "comments"),
      where("imageId", "==", imageId),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("comments snapshot error", err);
      },
    );

    return unsub;
  }, [imageId]);

  const handleAddComment = async () => {
    const text = comment.trim();
    if (!text) return;
    await onAdd(imageId, text);
    setComment("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddComment();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="comment-input-area shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            className="comment-input"
          />
          <button
            onClick={handleAddComment}
            disabled={!comment.trim()}
            className="comment-post-btn"
          >
            Post
          </button>
        </div>
      </div>

      <div className="comment-list">
        {comments.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
            No comments yet
          </p>
        ) : (
          comments.map((item) => (
            <div key={item.id} className="comment-item">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {item.authorName && (
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {item.authorName}
                    </p>
                  )}
                  <p className="break-words text-sm text-slate-900 dark:text-slate-200">
                    {item.text}
                  </p>
                  <span className="mt-1 inline-block text-xs text-slate-400 dark:text-slate-500">
                    {formatCommentDate(item.createdAt)}
                  </span>
                </div>
                {item.authorUid === currentUid && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="comment-delete-btn"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* ------------------------------------ */
/* Photo Detail Modal */
/* ------------------------------------ */

const PhotoDetailModal = ({
  image,
  images,
  onClose,
  onNavigate,
  currentUid,
  addComment,
  deleteComment,
  onShare,
  onStopSharing,
  shareState,
  canStopSharing,
  isShared,
}) => {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate(-1);
      if (e.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNavigate]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const currentIndex = images.findIndex((img) => img.id === image.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  return (
    <div
      ref={overlayRef}
      className="photo-modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="photo-modal-box">
        <button onClick={onClose} className="photo-modal-close">
          <X size={18} />
        </button>

        {hasPrev && (
          <button
            onClick={() => onNavigate(-1)}
            className="photo-modal-nav-btn left-4"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {hasNext && (
          <button
            onClick={() => onNavigate(1)}
            className="photo-modal-nav-btn right-4"
          >
            <ChevronRight size={22} />
          </button>
        )}

        <div className="photo-modal-image-panel">
          <img src={image.url} alt={image.title} className="photo-modal-img" />
        </div>

        <div className="photo-modal-info-panel">
          <span className="photo-modal-theme-badge">{image.themeLabel}</span>

          <h2 className="mt-3 text-2xl font-bold text-[#0f172f] dark:text-white">
            {image.title}
          </h2>

          {image.subtitle && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {image.subtitle}
            </p>
          )}

          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {currentIndex + 1} / {images.length}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onShare(image)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#28457a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d3456]"
            >
              <Share2 size={16} />
              <span>
                {shareState === "copied"
                  ? "Link copied"
                  : shareState === "unshared"
                    ? "Stopped sharing"
                    : shareState === "error"
                      ? "Copy failed"
                      : "Copy share link"}
              </span>
            </button>

            {isShared && (
              <a
                href={resolveShareLink(image.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Open share page
              </a>
            )}

            {canStopSharing && isShared && (
              <button
                onClick={() => onStopSharing(image)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
              >
                {shareState === "unshared" ? "Stopped sharing" : "Stop sharing"}
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-1 flex-col overflow-hidden border-t border-slate-100 pt-4 dark:border-slate-700">
            <p className="mb-2 shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Comments
            </p>
            <ImageWithComments
              key={image.id}
              imageId={image.id}
              currentUid={currentUid}
              onAdd={addComment}
              onDelete={deleteComment}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------ */
/* Main Page */
/* ------------------------------------ */

function UserHomePage() {
  const navigate = useNavigate();
  const { user, profile, loading, logout } = useAuth();

  const [viewMode, setViewMode] = useState("photos");
  const [activeTheme, setActiveTheme] = useState("all");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [activeAlbumId, setActiveAlbumId] = useState(null);

  const [uploadTheme, setUploadTheme] = useState(themeData[0]?.id || "nature");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);

  const [newAlbumName, setNewAlbumName] = useState("");
  const [renameAlbumValue, setRenameAlbumValue] = useState("");

  const [uploading, setUploading] = useState(false);
  const [albumSaving, setAlbumSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailImage, setDetailImage] = useState(null);
  const [likesMap, setLikesMap] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [shareStatus, setShareStatus] = useState({
    imageId: "",
    state: "idle",
  });

  const [hiddenGalleryIds, setHiddenGalleryIds] = useState(() => {
    try {
      const raw = localStorage.getItem("hiddenGalleryIds");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });

  const displayName = profile?.displayName || user?.email || "";

  const flatThemeImages = useMemo(() => {
    return themeData.flatMap((theme) =>
      (theme.images || []).map((image) => ({
        ...image,
        themeId: image.themeId || theme.id,
        themeLabel: image.themeLabel || theme.label,
      })),
    );
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?mode=login");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "hiddenGalleryIds",
      JSON.stringify([...hiddenGalleryIds]),
    );
  }, [hiddenGalleryIds]);

  useEffect(() => {
    if (!user) {
      setUploadedImages([]);
      return undefined;
    }

    const q = query(
      collection(db, "uploads"),
      where("ownerUid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setUploadedImages(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              subtitle: data.subtitle,
              url: data.url,
              publicId: data.publicId,
              themeId: data.themeId,
              themeLabel: data.themeLabel,
              createdAt: toMillis(data.createdAt),
              ownerUid: data.ownerUid,
              ownerName: data.ownerName,
              isShared: Boolean(data.isShared),
            };
          }),
        );
      },
      (err) => {
        console.error("uploads snapshot error", err);
        alert(err?.message || "Uploads failed to load.");
      },
    );

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAlbums([]);
      return undefined;
    }

    const q = query(
      collection(db, "albums"),
      where("ownerUid", "==", user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || "Untitled album",
              coverPhotoId: data.coverPhotoId || "",
              ownerUid: data.ownerUid,
              ownerName: data.ownerName,
              createdAt: toMillis(data.createdAt),
              updatedAt: toMillis(data.updatedAt),
            };
          })
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        setAlbums(next);
      },
      (err) => {
        console.error("albums snapshot error", err);
        alert(err?.message || "Album list failed to load.");
      },
    );

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAlbumPhotos([]);
      return undefined;
    }

    const q = query(
      collection(db, "albumPhotos"),
      where("ownerUid", "==", user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              albumId: data.albumId,
              photoId: data.photoId,
              ownerUid: data.ownerUid,
              order: typeof data.order === "number" ? data.order : 0,
              addedAt: toMillis(data.addedAt),
            };
          })
          .sort((a, b) => {
            if (a.albumId !== b.albumId) {
              return String(a.albumId).localeCompare(String(b.albumId));
            }
            return (a.order || 0) - (b.order || 0);
          });

        setAlbumPhotos(next);
      },
      (err) => {
        console.error("albumPhotos snapshot error", err);
        alert(err?.message || "Album photos failed to load.");
      },
    );

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLikesMap({});
      return undefined;
    }

    const q = query(collection(db, "likes"), where("uid", "==", user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data?.imageId) next[data.imageId] = true;
        });
        setLikesMap(next);
      },
      (err) => {
        console.error("likes snapshot error", err);
      },
    );

    return unsub;
  }, [user]);

  const activeAlbum = useMemo(
    () => albums.find((album) => album.id === activeAlbumId) || null,
    [albums, activeAlbumId],
  );

  useEffect(() => {
    if (activeAlbum) {
      setRenameAlbumValue(activeAlbum.name || "");
    } else {
      setRenameAlbumValue("");
    }
  }, [activeAlbum]);

  const allPhotosMap = useMemo(() => {
    return new Map(
      [...uploadedImages, ...flatThemeImages].map((img) => [
        img.id,
        {
          ...img,
          themeLabel: img.themeLabel || themeById[img.themeId]?.label || "Gallery",
        },
      ]),
    );
  }, [uploadedImages, flatThemeImages]);

  const imagesToRender = useMemo(() => {
    const sortedUploads = [...uploadedImages].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    );

    if (viewMode === "albums" && activeAlbum) {
      const relations = albumPhotos
        .filter((item) => item.albumId === activeAlbum.id)
        .sort((a, b) => a.order - b.order);

      return relations
        .map((rel) => allPhotosMap.get(rel.photoId))
        .filter(Boolean);
    }

    if (activeTheme === "all") {
      const galleryImages = flatThemeImages.filter(
        (img) => !hiddenGalleryIds.has(img.id),
      );
      return [...sortedUploads, ...galleryImages];
    }

    const selectedTheme = themeById[activeTheme];
    if (!selectedTheme) return [];

    const uploadsForTheme = sortedUploads.filter(
      (image) => image.themeId === activeTheme,
    );

    return [
      ...uploadsForTheme,
      ...(selectedTheme.images || [])
        .filter((img) => !hiddenGalleryIds.has(img.id))
        .map((image) => ({
          ...image,
          themeId: image.themeId || selectedTheme.id,
          themeLabel: image.themeLabel || selectedTheme.label,
        })),
    ];
  }, [
    viewMode,
    activeAlbum,
    albumPhotos,
    uploadedImages,
    flatThemeImages,
    activeTheme,
    hiddenGalleryIds,
    allPhotosMap,
  ]);

  const filteredImages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) return imagesToRender;

    return imagesToRender.filter((image) => {
      const title = image.title?.toLowerCase() || "";
      const subtitle = image.subtitle?.toLowerCase() || "";
      return title.includes(normalizedQuery) || subtitle.includes(normalizedQuery);
    });
  }, [imagesToRender, searchQuery]);

  const albumCards = useMemo(() => {
    return albums.map((album) => {
      const relations = albumPhotos
        .filter((item) => item.albumId === album.id)
        .sort((a, b) => a.order - b.order);

      const coverId = album.coverPhotoId || relations[0]?.photoId || "";
      const coverImage = coverId ? allPhotosMap.get(coverId) : null;

      return {
        ...album,
        count: relations.length,
        coverUrl: coverImage?.url || "",
      };
    });
  }, [albums, albumPhotos, allPhotosMap]);

  useEffect(() => {
    const ids = filteredImages.map((img) => img.id).filter(Boolean);

    if (ids.length === 0) {
      setCommentCounts({});
      return undefined;
    }

    const unsubs = ids.map((imageId) => {
      const q = query(
        collection(db, "comments"),
        where("imageId", "==", imageId),
      );

      return onSnapshot(
        q,
        (snap) => {
          setCommentCounts((prev) => ({ ...prev, [imageId]: snap.size }));
        },
        (err) => {
          console.error("comment count snapshot error", err);
        },
      );
    });

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [filteredImages]);

  const toggleLike = async (imageId) => {
    if (!user || !imageId) return;

    const likeId = `${user.uid}_${imageId}`;
    const ref = doc(db, "likes", likeId);
    const already = Boolean(likesMap[imageId]);

    setLikesMap((prev) => ({ ...prev, [imageId]: !already }));

    try {
      if (already) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          uid: user.uid,
          imageId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("toggleLike failed", err);
      setLikesMap((prev) => ({ ...prev, [imageId]: already }));
    }
  };

  const addComment = async (imageId, text) => {
    if (!user || !imageId || !text) return;
    try {
      await addDoc(collection(db, "comments"), {
        imageId,
        authorUid: user.uid,
        authorName: profile?.displayName || user.email || "",
        authorPhotoURL: profile?.photoURL || "",
        text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("addComment failed", err);
      alert("Could not post comment.");
    }
  };

  const deleteComment = async (commentId) => {
    if (!commentId) return;
    try {
      await deleteDoc(doc(db, "comments", commentId));
    } catch (err) {
      console.error("deleteComment failed", err);
      alert("Could not delete comment.");
    }
  };

  const updateLocalImageShareState = (imageId, isShared) => {
    setUploadedImages((prev) =>
      prev.map((item) => (item.id === imageId ? { ...item, isShared } : item)),
    );
    setDetailImage((prev) =>
      prev?.id === imageId ? { ...prev, isShared } : prev,
    );
  };

  const updateSharedUpload = async (image) => {
    if (!image?.id || !isOwnedUpload(image, user)) return;

    try {
      const uploadRef = doc(db, "uploads", image.id);
      const uploadSnap = await getDoc(uploadRef);
      if (uploadSnap.exists() && !uploadSnap.data()?.isShared) {
        updateLocalImageShareState(image.id, true);
        await updateDoc(uploadRef, {
          isShared: true,
          sharedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("mark shared upload failed", err);
    }
  };

  const stopSharingUpload = async (image) => {
    if (!image?.id || !isOwnedUpload(image, user)) return;

    try {
      updateLocalImageShareState(image.id, false);
      await updateDoc(doc(db, "uploads", image.id), {
        isShared: false,
      });
      setShareStatus({ imageId: image.id, state: "unshared" });
      window.setTimeout(() => {
        setShareStatus((current) =>
          current.imageId === image.id ? { imageId: "", state: "idle" } : current,
        );
      }, 2000);
    } catch (err) {
      console.error("stop sharing upload failed", err);
      updateLocalImageShareState(image.id, true);
      setShareStatus({ imageId: image.id, state: "error" });
    }
  };

  const handleShareImage = async (image) => {
    if (!image?.id) return;

    const shareLink = resolveShareLink(image.id);
    setShareStatus({ imageId: image.id, state: "idle" });

    await updateSharedUpload(image);

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus({ imageId: image.id, state: "copied" });
    } catch (err) {
      console.error("share image failed", err);
      setShareStatus({ imageId: image.id, state: "error" });
    }

    window.setTimeout(() => {
      setShareStatus((current) =>
        current.imageId === image.id ? { imageId: "", state: "idle" } : current,
      );
    }, 2000);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const uploadedIds = new Set(uploadedImages.map((img) => img.id));
    const toHide = [...selectedIds].filter((id) => !uploadedIds.has(id));
    const toDelete = [...selectedIds].filter((id) => uploadedIds.has(id));

    if (toHide.length > 0) {
      setHiddenGalleryIds((prev) => new Set([...prev, ...toHide]));
    }

    for (const id of toDelete) {
      try {
        await deleteDoc(doc(db, "uploads", id));
      } catch (err) {
        console.error("delete upload failed", err);
      }
    }

    const relationsToDelete = albumPhotos.filter((rel) =>
      selectedIds.has(rel.photoId),
    );

    for (const rel of relationsToDelete) {
      try {
        await deleteDoc(doc(db, "albumPhotos", rel.id));
      } catch (err) {
        console.error("delete album photo relation failed", err);
      }
    }

    setSelectedIds(new Set());
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    const name = newAlbumName.trim();
    if (!name || !user) return;

    try {
      setAlbumSaving(true);
      const ref = await addDoc(collection(db, "albums"), {
        ownerUid: user.uid,
        ownerName: displayName,
        name,
        coverPhotoId: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewAlbumName("");
      setShowCreateAlbumModal(false);
      setViewMode("albums");
      setActiveAlbumId(ref.id);
    } catch (err) {
      console.error("create album failed", err);
      alert(err?.message || "Could not create album.");
    } finally {
      setAlbumSaving(false);
    }
  };

  const handleRenameAlbum = async () => {
    if (!activeAlbum || !renameAlbumValue.trim()) return;

    try {
      setAlbumSaving(true);
      await updateDoc(doc(db, "albums", activeAlbum.id), {
        name: renameAlbumValue.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("rename album failed", err);
      alert(err?.message || "Could not rename album.");
    } finally {
      setAlbumSaving(false);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!activeAlbum || !user) return;

    const confirmed = window.confirm(
      `Delete album "${activeAlbum.name}"? Photos will stay in your library.`,
    );
    if (!confirmed) return;

    try {
      setAlbumSaving(true);

      const relations = albumPhotos.filter(
        (item) => item.albumId === activeAlbum.id,
      );

      const batch = writeBatch(db);

      relations.forEach((rel) => {
        batch.delete(doc(db, "albumPhotos", rel.id));
      });

      batch.delete(doc(db, "albums", activeAlbum.id));

      await batch.commit();

      setActiveAlbumId(null);
      setViewMode("albums");
    } catch (err) {
      console.error("delete album failed", err);
      alert(err?.message || "Could not delete album.");
    } finally {
      setAlbumSaving(false);
    }
  };

  const handleAddSelectedToAlbum = async (albumId) => {
    if (!albumId || selectedIds.size === 0 || !user) return;

    try {
      setAlbumSaving(true);

      const currentRelations = albumPhotos
        .filter((item) => item.albumId === albumId)
        .sort((a, b) => a.order - b.order);

      const existingPhotoIds = new Set(currentRelations.map((item) => item.photoId));
      let nextOrder =
        currentRelations.length > 0
          ? currentRelations[currentRelations.length - 1].order + 1
          : 0;

      const selected = [...selectedIds];
      let firstAddedId = null;

      for (const photoId of selected) {
        if (existingPhotoIds.has(photoId)) continue;
        if (!firstAddedId) firstAddedId = photoId;

        await addDoc(collection(db, "albumPhotos"), {
          ownerUid: user.uid,
          albumId,
          photoId,
          order: nextOrder,
          addedAt: serverTimestamp(),
        });

        nextOrder += 1;
      }

      const albumRef = doc(db, "albums", albumId);
      const albumSnap = await getDoc(albumRef);

      if (albumSnap.exists() && !albumSnap.data()?.coverPhotoId && firstAddedId) {
        await updateDoc(albumRef, {
          coverPhotoId: firstAddedId,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(albumRef, {
          updatedAt: serverTimestamp(),
        });
      }

      setShowAddToAlbumModal(false);
      setSelectedIds(new Set());
      setViewMode("albums");
      setActiveAlbumId(albumId);
    } catch (err) {
      console.error("add selected to album failed", err);
      alert(err?.message || "Could not add photos to album.");
    } finally {
      setAlbumSaving(false);
    }
  };

  const handleRemoveFromAlbum = async (imageId) => {
    if (!activeAlbum || !imageId) return;

    try {
      const rel = albumPhotos.find(
        (item) => item.albumId === activeAlbum.id && item.photoId === imageId,
      );
      if (!rel) return;

      await deleteDoc(doc(db, "albumPhotos", rel.id));

      const remainingRelations = albumPhotos
        .filter((item) => item.albumId === activeAlbum.id && item.id !== rel.id)
        .sort((a, b) => a.order - b.order);

      const nextCoverId = remainingRelations[0]?.photoId || "";

      await updateDoc(doc(db, "albums", activeAlbum.id), {
        coverPhotoId: nextCoverId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("remove from album failed", err);
      alert(err?.message || "Could not remove photo from album.");
    }
  };

  const handleAlbumDragEnd = async (result) => {
    if (!activeAlbum) return;
    if (!result.destination) return;
    if (searchQuery.trim()) {
      alert("Clear search before rearranging album photos.");
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const relations = albumPhotos
      .filter((item) => item.albumId === activeAlbum.id)
      .sort((a, b) => a.order - b.order);

    const reordered = [...relations];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, moved);

    try {
      setAlbumSaving(true);

      const batch = writeBatch(db);

      reordered.forEach((item, index) => {
        batch.update(doc(db, "albumPhotos", item.id), {
          order: index,
        });
      });

      batch.update(doc(db, "albums", activeAlbum.id), {
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      console.error("drag reorder failed", err);
      alert(err?.message || "Could not reorder album photos.");
    } finally {
      setAlbumSaving(false);
    }
  };

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!uploadFile || !uploadDescription.trim() || !uploadTitle.trim()) return;
    if (!user) {
      alert("Please log in before uploading.");
      return;
    }

    try {
      setUploading(true);
      const { url, publicId } = await uploadToCloudinary(uploadFile);

      await addDoc(collection(db, "uploads"), {
        ownerUid: user.uid,
        ownerName: displayName,
        title: uploadTitle.trim(),
        subtitle: uploadDescription.trim(),
        url,
        publicId,
        themeId: uploadTheme,
        themeLabel: themeById[uploadTheme]?.label || "",
        isShared: false,
        createdAt: serverTimestamp(),
      });

      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      setShowUploadModal(false);
    } catch (err) {
      console.error("upload failed", err);
      alert(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("logout failed", err);
    }
    navigate("/");
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] text-slate-600 dark:bg-[#1a2035] dark:text-slate-300">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <>
      <header
        className={`fixed top-0 z-50 flex w-full justify-center transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 py-4 shadow-sm backdrop-blur-md dark:bg-[#222b45]/80"
            : "bg-white py-6 shadow-sm dark:bg-[#222b45] dark:shadow-slate-900"
        }`}
      >
        <div className="flex w-full max-w-360 items-center justify-between px-6 sm:px-10 lg:px-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#000d33] to-[#28457a] shadow-lg">
              <ImageIcon size={20} className="text-white" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight text-[#0f172f] dark:text-white">
              Pixel<span className="text-[#28457a]">Vault</span>
            </h2>
          </Link>

          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => setShowAddToAlbumModal(true)}
                  className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Plus size={16} />
                  <span>Add to album ({selectedIds.size})</span>
                </button>

                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                >
                  <Trash2 size={16} />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              </>
            )}

            <button
              onClick={() => setShowCreateAlbumModal(true)}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              <FolderPlus size={16} />
              <span className="hidden sm:inline">Create Album</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <button
              onClick={() => navigate("/user-profile")}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[#0f172f] transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <User size={16} />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-red-100 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <LogOut
                size={16}
                className="transition-transform group-hover:-translate-x-0.5"
              />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-[#f6f7fb] px-6 pb-8 text-slate-900 dark:bg-[#1a2035] dark:text-white sm:px-10 lg:px-16">
        <div className="page-container pt-28 pb-0">
          <div className="section-card">
            <p className="page-label">User dashboard</p>
            <h1 className="page-title">
              {viewMode === "albums"
                ? activeAlbum
                  ? activeAlbum.name
                  : "Albums"
                : "Themed Image Gallery"}
            </h1>

            <p className="mt-2 max-w-190 text-[17px] text-[#64748b] dark:text-slate-400">
              {viewMode === "albums"
                ? activeAlbum
                  ? "View and organize photos inside this album."
                  : "Create albums and organize your photos like Google Photos."
                : "Browse sample images organized by theme and add photos to albums."}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setViewMode("photos");
                  setActiveAlbumId(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "photos"
                    ? "bg-[#28457a] text-white shadow-md"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Images size={16} />
                Photos
              </button>

              <button
                onClick={() => {
                  setViewMode("albums");
                  setActiveAlbumId(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "albums" && !activeAlbum
                    ? "bg-[#28457a] text-white shadow-md"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <FolderPlus size={16} />
                Albums
              </button>

              {activeAlbum && (
                <button
                  onClick={() => setActiveAlbumId(null)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Back to Albums
                </button>
              )}
            </div>

            {viewMode === "photos" && (
              <>
                <div className="relative mt-6 max-w-130">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search images by title or description..."
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-700"
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Filter:
                  </span>

                  <button
                    onClick={() => setActiveTheme("all")}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      activeTheme === "all"
                        ? "bg-[#28457a] text-white shadow-md"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    All
                  </button>

                  {themeData.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setActiveTheme(theme.id)}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                        activeTheme === theme.id
                          ? `${theme.accentClass} shadow-md ring-2 ring-slate-400 ring-offset-2 ring-offset-white dark:ring-slate-600 dark:ring-offset-[#1a2035]`
                          : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {viewMode === "albums" && activeAlbum && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/20">
                <input
                  type="text"
                  value={renameAlbumValue}
                  onChange={(e) => setRenameAlbumValue(e.target.value)}
                  placeholder="Album name"
                  className="h-11 min-w-[240px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />

                <button
                  onClick={handleRenameAlbum}
                  disabled={albumSaving || !renameAlbumValue.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                >
                  <Pencil size={16} />
                  Rename Album
                </button>

                <button
                  onClick={handleDeleteAlbum}
                  disabled={albumSaving}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <Trash2 size={16} />
                  Delete Album
                </button>
              </div>
            )}
          </div>
        </div>

        {viewMode === "photos" ? (
          <section className="page-container mt-8 section-card">
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredImages.map((image) => {
                const isSelected = selectedIds.has(image.id);

                return (
                  <article
                    key={image.id}
                    className={`overflow-hidden rounded-3xl bg-white ring-2 dark:bg-[#2a3655] ${
                      isSelected
                        ? "ring-indigo-500"
                        : "ring-slate-200 dark:ring-slate-700"
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={image.url}
                        alt={image.title}
                        onClick={() => setDetailImage(image)}
                        className="gallery-card-img"
                      />
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(image.id)}
                        className="absolute right-3 top-3 h-5 w-5 cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <div className="gallery-card-body">
                      <span className="card-theme-badge">{image.themeLabel}</span>
                      <h2 className="card-title">{image.title}</h2>
                      <p className="card-subtitle">{image.subtitle}</p>

                      <div className="card-stats">
                        <button
                          onClick={() => toggleLike(image.id)}
                          className="card-stat-btn"
                        >
                          <Heart
                            size={18}
                            className={
                              likesMap[image.id]
                                ? "fill-red-500 text-red-500"
                                : "text-slate-400 dark:text-slate-500"
                            }
                          />
                          <span
                            className={
                              likesMap[image.id]
                                ? "text-red-500"
                                : "text-slate-500 dark:text-slate-400"
                            }
                          >
                            {likesMap[image.id] ? "Liked" : "Like"}
                          </span>
                        </button>

                        <button
                          onClick={() => setDetailImage(image)}
                          className="card-comment-btn"
                        >
                          <MessageCircle size={18} />
                          <span>{commentCounts[image.id] ?? 0}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : !activeAlbum ? (
          <section className="page-container mt-8 section-card">
            {albumCards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  No albums yet
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create your first album to organize photos.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {albumCards.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => setActiveAlbumId(album.id)}
                    className="overflow-hidden rounded-3xl bg-white text-left ring-2 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#2a3655] dark:ring-slate-700"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {album.coverUrl ? (
                        <img
                          src={album.coverUrl}
                          alt={album.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <FolderPlus size={40} />
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="text-lg font-bold text-[#0f172f] dark:text-white">
                        {album.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {album.count} {album.count === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="page-container mt-8 section-card">
            {filteredImages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  This album is empty
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Select photos in the Photos tab and add them to this album.
                </p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleAlbumDragEnd}>
  <Droppable droppableId="album-photos" direction="horizontal">
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        className={`mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 transition-all ${
          snapshot.isDraggingOver
            ? "rounded-3xl bg-slate-50/70 p-2 dark:bg-slate-800/20"
            : ""
        }`}
      >
        {filteredImages.map((image, index) => (
          <Draggable
            key={image.id}
            draggableId={image.id}
            index={index}
            isDragDisabled={Boolean(searchQuery.trim())}
          >
            {(provided, snapshot) => (
              <article
                ref={provided.innerRef}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                style={provided.draggableProps.style}
                className={`overflow-hidden rounded-3xl bg-white ring-2 transition-transform transition-shadow duration-200 dark:bg-[#2a3655] dark:ring-slate-700 ${
                  snapshot.isDragging
                    ? "z-50 ring-indigo-500 shadow-2xl"
                    : "ring-slate-200"
                }`}
              >
                <div className="relative">
                  <img
                    src={image.url}
                    alt={image.title}
                    onClick={() => {
                      if (!snapshot.isDragging) setDetailImage(image);
                    }}
                    className="gallery-card-img"
                  />
                </div>

                <div className="gallery-card-body">
                  <span className="card-theme-badge">{image.themeLabel}</span>
                  <h2 className="card-title">{image.title}</h2>
                  <p className="card-subtitle">{image.subtitle}</p>

                  <div className="card-stats">
                    <button
                      onClick={() => toggleLike(image.id)}
                      className="card-stat-btn"
                    >
                      <Heart
                        size={18}
                        className={
                          likesMap[image.id]
                            ? "fill-red-500 text-red-500"
                            : "text-slate-400 dark:text-slate-500"
                        }
                      />
                      <span
                        className={
                          likesMap[image.id]
                            ? "text-red-500"
                            : "text-slate-500 dark:text-slate-400"
                        }
                      >
                        {likesMap[image.id] ? "Liked" : "Like"}
                      </span>
                    </button>

                    <button
                      onClick={() => setDetailImage(image)}
                      className="card-comment-btn"
                    >
                      <MessageCircle size={18} />
                      <span>{commentCounts[image.id] ?? 0}</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleRemoveFromAlbum(image.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                    >
                      <Minus size={14} />
                      Remove from album
                    </button>
                  </div>
                </div>
              </article>
            )}
          </Draggable>
        ))}
        {provided.placeholder}
      </div>
    )}
  </Droppable>
</DragDropContext>
            )}
          </section>
        )}

        {showUploadModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-125 rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Upload Image
              </h2>
              <p className="modal-subtitle">Add a new image to the gallery.</p>

              <form className="mt-6 space-y-4" onSubmit={handleUploadSubmit}>
                <div>
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    placeholder="Image title"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Theme</label>
                  <select
                    value={uploadTheme}
                    onChange={(e) => setUploadTheme(e.target.value)}
                    className="form-input"
                  >
                    {themeData.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Image File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                    className="w-full text-sm text-slate-700"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="h-12 w-1/2 rounded-2xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCreateAlbumModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-[520px] rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Create Album
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Create a new album for selected or future photos.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleCreateAlbum}>
                <div>
                  <label className="form-label">Album Name</label>
                  <input
                    type="text"
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    placeholder="Vacation 2026"
                    className="form-input"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAlbumModal(false);
                      setNewAlbumName("");
                    }}
                    disabled={albumSaving}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={albumSaving || !newAlbumName.trim()}
                    className="h-12 w-1/2 rounded-2xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  >
                    {albumSaving ? "Creating..." : "Create Album"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddToAlbumModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-[560px] rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Add to Album
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Choose an album for the selected photos.
              </p>

              <div className="mt-6 space-y-3">
                {albums.length === 0 ? (
                  <p className="text-sm text-red-500">
                    No albums found. Create an album first.
                  </p>
                ) : (
                  albums.map((album) => (
                    <button
                      key={album.id}
                      onClick={() => handleAddSelectedToAlbum(album.id)}
                      disabled={albumSaving}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {album.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Add {selectedIds.size} selected photo
                          {selectedIds.size === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Plus size={18} className="text-slate-500" />
                    </button>
                  ))
                )}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddToAlbumModal(false)}
                    disabled={albumSaving}
                    className="h-12 w-full rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {detailImage && (
        <PhotoDetailModal
          image={detailImage}
          images={filteredImages}
          onClose={() => setDetailImage(null)}
          onNavigate={(dir) => {
            const idx = filteredImages.findIndex(
              (img) => img.id === detailImage.id,
            );
            const next = filteredImages[idx + dir];
            if (next) setDetailImage(next);
          }}
          currentUid={user.uid}
          addComment={addComment}
          deleteComment={deleteComment}
          onShare={handleShareImage}
          onStopSharing={stopSharingUpload}
          shareState={
            shareStatus.imageId === detailImage.id ? shareStatus.state : "idle"
          }
          canStopSharing={isOwnedUpload(detailImage, user)}
          isShared={Boolean(detailImage.isShared)}
        />
      )}
    </>
  );
}

export default UserHomePage;