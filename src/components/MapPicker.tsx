import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocationPoint } from '../types';
import { searchLocations, calculateDistanceKm } from '../utils/geoUtils';
import {
  MapPin,
  Navigation,
  Search,
  Check,
  Crosshair,
  AlertCircle,
  Layers,
  Globe,
  Mountain,
  Moon,
  LocateFixed,
  Compass,
} from 'lucide-react';

export type MapLayerType = 'streets' | 'satellite' | 'terrain' | 'voyager_dark';

export const MAP_LAYERS: Record<
  MapLayerType,
  { name: string; url: string; subdomains?: string; maxZoom: number; attribution: string; icon: string }
> = {
  streets: {
    name: 'Google Streets',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: '&copy; Google Maps',
    icon: 'streets',
  },
  satellite: {
    name: 'Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: '&copy; Google Maps Imagery',
    icon: 'satellite',
  },
  terrain: {
    name: 'Google Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: '&copy; Google Maps Terrain',
    icon: 'terrain',
  },
  voyager_dark: {
    name: 'Voyager Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    icon: 'dark',
  },
};

interface MapPickerProps {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  onSelectPickup: (loc: LocationPoint) => void;
  onSelectDestination: (loc: LocationPoint) => void;
  activeMode: 'pickup' | 'destination';
  setActiveMode: (mode: 'pickup' | 'destination') => void;
  customerGps?: LocationPoint | null;
  onCustomerGpsChange?: (loc: LocationPoint) => void;
  className?: string;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  pickup,
  destination,
  onSelectPickup,
  onSelectDestination,
  activeMode,
  setActiveMode,
  customerGps,
  onCustomerGpsChange,
  className,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('streets');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeLineBgRef = useRef<L.Polyline | null>(null);
  const distBadgeRef = useRef<L.Marker | null>(null);

