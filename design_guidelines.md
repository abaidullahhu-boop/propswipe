# PropSwipe Design Guidelines

## Design Approach: Reference-Based (Social Video + Real Estate)

**Primary References**: TikTok/Instagram Reels (video interaction), Zillow/Realtor.com (property presentation), Tinder (swipe mechanics)

**Core Principle**: Immersive, distraction-free property browsing with intuitive gestures and bold property information overlays.

---

## Color Palette

### Primary Colors (Dark Mode - Primary Experience)
- **Background**: 0 0% 0% (True black for OLED optimization)
- **Surface**: 240 6% 10% (Dark gray for cards/overlays)
- **Primary Brand**: 340 80% 55% (Vibrant coral-red for heart/save actions)
- **Accent**: 200 95% 50% (Electric blue for interactive elements)

### Light Mode (Admin Dashboard)
- **Background**: 0 0% 98%
- **Surface**: 0 0% 100%
- **Text Primary**: 240 10% 15%

### Semantic Colors
- **Success**: 142 76% 45% (Green for confirmations)
- **Destructive**: 0 72% 51% (Red for dislike swipe)
- **Warning**: 38 92% 50% (Amber for admin alerts)

---

## Typography

**Font Families** (via Google Fonts CDN):
- **Display**: "Inter" (700-900 weight) - Property prices, hero text
- **Body**: "Inter" (400-600 weight) - Locations, descriptions, UI labels
- **Monospace**: "JetBrains Mono" - Admin tables, property IDs

**Hierarchy**:
- Property Price: text-5xl md:text-6xl font-black (900 weight)
- Location/Area: text-xl md:text-2xl font-semibold
- Details/Specs: text-base font-medium
- Body Text: text-sm font-normal
- Buttons/CTA: text-base font-semibold tracking-wide uppercase

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 8, 12, 16** (p-2, h-8, m-4, gap-12, py-16)

**Mobile-First Breakpoints**:
- Base: Full-screen vertical (100vh sections)
- md: 768px+ (admin dashboard optimized)
- lg: 1024px+ (desktop admin with sidebars)

**Grid System**:
- Property Feed: Single column, full viewport
- Admin Dashboard: 12-column responsive grid
- Admin Property Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

---

## Component Library

### A. Video Player Components

**Full-Screen Video Card**:
- Aspect ratio: Full viewport (100vh × 100vw)
- Video element: object-cover with absolute positioning
- Gradient overlays: Top (black 0% to transparent 20%), Bottom (transparent 60% to black 100%)
- Muted autoplay with tap-to-unmute icon (top-right)

**Property Info Overlay** (Bottom of screen):
- Semi-transparent dark background (bg-black/60 backdrop-blur-md)
- Padding: p-8 pb-12 (extra bottom padding for safe area)
- Layout: Vertical stack with gap-4
- Price: Leading element, text-5xl font-black text-white
- Location: Secondary, text-xl font-semibold text-white/90
- Quick specs: Horizontal flex row with icons (beds, baths, sqft) text-sm text-white/70

**Action Buttons** (Right side, vertical stack):
- Heart (Save): Large circular button, 64×64px, bg-white/20 backdrop-blur, heart icon fills with primary color when saved
- Share: Secondary button below heart, 56×56px
- More Info: Tertiary button, 56×56px
- Position: absolute right-4 bottom-32, gap-4

### B. Navigation & Gestures

**Swipe Indicators**:
- Up Arrow: Subtle indicator at top-center (opacity-40, animate pulse)
- Down Arrow: Bottom-center below property info
- Dislike Overlay: Full-screen red tint (bg-destructive/30) appears during left swipe with "Not Interested" text

**Progress Indicator** (Top of screen):
- Thin horizontal bar showing position in feed
- Width: w-full h-1
- Color: bg-accent with rounded-full

### C. Authentication Screens

