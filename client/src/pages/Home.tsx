import React, { useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Check, FilterIcon, MapPinHouse, Save, X } from "lucide-react";
import { PropertyFeed } from "@/components/PropertyFeed";
import {
  useGetPropertiesQuery,
  useGetSavedPropertiesQuery,
  useSavePropertyMutation,
  useUnsavePropertyMutation,
  useDislikePropertyMutation,
  useGetSavedFiltersQuery,
  useCreateSavedFilterMutation,
  useGetDismissedAreasQuery,
  useAddDismissedAreaMutation,
} from "@/store/api/apiSlice";
import type { Property, SavedProperty } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Home() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const canInteract = !!user?.id;
  const [, navigate] = useLocation();
  const FILTER_STORAGE_KEY = "psr_filters_v2";
  const SORT_STORAGE_KEY = "psr_feed_sort_v1";
  const PRESET_STORAGE_KEY = "psr_filter_presets_v1";
  const LOW_DATA_STORAGE_KEY = "psr_low_data_v1";
  const DISMISSED_AREAS_STORAGE_KEY = "psr_dismissed_areas_v1";
  const PRICE_MIN_DEFAULT = 0;
  const PRICE_MAX_DEFAULT = 20000000;
  const FEED_SORT_OPTIONS = ["recommended", "newest", "oldest", "price-high", "price-low"] as const;
  // Applied filters
  const [searchTerm, setSearchTerm] = React.useState("");
  const [cityFilter, setCityFilter] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState("");
  const [minPrice, setMinPrice] = React.useState("");
  const [maxPrice, setMaxPrice] = React.useState("");
  const [minBedrooms, setMinBedrooms] = React.useState("");
  const [minBathrooms, setMinBathrooms] = React.useState("");

  // Draft filters (edited in dialog only)
  const [draftSearchTerm, setDraftSearchTerm] = React.useState("");
  const [draftCityFilter, setDraftCityFilter] = React.useState("");
  const [draftStateFilter, setDraftStateFilter] = React.useState("");
  const [draftMinPrice, setDraftMinPrice] = React.useState("");
  const [draftMaxPrice, setDraftMaxPrice] = React.useState("");
  const [draftPriceRange, setDraftPriceRange] = React.useState<[number, number]>([PRICE_MIN_DEFAULT, PRICE_MAX_DEFAULT]);
  const [draftMinBedrooms, setDraftMinBedrooms] = React.useState("");
  const [draftMinBathrooms, setDraftMinBathrooms] = React.useState("");
  const [feedSort, setFeedSort] = React.useState<string>("recommended");
  const [draftFeedSort, setDraftFeedSort] = React.useState<string>("recommended");
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [feedCurrentPlotId, setFeedCurrentPlotId] = React.useState<string | null>(null);
  const [lowDataMode, setLowDataMode] = React.useState(false);
  const [presets, setPresets] = React.useState<Array<{ id?: string; name: string; filters: Record<string, string> }>>([]);
  const [hiddenPropertyIds, setHiddenPropertyIds] = React.useState<Set<string>>(new Set());
  const [dismissedLocalAreas, setDismissedLocalAreas] = React.useState<Set<string>>(new Set());
  const { data: savedFiltersApi = [] } = useGetSavedFiltersQuery(undefined, { skip: !user?.id });
  const [createSavedFilter] = useCreateSavedFilterMutation();
  const { data: dismissedAreasApi = [] } = useGetDismissedAreasQuery(undefined, { skip: !user?.id });
  const [addDismissedArea] = useAddDismissedAreaMutation();

  // Allow anonymous browsing; no redirect when unauthenticated
  useEffect(() => {
    // no-op
  }, []);

  useEffect(() => {
    const storedSort = localStorage.getItem(SORT_STORAGE_KEY);
    if (storedSort && (FEED_SORT_OPTIONS as readonly string[]).includes(storedSort)) {
      setFeedSort(storedSort);
      setDraftFeedSort(storedSort);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, feedSort);
  }, [feedSort]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlFilters = [
      "search",
      "city",
      "state",
      "minPrice",
      "maxPrice",
      "minBedrooms",
      "minBathrooms",
      "sort",
    ].some((key) => urlParams.has(key));

    if (hasUrlFilters) {
      setSearchTerm(urlParams.get("search") ?? "");
      setCityFilter(urlParams.get("city") ?? "");
      setStateFilter(urlParams.get("state") ?? "");
      setMinPrice(urlParams.get("minPrice") ?? "");
      setMaxPrice(urlParams.get("maxPrice") ?? "");
      setMinBedrooms(urlParams.get("minBedrooms") ?? "");
      setMinBathrooms(urlParams.get("minBathrooms") ?? "");
      const sortFromUrl = urlParams.get("sort") ?? "";
      if ((FEED_SORT_OPTIONS as readonly string[]).includes(sortFromUrl)) {
        setFeedSort(sortFromUrl);
        setDraftFeedSort(sortFromUrl);
      }
      return;
    }
    // If URL has no filters, start from clean defaults.
    // This prevents stale persisted values (e.g. old maxPrice) from auto-applying.
    setSearchTerm("");
    setCityFilter("");
    setStateFilter("");
    setMinPrice("");
    setMaxPrice("");
    setMinBedrooms("");
    setMinBathrooms("");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LOW_DATA_STORAGE_KEY);
    if (stored) {
      setLowDataMode(stored === "true");
    }
  }, []);

  useEffect(() => {
    const syncFeedPlotId = () => {
      const value = sessionStorage.getItem("feed_current_plot_id");
      setFeedCurrentPlotId(value || null);
    };

    syncFeedPlotId();
    const onFeedPlotChanged = () => syncFeedPlotId();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "feed_current_plot_id") syncFeedPlotId();
    };

    window.addEventListener("feed-current-plot-changed", onFeedPlotChanged as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("feed-current-plot-changed", onFeedPlotChanged as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (user?.id) return;
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!stored) return;
    try {
      setPresets(JSON.parse(stored));
    } catch {
      // ignore invalid preset storage
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const mapped = savedFiltersApi.map((preset) => ({
      name: preset.name,
      filters: JSON.parse(preset.filtersJson || "{}"),
      id: preset.id,
    }));
    setPresets((prev) => {
      const prevJson = JSON.stringify(prev);
      const nextJson = JSON.stringify(mapped);
      return prevJson === nextJson ? prev : mapped;
    });
  }, [savedFiltersApi, user?.id]);

  useEffect(() => {
    const payload = {
      searchTerm,
      cityFilter,
      stateFilter,
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
    };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
  }, [searchTerm, cityFilter, stateFilter, minPrice, maxPrice, minBedrooms, minBathrooms]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string) => {
      if (value && value.trim() !== "") params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("search", searchTerm);
    setOrDelete("city", cityFilter);
    setOrDelete("state", stateFilter);
    setOrDelete("minPrice", minPrice);
    setOrDelete("maxPrice", maxPrice);
    setOrDelete("minBedrooms", minBedrooms);
    setOrDelete("minBathrooms", minBathrooms);
    if (feedSort && feedSort !== "recommended") params.set("sort", feedSort);
    else params.delete("sort");

    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [searchTerm, cityFilter, stateFilter, minPrice, maxPrice, minBedrooms, minBathrooms, feedSort]);

  useEffect(() => {
    localStorage.setItem(LOW_DATA_STORAGE_KEY, String(lowDataMode));
  }, [lowDataMode]);

  useEffect(() => {
    if (!user?.id) return;
    const set = new Set(dismissedAreasApi.map((area) => `${area.city}|${area.state}`));
    setDismissedLocalAreas((prev) => {
      if (prev.size === set.size) {
        const same = Array.from(prev).every((value) => set.has(value));
        if (same) return prev;
      }
      return set;
    });
  }, [dismissedAreasApi, user?.id]);

  useEffect(() => {
    if (user?.id) return;
    const stored = localStorage.getItem(DISMISSED_AREAS_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as string[];
      setDismissedLocalAreas(new Set(parsed));
    } catch {
      // ignore invalid storage
    }
  }, [user?.id]);

  const applyFilters = (filters: Partial<Record<string, string>>) => {
    setSearchTerm(filters.searchTerm ?? "");
    setCityFilter(filters.cityFilter ?? "");
    setStateFilter(filters.stateFilter ?? "");
    setMinPrice(filters.minPrice ?? "");
    setMaxPrice(filters.maxPrice ?? "");
    setMinBedrooms(filters.minBedrooms ?? "");
    setMinBathrooms(filters.minBathrooms ?? "");
  };

  const syncDraftFilters = (filters: Partial<Record<string, string>>) => {
    const nextSearch = filters.searchTerm ?? "";
    const nextCity = filters.cityFilter ?? "";
    const nextState = filters.stateFilter ?? "";
    const nextMinPrice = filters.minPrice ?? "";
    const nextMaxPrice = filters.maxPrice ?? "";
    const nextMinBedrooms = filters.minBedrooms ?? "";
    const nextMinBathrooms = filters.minBathrooms ?? "";

    setDraftSearchTerm(nextSearch);
    setDraftCityFilter(nextCity);
    setDraftStateFilter(nextState);
    setDraftMinPrice(nextMinPrice);
    setDraftMaxPrice(nextMaxPrice);
    setDraftPriceRange([
      Number(nextMinPrice) || PRICE_MIN_DEFAULT,
      Number(nextMaxPrice) || PRICE_MAX_DEFAULT,
    ]);
    setDraftMinBedrooms(nextMinBedrooms);
    setDraftMinBathrooms(nextMinBathrooms);
  };

  const applyFiltersAndSyncDraft = (filters: Partial<Record<string, string>>) => {
    applyFilters(filters);
    syncDraftFilters(filters);
  };

  const savePreset = async () => {
    const name = window.prompt("Preset name");
    if (!name) return;
    const newPreset = {
      name,
      filters: {
        searchTerm: draftSearchTerm,
        cityFilter: draftCityFilter,
        stateFilter: draftStateFilter,
        minPrice: String(draftPriceRange[0] || ""),
        maxPrice: String(draftPriceRange[1] || ""),
        minBedrooms: draftMinBedrooms,
        minBathrooms: draftMinBathrooms,
      },
    };
    if (user?.id) {
      try {
        await createSavedFilter({ name, filters: newPreset.filters }).unwrap();
        toast.success("Preset saved");
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }
      return;
    }
    const next = [...presets, newPreset];
    setPresets(next);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  };

  const { data: properties = [], isLoading: propertiesLoading, refetch } =
    useGetPropertiesQuery({
      search: canInteract ? (searchTerm || undefined) : undefined,
      city: canInteract ? (cityFilter || undefined) : undefined,
      state: canInteract ? (stateFilter || undefined) : undefined,
      minPrice: canInteract ? (minPrice || undefined) : undefined,
      maxPrice: canInteract ? (maxPrice || undefined) : undefined,
      minBedrooms: canInteract ? (minBedrooms || undefined) : undefined,
      minBathrooms: canInteract ? (minBathrooms || undefined) : undefined,
      sort: feedSort,
      // Admins otherwise receive all statuses from the API; the home feed should match what the public sees.
      status: user?.role === "admin" ? "active" : undefined,
    });

  const filteredProperties = properties.filter((property) => {
    if (canInteract && !isAdmin && hiddenPropertyIds.has(property.id)) return false;
    if (canInteract && !isAdmin && dismissedLocalAreas.has(`${property.city}|${property.state}`)) return false;
    return true;
  });

  const { data: savedProperties = [] } = useGetSavedPropertiesQuery(
    { userId: (user?.id as string) },
    { skip: !user?.id }
  );

  const savedPropertyIds = new Set(savedProperties?.map((sp) => sp.propertyId) || []);
  const [optimisticSavedIds, setOptimisticSavedIds] = React.useState<Set<string>>(savedPropertyIds);

  useEffect(() => {
    setOptimisticSavedIds((prev) => {
      const next = new Set(savedPropertyIds);
      if (prev.size === next.size) {
        const same = Array.from(prev).every((value) => next.has(value));
        if (same) return prev;
      }
      return next;
    });
  }, [savedProperties]);

  const [saveProperty] = useSavePropertyMutation();
  const [unsaveProperty] = useUnsavePropertyMutation();
  const [dislikeProperty] = useDislikePropertyMutation();

  const handleSaveProperty = async (propertyId: string) => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    try {
      const wasSaved = optimisticSavedIds.has(propertyId);
      const next = new Set(optimisticSavedIds);
      if (wasSaved) {
        next.delete(propertyId);
        setOptimisticSavedIds(next);
        toast.success("Removed from saved");
        unsaveProperty({ propertyId, userId: user.id }).unwrap().catch((error) => {
          setOptimisticSavedIds(new Set(savedPropertyIds));
          toast.error(getApiErrorMessage(error));
        });
      } else {
        next.add(propertyId);
        setOptimisticSavedIds(next);
        toast.success("Saved property");
        saveProperty({ userId: user.id, propertyId }).unwrap().catch((error) => {
          setOptimisticSavedIds(new Set(savedPropertyIds));
          toast.error(getApiErrorMessage(error));
        });
      }
    } catch (error) {
      console.error('Failed to toggle save property:', error);
      toast.error(getApiErrorMessage(error));
    }
  };

  const handleDislikeProperty = async (propertyId: string) => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    try {
      toast.success("Hidden from feed");
      setHiddenPropertyIds((prev) => new Set(prev).add(propertyId));
      dislikeProperty({ userId: user.id, propertyId }).unwrap().catch((error) => {
        toast.error(getApiErrorMessage(error));
      });
      // refetch();
    } catch (error) {
      console.error('Failed to dislike property:', error);
      toast.error(getApiErrorMessage(error));
    }
  };

  const handleDismissArea = async (property: Property) => {
    const key = `${property.city}|${property.state}`;
    setDismissedLocalAreas((prev) => new Set(prev).add(key));
    if (user?.id) {
      try {
        await addDismissedArea({ city: property.city, state: property.state }).unwrap();
        refetch();
        toast.success("Area hidden from feed");
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }
    } else {
      const next = new Set(dismissedLocalAreas).add(key);
      localStorage.setItem(DISMISSED_AREAS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      toast.success("Area hidden from feed");
    }
  };

  const cityOptions = React.useMemo(
    () => Array.from(new Set(properties.map((p) => p.city).filter(Boolean))) as string[],
    [properties]
  );
  const stateOptions = React.useMemo(
    () => Array.from(new Set(properties.map((p) => p.state).filter(Boolean))) as string[],
    [properties]
  );
  if (isLoading || propertiesLoading) {
    return <LoadingScreen />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Filter button */}
      {canInteract && !isDrawerOpen && (
        <div className="absolute top-16 right-3 left-3 z-20 flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              // Load current applied filters into the draft when opening
              setDraftSearchTerm(searchTerm);
              setDraftCityFilter(cityFilter);
              setDraftStateFilter(stateFilter);
              setDraftMinPrice(minPrice);
              setDraftMaxPrice(maxPrice);
              setDraftPriceRange([
                Number(minPrice) || 0,
                Number(maxPrice) || PRICE_MAX_DEFAULT,
              ]);
              setDraftMinBedrooms(minBedrooms);
              setDraftMinBathrooms(minBathrooms);
              setDraftFeedSort(feedSort);
              setIsFilterOpen(true);
            }}
            className="bg-white/20 backdrop-blur-xl text-white border border-white/20 rounded-full lg:px-4 lg:py-2 p-2.5 min-w-10"
          >
            <FilterIcon className="!w-5 !h-5" />
            <span className="hidden lg:block">
              Filters
            </span>
          </Button>
          {/* Temporarily disabled until public map feed is ready. */}
          {/*
          <Button
            onClick={() => navigate("/map")}
            className="bg-white/20 backdrop-blur-xl text-white border border-white/20 rounded-full lg:px-4 lg:py-2 p-2.5"
          >
            <MapPinHouse className="!w-5 !h-5" />
            <span className="hidden lg:block">
              Map
            </span>
          </Button>
          */}
          {feedCurrentPlotId && (
            <Button
              onClick={() => navigate(`/plot-finder/v2?plotId=${encodeURIComponent(feedCurrentPlotId)}`)}
              className="bg-white/20 backdrop-blur-xl text-white border border-white/20 rounded-full lg:px-4 lg:py-2 p-2.5 min-w-10"
            >
              <MapPinHouse className="!w-5 !h-5" />
              <span className="hidden lg:block">
                Plot Finder
              </span>
            </Button>
          )}
        </div>
      )}


      {/* Filter dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-xl dialog-content rounded-xl">
          <DialogHeader>
            <DialogTitle>Filter Properties</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "2+ Beds", filters: { minBedrooms: "2" } },
                { label: "3+ Beds", filters: { minBedrooms: "3" } },
                { label: "Under 5M", filters: { maxPrice: "5000000" } },
                { label: "Under 10M", filters: { maxPrice: "10000000" } },
              ].map((chip) => (
                <button
                  key={chip.label}
                  className="px-3 py-1 rounded-full bg-muted text-foreground text-xs border border-border hover:bg-muted/80"
                  onClick={() => applyFiltersAndSyncDraft({ ...chip.filters })}
                >
                  {chip.label}
                </button>
              ))}
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="px-3 py-1 rounded-full bg-muted text-foreground text-xs border border-border hover:bg-muted/80"
                  onClick={() => applyFiltersAndSyncDraft(preset.filters)}
                >
                  {preset.name}
                </button>
              ))}
              <button
                className="px-3 py-1 rounded-full bg-muted text-foreground text-xs border border-border hover:bg-muted/80"
                onClick={() => applyFiltersAndSyncDraft({})}
              >
                Reset
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <Input placeholder="Search by title, location..." value={draftSearchTerm} onChange={(e) => setDraftSearchTerm(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <Input
                  list="city-options"
                  placeholder="City"
                  value={draftCityFilter}
                  onChange={(e) => setDraftCityFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <Input
                  list="state-options"
                  placeholder="State"
                  value={draftStateFilter}
                  onChange={(e) => setDraftStateFilter(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-3">Price Range</label>
              <div className="px-1">
                <Slider
                  value={draftPriceRange}
                  onValueChange={(val) => setDraftPriceRange([val[0], val[1]])}
                  min={PRICE_MIN_DEFAULT}
                  max={PRICE_MAX_DEFAULT}
                  step={10000}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>${draftPriceRange[0].toLocaleString()}</span>
                <span>${draftPriceRange[1].toLocaleString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Min Bedrooms</label>
                <Input placeholder="e.g. 2" value={draftMinBedrooms} onChange={(e) => setDraftMinBedrooms(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Min Bathrooms</label>
                <Input placeholder="e.g. 1.5" value={draftMinBathrooms} onChange={(e) => setDraftMinBathrooms(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort feed</label>
              <Select value={draftFeedSort} onValueChange={setDraftFeedSort}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended (popular / recent mix)</SelectItem>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="price-high">Price: high to low</SelectItem>
                  <SelectItem value="price-low">Price: low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="low-data-mode"
                type="checkbox"
                checked={lowDataMode}
                onChange={(e) => setLowDataMode(e.target.checked)}
              />
              <label htmlFor="low-data-mode" className="text-sm font-medium">
                Low-data mode
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => {
                setDraftSearchTerm("");
                setDraftCityFilter("");
                setDraftStateFilter("");
                setDraftMinPrice("");
                setDraftMaxPrice("");
                setDraftPriceRange([PRICE_MIN_DEFAULT, PRICE_MAX_DEFAULT]);
                setDraftMinBedrooms("");
                setDraftMinBathrooms("");
              }}>
                <X className="w-4 h-4 sm:hidden" />
                Clear
              </Button>
              <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={savePreset}>
                <Save className="w-4 h-4 sm:hidden" />
                Save Preset
              </Button>
              <Button className="rounded-full w-full sm:w-auto" onClick={() => {
                // Apply drafts to actual filters
                applyFilters({
                  searchTerm: draftSearchTerm,
                  cityFilter: draftCityFilter,
                  stateFilter: draftStateFilter,
                  minPrice: draftPriceRange[0] > PRICE_MIN_DEFAULT ? String(draftPriceRange[0]) : "",
                  maxPrice: draftPriceRange[1] < PRICE_MAX_DEFAULT ? String(draftPriceRange[1]) : "",
                  minBedrooms: draftMinBedrooms,
                  minBathrooms: draftMinBathrooms,
                });
                setFeedSort(draftFeedSort);
                setIsFilterOpen(false);
              }}>
                <Check className="w-4 h-4 sm:hidden" />
                Apply
              </Button>
            </div>
          </div>
          <datalist id="city-options">
            {cityOptions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <datalist id="state-options">
            {stateOptions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </DialogContent>
      </Dialog>

      <PropertyFeed
        properties={filteredProperties}
        savedPropertyIds={optimisticSavedIds}
        onSaveProperty={handleSaveProperty}
        onDislikeProperty={handleDislikeProperty}
        isSaving={false}
        isDisliking={false}
        onLogout={canInteract ? handleLogout : undefined}
        userName={canInteract ? user?.name : undefined}
        canInteract={canInteract}
        keyboardEnabled={!isFilterOpen}
        onDrawerOpenChange={setIsDrawerOpen}
        onDismissArea={handleDismissArea}
        lowDataMode={lowDataMode}
        isAdmin={isAdmin}
      />
    </>
  );
}
