import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Heart, Share2, Info, Volume2, VolumeX, ChevronUp, ChevronDown, Play, Pause, X, Bookmark, MoreHorizontal, Eye, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePropertyViews } from "@/hooks/use-property-views";
import { useRecordWatchEventMutation } from "@/store/api/apiSlice";
import { useAuth } from "@/contexts/AuthContext";
import { formatPricePKR } from "@/lib/utils";
import type { Property } from "@shared/schema";
import toast from "react-hot-toast";
import { addRecentlyViewed } from "@/lib/offline";
import { HeartIcon, UnmuteIcon, MuteIcon, ShareIcon, InfoIconMobile } from "@/components/icons/Icons";

interface PropertyCardProps {
  property: Property;
  onSwipeLeft: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  onSave: () => void;
  isSaved: boolean;
  isSaving?: boolean;
  isDisliking?: boolean;
  onShowDetails?: () => void;
  interactionsEnabled?: boolean;
  lowDataMode?: boolean;
}

export function PropertyCard({
  property,
  onSwipeLeft,
  onSwipeUp,
  onSwipeDown,
  onSave,
  isSaved,
  isSaving = false,
  isDisliking = false,
  onShowDetails,
  interactionsEnabled = true,
  lowDataMode = false,
}: PropertyCardProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showDoubleTapLike, setShowDoubleTapLike] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchStartRef = useRef<number | null>(null);
  const watchedSecondsRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);
  const { trackView } = usePropertyViews();
  const [recordWatchEvent] = useRecordWatchEventMutation();
  const { user } = useAuth();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 0.8, 1, 0.8, 0.5]);

  // Detect YouTube URLs (watch or shorts) and build an embeddable URL
  const isYouTubeUrl = (url: string | null | undefined) => {
    if (!url) return false;
    try {
      const u = new URL(url);
      return u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be");
    } catch {
      return false;
    }
  };

  const getYouTubeEmbedUrl = (url: string | null | undefined) => {
    if (!url) return "";
    try {
      const u = new URL(url);
      let id = "";
      if (u.hostname === "youtu.be") {
        id = u.pathname.slice(1);
      } else if (u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/")[2] || "";
      } else if (u.pathname === "/watch") {
        id = u.searchParams.get("v") || "";
      } else if (u.pathname.startsWith("/embed/")) {
        id = u.pathname.split("/")[2] || "";
      }
      if (!id) return "";
      const params = new URLSearchParams({
        autoplay: "1",
        mute: "0",
        controls: "0",
        loop: "1",
        playlist: id, // needed for loop
        playsinline: "1",
        modestbranding: "1",
        rel: "0",
      });
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    } catch {
      return "";
    }
  };

  const updateProgress = useCallback(() => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      if (!d || !Number.isFinite(d)) return;
      const progress = (videoRef.current.currentTime / d) * 100;
      setVideoProgress(progress);
    }
  }, []);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {
          // Autoplay blocked, user interaction required
        });
      }
    }
  };

  // Double tap to like functionality
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < 300) { // 300ms double tap threshold
      e.preventDefault();
      e.stopPropagation();

      // Trigger like animation
      if (interactionsEnabled) {
        setShowDoubleTapLike(true);
        setTimeout(() => setShowDoubleTapLike(false), 1000);
        // Save the property
        onSave();
      }
    } else {
      // Single tap - toggle play/pause
      togglePlayPause();
    }

    lastTapRef.current = now;
  };

  useEffect(() => {
    setVideoLoadError(false);
    setVideoProgress(0);
    if (isYouTubeUrl(property?.videoUrl)) {
      return undefined;
    }

    const el = videoRef.current;
    if (!el) {
      return undefined;
    }

    const propertyId = property?.id;
    const onPlay = () => {
      setIsPlaying(true);
      if (watchStartRef.current === null) {
        watchStartRef.current = Date.now();
      }
      progressIntervalRef.current = setInterval(updateProgress, 100);
    };
    const onPause = () => {
      setIsPlaying(false);
      if (watchStartRef.current !== null) {
        watchedSecondsRef.current += (Date.now() - watchStartRef.current) / 1000;
        watchStartRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      if (watchStartRef.current !== null) {
        watchedSecondsRef.current += (Date.now() - watchStartRef.current) / 1000;
        watchStartRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    void el
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setIsPlaying(false);
      });

    return () => {
      if (watchStartRef.current !== null) {
        watchedSecondsRef.current += (Date.now() - watchStartRef.current) / 1000;
        watchStartRef.current = null;
      }
      if (watchedSecondsRef.current > 0 && propertyId) {
        const dur = Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : undefined;
        recordWatchEvent({
          propertyId,
          watchedSeconds: Math.round(watchedSecondsRef.current),
          durationSeconds: dur,
        }).catch(() => {});
        watchedSecondsRef.current = 0;
      }
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      try {
        el.pause();
      } catch {
        // ignore
      }
    };
  }, [property?.id, property?.videoUrl, lowDataMode, recordWatchEvent, updateProgress]);

  // Load tracked views from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`trackedViews_${user.id}`);
      if (stored) {
        try {
          setTrackedViews(new Set(JSON.parse(stored)));
        } catch (e) {
          console.error("Failed to parse tracked views:", e);
        }
      }
    }
  }, [user?.id]);

  // Track view when property is displayed
  useEffect(() => {
    if (!hasTrackedView && user?.id && !trackedViews.has(property?.id)) {
      // Track view after a short delay to ensure user is actually viewing
      const timer = setTimeout(() => {
        trackView(property?.id);
        addRecentlyViewed(property);
        setHasTrackedView(true);

        // Update localStorage
        const newTracked = new Set(trackedViews).add(property?.id);
        setTrackedViews(newTracked);
        localStorage.setItem(`trackedViews_${user.id}`, JSON.stringify(Array.from(newTracked)));
      }, 2000); // Track view after 2 seconds of display

      return () => clearTimeout(timer);
    }
  }, [property?.id, hasTrackedView, trackView, user?.id, trackedViews]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;

    if (info.offset.y < -threshold) {
      onSwipeUp();
    } else if (info.offset.y > threshold) {
      onSwipeDown();
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/share/${property.id}`;
    const shareData = {
      title: property.title || "Property",
      text: `${property.city ?? ""} ${property.state ?? ""}`.trim(),
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };


  return (
    <>
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x, y, rotate, opacity }}
        className="relative w-full h-full cursor-grab active:cursor-grabbing md:pt-3"
        data-testid={`property-card-${property?.id}`}
      >

        {/*  VIDEO WRAPPER  */}
        <div className="relative w-full h-full md:rounded-2xl overflow-hidden">

          {/* Video Background */}
          {isYouTubeUrl(property?.videoUrl) ? (
            <iframe
              title="property-video"
              src={getYouTubeEmbedUrl(property?.videoUrl)}
              className="w-full h-full object-cover md:rounded-t-2xl"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              key={`${property?.id}-${property?.videoUrl ?? ""}`}
              ref={videoRef}
              data-testid="video-player"
              src={property?.videoUrl?.trim() || undefined}
              className="w-full h-full object-cover md:rounded-t-2xl"
              loop
              autoPlay
              muted={isMuted}
              preload={lowDataMode ? "metadata" : "auto"}
              poster={property.thumbnailUrl?.trim() || undefined}
              playsInline
              onClick={handleDoubleTap}
              onTouchEnd={handleDoubleTap}
              onError={() => setVideoLoadError(true)}
            />
          )}

          {videoLoadError && !isYouTubeUrl(property?.videoUrl) && (
            <div className="absolute inset-0 z-[35] flex flex-col items-center justify-center gap-2 bg-black/85 px-4 text-center text-xs text-white">
              <p>Video did not load in the browser.</p>
              <p className="text-white/70">
                Open the URL in a new tab, and ensure your S3 bucket has a CORS rule allowing GET/HEAD (needed for
                playback on some browsers).
              </p>
              {property?.videoUrl ? (
                <a
                  href={property.videoUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-300 underline break-all max-w-full"
                >
                  {property.videoUrl.trim()}
                </a>
              ) : null}
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none z-10" />

          {/* Video Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-50">
            <div
              className="h-full bg-white"
              style={{ width: `${videoProgress}%` }}
            />
          </div>
        </div>


        {/*  DOUBLE TAP LIKE */}
        {showDoubleTapLike && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="animate-heart-bounce">
              <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-2xl" />
            </div>
          </div>
        )}

        {/* PLAY / PAUSE OVERLAY */}
        {!isYouTubeUrl(property?.videoUrl) && (
          <button
            data-testid="button-play-pause"
            onClick={togglePlayPause}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200"
          >
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white ml-1" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </div>
          </button>
        )}

        {/* Action Button */}
        <div className="absolute right-3 md:-right-16 bottom-2 md:flex flex-col items-center gap-4 z-40 hidden">

          {/* Save */}
          <button
            data-testid="button-save"
            onClick={() => interactionsEnabled && onSave()}
            disabled={isSaving || !interactionsEnabled}
            className={`w-12 h-12 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center transition-all duration-300 ${isSaved
              ? "bg-red-500/90 shadow-lg shadow-red-500/30 animate-heart-bounce"
              : "bg-white/20 hover:bg-white/30"
              } ${isSaving || !interactionsEnabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSaving ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Heart
                className={`w-6 h-6 ${isSaved ? "text-white fill-white scale-110" : "text-white"
                  }`}
              />
            )}
          </button>

          {/* Dislike */}
          <button
            data-testid="button-dislike"
            onClick={() => interactionsEnabled && onSwipeLeft()}
            disabled={isDisliking || !interactionsEnabled}
            className={`w-12 h-12 bg-white/20 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center hover:bg-red-500/20 ${isDisliking || !interactionsEnabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
          >
            {isDisliking ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <X className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Mute */}
          {!isYouTubeUrl(property?.videoUrl) && (
            <button
              data-testid="button-mute-toggle"
              onClick={() => setIsMuted(!isMuted)}
              className="w-12 h-12 border border-white/20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              {isMuted ? (
                <Volume2 className="w-6 h-6 text-white" />
              ) : (
                <VolumeX className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* Share */}
          <button
            data-testid="button-share"
            onClick={handleShare}
            className="w-12 h-12 border border-white/20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
          >
            <Share2 className="w-6 h-6 text-white" />
          </button>

          {/* Info */}
          {onShowDetails && (
            <button
              onClick={onShowDetails}
              className="w-12 h-12 border border-white/20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <Info className="w-6 h-6 text-white" />
            </button>
          )}

        </div>
        {/* Action Button Mobile View*/}
        <div className="absolute md:hidden right-3 md:-right-14 bottom-44 flex flex-col items-center gap-4 z-50">

          {/* Save */}
          <button
            data-testid="button-save"
            onClick={() => interactionsEnabled && onSave()}
            disabled={isSaving || !interactionsEnabled}

          >
            {isSaving ? (
              <div className="border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <HeartIcon
                className={`${isSaved ? "text-red-500 fill-red-500 scale-110" : "text-white"
                  }`}
              />
            )}
          </button>

          {/* Dislike */}
          <button
            data-testid="button-dislike"
            onClick={() => interactionsEnabled && onSwipeLeft()}
            disabled={isDisliking || !interactionsEnabled}
          >
            {isDisliking ? (
              <div className="border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <X className="text-white" />
            )}
          </button>

          {/* Mute */}
          {!isYouTubeUrl(property?.videoUrl) && (
            <button
              data-testid="button-mute-toggle"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <MuteIcon className="text-white" />
              ) : (
                <UnmuteIcon className="text-white" />
              )}
            </button>
          )}

          {/* Share */}
          <button
            data-testid="button-share"
            onClick={handleShare}
          >
            <ShareIcon className="text-white" />
          </button>

          {/* Info */}
          {onShowDetails && (
            <button
              onClick={onShowDetails}
            >
              <InfoIconMobile className="text-white" />
            </button>
          )}

        </div>


      </motion.div>

      {/* PROPERTY INFO OVERLAY  */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-5 z-20 xl:hidden">
        <div className="flex flex-col gap-1.5">

          <h2
            className="lg:text-4xl text-2xl !mt-0 font-black text-white"
            data-testid="text-price"
          >
            {formatPricePKR(property?.price)}
          </h2>

          <p
            className="text-lg lg:text-xl font-semibold text-white/90"
            data-testid="text-location"
          >
            {property?.city}, {property?.state}
          </p>

          <div className="flex items-center gap-4 text-sm text-white/70">
            <span data-testid="text-bedrooms">
              {property?.bedrooms} beds
            </span>
            <span>•</span>
            <span data-testid="text-bathrooms">
              {property?.bathrooms} baths
            </span>
            <span>•</span>
            <span data-testid="text-sqft">
              {property?.squareFeet.toLocaleString()} sqft
            </span>
          </div>

          <div className="flex items-center gap-1 text-white/60 text-sm">
            <Eye className="w-4 h-4" />
            <span data-testid="text-views">
              {property?.views.toLocaleString()} views
            </span>
          </div>

        </div>
      </div>
    </>

  );
}
