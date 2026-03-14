import React from "react";
import { Link } from "react-router-dom";


const features = [
  {
    title: "Smart Search",
    description: "Find images quickly by title, category, and tags with a clean search-first experience.",
  },
  {
    title: "Curated Collections",
    description: "Organize images into themes so users can browse content in a structured and visual way.",
  },
  {
    title: "Fast UI",
    description: "Designed for a smooth gallery workflow with responsive layouts and simple navigation.",
  },
];

const benefits = [
  "Easy image discovery for users",
  "Simple category-based organization",
  "Clean interface for demos and hackathons",
  "Scalable layout for future features",
];

const previewCards = [
  {
    title: "Mountain View",
    subtitle: "Nature collection",
    gradient: "from-slate-300 to-slate-400",
  },
  {
    title: "City Lights",
    subtitle: "Urban collection",
    gradient: "from-blue-200 to-blue-400",
  },
  {
    title: "Food Moments",
    subtitle: "Food collection",
    gradient: "from-yellow-200 to-rose-300",
  },
  {
    title: "Wild Stories",
    subtitle: "Animal collection",
    gradient: "from-purple-200 to-indigo-300",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-10 lg:px-16">
        <div>
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[#0f172f]">Image Search Gallery</h2>
          <p className="mt-1 text-sm text-[#64748b]">Discover curated image collections</p>
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          <a href="#features" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Features
          </a>
          <a href="#benefits" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Benefits
          </a>
          <a href="#preview" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Preview
          </a>
        </nav>

        <div className="flex items-center gap-3">
    <Link to="/auth?mode=login">
    <button className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
    Login
    </button>
    </Link>
          
    <Link to="/auth?mode=signup">
    <button className="rounded-2xl bg-[#000d33] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00154d] sm:px-6">
    Sign Up
    </button>
    </Link>
    
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-14 px-6 pb-20 pt-8 sm:px-10 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:px-16 lg:pb-24 lg:pt-10">
          <div>
            <div className="inline-flex rounded-full bg-[#dde7ff] px-4 py-2 text-sm font-medium text-[#28457a]">
              Modern image gallery platform
            </div>

            <h1 className="mt-6 max-w-[700px] text-[52px] font-bold leading-[0.98] tracking-[-0.04em] text-[#0f172f] sm:text-[64px] lg:text-[76px]">
              A clean SaaS-style homepage for your image search app.
            </h1>

            <p className="mt-6 max-w-[620px] text-[19px] leading-8 text-[#64748b] sm:text-[21px]">
              Showcase your platform before login with a polished landing page that highlights
              features, benefits, and a visual product preview. Perfect for demos, presentations,
              and hackathon submissions.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button className="rounded-[24px] bg-[#000d33] px-8 py-4 text-[17px] font-semibold text-white transition hover:bg-[#00154d]">
                Get Started
              </button>
              <button className="rounded-[24px] border border-slate-300 bg-white px-8 py-4 text-[17px] font-semibold text-[#334155] transition hover:bg-slate-100">
                View Demo
              </button>
            </div>

            <div className="mt-12 grid max-w-[620px] grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-[30px] font-bold text-[#0f172f]">200+</p>
                <p className="mt-1 text-sm text-[#64748b]">Curated images</p>
              </div>
              <div className="rounded-[28px] bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-[30px] font-bold text-[#0f172f]">15+</p>
                <p className="mt-1 text-sm text-[#64748b]">Themes and tags</p>
              </div>
              <div className="rounded-[28px] bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-[30px] font-bold text-[#0f172f]">Fast</p>
                <p className="mt-1 text-sm text-[#64748b]">Search experience</p>
              </div>
            </div>
          </div>

          <div id="preview" className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-[760px] rounded-[36px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,47,0.10)] ring-1 ring-slate-200 sm:p-6 lg:p-7">
              <div className="rounded-[30px] border border-slate-200 bg-[#f8fafc] p-4 sm:p-5">
                <input
                  type="text"
                  placeholder="Search landscapes, food, cars, animals..."
                  className="h-[64px] w-full rounded-[22px] border border-slate-200 bg-white px-6 text-[16px] text-slate-700 outline-none placeholder:text-slate-400"
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full bg-[#e2e8f0] px-4 py-2 text-sm text-[#475569]">Nature</span>
                  <span className="rounded-full bg-[#e2e8f0] px-4 py-2 text-sm text-[#475569]">Cars</span>
                  <span className="rounded-full bg-[#e2e8f0] px-4 py-2 text-sm text-[#475569]">Food</span>
                  <span className="rounded-full bg-[#e2e8f0] px-4 py-2 text-sm text-[#475569]">Animals</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                {previewCards.map((card) => (
                  <div key={card.title} className="overflow-hidden rounded-[28px] bg-slate-200 ring-1 ring-slate-200">
                    <div className={`h-[200px] bg-gradient-to-br ${card.gradient}`} />
                    <div className="bg-[#cfd6e2] p-4">
                      <p className="text-base font-semibold text-[#0f172f]">{card.title}</p>
                      <p className="mt-1 text-sm text-[#64748b]">{card.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
          <div className="max-w-[720px]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#64748b]">Features</p>
            <h2 className="mt-3 text-[36px] font-bold tracking-[-0.03em] text-[#0f172f] sm:text-[46px]">
              Everything you need for a polished gallery landing page.
            </h2>
            <p className="mt-4 text-[18px] leading-8 text-[#64748b]">
              Present your app like a real product with clear messaging, organized sections, and
              visual UI previews that communicate value quickly.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-[30px] bg-white p-7 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dde7ff] text-lg font-bold text-[#28457a]">
                  {feature.title.charAt(0)}
                </div>
                <h3 className="mt-5 text-[24px] font-bold text-[#0f172f]">{feature.title}</h3>
                <p className="mt-3 text-[16px] leading-7 text-[#64748b]">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="benefits" className="mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="rounded-[34px] bg-[#000d33] px-8 py-10 text-white sm:px-10 lg:px-12 lg:py-14">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">Benefits</p>
              <h2 className="mt-4 text-[36px] font-bold tracking-[-0.03em] sm:text-[46px]">
                Designed to make your demo feel like a real SaaS product.
              </h2>
              <p className="mt-5 max-w-[620px] text-[18px] leading-8 text-white/75">
                This layout helps your team present the image gallery as a complete platform, not
                just a simple project page. It improves first impression, product clarity, and demo
                confidence.
              </p>
            </div>

            <div className="grid gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="rounded-[28px] bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 h-3 w-3 rounded-full bg-[#28457a]" />
                    <p className="text-[17px] font-medium text-[#334155]">{benefit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 sm:px-10 lg:px-16 lg:pb-24 lg:pt-14">
          <div className="rounded-[36px] bg-white px-8 py-10 shadow-[0_20px_60px_rgba(15,23,47,0.08)] ring-1 ring-slate-200 sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-14">
            <div className="max-w-[720px]">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#64748b]">Call to action</p>
              <h2 className="mt-3 text-[34px] font-bold tracking-[-0.03em] text-[#0f172f] sm:text-[44px]">
                Ready to present your gallery platform with a stronger first impression?
              </h2>
              <p className="mt-4 text-[18px] leading-8 text-[#64748b]">
                Use this landing page as the introduction before login, then connect it to your
                authentication and gallery pages.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row lg:mt-0">
              <button className="rounded-[24px] bg-[#000d33] px-8 py-4 text-[17px] font-semibold text-white transition hover:bg-[#00154d]">
                Start Building
              </button>
              <button className="rounded-[24px] border border-slate-300 bg-[#f8fafc] px-8 py-4 text-[17px] font-semibold text-[#334155] transition hover:bg-slate-100">
                Explore Preview
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
