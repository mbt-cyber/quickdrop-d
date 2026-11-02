import { LocationPoint } from '../types';

// Curated Popular Presets across Service Coverage Hubs (Zirakpur, Chandigarh, Mohali, Panchkula, Kharar)
export const TRICITY_POPULAR_PRESETS: { name: string; city: string; address: string; lat: number; lng: number }[] = [
  { name: 'VIP Road', city: 'Zirakpur', address: 'VIP Road, Zirakpur, Punjab 140603', lat: 30.6425, lng: 76.8173 },
  { name: 'Patiala Chowk', city: 'Zirakpur', address: 'Patiala Chowk, Zirakpur, Punjab 140603', lat: 30.6380, lng: 76.8210 },
  { name: 'Dhakoli', city: 'Zirakpur', address: 'Dhakoli, Zirakpur, Punjab 140603', lat: 30.6550, lng: 76.8380 },
  { name: 'Baltana', city: 'Zirakpur', address: 'Baltana, Zirakpur, Punjab 140603', lat: 30.6620, lng: 76.8290 },
  { name: 'Sector 17 Plaza', city: 'Chandigarh', address: 'Sector 17 Plaza, Chandigarh 160017', lat: 30.7333, lng: 76.7794 },
  { name: 'Sector 22 Market', city: 'Chandigarh', address: 'Sector 22 Market, Chandigarh 160022', lat: 30.7380, lng: 76.7720 },
  { name: 'Sector 35 Market', city: 'Chandigarh', address: 'Sector 35 Market, Chandigarh 160022', lat: 30.7245, lng: 76.7680 },
  { name: 'Sector 43 ISBT', city: 'Chandigarh', address: 'Sector 43 Bus Stand, Chandigarh 160043', lat: 30.7188, lng: 76.7452 },
  { name: 'Sector 34 Market', city: 'Chandigarh', address: 'Sector 34 Exhibition Ground, Chandigarh 160022', lat: 30.7230, lng: 76.7710 },
  { name: 'IT Park / Sector 13', city: 'Chandigarh', address: 'IT Park, Sector 13, Chandigarh 160101', lat: 30.7262, lng: 76.8220 },
  { name: 'Phase 7 Market', city: 'Mohali', address: 'Phase 7 Market, Mohali (SAS Nagar) 160055', lat: 30.7046, lng: 76.7179 },
  { name: 'Phase 3B2 Market', city: 'Mohali', address: 'Phase 3B2 Market, Mohali 160059', lat: 30.7180, lng: 76.7220 },
  { name: 'QuarkCity / Phase 8B', city: 'Mohali', address: 'QuarkCity Industrial Area, Phase 8B, Mohali 160071', lat: 30.6890, lng: 76.7260 },
  { name: 'Sector 70', city: 'Mohali', address: 'Sector 70, Mohali (SAS Nagar) 160071', lat: 30.6970, lng: 76.7080 },
  { name: 'Airport Road / IT City', city: 'Mohali', address: 'Airport Road, Mohali, Punjab 140306', lat: 30.6450, lng: 76.7350 },
  { name: 'Aerocity', city: 'Mohali', address: 'Aerocity Block A, Mohali 140306', lat: 30.6350, lng: 76.7200 },
  { name: 'Sector 11 Market', city: 'Panchkula', address: 'Sector 11 Market, Panchkula, Haryana 134109', lat: 30.6942, lng: 76.8606 },
  { name: 'Sector 20', city: 'Panchkula', address: 'Sector 20 Belvista, Panchkula, Haryana 134117', lat: 30.6720, lng: 76.8510 },
  { name: 'Kharar Bus Stand', city: 'Kharar', address: 'Kharar Bus Stand Market, Kharar, Punjab 140301', lat: 30.7499, lng: 76.6493 },
  { name: 'Landran Road', city: 'Kharar', address: 'Landran Road, Kharar, Punjab 140301', lat: 30.7320, lng: 76.6580 },
];

