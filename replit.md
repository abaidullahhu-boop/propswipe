# PropSwipe - Property Discovery App

## Overview
PropSwipe is a mobile-first property video swipe app inspired by TikTok/Instagram Reels with YouTube Shorts-style navigation. Users can discover properties through an immersive full-screen video experience with intuitive swipe gestures.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js, Drizzle ORM
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage (for video uploads)
- **Authentication**: Email and Google OAuth via Supabase

## Features

### User Features
- **Authentication**: Google OAuth and Email sign-in
- **Property Feed**: Full-screen vertical video cards
- **Swipe Gestures**:
  - Up/Down: Navigate between properties
  - Left: Dislike property
  - Tap Heart: Save property
- **Property Information**: Price, location, bedrooms, bathrooms, square footage
- **Video Controls**: Mute/unmute, auto-advance after 30s
- **Loading Screen**: Branded loading experience

### Admin Features
- **Dashboard**: Overview stats (total properties, views, saved count, active listings)
- **Property Management**: CRUD operations with table and grid views
- **Video Upload Wizard**: 3-step process (Upload → Details → Preview)
- **Property Form**: Complete property details with validation
- **Analytics & Settings**: Placeholder pages for future features

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx           # Authentication UI
│   │   ├── LoadingScreen.tsx        # App loading state
│   │   ├── PropertyCard.tsx         # Full-screen swipeable property card
│   │   ├── PropertyFeed.tsx         # Property feed container
│   │   ├── AdminSidebar.tsx         # Admin navigation sidebar
│   │   ├── PropertyTable.tsx        # Admin property table
│   │   ├── PropertyForm.tsx         # Property CRUD form
│   │   └── VideoUploadZone.tsx      # Drag-drop video upload
│   ├── pages/
│   │   ├── Home.tsx                 # Main property feed page
│   │   ├── AdminLayout.tsx          # Admin layout wrapper
│   │   ├── AdminDashboard.tsx       # Admin overview
│   │   ├── AdminProperties.tsx      # Property management
│   │   └── AdminUpload.tsx          # Video upload wizard
│   └── App.tsx                      # Main app router
server/
├── routes.ts                        # API endpoints
└── storage.ts                       # Data access layer
shared/
└── schema.ts                        # Database schema & types
```

## Database Schema

### Users
- id (UUID, primary key)
- email (text, unique)
- name (text)
- role (text, default: "user")
- createdAt (timestamp)

### Properties
- id (UUID, primary key)
- title (text)
- address (text)
- city (text)
- state (text)
- price (decimal)
- bedrooms (integer)
- bathrooms (decimal)
- squareFeet (integer)
- description (text)
- videoUrl (text)
- thumbnailUrl (text, optional)
- status (text: active/draft/archived)
- views (integer, default: 0)
- createdAt (timestamp)

### SavedProperties
- id (UUID, primary key)
- userId (UUID, foreign key)
- propertyId (UUID, foreign key)
- savedAt (timestamp)

### PropertyDislikes
- id (UUID, primary key)
- userId (UUID, foreign key)
- propertyId (UUID, foreign key)
- dislikedAt (timestamp)

## Design System

### Colors
- **Primary**: Vibrant coral-red (340 80% 55%)
- **Accent**: Electric blue (200 95% 50%)
- **Background**: True black (0 0% 0%) for OLED optimization
- **Surface**: Dark gray (240 6% 10%)

### Typography
- **Font**: Inter (400-900 weights)
- **Monospace**: JetBrains Mono
- Price: text-5xl font-black
- Location: text-xl font-semibold
- Details: text-base font-medium

### Animations
- Heart bounce on save
- Swipe gestures with spring physics
- Gradient loading screen
- Pulse indicators for swipe directions

## API Endpoints

### Properties
- `GET /api/properties` - Get all properties
- `GET /api/properties/:id` - Get single property
- `POST /api/properties` - Create property
- `PATCH /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Saved Properties
- `GET /api/saved-properties` - Get all saved properties
- `GET /api/saved-properties?userId=:id` - Get user's saved properties
- `POST /api/saved-properties` - Save a property
- `DELETE /api/saved-properties/:propertyId` - Unsave a property

### Property Dislikes
- `POST /api/property-dislikes` - Record property dislike

## Environment Variables
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `SESSION_SECRET` - Express session secret

## Current Implementation Status
- ✅ Schema and data models defined
- ✅ Complete frontend components built
- ✅ Authentication screens
- ✅ Property feed with swipe gestures
- ✅ Admin dashboard with sidebar navigation
- ✅ Property management (CRUD)
- ✅ Video upload wizard
- ✅ Backend API implementation (complete)
- ✅ Supabase PostgreSQL integration (complete)
- ✅ Database tables created with sample data
- ✅ All API endpoints functional

## Development Notes
- Mobile-first design with full-screen viewport optimization
- Uses in-memory storage currently (will be replaced with Supabase)
- Framer Motion for smooth swipe animations
- Shadcn UI components for admin dashboard
- React Query for data fetching and caching

## User Flow
1. User lands on auth screen
2. Sign in with Google or Email
3. View property feed with full-screen videos
4. Swipe up/down to navigate, left to dislike, tap heart to save
5. Admin users access `/admin` for management features
6. Upload videos, add property details, publish listings
