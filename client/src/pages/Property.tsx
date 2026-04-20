import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyDrawer } from "@/components/PropertyDrawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetPropertyByIdQuery,
  useGetSavedPropertiesQuery,
  useSavePropertyMutation,
  useUnsavePropertyMutation,
} from "@/store/api/apiSlice";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/utils";

export default function PropertyPage() {
  const [match, params] = useRoute("/property/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const propertyId = match ? params?.id : undefined;
  const { data: property, isLoading, error } = useGetPropertyByIdQuery(propertyId!, {
    skip: !propertyId,
  });

  const { data: savedProperties = [] } = useGetSavedPropertiesQuery(
    { userId: (user?.id as string) },
    { skip: !user?.id }
  );

  const savedPropertyIds = new Set(savedProperties.map((sp) => sp.propertyId));
  const [optimisticSavedIds, setOptimisticSavedIds] = useState<Set<string>>(savedPropertyIds);
  const [saveProperty] = useSavePropertyMutation();
  const [unsaveProperty] = useUnsavePropertyMutation();

  useEffect(() => {
    setOptimisticSavedIds(new Set(savedPropertyIds));
  }, [savedProperties]);

  const handleSave = async () => {
    if (!property?.id) return;
    if (!user?.id) {
      navigate("/login");
      return;
    }
    try {
      const wasSaved = optimisticSavedIds.has(property.id);
      const next = new Set(optimisticSavedIds);
      if (wasSaved) {
        next.delete(property.id);
        setOptimisticSavedIds(next);
        toast.success("Removed from saved");
        unsaveProperty({ propertyId: property.id, userId: user.id }).unwrap().catch((e) => {
          setOptimisticSavedIds(new Set(savedPropertyIds));
          toast.error(getApiErrorMessage(e));
        });
      } else {
        next.add(property.id);
        setOptimisticSavedIds(next);
        toast.success("Saved property");
        saveProperty({ propertyId: property.id, userId: user.id }).unwrap().catch((e) => {
          setOptimisticSavedIds(new Set(savedPropertyIds));
          toast.error(getApiErrorMessage(e));
        });
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  if (!match) return null;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-black">Property not found</h2>
          <Button onClick={() => navigate("/")} className="bg-white text-black hover:bg-white/90">
            Back to feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>
      </div>

      <div className="fixed inset-0 bg-black">
        <div className="h-full max-w-md  mx-auto">
          <PropertyCard
            property={property}
            onSwipeLeft={() => {}}
            onSwipeUp={() => {}}
            onSwipeDown={() => {}}
            onSave={handleSave}
            isSaved={optimisticSavedIds.has(property.id)}
            onShowDetails={() => setIsDrawerOpen(true)}
            interactionsEnabled={!!user?.id}
          />
        </div>
      </div>

      <PropertyDrawer
        property={property}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={() => handleSave()}
        isSaved={optimisticSavedIds.has(property.id)}
      />
    </div>
  );
}

