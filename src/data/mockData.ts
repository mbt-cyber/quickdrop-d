import { Order, UserProfile, RiderProfile } from '../types';
import { formatBookingDayAndTime } from '../utils/geoUtils';

export const INITIAL_USER: UserProfile = {
  id: 'usr_default',
  name: '',
  phone: '',
  email: '',
  photo: '',
  savedAddresses: [],
};

export const INITIAL_RIDERS: RiderProfile[] = [
  {
    id: 'rdr_1',
    name: 'Rahul Rider',
    phone: '+91 98111 22334',
    email: 'rahul.rider@quickdrop.in',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    rating: 4.9,
    vehicle: 'Honda Activa EV',
    plateNumber: 'PB65-EV-9911',
    drivingLicence: 'PB6520240012345',
    rcNumber: 'PB65AB1234',
    aadhaarCard: '**** **** 4321',
    panCard: 'ABCDE1234F',
    kycStatus: 'approved',
    kycRemarks: 'Verified by Admin',
    currentLat: 30.7333,
    currentLng: 76.7794,
    isOnline: true,
    totalDeliveries: 142,
    todayEarnings: 1250,
    walletBalance: 250,
    createdAt: '2026-06-15', // Old signup
    isBlocked: false,
  },
  {
    id: 'rdr_2',
    name: 'Vikram Singh',
    phone: '+91 97222 33445',
    email: 'vikram.singh@gmail.com',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    rating: 4.8,
    vehicle: 'Hero Electric',
    plateNumber: 'PB11-EL-4455',
    drivingLicence: 'PB1120250098765',
    rcNumber: 'PB11XY5678',
    aadhaarCard: '**** **** 8765',
    panCard: 'FGHIJ5678K',
    kycStatus: 'approved',
    kycRemarks: 'Verified by Admin',
    currentLat: 30.7400,
    currentLng: 76.7800,
    isOnline: true,
    totalDeliveries: 8,
    todayEarnings: 320,
    walletBalance: 150,
    createdAt: '2026-08-03', // New signup
    isBlocked: false,
  },
];

export const INITIAL_ORDERS: Order[] = [];
