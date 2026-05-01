import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useLocation } from "wouter";
import { Circle, Layer, Stage, Image as KonvaImage, Text, Transformer } from "react-konva";
import useImage from "use-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Minus, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import {
  useGetPlotFinderBlocksQuery,
  useGetPlotFinderBlockDetailsQuery,
  useGetPlotFinderSocietiesQuery,
  useCreatePlotFinderSocietyMutation,
  useCreatePlotFinderBlockMutation,
  useSearchPlotFinderPlotsQuery,
  useGetPlotByIdQuery,
  useGetPlotPropertyByPlotIdQuery,
  useLazyGetPlotPropertyByPlotIdQuery,
  useCreatePlotMutation,
  useUpdatePlotMutation,
  type PlotFinderBlock,
  type PlotFinderPlot,
  type PlotFinderSearchResult,
} from "@/store/api/apiSlice";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

type MapBlock = {
  id: string;
  name: string;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
};

type MapPlot = {
  id: string;
  blockId: string;
  x: number;
  y: number;
  plotNumber: string;
};

type PlotMeta = {
  plotType?: string;
  isCornerPlot?: boolean;
  isParkFacing?: boolean;
};

function parsePlotMeta(metaJson?: string | null): PlotMeta {
  if (!metaJson) return {};
  try {
    const parsed = JSON.parse(metaJson);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PlotMeta;
  } catch {
    return {};
  }
}

const MIN_STAGE_SCALE = 0.01;
const PLOT_FINDER_V2_LAYOUT_STORAGE_KEY = "plot-finder-v2-layout-overrides";
const PRESELECTED_PLOT_FOCUS_SCALE = 1.75;
const SEARCH_PLOT_FOCUS_SCALE = 0.2;
const PLOT_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "corner", label: "Corner" },
  { value: "park-facing", label: "Park Facing" },
] as const;
const PLOT_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold" },
  { value: "booked", label: "Booked" },
  { value: "under-negotiation", label: "Under Negotiation" },
  { value: "hold", label: "Hold" },
] as const;

function normalizeImagePath(imagePath: string) {
  const value = String(imagePath ?? "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      reject(new Error("Failed to read image dimensions"));
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

function useElementSize(elementRef: RefObject<HTMLElement>) {
  const [size, setSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const updateFromRect = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateFromRect();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(element);

    window.addEventListener("resize", updateFromRect);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFromRect);
    };
  }, [elementRef]);

  return size;
}

function BlockPlotsLayer({
  block,
  activePlotId,
  movingPlotId,
  movingDraft,
  isAdmin,
  selectMode,
  onSelectPlot,
  onPublicPlotClick,
  onAdminMovePlotStart,
  onAdminMovePlotDraftChange,
  onAdminMovePlotCommit,
}: {
  block: MapBlock;
  activePlotId: string | null;
  movingPlotId: string | null;
  movingDraft: { x: number; y: number } | null;
  isAdmin: boolean;
  selectMode: boolean;
  onSelectPlot: (plotId: string) => void;
  onPublicPlotClick: (plot: PlotFinderPlot) => void;
  onAdminMovePlotStart: (plot: PlotFinderPlot) => Promise<boolean>;
  onAdminMovePlotDraftChange: (plotId: string, x: number, y: number) => void;
  onAdminMovePlotCommit: (plotId: string, x: number, y: number) => Promise<void>;
}) {
  const { data: blockDetails } = useGetPlotFinderBlockDetailsQuery({ blockId: block.id });
  const plots = blockDetails?.plots ?? [];

  return (
    <>
      {plots.map((plot) => {
        const isActive = activePlotId === plot.id;
        const isMoving = movingPlotId === plot.id;
        const pointX = block.x + (isMoving && movingDraft ? movingDraft.x : plot.x);
        const pointY = block.y + (isMoving && movingDraft ? movingDraft.y : plot.y);

        return (
          <Circle
            key={plot.id}
            x={pointX}
            y={pointY}
            radius={isMoving ? 7 : isActive ? 6 : 4}
            fill={isMoving ? "#eab308" : isActive ? "#ef4444" : "#2563eb"}
            stroke="#fff"
            strokeWidth={1.5}
            draggable={isAdmin && isMoving}
            onClick={async (e) => {
              e.cancelBubble = true;
              if (isAdmin) {
                if (!isMoving) {
                  await onAdminMovePlotStart(plot);
                }
                return;
              }

              if (selectMode) {
                onSelectPlot(plot.id);
                return;
              }

              onPublicPlotClick(plot);
            }}
            onDragMove={(e) => {
              if (!isAdmin || !isMoving) return;
              const mapX = e.target.x();
              const mapY = e.target.y();
              onAdminMovePlotDraftChange(plot.id, mapX - block.x, mapY - block.y);
            }}
            onDragEnd={async (e) => {
              if (!isAdmin || !isMoving) return;
              const mapX = e.target.x();
              const mapY = e.target.y();
              await onAdminMovePlotCommit(plot.id, mapX - block.x, mapY - block.y);
            }}
          />
        );
      })}
    </>
  );
}

