import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Crosshair, X, Search, Loader2 } from 'lucide-react';
import { GeoRadius } from '@warehouse-lead/core/client';
import { PlaceResult, searchPlaces } from '../services/api';

interface LocationFilterProps {
  value: GeoRadius | null;
  onChange: (value: GeoRadius | null) => void;
  /** Leads with no resolved coordinates, hidden while a radius is active. */
  hiddenCount: number;
  /** Leads that resolved to a point outside the radius. */
  outsideCount: number;
  /** Whether leads with no coordinates survive the radius filter. */
  includeUnlocated: boolean;
  onIncludeUnlocatedChange: (value: boolean) => void;
}

const DEFAULT_RADIUS_KM = 100;
const RADIUS_STEPS = [10, 25, 50, 100, 200, 500];

const inputStyle: React.CSSProperties = {
  width: '104px',
  padding: '6px 8px',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  border: '1px solid var(--border-medium)',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  outline: 'none'
};

/**
 * Coordinate + radius search, replacing the old fixed corridor dropdown.
 *
 * The dropdown could only ever offer places someone had hard-coded; a point and
 * a radius lets an analyst search anywhere, including across corridor and state
 * boundaries that the named-place list cut through.
 *
 * Place names are looked up live through the geocoder rather than chosen from
 * a built-in list. The old preset dropdown could only offer corridors somebody
 * had typed into the repository, so searching anywhere else meant finding
 * coordinates by hand; now any place the geocoder knows is one query away.
 */
