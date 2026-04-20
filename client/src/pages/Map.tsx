
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, ImageOverlay, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGetPropertiesQuery } from "@/store/api/apiSlice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import blueprintOverlay from "@/assets/socities/bismilah/Bismillah Full.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Default map view and blueprint anchor */
const BLUEPRINT_CENTER: [number, number] = [31.604481, 74.480158];
const BLUEPRINT_HALF_HEIGHT = 0.0025;
const BLUEPRINT_HALF_WIDTH = 0.0035;
const BLUEPRINT_BOUNDS: [[number, number], [number, number]] = [
  [BLUEPRINT_CENTER[0] - BLUEPRINT_HALF_HEIGHT, BLUEPRINT_CENTER[1] - BLUEPRINT_HALF_WIDTH],
  [BLUEPRINT_CENTER[0] + BLUEPRINT_HALF_HEIGHT, BLUEPRINT_CENTER[1] + BLUEPRINT_HALF_WIDTH],
];

function MapViewSync({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const { data: properties = [] } = useGetPropertiesQuery({
    search: search || undefined,
    city: city || undefined,
    state: state || undefined,
  });

  const mapProperties = properties.filter(
    (p) => p.latitude !== null && p.longitude !== null && p.latitude !== undefined && p.longitude !== undefined
  );

  const [mapCenter, setMapCenter] = useState<[number, number]>(BLUEPRINT_CENTER);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(next);
      },
      () => {
        /* keep blueprint center */
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    );
  }, []);

  const MapContainerAny = MapContainer as any;
  const TileLayerAny = TileLayer as any;
  const MarkerAny = Marker as any;
  const PopupAny = Popup as any;
  const CircleMarkerAny = CircleMarker as any;
  const ImageOverlayAny = ImageOverlay as any;

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="p-4 border-b flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Feed
        </Button>
        <Input
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <MapContainerAny center={mapCenter} zoom={12} className="h-full w-full">
            <MapViewSync center={mapCenter} />
            <TileLayerAny
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ImageOverlayAny url={blueprintOverlay} bounds={BLUEPRINT_BOUNDS} opacity={0.6} />
            {userPosition && (
              <CircleMarkerAny
                center={userPosition}
                radius={8}
                pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.35 }}
              >
                <PopupAny>Your location</PopupAny>
              </CircleMarkerAny>
            )}
            {mapProperties.map((property) => (
              <MarkerAny
                key={property.id}
                position={[Number(property.latitude), Number(property.longitude)]}
              >
                <PopupAny>
                  <div className="space-y-1">
                    <div className="font-semibold">{property.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {property.city}, {property.state}
                    </div>
                    <Button size="sm" onClick={() => navigate(`/property/${property.id}`)}>
                      View
                    </Button>
                  </div>
                </PopupAny>
              </MarkerAny>
            ))}
          </MapContainerAny>
        </div>
        <div className="w-full max-w-sm border-l overflow-y-auto">
          <div className="p-4 space-y-3">
            {properties.length === 0 && (
              <div className="text-sm text-muted-foreground">No properties found.</div>
            )}
            {properties.map((property) => (
              <div
                key={property.id}
                className="rounded-lg border p-3 space-y-1"
              >
                <div className="font-medium">{property.title}</div>
                <div className="text-xs text-muted-foreground">
                  {property.city}, {property.state}
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/property/${property.id}`)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