export default function PlotFinderV2Page() {
  const [, navigate] = useLocation();
  const queryParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const selectMode = queryParams?.get("mode") === "select";
  const preselectedSocietyId = queryParams?.get("societyId");
  const preselectedPlotId = queryParams?.get("plotId");
  const returnEditId = queryParams?.get("editId");

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isAdminMarkingEnabled = isAdmin && !selectMode;

  const [societySearch, setSocietySearch] = useState("");
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [plotSearchInput, setPlotSearchInput] = useState("");
  const [submittedPlotSearch, setSubmittedPlotSearch] = useState("");
  const [debouncedPlotSearchInput, setDebouncedPlotSearchInput] = useState("");
  const [activePlot, setActivePlot] = useState<PlotFinderSearchResult["plot"] | null>(null);
  const [pendingJumpPlot, setPendingJumpPlot] = useState<PlotFinderSearchResult["plot"] | null>(null);
  const [didJumpToPreselectedPlot, setDidJumpToPreselectedPlot] = useState(false);

  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [pendingMark, setPendingMark] = useState<{ blockId: string; x: number; y: number } | null>(null);
  const [markPlotNumber, setMarkPlotNumber] = useState("");
  const [markPlotSize, setMarkPlotSize] = useState("");
  const [markPlotType, setMarkPlotType] = useState("residential");
  const [markPlotStatus, setMarkPlotStatus] = useState("available");
  const [markIsCornerPlot, setMarkIsCornerPlot] = useState(false);
  const [markIsParkFacing, setMarkIsParkFacing] = useState(false);
  const [movingPlot, setMovingPlot] = useState<PlotFinderPlot | null>(null);
  const [movingPlotDraftPos, setMovingPlotDraftPos] = useState<{ x: number; y: number } | null>(null);
  const [isPlotDetailOpen, setIsPlotDetailOpen] = useState(false);
  const [detailPlotNumber, setDetailPlotNumber] = useState("");
  const [detailPlotSize, setDetailPlotSize] = useState("");
  const [detailPlotType, setDetailPlotType] = useState("residential");
  const [detailPlotStatus, setDetailPlotStatus] = useState("available");
  const [detailIsCornerPlot, setDetailIsCornerPlot] = useState(false);
  const [detailIsParkFacing, setDetailIsParkFacing] = useState(false);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [layoutSavedOverrides, setLayoutSavedOverrides] = useState<
    Record<string, { x: number; y: number; scale: number }>
  >({});
  const [layoutDraftOverrides, setLayoutDraftOverrides] = useState<
    Record<string, { x: number; y: number; scale: number }>
  >({});

  const [createSocietyOpen, setCreateSocietyOpen] = useState(false);
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [newSocietyName, setNewSocietyName] = useState("");
  const [newSocietyCity, setNewSocietyCity] = useState("");
  const [newSocietyState, setNewSocietyState] = useState("");
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockImageFile, setNewBlockImageFile] = useState<File | null>(null);
  const [newBlockWidthPx, setNewBlockWidthPx] = useState<number>(0);
  const [newBlockHeightPx, setNewBlockHeightPx] = useState<number>(0);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );

  const stageRef = useRef<any>(null);
  const selectedBlockNodeRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageScaleRef = useRef(1);
  const stagePosRef = useRef({ x: 0, y: 0 });
  const viewportSize = useElementSize(containerRef as RefObject<HTMLElement>);

  const { data: preselectedPlotData } = useGetPlotByIdQuery({ plotId: preselectedPlotId as string }, { skip: !preselectedPlotId });
  const { data: activePlotProperty } = useGetPlotPropertyByPlotIdQuery({ plotId: activePlot?.id as string }, { skip: !activePlot?.id });
  const { data: preselectedPlotProperty } = useGetPlotPropertyByPlotIdQuery({ plotId: preselectedPlotId as string }, { skip: !preselectedPlotId });
  const [triggerPlotPropertyByPlotId] = useLazyGetPlotPropertyByPlotIdQuery();

  const [createPlot, { isLoading: isCreatingPlot }] = useCreatePlotMutation();
  const [updatePlot, { isLoading: isUpdatingPlot }] = useUpdatePlotMutation();
  const [createSociety, { isLoading: isCreatingSociety }] = useCreatePlotFinderSocietyMutation();
  const [createBlock, { isLoading: isCreatingBlock }] = useCreatePlotFinderBlockMutation();

  const { data: societies = [], isFetching: societiesLoading } = useGetPlotFinderSocietiesQuery({
    search: societySearch || undefined,
  });
  const { data: blocks = [], isFetching: blocksLoading } = useGetPlotFinderBlocksQuery(
    { societyId: selectedSocietyId as string },
    { skip: !selectedSocietyId }
  );
  const { data: selectedBlockDetails } = useGetPlotFinderBlockDetailsQuery(
    { blockId: selectedBlockId as string },
    { skip: !selectedBlockId }
  );
  const { data: searchResults = [], isFetching: searchLoading } = useSearchPlotFinderPlotsQuery(
    { query: submittedPlotSearch, societyId: selectedSocietyId ?? undefined },
    { skip: !selectedSocietyId || submittedPlotSearch.trim().length === 0 }
  );
  const { data: liveSearchSuggestions = [], isFetching: liveSearchLoading } = useSearchPlotFinderPlotsQuery(
    { query: debouncedPlotSearchInput, societyId: selectedSocietyId ?? undefined },
    { skip: !selectedSocietyId || debouncedPlotSearchInput.trim().length === 0 }
  );

  useEffect(() => {
    if (preselectedSocietyId && societies.some((society) => society.id === preselectedSocietyId)) {
      setSelectedSocietyId(preselectedSocietyId);
      return;
    }
    if (!selectedSocietyId && societies.length > 0) {
      setSelectedSocietyId(societies[0].id);
    }
  }, [preselectedSocietyId, selectedSocietyId, societies]);

  useEffect(() => {
    if (!selectedSocietyId) return;
    if (!blocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(blocks[0]?.id ?? null);
    }
  }, [blocks, selectedBlockId, selectedSocietyId]);

  useEffect(() => {
    setActivePlot(null);
    if (!preselectedPlotId) setPendingJumpPlot(null);
    setSubmittedPlotSearch("");
    setPlotSearchInput("");
    setDebouncedPlotSearchInput("");
    setMovingPlot(null);
    setMovingPlotDraftPos(null);
  }, [selectedSocietyId, preselectedPlotId]);

  useEffect(() => {
    const nextValue = plotSearchInput.trim();
    const timeoutId = window.setTimeout(() => {
      setDebouncedPlotSearchInput(nextValue);
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [plotSearchInput]);

  useEffect(() => {
    if (!preselectedPlotData) return;
    setSelectedSocietyId(preselectedPlotData.society.id);
    setSelectedBlockId(preselectedPlotData.block.id);
    setPendingJumpPlot(preselectedPlotData.plot);
    setActivePlot(preselectedPlotData.plot);
    setDidJumpToPreselectedPlot(false);
  }, [preselectedPlotData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PLOT_FINDER_V2_LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, { x: number; y: number; scale: number }>;
      if (!parsed || typeof parsed !== "object") return;
      setLayoutSavedOverrides(parsed);
    } catch {
      // ignore malformed saved layout
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLOT_FINDER_V2_LAYOUT_STORAGE_KEY, JSON.stringify(layoutSavedOverrides));
  }, [layoutSavedOverrides]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobileLayout(window.innerWidth < 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effectiveLayoutOverrides = useMemo(
    () => (layoutEditMode ? layoutDraftOverrides : layoutSavedOverrides),
    [layoutDraftOverrides, layoutEditMode, layoutSavedOverrides]
  );

  const mapBlocks = useMemo<MapBlock[]>(() => {
    const positionInGrid = (index: number, block: PlotFinderBlock) => {
      const colCount = 2;
      const col = index % colCount;
      const row = Math.floor(index / colCount);
      const gapX = Math.max(200, block.widthPx * 0.05);
      const gapY = Math.max(200, block.heightPx * 0.05);
      const colWidth = block.widthPx;
      const rowHeight = block.heightPx;
      return {
        x: col * (colWidth + gapX) + 300,
        y: row * (rowHeight + gapY) + 300,
      };
    };

    return blocks
      .filter((block) => block.widthPx > 0 && block.heightPx > 0)
      .map((block, index) => {
        const fallbackPos = positionInGrid(index, block);
        const override = effectiveLayoutOverrides[block.id];
        const scale = Math.max(MIN_STAGE_SCALE, Math.min(1, override?.scale ?? 1));
        const width = Math.max(1, Math.round(block.widthPx * scale));
        const height = Math.max(1, Math.round(block.heightPx * scale));
        return {
          id: block.id,
          name: block.name,
          image: normalizeImagePath(block.imagePath),
          x: override?.x ?? fallbackPos.x,
          y: override?.y ?? fallbackPos.y,
          width,
          height,
          originalWidth: block.widthPx,
          originalHeight: block.heightPx,
        };
      });
  }, [blocks, effectiveLayoutOverrides]);

  const mapBlocksById = useMemo(() => new Map(mapBlocks.map((block) => [block.id, block])), [mapBlocks]);

  const canvasBounds = useMemo(() => {
    if (mapBlocks.length === 0) return { width: 0, height: 0 };
    return {
      width: Math.max(...mapBlocks.map((block) => block.x + block.width)) + 300,
      height: Math.max(...mapBlocks.map((block) => block.y + block.height)) + 300,
    };
  }, [mapBlocks]);

  const fitToCanvas = useCallback(
    (animate = true) => {
      const stage = stageRef.current;
      if (!stage || viewportSize.width <= 0 || viewportSize.height <= 0 || canvasBounds.width <= 0 || canvasBounds.height <= 0) return;

      const padding = 40;
      const availableWidth = Math.max(1, viewportSize.width - padding * 2);
      const availableHeight = Math.max(1, viewportSize.height - padding * 2);
      const fitScale = Math.min(availableWidth / canvasBounds.width, availableHeight / canvasBounds.height);
      const nextScale = Math.max(MIN_STAGE_SCALE, Math.min(1.5, fitScale));
      const x = (viewportSize.width - canvasBounds.width * nextScale) / 2;
      const y = (viewportSize.height - canvasBounds.height * nextScale) / 2;

      if (animate) {
        stage.to({
          x,
          y,
          scaleX: nextScale,
          scaleY: nextScale,
          duration: 0.35,
          onFinish: () => {
            stageScaleRef.current = nextScale;
            stagePosRef.current = { x, y };
          },
        });
      } else {
        stage.scale({ x: nextScale, y: nextScale });
        stage.position({ x, y });
        stage.batchDraw();
        stageScaleRef.current = nextScale;
        stagePosRef.current = { x, y };
      }
    },
    [canvasBounds.height, canvasBounds.width, viewportSize.height, viewportSize.width]
  );

  const focusOnPlot = useCallback(
    (plot: MapPlot, targetScale = 2.5) => {
      const stage = stageRef.current;
      if (!stage || viewportSize.width <= 0 || viewportSize.height <= 0) return false;

      const block = mapBlocksById.get(plot.blockId);
      if (!block) return false;

      const globalX = block.x + plot.x;
      const globalY = block.y + plot.y;
      const scale = Math.max(MIN_STAGE_SCALE, Math.min(6, targetScale));
      const x = viewportSize.width / 2 - globalX * scale;
      const y = viewportSize.height / 2 - globalY * scale;

      stage.to({
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        duration: 0.4,
        onFinish: () => {
          stageScaleRef.current = scale;
          stagePosRef.current = { x, y };
        },
      });

      return true;
    },
    [mapBlocksById, viewportSize.height, viewportSize.width]
  );

  const focusOnBlock = useCallback(
    (blockId: string, scaleMultiplier = 1.1) => {
      const stage = stageRef.current;
      if (!stage || viewportSize.width <= 0 || viewportSize.height <= 0) return false;
      const block = mapBlocksById.get(blockId);
      if (!block) return false;

      const fitScale = Math.min(viewportSize.width / block.width, viewportSize.height / block.height);
      const scale = Math.max(MIN_STAGE_SCALE, Math.min(6, fitScale * scaleMultiplier));
      const centerX = block.x + block.width / 2;
      const centerY = block.y + block.height / 2;
      const x = viewportSize.width / 2 - centerX * scale;
      const y = viewportSize.height / 2 - centerY * scale;

      stage.to({
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        duration: 0.35,
        onFinish: () => {
          stageScaleRef.current = scale;
          stagePosRef.current = { x, y };
        },
      });
      return true;
    },
    [mapBlocksById, viewportSize.height, viewportSize.width]
  );

  useEffect(() => {
    if (canvasBounds.width <= 0 || canvasBounds.height <= 0) return;
    const id = requestAnimationFrame(() => fitToCanvas(false));
    return () => cancelAnimationFrame(id);
  }, [canvasBounds.height, canvasBounds.width, fitToCanvas, selectedSocietyId]);

  useEffect(() => {
    if (!preselectedPlotData || didJumpToPreselectedPlot) return;
    if (!focusOnPlot(preselectedPlotData.plot, PRESELECTED_PLOT_FOCUS_SCALE)) return;
    setDidJumpToPreselectedPlot(true);
    setPendingJumpPlot(null);
  }, [didJumpToPreselectedPlot, focusOnPlot, preselectedPlotData]);

  useEffect(() => {
    if (!pendingJumpPlot) return;
    if (focusOnPlot(pendingJumpPlot, SEARCH_PLOT_FOCUS_SCALE)) setPendingJumpPlot(null);
  }, [focusOnPlot, pendingJumpPlot]);

  useEffect(() => {
    if (!submittedPlotSearch || searchResults.length === 0) return;
    const first = searchResults[0];
    setSelectedBlockId(first.block.id);
    focusOnBlock(first.block.id, 1.12);
    setPendingJumpPlot(first.plot);
    setActivePlot(first.plot);
  }, [focusOnBlock, searchResults, submittedPlotSearch]);

  useEffect(() => {
    if (!layoutEditMode) return;
    const transformer = transformerRef.current;
    const selectedNode = selectedBlockNodeRef.current;
    if (!transformer || !selectedNode) return;
    transformer.nodes([selectedNode]);
    transformer.getLayer()?.batchDraw();
  }, [layoutEditMode, selectedBlockId, mapBlocks]);

  useEffect(() => {
    if (typeof window === "undefined" || !activePlot?.id) return;
    const params = new URLSearchParams(window.location.search);
    params.set("plotId", activePlot.id);
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [activePlot?.id]);

  const stagePointerToMapPoint = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const inverted = stage.getAbsoluteTransform().copy();
    inverted.invert();
    return inverted.point(pointer);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScaleRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.05;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(MIN_STAGE_SCALE, Math.min(8, newScale));

    const mousePointTo = {
      x: (pointer.x - stagePosRef.current.x) / oldScale,
      y: (pointer.y - stagePosRef.current.y) / oldScale,
    };

    const nextPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    stage.scale({ x: clampedScale, y: clampedScale });
    stage.position(nextPos);
    stage.batchDraw();
    stageScaleRef.current = clampedScale;
    stagePosRef.current = nextPos;
  };

  const zoomAroundViewportCenter = (scaleFactor: number) => {
    const stage = stageRef.current;
    if (!stage || viewportSize.width <= 0 || viewportSize.height <= 0) return;

    const oldScale = stageScaleRef.current;
    const nextScale = Math.max(MIN_STAGE_SCALE, Math.min(8, oldScale * scaleFactor));
    const center = {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2,
    };
    const focusPoint = {
      x: (center.x - stagePosRef.current.x) / oldScale,
      y: (center.y - stagePosRef.current.y) / oldScale,
    };
    const nextPos = {
      x: center.x - focusPoint.x * nextScale,
      y: center.y - focusPoint.y * nextScale,
    };

    stage.to({
      scaleX: nextScale,
      scaleY: nextScale,
      x: nextPos.x,
      y: nextPos.y,
      duration: 0.2,
      onFinish: () => {
        stageScaleRef.current = nextScale;
        stagePosRef.current = nextPos;
      },
    });
  };

  const handleStageClick = () => {
    if (!isAdminMarkingEnabled) return;
    if (layoutEditMode) return;
    if (movingPlot) return;
    const mapPoint = stagePointerToMapPoint();
    if (!mapPoint) return;

    const targetBlock = mapBlocks.find(
      (block) =>
        mapPoint.x >= block.x &&
        mapPoint.x <= block.x + block.width &&
        mapPoint.y >= block.y &&
        mapPoint.y <= block.y + block.height
    );
    if (!targetBlock) return;

    setPendingMark({
      blockId: targetBlock.id,
      x: Number((mapPoint.x - targetBlock.x).toFixed(2)),
      y: Number((mapPoint.y - targetBlock.y).toFixed(2)),
    });
    setMarkPlotNumber("");
    setMarkPlotSize("");
    setMarkPlotType("residential");
    setMarkPlotStatus("available");
    setMarkIsCornerPlot(false);
    setMarkIsParkFacing(false);
    setMarkDialogOpen(true);
  };

  const handleSubmitPlotSearch = () => setSubmittedPlotSearch(plotSearchInput.trim());

  const handleJumpToSearchResult = (result: PlotFinderSearchResult) => {
    setSelectedBlockId(result.block.id);
    setPendingJumpPlot(result.plot);
    setActivePlot(result.plot);
    setPlotSearchInput(result.plot.plotNumber);
    setSubmittedPlotSearch(result.plot.plotNumber);
    focusOnBlock(result.block.id, 1.12);
  };

  const updateBlockLayoutOverride = (blockId: string, next: { x: number; y: number; scale: number }) => {
    setLayoutDraftOverrides((prev) => ({
      ...prev,
      [blockId]: {
        x: Math.round(next.x),
        y: Math.round(next.y),
        scale: Math.max(MIN_STAGE_SCALE, Math.min(1, Number(next.scale.toFixed(4)))),
      },
    }));
  };

  const handleSelectPlot = (plotId: string) => {
    const params = new URLSearchParams({ plotId });
    if (returnEditId) params.set("editId", returnEditId);
    navigate(`/admin/upload?${params.toString()}`);
  };

  const handlePublicPlotClick = async (plot: PlotFinderPlot) => {
    setActivePlot(plot);
    try {
      const property = await triggerPlotPropertyByPlotId({ plotId: plot.id }).unwrap();
      if (property?.videoUrl) {
        navigate(`/property/${property.id}`);
      } else {
        toast.error("No video attached to this plot yet.");
      }
    } catch {
      toast.error("Failed to load plot video.");
    }
  };

  const availablePlotsInSelectedBlock = useMemo(() => {
    const selectedPlotId = activePlot?.id ?? preselectedPlotId ?? null;
    const plots = selectedBlockDetails?.plots ?? [];
    return plots
      .filter((plot) => plot.status === "available" && plot.id !== selectedPlotId)
      .sort((a, b) =>
        String(a.plotNumber).localeCompare(String(b.plotNumber), undefined, { numeric: true, sensitivity: "base" })
      )
      .slice(0, 8);
  }, [activePlot?.id, preselectedPlotId, selectedBlockDetails?.plots]);
  const selectedSociety = useMemo(
    () => societies.find((society) => society.id === selectedSocietyId) ?? null,
    [selectedSocietyId, societies]
  );
  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );
  const stageWidth = Math.max(1, viewportSize.width);
  const stageHeight = Math.max(1, isMobileLayout ? 260 : viewportSize.height);
  const mobileInventoryPlots = useMemo(() => {
    const plots = selectedBlockDetails?.plots ?? [];
    return [...plots]
      .sort((a, b) =>
        String(a.plotNumber).localeCompare(String(b.plotNumber), undefined, { numeric: true, sensitivity: "base" })
      )
      .slice(0, 6);
  }, [selectedBlockDetails?.plots]);

  const activePlotDetails = useMemo(() => {
    if (!activePlot?.id) return null;
    return selectedBlockDetails?.plots.find((plot) => plot.id === activePlot.id) ?? activePlot;
  }, [activePlot, selectedBlockDetails?.plots]);

  useEffect(() => {
    if (!activePlotDetails) {
      setDetailPlotNumber("");
      setDetailPlotSize("");
      setDetailPlotType("residential");
      setDetailPlotStatus("available");
      setDetailIsCornerPlot(false);
      setDetailIsParkFacing(false);
      return;
    }
    const meta = parsePlotMeta(activePlotDetails.metaJson);
    setDetailPlotNumber(activePlotDetails.plotNumber ?? "");
    setDetailPlotSize(activePlotDetails.size ?? "");
    const normalizedType =
      typeof meta.plotType === "string" && PLOT_TYPE_OPTIONS.some((option) => option.value === meta.plotType)
        ? meta.plotType
        : "residential";
    const normalizedStatus = PLOT_STATUS_OPTIONS.some((option) => option.value === activePlotDetails.status)
      ? activePlotDetails.status
      : "available";
    const isCornerFromLegacyType = meta.plotType === "corner";
    const isParkFromLegacyType = meta.plotType === "park-facing";
    setDetailPlotType(normalizedType);
    setDetailPlotStatus(normalizedStatus);
    setDetailIsCornerPlot(Boolean(meta.isCornerPlot || isCornerFromLegacyType));
    setDetailIsParkFacing(Boolean(meta.isParkFacing || isParkFromLegacyType));
  }, [activePlotDetails]);

  const handleAdminMovePlot = async (plot: PlotFinderPlot): Promise<boolean> => {
    try {
      const property = await triggerPlotPropertyByPlotId({ plotId: plot.id }).unwrap();
      if (property?.videoUrl) {
        toast.error("This plot already has a video listing, so it is read-only.");
        return false;
      }
    } catch {
      // do not block movement if this check fails
    }

    setMovingPlot(plot);
    setMovingPlotDraftPos({ x: plot.x, y: plot.y });
    setActivePlot(plot);
    setIsPlotDetailOpen(true);
    toast("Move mode enabled for selected plot.");
    return true;
  };

  const handleAdminMovePlotDraftChange = (plotId: string, x: number, y: number) => {
    if (!movingPlot || movingPlot.id !== plotId) return;
    setMovingPlotDraftPos({ x, y });
  };

  const handleAdminMovePlotCommit = async (plotId: string, x: number, y: number) => {
    try {
      await updatePlot({ plotId, x, y }).unwrap();
      toast.success("Plot marker moved");
      setMovingPlot(null);
      setMovingPlotDraftPos(null);
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to move plot marker");
    }
  };

  const handleSavePlot = async () => {
    if (!pendingMark || !markPlotNumber.trim()) return;
    try {
      const created = await createPlot({
        blockId: pendingMark.blockId,
        plotNumber: markPlotNumber.trim(),
        x: pendingMark.x,
        y: pendingMark.y,
        size: markPlotSize.trim() || undefined,
        status: markPlotStatus.trim() || "available",
        metaJson: JSON.stringify({
          plotType: markPlotType.trim() || "residential",
          isCornerPlot: markIsCornerPlot,
          isParkFacing: markIsParkFacing,
        }),
      }).unwrap();
      toast.success(`Plot ${created.plotNumber} created`);
      setMarkDialogOpen(false);
      setPendingMark(null);
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to create plot");
    }
  };

  const handleSavePlotDetails = async () => {
    if (!activePlotDetails || !detailPlotNumber.trim()) return;
    const isMovingActivePlot = movingPlot?.id === activePlotDetails.id;
    const nextX = isMovingActivePlot && movingPlotDraftPos ? movingPlotDraftPos.x : activePlotDetails.x;
    const nextY = isMovingActivePlot && movingPlotDraftPos ? movingPlotDraftPos.y : activePlotDetails.y;

    try {
      const updated = await updatePlot({
        plotId: activePlotDetails.id,
        plotNumber: detailPlotNumber.trim(),
        size: detailPlotSize.trim() || undefined,
        status: detailPlotStatus.trim() || "available",
        x: nextX,
        y: nextY,
        metaJson: JSON.stringify({
          plotType: detailPlotType.trim() || "residential",
          isCornerPlot: detailIsCornerPlot,
          isParkFacing: detailIsParkFacing,
        }),
      }).unwrap();
      setActivePlot(updated);
      toast.success("Plot details updated");
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to update plot details");
    }
  };

  const handleCreateSociety = async () => {
    const name = newSocietyName.trim();
    const city = newSocietyCity.trim();
    const state = newSocietyState.trim();
    if (!name || !city || !state) {
      toast.error("Name, city, and state are required.");
      return;
    }
    try {
      const created = await createSociety({ name, city, state }).unwrap();
      setCreateSocietyOpen(false);
      setNewSocietyName("");
      setNewSocietyCity("");
      setNewSocietyState("");
      setSelectedSocietyId(created.id);
      toast.success("Society created");
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to create society");
    }
  };

  const handleBlockImageChange = async (file: File | null) => {
    setNewBlockImageFile(file);
    if (!file) {
      setNewBlockWidthPx(0);
      setNewBlockHeightPx(0);
      return;
    }
    try {
      const dims = await getImageDimensions(file);
      setNewBlockWidthPx(dims.width);
      setNewBlockHeightPx(dims.height);
    } catch {
      toast.error("Could not read image dimensions");
      setNewBlockWidthPx(0);
      setNewBlockHeightPx(0);
    }
  };

  const handleCreateBlock = async () => {
    if (!selectedSocietyId) {
      toast.error("Select a society first.");
      return;
    }
    const name = newBlockName.trim();
    if (!name) {
      toast.error("Block name is required.");
      return;
    }
    if (!newBlockImageFile || newBlockWidthPx <= 0 || newBlockHeightPx <= 0) {
      toast.error("Valid block image is required.");
      return;
    }
    try {
      const created = await createBlock({
        societyId: selectedSocietyId,
        name,
        image: newBlockImageFile,
        widthPx: newBlockWidthPx,
        heightPx: newBlockHeightPx,
      }).unwrap();
      setCreateBlockOpen(false);
      setNewBlockName("");
      setNewBlockImageFile(null);
      setNewBlockWidthPx(0);
      setNewBlockHeightPx(0);
      setSelectedBlockId(created.id);
      toast.success("Block created");
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to create block");
    }
  };

  const handleResetView = () => {
    if (!selectedSocietyId || mapBlocks.length === 0) return;
    const shouldReset = window.confirm("Reset map view to default fit?");
    if (!shouldReset) return;
    toast("View reset to default");
    fitToCanvas(true);
  };

  const handlePendingMarkerDrag = useCallback(
    (blockId: string, stageX: number, stageY: number) => {
      const targetBlock = mapBlocksById.get(blockId);
      if (!targetBlock) return;
      setPendingMark((prev) => {
        if (!prev || prev.blockId !== blockId) return prev;
        return {
          ...prev,
          x: Number((stageX - targetBlock.x).toFixed(2)),
          y: Number((stageY - targetBlock.y).toFixed(2)),
        };
      });
    },
    [mapBlocksById]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/95 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="text-slate-200 hover:text-white hover:bg-white/10 border border-white/10"
          onClick={() => navigate(selectMode ? `/admin/upload${returnEditId ? `?editId=${encodeURIComponent(returnEditId)}` : ""}` : "/")}
        >
          {selectMode ? "Back to Upload" : "Back to Feed"}
        </Button>
        {selectMode && <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">Select a Plot</span>}
        <Input
          value={societySearch}
          onChange={(e) => setSocietySearch(e.target.value)}
          placeholder="Search societies..."
          className="max-w-md bg-slate-900/80 border-white/10 text-slate-100 placeholder:text-slate-400"
        />
        <div className="text-sm text-slate-400">{societiesLoading ? "Searching societies..." : `${societies.length} societies`}</div>

        <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-1">
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => zoomAroundViewportCenter(1.2)}
                    disabled={!selectedSocietyId || mapBlocks.length === 0}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Zoom In</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => zoomAroundViewportCenter(1 / 1.2)}
                    disabled={!selectedSocietyId || mapBlocks.length === 0}
                  >
                    <Minus className="h-4 w-4" />
                    <span className="sr-only">Zoom Out</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleResetView}
                    disabled={!selectedSocietyId || mapBlocks.length === 0}
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="sr-only">Reset View</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Reset View</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isAdminMarkingEnabled && (
            <>
              {!layoutEditMode ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setLayoutDraftOverrides(layoutSavedOverrides);
                          setLayoutEditMode(true);
                          toast("Layout edit mode enabled");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Adjust Layout</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Adjust Layout</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLayoutEditMode(false);
                      setLayoutDraftOverrides({});
                      toast("Layout changes discarded");
                    }}
                  >
                    Cancel Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setLayoutSavedOverrides(layoutDraftOverrides);
                      setLayoutEditMode(false);
                      setLayoutDraftOverrides({});
                      toast.success("Block layout saved");
                    }}
                  >
                    Save Layout
                  </Button>
                </>
              )}
            </>
          )}
          {(activePlotProperty?.videoUrl || (preselectedPlotId && preselectedPlotProperty?.videoUrl)) && (
            <Button size="sm" onClick={() => navigate(`/property/${(activePlotProperty?.id ?? preselectedPlotProperty?.id) as string}`)}>
              View Video
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-w-0">
        {isMobileLayout ? (
          <main className="flex-1 min-w-0 bg-[#050d22] overflow-y-auto">
            <div className="p-3 space-y-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Search Society</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={societySearch}
                    onChange={(e) => setSocietySearch(e.target.value)}
                    placeholder="Search Society (e.g. Bismillah Housing)"
                    className="pl-9 bg-slate-950/80 border-white/10 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Selected Society</div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Change</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {societies.map((society) => (
                    <Button
                      key={society.id}
                      variant={selectedSocietyId === society.id ? "default" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => setSelectedSocietyId(society.id)}
                    >
                      {society.name}
                    </Button>
                  ))}
                </div>
                {!societiesLoading && societies.length === 0 && <div className="text-xs text-slate-400">No societies found.</div>}
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {blocks.map((block) => (
                    <Button
                      key={block.id}
                      variant={selectedBlockId === block.id ? "default" : "outline"}
                      size="sm"
                      className="min-w-24 shrink-0"
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setActivePlot(null);
                        focusOnBlock(block.id, 1.08);
                      }}
                    >
                      {block.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-2">
                {!selectedSocietyId || mapBlocks.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
                    {blocksLoading ? "Loading blocks..." : "No blocks available for this society."}
                  </div>
                ) : (
                  <div className="h-[260px] w-full min-h-0 relative overflow-hidden rounded-lg" ref={containerRef}>
                    <Stage
                      ref={stageRef}
                      width={stageWidth}
                      height={stageHeight}
                      draggable={!movingPlot}
                      onWheel={handleWheel}
                      onClick={handleStageClick}
                      onDragEnd={(e) => {
                        stagePosRef.current = { x: e.target.x(), y: e.target.y() };
                      }}
                    >
                      <Layer>
                        {mapBlocks.map((block) => (
                          <BlockImageInteractive
                            key={block.id}
                            block={block}
                            isLayoutEditMode={layoutEditMode && isAdminMarkingEnabled}
                            allowStageClickThrough={isAdminMarkingEnabled && !layoutEditMode}
                            isSelected={selectedBlockId === block.id}
                            onSelect={() => setSelectedBlockId(block.id)}
                            onDragEnd={(x, y) => {
                              const scale = block.width / block.originalWidth;
                              updateBlockLayoutOverride(block.id, { x, y, scale });
                            }}
                            onTransformEnd={(x, y, width) => {
                              const scale = width / block.originalWidth;
                              updateBlockLayoutOverride(block.id, { x, y, scale });
                            }}
                            attachNodeRef={(node) => {
                              if (selectedBlockId === block.id) selectedBlockNodeRef.current = node;
                            }}
                          />
                        ))}
                      </Layer>
                      <Layer>
                        {mapBlocks.map((block) => (
                          <Text
                            key={`label-${block.id}`}
                            x={block.x + 12}
                            y={block.y + 12}
                            text={block.name}
                            fill="#f8fafc"
                            fontSize={24}
                            fontStyle="bold"
                            stroke="rgba(15,23,42,0.9)"
                            strokeWidth={1.2}
                          />
                        ))}
                      </Layer>
                      <Layer>
                        {mapBlocks.map((block) => (
                          <BlockPlotsLayer
                            key={`plots-${block.id}`}
                            block={block}
                            activePlotId={activePlot?.id ?? null}
                            movingPlotId={movingPlot?.id ?? null}
                            movingDraft={movingPlotDraftPos}
                            isAdmin={isAdminMarkingEnabled}
                            selectMode={selectMode}
                            onSelectPlot={handleSelectPlot}
                            onPublicPlotClick={handlePublicPlotClick}
                            onAdminMovePlotStart={handleAdminMovePlot}
                            onAdminMovePlotDraftChange={handleAdminMovePlotDraftChange}
                            onAdminMovePlotCommit={handleAdminMovePlotCommit}
                          />
                        ))}
                        {isAdminMarkingEnabled && pendingMark && mapBlocksById.has(pendingMark.blockId) && (() => {
                          const block = mapBlocksById.get(pendingMark.blockId)!;
                          return (
                            <Circle
                              x={block.x + pendingMark.x}
                              y={block.y + pendingMark.y}
                              radius={7}
                              fill="#22c55e"
                              stroke="#fff"
                              strokeWidth={1.8}
                              draggable
                              onClick={(e) => {
                                e.cancelBubble = true;
                              }}
                              onDragMove={(e) => {
                                handlePendingMarkerDrag(pendingMark.blockId, e.target.x(), e.target.y());
                              }}
                              onDragEnd={(e) => {
                                handlePendingMarkerDrag(pendingMark.blockId, e.target.x(), e.target.y());
                              }}
                            />
                          );
                        })()}
                      </Layer>
                    </Stage>
                    <div className="absolute right-2 top-2 flex flex-col gap-2">
                      <Button size="icon" variant="outline" className="h-9 w-9 bg-slate-950/90" onClick={() => zoomAroundViewportCenter(1.2)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-9 w-9 bg-slate-950/90" onClick={() => zoomAroundViewportCenter(1 / 1.2)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-9 w-9 bg-slate-950/90" onClick={handleResetView}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Quick Plot Lookup</div>
                <div className="flex gap-2">
                  <Input
                    value={plotSearchInput}
                    onChange={(e) => setPlotSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitPlotSearch();
                    }}
                    placeholder="Plot #"
                    className="bg-slate-950/80 border-white/10 text-slate-100 placeholder:text-slate-500"
                  />
                  <Button onClick={handleSubmitPlotSearch} disabled={!selectedSocietyId}>
                    Find Plot
                  </Button>
                </div>
              </div>

              {isAdminMarkingEnabled && isPlotDetailOpen && activePlotDetails && (
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Plot Details</div>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsPlotDetailOpen(false)}>
                      Close
                    </Button>
                  </div>
                  <div className="text-sm text-slate-200">Plot {activePlotDetails.plotNumber}</div>
                  {movingPlot?.id === activePlotDetails.id && (
                    <div className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">
                      Move active
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="mobile-detail-plot-number-v2">Plot Number</Label>
                    <Input id="mobile-detail-plot-number-v2" value={detailPlotNumber} onChange={(e) => setDetailPlotNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mobile-detail-plot-size-v2">Plot Size</Label>
                    <Input id="mobile-detail-plot-size-v2" value={detailPlotSize} onChange={(e) => setDetailPlotSize(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Plot Type</Label>
                    <Select value={detailPlotType} onValueChange={setDetailPlotType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plot type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLOT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mobile-detail-corner-v2"
                      checked={detailIsCornerPlot}
                      onCheckedChange={(checked) => setDetailIsCornerPlot(checked === true)}
                    />
                    <Label htmlFor="mobile-detail-corner-v2">Corner plot</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mobile-detail-park-v2"
                      checked={detailIsParkFacing}
                      onCheckedChange={(checked) => setDetailIsParkFacing(checked === true)}
                    />
                    <Label htmlFor="mobile-detail-park-v2">Park facing</Label>
                  </div>
                  <div className="space-y-1">
                    <Label>Plot Status</Label>
                    <Select value={detailPlotStatus} onValueChange={setDetailPlotStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plot status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLOT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSavePlotDetails} disabled={!detailPlotNumber.trim() || isUpdatingPlot}>
                      {isUpdatingPlot ? "Saving..." : "Save Details"}
                    </Button>
                    {movingPlot?.id === activePlotDetails.id && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMovingPlot(null);
                          setMovingPlotDraftPos(null);
                        }}
                        disabled={isUpdatingPlot}
                      >
                        Cancel Move
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-100">Inventory in {selectedBlock?.name ?? "Block"}</h3>
                  <span className="rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-[11px] tracking-wide text-slate-300">
                    {mobileInventoryPlots.filter((plot) => plot.status === "available").length} AVAILABLE
                  </span>
                </div>
                {mobileInventoryPlots.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                    No plots found for selected block.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mobileInventoryPlots.map((plot) => (
                      <Button
                        key={plot.id}
                        variant="outline"
                        className="h-auto justify-start rounded-xl border-white/10 bg-slate-900/50 p-3 text-left"
                        disabled={!selectedSociety || !selectedBlock}
                        onClick={() =>
                          selectedSociety &&
                          selectedBlock &&
                          handleJumpToSearchResult({
                            society: selectedSociety,
                            block: selectedBlock,
                            plot,
                          })
                        }
                      >
                        <div className="w-full space-y-1">
                          <div className="text-lg font-semibold text-slate-100">Plot {plot.plotNumber}</div>
                          <div className="text-xs text-slate-300">{plot.size ? `Area: ${plot.size}` : "Area: N/A"}</div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                            {plot.status}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>
        ) : (
        <>
        <aside className="w-80 max-w-[22rem] shrink-0 border-r border-white/10 bg-slate-950/90 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current Society</div>
                {isAdminMarkingEnabled && (
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setCreateSocietyOpen(true)}>
                    Add Society
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {societies.map((society) => (
                  <Button
                    key={society.id}
                    variant={selectedSocietyId === society.id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedSocietyId(society.id)}
                  >
                    {society.name}
                  </Button>
                ))}
                {!societiesLoading && societies.length === 0 && <div className="text-sm text-muted-foreground">No societies found.</div>}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Blocks Inventory</div>
                {isAdminMarkingEnabled && (
                  <Button size="sm" variant="outline" className="h-7" disabled={!selectedSocietyId} onClick={() => setCreateBlockOpen(true)}>
                    Add Block
                  </Button>
                )}
              </div>
              {blocksLoading ? (
                <div className="text-sm text-slate-400">Loading blocks...</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {blocks.map((block) => (
                    <Button
                      key={block.id}
                      variant={selectedBlockId === block.id ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setActivePlot(null);
                        focusOnBlock(block.id, 1.08);
                      }}
                    >
                      {block.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Quick Plot Search</div>
              <div className="flex gap-2">
                <Input
                  value={plotSearchInput}
                  onChange={(e) => setPlotSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitPlotSearch();
                  }}
                  placeholder="Enter plot #"
                  className="bg-slate-950/80 border-white/10 text-slate-100 placeholder:text-slate-500"
                />
                <Button onClick={handleSubmitPlotSearch} disabled={!selectedSocietyId}>
                  Find Plot
                </Button>
              </div>
              {plotSearchInput.trim().length > 0 && (
                <div className="rounded-md border border-white/10 bg-slate-950/70 p-2 space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Autocomplete</div>
                  {liveSearchLoading ? (
                    <div className="text-xs text-slate-400">Searching suggestions...</div>
                  ) : liveSearchSuggestions.length > 0 ? (
                    liveSearchSuggestions.slice(0, 6).map((result) => (
                      <Button
                        key={result.plot.id}
                        variant="ghost"
                        className="h-8 w-full justify-start px-2 text-xs text-slate-200 hover:bg-white/10"
                        onClick={() => handleJumpToSearchResult(result)}
                      >
                        Plot {result.plot.plotNumber} • {result.block.name}
                      </Button>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No suggestions</div>
                  )}
                </div>
              )}
              {submittedPlotSearch && (
                <div className="text-xs text-slate-400">
                  {searchLoading ? "Searching..." : searchResults.length > 0 ? `Found ${searchResults.length} matches` : "No matching plot found"}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Available Plots In Block</div>
              {!selectedBlockId ? (
                <div className="text-sm text-slate-400">Select a block to view available plots.</div>
              ) : availablePlotsInSelectedBlock.length === 0 ? (
                <div className="text-sm text-slate-400">No available plots found in this block.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availablePlotsInSelectedBlock.map((plot) => (
                    <Button
                      key={plot.id}
                      size="sm"
                      variant="outline"
                      className="justify-start"
                      disabled={!selectedSociety || !selectedBlock}
                      onClick={() =>
                        selectedSociety && selectedBlock &&
                        handleJumpToSearchResult({
                          society: selectedSociety,
                          block: selectedBlock,
                          plot,
                        })
                      }
                    >
                      Plot {plot.plotNumber}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {isAdminMarkingEnabled && !movingPlot && (
              <div className="text-xs text-slate-400 border-t border-white/10 pt-3">Admin: click any map area to add new marker.</div>
            )}
            {isAdminMarkingEnabled && movingPlot && (
              <div className="text-xs text-slate-400 border-t border-white/10 pt-3 space-y-2">
                <p>
                  Move mode active for <span className="font-semibold text-white">Plot {movingPlot.plotNumber}</span>.
                </p>
                <Button size="sm" variant="outline" onClick={() => { setMovingPlot(null); setMovingPlotDraftPos(null); }} disabled={isUpdatingPlot}>
                  Cancel move
                </Button>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 relative bg-slate-950 overflow-hidden">
          {!selectedSocietyId || mapBlocks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {blocksLoading ? "Loading blocks..." : "No blocks available for this society."}
            </div>
          ) : (
            <div className="h-full w-full min-h-0" ref={containerRef}>
              <Stage
                ref={stageRef}
                width={stageWidth}
                height={stageHeight}
                draggable={!movingPlot}
                onWheel={handleWheel}
                onClick={handleStageClick}
                onDragEnd={(e) => {
                  stagePosRef.current = { x: e.target.x(), y: e.target.y() };
                }}
              >
                <Layer>
                  {mapBlocks.map((block) => (
                    <BlockImageInteractive
                      key={block.id}
                      block={block}
                      isLayoutEditMode={layoutEditMode && isAdminMarkingEnabled}
                      allowStageClickThrough={isAdminMarkingEnabled && !layoutEditMode}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onDragEnd={(x, y) => {
                        const scale = block.width / block.originalWidth;
                        updateBlockLayoutOverride(block.id, { x, y, scale });
                      }}
                      onTransformEnd={(x, y, width) => {
                        const scale = width / block.originalWidth;
                        updateBlockLayoutOverride(block.id, { x, y, scale });
                      }}
                      attachNodeRef={(node) => {
                        if (selectedBlockId === block.id) selectedBlockNodeRef.current = node;
                      }}
                    />
                  ))}
                </Layer>

                <Layer>
                  {mapBlocks.map((block) => (
                    <Text
                      key={`label-${block.id}`}
                      x={block.x + 12}
                      y={block.y + 12}
                      text={block.name}
                      fill="#f8fafc"
                      fontSize={26}
                      fontStyle="bold"
                      stroke="rgba(15,23,42,0.9)"
                      strokeWidth={1.2}
                    />
                  ))}
                </Layer>

                <Layer>
                  {mapBlocks.map((block) => (
                    <BlockPlotsLayer
                      key={`plots-${block.id}`}
                      block={block}
                      activePlotId={activePlot?.id ?? null}
                      movingPlotId={movingPlot?.id ?? null}
                      movingDraft={movingPlotDraftPos}
                      isAdmin={isAdminMarkingEnabled}
                      selectMode={selectMode}
                      onSelectPlot={handleSelectPlot}
                      onPublicPlotClick={handlePublicPlotClick}
                      onAdminMovePlotStart={handleAdminMovePlot}
                      onAdminMovePlotDraftChange={handleAdminMovePlotDraftChange}
                      onAdminMovePlotCommit={handleAdminMovePlotCommit}
                    />
                  ))}
                  {isAdminMarkingEnabled && pendingMark && mapBlocksById.has(pendingMark.blockId) && (() => {
                    const block = mapBlocksById.get(pendingMark.blockId)!;
                    return (
                      <Circle
                        x={block.x + pendingMark.x}
                        y={block.y + pendingMark.y}
                        radius={7}
                        fill="#22c55e"
                        stroke="#fff"
                        strokeWidth={1.8}
                        draggable
                        onClick={(e) => {
                          e.cancelBubble = true;
                        }}
                        onDragMove={(e) => {
                          handlePendingMarkerDrag(pendingMark.blockId, e.target.x(), e.target.y());
                        }}
                        onDragEnd={(e) => {
                          handlePendingMarkerDrag(pendingMark.blockId, e.target.x(), e.target.y());
                        }}
                      />
                    );
                  })()}
                </Layer>
                {isAdminMarkingEnabled && layoutEditMode && (
                  <Layer>
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled={false}
                      keepRatio
                      enabledAnchors={[
                        "top-left",
                        "top-right",
                        "bottom-left",
                        "bottom-right",
                        "middle-left",
                        "middle-right",
                        "top-center",
                        "bottom-center",
                      ]}
                      boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 50 || newBox.height < 50) return oldBox;
                        return newBox;
                      }}
                    />
                  </Layer>
                )}
              </Stage>
              {isAdminMarkingEnabled && isPlotDetailOpen && activePlotDetails && (
                <aside className="absolute right-3 top-3 z-10 w-[22rem] max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Plot Detail Drawer</div>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsPlotDetailOpen(false)}>
                      Close
                    </Button>
                  </div>
                  <div className="text-sm text-slate-200">Plot {activePlotDetails.plotNumber}</div>
                  {movingPlot?.id === activePlotDetails.id && (
                    <div className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">
                      Move active - drag marker on map
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="detail-plot-number-v2">Plot Number</Label>
                    <Input id="detail-plot-number-v2" value={detailPlotNumber} onChange={(e) => setDetailPlotNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="detail-plot-size-v2">Plot Size</Label>
                    <Input id="detail-plot-size-v2" value={detailPlotSize} onChange={(e) => setDetailPlotSize(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Plot Type</Label>
                    <Select value={detailPlotType} onValueChange={setDetailPlotType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plot type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLOT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="detail-corner-v2"
                      checked={detailIsCornerPlot}
                      onCheckedChange={(checked) => setDetailIsCornerPlot(checked === true)}
                    />
                    <Label htmlFor="detail-corner-v2">Corner plot</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="detail-park-v2"
                      checked={detailIsParkFacing}
                      onCheckedChange={(checked) => setDetailIsParkFacing(checked === true)}
                    />
                    <Label htmlFor="detail-park-v2">Park facing</Label>
                  </div>
                  <div className="space-y-1">
                    <Label>Plot Status</Label>
                    <Select value={detailPlotStatus} onValueChange={setDetailPlotStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plot status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLOT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      X: {Number((movingPlot?.id === activePlotDetails.id && movingPlotDraftPos ? movingPlotDraftPos.x : activePlotDetails.x).toFixed(2))}
                    </div>
                    <div>
                      Y: {Number((movingPlot?.id === activePlotDetails.id && movingPlotDraftPos ? movingPlotDraftPos.y : activePlotDetails.y).toFixed(2))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSavePlotDetails} disabled={!detailPlotNumber.trim() || isUpdatingPlot}>
                      {isUpdatingPlot ? "Saving..." : "Save Details"}
                    </Button>
                    {movingPlot?.id === activePlotDetails.id && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMovingPlot(null);
                          setMovingPlotDraftPos(null);
                        }}
                        disabled={isUpdatingPlot}
                      >
                        Cancel Move
                      </Button>
                    )}
                  </div>
                </aside>
              )}
            </div>
          )}
        </main>
        </>
        )}
      </div>

      <Dialog open={createSocietyOpen} onOpenChange={setCreateSocietyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Society</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-society-name-v2">Society Name</Label>
              <Input id="new-society-name-v2" value={newSocietyName} onChange={(e) => setNewSocietyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-society-city-v2">City</Label>
              <Input id="new-society-city-v2" value={newSocietyCity} onChange={(e) => setNewSocietyCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-society-state-v2">State</Label>
              <Input id="new-society-state-v2" value={newSocietyState} onChange={(e) => setNewSocietyState(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSocietyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSociety} disabled={isCreatingSociety}>
              {isCreatingSociety ? "Creating..." : "Create Society"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createBlockOpen} onOpenChange={setCreateBlockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-block-name-v2">Block Name</Label>
              <Input id="new-block-name-v2" value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-block-image-v2">Block Image</Label>
              <Input
                id="new-block-image-v2"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => handleBlockImageChange(e.target.files?.[0] ?? null)}
              />
              {newBlockImageFile && newBlockWidthPx > 0 && newBlockHeightPx > 0 && (
                <div className="text-xs text-muted-foreground">
                  Detected size: {newBlockWidthPx} x {newBlockHeightPx}px
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBlock} disabled={isCreatingBlock}>
              {isCreatingBlock ? "Creating..." : "Create Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark New Plot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground">
              Coordinates: x={pendingMark?.x}, y={pendingMark?.y}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plot-number-v2">Plot Number *</Label>
              <Input
                id="plot-number-v2"
                value={markPlotNumber}
                onChange={(e) => setMarkPlotNumber(e.target.value)}
                placeholder="e.g. 123"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePlot();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plot-size-v2">Size (optional)</Label>
              <Input id="plot-size-v2" value={markPlotSize} onChange={(e) => setMarkPlotSize(e.target.value)} placeholder="e.g. 5 Marla" />
            </div>
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <Select value={markPlotType} onValueChange={setMarkPlotType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plot type" />
                </SelectTrigger>
                <SelectContent>
                  {PLOT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="plot-corner-v2"
                checked={markIsCornerPlot}
                onCheckedChange={(checked) => setMarkIsCornerPlot(checked === true)}
              />
              <Label htmlFor="plot-corner-v2">Corner plot</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="plot-park-v2"
                checked={markIsParkFacing}
                onCheckedChange={(checked) => setMarkIsParkFacing(checked === true)}
              />
              <Label htmlFor="plot-park-v2">Park facing</Label>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={markPlotStatus} onValueChange={setMarkPlotStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plot status" />
                </SelectTrigger>
                <SelectContent>
                  {PLOT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePlot} disabled={!markPlotNumber.trim() || isCreatingPlot}>
              {isCreatingPlot ? "Saving..." : "Save Plot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockImageInteractive({
  block,
  isLayoutEditMode,
  allowStageClickThrough,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  attachNodeRef,
}: {
  block: MapBlock;
  isLayoutEditMode: boolean;
  allowStageClickThrough: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (x: number, y: number, width: number) => void;
  attachNodeRef: (node: any) => void;
}) {
  const [image] = useImage(block.image);

  return (
    <KonvaImage
      ref={(node) => {
        if (!node) return;
        attachNodeRef(node);
      }}
      image={image ?? undefined}
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
      draggable={isLayoutEditMode}
      stroke={isSelected ? "#ef4444" : undefined}
      strokeWidth={isSelected ? 2 : 0}
      onClick={(e) => {
        e.cancelBubble = !allowStageClickThrough;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = !allowStageClickThrough;
        onSelect();
      }}
      onDragEnd={(e) => {
        onDragEnd(e.target.x(), e.target.y());
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const nextWidth = Math.max(1, node.width() * scaleX);
        const ratio = block.originalHeight / block.originalWidth;
        const nextHeight = Math.max(1, nextWidth * ratio);
        node.scaleX(1);
        node.scaleY(1);
        node.width(nextWidth);
        node.height(nextHeight);
        onTransformEnd(node.x(), node.y(), nextWidth);
      }}
    />
  );
}