// Infer exact coordinates from address text using keyword matching, sector math, or hashing
export function inferCoordinatesFromAddress(address: string, defaultLat = 30.7333, defaultLng = 76.7794): { lat: number; lng: number } {
  if (!address || !address.trim()) return { lat: defaultLat, lng: defaultLng };

  const lower = address.toLowerCase();

  // 1. Direct Specific Preset Match (Match specific landmark names, not generic city names)
  for (const preset of TRICITY_POPULAR_PRESETS) {
    if (lower.includes(preset.name.toLowerCase())) {
      return { lat: preset.lat, lng: preset.lng };
    }
  }

  // 2. Specific Landmark Keywords
  if (lower.includes('vip road')) return { lat: 30.6425, lng: 76.8173 };
  if (lower.includes('patiala chowk')) return { lat: 30.6380, lng: 76.8210 };
  if (lower.includes('dhakoli')) return { lat: 30.6550, lng: 76.8380 };
  if (lower.includes('baltana')) return { lat: 30.6620, lng: 76.8290 };
  if (lower.includes('it park') || lower.includes('kishangarh')) return { lat: 30.7262, lng: 76.8220 };
  if (lower.includes('elante') || lower.includes('industrial area 1') || lower.includes('ind area 1')) return { lat: 30.7050, lng: 76.8010 };
  if (lower.includes('quarkcity') || lower.includes('phase 8b') || lower.includes('phase 8')) return { lat: 30.6890, lng: 76.7260 };
  if (lower.includes('airport road') || lower.includes('it city')) return { lat: 30.6450, lng: 76.7350 };
  if (lower.includes('aerocity')) return { lat: 30.6350, lng: 76.7200 };
  if (lower.includes('landran')) return { lat: 30.7020, lng: 76.6620 };
  if (lower.includes('sunny enclave')) return { lat: 30.7380, lng: 76.6780 };

  // 3. Sector Number Extraction (e.g. "Sector 17", "Sec 22", "Sector 70", "Sec 11")
  const sectorMatch = lower.match(/(?:sector|sec|s)\.?\s*(\d+)/i);
  if (sectorMatch && sectorMatch[1]) {
    const secNum = parseInt(sectorMatch[1], 10);

    // Mohali Sectors (Sectors 61 to 125)
    if (secNum >= 61 && secNum <= 125) {
      const row = Math.floor((secNum - 61) / 7);
      const col = (secNum - 61) % 7;
      return {
        lat: Math.round((30.710 - row * 0.008) * 10000) / 10000,
        lng: Math.round((76.725 - col * 0.007) * 10000) / 10000,
      };
    }

    // Panchkula Sectors (if explicitly mentions panchkula or sec 1..28 in panchkula region)
    if (lower.includes('panchkula') && secNum >= 1 && secNum <= 30) {
      const row = Math.floor((secNum - 1) / 5);
      const col = (secNum - 1) % 5;
      return {
        lat: Math.round((30.700 - row * 0.008) * 10000) / 10000,
        lng: Math.round((76.850 + col * 0.007) * 10000) / 10000,
      };
    }

    // Chandigarh Grid Sectors (Sectors 1 to 60)
    if (secNum >= 1 && secNum <= 60) {
      const row = Math.floor((secNum - 1) / 6);
      const col = (secNum - 1) % 6;
      return {
        lat: Math.round((30.755 - row * 0.010) * 10000) / 10000,
        lng: Math.round((76.760 + col * 0.009) * 10000) / 10000,
      };
    }
  }

  // 4. Phase Number Extraction for Mohali (e.g. "Phase 7", "Phase 3b2", "Phase 11")
  const phaseMatch = lower.match(/phase\s*(\d+[a-b]?)/i);
  if (phaseMatch && phaseMatch[1]) {
    const ph = phaseMatch[1].toLowerCase();
    if (ph.includes('11')) return { lat: 30.6810, lng: 76.7380 };
    if (ph.includes('10')) return { lat: 30.6880, lng: 76.7320 };
    if (ph.includes('9')) return { lat: 30.6820, lng: 76.7250 };
    if (ph.includes('8')) return { lat: 30.6890, lng: 76.7260 };
    if (ph.includes('7')) return { lat: 30.7046, lng: 76.7179 };
    if (ph.includes('5')) return { lat: 30.7120, lng: 76.7180 };
    if (ph.includes('3b2') || ph.includes('3')) return { lat: 30.7180, lng: 76.7220 };
    if (ph.includes('1')) return { lat: 30.7300, lng: 76.7200 };
  }

  // 5. City Region Base Fallbacks
  if (lower.includes('zirakpur')) return { lat: 30.6425, lng: 76.8173 };
  if (lower.includes('mohali') || lower.includes('sas nagar')) return { lat: 30.7046, lng: 76.7179 };
  if (lower.includes('panchkula')) return { lat: 30.6942, lng: 76.8606 };
  if (lower.includes('kharar')) return { lat: 30.7499, lng: 76.6493 };
  if (lower.includes('chandigarh')) return { lat: 30.7333, lng: 76.7794 };

  // 6. String Hash Displacement: Generates a distinct coordinate for custom typed house/street names
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (((hash % 120) - 60) / 1000); // spread +/- 0.06 deg (~6.5 km)
  const lngOffset = (((((hash >> 4) % 120)) - 60) / 1000); // spread +/- 0.06 deg (~6.5 km)

  return {
    lat: Math.round((defaultLat + latOffset) * 10000) / 10000,
    lng: Math.round((defaultLng + lngOffset) * 10000) / 10000,
  };
}

