import { useState, useEffect } from "react";
import { ArrowLeft, Heart, MapPin, Bed, Bath, Square, X, Search, Filter, Eye, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Property, SavedProperty } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetSavedPropertiesQuery,
  useGetPropertiesQuery,
  useUnsavePropertyMutation,
} from "@/store/api/apiSlice";
import toast from "react-hot-toast";
import { getApiErrorMessage, formatPricePKR } from "@/lib/utils";

export default function SavedProperties() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price-high" | "price-low">("newest");

  // Fetch saved properties for this user
  const { data: savedProperties = [], isLoading: savedPropertiesLoading, error: savedPropertiesError } = useGetSavedPropertiesQuery(
    { userId: (user?.id as string) },
    { skip: !user?.id }
  );

  // Fetch all properties to map IDs to full records
  const { data: allProperties = [] } = useGetPropertiesQuery(undefined, { skip: !user?.id });

  // Create a map of property IDs to properties for quick lookup
  const propertyMap = new Map(allProperties.map(prop => [prop.id, prop]));

  // Filter and sort saved properties
  const filteredAndSortedProperties = savedProperties
    .map(savedProp => propertyMap.get(savedProp.propertyId))
    .filter((property): property is Property => property !== undefined)
    .filter(property => {
      const searchLower = (searchTerm ?? "").toLowerCase();
      return searchTerm === "" || 
        (property.title ?? "").toLowerCase().includes(searchLower) ||
        (property.city ?? "").toLowerCase().includes(searchLower) ||
        (property.state ?? "").toLowerCase().includes(searchLower) ||
        (property.address ?? "").toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "price-high":
          return (parseFloat(String(b.price ?? 0)) || 0) - (parseFloat(String(a.price ?? 0)) || 0);
        case "price-low":
          return (parseFloat(String(a.price ?? 0)) || 0) - (parseFloat(String(b.price ?? 0)) || 0);
        default:
          return 0;
      }
    });

  // Unsave property mutation
  const [unsavePropertyMutation, { isLoading: isUnsaveLoading }] = useUnsavePropertyMutation();

  const handleUnsaveProperty = async (propertyId: string) => {
    if (!user?.id) return;
    try {
      await unsavePropertyMutation({ propertyId, userId: user.id }).unwrap();
      toast.success("Removed from saved");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };


  const goBack = () => {
    window.history.back();
  };

  const handleShare = async () => {
    if (!user?.id) return;
    const url = `${window.location.origin}/shared/${user.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Saved Properties", url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (savedPropertiesLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading your saved properties...</p>
          <p className="text-white/60 text-sm mt-2">User ID: {user?.id || 'Not found'}</p>
        </div>
      </div>
    );
  }

  if (savedPropertiesError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Error loading saved properties</p>
          <p className="text-white/60 text-sm">Something went wrong. Please try again.</p>
          <p className="text-white/60 text-sm mt-2">User ID: {user?.id || 'Not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
        <div>
          <h1 className="text-2xl font-bold">Saved Properties</h1>
          <p className="text-white/60 text-sm">
            {filteredAndSortedProperties.length} {filteredAndSortedProperties.length !== 1 ? 'properties' : 'property'} saved
          </p>
          <p className="text-white/40 text-xs mt-1">
            Raw saved properties: {savedProperties.length} | All properties: {allProperties.length}
          </p>
        </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-white hover:bg-white/10"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
            <Input
              placeholder="Search saved properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white focus:border-white/40 focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {filteredAndSortedProperties.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? "No properties found" : "No saved properties yet"}
            </h3>
            <p className="text-white/60 mb-6">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Start saving properties you like to see them here"
              }
            </p>
            {!searchTerm && (
              <div className="space-y-4">
                <Button
                  onClick={goBack}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Browse Properties
                </Button>
                <div className="text-center">
                  <p className="text-white/60 text-sm mb-2">Debug Info:</p>
                  <p className="text-white/40 text-xs">User ID: {user?.id}</p>
                  <p className="text-white/40 text-xs">Saved Properties Count: {savedProperties.length}</p>
                  <p className="text-white/40 text-xs">All Properties Count: {allProperties.length}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProperties.map((property) => (
              <div
                key={property.id}
                className="bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-all duration-300 group"
              >
                {/* Video Thumbnail */}
                <div className="relative aspect-video bg-gray-800">
                  <video
                    src={property.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Unsave Button */}
                  <button
                    onClick={() => handleUnsaveProperty(property.id)}
                    disabled={isUnsaveLoading}
                    className="absolute top-3 right-3 w-10 h-10 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 disabled:opacity-50"
                  >
                    {isUnsaveLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <X className="w-5 h-5 text-white" />
                    )}
                  </button>

                  {/* Price Overlay */}
                  <div className="absolute bottom-3 left-3">
                    <span className="text-2xl font-bold text-white">
                      {formatPricePKR(property.price)}
                    </span>
                  </div>
                </div>

                {/* Property Details */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {property.title}
                  </h3>
                  
                  <div className="flex items-center text-white/60 text-sm mb-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span className="line-clamp-1">
                      {property.city ?? ""}, {property.state ?? ""}
                    </span>
                  </div>

                  {property.address && (
                    <p className="text-white/50 text-sm mb-3 line-clamp-1">
                      {property.address}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-white/60 text-sm">
                    <div className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      <span>{property.bedrooms ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      <span>{property.bathrooms ?? "0"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Square className="w-4 h-4" />
                      <span>{(property.squareFeet ?? 0).toLocaleString()} sqft</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{(property.views ?? 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {property.description && (
                    <p className="text-white/70 text-sm mt-3 line-clamp-2">
                      {property.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
