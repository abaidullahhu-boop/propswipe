import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, WifiOff, Download, MapPin, Bed, Bath, Square, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatPricePKR } from "@/lib/utils";
import { getDownloadedIds, getRecentlyViewed } from "@/lib/offline";

export default function Offline() {
  const [, navigate] = useLocation();
  const [onlyDownloaded, setOnlyDownloaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const downloadedIds = useMemo(() => getDownloadedIds(), [refreshKey]);
  const recentlyViewed = useMemo(() => getRecentlyViewed(), [refreshKey]);

  const items = useMemo(() => {
    const list = recentlyViewed;
    if (!onlyDownloaded) return list;
    return list.filter((p) => downloadedIds.has(p.id));
  }, [recentlyViewed, onlyDownloaded, downloadedIds]);

  useEffect(() => {
    const onStorage = () => setRefreshKey((v) => v + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <WifiOff className="w-5 h-5" />
              Offline View
            </h1>
            <p className="text-white/60 text-sm">{items.length} properties</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOnlyDownloaded((v) => !v)}
            className="text-white hover:bg-white/10"
          >
            <Download className="w-5 h-5 mr-2" />
            {onlyDownloaded ? "All Recent" : "Downloaded Only"}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/60">No properties available offline yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((property) => (
              <div
                key={property.id}
                className="bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="relative aspect-video bg-gray-800">
                  {property.thumbnailUrl ? (
                    <img
                      src={property.thumbnailUrl}
                      className="w-full h-full object-cover"
                      alt={property.title ?? "Property"}
                    />
                  ) : (
                    <video
                      src={property.videoUrl}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <span className="text-2xl font-bold text-white">
                      {formatPricePKR(property.price)}
                    </span>
                  </div>
                </div>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

