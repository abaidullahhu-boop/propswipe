import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Property, SavedProperty, Lead } from '@shared/schema';
import type { RootState } from '@/store';

export type PlotFinderSociety = {
  id: string;
  name: string;
  city: string;
  state: string;
};

export type CreatePlotFinderSocietyPayload = {
  name: string;
  city: string;
  state: string;
};

export type CreatePlotFinderBlockPayload = {
  societyId: string;
  name: string;
  widthPx: number;
  heightPx: number;
  image: File;
};

export type PlotFinderBlock = {
  id: string;
  societyId: string;
  name: string;
  imagePath: string;
  widthPx: number;
  heightPx: number;
};

export type PlotFinderPlot = {
  id: string;
  blockId: string;
  plotNumber: string;
  x: number;
  y: number;
  size?: string | null;
  status: string;
  metaJson?: string | null;
};

export type PlotFinderBlockDetails = {
  block: PlotFinderBlock;
  plots: PlotFinderPlot[];
};

export type PlotFinderSearchResult = {
  society: PlotFinderSociety;
  block: PlotFinderBlock;
  plot: PlotFinderPlot;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Property', 'SavedProperty', 'PropertyDislike', 'Lead', 'SavedFilter', 'PropertyReport', 'PlotFinder'],
  endpoints: (builder) => ({
    // Properties
    getProperties: builder.query<Property[], {
      search?: string;
      city?: string;
      state?: string;
      status?: string;
      minPrice?: string | number;
      maxPrice?: string | number;
      minBedrooms?: string | number;
      minBathrooms?: string | number;
      sort?: string;
      minLat?: number;
      maxLat?: number;
      minLng?: number;
      maxLng?: number;
      bbox?: string;
    } | void>({
      query: (params) => {
        if (!params) return '/properties';
        const searchParams = new URLSearchParams();
        if (params.search) searchParams.set("search", params.search);
        if (params.city) searchParams.set("city", params.city);
        if (params.state) searchParams.set("state", params.state);
        if (params.status) searchParams.set("status", params.status);
        if (params.minPrice !== undefined && params.minPrice !== "") searchParams.set("minPrice", String(params.minPrice));
        if (params.maxPrice !== undefined && params.maxPrice !== "") searchParams.set("maxPrice", String(params.maxPrice));
        if (params.minBedrooms !== undefined && params.minBedrooms !== "") searchParams.set("minBedrooms", String(params.minBedrooms));
        if (params.minBathrooms !== undefined && params.minBathrooms !== "") searchParams.set("minBathrooms", String(params.minBathrooms));
        if (params.sort) searchParams.set("sort", params.sort);
        if (params.minLat !== undefined) searchParams.set("minLat", String(params.minLat));
        if (params.maxLat !== undefined) searchParams.set("maxLat", String(params.maxLat));
        if (params.minLng !== undefined) searchParams.set("minLng", String(params.minLng));
        if (params.maxLng !== undefined) searchParams.set("maxLng", String(params.maxLng));
        if (params.bbox) searchParams.set("bbox", params.bbox);
        const qs = searchParams.toString();
        return `/properties${qs ? `?${qs}` : ""}`;
      },
      providesTags: ['Property'],
    }),
    
    getPropertyById: builder.query<Property, string>({
      query: (id) => `/properties/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Property', id }],
    }),

    // Plot finder
    getPlotFinderSocieties: builder.query<PlotFinderSociety[], { search?: string } | void>({
      query: (params) => {
        const qs = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
        return `/plot-finder/societies${qs}`;
      },
      providesTags: ['PlotFinder'],
    }),
    createPlotFinderSociety: builder.mutation<PlotFinderSociety, CreatePlotFinderSocietyPayload>({
      query: (body) => ({
        url: "/plot-finder/societies",
        method: "POST",
        body,
      }),
      invalidatesTags: ["PlotFinder"],
    }),
    getPlotFinderBlocks: builder.query<PlotFinderBlock[], { societyId: string }>({
      query: ({ societyId }) => `/plot-finder/societies/${societyId}/blocks`,
      providesTags: ['PlotFinder'],
    }),
    createPlotFinderBlock: builder.mutation<PlotFinderBlock, CreatePlotFinderBlockPayload>({
      query: ({ societyId, name, widthPx, heightPx, image }) => {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("widthPx", String(widthPx));
        formData.append("heightPx", String(heightPx));
        formData.append("image", image);
        return {
          url: `/plot-finder/societies/${societyId}/blocks`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["PlotFinder"],
    }),
    getPlotFinderBlockDetails: builder.query<PlotFinderBlockDetails, { blockId: string }>({
      query: ({ blockId }) => `/plot-finder/blocks/${blockId}`,
      providesTags: (_result, _error, { blockId }) => [{ type: 'PlotFinder', id: blockId }],
    }),
    searchPlotFinderPlots: builder.query<PlotFinderSearchResult[], { query: string; societyId?: string }>({
      query: ({ query, societyId }) => {
        const searchParams = new URLSearchParams({ query });
        if (societyId) searchParams.set("societyId", societyId);
        return `/plot-finder/plots/search?${searchParams.toString()}`;
      },
      providesTags: ['PlotFinder'],
    }),
    createPlot: builder.mutation<
      PlotFinderPlot,
      { blockId: string; plotNumber: string; x: number; y: number; size?: string; status?: string; metaJson?: string }
    >({
      query: ({ blockId, ...body }) => ({
        url: `/plot-finder/blocks/${blockId}/plots`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PlotFinder'],
    }),
    updatePlot: builder.mutation<
      PlotFinderPlot,
      { plotId: string; plotNumber?: string; x: number; y: number; size?: string; status?: string; metaJson?: string }
    >({
      query: ({ plotId, ...body }) => ({
        url: `/plot-finder/plots/${plotId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['PlotFinder'],
    }),
    getPlotById: builder.query<PlotFinderSearchResult, { plotId: string }>({
      query: ({ plotId }) => `/plot-finder/plots/${plotId}`,
      providesTags: (_result, _error, { plotId }) => [{ type: 'PlotFinder', id: plotId }],
    }),

    // If a plot already has a listing attached ("video linked with plot"),
    // return that property (including its videoUrl) so Plot Finder can be read-only.
    getPlotPropertyByPlotId: builder.query<Property | null, { plotId: string }>({
      query: ({ plotId }) => `/plot-finder/plots/${plotId}/property`,
      providesTags: (_result, _error, { plotId }) => [{ type: 'PlotFinder', id: plotId }],
    }),
    
    createProperty: builder.mutation<Property, Partial<Property>>({
      query: (property) => ({
        url: '/properties',
        method: 'POST',
        body: property,
      }),
      invalidatesTags: ['Property'],
    }),

    uploadVideo: builder.mutation<{
      videoUrl: string;
      thumbnailUrl?: string;
      videoKey?: string;
      thumbnailKey?: string;
      durationSeconds?: number;
      filesizeBytes?: number;
      width?: number;
      height?: number;
      videoStatus?: string;
    }, { file: File }>({
      query: ({ file }) => {
        const formData = new FormData();
        formData.append('video', file);
        return {
          url: '/uploads/video',
          method: 'POST',
          body: formData,
        };
      },
    }),

    s3Check: builder.query<
      {
        ok: boolean;
        bucket?: string;
        region?: string;
        putObjectKey?: string;
        deleteOk?: boolean;
        objectUrl?: string;
        anonymousGetObjectOk?: boolean;
        anonymousHeadStatus?: number;
        suggestedBucketPolicy?: string;
        error?: string;
        detail?: string;
      },
      void
    >({
      query: () => '/admin/s3-check',
    }),
    
    updateProperty: builder.mutation<Property, { id: string; data: Partial<Property> }>({
      query: ({ id, data }) => ({
        url: `/properties/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => {
        // Invalidate both the general tag and specific property tag
        if (error) return [];
        return ['Property', { type: 'Property', id }];
      },
    }),
    
    deleteProperty: builder.mutation<void, string>({
      query: (id) => ({
        url: `/properties/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Property'], // Invalidate all Property queries to refetch
    }),
    
    trackPropertyView: builder.mutation<void, { propertyId: string; userId: string }>({
      query: ({ propertyId, userId }) => ({
        url: `/properties/${propertyId}/view`,
        method: 'POST',
        body: { userId },
      }),
    }),
    
    // Auth
    login: builder.mutation<{ user: any; token: string }, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    
    signup: builder.mutation<{ user: any; token: string }, { email: string; password: string; name: string }>({
      query: (data) => ({
        url: '/auth/signup',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Saved Properties
    getSavedProperties: builder.query<SavedProperty[], { userId: string }>({
      query: ({ userId }) => `/saved-properties?userId=${userId}`,
      providesTags: ['SavedProperty'],
    }),
    getAllSavedProperties: builder.query<SavedProperty[], void>({
      query: () => `/saved-properties`,
      providesTags: ['SavedProperty'],
    }),
    getPublicSavedProperties: builder.query<SavedProperty[], { userId: string }>({
      query: ({ userId }) => `/public-saved-properties/${userId}`,
    }),
    
    saveProperty: builder.mutation<SavedProperty, { userId: string; propertyId: string }>({
      query: (data) => ({
        url: '/saved-properties',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['SavedProperty'],
    }),
    
    unsaveProperty: builder.mutation<void, { propertyId: string; userId: string }>({
      query: ({ propertyId, userId }) => ({
        url: `/saved-properties/${propertyId}`,
        method: 'DELETE',
        body: { userId },
      }),
      invalidatesTags: ['SavedProperty'],
    }),

    // Saved Filters
    getSavedFilters: builder.query<{ id: string; name: string; filtersJson: string }[], void>({
      query: () => '/saved-filters',
      providesTags: ['SavedFilter'],
    }),
    createSavedFilter: builder.mutation<{ id: string; name: string; filtersJson: string }, { name: string; filters: Record<string, string> }>({
      query: (data) => ({
        url: '/saved-filters',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['SavedFilter'],
    }),
    deleteSavedFilter: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/saved-filters/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SavedFilter'],
    }),

    // Dismissed Areas
    getDismissedAreas: builder.query<{ id: string; city: string; state: string }[], void>({
      query: () => '/dismissed-areas',
    }),
    addDismissedArea: builder.mutation<{ id: string; city: string; state: string }, { city: string; state: string }>({
      query: (data) => ({
        url: '/dismissed-areas',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Property Dislikes
    dislikeProperty: builder.mutation<void, { userId: string; propertyId: string }>({
      query: (data) => ({
        url: '/property-dislikes',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PropertyDislike'],
    }),

    // Reports & audit logs
    createPropertyReport: builder.mutation<void, { propertyId: string; reason: string; details?: string }>({
      query: (data) => ({
        url: '/property-reports',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PropertyReport'],
    }),
    getPropertyReports: builder.query<any[], void>({
      query: () => '/property-reports',
      providesTags: ['PropertyReport'],
    }),
    getPropertyAuditLogs: builder.query<any[], { propertyId: string }>({
      query: ({ propertyId }) => `/properties/${propertyId}/audit-logs`,
    }),

    // Analytics
    recordWatchEvent: builder.mutation<void, { propertyId: string; watchedSeconds: number; durationSeconds?: number }>({
      query: (data) => ({
        url: '/analytics/watch',
        method: 'POST',
        body: data,
      }),
    }),
    getAnalyticsSummary: builder.query<{ totalEvents: number; totalWatchSeconds: number; averageWatchSeconds: number; completionRate: number }, void>({
      query: () => '/analytics/summary',
    }),

    // Leads
    getLeads: builder.query<Lead[], void>({
      query: () => '/leads',
      providesTags: ['Lead'],
    }),
    createLead: builder.mutation<Lead, Partial<Lead>>({
      query: (data) => ({
        url: '/leads',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Lead'],
    }),
    updateLeadStatus: builder.mutation<Lead, { id: string; status: "new" | "contacted" | "closed" }>({
      query: ({ id, status }) => ({
        url: `/leads/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Lead'],
    }),
  }),
});

export const {
  // Properties
  useGetPropertiesQuery,
  useGetPropertyByIdQuery,
  useCreatePropertyMutation,
  useUploadVideoMutation,
  useLazyS3CheckQuery,
  useUpdatePropertyMutation,
  useDeletePropertyMutation,
  useTrackPropertyViewMutation,
  useGetPlotFinderSocietiesQuery,
  useCreatePlotFinderSocietyMutation,
  useGetPlotFinderBlocksQuery,
  useCreatePlotFinderBlockMutation,
  useGetPlotFinderBlockDetailsQuery,
  useSearchPlotFinderPlotsQuery,
  useCreatePlotMutation,
  useUpdatePlotMutation,
  useGetPlotByIdQuery,
  useGetPlotPropertyByPlotIdQuery,
  useLazyGetPlotPropertyByPlotIdQuery,
  
  // Auth
  useLoginMutation,
  useSignupMutation,
  
  // Saved Properties
  useGetSavedPropertiesQuery,
  useGetAllSavedPropertiesQuery,
  useGetPublicSavedPropertiesQuery,
  useSavePropertyMutation,
  useUnsavePropertyMutation,
  useGetSavedFiltersQuery,
  useCreateSavedFilterMutation,
  useDeleteSavedFilterMutation,
  useGetDismissedAreasQuery,
  useAddDismissedAreaMutation,
  
  // Dislikes
  useDislikePropertyMutation,
  useCreatePropertyReportMutation,
  useGetPropertyReportsQuery,
  useGetPropertyAuditLogsQuery,
  useRecordWatchEventMutation,
  useGetAnalyticsSummaryQuery,

  // Leads
  useGetLeadsQuery,
  useCreateLeadMutation,
  useUpdateLeadStatusMutation,
} = apiSlice;