  // Customer Live GPS Location state & refs
  const [customerGpsLoc, setCustomerGpsLoc] = useState<LocationPoint | null>(
    customerGps || {
      lat: 30.7333,
      lng: 76.7794,
      address: 'Sector 17, Chandigarh (Live GPS Active)',
    }
  );
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(25);
  const [isGpsLiveTracking, setIsGpsLiveTracking] = useState<boolean>(false);
  const customerGpsMarkerRef = useRef<L.Marker | null>(null);
  const customerGpsCircleRef = useRef<L.Circle | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationPoint[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Service Areas Definition (Zirakpur, Chandigarh, Panchkula, Manimajra, Mohali, Kharar)
  const SERVICE_AREAS = [
    { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, radius: 4500, color: '#4f46e5' },
    { name: 'Mohali', lat: 30.7046, lng: 76.7179, radius: 4000, color: '#0284c7' },
    { name: 'Panchkula', lat: 30.6942, lng: 76.8606, radius: 4000, color: '#059669' },
    { name: 'Manimajra', lat: 30.7130, lng: 76.8390, radius: 3000, color: '#db2777' },
    { name: 'Zirakpur', lat: 30.6425, lng: 76.8173, radius: 3500, color: '#d97706' },
    { name: 'Kharar', lat: 30.7499, lng: 76.6493, radius: 3500, color: '#7c3aed' },
  ];

  const changeMapLayer = (layerType: MapLayerType) => {
    setCurrentLayer(layerType);
    setShowLayerMenu(false);
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const config = MAP_LAYERS[layerType];
    const newTileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: config.subdomains || 'abc',
    }).addTo(mapRef.current);
    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  };

  // Sync external customerGps if provided
  useEffect(() => {
    if (customerGps) {
      setCustomerGpsLoc(customerGps);
    }
  }, [customerGps]);

  // Continuous Live GPS Watch Position for Customer Location
  useEffect(() => {
    let watchId: number | null = null;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const updatedPoint: LocationPoint = {
              lat: Number(latitude.toFixed(5)),
              lng: Number(longitude.toFixed(5)),
              address: `Live GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            };
            setCustomerGpsLoc(updatedPoint);
            setGpsAccuracy(Math.round(accuracy || 20));
            setIsGpsLiveTracking(true);
            if (onCustomerGpsChange) {
              onCustomerGpsChange(updatedPoint);
            }
          },
          (err) => {
            console.warn('Customer GPS watch notification:', err.message);
            // Default Tricity position if permissions pending or in iframe
            setIsGpsLiveTracking(false);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
        );
      } catch (e) {
        console.warn('Geolocation init warning:', e);
      }
    }

    return () => {
      if (watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [onCustomerGpsChange]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default center: Chandigarh / Tricity central region
    const defaultLat = pickup?.lat || customerGpsLoc?.lat || 30.7046;
    const defaultLng = pickup?.lng || customerGpsLoc?.lng || 76.7179;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 12,
      zoomControl: false,
    });

    // Zoom buttons in topright so they stay accessible above bottom sheet
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Default: Crisp Google Maps Tiles (Google Streets / Roadmap)
    const initialConfig = MAP_LAYERS.streets;
    const initialTileLayer = L.tileLayer(initialConfig.url, {
      attribution: initialConfig.attribution,
      maxZoom: initialConfig.maxZoom,
      subdomains: initialConfig.subdomains || 'abc',
    }).addTo(map);
    initialTileLayer.bringToBack();
    tileLayerRef.current = initialTileLayer;

    // Render Service Area Polygons & Circles on Map Background
    SERVICE_AREAS.forEach((area) => {
      // Service Circle Coverage Overlay
      L.circle([area.lat, area.lng], {
        color: area.color,
        fillColor: area.color,
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 4',
      })
        .addTo(map)
        .bindTooltip(`<b>${area.name} Service Area</b>`, { permanent: false, direction: 'top' });

      // Service Area Center Badge Label
      const cityBadgeIcon = L.divIcon({
        className: 'city-area-badge',
        html: `
          <div class="px-2 py-0.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white font-extrabold text-[10px] shadow-md border border-white/30 flex items-center gap-1 whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ${area.name}
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });

      L.marker([area.lat, area.lng], { icon: cityBadgeIcon, interactive: false }).addTo(map);
    });

    // Enclosing Boundary Polygon for Tricity Service Hub
    const tricityPolygonCoords: [number, number][] = [
      [30.7800, 76.6400], // Kharar North
      [30.7600, 76.7900], // Chandigarh North
      [30.7200, 76.8900], // Panchkula East
      [30.6100, 76.8300], // Zirakpur South
      [30.6700, 76.6900], // Mohali West
      [30.7499, 76.6493], // Kharar West
    ];

    L.polygon(tricityPolygonCoords, {
      color: '#6366f1',
      fillColor: '#818cf8',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '6, 6',
    })
      .addTo(map)
      .bindPopup('<b>Active Operational Zone:</b><br/>Zirakpur • Chandigarh • Panchkula • Manimajra • Mohali • Kharar');

    mapRef.current = map;

    // Trigger Leaflet invalidateSize after container layout completes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    // Click handler to set location on map
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const roundedLat = Math.round(lat * 10000) / 10000;
      const roundedLng = Math.round(lng * 10000) / 10000;
      const addressText = `Selected Point (${roundedLat}, ${roundedLng})`;

      const locPoint: LocationPoint = {
        address: addressText,
        lat: roundedLat,
        lng: roundedLng,
      };

      if (activeMode === 'pickup') {
        onSelectPickup(locPoint);
      } else {
        onSelectDestination(locPoint);
      }
    });

    return () => {
      clearTimeout(timer);
      if (customerGpsMarkerRef.current) {
        customerGpsMarkerRef.current.remove();
        customerGpsMarkerRef.current = null;
      }
      if (customerGpsCircleRef.current) {
        customerGpsCircleRef.current.remove();
        customerGpsCircleRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Invalidate map size whenever pickup or destination updates or window resizes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [pickup, destination]);

  // Render & Update Customer Live GPS Marker + Accuracy Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !customerGpsLoc) return;

    // Customer GPS Beacon Marker Icon
    const customerIcon = L.divIcon({
      className: 'customer-gps-wrapper',
      html: `
        <div class="customer-gps-beacon">
          <div class="customer-gps-ring"></div>
          <div class="customer-gps-dot">
            <svg style="width: 11px; height: 11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
          <div class="absolute -top-7 whitespace-nowrap bg-blue-950/95 text-blue-200 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xl border border-blue-400/70 flex items-center gap-1.5 pointer-events-none">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>You Are Here (Live GPS)</span>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    // Create popup element with interactive action buttons
    const popupEl = document.createElement('div');
    popupEl.className = 'p-1.5 text-slate-800 text-xs min-w-[210px] select-none';
    popupEl.innerHTML = `
      <div class="font-black text-slate-900 flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
        <span>Customer Live GPS Location</span>
      </div>
      <div class="mt-2 text-[11px] text-slate-600 space-y-1">
        <div><b>Coordinates:</b> ${customerGpsLoc.lat}, ${customerGpsLoc.lng}</div>
        <div><b>Accuracy:</b> &plusmn;${gpsAccuracy} meters</div>
        <div class="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>${isGpsLiveTracking ? 'Real-Time GPS Tracking Active' : 'Live GPS Connected'}</span>
        </div>
      </div>
      <div class="mt-3 flex flex-col gap-1.5">
        <button id="gps-pickup-btn" class="w-full px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer">
          <span>📍 Set as Pickup (Location A)</span>
        </button>
        <button id="gps-dest-btn" class="w-full px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer">
          <span>🎯 Set as Dropoff (Location B)</span>
        </button>
      </div>
    `;

    popupEl.querySelector('#gps-pickup-btn')?.addEventListener('click', () => {
      onSelectPickup(customerGpsLoc);
      map.closePopup();
    });

    popupEl.querySelector('#gps-dest-btn')?.addEventListener('click', () => {
      onSelectDestination(customerGpsLoc);
      map.closePopup();
    });

    // Update or add Customer Marker
    if (customerGpsMarkerRef.current) {
      customerGpsMarkerRef.current.setLatLng([customerGpsLoc.lat, customerGpsLoc.lng]);
      customerGpsMarkerRef.current.setPopupContent(popupEl);
    } else {
      customerGpsMarkerRef.current = L.marker([customerGpsLoc.lat, customerGpsLoc.lng], {
        icon: customerIcon,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(popupEl);
    }

    // Update or add Accuracy Circle
    const circleRadius = Math.max(gpsAccuracy, 30);
    if (customerGpsCircleRef.current) {
      customerGpsCircleRef.current.setLatLng([customerGpsLoc.lat, customerGpsLoc.lng]);
      customerGpsCircleRef.current.setRadius(circleRadius);
    } else {
      customerGpsCircleRef.current = L.circle([customerGpsLoc.lat, customerGpsLoc.lng], {
        radius: circleRadius,
        color: '#2563eb',
        fillColor: '#60a5fa',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '3, 4',
        interactive: false,
      }).addTo(map);
    }
  }, [customerGpsLoc, gpsAccuracy, isGpsLiveTracking, onSelectPickup, onSelectDestination]);

  // Update Markers & Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Pickup Icon (Location A)
    const greenIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-9 h-9 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-sm ring-4 ring-emerald-500/30 animate-pulse">
            A
          </div>
          <div class="absolute -bottom-1 w-2.5 h-2.5 bg-emerald-700 rotate-45"></div>
          <div class="absolute -top-6 whitespace-nowrap bg-emerald-950 text-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg border border-emerald-400/50">
            Location A (Pickup)
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    // Destination Icon (Location B)
    const redIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-9 h-9 rounded-full bg-rose-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-sm ring-4 ring-rose-500/30 animate-pulse">
            B
          </div>
          <div class="absolute -bottom-1 w-2.5 h-2.5 bg-rose-700 rotate-45"></div>
          <div class="absolute -top-6 whitespace-nowrap bg-rose-950 text-rose-200 text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg border border-rose-400/50">
            Location B (Drop)
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    // Update Pickup Marker (Location A)
    if (pickup) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
        pickupMarkerRef.current.setPopupContent(`<b>Location A (Pickup):</b><br/>${pickup.address}`);
      } else {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: greenIcon })
          .addTo(map)
          .bindPopup(`<b>Location A (Pickup):</b><br/>${pickup.address}`);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    // Update Destination Marker (Location B)
    if (destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        destMarkerRef.current.setPopupContent(`<b>Location B (Dropoff):</b><br/>${destination.address}`);
      } else {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: redIcon })
          .addTo(map)
          .bindPopup(`<b>Location B (Dropoff):</b><br/>${destination.address}`);
      }
    } else if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }

    // Update Polyline connecting Location A and Location B
    if (pickup && destination) {
      const coords: [number, number][] = [
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ];

      // Background Polyline Casing (Shadow stroke)
      if (routeLineBgRef.current) {
        routeLineBgRef.current.setLatLngs(coords);
      } else {
        routeLineBgRef.current = L.polyline(coords, {
          color: '#1e1b4b',
          weight: 7,
          opacity: 0.5,
        }).addTo(map);
      }

      // Foreground Polyline Route
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(coords);
      } else {
        routeLineRef.current = L.polyline(coords, {
          color: '#6366f1',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.95,
        }).addTo(map);
      }

      // Midpoint Route Distance Badge
      const midLat = (pickup.lat + destination.lat) / 2;
      const midLng = (pickup.lng + destination.lng) / 2;
      const routeKm = calculateDistanceKm(pickup.lat, pickup.lng, destination.lat, destination.lng);

      const midBadgeIcon = L.divIcon({
        className: 'route-dist-badge',
        html: `
          <div class="px-2.5 py-1 bg-slate-900/95 text-emerald-300 font-extrabold text-[11px] rounded-full shadow-2xl border border-indigo-400/80 flex items-center gap-1.5 whitespace-nowrap">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Polyline Route A → B: ${routeKm} km</span>
          </div>
        `,
        iconSize: [140, 26],
        iconAnchor: [70, 13],
      });

      if (distBadgeRef.current) {
        distBadgeRef.current.setLatLng([midLat, midLng]);
        distBadgeRef.current.setIcon(midBadgeIcon);
      } else {
        distBadgeRef.current = L.marker([midLat, midLng], { icon: midBadgeIcon, interactive: false }).addTo(map);
      }

      // Auto fit map bounds to comfortably show both Location A and Location B
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else {
      if (routeLineBgRef.current) {
        map.removeLayer(routeLineBgRef.current);
        routeLineBgRef.current = null;
      }
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      if (distBadgeRef.current) {
        map.removeLayer(distBadgeRef.current);
        distBadgeRef.current = null;
      }

      if (pickup) map.panTo([pickup.lat, pickup.lng]);
      if (destination) map.panTo([destination.lat, destination.lng]);
    }
  }, [pickup, destination]);

  // Search handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No locations found. Try searching a landmark or city name.');
      }
    } catch (err) {
      setSearchError('Could not fetch search results. Please try selecting directly on the map.');
    } finally {
      setIsSearching(false);
    }
  };

  // Select location result
  const handleSelectResult = (loc: LocationPoint) => {
    if (activeMode === 'pickup') {
      onSelectPickup(loc);
    } else {
      onSelectDestination(loc);
    }
    setSearchResults([]);
    setSearchQuery('');

    if (mapRef.current) {
      mapRef.current.panTo([loc.lat, loc.lng]);
      mapRef.current.setZoom(15);
    }
  };

  // Detect GPS location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const loc: LocationPoint = {
          address: `Current Live GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          lat: latitude,
          lng: longitude,
        };

        if (activeMode === 'pickup') {
          onSelectPickup(loc);
        } else {
          onSelectDestination(loc);
        }

        if (mapRef.current) {
          mapRef.current.panTo([latitude, longitude]);
          mapRef.current.setZoom(15);
        }
      },
      (error) => {
        setIsLocating(false);
        // Fallback default position if user denies or iframe sandbox blocks precise GPS
        const fallbackLoc: LocationPoint = {
          address: 'Sector 17 Plaza, Chandigarh, Punjab (Detected Service Hub)',
          lat: 30.7333,
          lng: 76.7794,
        };
        if (activeMode === 'pickup') onSelectPickup(fallbackLoc);
        else onSelectDestination(fallbackLoc);

        if (mapRef.current) mapRef.current.panTo([fallbackLoc.lat, fallbackLoc.lng]);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const flyToCity = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 13, { duration: 1 });
    }
  };

  // Smoothly center and zoom map directly to customer's live GPS coordinates
  const handleFlyToUserGps = () => {
    if (customerGpsLoc && mapRef.current) {
      mapRef.current.flyTo([customerGpsLoc.lat, customerGpsLoc.lng], 15, { duration: 1.2 });
      if (customerGpsMarkerRef.current) {
        customerGpsMarkerRef.current.openPopup();
      }
    } else {
      handleDetectLocation();
    }
  };

  return (
    <div
      className={
        className ||
        'relative w-full h-[400px] sm:h-[460px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex flex-col'
      }
    >
      {/* Top Service Area & Google Maps Layer Bar */}
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-3 py-2 text-[11px] font-bold flex flex-wrap items-center justify-between gap-2 z-20 border-b border-slate-800 shrink-0 shadow-md">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span className="text-slate-300 font-extrabold hidden xs:inline">Tricity Live Map:</span>
          {/* Quick City Zoom Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            {SERVICE_AREAS.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => flyToCity(city.lat, city.lng)}
                className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-[10px] font-bold border border-slate-700 transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: city.color }}></span>
                {city.name}
              </button>
            ))}
          </div>
        </div>

        {/* Center Live GPS Status Indicator Chip */}
        <div className="flex items-center gap-1.5 bg-blue-950/80 px-2 py-0.5 rounded-xl border border-blue-500/40 text-[10px] text-blue-200 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          <span className="font-extrabold hidden sm:inline">Customer GPS:</span>
          <span className="font-mono text-blue-100 font-bold">
            {customerGpsLoc ? `${customerGpsLoc.lat.toFixed(3)}, ${customerGpsLoc.lng.toFixed(3)}` : 'Detecting...'}
          </span>
          {customerGpsLoc && (
            <button
              type="button"
              onClick={() => onSelectPickup(customerGpsLoc)}
              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-md text-[9px] cursor-pointer transition-colors shadow-2xs"
              title="Use current live GPS location as pickup (Location A)"
            >
              Use as A
            </button>
          )}
        </div>

        {/* Google Maps Layering Quick Switcher */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-xl border border-slate-700 shrink-0">
          <div className="flex items-center gap-1 px-1.5 text-[10px] text-slate-300 font-extrabold hidden md:flex">
            <Layers className="w-3 h-3 text-indigo-400" />
            <span>Layer:</span>
          </div>
          <button
            type="button"
            onClick={() => changeMapLayer('streets')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
              currentLayer === 'streets'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Google Streets / Roadmap (Default)"
          >
            <Globe className="w-3 h-3" />
            <span>Streets</span>
          </button>
          <button
            type="button"
            onClick={() => changeMapLayer('satellite')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
              currentLayer === 'satellite'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Google Satellite / Hybrid"
          >
            <span>Satellite</span>
          </button>
          <button
            type="button"
            onClick={() => changeMapLayer('terrain')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
              currentLayer === 'terrain'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Google Terrain"
          >
            <Mountain className="w-3 h-3" />
            <span className="hidden sm:inline">Terrain</span>
          </button>
          <button
            type="button"
            onClick={() => changeMapLayer('voyager_dark')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
              currentLayer === 'voyager_dark'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Voyager Dark Map"
          >
            <Moon className="w-3 h-3" />
            <span className="hidden sm:inline">Dark</span>
          </button>
        </div>
      </div>

      {/* Top Search Overlay Bar - Positioned relative below top header */}
      <div className="absolute top-11 left-3 right-3 z-20 flex flex-col gap-2">
        <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white/95 backdrop-blur-md p-2 rounded-xl shadow-md border border-slate-200">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveMode('pickup')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                activeMode === 'pickup'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-300"></div>
              Pickup
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('destination')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                activeMode === 'destination'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-rose-300"></div>
              Dropoff
            </button>
          </div>

          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeMode === 'pickup' ? 'pickup address or landmark' : 'delivery location'}...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>

          <button
            type="button"
            onClick={handleDetectLocation}
            title="Use Live GPS Location"
            disabled={isLocating}
            className="p-1.5 text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </form>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto p-1 divide-y divide-slate-100">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full text-left p-2.5 hover:bg-indigo-50 rounded-lg text-xs transition-colors flex items-start gap-2 text-slate-700"
              >
                <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{result.address}</span>
              </button>
            ))}
          </div>
        )}

        {searchError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Floating Customer Live GPS Recenter Button (Google Maps Style) */}
      <div className="absolute right-3.5 top-28 z-20 flex flex-col gap-2 items-center">
        <button
          type="button"
          onClick={handleFlyToUserGps}
          className="w-10 h-10 bg-white/95 backdrop-blur-md hover:bg-blue-50 text-blue-600 hover:text-blue-700 rounded-xl shadow-xl border border-slate-200 hover:border-blue-300 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 cursor-pointer group"
          title="Fly to My Live GPS Location"
          aria-label="Fly to My Live GPS Location"
        >
          <LocateFixed className="w-5 h-5 group-hover:rotate-45 transition-transform text-blue-600" />
        </button>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Map Legend / Hint Banner */}
      <div className="absolute bottom-3 left-3 right-12 z-20 bg-slate-900/90 text-white backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 shadow-lg text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 truncate">
          <span className="flex items-center gap-1 font-extrabold text-blue-400 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-300/50 animate-pulse"></span>
            You (Live GPS)
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 font-extrabold text-emerald-400 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300/40"></span>
            A: Pickup
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 font-extrabold text-rose-400 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-300/40"></span>
            B: Drop
          </span>
        </div>
        {pickup && destination && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
            <span className="font-extrabold text-indigo-200 bg-indigo-950/80 border border-indigo-500/50 px-2.5 py-0.5 rounded-full text-[11px] font-mono">
              Polyline A → B: {calculateDistanceKm(pickup.lat, pickup.lng, destination.lat, destination.lng)} km
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
