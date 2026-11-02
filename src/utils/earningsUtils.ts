import { Order, RiderProfile } from '../types';

export function getLocalDateString(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return d.toISOString().split('T')[0];
  }
}

export interface CompletedRideRecord {
  id: string;
  orderNumber: string;
  pickupAddress: string;
  dropAddress: string;
  completedAt: string;
  dateKey: string;
  fare: number;
  captainEarning: number;
  platformCommission: number;
  netEarning: number;
  customerId: string;
  customerName: string;
  riderId?: string;
  riderName?: string;
}

export interface DayEarningsSummary {
  dateKey: string;
  formattedDate: string;
  rideCount: number;
  totalFare: number;
  captainEarning: number;
  platformCommission: number;
  netEarning: number;
  rides: CompletedRideRecord[];
}

export function getCompletedRidesForRider(riderId: string, orders: Order[]): CompletedRideRecord[] {
  // Deduplicate orders by ID to guarantee idempotency and duplicate protection
  const seenIds = new Set<string>();
  const completed: CompletedRideRecord[] = [];

  for (const ord of orders) {
    if (ord.riderId === riderId && (ord.status === 'finished' || ord.trackingStep === 'delivered')) {
      if (!seenIds.has(ord.id)) {
        seenIds.add(ord.id);
        const completedTime = ord.deliveredAt || ord.createdAt || new Date().toISOString();
        const dateKey = getLocalDateString(completedTime);
        const fare = ord.fare || 0;
        const commission = fare * 0.10; // 10% platform commission
        const captainEarning = fare; // Captain earns full trip fare
        const netEarning = fare - commission;

        completed.push({
          id: ord.id,
          orderNumber: ord.orderNumber || ord.id.slice(-6).toUpperCase(),
          pickupAddress: ord.pickup?.address || 'Pickup Location',
          dropAddress: ord.destination?.address || 'Drop-off Location',
          completedAt: completedTime,
          dateKey,
          fare,
          captainEarning,
          platformCommission: commission,
          netEarning,
          customerId: ord.customerId,
          customerName: ord.customerName || 'Customer',
          riderId: ord.riderId,
          riderName: ord.riderName,
        });
      }
    }
  }

  // Sort descending by completion time
  completed.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  return completed;
}

export function getAllCompletedRides(orders: Order[]): CompletedRideRecord[] {
  const seenIds = new Set<string>();
  const completed: CompletedRideRecord[] = [];

  for (const ord of orders) {
    if (ord.status === 'finished' || ord.trackingStep === 'delivered') {
      if (!seenIds.has(ord.id)) {
        seenIds.add(ord.id);
        const completedTime = ord.deliveredAt || ord.createdAt || new Date().toISOString();
        const dateKey = getLocalDateString(completedTime);
        const fare = ord.fare || 0;
        const commission = fare * 0.10;
        const captainEarning = fare;
        const netEarning = fare - commission;

        completed.push({
          id: ord.id,
          orderNumber: ord.orderNumber || ord.id.slice(-6).toUpperCase(),
          pickupAddress: ord.pickup?.address || 'Pickup Location',
          dropAddress: ord.destination?.address || 'Drop-off Location',
          completedAt: completedTime,
          dateKey,
          fare,
          captainEarning,
          platformCommission: commission,
          netEarning,
          customerId: ord.customerId,
          customerName: ord.customerName || 'Customer',
          riderId: ord.riderId,
          riderName: ord.riderName || 'Captain',
        });
      }
    }
  }

  completed.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  return completed;
}

