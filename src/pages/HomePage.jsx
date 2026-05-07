import React, { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { allThemeImages, themeData } from "../data/galleryData";
import { ThemeToggle } from "../ThemeContext";
import { useAuth } from "../lib/AuthContext";
import {
  Search,
  Image as ImageIcon,
  Layout,
  Zap,
  CheckCircle2,
  ArrowRight,
  LogOut,
  LayoutDashboard,
  User,
  Twitter,
  Github,
  Linkedin,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Fast Gallery Search",
    description:
      "Search the themed gallery and your dashboard photos by title, caption, and category.",
  },
  {
    icon: Layout,
    title: "Albums & Event Vaults",
    description:
      "Organize photos into albums or create collaborative event spaces with invitations, votes, and comments.",
  },
  {
    icon: Zap,
    title: "Creative Upload Tools",
    description:
      "Upload images to your account, edit details, apply AI styles, and turn albums into short videos.",
  },
];

const benefits = [
  "Secure accounts with editable user profiles",
  "Cloud-backed photo uploads",
  "Invite-based event vault collaboration",
  "Likes, comments, votes, sharing, and slideshow tools",
];

const coverPhotos = [
  "/images/cover-photos/enrico-bet-IicyiaPYGGI-unsplash.jpg",
  "/images/cover-photos/adam-kool-ndN00KmbJ1c-unsplash.jpg",
  "/images/cover-photos/vincent-van-zalinge-vUNQaTtZeOo-unsplash.jpg",
  "/images/cover-photos/casey-horner-4rDCa5hBlCs-unsplash.jpg",
];

