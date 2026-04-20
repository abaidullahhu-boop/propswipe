import { useEffect, useMemo, useState } from "react";
import { PropertyForm } from "@/components/PropertyForm";
import { VideoUploadZone } from "@/components/VideoUploadZone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, MapPin, Grid3X3, Check } from "lucide-react";
import { useLocation } from "wouter";
import {
  useCreatePropertyMutation,
  useUploadVideoMutation,
  useGetPlotByIdQuery,
  useGetPlotFinderSocietiesQuery,
  useGetPropertyByIdQuery,
  useUpdatePropertyMutation,
} from "@/store/api/apiSlice";
import { useAuth } from "@/contexts/AuthContext";
import { inferPropertyMediaKeysFromVideoUrl } from "@shared/s3-media-keys";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/utils";

function adminS3MediaSrc(key: string, accessToken: string): string {
  return `/api/admin/s3-media?key=${encodeURIComponent(key)}&access_token=${encodeURIComponent(accessToken)}`;
}

type AdminUploadDraft = {
  updatedAt: number;
  step: number;
  videoUrl: string;
  videoS3Keys: { videoKey: string; thumbnailKey: string } | null;
  videoMeta: {
    thumbnailUrl?: string;
    durationSeconds?: number;
    filesizeBytes?: number;
    width?: number;
    height?: number;
    videoStatus?: string;
  } | null;
  propertyData: any | null;
};

