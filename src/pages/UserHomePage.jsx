import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { allThemeImages, themeById, themeData } from "../data/galleryData";
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
          className="h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
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
            className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-3 py-2"
          >
            <p className="text-sm text-slate-700">{c}</p>

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
  const [selectedIds, setSelectedIds] = useState(new Set());
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
    <main className="min-h-screen bg-[#f6f7fb] px-6 py-8 text-slate-900 sm:px-10 lg:px-16">

      {/* Header Card */}

      <div className="mx-auto w-full max-w-[1400px] rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">

        <nav className="navbar">
          <ul className="navlist">
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/images">Images</Link>
            </li>
          </ul>
        </nav>

        <header className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#64748b]">
              User dashboard
            </p>

            <h1 className="mt-2 text-[34px] font-bold text-[#0f172f] sm:text-[44px]">
              Themed Image Gallery
            </h1>

            <p className="mt-2 max-w-[760px] text-[17px] text-[#64748b]">
              Browse sample images organized by theme.
            </p>
          </div>

          <div className="flex gap-3">

            <button
              onClick={handleLogout}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Log out
            </button>

            <button
              onClick={() => navigate("/user-profile")}
              className="rounded-2xl bg-[#000d33] px-5 py-3 text-sm font-semibold text-white hover:bg-[#00154d]"
            >
              User Profile
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              + Upload Image
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete Selected ({selectedIds.size})
              </button>
            )}

          </div>
        </header>
      </div>

      {/* Image Section */}

      <section className="mx-auto mt-8 w-full max-w-[1400px] rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">

          {filteredImages.map((image) => {
            const isSelected = selectedIds.has(image.id);
            return (
            <article
              key={image.id}
              className={`overflow-hidden rounded-[24px] bg-white ring-2 ${isSelected ? "ring-indigo-500" : "ring-slate-200"}`}
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

                <h2 className="text-[20px] font-bold text-[#0f172f]">
                  {image.title}
                </h2>

                <p className="text-sm text-[#64748b]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[500px] rounded-[28px] bg-white p-8 shadow-xl">

            <h2 className="text-[24px] font-bold text-[#0f172f]">Upload Image</h2>
            <p className="mt-1 text-sm text-[#64748b]">Add a new image to the gallery.</p>

            <form className="mt-6 space-y-4" onSubmit={handleUploadSubmit}>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#324767]">Title</label>
                <input
                  type="text"
                  placeholder="Image title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#324767]">Description</label>
                <input
                  type="text"
                  placeholder="Short description"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#324767]">Theme</label>
                <select
                  value={uploadTheme}
                  onChange={(e) => setUploadTheme(e.target.value)}
                  className="h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
                >
                  {themeData.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#324767]">Image File</label>
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
                  className="h-[48px] w-1/2 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
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
  );
}

export default UserHomePage;