export default function App() {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("logout failed", err);
    }
    navigate("/");
  };

  const previewImages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return allThemeImages.slice(0, 4);
    }

    return allThemeImages
      .filter((image) => {
        const haystack =
          `${image.title} ${image.subtitle} ${image.themeLabel}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 4);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#f6f7fb] dark:bg-[#1a2035] text-slate-900 dark:text-white selection:bg-[#dde7ff] selection:text-[#000d33] font-sans">
      {/* Navigation Header */}
      <header
        className={`fixed top-0 z-50 flex w-full justify-center transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-[#222b45]/80 backdrop-blur-md shadow-sm py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="flex w-full max-w-[1440px] items-center justify-between px-6 sm:px-10 lg:px-16">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#000d33] to-[#28457a] text-white shadow-lg">
              <ImageIcon size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-[#0f172f] dark:text-white">
                Pixel<span className="text-[#28457a]">Vault</span>
              </h2>
            </div>
          </div>

          <nav className="hidden items-center gap-8 lg:flex">
            {["Features", "Cloud", "Preview"].map((item) => (
              <button
                key={item}
                onClick={() =>
                  document
                    .getElementById(item.toLowerCase())
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-[#0f172f] dark:hover:text-white"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <Link
                  to="/user-home"
                  className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-[#0f172f] dark:text-white transition hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <LayoutDashboard size={16} />
                  <span>My Photos</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="group flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-800"
                >
                  <LogOut
                    size={16}
                    className="transition-transform group-hover:-translate-x-0.5"
                  />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/auth?mode=login"
                className="rounded-xl bg-[#000d33] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#000d33]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00154d] hover:shadow-lg hover:shadow-[#000d33]/30"
              >
                Join Free
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="pt-28 lg:pt-36">
        {/* Hero Section */}
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-16 px-6 pb-20 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-16 lg:pb-32">
          {/* Hero Content */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dde7ff] bg-[#f0f4ff] px-4 py-1.5 text-sm font-semibold text-[#28457a] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#28457a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#28457a]"></span>
              </span>
              New: Collaborative event vaults
            </div>

            <h1 className="mt-8 max-w-[700px] text-[48px] font-extrabold leading-[1.05] tracking-tight text-[#0f172f] dark:text-white sm:text-[64px] lg:text-[72px]">
              A more intelligent home for your{" "}
              <span className="text-[#28457a] dark:text-[#6b9bd2]">
                greatest moments.
              </span>
            </h1>

            <p className="mt-6 max-w-[600px] text-[18px] leading-relaxed text-[#64748b] dark:text-slate-300 sm:text-[20px]">
              Upload photos, organize albums, share event spaces, and turn
              collections into styled images or short slideshow videos from one
              focused gallery dashboard.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              {currentUser ? (
                <Link
                  to="/user-home"
                  className="group flex items-center justify-center gap-2 rounded-2xl bg-[#000d33] px-8 py-4 text-[16px] font-semibold text-white shadow-lg shadow-[#000d33]/25 transition-all hover:-translate-y-0.5 hover:bg-[#00154d] hover:shadow-xl hover:shadow-[#000d33]/30"
                >
                  <LayoutDashboard size={20} />
                  View My Gallery
                </Link>
              ) : (
                <Link
                  to="/auth?mode=signup"
                  className="group flex items-center justify-center gap-2 rounded-2xl bg-[#000d33] px-8 py-4 text-[16px] font-semibold text-white shadow-lg shadow-[#000d33]/25 transition-all hover:-translate-y-0.5 hover:bg-[#00154d] hover:shadow-xl hover:shadow-[#000d33]/30"
                >
                  Start Storing Now
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              )}

              <a
                href="#preview"
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-4 text-[16px] font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                Try the Search
              </a>
            </div>

            {/* Stats Row */}
            <div className="mt-14 flex items-center gap-8 border-t border-slate-200 dark:border-slate-700 pt-8">
              <div>
                <p className="text-[32px] font-extrabold tracking-tight text-[#0f172f] dark:text-white">
                  Live
                </p>
                <p className="text-sm font-medium text-[#64748b] dark:text-slate-400">
                  Collaboration
                </p>
              </div>
              <div className="h-12 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div>
                <p className="text-[32px] font-extrabold tracking-tight text-[#0f172f] dark:text-white">
                  Event
                </p>
                <p className="text-sm font-medium text-[#64748b] dark:text-slate-400">
                  Shared vaults
                </p>
              </div>
              <div className="hidden sm:block h-12 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div className="hidden sm:block">
                <p className="text-[32px] font-extrabold tracking-tight text-[#0f172f] dark:text-white">
                  AI
                </p>
                <p className="text-sm font-medium text-[#64748b] dark:text-slate-400">
                  Style + video
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Preview Card */}
          <div
            id="preview"
            className="relative flex items-center justify-center lg:justify-end"
          >
            <div className="absolute -left-10 top-0 h-[300px] w-[300px] rounded-full bg-[#3a63ad]/40 blur-[80px]"></div>
            <div className="absolute -right-10 bottom-0 h-[300px] w-[300px] rounded-full bg-[#8ba3d4]/50 blur-[80px]"></div>
            <div className="absolute -inset-4 rounded-[50px] bg-gradient-to-tr from-[#ffffff]/50 to-transparent blur-2xl opacity-60"></div>

            <div className="relative w-full max-w-[680px] rounded-[32px] border border-white/40 dark:border-white/10 bg-white/10 dark:bg-slate-800/60 p-6 shadow-[0_24px_80px_rgba(15,23,47,0.15),inset_0_1px_2px_rgba(255,255,255,0.6)] backdrop-blur-3xl backdrop-saturate-200 sm:p-8">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none text-slate-500 dark:text-slate-300">
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Try 'Nature', 'Fox', 'Tacos', or 'Skyline'..."
                  className="h-[60px] w-full rounded-2xl border border-white/30 dark:border-slate-500 bg-white/20 dark:bg-slate-700/70 pl-14 pr-6 text-[16px] text-slate-800 dark:text-white shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] outline-none backdrop-blur-md transition-all placeholder:text-slate-500 dark:placeholder:text-slate-300 hover:bg-white/30 dark:hover:bg-slate-700/90 focus:border-white/50 dark:focus:border-slate-400 focus:bg-white/40 focus:ring-4 focus:ring-white/20"
                />
              </div>

              {/* Theme Pills */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-200 uppercase tracking-wider py-2 pr-2 drop-shadow-sm">
                  Explore:
                </span>
                {themeData.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSearchQuery(theme.label)}
                    className="rounded-full border border-white/30 dark:border-slate-400 bg-white/20 dark:bg-slate-600/60 px-4 py-1.5 text-sm font-semibold text-slate-700 dark:text-white shadow-sm backdrop-blur-md transition-all hover:border-[#32484e] hover:bg-white/40 dark:hover:bg-slate-500 hover:text-[#28457a] dark:hover:text-white focus:ring-2 focus:ring-[#28457a] focus:outline-none"
                  >
                    {theme.label}
                  </button>
                ))}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rounded-full border border-white/10 dark:border-slate-500 bg-slate-800/5 dark:bg-slate-600/40 px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-200 backdrop-blur-md transition-colors hover:bg-slate-800/10"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Image Grid */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                {previewImages.map((image) => (
                  <div
                    key={image.id}
                    className="group relative overflow-hidden rounded-[20px] bg-white/10 ring-1 ring-white/30 shadow-[0_4px_16px_rgba(0,0,0,0.05)] backdrop-blur-md"
                  >
                    <img
                      src={image.url}
                      alt={image.title}
                      className="h-[180px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f172f]/90 via-[#0f172f]/50 to-transparent p-4 pt-12 transition-opacity duration-300">
                      <p className="text-sm font-semibold text-white drop-shadow-md">
                        {image.title}
                      </p>
                      <p className="mt-0.5 text-xs text-white/90 drop-shadow-md">
                        {image.themeLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {previewImages.length === 0 ? (
                <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/40 bg-white/10 backdrop-blur-md py-12 text-center shadow-sm">
                  <Search
                    className="mb-3 text-slate-600 drop-shadow-sm"
                    size={32}
                  />
                  <p className="text-sm font-medium text-[#0f172f] drop-shadow-sm">
                    No matches found
                  </p>
                  <p className="mt-1 text-xs text-slate-600 drop-shadow-sm">
                    Try searching for another title, theme, or caption.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Cloud Section */}
        <section
          id="cloud"
          className="relative bg-white dark:bg-[#222b45] py-20 sm:py-28"
        >
          <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16">
            <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-20">
              <div className="flex-1">
                <p className="section-label">Connected Gallery</p>
                <h2 className="section-title">
                  Upload, organize, and collaborate in one dashboard.
                </h2>
                <p className="mt-5 text-[18px] leading-relaxed text-[#64748b] dark:text-slate-400">
                  PixelVault combines secure accounts, live gallery activity,
                  and cloud-backed image uploads so each user can build a
                  personal gallery, share selected photos, and collaborate
                  inside event vaults.
                </p>

                <ul className="mt-8 space-y-4">
                  {[
                    "Upload and manage personal photo details",
                    "Create albums and reorder album photos",
                    "Share uploads by email or public link",
                    "Invite users to event vaults and collect votes",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-[16px] text-[#0f172f] dark:text-slate-200"
                    >
                      <CheckCircle2
                        size={20}
                        className="shrink-0 text-[#28457a]"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex-1 w-full">
                <div className="overflow-hidden rounded-[32px] bg-white dark:bg-[#2a3655] shadow-[0_8px_40px_rgba(15,23,47,0.08)] ring-1 ring-slate-200 dark:ring-slate-700">
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={coverPhotos[0]}
                      alt="Landscape gallery cover"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172f]/80 via-[#0f172f]/20 to-transparent"></div>
                    <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                          Live workspace
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-white">
                          Gallery dashboard
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/90 px-4 py-2 text-sm font-bold text-[#0f172f] shadow-lg backdrop-blur">
                        Event ready
                      </div>
                    </div>
                  </div>

                  <div className="p-8">
                  <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#000d33] to-[#28457a]">
                      <ImageIcon size={26} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[18px] font-bold text-[#0f172f] dark:text-white">
                        PixelVault Dashboard
                      </p>
                      <p className="text-sm text-[#64748b] dark:text-slate-400">
                        Uploads · Albums · Events
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    {[
                      { value: "Live", label: "Collaboration" },
                      { value: "Live", label: "Activity" },
                      { value: "AI", label: "Tools" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl bg-[#f6f7fb] dark:bg-slate-800 px-4 py-5"
                      >
                        <p className="text-[28px] font-extrabold text-[#0f172f] dark:text-white">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#64748b] dark:text-slate-400">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="relative bg-[#f6f7fb] dark:bg-[#1a2035] py-20 sm:py-28"
        >
          <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16">
            <div className="max-w-[720px]">
              <p className="section-label">Why PixelVault</p>
              <h2 className="section-title">
                Built around the features you can use today.
              </h2>
              <p className="mt-5 text-[18px] leading-relaxed text-[#64748b] dark:text-slate-400">
                PixelVault focuses on practical gallery workflows: browse,
                upload, organize, collaborate, edit, share, and generate
                videos from your own albums.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-700 bg-white dark:bg-[#2a3655] shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,47,0.08)]"
                  >
                    <div className="relative h-40 overflow-hidden bg-white dark:bg-[#2a3655]">
                      <img
                        src={coverPhotos[idx + 1]}
                        alt={`${feature.title} cover`}
                        className="h-[calc(100%+2px)] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute -bottom-px inset-x-0 top-0 bg-gradient-to-t from-white via-white/20 to-transparent dark:from-[#2a3655]"></div>
                    </div>
                    <div className="relative -mt-px bg-white p-8 pt-0 dark:bg-[#2a3655]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f4ff] dark:bg-slate-700 text-[#28457a] dark:text-blue-400 transition-colors group-hover:bg-[#000d33] group-hover:text-white">
                      <Icon size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="mt-6 text-[22px] font-bold text-[#0f172f] dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-[16px] leading-relaxed text-[#64748b] dark:text-slate-400">
                      {feature.description}
                    </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section
          id="benefits"
          className="py-20 sm:py-28 bg-white dark:bg-[#222b45]"
        >
          <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="relative overflow-hidden rounded-[40px] bg-[#000d33] px-8 py-12 sm:px-12 lg:py-20 shadow-2xl">
                <img
                  src={coverPhotos[3]}
                  alt="Shared photo vault cover"
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#000d33]/95 via-[#000d33]/80 to-[#28457a]/50"></div>

                <div className="relative z-10">
                  <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#dde7ff]">
                    Your Dashboard
                  </p>
                  <h2 className="mt-5 text-[36px] font-extrabold tracking-tight text-white sm:text-[44px] leading-[1.1]">
                    Your photos, albums, and event moments in one place.
                  </h2>
                  <p className="mt-6 text-[18px] leading-relaxed text-white/80">
                    PixelVault gives each account its own dashboard for uploads,
                    albums, profile settings, event invitations, comments,
                    likes, votes, sharing, and creative AI-assisted tools.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:pl-8">
                {benefits.map((benefit, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center gap-5 rounded-[24px] bg-white dark:bg-[#2a3655] p-5 shadow-[0_4px_16px_rgba(15,23,47,0.04)] border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:border-[#28457a]/30 hover:shadow-[0_12px_30px_rgba(15,23,47,0.08)] cursor-default"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f4ff] text-[#28457a] transition-all duration-300 group-hover:scale-110 group-hover:bg-[#dde7ff]">
                      <CheckCircle2 size={20} strokeWidth={2.5} />
                    </div>
                    <p className="text-[16px] font-semibold text-[#0f172f] dark:text-slate-200 transition-colors duration-300 group-hover:text-[#28457a]">
                      {benefit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 sm:px-10 lg:px-16 lg:pb-32">
          <div className="absolute left-1/4 top-1/2 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-[#8ba3d4]/30 blur-[100px] pointer-events-none"></div>
          <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-[#dde7ff]/40 blur-[100px] pointer-events-none"></div>

          <div className="relative overflow-hidden rounded-[40px] border border-white/60 bg-white/20 px-8 py-14 shadow-[0_24px_80px_rgba(15,23,47,0.06),inset_0_1px_2px_rgba(255,255,255,0.7)] backdrop-blur-3xl backdrop-saturate-150 sm:px-14 lg:py-20 text-center">
            <img
              src={coverPhotos[1]}
              alt="Photo collection cover"
              className="absolute inset-0 h-full w-full object-cover opacity-20"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-white/70 dark:bg-[#1a2035]/75"></div>
            <div className="relative z-10 mx-auto max-w-[800px]">
              <p className="mb-4 section-label tracking-[0.25em]">
                Get Started
              </p>
              <h2 className="section-title leading-[1.1] mt-0! text-[34px]">
                Ready to start preserving your story?
              </h2>
              <p className="mx-auto mt-6 max-w-[600px] text-[18px] leading-relaxed text-[#64748b] dark:text-slate-400">
                Create an account, upload your first photos, build albums, and
                invite others into an event vault when a moment deserves a
                shared gallery.
              </p>
            </div>

            <div className="relative z-10 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {currentUser ? (
                <Link
                  to="/user-home"
                  className="flex items-center gap-2 rounded-2xl bg-[#000d33] px-10 py-4 text-[16px] font-bold text-white shadow-lg shadow-[#000d33]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00154d]"
                >
                  <LayoutDashboard size={20} />
                  Open My Vault
                </Link>
              ) : (
                <Link
                  to="/auth?mode=signup"
                  className="flex items-center gap-2 rounded-2xl bg-[#000d33] px-10 py-4 text-[16px] font-bold text-white shadow-lg shadow-[#000d33]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00154d]"
                >
                  Create Free Account
                  <ArrowRight size={18} />
                </Link>
              )}

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="rounded-2xl border border-white/50 bg-white/40 px-10 py-4 text-[16px] font-bold text-slate-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] backdrop-blur-md transition-all hover:border-white/80 hover:bg-white/60"
              >
                Back to top
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="mt-10 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-[#222b45] pt-16 pb-8">
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:grid-cols-5">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#000d33] to-[#28457a] text-white shadow-md">
                  <ImageIcon size={16} className="text-white" />
                </div>
                <h2 className="text-[18px] font-bold tracking-tight text-[#0f172f] dark:text-white">
                  Pixel<span className="text-[#28457a]">Vault</span>
                </h2>
              </div>
              <p className="mt-5 max-w-[300px] text-[15px] leading-relaxed text-[#64748b] dark:text-slate-400">
                A modern photo dashboard for themed browsing, uploads, albums,
                event vaults, sharing, comments, votes, and creative tools.
              </p>
            </div>

            {/* Links Columns */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0f172f] dark:text-white">
                Features
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {["Uploads", "Albums", "Event Vaults", "AI Tools"].map(
                  (item) => (
                    <li key={item}>
                      <a
                        href={`#${item.toLowerCase()}`}
                        className="text-[15px] font-medium text-[#64748b] transition-colors hover:text-[#28457a]"
                      >
                        {item}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0f172f] dark:text-white">
                Support
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {["Profile", "Sharing", "Comments", "Dark Mode"].map((item) => (
                  <li key={item}>
                    <a
                      href={`#${item.toLowerCase()}`}
                      className="text-[15px] font-medium text-[#64748b] transition-colors hover:text-[#28457a]"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0f172f] dark:text-white">
                Legal
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(
                  (item) => (
                    <li key={item}>
                      <a
                        href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                        className="text-[15px] font-medium text-[#64748b] transition-colors hover:text-[#28457a]"
                      >
                        {item}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-16 flex flex-col items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-8 sm:flex-row gap-4">
            <p className="text-[14px] text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} PixelVault Photos Inc. All rights
              reserved.
            </p>
            <div className="flex items-center gap-5 text-slate-400">
              <a
                href="#twitter"
                className="transition-colors hover:text-[#28457a]"
                aria-label="Twitter"
              >
                <Twitter size={20} strokeWidth={2.5} />
              </a>
              <a
                href="#github"
                className="transition-colors hover:text-[#28457a]"
                aria-label="GitHub"
              >
                <Github size={20} strokeWidth={2.5} />
              </a>
              <a
                href="#linkedin"
                className="transition-colors hover:text-[#28457a]"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} strokeWidth={2.5} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
