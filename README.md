# PixelVault — CMPE 280 Hackathon

Midterm · Hackathon · Final Project — Team 2, Group 7

**Members:**

1. Dat Tri Tat
2. Hei Lam
3. Henry Yang
4. Saim Sheikh
5. LuuThuy Luu

---

## Problem & Idea

Managing personal photo libraries is often messy — photos scattered across devices, no easy way to search by content, and no clean interface to browse them. **PixelVault** solves this by providing:

- A themed, searchable gallery organized by categories (Nature, City, Animals, Food)
- Personal user accounts with per-user image uploads
- In-gallery commenting on individual photos
- A clean, responsive UI with full dark mode support

---

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | React                               |
| Routing    | React Router DOM 7                  |
| Build Tool | Vite 7                              |
| Styling    | Tailwind CSS v4                     |
| Icons      | Lucide React                        |
| Storage    | Browser `localStorage` (no backend) |
| Language   | JavaScript (JSX)                    |

---

## Project Structure

```
src/
├── pages/
│   ├── HomePage.jsx        # Landing page — hero, features, preview search
│   ├── AuthPages.jsx       # Login & Sign Up (shared page, mode via URL param)
│   ├── UserHomePage.jsx    # Dashboard — gallery, upload, search, comments
│   └── UserProfile.jsx     # Profile — avatar, change email/password, delete account
├── data/
│   └── galleryData.js      # Theme definitions and sample image metadata
├── ThemeContext.jsx         # Global dark/light theme provider + ThemeToggle button
├── index.css               # Tailwind imports + reusable @layer components
└── App.jsx                 # Route definitions
```

---

## Features

### Authentication

- Sign up with email + password (stored in `localStorage`)
- Login with credential validation
- Session persisted via `currentUser` key in `localStorage`

### Gallery Dashboard

- Browse images organized by theme: **Nature, City, Animals, Food**
- Filter gallery by active theme tab
- **Search** images by title or description (real-time filter)
- **Upload** custom images with title, description, and theme tag
- **Multi-select** images and bulk delete

### Comments

- Add and delete comments on any image
- Comments saved to `localStorage` per image ID

### User Profile

- Upload and save a profile picture
- Change email (migrates uploaded images + profile picture to new email key)
- Change password
- Delete account (type "delete account" to confirm)

### Dark Mode

- Toggle between light and dark theme using the sun/moon button
- Preference saved to `localStorage` and restored on reload
- Navy-blue dark palette (`#1a2035`, `#222b45`, `#2a3655`) across all pages

---

## Workflow

```
[Landing Page]
    │
    ├── Not logged in → [Auth Page] → Login / Sign Up
    │                                      │
    └── Logged in ──────────────────────── ▼
                                    [User Dashboard]
                                           │
                                ┌──────────┴──────────┐
                                │                     │
                          Browse Gallery         Upload Image
                          Search / Filter        (modal form)
                          Add Comments
                          Multi-select Delete
                                │
                           [User Profile]
                          Change Email / Password
                          Update Profile Photo
                          Delete Account
```

---

## How to Run

**1. Install dependencies**

```bash
npm install
```

**2. Start development server**

```bash
npm run dev
```

**3. Open in browser**

```
http://localhost:5173/
```

**4. Build for production**

```bash
npm run build
```

---

## Key Technical Decisions

### No Backend / No Database

All data (users, uploads, comments, profile pictures) is stored in the browser's `localStorage`. This keeps the project self-contained with zero server setup — appropriate for a hackathon demo scope.

### Per-User Data Isolation

Uploaded images and profile pictures are stored under email-scoped keys (e.g., `userGalleryUploadsV1:user@email.com`) so multiple accounts can coexist in the same browser without data conflicts.

### Performance with `useMemo`

Gallery filtering and search are memoized using `useMemo` to avoid unnecessary re-renders when state unrelated to the filter changes.

### Tailwind CSS v4 Class-Based Dark Mode

Tailwind v4 does not use `darkMode: 'class'` in a config file. Instead, dark mode is declared as a CSS variant:

```css
/* index.css */
@variant dark (&:where(.dark, .dark *));
```

The `dark` class is toggled on `<html>` via `ThemeContext.jsx`.

### Reusable CSS Component Classes

Common repeated patterns (modals, cards, buttons, inputs) are extracted into `@layer components` in `index.css` using `@apply`, keeping JSX classNames clean and consistent:

```css
.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4;
}
.section-card {
  @apply rounded-[28px] bg-white dark:bg-[#222b45] p-6 shadow-sm ...;
}
.btn-primary {
  @apply rounded-xl bg-[#000d33] px-5 py-3 text-sm font-semibold text-white ...;
}
```