export function calculateRiderEarningsSummary(riderId: string, orders: Order[]) {
  const rides = getCompletedRidesForRider(riderId, orders);
  const todayKey = getLocalDateString();

  let todayEarnings = 0;
  let todayCount = 0;
  const historyMap = new Map<string, CompletedRideRecord[]>();

  for (const ride of rides) {
    if (!historyMap.has(ride.dateKey)) {
      historyMap.set(ride.dateKey, []);
    }
    historyMap.get(ride.dateKey)!.push(ride);

    if (ride.dateKey === todayKey) {
      todayEarnings += ride.captainEarning;
      todayCount += 1;
    }
  }

  const history: DayEarningsSummary[] = [];
  const sortedDateKeys = Array.from(historyMap.keys()).sort((a, b) => b.localeCompare(a));

  for (const dateKey of sortedDateKeys) {
    const dayRides = historyMap.get(dateKey)!;
    const totalFare = dayRides.reduce((acc, r) => acc + r.fare, 0);
    const captainEarning = dayRides.reduce((acc, r) => acc + r.captainEarning, 0);
    const platformCommission = dayRides.reduce((acc, r) => acc + r.platformCommission, 0);
    const netEarning = dayRides.reduce((acc, r) => acc + r.netEarning, 0);

    // Format date string nicely e.g. "August 14, 2026"
    let formattedDate = dateKey;
    try {
      const d = new Date(dateKey + 'T00:00:00');
      formattedDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      formattedDate = dateKey;
    }

    history.push({
      dateKey,
      formattedDate,
      rideCount: dayRides.length,
      totalFare,
      captainEarning,
      platformCommission,
      netEarning,
      rides: dayRides,
    });
  }

  return {
    todayEarnings,
    todayCount,
    totalCompletedRides: rides.length,
    history,
    allRides: rides,
  };
}

export function calculateAdminEarningsSummary(orders: Order[], riders: RiderProfile[]) {
  const allRides = getAllCompletedRides(orders);
  const todayKey = getLocalDateString();

  let todayPlatformRides = 0;
  let todayCaptainEarnings = 0;
  let todayPlatformCommission = 0;

  const historyMap = new Map<string, CompletedRideRecord[]>();
  const captainEarningsMap = new Map<string, { riderName: string; count: number; earnings: number }>();

  for (const ride of allRides) {
    if (!historyMap.has(ride.dateKey)) {
      historyMap.set(ride.dateKey, []);
    }
    historyMap.get(ride.dateKey)!.push(ride);

    if (ride.riderId) {
      const existing = captainEarningsMap.get(ride.riderId) || {
        riderName: ride.riderName || riders.find(r => r.id === ride.riderId)?.name || 'Captain',
        count: 0,
        earnings: 0,
      };
      existing.count += 1;
      existing.earnings += ride.captainEarning;
      captainEarningsMap.set(ride.riderId, existing);
    }

    if (ride.dateKey === todayKey) {
      todayPlatformRides += 1;
      todayCaptainEarnings += ride.captainEarning;
      todayPlatformCommission += ride.platformCommission;
    }
  }

  const history: DayEarningsSummary[] = [];
  const sortedDateKeys = Array.from(historyMap.keys()).sort((a, b) => b.localeCompare(a));

  for (const dateKey of sortedDateKeys) {
    const dayRides = historyMap.get(dateKey)!;
    const totalFare = dayRides.reduce((acc, r) => acc + r.fare, 0);
    const captainEarning = dayRides.reduce((acc, r) => acc + r.captainEarning, 0);
    const platformCommission = dayRides.reduce((acc, r) => acc + r.platformCommission, 0);
    const netEarning = dayRides.reduce((acc, r) => acc + r.netEarning, 0);

    let formattedDate = dateKey;
    try {
      const d = new Date(dateKey + 'T00:00:00');
      formattedDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      formattedDate = dateKey;
    }

    history.push({
      dateKey,
      formattedDate,
      rideCount: dayRides.length,
      totalFare,
      captainEarning,
      platformCommission,
      netEarning,
      rides: dayRides,
    });
  }

  const captainBreakdown = Array.from(captainEarningsMap.entries()).map(([riderId, data]) => ({
    riderId,
    ...data,
  })).sort((a, b) => b.earnings - a.earnings);

  return {
    todayPlatformRides,
    todayCaptainEarnings,
    todayPlatformCommission,
    totalCompletedRides: allRides.length,
    history,
    captainBreakdown,
    allRides,
  };
}
