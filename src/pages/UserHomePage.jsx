import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  arrayUnion,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { themeById, themeData } from "../data/galleryData";
import { ThemeToggle } from "../ThemeContext";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { uploadToCloudinary } from "../lib/cloudinary";
import { generateStyledImage, AI_STYLES, isHFConfigured } from "../lib/huggingface";
import { findUidByEmail, getUsersByUids, removeFromMyGallery } from "../lib/sharing";
import { measureTrace, trackEvent } from "../lib/telemetry";
import ShareDialog from "../components/ShareDialog";
import VideoGeneratorModal from "../components/VideoGeneratorModal";
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
  UserMinus,
  Film,
  CalendarDays,
  Users,
  Trophy,
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
  setSelectedIds,
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
        <img
          src={image.url}
          alt={image.title}
          onClick={() => {
            if (!isDragging) setDetailImage(image);
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

const isOwnedUpload = (image, user) =>
  Boolean(image?.ownerUid && user?.uid && image.ownerUid === user.uid);

const eventInviteId = (eventId, uid) => `${eventId}_${uid}`;

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
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setComments(docs);
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
    setComment("");
    await onAdd(imageId, text);
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
  onOpenShare,
  canShare,
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


          {canShare && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onOpenShare?.(image)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#28457a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d3456]"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>
          )}

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
  const [sharedWithMeImages, setSharedWithMeImages] = useState([]);
  const [shareDialogUpload, setShareDialogUpload] = useState(null);
  const [toast, setToast] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventPhotos, setEventPhotos] = useState([]);
  const [eventInvites, setEventInvites] = useState([]);
  const [eventMembers, setEventMembers] = useState([]);
  const [activeEventId, setActiveEventId] = useState(null);

  const [uploadTheme, setUploadTheme] = useState(themeData[0]?.id || "nature");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [eventUploadTitle, setEventUploadTitle] = useState("");
  const [eventUploadDescription, setEventUploadDescription] = useState("");
  const [eventUploadFile, setEventUploadFile] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showInviteEventModal, setShowInviteEventModal] = useState(false);
  const [showEventUploadModal, setShowEventUploadModal] = useState(false);
  const [showEditEventPhotoModal, setShowEditEventPhotoModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalAlbum, setVideoModalAlbum] = useState(null);

  const [newAlbumName, setNewAlbumName] = useState("");
  const [renameAlbumValue, setRenameAlbumValue] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [editEventName, setEditEventName] = useState("");
  const [editEventDescription, setEditEventDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState(false);
  const [albumSaving, setAlbumSaving] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventUploading, setEventUploading] = useState(false);
  const [eventPhotoEditing, setEventPhotoEditing] = useState(false);
  const [editingImageId, setEditingImageId] = useState("");
  const [editingEventPhotoId, setEditingEventPhotoId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTheme, setEditTheme] = useState(themeData[0]?.id || "nature");
  const [openCardMenuId, setOpenCardMenuId] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailImage, setDetailImage] = useState(null);
  const [likesMap, setLikesMap] = useState({});
  const [eventVotes, setEventVotes] = useState({});
  const [commentCounts, setCommentCounts] = useState({});

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
              themeId: data.themeId,
              themeLabel: data.themeLabel,
              createdAt: toMillis(data.createdAt),
              ownerUid: data.ownerUid,
              ownerName: data.ownerName,
              isShared: Boolean(data.isShared),
              sharedWith: data.sharedWith ?? [],
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
      setSharedWithMeImages([]);
      return undefined;
    }

    const q = query(
      collection(db, "uploads"),
      where("sharedWith", "array-contains", user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSharedWithMeImages(
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
              sharedWith: data.sharedWith ?? [],
              isSharedWithMe: true,
            };
          }),
        );
      },
      (err) => {
        console.error("shared uploads snapshot error", err);
      },
    );

    return unsub;
  }, [user]);

  // Keep the open ShareDialog in sync with live upload data.
  useEffect(() => {
    if (!shareDialogUpload?.id) return;
    const next = uploadedImages.find((img) => img.id === shareDialogUpload.id);
    if (next && next !== shareDialogUpload) {
      setShareDialogUpload(next);
    }
  }, [uploadedImages, shareDialogUpload]);

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
      setEvents([]);
      return undefined;
    }

    const q = query(
      collection(db, "events"),
      where("memberUids", "array-contains", user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || "Untitled event",
              description: data.description || "",
              ownerUid: data.ownerUid,
              ownerName: data.ownerName,
              memberUids: data.memberUids || [],
              coverPhotoUrl: data.coverPhotoUrl || "",
              photoCount: data.photoCount || 0,
              createdAt: toMillis(data.createdAt),
              updatedAt: toMillis(data.updatedAt),
            };
          })
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        setEvents(next);
        if (activeEventId && !next.some((event) => event.id === activeEventId)) {
          setActiveEventId(null);
        }
      },
      (err) => {
        console.error("events snapshot error", err);
        alert(err?.message || "Event vaults failed to load.");
      },
    );

    return unsub;
  }, [user, activeEventId]);

  useEffect(() => {
    if (!user) {
      setEventInvites([]);
      return undefined;
    }

    const q = query(
      collection(db, "eventInvites"),
      where("recipientUid", "==", user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              eventId: data.eventId,
              eventName: data.eventName || "Untitled event",
              eventDescription: data.eventDescription || "",
              ownerUid: data.ownerUid,
              ownerName: data.ownerName || "",
              recipientUid: data.recipientUid,
              recipientEmail: data.recipientEmail || "",
              status: data.status || "pending",
              createdAt: toMillis(data.createdAt),
            };
          })
          .filter((invite) => invite.status === "pending")
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        setEventInvites(next);
      },
      (err) => {
        console.error("event invites snapshot error", err);
      },
    );

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user || !activeEventId) {
      setEventPhotos([]);
      return undefined;
    }

    const q = query(
      collection(db, "eventPhotos"),
      where("eventId", "==", activeEventId),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setEventPhotos(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              eventId: data.eventId,
              title: data.title,
              subtitle: data.subtitle,
              url: data.url,
              publicId: data.publicId,
              themeId: "event",
              themeLabel: "Event",
              ownerUid: data.ownerUid,
              ownerName: data.ownerName,
              createdAt: toMillis(data.createdAt),
              isEventPhoto: true,
            };
          }),
        );
      },
      (err) => {
        console.error("event photos snapshot error", err);
        alert(err?.message || "Event photos failed to load.");
      },
    );

    return unsub;
  }, [user, activeEventId]);

  useEffect(() => {
    if (!user || !activeEventId) {
      setEventVotes({});
      return undefined;
    }

    const q = query(
      collection(db, "eventVotes"),
      where("eventId", "==", activeEventId),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data?.photoId) return;
          const current = next[data.photoId] || { count: 0, voted: false };
          next[data.photoId] = {
            count: current.count + 1,
            voted: current.voted || data.uid === user.uid,
          };
        });
        setEventVotes(next);
      },
      (err) => {
        console.error("event votes snapshot error", err);
      },
    );

    return unsub;
  }, [user, activeEventId]);

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
  const activeEvent = useMemo(
    () => events.find((event) => event.id === activeEventId) || null,
    [events, activeEventId],
  );
  const isActiveEventOwner = Boolean(
    activeEvent?.ownerUid && user?.uid && activeEvent.ownerUid === user.uid,
  );
  const activeEventMemberUids = useMemo(
    () => activeEvent?.memberUids || [],
    [activeEvent?.memberUids],
  );

  useEffect(() => {
    if (!activeEventMemberUids.length) {
      setEventMembers([]);
      return undefined;
    }

    let cancelled = false;
    getUsersByUids(activeEventMemberUids)
      .then((docs) => {
        if (cancelled) return;
        const byUid = new Map(docs.map((member) => [member.uid, member]));
        setEventMembers(
          activeEventMemberUids.map((uid) => ({
            uid,
            ...(byUid.get(uid) || {}),
          })),
        );
      })
      .catch((err) => {
        console.error("event members load failed", err);
        if (!cancelled) setEventMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeEventMemberUids]);

  useEffect(() => {
    if (activeAlbum) {
      setRenameAlbumValue(activeAlbum.name || "");
    } else {
      setRenameAlbumValue("");
    }
  }, [activeAlbum]);

  useEffect(() => {
    if (activeEvent) {
      setEditEventName(activeEvent.name || "");
      setEditEventDescription(activeEvent.description || "");
    } else {
      setEditEventName("");
      setEditEventDescription("");
    }
  }, [activeEvent]);

  const allPhotosMap = useMemo(() => {
    const ownIds = new Set(uploadedImages.map((img) => img.id));
    const sharedFiltered = sharedWithMeImages.filter(
      (img) => !ownIds.has(img.id),
    );
    return new Map(
      [...uploadedImages, ...sharedFiltered, ...flatThemeImages].map((img) => [
        img.id,
        {
          ...img,
          themeLabel: img.themeLabel || themeById[img.themeId]?.label || "Gallery",
        },
      ]),
    );
  }, [uploadedImages, sharedWithMeImages, flatThemeImages]);

  const imagesToRender = useMemo(() => {
    const ownIds = new Set(uploadedImages.map((img) => img.id));
    const sharedFiltered = sharedWithMeImages.filter(
      (img) => !ownIds.has(img.id),
    );
    const combined = [...uploadedImages, ...sharedFiltered];
    const sortedUploads = combined.sort(
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

    if (viewMode === "events" && activeEvent) {
      return [...eventPhotos].sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      );
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
    eventPhotos,
    uploadedImages,
    sharedWithMeImages,
    flatThemeImages,
    activeTheme,
    hiddenGalleryIds,
    allPhotosMap,
    activeEvent,
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
      trackEvent("like_toggle", {
        action: already ? "unlike" : "like",
      });
    } catch (err) {
      console.error("toggleLike failed", err);
      trackEvent("like_toggle_failed", {
        action: already ? "unlike" : "like",
        error_code: err?.code || err?.name || "error",
      });
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
        createdAt: Timestamp.now(),
      });
      trackEvent("comment_add", { content_type: "image" });
    } catch (err) {
      console.error("addComment failed", err);
      trackEvent("comment_add_failed", {
        error_code: err?.code || err?.name || "error",
      });
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

  const showToast = (message, kind = "info") => {
    setToast({ message, kind });
    window.setTimeout(() => {
      setToast((current) =>
        current && current.message === message ? null : current,
      );
    }, 3000);
  };

  const handleRemoveFromMyGallery = async (image) => {
    if (!user || !image?.id) return;
    const confirmed = window.confirm(
      "Remove from your gallery? Owner can re-share later.",
    );
    if (!confirmed) return;

    try {
      await removeFromMyGallery({ uploadId: image.id, currentUid: user.uid });
      showToast("Removed from your gallery.", "success");
    } catch (err) {
      console.error("remove from my gallery failed", err);
      showToast("Could not remove from gallery.", "error");
    }
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
    trackEvent("ai_edit_open", { style_key: aiStyle || "unset" });
  };

  const generateStylePreview = async () => {
    if (!selectedEditableUpload || !aiStyle) {
      alert("Please select an image and a style first.");
      return;
    }

    try {
      setAIGenerating(true);
      trackEvent("ai_edit_preview_start", { style_key: aiStyle });

      const styledBlob = await generateStyledImage(selectedEditableUpload.url, aiStyle);
      const styledURL = URL.createObjectURL(styledBlob);

      if (aiPreviewUrl) {
        URL.revokeObjectURL(aiPreviewUrl);
      }

      setAIPreviewBlob(styledBlob);
      setAIPreviewUrl(styledURL);
      trackEvent("ai_edit_preview_success", {
        style_key: aiStyle,
        output_bytes: styledBlob.size || 0,
      });
    } catch (err) {
      console.error("Style generation failed:", err);
      trackEvent("ai_edit_preview_failed", {
        style_key: aiStyle,
        error_code: err?.code || err?.name || "error",
      });
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
      trackEvent("ai_edit_apply_start", {
        style_key: aiStyle,
        output_bytes: aiPreviewBlob.size || 0,
      });

      await measureTrace("ai_photo_apply_total", async () => {
        const originalUrl = selectedEditableUpload.originalUrl || selectedEditableUpload.url;
        const originalPublicId =
          selectedEditableUpload.originalPublicId || selectedEditableUpload.publicId || "";
        const { url, publicId } = await uploadToCloudinary(aiPreviewBlob);

        await updateDoc(doc(db, "uploads", selectedEditableUpload.id), {
          originalUrl,
          originalPublicId,
          url,
          publicId: publicId || "",
          aiStyle,
          updatedAt: serverTimestamp(),
        });
      }, {
        attributes: { style_key: aiStyle },
        metrics: { output_bytes: aiPreviewBlob.size || 0 },
      });

      setShowAIEditModal(false);
      setAIPreviewUrl("");
      setAIPreviewBlob(null);
      setSelectedIds(new Set());
      trackEvent("ai_edit_apply_success", { style_key: aiStyle });
    } catch (err) {
      console.error("apply ai edit failed", err);
      trackEvent("ai_edit_apply_failed", {
        style_key: aiStyle,
        error_code: err?.code || err?.name || "error",
      });
      alert(err?.message || "Could not apply AI edit.");
    } finally {
      setAIApplying(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    const title = uploadTitle.trim();
    const subtitle = uploadDescription.trim();

    if (!user || !uploadFile || !title || !subtitle) return;

    try {
      setUploading(true);
      trackEvent("image_upload_start", {
        file_type: uploadFile.type || "unknown",
        file_size_bytes: uploadFile.size || 0,
        theme_id: uploadTheme,
      });

      const selectedTheme = themeById[uploadTheme];

      await measureTrace("image_upload_total", async () => {
        const { url, publicId } = await uploadToCloudinary(uploadFile);

        await addDoc(collection(db, "uploads"), {
          title,
          subtitle,
          url,
          publicId: publicId || "",
          themeId: uploadTheme,
          themeLabel: selectedTheme?.label || "Custom",
          ownerUid: user.uid,
          ownerName: displayName,
          isShared: false,
          sharedWith: [],
          createdAt: serverTimestamp(),
        });
      }, {
        attributes: { theme_id: uploadTheme },
        metrics: { file_size_bytes: uploadFile.size || 0 },
      });

      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      setUploadTheme(themeData[0]?.id || "nature");
      setShowUploadModal(false);
      trackEvent("image_upload_success", {
        file_type: uploadFile.type || "unknown",
        file_size_bytes: uploadFile.size || 0,
        theme_id: uploadTheme,
      });
    } catch (err) {
      console.error("upload submit failed", err);
      trackEvent("image_upload_failed", {
        file_type: uploadFile.type || "unknown",
        error_code: err?.code || err?.name || "error",
      });
      alert(err?.message || "Could not upload image.");
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

  const handleDeleteEvent = async () => {
    if (!activeEvent || !isActiveEventOwner) return;

    const confirmed = window.confirm(
      `Delete event vault "${activeEvent.name}"? This removes the event, its contributed photos, and all votes.`,
    );
    if (!confirmed) return;

    try {
      setEventSaving(true);

      const votesSnap = await getDocs(
        query(
          collection(db, "eventVotes"),
          where("eventId", "==", activeEvent.id),
        ),
      );
      const invitesSnap = await getDocs(
        query(
          collection(db, "eventInvites"),
          where("eventId", "==", activeEvent.id),
        ),
      );

      const batch = writeBatch(db);

      eventPhotos
        .filter((photo) => photo.eventId === activeEvent.id)
        .forEach((photo) => {
          batch.delete(doc(db, "eventPhotos", photo.id));
        });

      votesSnap.forEach((voteDoc) => {
        batch.delete(doc(db, "eventVotes", voteDoc.id));
      });

      invitesSnap.forEach((inviteDoc) => {
        batch.delete(doc(db, "eventInvites", inviteDoc.id));
      });

      batch.delete(doc(db, "events", activeEvent.id));

      await batch.commit();

      setActiveEventId(null);
      setEventPhotos([]);
      setEventVotes({});
      setViewMode("events");
      showToast("Event vault deleted.", "success");
    } catch (err) {
      console.error("delete event failed", err);
      alert(err?.message || "Could not delete event vault.");
    } finally {
      setEventSaving(false);
    }
  };

  const openEditEventModal = () => {
    if (!activeEvent || !isActiveEventOwner) return;
    setEditEventName(activeEvent.name || "");
    setEditEventDescription(activeEvent.description || "");
    setShowEditEventModal(true);
  };

  const handleEditEventSubmit = async (e) => {
    e.preventDefault();
    if (!activeEvent || !isActiveEventOwner) return;

    const name = editEventName.trim();
    const description = editEventDescription.trim();
    if (!name) return;

    try {
      setEventSaving(true);
      await updateDoc(doc(db, "events", activeEvent.id), {
        name,
        description,
        updatedAt: serverTimestamp(),
      });

      setShowEditEventModal(false);
      showToast("Event info updated.", "success");
    } catch (err) {
      console.error("edit event failed", err);
      alert(err?.message || "Could not update event info.");
    } finally {
      setEventSaving(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    const name = newEventName.trim();
    const description = newEventDescription.trim();
    if (!name || !user) return;

    try {
      setEventSaving(true);
      const ref = await addDoc(collection(db, "events"), {
        ownerUid: user.uid,
        ownerName: displayName,
        memberUids: [user.uid],
        name,
        description,
        coverPhotoUrl: "",
        photoCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewEventName("");
      setNewEventDescription("");
      setShowCreateEventModal(false);
      setViewMode("events");
      setActiveAlbumId(null);
      setActiveEventId(ref.id);
      showToast("Event vault created.", "success");
    } catch (err) {
      console.error("create event failed", err);
      alert(err?.message || "Could not create event vault.");
    } finally {
      setEventSaving(false);
    }
  };

  const handleInviteToEvent = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!activeEvent || !email || !isActiveEventOwner) return;

    try {
      setEventSaving(true);
      const recipientUid = await findUidByEmail(email);
      if (!recipientUid) {
        alert("No user found with that email.");
        return;
      }
      if (recipientUid === user.uid) {
        alert("You are already in this event vault.");
        return;
      }
      if (activeEvent.memberUids?.includes(recipientUid)) {
        alert("That user is already a member.");
        return;
      }

      const inviteRef = doc(
        db,
        "eventInvites",
        eventInviteId(activeEvent.id, recipientUid),
      );
      const inviteSnap = await getDoc(inviteRef);
      const existingStatus = inviteSnap.exists() ? inviteSnap.data()?.status : "";

      if (existingStatus === "pending") {
        alert("That user already has a pending invitation.");
        return;
      }
      if (existingStatus === "accepted") {
        alert("That user already accepted this invitation.");
        return;
      }

      await setDoc(inviteRef, {
        eventId: activeEvent.id,
        eventName: activeEvent.name,
        eventDescription: activeEvent.description || "",
        ownerUid: user.uid,
        ownerName: displayName,
        recipientUid,
        recipientEmail: email.toLowerCase(),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setInviteEmail("");
      setShowInviteEventModal(false);
      showToast("Invitation sent.", "success");
    } catch (err) {
      console.error("invite to event failed", err);
      alert(err?.message || "Could not invite user.");
    } finally {
      setEventSaving(false);
    }
  };

  const handleRespondToEventInvite = async (invite, response) => {
    if (!user || !invite?.id || !invite.eventId) return;
    const isAccept = response === "accepted";

    try {
      setEventSaving(true);

      const inviteRef = doc(db, "eventInvites", invite.id);

      if (isAccept) {
        const eventRef = doc(db, "events", invite.eventId);
        await updateDoc(eventRef, {
          memberUids: arrayUnion(user.uid),
          updatedAt: serverTimestamp(),
        });
      }

      await updateDoc(inviteRef, {
        status: isAccept ? "accepted" : "rejected",
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast(
        isAccept ? "Event invitation accepted." : "Event invitation rejected.",
        "success",
      );
      if (isAccept) {
        setViewMode("events");
        setActiveAlbumId(null);
        setActiveEventId(invite.eventId);
      }
    } catch (err) {
      console.error("respond to event invite failed", err);
      alert(err?.message || "Could not update invitation.");
    } finally {
      setEventSaving(false);
    }
  };

  const handleEventUploadSubmit = async (e) => {
    e.preventDefault();

    const title = eventUploadTitle.trim();
    const subtitle = eventUploadDescription.trim();
    if (!user || !activeEvent || !eventUploadFile || !title || !subtitle) return;

    try {
      setEventUploading(true);
      trackEvent("event_photo_upload_start", {
        file_type: eventUploadFile.type || "unknown",
        file_size_bytes: eventUploadFile.size || 0,
      });
      await measureTrace("event_photo_upload_total", async () => {
        const { url, publicId } = await uploadToCloudinary(eventUploadFile);

        await addDoc(collection(db, "eventPhotos"), {
          eventId: activeEvent.id,
          title,
          subtitle,
          url,
          publicId: publicId || "",
          ownerUid: user.uid,
          ownerName: displayName,
          createdAt: serverTimestamp(),
        });

        const eventUpdate = {
          photoCount: increment(1),
          updatedAt: serverTimestamp(),
        };
        if (!activeEvent.coverPhotoUrl) {
          eventUpdate.coverPhotoUrl = url;
        }
        await updateDoc(doc(db, "events", activeEvent.id), eventUpdate);
      }, {
        metrics: { file_size_bytes: eventUploadFile.size || 0 },
      });

      setEventUploadTitle("");
      setEventUploadDescription("");
      setEventUploadFile(null);
      setShowEventUploadModal(false);
      trackEvent("event_photo_upload_success", {
        file_type: eventUploadFile.type || "unknown",
        file_size_bytes: eventUploadFile.size || 0,
      });
      showToast("Photo added to event vault.", "success");
    } catch (err) {
      console.error("event upload failed", err);
      trackEvent("event_photo_upload_failed", {
        file_type: eventUploadFile.type || "unknown",
        error_code: err?.code || err?.name || "error",
      });
      alert(err?.message || "Could not upload event photo.");
    } finally {
      setEventUploading(false);
    }
  };

  const toggleEventVote = async (photoId) => {
    if (!user || !activeEvent || !photoId) return;
    const voteId = `${activeEvent.id}_${photoId}_${user.uid}`;
    const ref = doc(db, "eventVotes", voteId);
    const already = Boolean(eventVotes[photoId]?.voted);

    setEventVotes((prev) => ({
      ...prev,
      [photoId]: {
        count: Math.max((prev[photoId]?.count || 0) + (already ? -1 : 1), 0),
        voted: !already,
      },
    }));

    try {
      if (already) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          eventId: activeEvent.id,
          photoId,
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("toggle event vote failed", err);
      setEventVotes((prev) => ({
        ...prev,
        [photoId]: {
          count: Math.max((prev[photoId]?.count || 0) + (already ? 1 : -1), 0),
          voted: already,
        },
      }));
    }
  };

  const handleDeleteEventPhoto = async (image) => {
    if (!user || !activeEvent || !image?.id) return;

    const canDelete =
      image.ownerUid === user.uid || activeEvent.ownerUid === user.uid;
    if (!canDelete) return;

    const confirmed = window.confirm(
      `Delete "${image.title}" from this event vault?`,
    );
    if (!confirmed) return;

    try {
      setEventSaving(true);

      const votesSnap = await getDocs(
        query(
          collection(db, "eventVotes"),
          where("photoId", "==", image.id),
        ),
      );

      const remainingPhotos = eventPhotos.filter(
        (photo) => photo.id !== image.id,
      );
      const nextCoverUrl =
        activeEvent.coverPhotoUrl === image.url
          ? remainingPhotos[0]?.url || ""
          : activeEvent.coverPhotoUrl || "";

      const batch = writeBatch(db);
      batch.delete(doc(db, "eventPhotos", image.id));

      votesSnap.forEach((voteDoc) => {
        batch.delete(doc(db, "eventVotes", voteDoc.id));
      });

      batch.update(doc(db, "events", activeEvent.id), {
        photoCount: increment(-1),
        coverPhotoUrl: nextCoverUrl,
        lastDeletedPhotoId: image.id,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      if (detailImage?.id === image.id) setDetailImage(null);
      showToast("Event photo deleted.", "success");
    } catch (err) {
      console.error("delete event photo failed", err);
      alert(err?.message || "Could not delete event photo.");
    } finally {
      setEventSaving(false);
    }
  };

  const openEditEventPhotoModal = (image) => {
    if (!user || !activeEvent || !image?.id) return;
    const canEdit =
      image.ownerUid === user.uid || activeEvent.ownerUid === user.uid;
    if (!canEdit) return;

    setEditingEventPhotoId(image.id);
    setEditTitle(image.title || "");
    setEditDescription(image.subtitle || "");
    setShowEditEventPhotoModal(true);
  };

  const handleEditEventPhotoSubmit = async (e) => {
    e.preventDefault();
    if (!editingEventPhotoId) return;

    const title = editTitle.trim();
    const subtitle = editDescription.trim();
    if (!title || !subtitle) return;

    try {
      setEventPhotoEditing(true);
      await updateDoc(doc(db, "eventPhotos", editingEventPhotoId), {
        title,
        subtitle,
        updatedAt: serverTimestamp(),
      });

      setDetailImage((prev) =>
        prev?.id === editingEventPhotoId
          ? {
              ...prev,
              title,
              subtitle,
            }
          : prev,
      );

      setShowEditEventPhotoModal(false);
      setEditingEventPhotoId("");
      setEditTitle("");
      setEditDescription("");
      showToast("Event photo updated.", "success");
    } catch (err) {
      console.error("edit event photo failed", err);
      alert(err?.message || "Could not update event photo.");
    } finally {
      setEventPhotoEditing(false);
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
                  className="flex items-center gap-2 rounded-xl bg-[#28457a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d3456]"
                >
                  <Plus size={16} />
                  <span>Add to album ({selectedIds.size})</span>
                </button>

                {selectedEditableUpload && isHFConfigured() && (
                  <button
                    onClick={openAIEditModal}
                    className="flex items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-fuchsia-600"
                  >
                    <Sparkles size={16} />
                    <span>Edit with AI</span>
                  </button>
                )}

                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
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
              onClick={() => setShowCreateEventModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <CalendarDays size={16} />
              <span className="hidden sm:inline">Create Event</span>
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
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="page-label">User dashboard</p>
                <h1 className="page-title">
                  {viewMode === "events"
                    ? activeEvent
                      ? activeEvent.name
                      : "Event Vaults"
                    : viewMode === "albums"
                    ? activeAlbum
                      ? activeAlbum.name
                      : "Albums"
                    : "Themed Image Gallery"}
                </h1>
              </div>

              {viewMode === "events" && activeEvent && isActiveEventOwner && (
                <button
                  type="button"
                  onClick={openEditEventModal}
                  disabled={eventSaving}
                  className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                  aria-label="Edit event"
                >
                  <Pencil size={17} />
                  <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block group-focus:block">
                    Edit event
                  </span>
                </button>
              )}
            </div>

            <p className="mt-2 max-w-190 text-[17px] text-[#64748b] dark:text-slate-400">
              {viewMode === "events"
                ? activeEvent
                  ? activeEvent.description || "Collect event photos from every member and vote on favorite moments."
                  : "Create shared spaces where friends can contribute photos, comment, and vote on the best moments."
                : viewMode === "albums"
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
                  setActiveEventId(null);
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
                  setActiveEventId(null);
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

              <button
                onClick={() => {
                  setViewMode("events");
                  setActiveAlbumId(null);
                  setActiveEventId(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "events" && !activeEvent
                    ? "bg-[#28457a] text-white shadow-md"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <CalendarDays size={16} />
                Events
                {eventInvites.length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-[#0f172f]">
                    {eventInvites.length}
                  </span>
                )}
              </button>

              {viewMode === "albums" && activeAlbum && (
                <button
                  onClick={() => setActiveAlbumId(null)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Back to Albums
                </button>
              )}

              {viewMode === "events" && activeEvent && (
                <button
                  onClick={() => setActiveEventId(null)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Back to Events
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

                {imagesToRender.filter((img) => img && img.publicId).length >= 2 && (
                  <button
                    onClick={() => {
                      setVideoModalAlbum(activeAlbum);
                      setVideoModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-900/20 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
                  >
                    <Film size={16} />
                    Generate Video
                  </button>
                )}
              </div>
            )}

            {viewMode === "events" && activeEvent && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="mr-auto flex flex-wrap items-center gap-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  <span
                    tabIndex={0}
                    className="group relative inline-flex cursor-default items-center gap-1 rounded-full px-2 py-1 outline-none transition hover:bg-white/70 focus:bg-white/70 dark:hover:bg-slate-800/70 dark:focus:bg-slate-800/70"
                    aria-label={`Event members: ${
                      eventMembers
                        .map((member) => member.displayName || member.email || member.uid)
                        .join(", ") || "Loading"
                    }`}
                  >
                    <Users size={16} />
                    {activeEvent.memberUids?.length || 1} member
                    {(activeEvent.memberUids?.length || 1) === 1 ? "" : "s"}
                    <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden min-w-60 max-w-80 rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm font-medium text-slate-700 shadow-xl group-hover:block group-focus:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        Members
                      </span>
                      <span className="block space-y-1.5">
                        {eventMembers.length === 0 ? (
                          <span className="block text-slate-500 dark:text-slate-400">
                            Loading members...
                          </span>
                        ) : (
                          eventMembers.map((member) => {
                            const name =
                              member.displayName || member.email || member.uid;
                            const isOwner = member.uid === activeEvent.ownerUid;
                            return (
                              <span
                                key={member.uid}
                                className="flex items-center justify-between gap-3"
                              >
                                <span className="min-w-0 truncate">{name}</span>
                                {isOwner && (
                                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                                    Owner
                                  </span>
                                )}
                              </span>
                            );
                          })
                        )}
                      </span>
                  </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon size={16} />
                    {activeEvent.photoCount || eventPhotos.length} photo
                    {(activeEvent.photoCount || eventPhotos.length) === 1 ? "" : "s"}
                  </span>
                </div>

                {isActiveEventOwner && (
                  <>
                    <button
                      onClick={() => setShowInviteEventModal(true)}
                      disabled={eventSaving}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                    >
                      <Users size={16} />
                      Invite by Email
                    </button>

                    <button
                      onClick={handleDeleteEvent}
                      disabled={eventSaving}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                    >
                      <Trash2 size={16} />
                      {eventSaving ? "Deleting..." : "Delete Event"}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowEventUploadModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Upload size={16} />
                  Add Event Photo
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
                const owned = isOwnedUpload(image, user);
                const isSharedItem = Boolean(image.isSharedWithMe) ||
                  (image.ownerUid && user?.uid && image.ownerUid !== user.uid);

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
                      <img
                        src={image.url}
                        alt={image.title}
                        onClick={() => setDetailImage(image)}
                        className="gallery-card-img"
                      />
                      {owned && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(image.id)}
                          className="absolute right-3 top-3 h-5 w-5 cursor-pointer accent-indigo-600"
                        />
                      )}
                    </div>

	                    <div className="gallery-card-body">
	                      <span className="card-theme-badge">{image.themeLabel}</span>
	                      <h2 className="card-title">{image.title}</h2>
	                      <p className="card-subtitle">{image.subtitle}</p>
                      {isSharedItem && image.ownerName && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          Shared by {image.ownerName}
                        </p>
                      )}

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

                        {owned && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditImageModal(image);
                            }}
                            className="group relative ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            aria-label={`Edit ${image.title}`}
                          >
                            <Pencil size={16} />
                            <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block group-focus:block">
                              Edit details
                            </span>
                          </button>
                        )}
	                      </div>

                      {isSharedItem && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromMyGallery(image);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            <UserMinus size={14} />
                            Remove from my gallery
                          </button>
                        </div>
                      )}

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
		                  </article>
		                );
	              })}
            </div>
          </section>
        ) : viewMode === "albums" ? (
          !activeAlbum ? (
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
            setSelectedIds={setSelectedIds}
            selectedIds={selectedIds}
	        />
	      ))}
	    </div>
	  </SortableContext>
</DndContext>
            )}
          </section>
          )
        ) : !activeEvent ? (
          <section className="page-container mt-8 section-card">
            {eventInvites.length > 0 && (
              <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                      Pending invitations
                    </p>
                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-100/80">
                      Accept an invitation to join the event vault and start contributing photos.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-slate-900 dark:text-amber-200 dark:ring-amber-900/60">
                    {eventInvites.length}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {eventInvites.map((invite) => (
                    <article
                      key={invite.id}
                      className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-amber-100 dark:bg-[#2a3655] dark:ring-amber-900/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-[#0f172f] dark:text-white">
                          {invite.eventName}
                        </h3>
                        {invite.eventDescription && (
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {invite.eventDescription}
                          </p>
                        )}
                        <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          Invited by {invite.ownerName || "Event owner"}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondToEventInvite(invite, "rejected")}
                          disabled={eventSaving}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondToEventInvite(invite, "accepted")}
                          disabled={eventSaving}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Accept
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  No event vaults yet
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create a shared space for a party, trip, class project, or team event.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setActiveEventId(event.id)}
                    className="overflow-hidden rounded-3xl bg-white text-left ring-2 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#2a3655] dark:ring-emerald-900/50"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-emerald-50 dark:bg-emerald-950/30">
                      {event.coverPhotoUrl ? (
                        <img
                          src={event.coverPhotoUrl}
                          alt={event.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-emerald-500">
                          <CalendarDays size={44} />
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold text-[#0f172f] dark:text-white">
                          {event.name}
                        </h3>
                        {event.ownerUid === user.uid && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                            Owner
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                          {event.description}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                          <Users size={13} />
                          {event.memberUids?.length || 1}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                          <ImageIcon size={13} />
                          {event.photoCount || 0}
                        </span>
                      </div>
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
                  This event vault is empty
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Add the first event photo, then invite others to contribute their view of the moment.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredImages.map((image) => {
                  const voteState = eventVotes[image.id] || { count: 0, voted: false };
                  const canManageEventPhoto =
                    image.ownerUid === user.uid || activeEvent.ownerUid === user.uid;
                  return (
                    <article
                      key={image.id}
                      className="relative overflow-hidden rounded-3xl bg-white ring-2 ring-emerald-100 dark:bg-[#2a3655] dark:ring-emerald-900/50"
                    >
                      <div className="relative">
                        <img
                          src={image.url}
                          alt={image.title}
                          onClick={() => setDetailImage(image)}
                          className="gallery-card-img"
                        />
                        {voteState.count > 0 && (
                          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                            <Trophy size={14} />
                            {voteState.count}
                          </div>
                        )}
                      </div>

                      <div className="gallery-card-body">
                        <h2 className="card-title">{image.title}</h2>
                        <p className="card-subtitle">{image.subtitle}</p>
                        {image.ownerName && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Added by {image.ownerName}
                          </p>
                        )}

                        <div className="card-stats">
                          <button
                            onClick={() => toggleEventVote(image.id)}
                            className="card-stat-btn"
                          >
                            <Trophy
                              size={18}
                              className={
                                voteState.voted
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-slate-400 dark:text-slate-500"
                              }
                            />
                            <span
                              className={
                                voteState.voted
                                  ? "text-amber-600 dark:text-amber-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }
                            >
                              {voteState.voted ? "Voted" : "Vote"} ({voteState.count})
                            </span>
                          </button>

                          <button
                            onClick={() => setDetailImage(image)}
                            className="card-comment-btn"
                          >
                            <MessageCircle size={18} />
                            <span>{commentCounts[image.id] ?? 0}</span>
                          </button>

                          {canManageEventPhoto && (
                            <>
                            <button
                              type="button"
                              onClick={() => openEditEventPhotoModal(image)}
                              disabled={eventPhotoEditing}
                              className="group relative ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              aria-label={`Edit ${image.title}`}
                            >
                              <Pencil size={16} />
                              <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block group-focus:block">
                                Edit details
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteEventPhoto(image)}
                              disabled={eventSaving}
                              className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                              aria-label={`Delete ${image.title}`}
                            >
                              <Trash2 size={16} />
                              <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block group-focus:block">
                                Delete photo
                              </span>
                            </button>
                            </>
                          )}
                          </div>
                      </div>
                    </article>
                  );
                })}
              </div>
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
                  <label className="form-label">Image File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                    className="w-full text-sm text-slate-700"
                    required
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    You can apply AI styles later from the top toolbar after selecting an uploaded photo.
                  </p>
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
                    <img
                      src={aiPreviewUrl || selectedEditableUpload.url}
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

        {showEditEventModal && activeEvent && (
          <div className="modal-overlay">
            <div className="w-full max-w-[560px] rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Edit Event
              </h2>
              <p className="modal-subtitle">
                Update the name and description shown to event members.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleEditEventSubmit}>
                <div>
                  <label className="form-label">Event Name</label>
                  <input
                    type="text"
                    value={editEventName}
                    onChange={(e) => setEditEventName(e.target.value)}
                    placeholder="CMPE 280 Hackathon"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={editEventDescription}
                    onChange={(e) => setEditEventDescription(e.target.value)}
                    placeholder="Team photos, demos, and final presentation moments"
                    className="form-input"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditEventModal(false);
                      setEditEventName(activeEvent.name || "");
                      setEditEventDescription(activeEvent.description || "");
                    }}
                    disabled={eventSaving}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={eventSaving || !editEventName.trim()}
                    className="h-12 w-1/2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {eventSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditEventPhotoModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-125 rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Edit Event Photo
              </h2>
              <p className="modal-subtitle">
                Update the title and caption shown in this event vault.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleEditEventPhotoSubmit}>
                <div>
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    placeholder="Photo title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Caption</label>
                  <input
                    type="text"
                    placeholder="Photo caption"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditEventPhotoModal(false);
                      setEditingEventPhotoId("");
                      setEditTitle("");
                      setEditDescription("");
                    }}
                    disabled={eventPhotoEditing}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={eventPhotoEditing || !editTitle.trim() || !editDescription.trim()}
                    className="h-12 w-1/2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {eventPhotoEditing ? "Saving..." : "Save Changes"}
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

        {showCreateEventModal && (
          <div className="modal-overlay">
            <div className="w-full max-w-[560px] rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Create Event Vault
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Make a shared space where members can add photos and vote on favorite moments.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleCreateEvent}>
                <div>
                  <label className="form-label">Event Name</label>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder="CMPE 280 Hackathon"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    placeholder="Team photos, demos, and final presentation moments"
                    className="form-input"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateEventModal(false);
                      setNewEventName("");
                      setNewEventDescription("");
                    }}
                    disabled={eventSaving}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={eventSaving || !newEventName.trim()}
                    className="h-12 w-1/2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {eventSaving ? "Creating..." : "Create Vault"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showInviteEventModal && activeEvent && (
          <div className="modal-overlay">
            <div className="w-full max-w-[520px] rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Send Event Invitation
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Send a pending invitation to a registered PixelVault user. They join only after accepting it.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleInviteToEvent}>
                <div>
                  <label className="form-label">User Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="friend@example.com"
                    className="form-input"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteEventModal(false);
                      setInviteEmail("");
                    }}
                    disabled={eventSaving}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={eventSaving || !inviteEmail.trim()}
                    className="h-12 w-1/2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {eventSaving ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEventUploadModal && activeEvent && (
          <div className="modal-overlay">
            <div className="w-full max-w-[540px] rounded-[28px] bg-white p-8 shadow-xl dark:bg-[#2a3655]">
              <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">
                Add Event Photo
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Contribute a photo to &ldquo;{activeEvent.name}&rdquo;.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleEventUploadSubmit}>
                <div>
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    value={eventUploadTitle}
                    onChange={(e) => setEventUploadTitle(e.target.value)}
                    placeholder="Demo day highlights"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Caption</label>
                  <input
                    type="text"
                    value={eventUploadDescription}
                    onChange={(e) => setEventUploadDescription(e.target.value)}
                    placeholder="What was happening in this moment?"
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Image File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEventUploadFile(e.target.files[0] || null)}
                    className="w-full text-sm text-slate-700 dark:text-slate-300"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEventUploadModal(false);
                      setEventUploadTitle("");
                      setEventUploadDescription("");
                      setEventUploadFile(null);
                    }}
                    disabled={eventUploading}
                    className="h-12 w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      eventUploading ||
                      !eventUploadTitle.trim() ||
                      !eventUploadDescription.trim() ||
                      !eventUploadFile
                    }
                    className="h-12 w-1/2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {eventUploading ? "Uploading..." : "Add Photo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-100 -translate-x-1/2">
            <div
              className={`pointer-events-auto rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg ${
                toast.kind === "error"
                  ? "bg-red-600 text-white"
                  : toast.kind === "success"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-white"
              }`}
            >
              {toast.message}
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
          onOpenShare={(image) => setShareDialogUpload(image)}
          canShare={isOwnedUpload(detailImage, user) && !detailImage.isEventPhoto}
        />
      )}

      <ShareDialog
        open={!!shareDialogUpload}
        upload={shareDialogUpload}
        onClose={() => setShareDialogUpload(null)}
        currentUser={user}
      />

      <VideoGeneratorModal
        open={videoModalOpen && !!videoModalAlbum}
        onClose={() => setVideoModalOpen(false)}
        album={videoModalAlbum}
        albumPhotos={
          videoModalAlbum
            ? albumPhotos
                .filter((rel) => rel.albumId === videoModalAlbum.id)
                .sort((a, b) => a.order - b.order)
                .map((rel) => allPhotosMap.get(rel.photoId))
                .filter(Boolean)
            : []
        }
        ownerUid={user?.uid}
        ownerName={profile?.displayName || user?.email || ""}
      />
    </>
  );
}

export default UserHomePage;
