import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

function toImageKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeImagePath(imagePath: string) {
  const value = String(imagePath ?? "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to read image dimensions"));
      img.src = objectUrl;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type ViewBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type PositionedBlock = {
  block: PlotFinderBlock;
  blockKey: string;
  offsetX: number;
  offsetY: number;
  displayScale: number;
  displayWidth: number;
  displayHeight: number;
};

type BlockLayoutOverride = {
  x: number;
  y: number;
  scale?: number;
};

// Tune these values to manually place each block like puzzle pieces.
const BLOCK_LAYOUT_OVERRIDES: Record<string, BlockLayoutOverride> = {
  ablock: { x: 420, y: 330 },
  bblock: { x: 2200, y: 300 },
  cblock: { x: 850, y: -2000 },
  abubakarblock: { x: 3900, y: -3000 },
  hussainblock: { x: 1721, y: 5000 },
  haiderblock: { x: 6500, y: -300 },
};
const PLOT_FINDER_LAYOUT_STORAGE_KEY = "plot-finder-layout-overrides-v1";
const GLOBAL_BLOCK_SCALE = 0.2;

export default function PlotFinderPage() {
  const [, navigate] = useLocation();
  const queryParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const selectMode = queryParams?.get("mode") === "select";
  const preselectedSocietyId = queryParams?.get("societyId");
  const preselectedPlotId = queryParams?.get("plotId");
  const returnEditId = queryParams?.get("editId");

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isAdminMarkingEnabled = isAdmin && !selectMode;

  const { data: preselectedPlotData } = useGetPlotByIdQuery(
    { plotId: preselectedPlotId as string },
    { skip: !preselectedPlotId }
  );
  const { data: preselectedPlotProperty } = useGetPlotPropertyByPlotIdQuery(
    { plotId: preselectedPlotId as string },
    { skip: !preselectedPlotId }
  );

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef | null>(null);

  const [societySearch, setSocietySearch] = useState("");
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [plotSearchInput, setPlotSearchInput] = useState("");
  const [submittedPlotSearch, setSubmittedPlotSearch] = useState("");
  const [activePlot, setActivePlot] = useState<PlotFinderSearchResult["plot"] | null>(null);
  const { data: activePlotProperty } = useGetPlotPropertyByPlotIdQuery(
    { plotId: activePlot?.id as string },
    { skip: !activePlot?.id }
  );
  const [pendingJumpPlot, setPendingJumpPlot] = useState<PlotFinderSearchResult["plot"] | null>(null);
  const [didJumpToPreselectedPlot, setDidJumpToPreselectedPlot] = useState(false);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);

  // Admin click-to-mark state
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [pendingMark, setPendingMark] = useState<{ blockId: string; x: number; y: number } | null>(null);
  const [markPlotNumber, setMarkPlotNumber] = useState("");
  const [markPlotSize, setMarkPlotSize] = useState("");

  const [createPlot, { isLoading: isCreatingPlot }] = useCreatePlotMutation();
  const [updatePlot, { isLoading: isUpdatingPlot }] = useUpdatePlotMutation();
  const [movingPlot, setMovingPlot] = useState<PlotFinderPlot | null>(null);
  const [movingPlotDraftPos, setMovingPlotDraftPos] = useState<{ x: number; y: number } | null>(null);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [layoutSavedOverrides, setLayoutSavedOverrides] = useState<Record<string, BlockLayoutOverride>>({});
  const [layoutDraftOverrides, setLayoutDraftOverrides] = useState<Record<string, BlockLayoutOverride>>({});
  const [manualOffsetX, setManualOffsetX] = useState<string>("");
  const [manualOffsetY, setManualOffsetY] = useState<string>("");
  const [manualScale, setManualScale] = useState<string>("");
  const [createSocietyOpen, setCreateSocietyOpen] = useState(false);
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [newSocietyName, setNewSocietyName] = useState("");
  const [newSocietyCity, setNewSocietyCity] = useState("");
  const [newSocietyState, setNewSocietyState] = useState("");
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockImageFile, setNewBlockImageFile] = useState<File | null>(null);
  const [newBlockWidthPx, setNewBlockWidthPx] = useState<number>(0);
  const [newBlockHeightPx, setNewBlockHeightPx] = useState<number>(0);

  const [triggerPlotPropertyByPlotId] = useLazyGetPlotPropertyByPlotIdQuery();
  const [createSociety, { isLoading: isCreatingSociety }] = useCreatePlotFinderSocietyMutation();
  const [createBlock, { isLoading: isCreatingBlock }] = useCreatePlotFinderBlockMutation();

  const { data: societies = [], isFetching: societiesLoading } = useGetPlotFinderSocietiesQuery({
    search: societySearch || undefined,
  });

  const { data: blocks = [], isFetching: blocksLoading } = useGetPlotFinderBlocksQuery(
    { societyId: selectedSocietyId as string },
    { skip: !selectedSocietyId }
  );

  const { data: searchResults = [], isFetching: searchLoading } = useSearchPlotFinderPlotsQuery(
    { query: submittedPlotSearch, societyId: selectedSocietyId ?? undefined },
    { skip: submittedPlotSearch.trim().length === 0 || !selectedSocietyId }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PLOT_FINDER_LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, BlockLayoutOverride>;
      if (!parsed || typeof parsed !== "object") return;
      setLayoutSavedOverrides(parsed);
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLOT_FINDER_LAYOUT_STORAGE_KEY, JSON.stringify(layoutSavedOverrides));
  }, [layoutSavedOverrides]);

  const effectiveLayoutOverrides = useMemo(
    () =>
      layoutEditMode
        ? {
            ...BLOCK_LAYOUT_OVERRIDES,
            ...layoutDraftOverrides,
          }
        : {
            ...BLOCK_LAYOUT_OVERRIDES,
            ...layoutSavedOverrides,
          },
    [layoutDraftOverrides, layoutEditMode, layoutSavedOverrides]
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
    if (blocks.length === 0) {
      setSelectedBlockId(null);
      return;
    }
    const exists = blocks.some((block) => block.id === selectedBlockId);
    if (!selectedBlockId || !exists) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId, selectedSocietyId]);

  useEffect(() => {
    setFocusBlockId(null);
    setActivePlot(null);
    // If we came from a deep-link like `?plotId=...`, we don't want to clear the pending jump.
    if (!preselectedPlotId) setPendingJumpPlot(null);
    setSubmittedPlotSearch("");
    setPlotSearchInput("");
    setMovingPlot(null);
    setMovingPlotDraftPos(null);
  }, [selectedSocietyId]);

  useEffect(() => {
    if (!preselectedPlotData) return;
    setSelectedSocietyId(preselectedPlotData.society.id);
    setSelectedBlockId(preselectedPlotData.block.id);
    setPendingJumpPlot(preselectedPlotData.plot);
    setActivePlot(preselectedPlotData.plot);
    setDidJumpToPreselectedPlot(false);
  }, [preselectedPlotData]);

  const blockLayout = useMemo(() => {
    const safeBlocks = blocks.filter((block) => block.widthPx > 0 && block.heightPx > 0);
    if (safeBlocks.length === 0) {
      return {
        positionedBlocks: [] as PositionedBlock[],
        positionedById: new Map<string, PositionedBlock>(),
        canvasWidth: 0,
        canvasHeight: 0,
      };
    }

    const scaledBlocks = safeBlocks.map((block) => {
      const blockKey = toImageKey(block.name);
      const override = effectiveLayoutOverrides[blockKey];
      const displayScale = Math.max(0.06, Math.min(1, override?.scale ?? GLOBAL_BLOCK_SCALE));
      return {
        block,
        blockKey,
        override,
        displayScale,
        displayWidth: Math.max(1, Math.round(block.widthPx * displayScale)),
        displayHeight: Math.max(1, Math.round(block.heightPx * displayScale)),
      };
    });

    const columnCount = scaledBlocks.length > 2 ? 3 : scaledBlocks.length > 1 ? 2 : 1;
    const rowCount = Math.ceil(safeBlocks.length / columnCount);
    const gap = 42;

    const columnWidths = Array.from({ length: columnCount }, () => 0);
    const rowHeights = Array.from({ length: rowCount }, () => 0);

    scaledBlocks.forEach(({ displayWidth, displayHeight }, index) => {
      const colIndex = index % columnCount;
      const rowIndex = Math.floor(index / columnCount);
      columnWidths[colIndex] = Math.max(columnWidths[colIndex], displayWidth);
      rowHeights[rowIndex] = Math.max(rowHeights[rowIndex], displayHeight);
    });

    const columnOffsets: number[] = [];
    let runningX = 0;
    for (let index = 0; index < columnCount; index += 1) {
      columnOffsets.push(runningX);
      runningX += columnWidths[index] + gap;
    }

    const rowOffsets: number[] = [];
    let runningY = 0;
    for (let index = 0; index < rowCount; index += 1) {
      rowOffsets.push(runningY);
      runningY += rowHeights[index] + gap;
    }

    const positionedBlocksRaw = scaledBlocks.map(
      ({ block, blockKey, override, displayScale, displayWidth, displayHeight }, index) => {
      const colIndex = index % columnCount;
      const rowIndex = Math.floor(index / columnCount);
      return {
        block,
        blockKey,
        offsetX: override?.x ?? columnOffsets[colIndex],
        offsetY: override?.y ?? rowOffsets[rowIndex],
        displayScale,
        displayWidth,
        displayHeight,
      };
      }
    );

    const minOffsetX = Math.min(...positionedBlocksRaw.map((block) => block.offsetX));
    const minOffsetY = Math.min(...positionedBlocksRaw.map((block) => block.offsetY));
    const normalizedOffsetX = minOffsetX < 0 ? -minOffsetX : 0;
    const normalizedOffsetY = minOffsetY < 0 ? -minOffsetY : 0;

    const positionedBlocks = positionedBlocksRaw.map((item) => ({
      ...item,
      offsetX: item.offsetX + normalizedOffsetX,
      offsetY: item.offsetY + normalizedOffsetY,
    }));

    const positionedById = new Map(positionedBlocks.map((item) => [item.block.id, item]));
    const canvasWidth = Math.max(...positionedBlocks.map((block) => block.offsetX + block.displayWidth));
    const canvasHeight = Math.max(...positionedBlocks.map((block) => block.offsetY + block.displayHeight));

    return { positionedBlocks, positionedById, canvasWidth, canvasHeight };
  }, [blocks, effectiveLayoutOverrides]);

  const selectedBlockForManual = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );
  const selectedBlockKeyForManual = selectedBlockForManual ? toImageKey(selectedBlockForManual.name) : null;
  const selectedBlockManualOverride = selectedBlockKeyForManual
    ? effectiveLayoutOverrides[selectedBlockKeyForManual]
    : undefined;

  useEffect(() => {
    if (!selectedBlockManualOverride) {
      setManualOffsetX("");
      setManualOffsetY("");
      setManualScale("");
      return;
    }
    setManualOffsetX(String(selectedBlockManualOverride.x ?? 0));
    setManualOffsetY(String(selectedBlockManualOverride.y ?? 0));
    setManualScale(String(selectedBlockManualOverride.scale ?? GLOBAL_BLOCK_SCALE));
  }, [
    selectedBlockForManual?.id,
    selectedBlockManualOverride?.x,
    selectedBlockManualOverride?.y,
    selectedBlockManualOverride?.scale,
  ]);

  useEffect(() => {
    if (!preselectedPlotData || didJumpToPreselectedPlot) return;
    const didJump = jumpToPlot(preselectedPlotData.plot, 2.4);
    if (!didJump) return;
    setDidJumpToPreselectedPlot(true);
    setPendingJumpPlot(null);
  }, [preselectedPlotData, didJumpToPreselectedPlot, blockLayout.positionedById]);

  function setViewToBounds(bounds: ViewBounds, scaleMultiplier: number, animationMs: number) {
    const wrapper = viewerRef.current;
    const controls = zoomRef.current;
    if (!wrapper || !controls) return;

    const viewportWidth = wrapper.clientWidth;
    const viewportHeight = wrapper.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) return;

    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const fitScale = Math.min(viewportWidth / width, viewportHeight / height);
    const nextScale = Number.isFinite(fitScale) && fitScale > 0 ? Math.max(0.05, Math.min(fitScale * scaleMultiplier, 8)) : 1;

    const usedWidth = width * nextScale;
    const usedHeight = height * nextScale;
    const centerPadX = (viewportWidth - usedWidth) / 2;
    const centerPadY = (viewportHeight - usedHeight) / 2;
    const offsetX = -bounds.minX * nextScale + centerPadX;
    const offsetY = -bounds.minY * nextScale + centerPadY;
    controls.setTransform(offsetX, offsetY, nextScale, animationMs);
  }

  useEffect(() => {
    if (blockLayout.canvasWidth <= 0 || blockLayout.canvasHeight <= 0) return;
    setViewToBounds(
      {
        minX: 0,
        minY: 0,
        maxX: blockLayout.canvasWidth,
        maxY: blockLayout.canvasHeight,
      },
      0.92,
      150
    );
  }, [blockLayout.canvasHeight, blockLayout.canvasWidth, selectedSocietyId]);

  useEffect(() => {
    if (!focusBlockId) return;
    const target = blockLayout.positionedById.get(focusBlockId);
    if (!target) return;

    setViewToBounds(
      {
        minX: target.offsetX,
        minY: target.offsetY,
        maxX: target.offsetX + target.displayWidth,
        maxY: target.offsetY + target.displayHeight,
      },
      1.1,
      250
    );
    setFocusBlockId(null);
  }, [blockLayout.positionedById, focusBlockId]);

  function jumpToPlot(plot: PlotFinderSearchResult["plot"], zoomScale: number): boolean {
    const target = blockLayout.positionedById.get(plot.blockId);
    const wrapper = viewerRef.current;
    const controls = zoomRef.current;
    if (!target || !wrapper || !controls) return false;

    const viewportWidth = wrapper.clientWidth;
    const viewportHeight = wrapper.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) return false;

    const globalX = target.offsetX + plot.x * target.displayScale;
    const globalY = target.offsetY + plot.y * target.displayScale;
    const positionX = viewportWidth / 2 - globalX * zoomScale;
    const positionY = viewportHeight / 2 - globalY * zoomScale;
    controls.setTransform(positionX, positionY, zoomScale, 250);
    setActivePlot(plot);
    return true;
  }

  useEffect(() => {
    if (!pendingJumpPlot) return;
    const didJump = jumpToPlot(pendingJumpPlot, 2.4);
    if (didJump) setPendingJumpPlot(null);
  }, [pendingJumpPlot, blockLayout.positionedById]);

  useEffect(() => {
    if (!submittedPlotSearch || searchResults.length === 0) return;
    const first = searchResults[0];
    setSelectedBlockId(first.block.id);
    setPendingJumpPlot(first.plot);
  }, [searchResults, submittedPlotSearch]);

  useEffect(() => {
    if (typeof window === "undefined" || !activePlot?.id) return;
    const params = new URLSearchParams(window.location.search);
    params.set("plotId", activePlot.id);
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [activePlot?.id]);

  const handleSubmitPlotSearch = () => {
    setSubmittedPlotSearch(plotSearchInput.trim());
  };

  const handleBlockImageClick = useCallback(
    async (blockId: string, plotX: number, plotY: number) => {
      // #region agent log
      fetch("http://127.0.0.1:7809/ingest/bc9db7d1-6c73-48aa-b2bb-085440f8b23f", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e17c0" },
        body: JSON.stringify({
          sessionId: "8e17c0",
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "client/src/pages/PlotFinder.tsx:handleBlockImageClick:entry",
          message: "handleBlockImageClick entry",
          data: { blockId, plotX, plotY, isAdminMarkingEnabled, hasMovingPlot: Boolean(movingPlot) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (!isAdminMarkingEnabled) return;

      if (movingPlot) {
        if (blockId !== movingPlot.blockId) {
          toast.error("You can only move a marker within its block.");
          return;
        }
        try {
          await updatePlot({ plotId: movingPlot.id, x: plotX, y: plotY }).unwrap();
          toast.success(`Plot ${movingPlot.plotNumber} moved`);
          setMovingPlot(null);
          setMovingPlotDraftPos(null);
        } catch (err: any) {
          toast.error(err?.data?.error || "Failed to move plot marker");
        }
        return;
      }

      setPendingMark({ blockId, x: plotX, y: plotY });
      setMarkPlotNumber("");
      setMarkPlotSize("");
      setMarkDialogOpen(true);
      // #region agent log
      fetch("http://127.0.0.1:7809/ingest/bc9db7d1-6c73-48aa-b2bb-085440f8b23f", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e17c0" },
        body: JSON.stringify({
          sessionId: "8e17c0",
          runId: "pre-fix",
          hypothesisId: "H4",
          location: "client/src/pages/PlotFinder.tsx:handleBlockImageClick:openDialog",
          message: "mark dialog requested",
          data: { blockId, plotX, plotY },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    },
    [isAdminMarkingEnabled, movingPlot, updatePlot]
  );

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7809/ingest/bc9db7d1-6c73-48aa-b2bb-085440f8b23f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e17c0" },
      body: JSON.stringify({
        sessionId: "8e17c0",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "client/src/pages/PlotFinder.tsx:markDialogOpen:effect",
        message: "markDialogOpen changed",
        data: { markDialogOpen, hasPendingMark: Boolean(pendingMark), pendingMarkBlockId: pendingMark?.blockId ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [markDialogOpen, pendingMark]);

  const handleSavePlot = async () => {
    if (!pendingMark || !markPlotNumber.trim()) return;
    try {
      const created = await createPlot({
        blockId: pendingMark.blockId,
        plotNumber: markPlotNumber.trim(),
        x: pendingMark.x,
        y: pendingMark.y,
        size: markPlotSize.trim() || undefined,
      }).unwrap();
      toast.success(`Plot ${created.plotNumber} created`);
      setMarkDialogOpen(false);
      setPendingMark(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to create plot");
    }
  };

  const handleSelectPlot = (plotId: string) => {
    const params = new URLSearchParams({ plotId });
    if (returnEditId) {
      params.set("editId", returnEditId);
    }
    navigate(`/admin/upload?${params.toString()}`);
  };

  const handleAdminMovePlot = async (plot: PlotFinderPlot): Promise<boolean> => {
    // If the plot is already linked to a listing with video, it becomes read-only.
    try {
      const property = await triggerPlotPropertyByPlotId({ plotId: plot.id }).unwrap();
      if (property?.videoUrl) {
        toast.error("This plot already has a video listing, so it is read-only.");
        return false;
      }
    } catch {
      // If the check fails (network, etc.), don't block admin movement.
    }

    setMovingPlot(plot);
    setMovingPlotDraftPos({ x: plot.x, y: plot.y });
    toast(`Move mode: reposition plot ${plot.plotNumber} on the block image.`);
    return true;
  };

  const handlePublicPlotClick = async (plot: PlotFinderPlot) => {
    try {
      const property = await triggerPlotPropertyByPlotId({ plotId: plot.id }).unwrap();
      if (property?.videoUrl) {
        navigate(`/property/${property.id}`);
        return;
      }
      toast.error("No video attached to this plot yet.");
    } catch {
      toast.error("Failed to load plot video.");
    }
  };

  const handleAdminMovePlotDraftChange = (plotId: string, x: number, y: number) => {
    // Allow updates during dragging even if state hasn't caught up yet.
    if (movingPlot && plotId !== movingPlot.id) return;
    setMovingPlotDraftPos({ x, y });
  };

  const handleAdminMovePlotCommit = async (plotId: string, x: number, y: number) => {
    try {
      await updatePlot({ plotId, x, y }).unwrap();
      toast.success("Plot marker moved");
      setMovingPlot(null);
      setMovingPlotDraftPos(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to move plot marker");
    }
  };

  const handleBlockLayoutChange = useCallback((blockKey: string, next: BlockLayoutOverride) => {
    setLayoutDraftOverrides((previous) => ({
      ...previous,
      [blockKey]: {
        x: next.x,
        y: next.y,
        scale: next.scale,
      },
    }));
  }, []);

  const handleStartLayoutEdit = () => {
    setMovingPlot(null);
    setMovingPlotDraftPos(null);
    setLayoutDraftOverrides(layoutSavedOverrides);
    setLayoutEditMode(true);
    toast("Layout edit mode enabled");
  };

  const handleCancelLayoutEdit = () => {
    setLayoutEditMode(false);
    setLayoutDraftOverrides({});
    toast("Layout changes discarded");
  };

  const handleSaveLayoutEdit = () => {
    setLayoutSavedOverrides(layoutDraftOverrides);
    setLayoutEditMode(false);
    setLayoutDraftOverrides({});
    toast.success("Block layout saved");
  };

  const handleResetLayoutDraft = () => {
    setLayoutDraftOverrides({});
    toast("Layout reset to defaults");
  };

  const handleApplyManualLayout = () => {
    if (!layoutEditMode) {
      toast.error("Enable layout edit mode first.");
      return;
    }
    if (!selectedBlockForManual || !selectedBlockKeyForManual) {
      toast.error("Select a block first.");
      return;
    }
    const nextX = Number(manualOffsetX);
    const nextY = Number(manualOffsetY);
    const nextScale = Number(manualScale);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextScale)) {
      toast.error("X, Y, and Scale must be valid numbers.");
      return;
    }
    handleBlockLayoutChange(selectedBlockKeyForManual, {
      x: nextX,
      y: nextY,
      scale: Math.max(0.06, Math.min(1, nextScale)),
    });
  };

  const handleNudgeManualLayout = (dx: number, dy: number) => {
    if (!layoutEditMode) {
      toast.error("Enable layout edit mode first.");
      return;
    }
    const x = Number(manualOffsetX);
    const y = Number(manualOffsetY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setManualOffsetX(String(x + dx));
    setManualOffsetY(String(y + dy));
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
    if (!newBlockImageFile) {
      toast.error("Block image is required.");
      return;
    }
    if (newBlockWidthPx <= 0 || newBlockHeightPx <= 0) {
      toast.error("Valid image dimensions are required.");
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
      setFocusBlockId(created.id);
      setActivePlot(null);
      toast.success("Block created");
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to create block");
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/95 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="text-slate-200 hover:text-white hover:bg-white/10 border border-white/10"
          onClick={() =>
            navigate(selectMode ? `/admin/upload${returnEditId ? `?editId=${encodeURIComponent(returnEditId)}` : ""}` : "/")
          }
        >
          {selectMode ? "Back to Upload" : "Back to Feed"}
        </Button>
        {selectMode && (
          <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            Select a Plot
          </span>
        )}
        <Input
          value={societySearch}
          onChange={(e) => setSocietySearch(e.target.value)}
          placeholder="Search coordinates, plots or sectors..."
          className="max-w-md bg-slate-900/80 border-white/10 text-slate-100 placeholder:text-slate-400"
        />
        <div className="text-sm text-slate-400">
          {societiesLoading ? "Searching societies..." : `${societies.length} societies`}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => zoomRef.current?.zoomIn()}
            disabled={!selectedSocietyId || blockLayout.positionedBlocks.length === 0}
          >
            Zoom In
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => zoomRef.current?.zoomOut()}
            disabled={!selectedSocietyId || blockLayout.positionedBlocks.length === 0}
          >
            Zoom Out
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setViewToBounds(
                {
                  minX: 0,
                  minY: 0,
                  maxX: blockLayout.canvasWidth,
                  maxY: blockLayout.canvasHeight,
                },
                0.92,
                200
              )
            }
            disabled={!selectedSocietyId || blockLayout.positionedBlocks.length === 0}
          >
            Reset
          </Button>
          {isAdminMarkingEnabled && (
            <>
              {!layoutEditMode ? (
                <Button size="sm" variant="secondary" onClick={handleStartLayoutEdit}>
                  Adjust Layout
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleResetLayoutDraft}>
                    Reset Layout
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelLayoutEdit}>
                    Cancel Edit
                  </Button>
                  <Button size="sm" onClick={handleSaveLayoutEdit}>
                    Save Layout
                  </Button>
                </>
              )}
            </>
          )}
          {(activePlotProperty?.videoUrl || (preselectedPlotId && preselectedPlotProperty?.videoUrl)) && (
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                navigate(`/property/${(activePlotProperty?.id ?? preselectedPlotProperty?.id) as string}`)
              }
            >
              View Video
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden min-w-0">
        <aside className="w-80 max-w-[22rem] shrink-0 border-r border-white/10 bg-slate-950/90 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current Society</div>
                {isAdminMarkingEnabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-white/10 bg-slate-950/50 text-slate-300 hover:bg-slate-800/80"
                    onClick={() => setCreateSocietyOpen(true)}
                  >
                    Add Society
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {societies.map((society) => (
                  <Button
                    key={society.id}
                    variant={selectedSocietyId === society.id ? "default" : "outline"}
                    className="w-full justify-start border-white/10 bg-slate-950/60 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                    onClick={() => {
                      setSelectedSocietyId(society.id);
                    }}
                  >
                    {society.name} ({society.city})
                  </Button>
                ))}
                {!societiesLoading && societies.length === 0 && (
                  <div className="text-sm text-muted-foreground">No societies found.</div>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Blocks Inventory</div>
                {isAdminMarkingEnabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-white/10 bg-slate-950/50 text-slate-300 hover:bg-slate-800/80"
                    disabled={!selectedSocietyId}
                    onClick={() => setCreateBlockOpen(true)}
                  >
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
                      className={`w-full justify-start ${
                        selectedBlockId === block.id
                          ? "bg-blue-400/80 text-slate-950 hover:bg-blue-300 border-blue-200"
                          : "border-white/10 bg-slate-950/50 text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setActivePlot(null);
                        setFocusBlockId(block.id);
                      }}
                    >
                      {block.name}
                    </Button>
                  ))}
                  {selectedSocietyId && blocks.length === 0 && (
                    <div className="text-sm text-slate-400">No blocks found for this society.</div>
                  )}
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
                <Button
                  onClick={handleSubmitPlotSearch}
                  disabled={!selectedSocietyId}
                  className="bg-blue-300 text-slate-950 hover:bg-blue-200"
                >
                  Find Plot
                </Button>
              </div>
              {submittedPlotSearch && (
                <div className="text-xs text-slate-400">
                  {searchLoading
                    ? "Searching plots..."
                    : searchResults.length > 0
                      ? `Found ${searchResults.length} matches`
                      : "No matching plot found"}
                </div>
              )}
              {selectMode && searchResults.length > 0 && (
                <div className="space-y-1 mt-2">
                  {searchResults.map((r) => (
                    <div key={r.plot.id} className="flex items-center justify-between text-sm p-2 rounded border">
                      <span>Plot {r.plot.plotNumber} - {r.block.name}</span>
                      <Button size="sm" onClick={() => handleSelectPlot(r.plot.id)}>
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isAdminMarkingEnabled && !movingPlot && (
              <div className="text-xs text-slate-400 border-t border-white/10 pt-3">
                Admin: Add new marker by clicking any block image.
              </div>
            )}

            {isAdminMarkingEnabled && movingPlot && (
              <div className="text-xs text-slate-400 border-t border-white/10 pt-3 space-y-2">
                <p>
                  Move mode: Drag the highlighted dot to reposition plot{" "}
                  <span className="font-medium text-foreground">{movingPlot.plotNumber}</span>.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMovingPlot(null);
                    setMovingPlotDraftPos(null);
                  }}
                  disabled={isUpdatingPlot}
                >
                  Cancel move
                </Button>
              </div>
            )}

            {isAdminMarkingEnabled && layoutEditMode && (
              <div className="text-xs text-slate-400 border-t border-white/10 pt-3">
                Layout edit mode is active. Drag block images or resize them from edges/corners.
              </div>
            )}

            {isAdminMarkingEnabled && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4 mt-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Manual Image Controls
                </div>
                <div className="text-xs text-slate-400">
                  {selectedBlockForManual ? selectedBlockForManual.name : "Select a block to control its position"}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">X</Label>
                    <Input
                      value={manualOffsetX}
                      onChange={(e) => setManualOffsetX(e.target.value)}
                      className="h-8 bg-slate-950/80 border-white/10 text-slate-100"
                      disabled={!selectedBlockForManual}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Y</Label>
                    <Input
                      value={manualOffsetY}
                      onChange={(e) => setManualOffsetY(e.target.value)}
                      className="h-8 bg-slate-950/80 border-white/10 text-slate-100"
                      disabled={!selectedBlockForManual}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Scale</Label>
                    <Input
                      value={manualScale}
                      onChange={(e) => setManualScale(e.target.value)}
                      className="h-8 bg-slate-950/80 border-white/10 text-slate-100"
                      disabled={!selectedBlockForManual}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleNudgeManualLayout(0, -10)}
                    disabled={!selectedBlockForManual}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleNudgeManualLayout(-10, 0)}
                    disabled={!selectedBlockForManual}
                  >
                    Left
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleNudgeManualLayout(10, 0)}
                    disabled={!selectedBlockForManual}
                  >
                    Right
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleNudgeManualLayout(0, 10)}
                    disabled={!selectedBlockForManual}
                  >
                    Down
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={handleApplyManualLayout}
                  disabled={!selectedBlockForManual}
                  className="w-full"
                >
                  Apply Manual Position
                </Button>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 relative bg-slate-950 overflow-hidden">
          {!selectedSocietyId || blockLayout.positionedBlocks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {blocksLoading ? "Loading blocks..." : "No blocks available for this society."}
            </div>
          ) : (
            <div className="h-full w-full" ref={viewerRef}>
              <TransformWrapper
                minScale={0.05}
                maxScale={12}
                initialScale={1}
                disabled={Boolean(movingPlot) || layoutEditMode}
              >
                {(controls) => {
                  zoomRef.current = controls;
                  return (
                    <>
                      <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ width: `${blockLayout.canvasWidth}px`, height: `${blockLayout.canvasHeight}px` }}
                      >
                        <div
                          className="relative select-none"
                          style={{ width: `${blockLayout.canvasWidth}px`, height: `${blockLayout.canvasHeight}px` }}
                        >
                          {blockLayout.positionedBlocks.map(({ block, blockKey, offsetX, offsetY, displayScale, displayWidth, displayHeight }) => (
                            <BlockWithPlots
                              key={block.id}
                              block={block}
                              blockKey={blockKey}
                              offsetX={offsetX}
                              offsetY={offsetY}
                              displayScale={displayScale}
                              displayWidth={displayWidth}
                              displayHeight={displayHeight}
                              isSelected={selectedBlockId === block.id}
                              activePlot={activePlot}
                              isAdmin={isAdminMarkingEnabled}
                              isLayoutEditMode={isAdminMarkingEnabled && layoutEditMode}
                              selectMode={selectMode}
                              adminMovePlotId={movingPlot?.id ?? null}
                              adminMovePlotDraftPos={movingPlotDraftPos}
                              onLayoutChange={handleBlockLayoutChange}
                              onAdminMovePlotDraftChange={handleAdminMovePlotDraftChange}
                              onAdminMovePlotCommit={handleAdminMovePlotCommit}
                              onAdminMovePlot={handleAdminMovePlot}
                              onImageClick={handleBlockImageClick}
                              onSelectPlot={handleSelectPlot}
                              onPublicPlotClick={handlePublicPlotClick}
                            />
                          ))}
                        </div>
                      </TransformComponent>
                    </>
                  );
                }}
              </TransformWrapper>
            </div>
          )}
        </main>
      </div>

      <Dialog open={createSocietyOpen} onOpenChange={setCreateSocietyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Society</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-society-name">Society Name</Label>
              <Input
                id="new-society-name"
                value={newSocietyName}
                onChange={(e) => setNewSocietyName(e.target.value)}
                placeholder="e.g. Bismillah Housing Scheme"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-society-city">City</Label>
              <Input
                id="new-society-city"
                value={newSocietyCity}
                onChange={(e) => setNewSocietyCity(e.target.value)}
                placeholder="e.g. Lahore"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-society-state">State</Label>
              <Input
                id="new-society-state"
                value={newSocietyState}
                onChange={(e) => setNewSocietyState(e.target.value)}
                placeholder="e.g. Punjab"
              />
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
              <Label htmlFor="new-block-name">Block Name</Label>
              <Input
                id="new-block-name"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="e.g. D Block"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-block-image">Block Image (required)</Label>
              <Input
                id="new-block-image"
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

      {/* Admin: Create Plot Dialog */}
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
              <Label htmlFor="plot-number">Plot Number *</Label>
              <Input
                id="plot-number"
                value={markPlotNumber}
                onChange={(e) => setMarkPlotNumber(e.target.value)}
                placeholder="e.g. 123"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePlot();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plot-size">Size (optional)</Label>
              <Input
                id="plot-size"
                value={markPlotSize}
                onChange={(e) => setMarkPlotSize(e.target.value)}
                placeholder="e.g. 5 Marla"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePlot} disabled={!markPlotNumber.trim() || isCreatingPlot}>
              {isCreatingPlot ? "Saving..." : "Save Plot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Renders a single block image with all its plots overlaid.
 * Fetches plots via useGetPlotFinderBlockDetailsQuery per block.
 */
function BlockWithPlots({
  block,
  blockKey,
  offsetX,
  offsetY,
  displayScale,
  displayWidth,
  displayHeight,
  isSelected,
  activePlot,
  isAdmin,
  isLayoutEditMode,
  adminMovePlotId,
  adminMovePlotDraftPos,
  selectMode,
  onLayoutChange,
  onAdminMovePlot,
  onPublicPlotClick,
  onAdminMovePlotDraftChange,
  onAdminMovePlotCommit,
  onImageClick,
  onSelectPlot,
}: {
  block: PlotFinderBlock;
  blockKey: string;
  offsetX: number;
  offsetY: number;
  displayScale: number;
  displayWidth: number;
  displayHeight: number;
  isSelected: boolean;
  activePlot: PlotFinderPlot | null;
  isAdmin: boolean;
  isLayoutEditMode: boolean;
  adminMovePlotId: string | null;
  adminMovePlotDraftPos: { x: number; y: number } | null;
  selectMode: boolean;
  onLayoutChange: (blockKey: string, next: BlockLayoutOverride) => void;
  onAdminMovePlot: (plot: PlotFinderPlot) => Promise<boolean> | boolean;
  onPublicPlotClick?: (plot: PlotFinderPlot) => void;
  onAdminMovePlotDraftChange: (plotId: string, x: number, y: number) => void;
  onAdminMovePlotCommit: (plotId: string, x: number, y: number) => void;
  onImageClick: (blockId: string, plotX: number, plotY: number) => void;
  onSelectPlot: (plotId: string) => void;
}) {
  const { data: blockDetails } = useGetPlotFinderBlockDetailsQuery({ blockId: block.id });
  const plots = blockDetails?.plots ?? [];
  const imageRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const draggingPlotIdRef = useRef<string | null>(null);
  const lastDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const blockDownRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const onImageClickRef = useRef(onImageClick);
  onImageClickRef.current = onImageClick;

  function clientToPlotXY(clientX: number, clientY: number): { x: number; y: number } | null {
    const img = imageRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scaleX = block.widthPx / rect.width;
    const scaleY = block.heightPx / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX * 100) / 100,
      y: Math.round((clientY - rect.top) * scaleY * 100) / 100,
    };
  }

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7809/ingest/bc9db7d1-6c73-48aa-b2bb-085440f8b23f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e17c0" },
      body: JSON.stringify({
        sessionId: "8e17c0",
        runId: "pre-fix-blank",
        hypothesisId: "B1",
        location: "client/src/pages/PlotFinder.tsx:BlockWithPlots:mount",
        message: "block mounted with image src",
        data: { blockId: block.id, imagePath: block.imagePath, normalizedSrc: normalizeImagePath(block.imagePath) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [block.id, block.imagePath]);

  const blockContent = (
    <div
      ref={imageRef}
      className={`${isLayoutEditMode ? "relative plot-block-drag-handle" : "absolute"} overflow-hidden ${
        isSelected
          ? "drop-shadow-[0_0_14px_rgba(239,68,68,0.8)]"
          : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
      }`}
      style={{
        left: isLayoutEditMode ? "0px" : `${offsetX}px`,
        top: isLayoutEditMode ? "0px" : `${offsetY}px`,
        width: isLayoutEditMode ? "100%" : `${displayWidth}px`,
        height: isLayoutEditMode ? "100%" : `${displayHeight}px`,
      }}
      onPointerDownCapture={(e) => {
        if (!isAdmin) return;
        if (isLayoutEditMode) return;
        const target = e.target as HTMLElement;
        if (target.closest("[data-plot-dot='1']")) return;
        blockDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      }}
      onPointerUpCapture={(e) => {
        if (!isAdmin) return;
        if (isLayoutEditMode) return;
        const target = e.target as HTMLElement;
        if (target.closest("[data-plot-dot='1']")) return;
        const down = blockDownRef.current;
        blockDownRef.current = null;
        if (!down) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const elapsed = Date.now() - down.time;
        if (dist > 8 || elapsed > 700) return;
        const coords = clientToPlotXY(e.clientX, e.clientY);
        if (!coords) return;
        onImageClickRef.current(block.id, coords.x, coords.y);
      }}
    >
      <img
        src={normalizeImagePath(block.imagePath)}
        alt={`${block.name} map`}
        className={`absolute object-fill select-none pointer-events-none ${
          isAdmin ? (isLayoutEditMode ? "cursor-move" : "cursor-crosshair") : ""
        }`}
        style={{
          left: "0px",
          top: "0px",
          width: "100%",
          height: "100%",
        }}
        draggable={false}
        onLoad={() => {
          // #region agent log
          fetch("http://127.0.0.1:7809/ingest/bc9db7d1-6c73-48aa-b2bb-085440f8b23f", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e17c0" },
            body: JSON.stringify({
              sessionId: "8e17c0",
              runId: "pre-fix-blank",
              hypothesisId: "B2",
              location: "client/src/pages/PlotFinder.tsx:img:onLoad",
              message: "block image loaded",
              data: { blockId: block.id, src: normalizeImagePath(block.imagePath) },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }}
        onError={() => {
          // #region agent log
          fetch("http://127.0.0.1:7809/ingest/bc9db7d1-6c73-48aa-b2bb-085440f8b23f", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e17c0" },
            body: JSON.stringify({
              sessionId: "8e17c0",
              runId: "pre-fix-blank",
              hypothesisId: "B3",
              location: "client/src/pages/PlotFinder.tsx:img:onError",
              message: "block image failed to load",
              data: { blockId: block.id, src: normalizeImagePath(block.imagePath) },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }}
      />
      <div
        className={`absolute left-2 top-2 rounded bg-background/90 px-2 py-1 text-xs font-semibold shadow ${
          isLayoutEditMode ? "pointer-events-none" : ""
        }`}
      >
        {block.name}
      </div>
      {/* Render all plots as dots */}
      {plots.map((plot) => {
        const isActive = activePlot?.id === plot.id;
        const isMoving = adminMovePlotId === plot.id;
        const dotX = isMoving && adminMovePlotDraftPos ? adminMovePlotDraftPos.x : plot.x;
        const dotY = isMoving && adminMovePlotDraftPos ? adminMovePlotDraftPos.y : plot.y;
        return (
          <div key={plot.id} className="group">
            <div
              data-plot-dot="1"
              className={`absolute rounded-full border-2 shadow ${
                isMoving
                  ? "h-5 w-5 border-white bg-yellow-500 z-20"
                  : isActive
                    ? "h-5 w-5 border-white bg-red-500 z-10"
                    : "h-3 w-3 border-white/80 bg-blue-500 z-[5]"
              }`}
              style={{
                left: `${dotX * displayScale}px`,
                top: `${dotY * displayScale}px`,
                transform: "translate(-50%, -50%)",
                touchAction: "none",
                cursor: !isAdmin && !selectMode && onPublicPlotClick ? "pointer" : isAdmin && isMoving ? "grabbing" : undefined,
                pointerEvents: isLayoutEditMode ? "none" : "auto",
              }}
              title={`Plot ${plot.plotNumber}${plot.size ? ` (${plot.size})` : ""}`}
              role={isAdmin ? "button" : undefined}
              tabIndex={isAdmin ? 0 : -1}
              onClick={(e) => {
                if (isAdmin) {
                  if (isLayoutEditMode) return;
                  if (didDragRef.current) return;
                  if (adminMovePlotId === plot.id) return;
                  e.stopPropagation();
                  void onAdminMovePlot(plot);
                  return;
                }

                if (selectMode) return;
                if (!onPublicPlotClick) return;
                e.stopPropagation();
                onPublicPlotClick(plot);
              }}
              onPointerDown={async (e) => {
                if (!isAdmin) return;
                if (isLayoutEditMode) return;
                // Prevent panning/zoom gestures while moving markers.
                e.preventDefault();
                e.stopPropagation();

                if (!adminMovePlotId || adminMovePlotId !== plot.id) {
                  const ok = await onAdminMovePlot(plot); // guard: read-only if video listing already attached
                  if (!ok) return;
                }

                isDraggingRef.current = true;
                draggingPlotIdRef.current = plot.id;
                lastDragPosRef.current = { x: dotX, y: dotY };
                didDragRef.current = false;

                try {
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }

                const coords = clientToPlotXY(e.clientX, e.clientY);
                if (coords) {
                  lastDragPosRef.current = coords;
                  onAdminMovePlotDraftChange(plot.id, coords.x, coords.y);
                }
              }}
              onPointerMove={(e) => {
                if (!isAdmin) return;
                if (!isDraggingRef.current) return;
                if (draggingPlotIdRef.current !== plot.id) return;

                e.preventDefault();
                e.stopPropagation();

                const coords = clientToPlotXY(e.clientX, e.clientY);
                if (!coords) return;
                didDragRef.current = true;
                lastDragPosRef.current = coords;
                onAdminMovePlotDraftChange(plot.id, coords.x, coords.y);
              }}
              onPointerUp={(e) => {
                if (!isAdmin) return;
                if (!isDraggingRef.current) return;
                if (draggingPlotIdRef.current !== plot.id) return;

                e.preventDefault();
                e.stopPropagation();

                const finalPos = lastDragPosRef.current ?? { x: plot.x, y: plot.y };
                isDraggingRef.current = false;
                draggingPlotIdRef.current = null;
                const shouldCommit = didDragRef.current;
                didDragRef.current = false;
                lastDragPosRef.current = null;

                // If the user just clicked the dot (no drag), keep move mode.
                // Commit only after they actually moved.
                if (shouldCommit) {
                  void onAdminMovePlotCommit(plot.id, finalPos.x, finalPos.y);
                }
              }}
              onPointerCancel={() => {
                isDraggingRef.current = false;
                draggingPlotIdRef.current = null;
                didDragRef.current = false;
                lastDragPosRef.current = null;
              }}
            />
            {/* Tooltip/select on hover */}
            <div
              className={`absolute z-30 hidden group-hover:flex flex-col items-center gap-1 pointer-events-auto ${
                isLayoutEditMode ? "pointer-events-none" : ""
              }`}
              style={{
                left: `${dotX * displayScale}px`,
                top: `${dotY * displayScale - 8}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="bg-background border rounded px-2 py-1 text-xs shadow-lg whitespace-nowrap">
                Plot {plot.plotNumber}{plot.size ? ` · ${plot.size}` : ""}
              </div>
              {selectMode && (
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlot(plot.id);
                  }}
                >
                  Select
                </Button>
              )}
              {!isAdmin && !selectMode && onPublicPlotClick && (
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPublicPlotClick(plot);
                  }}
                >
                  View video
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!isAdmin || !isLayoutEditMode) {
    return blockContent;
  }

  return (
    <Rnd
      size={{ width: displayWidth, height: displayHeight }}
      position={{ x: offsetX, y: offsetY }}
      bounds="parent"
      dragHandleClassName="plot-block-drag-handle"
      enableResizing={{
        bottom: true,
        bottomLeft: true,
        bottomRight: true,
        left: true,
        right: true,
        top: true,
        topLeft: true,
        topRight: true,
      }}
      onDragStop={(_event, data) => {
        onLayoutChange(blockKey, {
          x: Math.round(data.x),
          y: Math.round(data.y),
          scale: displayScale,
        });
      }}
      onResizeStop={(_event, _direction, ref, _delta, position) => {
        const nextWidth = Number.parseFloat(ref.style.width);
        const computedScale = Number.isFinite(nextWidth) && block.widthPx > 0 ? nextWidth / block.widthPx : displayScale;
        const clampedScale = Math.max(0.06, Math.min(1, computedScale));
        onLayoutChange(blockKey, {
          x: Math.round(position.x),
          y: Math.round(position.y),
          scale: Number(clampedScale.toFixed(4)),
        });
      }}
    >
      <div className="h-full w-full cursor-move">{blockContent}</div>
    </Rnd>
  );
}
