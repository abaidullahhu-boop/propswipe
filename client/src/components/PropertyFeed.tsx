import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Heart, LogOut, User, WifiOff, ArrowDown, ArrowUp, MoreVertical, LayoutDashboard } from "lucide-react";
import { PropertyCard } from "./PropertyCard";
import { PropertyDrawer } from "./PropertyDrawer";
import type { Property } from "@shared/schema";
import { throttle } from "@/lib/utils";
import { cacheMedia } from "@/lib/offline";
import { useNetwork } from "@/hooks/use-network";
import { formatPricePKR } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PropertyFeedProps {
  properties: Property[];
  savedPropertyIds: Set<string>;
  onSaveProperty: (propertyId: string) => void;
  onDislikeProperty: (propertyId: string) => void;
  isSaving?: boolean;
  isDisliking?: boolean;
  onShowPropertyDetails?: (property: Property) => void;
  onLogout?: () => void;
  userName?: string;
  keyboardEnabled?: boolean; // enable/disable keyboard navigation
  canInteract?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  onDismissArea?: (property: Property) => void;
  lowDataMode?: boolean;
  isAdmin?: boolean;
}

export function PropertyFeed({
  properties,
  savedPropertyIds,
  onSaveProperty,
  onDislikeProperty,
  isSaving = false,
  isDisliking = false,
  onShowPropertyDetails,
  onLogout,
  userName,
  keyboardEnabled = true,
  canInteract = true,
  onDrawerOpenChange,
  onDismissArea,
  lowDataMode = false,
  isAdmin = false,
}: PropertyFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [, setLocation] = useLocation();
  // Mobile View Dot
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isOnline } = useNetwork();
  // Persist and restore current index
  useEffect(() => {
    const saved = sessionStorage.getItem('feed_index');
    if (saved) {
      const idx = parseInt(saved, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < properties.length) {
        setCurrentIndex(idx);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sessionStorage.setItem('feed_index', String(currentIndex));
  }, [currentIndex]);

  // Fix Hide From Feed

  useEffect(() => {
    if (currentIndex >= properties.length) {
      setCurrentIndex(Math.max(0, properties.length - 1));
    }
  }, [currentIndex, properties.length]);

  useEffect(() => {
    const seen = localStorage.getItem("psr_seen_onboarding");
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);


  // Clear auto-advance timer
  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // Start auto-advance timer
  const startAutoAdvance = useCallback(() => {
    clearAutoAdvance();
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (currentIndex < properties.length - 1) {
        goToNext();
      }
    }, 30000);
  }, [currentIndex, properties.length, clearAutoAdvance]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex < properties.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(currentIndex + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, properties.length, isTransitioning]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(currentIndex - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, isTransitioning]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!keyboardEnabled) return;

      const target = e.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;

      // Ignore when typing in inputs/textareas/contenteditable or inside dialogs
      const isTypingContext = (el?: HTMLElement | null) =>
        !!el && (
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable ||
          el.closest('input, textarea, [contenteditable="true"], [role="dialog"], .dialog-content') !== null
        );

      if (isTypingContext(target) || isTypingContext(active)) return;

      if (e.code === "ArrowDown" || e.code === "Space") {
        e.preventDefault();
        goToNext();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        goToPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [goToNext, goToPrevious, keyboardEnabled]);

  // Touch/wheel navigation
  const handleWheel = useCallback((e: WheelEvent) => {
    if (isDrawerOpen) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      goToNext();
    } else if (e.deltaY < 0) {
      goToPrevious();
    }
  }, [goToNext, goToPrevious]);

  // Touch navigation
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isDrawerOpen) return;
    const touch = e.touches[0];
    const startY = touch.clientY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0];
      const deltaY = startY - currentTouch.clientY;

      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          goToNext();
        } else {
          goToPrevious();
        }
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  }, [goToNext, goToPrevious, isDrawerOpen]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      container.addEventListener("touchstart", handleTouchStart, { passive: true });

      return () => {
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("touchstart", handleTouchStart);
      };
    }
  }, [handleWheel, handleTouchStart]);

  // Auto-advance management
  useEffect(() => {
    if (isDrawerOpen) {
      clearAutoAdvance();
      return;
    }
    startAutoAdvance();
    return clearAutoAdvance;
  }, [currentIndex, startAutoAdvance, clearAutoAdvance, isDrawerOpen]);

  // Pause auto-advance while offline; on reconnect, refetch if requested
  useEffect(() => {
    if (!isOnline) {
      clearAutoAdvance();
    } else {
      startAutoAdvance();
    }
  }, [isOnline, clearAutoAdvance, startAutoAdvance]);

  useEffect(() => {
    if (lowDataMode || !isOnline) return;
    const upcoming = properties.slice(currentIndex + 1, currentIndex + 3);
    const urls = upcoming.flatMap((p) => [p.videoUrl ?? "", p.thumbnailUrl ?? ""]).filter(Boolean);
    if (urls.length) {
      cacheMedia(urls).catch(() => {
        // ignore prefetch errors
      });
    }
  }, [currentIndex, properties, lowDataMode, isOnline]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const throttledDislike = useMemo(() => throttle((id: string) => onDislikeProperty(id), 250), [onDislikeProperty]);
  const throttledSave = useMemo(() => throttle((id: string) => onSaveProperty(id), 250), [onSaveProperty]);

  const handleSwipeLeft = () => {
    if (!canInteract) return;
    throttledDislike(properties[currentIndex].id);
    goToNext();
  };

  const handleSwipeUp = () => {
    goToPrevious();
  };

  const handleSwipeDown = () => {
    goToNext();
  };

  const handleSave = () => {
    if (!canInteract) return;
    throttledSave(properties[currentIndex].id);
  };

  const handleShowDetails = () => {
    const property = properties[currentIndex];
    setSelectedProperty(property);
    setIsDrawerOpen(true);
    onDrawerOpenChange?.(true);
    if (onShowPropertyDetails) {
      onShowPropertyDetails(property);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedProperty(null);
    onDrawerOpenChange?.(false);
  };

  // Let other pages/components (e.g. Home header Plot Finder button)
  // open Plot Finder already focused on the currently visible property.
  const currentProperty = properties[currentIndex];
  useEffect(() => {
    const plotId = currentProperty?.plotId;
    if (plotId) {
      sessionStorage.setItem("feed_current_plot_id", plotId);
      window.dispatchEvent(new CustomEvent("feed-current-plot-changed", { detail: { plotId } }));
    } else {
      sessionStorage.removeItem("feed_current_plot_id");
      window.dispatchEvent(new CustomEvent("feed-current-plot-changed", { detail: { plotId: null } }));
    }
  }, [currentProperty?.id, currentProperty?.plotId]);

  if (properties.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white mb-4">No Properties Available</h2>
          <p className="text-white/70">Check back soon for new listings!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="flex h-svh w-full bg-black overflow-hidden"
        data-testid="property-feed"
      >
        {showOnboarding && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
            <div className="mx-4 max-w-md rounded-2xl bg-black/90 border border-white/10 p-6 text-white text-center space-y-4">
              <h3 className="text-2xl font-black">Quick Tips</h3>
              <div className="space-y-2 text-sm text-white/80">
                <p>Swipe or scroll down to see the next property.</p>
                <p>Double tap the video to save a property you like.</p>
                <p>Tap the info button to view full details.</p>
                <p>Use ↑/↓ or Space to navigate with your keyboard.</p>
              </div>
              <button
                className="mt-2 w-full rounded-full bg-white text-black py-2 font-semibold hover:bg-white/90"
                onClick={() => {
                  localStorage.setItem("psr_seen_onboarding", "1");
                  setShowOnboarding(false);
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
        {!isOnline && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <div className="bg-black/70 text-white px-4 py-3 rounded-full text-sm">
              You are offline. Browsing paused until connection is restored.
            </div>
          </div>
        )}
        {/* Progress Indicators */}
        {/* <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
        {properties.map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "bg-white"
                : index < currentIndex
                ? "bg-white/60"
                : "bg-white/20"
            }`}
          />
        ))}

      </div> */}

        {/* LEFT SIDE (optional spacing or actions) */}
        <div className="hidden md:flex flex-col p-4 lg:w-full w-max h-full">
          {canInteract && (
            <button
              onClick={() => setLocation("/saved")}
              className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 hidden lg:flex items-center gap-2 text-white"
              aria-label="Open your liked properties"
            >
              <Heart className="w-5 h-5 fill-red-500 text-red-500" />
              <span className="text-sm font-medium">Your Likes ({savedPropertyIds.size})</span>
            </button>
          )}

          <div className="flex flex-col justify-between h-full">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setLocation("/offline")}
                className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 hidden lg:flex items-center gap-2 text-white"
              >
                <WifiOff className="w-5 h-5" />
                <span className="text-sm font-medium">Offline</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setLocation("/admin")}
                  className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 hidden lg:flex items-center gap-2 text-white"
                  aria-label="Open admin dashboard"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="text-sm font-medium">Admin</span>
                </button>
              )}
            </div>
            {/* PROPERTY INFO OVERLAY  FOR XL*/}
            <div className="hidden xl:block bg-black/60 backdrop-blur-md rounded-2xl p-5 text-white space-y-3">

              <h2 className="text-2xl font-bold">
                {formatPricePKR(currentProperty?.price)}
              </h2>

              <p className="text-white/80">
                {currentProperty?.city}, {currentProperty?.state}
              </p>

              <div className="text-sm text-white/60 w-max">
                {currentProperty?.bedrooms} beds •{" "}
                {currentProperty?.bathrooms} baths •{" "}
                {currentProperty?.squareFeet.toLocaleString()} sqft
              </div>

              <div className="text-sm text-white/50">
                {currentProperty?.views.toLocaleString()} views
              </div>

            </div>
          </div>
        </div>

        {/* CENTER (Main Property Card) */}
        <div className="flex flex-col items-center justify-start w-full h-screen">

          {/* Current card */}
          <div
            className={`flex w-full  md:w-[500px] h-full ${currentIndex < properties.length - 1 ? "md:h-[90vh]" : "md:h-full"} z-10 transition-transform duration-300 ${isTransitioning ? "scale-95 opacity-90" : "scale-100 opacity-100"
              }`}
          >
            <PropertyCard
              property={currentProperty}
              onSwipeLeft={handleSwipeLeft}
              onSwipeUp={handleSwipeUp}
              onSwipeDown={handleSwipeDown}
              onSave={handleSave}
              isSaved={savedPropertyIds.has(currentProperty?.id)}
              isSaving={isSaving}
              isDisliking={isDisliking}
              onShowDetails={handleShowDetails}
              interactionsEnabled={canInteract}
              lowDataMode={lowDataMode}
            />
          </div>

          {/* Next Card */}
          {properties[currentIndex + 1] && (
            <div className="w-[500px] hidden md:flex  mt-3 flex-shrink-0 pointer-events-none isolate [&>*]:overflow-hidden h-[8vh]">
              {properties[currentIndex + 1] && (
                <div className="w-[500px]  flex-shrink-0 overflow-hidden h-[8vh] rounded-t-xl opacity-60">
                  <div className="origin-top">
                    <img
                      src={properties[currentIndex + 1]?.thumbnailUrl ?? "https://via.placeholder.com/400x300?text=No+Image"}
                      className="w-full h-full object-cover rounded-t-2xl"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <PropertyDrawer
          property={selectedProperty}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onSave={onSaveProperty}
          isSaved={selectedProperty ? savedPropertyIds.has(selectedProperty.id) : false}
          isSaving={isSaving}
          onDismissArea={onDismissArea}
        />

        {/* RIGHT SIDE (Navigation + User) */}
        <div className="md:flex flex-col h-full lg:w-full w-max items-end p-4 hidden">
          {/* User Section */}
          <div className="lg:flex hidden items-center gap-2">
            {canInteract && userName && (
              isAdmin ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setLocation("/admin")}
                      className="bg-black/50 backdrop-blur-md rounded-full px-3 py-2 flex items-center gap-2 text-white hover:bg-black/60 transition-colors"
                      aria-label="Go to dashboard"
                    >
                      <User className="w-4 h-4" />
                      <span className="text-sm font-medium w-max">{userName}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Go to dashboard</TooltipContent>
                </Tooltip>
              ) : (
                <div className="bg-black/50 backdrop-blur-md rounded-full px-3 py-2 flex items-center gap-2 text-white">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium w-max">{userName}</span>
                </div>
              )
            )}

            {canInteract && onLogout ? (
              <button
                onClick={onLogout}
                className="bg-black/50 backdrop-blur-md rounded-full p-2 text-white hover:bg-red-500/80"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setLocation("/login")}
                className="bg-white text-black rounded-full px-4 py-2"
              >
                Login
              </button>
            )}
          </div>

          {/* Up / Down Navigation */}
          <div className="md:flex flex-col h-full justify-center items-center gap-3 hidden">
            {currentIndex > 0 && (
              <button
                onClick={goToPrevious}
                className="bg-white/20 w-12 h-12 flex items-center justify-center rounded-full border border-white/20"
              >
                <ArrowUp className="w-5 h-5 text-white" />
              </button>
            )}

            {currentIndex < properties.length - 1 && (
              <button
                onClick={goToNext}
                className="bg-white/20 w-12 h-12 flex items-center justify-center rounded-full border border-white/20"
              >
                <ArrowDown className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Mobile 3-dot Menu */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close mobile menu"
          className="absolute inset-0 z-20 lg:hidden bg-transparent"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="absolute top-4 right-3 z-30 lg:hidden">
        <div className="relative" ref={mobileMenuRef}>
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="bg-white/20 backdrop-blur-xl text-white border border-white/20 p-2.5 rounded-full "
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {mobileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-black/90 backdrop-blur-md rounded-xl p-3 space-y-3 text-white shadow-lg">

              {/* Your Likes */}
              {canInteract && (
                <button
                  onClick={() => {
                    setLocation("/saved");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <Heart className="w-4 h-4 text-red-500" />
                  Your Likes ({savedPropertyIds.size})
                </button>
              )}

              {/* Offline */}
              <button
                onClick={() => {
                  setLocation("/offline");
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full text-left"
              >
                <WifiOff className="w-4 h-4" />
                Offline
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setLocation("/admin");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Admin
                </button>
              )}

              {/* User */}
              {canInteract && userName && (
                <div className="flex items-center gap-2 text-sm text-white/70 border-t border-white/10 pt-2">
                  <User className="w-4 h-4" />
                  {userName}
                </div>
              )}

              {/* Logout / Login */}
              {canInteract && onLogout ? (
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLocation("/login");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-white text-black rounded-full py-1 mt-2"
                >
                  Login
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
