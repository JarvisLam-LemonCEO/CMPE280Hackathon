import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { allThemeImages, themeById, themeData } from "../data/galleryData";
import { ThemeToggle } from "../ThemeContext";
import { Image as ImageIcon, LogOut, User, Trash2, Upload, Search } from "lucide-react";
import "/src/UserHomePage.css";

const UPLOAD_STORAGE_KEY_PREFIX = "userGalleryUploadsV1";

/* ------------------------------------ */
/* Comment Component */
/* ------------------------------------ */

const ImageWithComments = ({ image }) => {
  const storageKey = `comments-${image.id}`;

  const [comment, setComment] = useState("");
  const [commentList, setCommentList] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });

// Store comments locally
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(commentList));
  }, [commentList, storageKey]);

  const handleAddComment = () => {
    if (!comment.trim()) return;

    setCommentList((prev) => [...prev, comment.trim()]);
    setComment("");
  };

  const handleDeleteComment = (index) => {
    setCommentList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddComment();
    }
  };

  return (
    <div className="mt-3">

      <div className="flex gap-2">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          className="h-[44px] w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm text-slate-700 dark:text-slate-200 outline-none"
        />

        <button
          onClick={handleAddComment}
          className="rounded-xl bg-[#000d33] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00154d]"
        >
          Post
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {commentList.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl bg-[#f8fafc] dark:bg-slate-800 px-3 py-2"
          >
            <p className="text-sm text-slate-700 dark:text-slate-300">{c}</p>

            <button
              onClick={() => handleDeleteComment(i)}
              className="rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};

/* ------------------------------------ */
/* Utility Functions */
/* ------------------------------------ */

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function getCurrentUserUploadsKey() {
  if (typeof window === "undefined") {
    return `${UPLOAD_STORAGE_KEY_PREFIX}:guest`;
  }

  try {
    const rawCurrentUser = window.localStorage.getItem("currentUser");
    if (!rawCurrentUser) {
      return `${UPLOAD_STORAGE_KEY_PREFIX}:guest`;
    }

    const currentUser = JSON.parse(rawCurrentUser);
    const userId =
      typeof currentUser?.email === "string" && currentUser.email.trim()
        ? currentUser.email.trim().toLowerCase()
        : "guest";

    return `${UPLOAD_STORAGE_KEY_PREFIX}:${userId}`;
  } catch {
    return `${UPLOAD_STORAGE_KEY_PREFIX}:guest`;
  }
}

function loadCachedUploads(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch {
    return [];
  }
}

/* ------------------------------------ */
/* Main Page */
/* ------------------------------------ */

function UserHomePage() {
  const navigate = useNavigate();
  const userUploadsKey = getCurrentUserUploadsKey();

  const [activeTheme, setActiveTheme] = useState("all");
  const [uploadedImages, setUploadedImages] = useState(() =>
    loadCachedUploads(userUploadsKey)
  );
  const [uploadTheme, setUploadTheme] = useState(themeData[0]?.id || "nature");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [hiddenGalleryIds, setHiddenGalleryIds] = useState(() => {
    try {
      const raw = localStorage.getItem("hiddenGalleryIds");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      navigate("/auth?mode=login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const imagesToRender = useMemo(() => {
    const sortedUploads = [...uploadedImages].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );

    if (activeTheme === "all") {
      const galleryImages = allThemeImages.filter((img) => !hiddenGalleryIds.has(img.id));
      return [...sortedUploads, ...galleryImages];
    }

    const selectedTheme = themeById[activeTheme];
    if (!selectedTheme) return [];

    const uploadsForTheme = sortedUploads.filter(
      (image) => image.themeId === activeTheme
    );

    return [
      ...uploadsForTheme,
      ...selectedTheme.images
        .filter((img) => !hiddenGalleryIds.has(img.id))
        .map((image) => ({ ...image, themeLabel: selectedTheme.label })),
    ];
  }, [activeTheme, uploadedImages, hiddenGalleryIds]);

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
    window.localStorage.setItem(userUploadsKey, JSON.stringify(uploadedImages));
  }, [uploadedImages, userUploadsKey]);

  useEffect(() => {
    localStorage.setItem("hiddenGalleryIds", JSON.stringify([...hiddenGalleryIds]));
  }, [hiddenGalleryIds]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const uploadedIds = new Set(uploadedImages.map((img) => img.id));
    const toHide = [...selectedIds].filter((id) => !uploadedIds.has(id));
    setUploadedImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
    if (toHide.length > 0) {
      setHiddenGalleryIds((prev) => new Set([...prev, ...toHide]));
    }
    setSelectedIds(new Set());
  };

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!uploadFile || !uploadDescription.trim() || !uploadTitle.trim()) return;

    const dataUrl = await readFileAsDataUrl(uploadFile);
    const now = Date.now();

    const newUpload = {
      id: `upload-${uploadTheme}-${now}`,
      title: uploadTitle.trim(),
      subtitle: uploadDescription.trim(),
      url: dataUrl,
      themeId: uploadTheme,
      themeLabel: themeById[uploadTheme]?.label || "Custom",
      createdAt: now,
    };

    setUploadedImages((prev) => [...prev, newUpload]);
    setUploadTitle("");
    setUploadDescription("");
    setUploadFile(null);
    setShowUploadModal(false);
  }

  return (
    <>
      {/* Fixed Navbar */}
      <header
        className={`fixed top-0 z-50 flex w-full justify-center transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-[#222b45]/80 backdrop-blur-md shadow-sm py-4"
            : "bg-white dark:bg-[#222b45] py-6 shadow-sm dark:shadow-slate-900"
        }`}
      >
        <div className="flex w-full max-w-[1440px] items-center justify-between px-6 sm:px-10 lg:px-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#000d33] to-[#28457a] shadow-lg">
              <ImageIcon size={20} className="text-white" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight text-[#0f172f] dark:text-white">
              Pixel<span className="text-[#28457a]">Vault</span>
            </h2>
          </Link>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                <Trash2 size={16} />
                <span>Delete ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <button
              onClick={() => navigate("/user-profile")}
              className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-[#0f172f] dark:text-white transition hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <User size={16} />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm transition hover:border-red-100 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut size={16} className="transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </header>

      <main className="min-h-screen bg-[#f6f7fb] dark:bg-[#1a2035] px-6 pb-8 text-slate-900 dark:text-white sm:px-10 lg:px-16">

      {/* Page Title */}
      <div className="page-container pt-28 pb-0">
        <div className="section-card">
          <p className="page-label">User dashboard</p>
          <h1 className="page-title">Themed Image Gallery</h1>
          <p className="mt-2 max-w-[760px] text-[17px] text-[#64748b] dark:text-slate-400">Browse sample images organized by theme.</p>

          <div className="relative mt-6 max-w-[520px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search images by title or description..."
              className="h-[48px] w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-11 pr-4 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-300 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Image Section */}

      <section className="page-container mt-8 section-card">

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">

          {filteredImages.map((image) => {
            const isSelected = selectedIds.has(image.id);
            return (
            <article
              key={image.id}
              className={`overflow-hidden rounded-[24px] bg-white dark:bg-[#2a3655] ring-2 ${isSelected ? "ring-indigo-500" : "ring-slate-200 dark:ring-slate-700"}`}
            >

              <div className="relative">
                <img
                  src={image.url}
                  alt={image.title}
                  className="h-[240px] w-full object-cover"
                />
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(image.id)}
                  className="absolute top-3 right-3 h-5 w-5 cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="space-y-2 p-4">

                <span className="inline-flex rounded-full bg-[#dde7ff] px-3 py-1 text-xs font-semibold text-[#28457a]">
                  {image.themeLabel}
                </span>

                <h2 className="text-[20px] font-bold text-[#0f172f] dark:text-white">
                  {image.title}
                </h2>

                <p className="text-sm text-[#64748b] dark:text-slate-400">
                  {image.subtitle}
                </p>

                <ImageWithComments image={image} />

              </div>
            </article>
            );
          })}

        </div>

      </section>

      {/* Upload Modal */}

      {showUploadModal && (
        <div className="modal-overlay">
          <div className="w-full max-w-[500px] rounded-[28px] bg-white dark:bg-[#2a3655] p-8 shadow-xl">

            <h2 className="text-[24px] font-bold text-[#0f172f] dark:text-white">Upload Image</h2>
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
                    <option key={theme.id} value={theme.id}>{theme.label}</option>
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
                  className="h-[48px] w-1/2 rounded-2xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-[48px] w-1/2 rounded-2xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Upload
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      </main>
    </>
  );
}

export default UserHomePage;