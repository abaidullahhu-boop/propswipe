import { useEffect, useRef, useState } from "react";
import GoogleMapReact, { type ClickEventValue } from "google-map-react";
import { Input } from "@/components/ui/input";

type GoogleMapsApi = typeof google;

interface PropertyLocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  city?: string;
  state?: string;
  onChange: (value: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
  }) => void;
}

const DEFAULT_CENTER: [number, number] = [24.8607, 67.0011];
const DEFAULT_ZOOM = 12;

function parseAddressComponents(
  place: google.maps.places.PlaceResult
): { city?: string; state?: string } {
  const components = place.address_components ?? [];
  let city: string | undefined;
  let state: string | undefined;

  for (const c of components) {
    if (!c.types) continue;
    if (c.types.includes("locality")) {
      city = c.long_name;
    }
    if (c.types.includes("administrative_area_level_1")) {
      state = c.short_name || c.long_name;
    }
  }

  return { city, state };
}

export function PropertyLocationPicker({
  latitude,
  longitude,
  address,
  city,
  state,
  onChange,
}: PropertyLocationPickerProps) {
  const [internalAddress, setInternalAddress] = useState(address ?? "");
  const [center, setCenter] = useState<[number, number]>(() => {
    if (latitude != null && longitude != null) {
      return [Number(latitude), Number(longitude)];
    }
    return DEFAULT_CENTER;
  });
  const [marker, setMarker] = useState<[number, number] | null>(() => {
    if (latitude != null && longitude != null) {
      return [Number(latitude), Number(longitude)];
    }
    return null;
  });

  const autocompleteRef = useRef<HTMLInputElement | null>(null);
  const mapsRef = useRef<{ map?: google.maps.Map; maps?: GoogleMapsApi } | null>(null);

  useEffect(() => {
    setInternalAddress(address ?? "");
  }, [address]);

  useEffect(() => {
    if (latitude != null && longitude != null) {
      const next: [number, number] = [Number(latitude), Number(longitude)];
      setCenter(next);
      setMarker(next);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (!mapsRef.current?.maps || !mapsRef.current.map || !autocompleteRef.current) return;

    const { maps } = mapsRef.current;
    const input = autocompleteRef.current;

    const autocomplete = new maps.places.Autocomplete(input, {
      fields: ["formatted_address", "geometry", "address_components"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) return;

      const location = place.geometry.location;
      const lat = location.lat();
      const lng = location.lng();
      const formattedAddress = place.formatted_address;
      const { city: parsedCity, state: parsedState } = parseAddressComponents(place);

      const payload = {
        latitude: lat,
        longitude: lng,
        address: formattedAddress ?? (internalAddress || address),
        city: parsedCity ?? city,
        state: parsedState ?? state,
      };

      setCenter([lat, lng]);
      setMarker([lat, lng]);
      onChange(payload);
    });

    return () => {
      // Google Autocomplete instances don't expose a direct destroy method; listener cleanup is handled internally.
    };
  }, [address, city, internalAddress, onChange, state]);

  const handleMapClick = (e: ClickEventValue) => {
    const lat = e.lat;
    const lng = e.lng;
    setMarker([lat, lng]);
    setCenter([lat, lng]);
    onChange({
      latitude: lat,
      longitude: lng,
      address,
      city,
      state,
    });
  };

  const MarkerComponent = () => (
    <div className="w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 border-2 border-white shadow" />
  );

  const bootstrapURLKeys = {
    key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined,
    libraries: ["places"],
  } as any;

  const canLoadMaps = Boolean(bootstrapURLKeys.key);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium mb-1">Search on Map</label>
        <Input
          ref={autocompleteRef}
          placeholder="Search address or place"
          value={internalAddress}
          onChange={(e) => setInternalAddress(e.target.value)}
          disabled={!canLoadMaps}
        />
        {!canLoadMaps && (
          <p className="mt-1 text-xs text-muted-foreground">
            Google Maps API key is not configured. Address search is disabled.
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Search for an address or click on the map to set the property location. Latitude and
          longitude will be filled automatically.
        </p>
      </div>

      {canLoadMaps && (
        <div className="h-64 w-full rounded-md border overflow-hidden">
          <GoogleMapReact
            bootstrapURLKeys={bootstrapURLKeys}
            defaultCenter={center}
            defaultZoom={DEFAULT_ZOOM}
            center={center}
            yesIWantToUseGoogleMapApiInternals
            onGoogleApiLoaded={({ map, maps }) => {
              mapsRef.current = { map, maps };
            }}
            onClick={handleMapClick}
          >
            {marker && (
              <MarkerComponent
                lat={marker[0]}
                lng={marker[1]}
              />
            )}
          </GoogleMapReact>
        </div>
      )}
    </div>
  );
}

