/* eslint-disable no-unused-vars */
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
import FilePreview from "../components/FilePreview";
import { generateStyledImage, AI_STYLES, isHFConfigured } from "../lib/huggingface";
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
  Sparkles,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SortableAlbumPhotoCard = ({
  image,
  likesMap,
  commentCounts,
  toggleLike,
  setDetailImage,
  handleRemoveFromAlbum,
  onEditImage,
  user,
  openMenuId,
  setOpenMenuId,
  setSelectedIds,
  setShowAIEditModal,
  selectedIds,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative overflow-hidden rounded-3xl bg-white ring-2 transition-shadow dark:bg-[#2a3655] dark:ring-slate-700 ${
        isDragging
          ? "z-50 ring-indigo-500 shadow-2xl opacity-90"
          : "ring-slate-200"
      }`}
    >
      <div className="relative">
        <FilePreview
          file={image}
          alt={image.title}
          onClick={() => {
            if (!isDragging) setDetailImage(image);
          }}
          interactive
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
            type="button"
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
            type="button"
          >
            <MessageCircle size={18} />
            <span>{commentCounts[image.id] ?? 0}</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => handleRemoveFromAlbum(image.id)}
            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
            type="button"
          >
            <Minus size={14} />
            Remove from album
          </button>
        </div>

        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const newSelected = new Set(selectedIds);
              if (newSelected.has(image.id)) {
                newSelected.delete(image.id);
              } else {
                newSelected.add(image.id);
              }
              setSelectedIds(newSelected);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border-2 border-indigo-500 bg-white transition hover:bg-indigo-50 dark:bg-slate-800"
            aria-label="Select image"
          >
            {selectedIds && selectedIds.has(image.id) && (
              <div className="h-4 w-4 bg-indigo-500 rounded-sm flex items-center justify-center">
                <span className="text-white font-bold text-xs">✓</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

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


const runWithConcurrency = async (items, worker, limit = 2) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runner = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;

      try {
        results[current] = {
          status: "fulfilled",
          value: await worker(items[current], current),
        };
      } catch (error) {
        results[current] = {
          status: "rejected",
          reason: error,
        };
      }
    }
  };

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => runner(),
  );

  await Promise.all(runners);
  return results;
};

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
          <FilePreview
            file={image}
            alt={image.title}
            className="photo-modal-img"
            showOpenLink
            heightClass="h-full"
            editor
          />
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
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadGroupName, setUploadGroupName] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);

  const [newAlbumName, setNewAlbumName] = useState("");
  const [renameAlbumValue, setRenameAlbumValue] = useState("");

  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState(false);
  const [albumSaving, setAlbumSaving] = useState(false);
  const [editingImageId, setEditingImageId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTheme, setEditTheme] = useState(themeData[0]?.id || "nature");
  const [openCardMenuId, setOpenCardMenuId] = useState("");

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

  const [aiStyle, setAIStyle] = useState("wildwest");
  const [aiPreviewUrl, setAIPreviewUrl] = useState("");
  const [aiPreviewBlob, setAIPreviewBlob] = useState(null);
  const [aiGenerating, setAIGenerating] = useState(false);
  const [aiApplying, setAIApplying] = useState(false);

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

  const selectedEditableUploads = useMemo(
    () => {
      const allImages = [...uploadedImages, ...flatThemeImages];
      return allImages.filter((image) => selectedIds.has(image.id));
    },
    [uploadedImages, flatThemeImages, selectedIds],
  );
  const selectedEditableUpload = selectedEditableUploads[0] || null;

  useEffect(() => {
    if (!showAIEditModal) return undefined;

    if (!selectedEditableUpload) {
      setShowAIEditModal(false);
      return undefined;
    }

    setAIStyle("wildwest");
    setAIPreviewUrl("");
    setAIPreviewBlob(null);
    return undefined;
  }, [selectedEditableUpload, showAIEditModal]);

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
    if (!openCardMenuId) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedMenu = target.closest("[data-card-menu='true']");
      const clickedToggle = target.closest("[data-card-menu-toggle='true']");

      if (!clickedMenu && !clickedToggle) {
        setOpenCardMenuId("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openCardMenuId]);

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
              resourceType: data.resourceType || "image",
              mimeType: data.mimeType || "image/*",
              originalFilename: data.originalFilename || data.title || "",
              bytes: typeof data.bytes === "number" ? data.bytes : 0,
              groupId: data.groupId || "",
              groupName: data.groupName || "",
              themeId: data.themeId,
              themeLabel: data.themeLabel,
              createdAt: toMillis(data.createdAt),
              ownerUid: data.ownerUid,
              ownerName: data.ownerName,
              isShared: Boolean(data.isShared),
              annotations: Array.isArray(data.annotations) ? data.annotations : [],
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

  useEffect(() => {
    if (!detailImage?.id) return;

    const updated = filteredImages.find((item) => item.id === detailImage.id);

    if (updated) {
      setDetailImage(updated);
    }
  }, [filteredImages, detailImage?.id]);

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

  const openAIEditModal = () => {
    if (!selectedEditableUpload) {
      alert("Select one of your uploaded photos first.");
      return;
    }

    setShowAIEditModal(true);
  };

  const generateStylePreview = async () => {
    if (!selectedEditableUpload || !aiStyle) {
      alert("Please select an image and a style first.");
      return;
    }

    try {
      setAIGenerating(true);

      const styledBlob = await generateStyledImage(selectedEditableUpload.url, aiStyle);
      const styledURL = URL.createObjectURL(styledBlob);

      if (aiPreviewUrl) {
        URL.revokeObjectURL(aiPreviewUrl);
      }

      setAIPreviewBlob(styledBlob);
      setAIPreviewUrl(styledURL);
    } catch (err) {
      console.error("Style generation failed:", err);
      alert(err?.message || "Failed to generate styled image. Please try again.");
      setAIPreviewUrl("");
      setAIPreviewBlob(null);
    } finally {
      setAIGenerating(false);
    }
  };

  const handleApplyAIEdit = async () => {
    if (!selectedEditableUpload || !aiPreviewBlob) {
      alert("Generate an AI preview first.");
      return;
    }

    if (!isOwnedUpload(selectedEditableUpload, user)) {
      alert("You can only apply AI edits to your own uploaded photos.");
      return;
    }

    try {
      setAIApplying(true);

      const originalUrl = selectedEditableUpload.originalUrl || selectedEditableUpload.url;
      const originalPublicId =
        selectedEditableUpload.originalPublicId || selectedEditableUpload.publicId || "";
      const { url, publicId, resourceType, mimeType, originalFilename, bytes } = await uploadToCloudinary(aiPreviewBlob);

      await updateDoc(doc(db, "uploads", selectedEditableUpload.id), {
        originalUrl,
        originalPublicId,
        url,
        publicId: publicId || "",
        resourceType: resourceType || "image",
        mimeType: mimeType || "image/png",
        originalFilename: originalFilename || `${selectedEditableUpload.title || "edited-image"}.png`,
        bytes: typeof bytes === "number" ? bytes : 0,
        aiStyle,
        updatedAt: serverTimestamp(),
      });

      setShowAIEditModal(false);
      setAIPreviewUrl("");
      setAIPreviewBlob(null);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("apply ai edit failed", err);
      alert(err?.message || "Could not apply AI edit.");
    } finally {
      setAIApplying(false);
    }
  };

  const handleRemoveUploadFile = (indexToRemove) => {
    setUploadFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    const title = uploadTitle.trim();
    const subtitle = uploadDescription.trim();
    const groupName = uploadGroupName.trim();

    if (!user) return;

    if (uploadFiles.length === 0) {
      alert("Please select at least one file for upload.");
      return;
    }

    if (!title || !subtitle) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setUploading(true);

      const selectedTheme = themeById[uploadTheme];
      const shouldCreateGroup = uploadFiles.length > 1;
      let createdAlbumId = "";
      let createdGroupId = "";
      let effectiveGroupName = "";

      if (shouldCreateGroup) {
        const albumRef = await addDoc(collection(db, "albums"), {
          ownerUid: user.uid,
          ownerName: displayName,
          name: groupName || title,
          coverPhotoId: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdAlbumId = albumRef.id;
        createdGroupId = albumRef.id;
        effectiveGroupName = groupName || title;
      }

      const uploadedDocIds = [];
      const failures = [];

      const results = await runWithConcurrency(
        uploadFiles,
        async (currentFile, index) => {
          const uploadResult = await uploadToCloudinary(currentFile);
          const itemTitle =
            uploadFiles.length === 1
              ? title
              : `${title} ${index + 1}`;

          const uploadRef = await addDoc(collection(db, "uploads"), {
            title: itemTitle,
            subtitle,
            url: uploadResult.url,
            publicId: uploadResult.publicId || "",
            resourceType: uploadResult.resourceType || "raw",
            mimeType:
              uploadResult.mimeType ||
              currentFile.type ||
              "application/octet-stream",
            originalFilename:
              uploadResult.originalFilename || currentFile.name || itemTitle,
            bytes:
              typeof uploadResult.bytes === "number"
                ? uploadResult.bytes
                : currentFile.size || 0,
            groupId: createdGroupId,
            groupName: effectiveGroupName,
            themeId: uploadTheme,
            themeLabel: selectedTheme?.label || "Custom",
            ownerUid: user.uid,
            ownerName: displayName,
            isShared: false,
            createdAt: serverTimestamp(),
          });

          if (createdAlbumId) {
            await addDoc(collection(db, "albumPhotos"), {
              albumId: createdAlbumId,
              photoId: uploadRef.id,
              ownerUid: user.uid,
              order: index,
              addedAt: serverTimestamp(),
            });
          }

          return uploadRef.id;
        },
        2,
      );

      results.forEach((result, index) => {
        if (result?.status === "fulfilled") {
          uploadedDocIds.push(result.value);
        } else if (result?.status === "rejected") {
          failures.push({
            fileName: uploadFiles[index]?.name || `File ${index + 1}`,
            message: result.reason?.message || "Upload failed",
          });
        }
      });

      if (createdAlbumId && uploadedDocIds.length > 0) {
        await updateDoc(doc(db, "albums", createdAlbumId), {
          coverPhotoId: uploadedDocIds[0],
          updatedAt: serverTimestamp(),
        });
        setViewMode("albums");
        setActiveAlbumId(createdAlbumId);
      }

      setUploadTitle("");
      setUploadDescription("");
      setUploadFiles([]);
      setUploadGroupName("");
      setUploadTheme(themeData[0]?.id || "nature");
      setShowUploadModal(false);

      if (failures.length > 0) {
        alert(
          `${uploadedDocIds.length} uploaded, ${failures.length} failed.\n\n${failures
            .map((failure) => `${failure.fileName}: ${failure.message}`)
            .join("\n")}` ,
        );
      }
    } catch (err) {
      console.error("upload submit failed", err);
      alert(err?.message || "Could not upload files.");
    } finally {
      setUploading(false);
    }
  };

  const openEditImageModal = (image) => {
    if (!isOwnedUpload(image, user)) return;
    setOpenCardMenuId("");
    setEditingImageId(image.id);
    setEditTitle(image.title || "");
    setEditDescription(image.subtitle || "");
    setEditTheme(image.themeId || themeData[0]?.id || "nature");
    setShowEditImageModal(true);
  };

  const handleEditImageSubmit = async (e) => {
    e.preventDefault();
    if (!editingImageId) return;

    const title = editTitle.trim();
    const subtitle = editDescription.trim();
    if (!title || !subtitle) return;

    const selectedTheme = themeById[editTheme];

    try {
      setEditingImage(true);
      await updateDoc(doc(db, "uploads", editingImageId), {
        title,
        subtitle,
        themeId: editTheme,
        themeLabel: selectedTheme?.label || "Custom",
        updatedAt: serverTimestamp(),
      });

      setDetailImage((prev) =>
        prev?.id === editingImageId
          ? {
              ...prev,
              title,
              subtitle,
              themeId: editTheme,
              themeLabel: selectedTheme?.label || "Custom",
            }
          : prev,
      );

      setShowEditImageModal(false);
      setEditingImageId("");
      setEditTitle("");
      setEditDescription("");
      setEditTheme(themeData[0]?.id || "nature");
    } catch (err) {
      console.error("edit image failed", err);
      alert(err?.message || "Could not update image.");
    } finally {
      setEditingImage(false);
    }
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

  const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }),
);

const handleAlbumDragEnd = async (event) => {
  if (!activeAlbum) return;
  if (searchQuery.trim()) {
    alert("Clear search before rearranging album photos.");
    return;
  }

  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const relations = albumPhotos
    .filter((item) => item.albumId === activeAlbum.id)
    .sort((a, b) => a.order - b.order);

  const oldIndex = relations.findIndex((item) => item.photoId === active.id);
  const newIndex = relations.findIndex((item) => item.photoId === over.id);

  if (oldIndex === -1 || newIndex === -1) return;

  const reordered = arrayMove(relations, oldIndex, newIndex);

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

                {selectedEditableUpload && isHFConfigured() && (
                  <button
                    onClick={openAIEditModal}
                    className="flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-2.5 text-sm font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
                  >
                    <Sparkles size={16} />
                    <span>Edit with AI</span>
                  </button>
                )}

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
	                    className={`relative overflow-hidden rounded-3xl bg-white ring-2 dark:bg-[#2a3655] ${
	                      isSelected
	                        ? "ring-indigo-500"
	                        : "ring-slate-200 dark:ring-slate-700"
	                    }`}
                  >
                    <div className="relative">
                      <FilePreview
                        file={image}
                        alt={image.title}
                        onClick={() => setDetailImage(image)}
                        interactive
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

                    {isOwnedUpload(image, user) && (
                      <div className="absolute top-3 right-3 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedIds);
                            if (newSelected.has(image.id)) {
                              newSelected.delete(image.id);
                            } else {
                              newSelected.add(image.id);
                            }
                            setSelectedIds(newSelected);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border-2 border-indigo-500 bg-white transition hover:bg-indigo-50 dark:bg-slate-800"
                          aria-label="Select image"
                        >
                          {selectedIds && selectedIds.has(image.id) && (
                            <div className="h-4 w-4 bg-indigo-500 rounded-sm flex items-center justify-center">
                              <span className="text-white font-bold text-xs">✓</span>
                            </div>
                          )}
                        </button>
                      </div>
                    )}
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
                        <FilePreview
                          file={{ url: album.coverUrl, resourceType: "image", mimeType: "image/*", originalFilename: album.name }}
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
              <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleAlbumDragEnd}
>
  <SortableContext
    items={filteredImages.map((image) => image.id)}
    strategy={rectSortingStrategy}
  >
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {filteredImages.map((image) => (
        <SortableAlbumPhotoCard
          key={image.id}
          image={image}
          likesMap={likesMap}
	          commentCounts={commentCounts}
	          toggleLike={toggleLike}
	          setDetailImage={setDetailImage}
	          handleRemoveFromAlbum={handleRemoveFromAlbum}
            onEditImage={openEditImageModal}
            user={user}
            openMenuId={openCardMenuId}
            setOpenMenuId={setOpenCardMenuId}
            setSelectedIds={setSelectedIds}
            setShowAIEditModal={setShowAIEditModal}
            selectedIds={selectedIds}
	        />
	      ))}
	    </div>
	  </SortableContext>
</DndContext>
            )}
          </section>
        )}

	        {showUploadModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-auto rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Upload Files
              </h2>
              <p className="modal-subtitle">Add one or more files to your gallery. Grouped uploads automatically create an album.</p>

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
                  <label className="form-label">Files</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.pps,.ppsx,.xls,.xlsx,.csv,.txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.cs,.zip,.rar"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []);

                      setUploadFiles((prev) => {
                        const merged = [...prev];

                        newFiles.forEach((file) => {
                          const exists = merged.some(
                            (f) =>
                              f.name === file.name &&
                              f.size === file.size &&
                              f.lastModified === file.lastModified
                          );

                          if (!exists) merged.push(file);
                        });

                        return merged;
                      });

                      e.target.value = "";
                    }}
                    className="w-full text-sm text-slate-700"
                  />
                  {uploadFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveUploadFile(index)}
                            className="ml-3 text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Upload images, videos, PDFs, docs, slides, spreadsheets, code files, and archives. Images, videos, and PDFs include annotation tools; DOCX/PPTX files include Office editing links; PPTX files include presentation mode.
                  </p>
                  {uploadFiles.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                      <p className="font-semibold">Selected files: {uploadFiles.length}</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {uploadFiles.map((file) => (
                          <li key={`${file.name}-${file.size}`} className="break-all">
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">Group / Album Name (optional)</label>
                  <input
                    type="text"
                    placeholder="Used when you upload more than one file"
                    value={uploadGroupName}
                    onChange={(e) => setUploadGroupName(e.target.value)}
                    className="form-input"
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
                  {uploadFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUploadFiles([])}
                    className="mt-2 text-sm text-gray-600 hover:underline"
                  >
                    Clear all
                  </button>
                )}
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
                    {uploading ? "Uploading..." : uploadFiles.length > 1 ? "Upload Group" : "Upload Files"}
                  </button>
                </div>
              </form>
            </div>
          </div>
	        )}

        {showAIEditModal && selectedEditableUpload && (
          <div className="modal-overlay">
            <div className="w-full max-w-[920px] rounded-[32px] bg-white p-0 shadow-2xl dark:bg-[#1f2740]">
              <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                <div className="bg-slate-950 p-6 text-white md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300">AI Edit</p>
                      <h2 className="mt-2 text-[26px] font-bold">Transform selected photo</h2>
                      <p className="mt-2 text-sm text-slate-300">
                        Edit one uploaded photo without changing the upload flow.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAIEditModal(false)}
                      className="rounded-full border border-white/15 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-white/5">
                    <FilePreview
                      file={{
                        ...selectedEditableUpload,
                        url: aiPreviewUrl || selectedEditableUpload.url,
                        resourceType: "image",
                        mimeType: "image/*",
                      }}
                      alt={selectedEditableUpload.title}
                      className="h-[420px] w-full object-cover"
                    />
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Selected photo: {selectedEditableUpload.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Choose a style, generate a preview, then apply it to replace the image.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="form-label">Style</label>
                      <select
                        value={aiStyle}
                        onChange={(e) => setAIStyle(e.target.value)}
                        className="form-input"
                      >
                        {Object.entries(AI_STYLES).map(([key, style]) => (
                          <option key={key} value={key}>
                            {style.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={generateStylePreview}
                      disabled={aiGenerating}
                      className="h-12 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-sm font-semibold text-white shadow-md transition hover:from-fuchsia-600 hover:to-indigo-700 disabled:opacity-60"
                    >
                      {aiGenerating ? "Generating preview..." : "Generate preview"}
                    </button>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      If you want to keep the original, just close this panel. No upload changes until you click apply.
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAIEditModal(false);
                          setAIPreviewUrl("");
                          setAIPreviewBlob(null);
                        }}
                        disabled={aiApplying}
                        className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyAIEdit}
                        disabled={aiApplying || !aiPreviewBlob}
                        className="h-12 w-1/2 rounded-2xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {aiApplying ? "Applying..." : "Apply edit"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEditImageModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-125 rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Edit Image
              </h2>
              <p className="modal-subtitle">
                Update title, description, and theme for this upload.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleEditImageSubmit}>
                <div>
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    placeholder="Image title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Theme</label>
                  <select
                    value={editTheme}
                    onChange={(e) => setEditTheme(e.target.value)}
                    className="form-input"
                  >
                    {themeData.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditImageModal(false);
                      setEditingImageId("");
                    }}
                    disabled={editingImage}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editingImage}
                    className="h-12 w-1/2 rounded-2xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {editingImage ? "Saving..." : "Save Changes"}
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