export const LocationFilter: React.FC<LocationFilterProps> = ({ value, onChange, hiddenCount, outsideCount, includeUnlocated, onIncludeUnlocatedChange }) => {
  const [latText, setLatText] = useState(value ? String(value.latitude) : '');
  const [lonText, setLonText] = useState(value ? String(value.longitude) : '');
  const [radiusKm, setRadiusKm] = useState(value?.radiusKm ?? DEFAULT_RADIUS_KM);
  const [error, setError] = useState<string | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number } | null>(null);

  const commit = (lat: string, lon: string, radius: number) => {
    if (!lat.trim() && !lon.trim()) {
      setError(null);
      onChange(null);
      return;
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError('Latitude must be a number between -90 and 90');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Longitude must be a number between -180 and 180');
      return;
    }

    setError(null);
    onChange({ latitude, longitude, radiusKm: radius });
  };

  const applyPlace = (place: PlaceResult) => {
    const lat = place.latitude.toFixed(4);
    const lon = place.longitude.toFixed(4);
    setLatText(lat);
    setLonText(lon);
    setPlaceQuery('');
    setPlaceResults([]);
    commit(lat, lon, radiusKm);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser does not expose a location API');
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        setLatText(lat);
        setLonText(lon);
        commit(lat, lon, radiusKm);
        setGeolocating(false);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}`);
        setGeolocating(false);
      },
      { timeout: 10000 }
    );
  };

  /**
   * Debounced so a typed query costs one geocoder request, not one per
   * keystroke — the provider's rate limit is shared by every user of this
   * deployment, and burning it on typeahead would starve the scans that need
   * it. The in-flight request is aborted when the query moves on, so results
   * can never arrive out of order and overwrite a newer search.
   */
  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 3) {
      setPlaceResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setPlaceResults(await searchPlaces(query, controller.signal));
      } catch (err) {
        if (!controller.signal.aborted) setPlaceResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery]);

  /**
   * Keeps the portalled menu pinned under its input.
   *
   * The menu cannot simply be absolutely positioned inside the filter panel:
   * that panel is a .glass-panel, and `backdrop-filter` combined with
   * `border-radius` clips descendants to the rounded border box, which sliced
   * the results list off mid-row. Rendering into document.body escapes any
   * ancestor clipping — from this panel or any future one — at the cost of
   * having to track the anchor's position manually.
   */
  useLayoutEffect(() => {
    if (placeResults.length === 0) {
      setMenuRect(null);
      return;
    }

    const reposition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setMenuRect({ top: rect.bottom + 4, left: rect.left });
    };

    reposition();
    // `true` catches scrolling of any ancestor, not just the window.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [placeResults]);

  // A portalled menu is outside the input's DOM subtree, so a blur handler
  // would not see clicks on it. Dismiss on any pointer down elsewhere instead.
  useEffect(() => {
    if (placeResults.length === 0) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-place-menu]')) return;
      setPlaceResults([]);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [placeResults]);

  const clear = () => {
    setLatText('');
    setLonText('');
    setError(null);
    onChange(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <MapPin size={15} color="var(--text-muted)" />

        <input
          type="text"
          inputMode="decimal"
          placeholder="Latitude"
          aria-label="Latitude"
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
          onBlur={() => commit(latText, lonText, radiusKm)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(latText, lonText, radiusKm); }}
          style={inputStyle}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Longitude"
          aria-label="Longitude"
          value={lonText}
          onChange={(e) => setLonText(e.target.value)}
          onBlur={() => commit(latText, lonText, radiusKm)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(latText, lonText, radiusKm); }}
          style={inputStyle}
        />

        <select
          aria-label="Search radius"
          value={radiusKm}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            setRadiusKm(next);
            commit(latText, lonText, next);
          }}
          style={{ ...inputStyle, width: 'auto' }}
        >
          {RADIUS_STEPS.map((km) => (
            <option key={km} value={km}>within {km} km</option>
          ))}
        </select>

        <button
          onClick={useMyLocation}
          disabled={geolocating}
          title="Use this device's location"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 10px', borderRadius: '6px',
            backgroundColor: '#f8fafc', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600
          }}
        >
          <Crosshair size={13} />
          <span>{geolocating ? 'Locating…' : 'My location'}</span>
        </button>

        <div ref={anchorRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{ position: 'absolute', left: '8px', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          <input
            type="text"
            aria-label="Search for a place"
            placeholder="Search a place…"
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
            style={{ ...inputStyle, width: '170px', paddingLeft: '25px' }}
          />
          {searching && (
            <Loader2
              size={13}
              style={{ position: 'absolute', right: '8px', color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }}
            />
          )}

          {menuRect && createPortal(
            <ul
              role="listbox"
              data-place-menu=""
              style={{
                position: 'fixed', top: menuRect.top, left: menuRect.left, zIndex: 1000,
                width: '340px', maxHeight: '260px', overflowY: 'auto',
                margin: 0, padding: '4px', listStyle: 'none',
                backgroundColor: '#ffffff', borderRadius: '8px',
                border: '1px solid var(--border-medium)',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)'
              }}
            >
              {placeResults.map((place) => (
                <li key={`${place.latitude},${place.longitude}`}>
                  <button
                    onClick={() => applyPlace(place)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 9px', borderRadius: '6px', border: 'none',
                      background: 'transparent', fontSize: '0.78rem',
                      color: 'var(--text-primary)', lineHeight: 1.35, cursor: 'pointer'
                    }}
                  >
                    {place.name}
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )}
        </div>

        {value && (
          <button
            onClick={clear}
            title="Clear location filter"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 9px', borderRadius: '6px',
              backgroundColor: '#fff1f2', border: '1px solid #fecdd3',
              color: '#be123c', fontSize: '0.78rem', fontWeight: 600
            }}
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: '0.74rem', color: '#be123c', fontWeight: 600 }}>{error}</div>
      )}

      {/* Two distinct reasons a lead is missing from the table, kept apart
          because they call for different fixes: widen the radius, or accept
          that the source never said where. */}
      {!error && value && outsideCount > 0 && (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {outsideCount} lead{outsideCount === 1 ? '' : 's'} outside the {radiusKm} km radius — widen it to include {outsideCount === 1 ? 'it' : 'them'}.
        </div>
      )}

      {/* Leads the sources never located. Shown with a switch rather than a
          bare count: the previous version reported them as "hidden" and left
          no way to look at them, so a real lead could only be found by reading
          the network response. */}
      {!error && value && hiddenCount > 0 && (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.74rem', color: 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={includeUnlocated}
            onChange={(e) => onIncludeUnlocatedChange(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>
            Show {hiddenCount} lead{hiddenCount === 1 ? '' : 's'} with no location
            {includeUnlocated ? ' — listed last, no distance shown' : ' — currently hidden by the radius'}
          </span>
        </label>
      )}
    </div>
  );
};
