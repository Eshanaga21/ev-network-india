import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Crosshair, MapPin, Search, X } from "lucide-react";
import type { Station } from "./types";
import { findStations } from "./finder";
import { request } from "./api";
import { parseCoordinates, type TripPoint } from "./tripPoints";
import { requestCurrentLocation } from "./currentLocation";
export default function EndpointChoice({
  label,
  value,
  onChange,
  stations,
  onPickMap,
}: {
  label: string;
  value: TripPoint | null;
  onChange: (p: TripPoint | null) => void;
  stations: Station[];
  onPickMap: () => void;
}) {
  const id = useId(),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [locationError, setLocationError] = useState(""),
    [locating, setLocating] = useState(false);
  const lookup = useMutation({
    mutationFn: async (q: string) => ({
      query: q,
      data: await request("places/search", { query: q }),
    }),
    onSuccess: () => setOpen(true),
  });
  const local = findStations(stations, "", query)
    .slice(0, 4)
    .map((s) => ({
      label: s.station_name,
      detail: `Charging station · ${s.city || s.state}`,
      value: {
        label: s.station_name,
        source: "station",
        point: { station_id: s.station_id },
      } as TripPoint,
    }));
  const places =
    lookup.data?.query === query.trim()
      ? lookup.data.data.places.map((p: any) => ({
          label: p.label,
          detail: "Place · OpenStreetMap",
          value: {
            label: p.label,
            source: "place",
            point: { latitude: p.latitude, longitude: p.longitude },
          } as TripPoint,
        }))
      : [];
  const coordinate = parseCoordinates(query);
  const options = [
    ...(coordinate
      ? [
          {
            label: `Use ${coordinate.latitude}, ${coordinate.longitude}`,
            detail: "Entered coordinates",
            value: {
              label: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
              source: "coordinates",
              point: coordinate,
            } as TripPoint,
          },
        ]
      : []),
    ...places,
    ...local,
  ];
  const choose = (p: TripPoint) => {
    generation.current++;
    onChange(p);
    setQuery("");
    setOpen(false);
    setLocationError("");
  };
  const searchPlaces = () => {
    if (coordinate) {
      choose({
        label: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
        source: "coordinates",
        point: coordinate,
      });
      return;
    }
    if (query.trim().length >= 2) {
      lookup.mutate(query.trim());
      setOpen(true);
      setActive(0);
    }
  };
  const currentLocation = () => {
    const token = ++generation.current;
    setLocating(true);
    setLocationError("");
    void requestCurrentLocation(navigator.geolocation).then(
      (point) => {
        if (token !== generation.current) return;
        setLocating(false);
        choose(point);
      },
      (error) => {
        if (token !== generation.current) return;
        setLocating(false);
        setLocationError(error.message);
      },
    );
  };
  return (
    <div className="finder-endpoint finder-picker">
      <label htmlFor={id}>{label}</label>
      <div className="finder-picker-input">
        <MapPin size={17} />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[active] ? `${id}-option-${active}` : undefined
          }
          placeholder="Address, place or lat, lon"
          value={open ? query : value?.label || query}
          onFocus={() => {
            setQuery(value?.label || query);
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            generation.current++;
            setLocating(false);
            setQuery(e.target.value);
            setActive(0);
            onChange(null);
            setLocationError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive(Math.min(active + 1, Math.max(0, options.length - 1)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(Math.max(0, active - 1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (coordinate) searchPlaces();
              else if (open && options[active]) choose(options[active].value);
              else searchPlaces();
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button
          type="button"
          aria-label={`Search ${label.toLowerCase()} places`}
          disabled={query.trim().length < 2 || lookup.isPending}
          onMouseDown={(e) => e.preventDefault()}
          onClick={searchPlaces}
        >
          <Search size={16} />
        </button>
        {(value || query) && (
          <button
            aria-label={`Clear ${label.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              generation.current++;
              setLocating(false);
              onChange(null);
              setQuery("");
              lookup.reset();
              setLocationError("");
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="finder-location-actions">
        <button type="button" onClick={currentLocation} disabled={locating}>
          <Crosshair size={13} />
          {locating ? "Locating…" : "Use current location"}
        </button>
        <button
          type="button"
          onClick={() => {
            generation.current++;
            setLocating(false);
            setOpen(false);
            onPickMap();
          }}
        >
          <MapPin size={13} />
          Pick on map
        </button>
      </div>
      {value?.source === "current" && (
        <small className="finder-point-note">
          Device accuracy: about {Math.round(value.point.accuracy_m || 0)} m.
          Verify the pin before routing.
        </small>
      )}
      {locationError && (
        <p role="alert" className="finder-location-error">
          {locationError}
        </p>
      )}
      {lookup.error && open && (
        <p role="alert" className="finder-location-error">
          {lookup.error.message}
        </p>
      )}
      {open && (
        <div
          className="finder-picker-options"
          id={`${id}-options`}
          role="listbox"
          aria-label={`${label} suggestions`}
        >
          {lookup.isPending && <p>Searching places…</p>}
          {options.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={active === index}
              key={`${option.detail}:${option.label}:${index}`}
              id={`${id}-option-${index}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option.value)}
            >
              <strong>{option.label}</strong>
              <small>{option.detail}</small>
            </button>
          ))}
          {!options.length && !lookup.isPending && (
            <p>
              {lookup.data?.query === query.trim()
                ? "No places found. Try a fuller address, coordinates or pick on the map."
                : "Enter an address and press Search, choose a station, or enter latitude, longitude."}
            </p>
          )}
          {!!places.length && (
            <small className="finder-point-note">
              OpenStreetMap contributors · Photon
            </small>
          )}
        </div>
      )}
    </div>
  );
}
