import { useEffect, useMemo, useState } from "react";
import { Plus, LayoutGrid, List, Search, Eye, TrendingUp, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyTable } from "@/components/PropertyTable";
import { Pagination } from "@/components/Pagination";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useGetPropertiesQuery,
  useDeletePropertyMutation,
} from "@/store/api/apiSlice";
import type { Property } from "@shared/schema";
import { throttle } from "@/lib/utils";
import { useLocation } from "wouter";

export default function AdminProperties() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "views-high" | "views-low" | "price-high" | "price-low">("newest");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived" | "hidden">("all");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [minBathrooms, setMinBathrooms] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // Draft filters for popup editing
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [draftCityFilter, setDraftCityFilter] = useState("");
  const [draftStateFilter, setDraftStateFilter] = useState("");
  const [draftPriceRange, setDraftPriceRange] = useState<[number, number]>([0, 5000000]);
  const [draftMinBedrooms, setDraftMinBedrooms] = useState("");
  const [draftMinBathrooms, setDraftMinBathrooms] = useState("");
  const [statusDraftFilter, setStatusDraftFilter] = useState<"all" | "active" | "draft" | "archived" | "hidden">("all");
  const itemsPerPage = 10;

  // Use RTK Query instead of TanStack Query
  const { data: properties = [], isLoading } = useGetPropertiesQuery();

  // Filter and sort properties
  const filteredAndSortedProperties = properties
    .filter(property => {
      const searchLower = (searchTerm ?? "").toLowerCase();
      const cityLower = (cityFilter ?? "").toLowerCase();
      const stateLower = (stateFilter ?? "").toLowerCase();

      const matchesSearch =
        searchTerm === "" ||
        (property.title ?? "").toLowerCase().includes(searchLower) ||
        (property.city ?? "").toLowerCase().includes(searchLower) ||
        (property.state ?? "").toLowerCase().includes(searchLower) ||
        (property.address ?? "").toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === "all" || property.status === statusFilter;

      const matchesCity = cityFilter === "" || (property.city ?? "").toLowerCase().includes(cityLower);
      const matchesState = stateFilter === "" || (property.state ?? "").toLowerCase().includes(stateLower);

      const priceNum = parseFloat(String(property.price ?? 0)) || 0;
      const matchesMinPrice = !minPrice || priceNum >= (parseFloat(minPrice) || 0);
      const matchesMaxPrice = !maxPrice || priceNum <= (parseFloat(maxPrice) || Infinity);

      const matchesBedrooms = !minBedrooms || (property.bedrooms ?? 0) >= (parseInt(minBedrooms) || 0);
      const matchesBathrooms = !minBathrooms || (parseFloat(String(property.bathrooms ?? 0)) || 0) >= (parseFloat(minBathrooms) || 0);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCity &&
        matchesState &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesBedrooms &&
        matchesBathrooms
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "views-high":
          return (b.views ?? 0) - (a.views ?? 0);
        case "views-low":
          return (a.views ?? 0) - (b.views ?? 0);
        case "price-high":
          return (parseFloat(String(b.price ?? 0)) || 0) - (parseFloat(String(a.price ?? 0)) || 0);
        case "price-low":
          return (parseFloat(String(a.price ?? 0)) || 0) - (parseFloat(String(b.price ?? 0)) || 0);
        default:
          return 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProperties.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProperties = filteredAndSortedProperties.slice(startIndex, endIndex);

  // Reset to first page when search term changes (throttled)
  const throttledSearch = useMemo(
    () => throttle((value: string) => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 250),
    []
  );

  // Calculate total views
  const totalViews = properties.reduce((sum, property) => sum + (property.views ?? 0), 0);
  const averageViews = properties.length > 0 ? Math.round(totalViews / properties.length) : 0;

  const [deleteProperty] = useDeletePropertyMutation();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyMobileDefaultView = () => {
      if (window.matchMedia("(max-width: 639px)").matches) {
        setViewMode("grid");
      }
    };

    applyMobileDefaultView();
    window.addEventListener("resize", applyMobileDefaultView);
    return () => {
      window.removeEventListener("resize", applyMobileDefaultView);
    };
  }, []);

  const handleDeleteProperty = async (id: string) => {
    if (confirm("Are you sure you want to delete this property?")) {
      try {
        await deleteProperty(id).unwrap();
      } catch (error) {
        console.error('Failed to delete property:', error);
      }
    }
  };

  const handlePreviewProperty = (id: string) => {
    window.open(`/property/${id}`, "_blank", "noopener,noreferrer");
  };

  const handleEditProperty = (property: Property) => {
    navigate(`/admin/upload?editId=${encodeURIComponent(property.id)}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">Properties</h1>
          <p className="text-muted-foreground">Manage your property listings</p>
        </div>
        <div className="w-full flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-4">

          <Button
            variant="outline"
            size="icon"
            className="sm:w-auto sm:px-4"
            onClick={() => {
              // Load current filters into drafts when opening
              setDraftSearchTerm(searchTerm);
              setDraftCityFilter(cityFilter);
              setDraftStateFilter(stateFilter);
              setDraftPriceRange([
                Number(minPrice) || 0,
                Number(maxPrice) || 5000000,
              ]);
              setDraftMinBedrooms(minBedrooms);
              setDraftMinBathrooms(minBathrooms);
              setStatusDraftFilter(statusFilter);
              setIsFilterOpen(true);
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Filter</span>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "table" ? "default" : "outline"}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button
            data-testid="button-create-property"
            size="icon"
            className="sm:w-auto sm:px-4"
            onClick={() => navigate("/admin/upload")}
          >
            <Plus className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Add Property</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading properties...</span>
          </div>
        </div>
      ) : (
        <>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600 " />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Views</p>
                  <p className="text-2xl font-bold">{averageViews.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <LayoutGrid className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Properties</p>
                  <p className="text-2xl font-bold">{properties.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sort control */}
          <div className="flex justify-end">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-input rounded-md bg-background"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="views-high">Most Views</option>
              <option value="views-low">Least Views</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
            </select>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedProperties.length)} of {filteredAndSortedProperties.length} properties
            </p>
          </div>

          {viewMode === "table" && (
            <>
              <PropertyTable
                properties={paginatedProperties}
                onEdit={handleEditProperty}
                onDelete={handleDeleteProperty}
                onPreview={handlePreviewProperty}
              />

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className="mt-6"
                />
              )}
            </>
          )}
        </>
      )}
      {!isLoading && viewMode === "grid" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedProperties.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No properties found
              </div>
            ) : (
              paginatedProperties.map((property) => (
                <div
                  key={property.id}
                  className="rounded-lg border border-border overflow-hidden bg-card"
                >
                  <div className="relative aspect-video bg-muted">
                    {property.thumbnailUrl ? (
                      <img
                        src={property.thumbnailUrl}
                        alt={property.title ?? "Property"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Eye className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{property.title ?? "Untitled"}</h3>
                      <span className="text-sm text-muted-foreground">{property.status ?? "active"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {property.city ?? ""}, {property.state ?? ""}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono">
                        {Number(property.price ?? 0).toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">
                        {(property.views ?? 0).toLocaleString()} views
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handlePreviewProperty(property.id)}>
                        <Eye className="w-4 h-4 sm:mr-2" />
                        <span className="sr-only sm:not-sr-only">Preview</span>
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleEditProperty(property)}>
                        <Pencil className="w-4 h-4 sm:mr-2" />
                        <span className="sr-only sm:not-sr-only">Edit</span>
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleDeleteProperty(property.id)}>
                        <Trash2 className="w-4 h-4 sm:mr-2" />
                        <span className="sr-only sm:not-sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="mt-6"
            />
          )}
        </>
      )}

      {/* Filters Dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto dialog-content">
          <DialogHeader>
            <DialogTitle>Filter Properties</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center text-muted-foreground items-center gap-2">
            <Button
              variant={statusDraftFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusDraftFilter("all")}
            >
              All
            </Button>
            <Button
              variant={statusDraftFilter === "active" ? "default" : "outline"}
              onClick={() => setStatusDraftFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={statusDraftFilter === "draft" ? "default" : "outline"}
              onClick={() => setStatusDraftFilter("draft")}
            >
              Drafts
            </Button>
            <Button
              variant={statusDraftFilter === "archived" ? "default" : "outline"}
              onClick={() => setStatusDraftFilter("archived")}
            >
              Archived
            </Button>
            <Button
              variant={statusDraftFilter === "hidden" ? "default" : "outline"}
              onClick={() => setStatusDraftFilter("hidden")}
            >
              Hidden
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search properties..."
                value={draftSearchTerm}
                onChange={(e) => setDraftSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <Input placeholder="City" value={draftCityFilter} onChange={(e) => setDraftCityFilter(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <Input placeholder="State" value={draftStateFilter} onChange={(e) => setDraftStateFilter(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-3">Price Range</label>
              <div className="px-1">
                <Slider
                  value={draftPriceRange}
                  onValueChange={(val) => setDraftPriceRange([val[0], val[1]])}
                  min={0}
                  max={5000000}
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-full" onClick={() => {
                setDraftSearchTerm("");
                setDraftCityFilter("");
                setDraftStateFilter("");
                setDraftPriceRange([0, 5000000]);
                setDraftMinBedrooms("");
                setDraftMinBathrooms("");
                setStatusDraftFilter("all");
              }}>Clear</Button>
              <Button className="rounded-full" onClick={() => {
                setSearchTerm(draftSearchTerm);
                setCityFilter(draftCityFilter);
                setStateFilter(draftStateFilter);
                setMinPrice(String(draftPriceRange[0]));
                setMaxPrice(String(draftPriceRange[1]));
                setMinBedrooms(draftMinBedrooms);
                setMinBathrooms(draftMinBathrooms);
                setIsFilterOpen(false);
                setStatusFilter(statusDraftFilter);
              }}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
