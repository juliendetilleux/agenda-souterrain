import { useState, useRef, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Navigation, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

// Fix Leaflet default icon issue with bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  location: string
  latitude: number | null
  longitude: number | null
  readOnly?: boolean
  onLocationChange: (location: string) => void
  onCoordsChange: (lat: number | null, lng: number | null) => void
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, map.getZoom(), { duration: 0.5 })
  }, [center[0], center[1], map])
  return null
}

export default function LocationPicker({
  location,
  latitude,
  longitude,
  readOnly = false,
  onLocationChange,
  onCoordsChange,
}: Props) {
  const { t } = useTranslation('events')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const abortControllerRef = useRef<AbortController | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const hasCoords = latitude != null && longitude != null

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cleanup debounce + abort on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      abortControllerRef.current?.abort()
    }
  }, [])

  // Reverse geocoding: convert coordinates to address text
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'AgendaSouterrain/1.0' } }
      )
      const data = await res.json()
      if (data.display_name) {
        onLocationChange(data.display_name)
      }
    } catch {
      // Reverse geocoding failure is not critical
    }
  }, [onLocationChange])

  // Forward search with debounce + AbortController
  const searchNominatim = useCallback((query: string) => {
    clearTimeout(debounceRef.current)
    if (query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          {
            headers: { 'User-Agent': 'AgendaSouterrain/1.0' },
            signal: controller.signal,
          }
        )
        const data: NominatimResult[] = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setSuggestions([])
      }
    }, 500)
  }, [])

  const handleLocationInput = (value: string) => {
    onLocationChange(value)
    searchNominatim(value)
  }

  const handleSuggestionClick = (result: NominatimResult) => {
    onLocationChange(result.display_name)
    onCoordsChange(parseFloat(result.lat), parseFloat(result.lon))
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (readOnly) return
    onCoordsChange(lat, lng)
    reverseGeocode(lat, lng)
  }, [readOnly, onCoordsChange, reverseGeocode])

  const handleMarkerDragEnd = useCallback((e: L.DragEndEvent) => {
    const latlng = e.target.getLatLng()
    onCoordsChange(latlng.lat, latlng.lng)
    reverseGeocode(latlng.lat, latlng.lng)
  }, [onCoordsChange, reverseGeocode])

  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t('location.geolocationError'))
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        onCoordsChange(pos.coords.latitude, pos.coords.longitude)
        reverseGeocode(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setGpsLoading(false)
        toast.error(t('location.geolocationError'))
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [onCoordsChange, reverseGeocode, t])

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null
  const wazeUrl = hasCoords
    ? `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
    : null

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* Location input + GPS button */}
      <div className="flex items-center gap-2">
        <MapPin size={15} className="text-stone-400 flex-shrink-0" />
        <div className="relative flex-1">
          <input
            type="text"
            value={location}
            onChange={(e) => handleLocationInput(e.target.value)}
            readOnly={readOnly}
            placeholder={readOnly ? t('locationPlaceholder') : t('location.searchPlaceholder')}
            className={`w-full text-sm rounded-lg border border-stone-200 px-3 py-2 focus:outline-none
              focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all ${
              readOnly ? 'bg-stone-100 text-stone-400 cursor-default' : 'bg-white'
            }`}
          />
          {/* Nominatim suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-stone-200 z-50 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-b-0 truncate"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleGps}
            disabled={gpsLoading}
            title={t('location.myPosition')}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-400 hover:text-stone-600 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {gpsLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Navigation size={15} />
            )}
          </button>
        )}
      </div>

      {/* Map */}
      {hasCoords && (
        <div className="rounded-xl overflow-hidden border border-stone-200" style={{ height: 200 }}>
          <MapContainer
            center={[latitude!, longitude!]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              position={[latitude!, longitude!]}
              draggable={!readOnly}
              eventHandlers={!readOnly ? { dragend: handleMarkerDragEnd } : undefined}
            />
            <MapUpdater center={[latitude!, longitude!]} />
            {!readOnly && <ClickHandler onClick={handleMapClick} />}
          </MapContainer>
        </div>
      )}

      {/* External links */}
      {hasCoords && (
        <div className="flex gap-2">
          <a
            href={googleMapsUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg
                       border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <ExternalLink size={12} />
            {t('location.openGoogleMaps')}
          </a>
          <a
            href={wazeUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg
                       border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <ExternalLink size={12} />
            {t('location.openWaze')}
          </a>
        </div>
      )}
    </div>
  )
}
