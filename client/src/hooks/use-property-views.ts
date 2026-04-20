import { useTrackPropertyViewMutation } from "@/store/api/apiSlice";
import { useAuth } from "@/contexts/AuthContext";

export function usePropertyViews() {
  const [trackPropertyView, { isLoading }] = useTrackPropertyViewMutation();
  const { user } = useAuth();

  const trackView = (propertyId: string) => {
    if (!user?.id) return;
    
    trackPropertyView({ propertyId, userId: user.id }).unwrap().catch((error) => {
      console.error("Failed to track property view:", error);
    });
  };

  return {
    trackView,
    isTracking: isLoading,
  };
}