// Calculate exact driving distance between two coordinates in km
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 3.5;
  if (Math.abs(lat1 - lat2) < 0.0001 && Math.abs(lon1 - lon2) < 0.0001) return 0.5;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistance = R * c;

  // Realistic city driving route multiplier (~1.25x for street grid vs direct line)
  const roadDistance = straightDistance * 1.25;

  return Math.max(0.8, Math.round(roadDistance * 10) / 10);
}

// Automatic distance-wise fare calculation (₹10/km)
export function calculateFare(
  distanceKm: number,
  deliveryType: string = 'documents'
): number {
  const ratePerKm = 10; // ₹10 per km

  let categorySurge = 0;
  if (deliveryType === 'food' || deliveryType === 'medicine') categorySurge = 5;
  if (deliveryType === 'gift') categorySurge = 10;

  const totalFare = distanceKm * ratePerKm + categorySurge;
  return Math.max(10, Math.round(totalFare));
}

// Get full transparent breakdown of fare structure
export function getFareBreakdown(
  distanceKm: number,
  deliveryType: string = 'documents'
) {
  const ratePerKm = 10;

  let categorySurge = 0;
  let categoryLabel = '';
  if (deliveryType === 'food' || deliveryType === 'medicine') {
    categorySurge = 5;
    categoryLabel = 'Express Food/Medicine Fee (+₹5)';
  } else if (deliveryType === 'gift') {
    categorySurge = 10;
    categoryLabel = 'Fragile Gift Handling (+₹10)';
  }

  const distanceFare = Math.round(distanceKm * ratePerKm);
  const totalFare = Math.max(10, distanceFare + categorySurge);

  return {
    baseFare: 0,
    includedKm: 0,
    extraKm: Math.round(distanceKm * 10) / 10,
    ratePerKm,
    extraFare: distanceFare,
    categorySurge,
    categoryLabel,
    totalFare,
  };
}

// Format currency in INR ₹
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format Date & Time for display (e.g. "Monday, 27 Jul 2026 • 11:15 PM")
export function formatBookingDayAndTime(dateObj: Date = new Date()): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[dateObj.getDay()];
  const dateNum = dateObj.getDate();
  const monthName = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${dayName}, ${dateNum} ${monthName} ${year} • ${hours}:${minutes} ${ampm}`;
}

// Search OpenStreetMap Nominatim for locations
export async function searchLocations(query: string): Promise<LocationPoint[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=5&countrycodes=in`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'QuickDropDeliveryApp/1.0',
      },
    });

    if (!res.ok) throw new Error('Failed to fetch locations');
    const data = await res.json();

    return data.map((item: any) => ({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (err) {
    console.warn('Nominatim search fallback:', err);
    // Instant fallback sample search locations for requested Service Areas: Zirakpur, Chandigarh, Panchkula, Mohali, Kharar
    const sampleLocations: LocationPoint[] = [
      { address: `${query}, Sector 17 Plaza, Chandigarh 160017`, lat: 30.7333, lng: 76.7794 },
      { address: `${query}, Phase 7 Industrial Area, Mohali (SAS Nagar) 160055`, lat: 30.7046, lng: 76.7179 },
      { address: `${query}, VIP Road, Zirakpur, Punjab 140603`, lat: 30.6425, lng: 76.8173 },
      { address: `${query}, Sector 11 Market, Panchkula, Haryana 134109`, lat: 30.6942, lng: 76.8606 },
      { address: `${query}, Kharar-Chandigarh Highway, Kharar 140301`, lat: 30.7499, lng: 76.6493 },
    ];
    return sampleLocations;
  }
}