const ADMIN_UPLOAD_DRAFT_KEY = "admin-upload-draft-v1";
const ADMIN_UPLOAD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function AdminUpload() {
  const { token } = useAuth();
  const [editPropertyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("editId");
  });
  const isEditMode = Boolean(editPropertyId);
  const [step, setStep] = useState(1);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoS3Keys, setVideoS3Keys] = useState<{ videoKey: string; thumbnailKey: string } | null>(null);
  const [videoMeta, setVideoMeta] = useState<{
    thumbnailUrl?: string;
    durationSeconds?: number;
    filesizeBytes?: number;
    width?: number;
    height?: number;
    videoStatus?: string;
  } | null>(null);
  const [propertyData, setPropertyData] = useState<any | null>(null);
  const [videoPreviewError, setVideoPreviewError] = useState(false);
  const [useProxyPreview, setUseProxyPreview] = useState(true);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [societyPickerOpen, setSocietyPickerOpen] = useState(false);
  const [societySearch, setSocietySearch] = useState("");
  const [, navigate] = useLocation();
  const [plotIdFromReturn] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("plotId");
  });
  const [createProperty, { isLoading: isCreating }] = useCreatePropertyMutation();
  const [updateProperty, { isLoading: isUpdating }] = useUpdatePropertyMutation();
  const [uploadVideo, { isLoading: isUploading }] = useUploadVideoMutation();
  const { data: propertyToEdit, isFetching: isEditPropertyLoading } = useGetPropertyByIdQuery(editPropertyId ?? "", {
    skip: !editPropertyId,
  });
  const { data: societies = [], isFetching: isSocietiesLoading } = useGetPlotFinderSocietiesQuery({
    search: societySearch || undefined,
  });

  // Restore draft + selected plot when coming back from plot-finder select mode.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const plotId = params.get("plotId");

    const raw = sessionStorage.getItem(ADMIN_UPLOAD_DRAFT_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as AdminUploadDraft;
        if (draft && typeof draft.updatedAt === "number" && Date.now() - draft.updatedAt <= ADMIN_UPLOAD_DRAFT_TTL_MS) {
          setVideoUrl(draft.videoUrl ?? "");
          setVideoS3Keys(draft.videoS3Keys ?? null);
          setVideoMeta(draft.videoMeta ?? null);
          setPropertyData(draft.propertyData ?? null);
          // If user refreshes/back-navigates mid flow, restore their last step.
          // If returning from plot selection, we override to step 2 below.
          if (!plotId && typeof draft.step === "number") setStep(draft.step);
        }
      } catch {
        // Ignore corrupted draft
      }
    }

    if (plotId) {
      setSelectedPlotId(plotId);
      setStep(2);
      // Clean only transient plotId from URL while preserving editId mode.
      const cleanParams = new URLSearchParams();
      if (editPropertyId) cleanParams.set("editId", editPropertyId);
      const cleanQs = cleanParams.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${cleanQs ? `?${cleanQs}` : ""}`);
    }
  }, [editPropertyId]);

  useEffect(() => {
    if (!propertyToEdit || !isEditMode) return;

    setStep(2);
    setVideoUrl((propertyToEdit.videoUrl ?? "").trim());
    setVideoMeta((prev) => ({
      ...(prev ?? {}),
      thumbnailUrl: propertyToEdit.thumbnailUrl ?? undefined,
      videoStatus: propertyToEdit.videoStatus ?? undefined,
      durationSeconds: propertyToEdit.durationSeconds ?? undefined,
      filesizeBytes: propertyToEdit.filesizeBytes ?? undefined,
    }));
    setPropertyData({
      title: propertyToEdit.title ?? "",
      address: propertyToEdit.address ?? "",
      city: propertyToEdit.city ?? "",
      state: propertyToEdit.state ?? "",
      neighborhood: propertyToEdit.neighborhood ?? "",
      latitude:
        propertyToEdit.latitude !== null && propertyToEdit.latitude !== undefined
          ? String(propertyToEdit.latitude)
          : "",
      longitude:
        propertyToEdit.longitude !== null && propertyToEdit.longitude !== undefined
          ? String(propertyToEdit.longitude)
          : "",
      price: propertyToEdit.price !== null && propertyToEdit.price !== undefined ? String(propertyToEdit.price) : "",
      bedrooms: propertyToEdit.bedrooms ?? 1,
      bathrooms:
        propertyToEdit.bathrooms !== null && propertyToEdit.bathrooms !== undefined
          ? String(propertyToEdit.bathrooms)
          : "1",
      squareFeet: propertyToEdit.squareFeet ?? 1000,
      description: propertyToEdit.description ?? "",
      videoUrl: propertyToEdit.videoUrl ?? "",
      thumbnailUrl: propertyToEdit.thumbnailUrl ?? "",
      status: propertyToEdit.status ?? "active",
    });
    // If we just returned from Plot Finder with a new plot selection,
    // keep that selection instead of overriding with the old saved plot.
    if (!plotIdFromReturn) {
      setSelectedPlotId(propertyToEdit.plotId ?? null);
    }
  }, [propertyToEdit, isEditMode, plotIdFromReturn]);

  const { data: selectedPlotData } = useGetPlotByIdQuery(
    { plotId: selectedPlotId as string },
    { skip: !selectedPlotId }
  );

  const effectiveS3Keys = useMemo(
    () => videoS3Keys ?? inferPropertyMediaKeysFromVideoUrl(videoUrl),
    [videoS3Keys, videoUrl],
  );

  const publicVideoSrc = videoUrl.trim();
  const publicPosterSrc = videoMeta?.thumbnailUrl?.trim() || undefined;
  const proxyVideoSrc = useMemo(() => {
    if (!effectiveS3Keys || !token) return "";
    return adminS3MediaSrc(effectiveS3Keys.videoKey, token);
  }, [effectiveS3Keys, token]);

  const proxyPosterSrc = useMemo(() => {
    if (!effectiveS3Keys || !token) return undefined;
    return adminS3MediaSrc(effectiveS3Keys.thumbnailKey, token);
  }, [effectiveS3Keys, token]);

  const previewUsesAdminProxy = Boolean(useProxyPreview && proxyVideoSrc);
  const previewVideoSrc = previewUsesAdminProxy ? proxyVideoSrc : publicVideoSrc;
  const previewPosterSrc = previewUsesAdminProxy ? proxyPosterSrc : publicPosterSrc;

  useEffect(() => {
    setVideoPreviewError(false);
  }, [previewVideoSrc, step]);

  useEffect(() => {
    setUseProxyPreview(true);
  }, [videoUrl, effectiveS3Keys?.videoKey, effectiveS3Keys?.thumbnailKey]);

  const handlePreviewLoadError = () => {
    if (previewUsesAdminProxy && publicVideoSrc) {
      setUseProxyPreview(false);
      return;
    }
    setVideoPreviewError(true);
  };

  const handleSubmitProperty = async () => {
    try {
      if (!propertyData) return;
      const v = videoUrl.trim();
      if (v && !v.startsWith("https://")) {
        toast.error("Video must be uploaded first so we save an https:// URL from S3, not a local path.");
        return;
      }
      const { videoUrl: _ignoreVideo, thumbnailUrl: _ignoreThumb, ...rest } = propertyData;
      const payload = {
        ...rest,
        ...videoMeta,
        videoUrl: v || undefined,
        thumbnailUrl: (videoMeta?.thumbnailUrl ?? "").trim() || (propertyData.thumbnailUrl ?? "").trim() || undefined,
        plotId: selectedPlotId || undefined,
      };

      if (isEditMode && editPropertyId) {
        await updateProperty({ id: editPropertyId, data: payload }).unwrap();
      } else {
        await createProperty(payload).unwrap();
      }
      sessionStorage.removeItem(ADMIN_UPLOAD_DRAFT_KEY);
      navigate("/admin/properties");
      toast.success(isEditMode ? "Property updated" : "Property published");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const handleVideoSelect = async (file: File) => {
    const maxSizeBytes = 200 * 1024 * 1024;
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a valid video file.");
      return;
    }
    if (file.size > maxSizeBytes) {
      toast.error("Video exceeds 200MB limit.");
      return;
    }

    try {
      setVideoUrl("");
      setVideoMeta(null);
      setVideoS3Keys(null);
      const result = await uploadVideo({ file }).unwrap();
      setVideoUrl(result.videoUrl);
      if (result.videoKey && result.thumbnailKey) {
        setVideoS3Keys({ videoKey: result.videoKey, thumbnailKey: result.thumbnailKey });
      } else {
        setVideoS3Keys(null);
      }
      setVideoMeta({
        thumbnailUrl: result.thumbnailUrl,
        durationSeconds: result.durationSeconds,
        filesizeBytes: result.filesizeBytes,
        width: result.width,
        height: result.height,
        videoStatus: result.videoStatus,
      });
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  // Persist the in-progress upload across route changes (ex: going to PlotFinder select mode).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasVideo = videoUrl.trim().length > 0;
    const hasDetails = propertyData != null;

    if (!hasVideo && !hasDetails) {
      sessionStorage.removeItem(ADMIN_UPLOAD_DRAFT_KEY);
      return;
    }

    const draft: AdminUploadDraft = {
      updatedAt: Date.now(),
      step,
      videoUrl,
      videoS3Keys,
      videoMeta,
      propertyData,
    };

    sessionStorage.setItem(ADMIN_UPLOAD_DRAFT_KEY, JSON.stringify(draft));
  }, [step, videoUrl, videoS3Keys, videoMeta, propertyData]);

  const handleStartPlotSelection = (societyId: string) => {
    setSocietyPickerOpen(false);
    const params = new URLSearchParams({
      mode: "select",
      societyId: societyId,
    });
    if (editPropertyId) {
      params.set("editId", editPropertyId);
    }
    navigate(`/plot-finder/v2?${params.toString()}`);
  };

  const stepLabels = ["Video Upload", "Location & Details", "Preview"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2">{isEditMode ? "Edit Property" : "Upload Property"}</h1>
        <p className="text-muted-foreground">
          {isEditMode ? "Update an existing property listing" : "Add a new property listing"}
        </p>
      </div>
      {isEditMode && isEditPropertyLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading property details...</CardContent>
        </Card>
      ) : null}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        {stepLabels.map((label, i) => {
          const num = i + 1;
          return (
            <div key={num} className="flex items-center gap-2">
              {i > 0 && <div className="w-16 h-0.5 bg-border" />}
              <div className={`flex items-center gap-2 ${step >= num ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= num ? "bg-primary text-white" : "bg-muted"}`}>
                  {num}
                </div>
                <span className="font-semibold">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Video Upload */}
      {step === 1 && !isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Property Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <VideoUploadZone onVideoSelect={handleVideoSelect} />
            <p className="text-xs text-muted-foreground">
              Upload MP4 or MOV videos up to 200MB. The file is processed and stored on S3; when you publish, only the
              returned <span className="font-mono">videoUrl</span> / <span className="font-mono">thumbnailUrl</span>{" "}
              (https links) are saved on the property.
            </p>
            {isUploading && (
              <p className="text-sm text-muted-foreground" data-testid="text-uploading">
                Uploading video...
              </p>
            )}
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={isUploading}
                data-testid="button-skip-upload"
              >
                Skip for now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                data-testid="button-upload-continue"
                onClick={() => setStep(2)}
                disabled={!videoUrl || isUploading}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Location + Property Details */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Property details form */}
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <PropertyForm
                    onSubmit={(data) => {
                      setPropertyData(data);
                      setStep(3);
                    }}
                    isSubmitting={false}
                    hideMediaFields
                    hideLocationFields
                    addressFieldExtras={
                      <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium">Property Location</p>
                          <p className="text-xs text-muted-foreground">
                            Attach this listing to a specific plot for better location accuracy.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative rounded-lg border border-dashed bg-background p-4 text-center opacity-50 cursor-not-allowed">
                            <div className="absolute top-2 right-2 bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded">
                              Disabled
                            </div>
                            <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="font-semibold text-sm text-muted-foreground">Mark on Map</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              This option is temporarily disabled
                            </p>
                          </div>

                          {selectedPlotId && selectedPlotData ? (
                            <div className="rounded-lg border border-primary p-4 text-center bg-primary/5">
                              <Check className="w-8 h-8 mx-auto mb-2 text-primary" />
                              <p className="font-semibold text-sm">Plot Selected</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Plot {selectedPlotData.plot.plotNumber} &middot; {selectedPlotData.block.name} &middot; {selectedPlotData.society.name}
                              </p>
                              {selectedPlotData.plot.size && (
                                <p className="text-xs text-muted-foreground">Size: {selectedPlotData.plot.size}</p>
                              )}
                              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSocietyPickerOpen(true)}>
                                Change Plot
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg border border-primary/40 hover:border-primary p-4 text-center transition-colors cursor-pointer bg-background"
                              onClick={() => setSocietyPickerOpen(true)}
                            >
                              <Grid3X3 className="w-8 h-8 mx-auto mb-2 text-primary" />
                              <p className="font-semibold text-sm">Find Plot on Block Image</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Choose society first, then select block and plot
                              </p>
                            </button>
                          )}
                        </div>
                      </div>
                    }
                    defaultValues={{
                      ...(propertyData ?? {}),
                      videoUrl: videoUrl || undefined,
                      thumbnailUrl: videoMeta?.thumbnailUrl ?? (propertyData?.thumbnailUrl ?? ""),
                    }}
                  />
                </div>
                {previewVideoSrc ? (
                  <div className="hidden lg:block sticky top-4">
                    <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden">
                      <video
                        key={`${step}-${previewVideoSrc}`}
                        src={previewVideoSrc}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                        poster={previewPosterSrc}
                        data-testid="video-preview"
                        onLoadedData={() => setVideoPreviewError(false)}
                        onError={handlePreviewLoadError}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  data-testid="button-back-to-upload"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Step 3: Preview & Publish */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview & Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {propertyData && (
              <div className="max-w-md mx-auto space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="text-lg font-semibold leading-tight">{propertyData.title || "Untitled listing"}</p>
                <p className="text-primary font-medium">
                  {propertyData.price != null && propertyData.price !== ""
                    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                        Number(propertyData.price),
                      )
                    : "—"}
                </p>
                <p className="text-muted-foreground">
                  {[propertyData.address, propertyData.city, propertyData.state].filter(Boolean).join(", ") || "—"}
                </p>
                {propertyData.neighborhood ? (
                  <p className="text-muted-foreground">{propertyData.neighborhood}</p>
                ) : null}
                <p className="text-muted-foreground pt-1">
                  {propertyData.bedrooms} bd · {propertyData.bathrooms} ba · {propertyData.squareFeet?.toLocaleString?.() ?? propertyData.squareFeet} sqft
                </p>
                {selectedPlotData && (
                  <p className="text-muted-foreground pt-1">
                    Plot {selectedPlotData.plot.plotNumber} &middot; {selectedPlotData.block.name} &middot; {selectedPlotData.society.name}
                  </p>
                )}
              </div>
            )}
            {previewVideoSrc ? (
              <div className="aspect-[9/16] max-w-md mx-auto bg-black rounded-lg overflow-hidden relative">
                <video
                  key={`${step}-${previewVideoSrc}`}
                  src={previewVideoSrc}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  poster={previewPosterSrc}
                  data-testid="video-final-preview"
                  onLoadedData={() => setVideoPreviewError(false)}
                  onCanPlay={() => setVideoPreviewError(false)}
                  onError={handlePreviewLoadError}
                />
                {videoPreviewError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-4 text-center text-sm text-white">
                    <p>Could not load the video in the browser.</p>
                    {previewUsesAdminProxy ? (
                      <p className="text-white/80">
                        The app is loading this through <code className="text-xs">/api/admin/s3-media</code> using
                        your IAM user. Check the server terminal for <code className="text-xs">[S3 media] AccessDenied</code>.
                      </p>
                    ) : (
                      <>
                        <p className="text-white/80">
                          Check that the file is publicly readable (S3 bucket policy or CloudFront).
                        </p>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 underline break-all"
                        >
                          {videoUrl}
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-md mx-auto rounded-lg bg-muted/40 border p-8 text-center text-sm text-muted-foreground">
                No video uploaded (skipped)
              </div>
            )}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                data-testid="button-back-to-details"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmitProperty}
                disabled={isCreating || isUpdating}
                data-testid="button-publish"
              >
                {isEditMode ? (isUpdating ? "Updating..." : "Update Property") : isCreating ? "Publishing..." : "Publish Property"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={societyPickerOpen} onOpenChange={setSocietyPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Society for Plot Finder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search society..."
              value={societySearch}
              onChange={(e) => setSocietySearch(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto space-y-2">
              {isSocietiesLoading ? (
                <p className="text-sm text-muted-foreground">Loading societies...</p>
              ) : societies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No societies found.</p>
              ) : (
                societies.map((society) => (
                  <Button
                    key={society.id}
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleStartPlotSelection(society.id)}
                  >
                    {society.name} {society.city ? `(${society.city})` : ""}
                  </Button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
