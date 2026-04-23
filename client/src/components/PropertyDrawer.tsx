import { useState, useEffect, useMemo } from "react";
import { X, Heart, Share2, MapPin, Bed, Bath, Square, Calendar, Eye, DollarSign, Home, Ruler, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePropertyViews } from "@/hooks/use-property-views";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateLeadMutation, useCreatePropertyReportMutation, useGetPropertiesQuery } from "@/store/api/apiSlice";
import { formatPricePKR } from "@/lib/utils";
import type { Property } from "@shared/schema";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/utils";
import { cacheMedia, getDownloadedIds, setDownloadedId } from "@/lib/offline";
import { useLocation } from "wouter";

interface PropertyDrawerProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (propertyId: string) => void;
  isSaved?: boolean;
  isSaving?: boolean;
  onDismissArea?: (property: Property) => void;
}

export function PropertyDrawer({
  property,
  isOpen,
  onClose,
  onSave,
  isSaved = false,
  isSaving = false,
  onDismissArea,
}: PropertyDrawerProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set());
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [contactMethod, setContactMethod] = useState("email");
  const [isDownloaded, setIsDownloaded] = useState(false);
  const { trackView } = usePropertyViews();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [createLead, { isLoading: isCreatingLead }] = useCreateLeadMutation();
  const [createReport] = useCreatePropertyReportMutation();
  const { data: allProperties = [] } = useGetPropertiesQuery();

  const similarProperties = useMemo(() => {
    if (!property) return [];
    const price = parseFloat(String(property.price ?? 0)) || 0;
    return allProperties
      .filter((p) => p.id !== property.id && p.city === property.city)
      .filter((p) => {
        const pPrice = parseFloat(String(p.price ?? 0)) || 0;
        if (!price || !pPrice) return true;
        return pPrice >= price * 0.8 && pPrice <= price * 1.2;
      })
      .slice(0, 3);
  }, [allProperties, property]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLeadName((prev) => prev || user?.name || "");
    setLeadEmail((prev) => prev || user?.email || "");
  }, [isOpen, user?.name, user?.email]);

  useEffect(() => {
    if (!property) return;
    const downloaded = getDownloadedIds().has(property.id);
    setIsDownloaded(downloaded);
  }, [property?.id]);

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

  // Track view when drawer is opened
  useEffect(() => {
    if (isOpen && property && user?.id && !trackedViews.has(property.id)) {
      // Track view immediately when drawer opens
      trackView(property.id);
      
      // Update localStorage
      const newTracked = new Set(trackedViews).add(property.id);
      setTrackedViews(newTracked);
      localStorage.setItem(`trackedViews_${user.id}`, JSON.stringify(Array.from(newTracked)));
    }
  }, [isOpen, property, trackView, user?.id, trackedViews]);

  if (!property || !isOpen) return null;

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
        controls: "1",
        loop: "1",
        playlist: id,
        playsinline: "1",
        modestbranding: "1",
        rel: "0",
      });
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    } catch {
      return "";
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleToggleDownload = async () => {
    if (!property) return;
    if (isYouTubeUrl(property.videoUrl)) {
      toast.error("YouTube videos can't be downloaded for offline");
      return;
    }
    const next = !isDownloaded;
    setIsDownloaded(next);
    setDownloadedId(property.id, next);
    if (next) {
      try {
        await cacheMedia([property.videoUrl ?? "", property.thumbnailUrl ?? ""]);
        toast.success("Saved for offline");
      } catch {
        toast.error("Offline save failed");
      }
    } else {
      toast.success("Removed from offline");
    }
  };

  const handleSubmitLead = async () => {
    if (!property) return;
    if (!leadName.trim() || (!leadEmail.trim() && !leadPhone.trim())) {
      toast.error("Name and either email or phone are required");
      return;
    }
    try {
      await createLead({
        propertyId: property.id,
        userId: user?.id,
        name: leadName.trim(),
        email: leadEmail.trim() || undefined,
        phone: leadPhone.trim() || undefined,
        message: leadMessage.trim() || undefined,
        preferredDate: preferredDate.trim() || undefined,
        preferredTime: preferredTime.trim() || undefined,
        contactMethod,
      }).unwrap();
      toast.success("Request sent");
      setLeadMessage("");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const handleReport = async () => {
    if (!property) return;
    const reason = window.prompt("Why are you reporting this listing?");
    if (!reason) return;
    try {
      await createReport({ propertyId: property.id, reason }).unwrap();
      toast.success("Report submitted");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
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
        // fallback to clipboard
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={onClose} />
      
      <div
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-slate-950 text-slate-100 transform transition-transform duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-slate-100">Property Details</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Video Section */}
            <div className="relative aspect-video bg-slate-900">
              {isYouTubeUrl(property.videoUrl) ? (
                <iframe
                  title="property-video-detail"
                  src={getYouTubeEmbedUrl(property.videoUrl)}
                  className="w-full h-full object-cover"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  key={property.videoUrl}
                  src={property.videoUrl?.trim() || undefined}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  muted={false}
                  loop
                  playsInline
                  preload="metadata"
                />
              )}
            </div>

            {/* Property Info */}
            <div className="p-6 space-y-6">
              {/* Price and Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold text-slate-100">
                    {formatPricePKR(property.price)}
                  </h1>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {property.status}
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold text-slate-200">
                  {property.title}
                </h2>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-100">
                    {property.city}, {property.state}
                  </p>
                  {property.address && (
                    <p className="text-slate-300 text-sm">{property.address}</p>
                  )}
                </div>
              </div>

              {/* Property Stats */}
              <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/10">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-slate-300 mb-1">
                    <Bed className="w-4 h-4" />
                    <span className="text-sm">Bedrooms</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-100">{property.bedrooms}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-slate-300 mb-1">
                    <Bath className="w-4 h-4" />
                    <span className="text-sm">Bathrooms</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-100">{property.bathrooms}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-slate-300 mb-1">
                    <Square className="w-4 h-4" />
                    <span className="text-sm">Sq Ft</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-100">
                    {property.squareFeet.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Description */}
              {property.description && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-3">Description</h3>
                  <p className="text-slate-200 leading-relaxed">
                    {property.description}
                  </p>
                </div>
              )}

              {/* Contact / Schedule */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-3">Contact Agent</h3>
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Your name"
                    className="bg-slate-900 border-white/10 text-slate-100 placeholder:text-slate-400"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Email"
                      className="bg-slate-900 border-white/10 text-slate-100 placeholder:text-slate-400"
                    />
                    <Input
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="Phone"
                      className="bg-slate-900 border-white/10 text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      placeholder="Preferred date"
                      className="bg-slate-900 border-white/10 text-slate-100"
                    />
                    <Input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      placeholder="Preferred time"
                      className="bg-slate-900 border-white/10 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-300">Preferred contact</label>
                    <select
                      value={contactMethod}
                      onChange={(e) => setContactMethod(e.target.value)}
                      className="w-full h-9 rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-slate-100"
                    >
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <Textarea
                    value={leadMessage}
                    onChange={(e) => setLeadMessage(e.target.value)}
                    placeholder="Preferred time / questions"
                    rows={3}
                    className="bg-slate-900 border-white/10 text-slate-100 placeholder:text-slate-400"
                  />
                  <Button onClick={handleSubmitLead} disabled={isCreatingLead}>
                    {isCreatingLead ? "Sending..." : "Schedule a Visit"}
                  </Button>
                </div>
              </div>

              {/* Property Details */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-3">Property Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-300">Price per sq ft</p>
                      <p className="font-medium text-slate-100">
                        ${(parseFloat(property.price) / property.squareFeet).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-300">Views</p>
                      <p className="font-medium text-slate-100">{property.views}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-300">Listed</p>
                      <p className="font-medium text-slate-100">
                        {formatDate(property.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-300">Type</p>
                      <p className="font-medium text-slate-100">Residential</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Similar Listings */}
              {similarProperties.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-3">Similar Listings</h3>
                  <div className="space-y-2">
                    {similarProperties.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-slate-100">{item.title}</p>
                          <p className="text-slate-300">{item.city}, {item.state}</p>
                        </div>
                        <div className="text-slate-100 font-semibold">{formatPricePKR(item.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thumbnail */}
              {property.thumbnailUrl && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-3">Thumbnail</h3>
                  <img
                    src={property.thumbnailUrl}
                    alt="Property thumbnail"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/10 bg-slate-900/70">
            <div className="flex gap-3 overflow-x-auto">
              {onSave && (
                <Button
                  onClick={() => onSave(property.id)}
                  disabled={isSaving}
                  className={`flex-1 ${
                    isSaved
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-gray-900 hover:bg-gray-800 text-white"
                  }`}
                >
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isSaved ? "Unsaving..." : "Saving..."}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
                      {isSaved ? "Unsave Property" : "Save Property"}
                    </div>
                  )}
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              {property.plotId && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/plot-finder/v2?plotId=${encodeURIComponent(property.plotId ?? "")}`)}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Open Plot Finder
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={handleToggleDownload}>
                <Download className="w-4 h-4 mr-2" />
                {isDownloaded ? "Saved Offline" : "Download"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleReport}>
                Report
              </Button>
              {onDismissArea && (
                <Button variant="outline" className="flex-1" onClick={() => onDismissArea(property)}>
                  Hide Area
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