**Sign-In Screen**:
- Background: Looping property video montage with dark overlay (bg-black/70)
- Logo: Centered, 80×80px with "PropSwipe" wordmark below
- Social buttons: Full-width, rounded-2xl, with provider logos (Google icon + text)
- Email button: Secondary style below social
- Layout: Centered card max-w-md with p-8, bg-surface/95 backdrop-blur-xl

**Loading Screen**:
- Animated PropSwipe logo pulsing
- Background: Gradient from primary to accent (animate-gradient)
- Loading text: "Finding your next property..." with animated dots

### D. Admin Dashboard Components

**Sidebar Navigation**:
- Width: 280px fixed on desktop, collapsible drawer on mobile
- Background: bg-surface border-r border-white/10
- Navigation items: Vertical list with icons (Heroicons), hover:bg-white/5 transition
- Sections: Dashboard, Properties, Upload, Analytics, Settings

**Property Management Table**:
- Full-width responsive table with alternating row colors
- Columns: Thumbnail (120×80px), Address, Price, Status (badge), Views, Actions
- Row hover: bg-white/5 cursor-pointer
- Action buttons: Icon-only (Edit, Delete) with tooltips

**Upload Form**:
- Multi-step wizard: 1) Video Upload, 2) Property Details, 3) Preview
- Video dropzone: Large dashed border area with drag-and-drop, max-w-2xl
- Form fields: Two-column grid on desktop, single column on mobile
- Video preview: Sticky panel on right side (desktop) showing uploaded video

**Property Card** (Grid view):
- Aspect ratio: 16:9 video thumbnail
- Rounded-xl overflow-hidden shadow-lg
- Info overlay on hover: Slide up animation revealing full details
- Status badge: Absolute top-right (Active/Draft/Archived)

### E. Form Elements

**Input Fields** (Consistent dark mode):
- Background: bg-white/5 border border-white/10
- Focus state: border-accent ring-2 ring-accent/20
- Text: text-white placeholder:text-white/40
- Rounded: rounded-lg
- Padding: px-4 py-3

**Buttons**:
- Primary: bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20
- Secondary: bg-white/10 text-white hover:bg-white/20 border border-white/20
- Destructive: bg-destructive text-white hover:bg-destructive/90
- All buttons: rounded-xl px-8 py-3 font-semibold transition-all

---

## Key Screens

### 1. Property Feed (Main Experience)
- Full-screen vertical video player (100vh)
- Minimal chrome: Only video, property overlay, and action buttons visible
- Swipe gestures: Up/down for navigation, left for dislike, tap heart to save
- Auto-advance to next property after 30s if no interaction

### 2. Admin Dashboard Home
- Overview cards: Total properties, total views, saved count, active listings (grid-cols-2 lg:grid-cols-4)
- Recent activity feed below cards
- Quick actions: "Upload New Property" primary CTA button

### 3. Admin Property List
- Toggle view: Grid cards or table layout (switch in top-right)
- Filters: Status dropdown, price range slider, location search
- Bulk actions: Select multiple for batch operations

### 4. Video Upload Flow
- Step 1: Drag-drop video upload with progress bar, file size limit display (200MB max)
- Step 2: Form with fields - Address, City, State, Price, Beds, Baths, SqFt, Description
- Step 3: Preview screen mimicking property feed view with "Publish" button

---

## Animation Strategy

**Minimal, Purposeful Animations**:
- Card swipe: Spring physics (framer-motion) with rotation and scale
- Heart save: Scale bounce animation (scale-110 then back)
- Video transitions: Crossfade between properties (300ms)
- Admin interactions: Subtle hover lifts (translateY -2px)

**Loading States**:
- Video buffering: Spinner overlay with percentage
- Skeleton screens for admin tables (pulse animation)

---

## Images & Media

**No hero images needed** - App is video-first. All visual content comes from property videos uploaded to Supabase Storage.

**Video Requirements**:
- Format: MP4, H.264 codec
- Vertical orientation: 9:16 aspect ratio (1080×1920px)
- Thumbnails: Auto-generated from first frame for admin views
- Lazy loading: Videos load only when in viewport, preload next 2 videos