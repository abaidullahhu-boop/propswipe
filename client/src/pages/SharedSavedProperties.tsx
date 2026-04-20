import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Heart, MapPin, Bed, Bath, Square, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetPublicSavedPropertiesQuery, useGetPropertiesQuery } from "@/store/api/apiSlice";
import { formatPricePKR } from "@/lib/utils";

export default function SharedSavedProperties() {
  const [match, params] = useRoute("/shared/:userId");
  const [, navigate] = useLocation();
  const userId = match ? params?.userId : undefined;

  const { data: savedProperties = [], isLoading: savedLoading } = useGetPublicSavedPropertiesQuery(
    { userId: userId as string },
    { skip: !userId }
  );
  const { data: allProperties = [], isLoading: propertiesLoading } = useGetPropertiesQuery();

  const propertyMap = new Map(allProperties.map((prop) => [prop.id, prop]));
  const savedList = savedProperties
    .map((saved) => propertyMap.get(saved.propertyId))
    .filter((property): property is NonNullable<typeof property> => Boolean(property));

  if (!match) return null;

  if (savedLoading || propertiesLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">Loading shared list...</div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold">Shared Saved Properties</h1>
            <p className="text-white/60 text-sm">{savedList.length} properties</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {savedList.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No saved properties</h3>
            <p className="text-white/60">This list is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedList.map((property) => (
              <div
                key={property.id}
                className="bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="relative aspect-video bg-gray-800">
                  <video
                    src={property.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                  />
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

