export type Role = 'customer' | 'rider' | 'admin';

export type OrderStatus = 'pending' | 'running' | 'finished' | 'cancelled';

export type DeliveryType = 'documents' | 'small_parcel' | 'gift' | 'food' | 'medicine';

export type PaymentMethod = 'cash' | 'qr' | 'upi';

export type PaymentStatus = 'pending' | 'completed';

export type TrackingStep = 'accepted' | 'arrived_pickup' | 'picked_up' | 'in_transit' | 'arrived_drop' | 'delivered';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  landmark?: string;
}

export interface ContactInfo {
  name: string;
  phone: string;
  notes?: string;
}

export type RecipientInfo = ContactInfo;
export type SenderInfo = ContactInfo;

export interface SavedAddress {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  type: 'home' | 'office' | 'other';
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  photo: string;
  savedAddresses: SavedAddress[];
  isBlocked?: boolean;
  blockReason?: string;
  createdAt?: string;
}

export interface SupabaseUserProfile {
  id: string;
  email?: string;
  phone?: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
  is_blocked?: boolean;
  block_reason?: string;
}


export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photo: string;
  rating: number;
  vehicle: string;
  plateNumber: string;
  drivingLicence?: string;
  drivingLicenceImg?: string;
  rcNumber?: string;
  rcImg?: string;
  aadhaarCard?: string;
  aadhaarImg?: string;
  panCard?: string;
  panImg?: string;
  kycStatus?: 'approved' | 'pending' | 'rejected';
  kycRemarks?: string;
  currentLat: number;
  currentLng: number;
  isOnline: boolean;
  totalDeliveries: number;
  todayEarnings: number;
  walletBalance?: number;
  customQrImage?: string;
  isBlocked?: boolean;
  blockReason?: string;
  nameLocked?: boolean;
  photoLocked?: boolean;
  createdAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  pickup: LocationPoint;
  destination: LocationPoint;
  distanceKm: number;
  fare: number;
  deliveryType: DeliveryType;
  scheduleType: 'now' | 'later';
  scheduledDateTime: string;
  bookingDayAndTime: string; // Required display text for booking day and time
  sender?: SenderInfo;
  recipient: RecipientInfo;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  upiTxnId?: string;
  status: OrderStatus;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderPhoto?: string;
  riderVehicle?: string;
  trackingStep?: TrackingStep;
  createdAt: string;
  acceptedAt?: string;
  deliveredAt?: string;
  otpCode: string;
  proofPhotoUrl?: string;
  riderSenderMessages?: { id: string; text: string; time: string }[];
  riderRecipientMessages?: { id: string; text: string; time: string }[];
  customerChatMessages?: { id: string; sender: 'customer' | 'rider'; text: string; time: string }[];
}

export interface WalletRechargeRequest {
  id: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  amount: number;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SupportChatMessage {
  id: string;
  riderId: string;
  sender: 'rider' | 'admin';
  text: string;
  screenshotUrl?: string;
  amount?: number;
  time: string;
}

