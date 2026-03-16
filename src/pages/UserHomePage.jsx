import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { allThemeImages, themeById, themeData } from "../data/galleryData";

const UPLOAD_STORAGE_KEY_PREFIX = "userGalleryUploadsV1";

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
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.url === "string" &&
        typeof item.themeId === "string"
    );
  } catch {
    return [];
  }
}

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

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      navigate("/auth?mode=login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("currentUser");
    navigate("/auth?mode=login");
  };

  const imagesToRender = useMemo(() => {
    const sortedUploads = [...uploadedImages].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );

    if (activeTheme === "all") {
      return [...sortedUploads, ...allThemeImages];
    }

    const selectedTheme = themeById[activeTheme];
    if (!selectedTheme) {
      return [];
    }

    const uploadsForTheme = sortedUploads.filter(
      (image) => image.themeId === activeTheme
    );

    const themeImages = [
      ...uploadsForTheme,
      ...selectedTheme.images.map((image) => ({
        ...image,
        themeLabel: selectedTheme.label,
      })),
    ];

    return themeImages;
  }, [activeTheme, uploadedImages]);

  const filteredImages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return imagesToRender;
    }

    return imagesToRender.filter((image) => {
      const title = image.title?.toLowerCase() || "";
      const subtitle = image.subtitle?.toLowerCase() || "";

      return (
        title.includes(normalizedQuery) || subtitle.includes(normalizedQuery)
      );
    });
  }, [imagesToRender, searchQuery]);

  const activeThemeDescription =
    activeTheme === "all"
      ? "Showing all themed image collections."
      : themeById[activeTheme]?.description || "Theme not found.";

  useEffect(() => {
    window.localStorage.setItem(userUploadsKey, JSON.stringify(uploadedImages));
  }, [uploadedImages, userUploadsKey]);

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!uploadFile) return;
    if (!uploadDescription.trim()) return;
    if (!uploadTitle.trim()) return;

    try {
      const dataUrl = await readFileAsDataUrl(uploadFile);
      const now = Date.now();
      const chosenTheme = themeById[uploadTheme];

      const newUpload = {
        id: `upload-${now}`,
        title: uploadTitle.trim(),
        subtitle: uploadDescription.trim(),
        url: dataUrl,
        themeId: uploadTheme,
        themeLabel: chosenTheme?.label || "Custom",
        createdAt: now,
        isUserUpload: true,
      };

      setUploadedImages((previous) => [...previous, newUpload]);
      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      setShowUploadModal(false);
    } catch {
      // Ignore read failures silently for demo flow
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-6 py-8 text-slate-900 sm:px-10 lg:px-16">
      <header className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#64748b]">
            User dashboard
          </p>
          <h1 className="mt-2 text-[34px] font-bold tracking-[-0.03em] text-[#0f172f] sm:text-[44px]">
            Themed Image Gallery
          </h1>
          <p className="mt-2 max-w-[760px] text-[17px] leading-7 text-[#64748b]">
            Browse sample images organized by theme. Switch categories to review
            focused collections or view the full gallery at once.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleLogout}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Log out
          </button>

          <button
            onClick={handleSwitchAccount}
            className="rounded-2xl bg-[#000d33] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00154d]"
          >
            Switch Account
          </button>
        </div>
      </header>

      <section className="mx-auto mt-8 w-full max-w-[1400px] rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="rounded-full bg-[#000d33] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00154d]"
          >
            Add Image
          </button>

          <button
            type="button"
            onClick={() => setActiveTheme("all")}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              activeTheme === "all"
                ? "bg-[#000d33] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Themes
          </button>

          {themeData.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setActiveTheme(theme.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTheme === theme.id
                  ? "bg-[#000d33] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-[#f8fafc] px-5 py-4 text-sm text-[#475569]">
          {activeThemeDescription}
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title or description"
            className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredImages.map((image) => (
            <article
              key={image.id}
              className="overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-200"
            >
              <img
                src={image.url}
                alt={image.title}
                className="h-[240px] w-full object-cover"
                loading="lazy"
              />
              <div className="space-y-2 p-4">
                <span className="inline-flex rounded-full bg-[#dde7ff] px-3 py-1 text-xs font-semibold text-[#28457a]">
                  {image.themeLabel}
                </span>
                <h2 className="text-[20px] font-bold text-[#0f172f]">
                  {image.title}
                </h2>
                <p className="text-sm text-[#64748b]">{image.subtitle}</p>
              </div>
            </article>
          ))}
        </div>

        {filteredImages.length === 0 ? (
          <p className="mt-5 rounded-xl bg-[#f8fafc] px-4 py-3 text-sm text-[#64748b]">
            No images match your search.
          </p>
        ) : null}
      </section>

      {showUploadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0f172f]">
                  Add Your Own Image
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Choose a theme, write a description, and upload an image.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Title
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                    placeholder="Give your image a title"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Theme
                  <select
                    value={uploadTheme}
                    onChange={(event) => setUploadTheme(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {themeData.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Description
                  <input
                    type="text"
                    required
                    value={uploadDescription}
                    onChange={(event) =>
                      setUploadDescription(event.target.value)
                    }
                    placeholder="Describe the image"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Image
                <input
                  type="file"
                  required
                  accept="image/*"
                  onChange={(event) =>
                    setUploadFile(event.target.files?.[0] || null)
                  }
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-[#000d33] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00154d]"
                >
                  Save Image
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default UserHomePage;
