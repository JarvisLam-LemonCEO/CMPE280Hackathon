# PixelVault — CMPE 280 Hackathon & Final Project

Midterm · Hackathon · Final Project — Team 2, Group 7

## Team Members

1. Dat Tri Tat  
2. Hei Lam  
3. Henry Yang  
4. Saim Sheikh  
5. Thuy Luu  

---

# Live Demo

### Deployment
https://cmpe-280-hackathon-lake.vercel.app/

---

# Project Overview

Managing personal media libraries has become increasingly difficult due to scattered photos across devices, poor organization systems, limited search functionality, and traditional gallery applications that focus only on storage instead of user interaction.

**PixelVault** is an AI-enhanced intelligent media management platform designed to modernize the way users upload, organize, edit, and interact with personal photos and videos. The project combines scalable frontend engineering, responsive UI/UX design, cloud-based media infrastructure, and AI-assisted workflows into a professional Single Page Application (SPA).

The platform transforms traditional gallery systems into a more interactive and personalized digital media experience.

---

# Core Features

## Authentication & User Management

- Firebase Authentication integration
- Secure email/password sign up and login
- Persistent authenticated sessions
- Protected user routes
- Profile management system
- Upload and update profile picture
- Secure logout workflow

---

## Intelligent Gallery Dashboard

- Cloud-based media upload system
- Responsive gallery grid layout
- Real-time search and filtering workflows
- Category-based organization
- Personalized media collections
- Interactive hover states and gallery animations
- Multi-select image management workflows

---

## Album Management

- Create and manage custom albums
- Add/remove images from albums
- Drag-and-drop photo rearrangement
- Real-time visual reordering feedback
- Dynamic album organization system
- Personalized gallery management experience

---

## AI-Powered Photo Retouching

- AI image transformation workflows
- Preview-before-apply editing pipeline
- Multiple AI enhancement styles
- Modal-based AI editing experience
- One-click apply workflow
- Real-time AI interaction feedback
- Non-destructive editing workflow

---

## Social & Interactive Features

- Add comments on images and videos
- Interactive user engagement system
- Like and interaction workflows
- Shareable media experience
- Dynamic gallery interactions

---

## Responsive UI/UX Design

- Fully responsive desktop/mobile layouts
- Dark mode and light mode support
- Modern SaaS-inspired interface design
- Interactive transitions and hover animations
- Modal-based streamlined workflows
- Accessibility-aware visual hierarchy
- Consistent typography and spacing system

---

# Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React |
| Build Tool | Vite 7 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Authentication | Firebase Authentication |
| Database | Firestore |
| Cloud Media Storage | Cloudinary |
| AI Integration | Hugging Face Inference API |
| Deployment | Vercel |
| Language | JavaScript (JSX) |

---

# System Architecture

```text
User Browser
      ↓
React + Vite SPA
      ↓
React Router DOM
      ↓
Firebase Authentication
      ↓
Firestore Database
      ↓
Cloudinary Media Storage
      ↓
AI Image Transformation Layer
(Hugging Face API)
```

---

# Project Structure

```text
src/
├── components/
│   ├── common/
│   ├── gallery/
│   ├── modals/
│   └── ui/
│
├── pages/
│   ├── HomePage.jsx
│   ├── AuthPages.jsx
│   ├── UserHomePage.jsx
│   ├── UserProfile.jsx
│   ├── AlbumPage.jsx
│   └── SharedGallery.jsx
│
├── data/
│   └── galleryData.js
│
├── lib/
│   ├── firebase.js
│   ├── cloudinary.js
│   ├── aiTransform.js
│   └── AuthContext.jsx
│
├── hooks/
│   ├── useGalleryFilter.js
│   ├── useTheme.js
│   └── useDragAndDrop.js
│
├── ThemeContext.jsx
├── App.jsx
└── index.css
```

---

# Workflow

## User Workflow

1. User creates account or logs in  
2. User uploads photos/videos to cloud storage  
3. Media is stored and synchronized through Firestore  
4. User organizes content into albums  
5. Drag-and-drop rearrangement updates album ordering  
6. AI retouch workflow generates previews and applies transformations  
7. Users interact through comments, likes, and sharing workflows  

---

# Key Technical Decisions

## Modular SPA Architecture

The application was designed using a scalable Single Page Application architecture with reusable React components and modular routing workflows to improve maintainability and frontend scalability.

---

## Cloud-Based Media Infrastructure

Instead of storing media locally, Cloudinary was integrated to provide scalable media storage, optimized image delivery, and cloud-based upload handling.

---

## Firebase Authentication & Firestore

Firebase Authentication and Firestore were selected to simplify backend infrastructure while supporting real-time synchronization and secure authenticated user workflows.

---

## AI Workflow Integration

AI photo retouching workflows were integrated directly into the gallery experience using preview-based interaction design. Users can generate AI-enhanced previews before applying modifications to uploaded media.

---

## Drag-and-Drop Interaction Design

Interactive drag-and-drop album rearrangement was implemented to create a more intuitive and user-friendly gallery organization experience with real-time visual feedback.

---

## Tailwind CSS v4 Design System

Tailwind CSS v4 was used to create a consistent modern UI system with reusable utility classes, responsive layouts, and scalable dark/light theme support.

---

# How to Run

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Configure Environment Variables

Create a `.env` file:

```bash
VITE_FIREBASE_API_KEY=YOUR_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
VITE_HUGGINGFACE_API_KEY=YOUR_API_KEY
```

---

## 3. Start Development Server

```bash
npm run dev
```

---

## 4. Open in Browser

```text
http://localhost:5173/
```

---

## 5. Build for Production

```bash
npm run build
```

---

# Future Improvements

- AI auto-tagging and semantic image search
- Collaborative shared albums
- Advanced video editing workflows
- Real-time multi-user interaction
- AI-generated captions and recommendations
- Media compression optimization
- Progressive Web App (PWA) support

---

# Project Goals Achieved

- Professional SPA frontend architecture
- Responsive UI/UX engineering
- AI-enhanced user interaction workflows
- Cloud-based scalable media infrastructure
- Interactive drag-and-drop gallery management
- Modern frontend engineering practices
- Real-world deployment and production hosting

