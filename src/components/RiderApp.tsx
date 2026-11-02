import React, { useState, useEffect, useRef } from 'react';
import { Order, RiderProfile, WalletRechargeRequest, SupportChatMessage } from '../types';
import { formatCurrency } from '../utils/geoUtils';
import { calculateRiderEarningsSummary, DayEarningsSummary, CompletedRideRecord } from '../utils/earningsUtils';
import { uploadQuickDropFile } from '../lib/appwrite';
import { broadcastSyncEvent } from '../lib/syncEngine';
import { useAuth } from '../hooks/useAuth';
import {
  Bike,
  CheckCircle2,
  XCircle,
  Clock,
  Navigation,
  Phone,
  ShieldCheck,
  DollarSign,
  MapPin,
  ArrowRight,
  Package,
  Camera,
  Key,
  AlertCircle,
  MessageSquare,
  Send,
  LogIn,
  LogOut,
  Trash2,
  AlertTriangle,
  User,
  Mail,
  FileText,
  CreditCard,
  BadgeCheck,
  Upload,
  Image as ImageIcon,
  Eye,
  X,
  Lock,
  RefreshCw,
  Edit,
  QrCode,
  Percent,
} from 'lucide-react';

interface RiderAppProps {
  rider: RiderProfile;
  orders: Order[];
  platformQrImage?: string;
  onAcceptOrder: (orderId: string, rider: RiderProfile) => void;
  onDeclineOrder?: (orderId: string) => void;
  onUpdateOrderStatus: (orderId: string, trackingStep: any, isFinished?: boolean) => void;
  onOpenAuthModal?: () => void;
  onUpdateRiderKyc?: (
    riderId: string,
    status: 'approved' | 'pending' | 'rejected',
    remarks?: string,
    docs?: {
      drivingLicence?: string;
      drivingLicenceImg?: string;
      rcNumber?: string;
      rcImg?: string;
      aadhaarCard?: string;
      aadhaarImg?: string;
      panCard?: string;
      panImg?: string;
    }
  ) => void;
  onToggleOnline?: (isOnline: boolean) => void;
  onUpdatePhoto?: (newPhotoUrl: string) => void;
  onUpdateRiderProfile?: (fields: Partial<RiderProfile>) => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
  supportChatMessages?: SupportChatMessage[];
  walletRechargeRequests?: WalletRechargeRequest[];
  onSendSupportMessage?: (msg: { riderId: string; sender: 'rider' | 'admin'; text: string; screenshotUrl?: string; amount?: number }) => void;
  onCreateRechargeRequest?: (req: { riderId: string; riderName: string; riderPhone: string; amount: number; screenshotUrl: string }) => void;
}

export const RiderApp: React.FC<RiderAppProps> = ({
  rider: riderProp,
  orders,
  platformQrImage,
  supportChatMessages = [],
  walletRechargeRequests = [],
  onAcceptOrder,
  onDeclineOrder,
  onUpdateOrderStatus,
  onOpenAuthModal,
  onUpdateRiderKyc,
  onToggleOnline,
  onUpdatePhoto,
  onUpdateRiderProfile,
  onUpdateOrder,
  onSendSupportMessage,
  onCreateRechargeRequest,
}) => {
  const { signOut } = useAuth();
  const rider = riderProp || {
    id: 'rdr_1',
    name: 'Rahul Rider',
    phone: '+91 98111 22334',
    email: 'rahul.rider@quickdrop.in',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    rating: 4.9,
    vehicle: 'Honda Activa EV',
    plateNumber: 'PB65-EV-9911',
    kycStatus: 'approved',
    todayEarnings: 1250,
  };
  const [activeTab, setActiveTab] = useState<'pending' | 'running' | 'finished' | 'profile'>('pending');
  const [profileSubTab, setProfileSubTab] = useState<'overview' | 'edit_profile' | 'submit_docs' | 'resubmit_docs'>('overview');
  const [isOnline, setIsOnline] = useState(rider?.isOnline ?? true);
  const [isEarningsModalOpen, setIsEarningsModalOpen] = useState(false);
  const [expandedEarningsDateKey, setExpandedEarningsDateKey] = useState<string | null>(null);
  const [finishedViewMode, setFinishedViewMode] = useState<'list' | 'datewise'>('list');
  const [expandedFinishedDateKey, setExpandedFinishedDateKey] = useState<string | null>(null);

  useEffect(() => {
    if (rider?.isOnline !== undefined) {
      setIsOnline(rider.isOnline);
    }
  }, [rider?.isOnline]);

  const earningsSummary = calculateRiderEarningsSummary(rider.id, orders);
  const [riderPhotoSuccessToast, setRiderPhotoSuccessToast] = useState(false);
  const riderPhotoInputRef = useRef<HTMLInputElement>(null);

  // Edit Profile Form State
  const [editName, setEditName] = useState(rider?.name || '');
  const [editPhone, setEditPhone] = useState(rider?.phone || '');
  const [editEmail, setEditEmail] = useState(rider?.email || '');
  const [editVehicle, setEditVehicle] = useState(rider?.vehicle || '');
  const [editPlateNumber, setEditPlateNumber] = useState(rider?.plateNumber || '');
  const [profileSaveSuccessToast, setProfileSaveSuccessToast] = useState(false);
  const [profileEditError, setProfileEditError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync edit profile form state whenever rider prop changes
  useEffect(() => {
    if (rider) {
      setEditName(rider.name || '');
      setEditPhone(rider.phone || '');
      setEditEmail(rider.email || '');
      setEditVehicle(rider.vehicle || '');
      setEditPlateNumber(rider.plateNumber || '');
    }
  }, [rider?.name, rider?.phone, rider?.email, rider?.vehicle, rider?.plateNumber]);

  const handleSaveRiderProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setProfileEditError('Full Name is required.');
      return;
    }
    if (!editPhone.trim()) {
      setProfileEditError('Phone Number is required.');
      return;
    }
    setProfileEditError('');
    setIsSavingProfile(true);

    try {
      if (onUpdateRiderProfile) {
        onUpdateRiderProfile({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          vehicle: editVehicle.trim() || 'Motorcycle',
          plateNumber: editPlateNumber.trim().toUpperCase() || 'MH-12-EX-1000',
        });
      }
      await new Promise((res) => setTimeout(res, 500));
      setProfileSaveSuccessToast(true);
      setTimeout(() => setProfileSaveSuccessToast(false), 4000);
      setProfileSubTab('overview');
    } catch (err) {
      setProfileEditError('Failed to save profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRiderPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Selected file size exceeds 10MB limit. Please choose a smaller file.');
        return;
      }
      try {
        const fileUrl = await uploadQuickDropFile(file, 'rider-photos');
        if (fileUrl) {
          if (onUpdatePhoto) {
            onUpdatePhoto(fileUrl);
          }
          if (onUpdateRiderProfile) {
            onUpdateRiderProfile({ photo: fileUrl });
          }
          setRiderPhotoSuccessToast(true);
          setTimeout(() => setRiderPhotoSuccessToast(false), 3500);
        }
      } catch (err) {
        console.warn('Failed to upload photo to Supabase storage:', err);
      }
    }
  };

  // Sync rider.isOnline prop state if it updates from parent
  useEffect(() => {
    if (rider && rider.isOnline !== undefined) {
      setIsOnline(rider.isOnline);
    }
  }, [rider?.isOnline]);

  const handleToggleOnline = (targetState?: boolean) => {
    const nextState = targetState !== undefined ? targetState : !isOnline;
    setIsOnline(nextState);
    if (onToggleOnline) {
      onToggleOnline(nextState);
    }
  };

  // Real-time Delivery Partner Live GPS Tracking & Backend Server Synchronization
  useEffect(() => {
    if (!isOnline || !rider?.id) return;

    // Send immediate initial position to backend server
    broadcastSyncEvent({
      type: 'RIDER_LOCATION_UPDATED',
      riderId: rider.id,
      lat: rider.currentLat || 19.076,
      lng: rider.currentLng || 72.8777,
      heading: 0,
      speed: 0,
    });

    let watchId: number | null = null;
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, heading, speed } = pos.coords;
            broadcastSyncEvent({
              type: 'RIDER_LOCATION_UPDATED',
              riderId: rider.id,
              lat: latitude,
              lng: longitude,
              heading: heading || 0,
              speed: speed || 0,
            });
            if (onUpdateRiderProfile) {
              onUpdateRiderProfile({ currentLat: latitude, currentLng: longitude });
            }
          },
          () => {
            // Geolocation error or permission denied
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      } catch (e) {}
    }

    return () => {
      if (watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline, rider?.id]);
  const [otpInput, setOtpInput] = useState<Record<string, string>>({});
  const [otpError, setOtpError] = useState<Record<string, string>>({});

  // Editable Document Numbers State
  const [docDlNumber, setDocDlNumber] = useState(rider?.drivingLicence || '');
  const [docRcNumber, setDocRcNumber] = useState(rider?.rcNumber || '');
  const [docAadhaarNumber, setDocAadhaarNumber] = useState(rider?.aadhaarCard || '');
  const [docPanNumber, setDocPanNumber] = useState(rider?.panCard || '');
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Document Images State for Driving Licence, RC, Aadhaar, PAN
  const [docImages, setDocImages] = useState<{
    dl?: string;
    rc?: string;
    aadhaar?: string;
    pan?: string;
  }>({
    dl: rider?.drivingLicenceImg || '',
    rc: rider?.rcImg || '',
    aadhaar: rider?.aadhaarImg || '',
    pan: rider?.panImg || '',
  });
  const [selectedDocPreview, setSelectedDocPreview] = useState<{ title: string; url: string } | null>(null);
  const [showKycBlockModal, setShowKycBlockModal] = useState(false);
  const [showWalletQrModal, setShowWalletQrModal] = useState(false);
  const [walletRechargeSuccessToast, setWalletRechargeSuccessToast] = useState(false);
  const [supportMessageText, setSupportMessageText] = useState('');
  const [supportRechargeAmount, setSupportRechargeAmount] = useState<number>(100);
  const [supportScreenshot, setSupportScreenshot] = useState<string>('');

  const handleWalletRecharge = () => {
    const currentBalance = rider.walletBalance || 0;
    const newBalance = currentBalance + 100;
    if (onUpdateRiderProfile) {
      onUpdateRiderProfile({ walletBalance: newBalance });
    }
    setShowWalletQrModal(false);
    setWalletRechargeSuccessToast(true);
    setTimeout(() => setWalletRechargeSuccessToast(false), 4000);
  };

  // Synchronize rider props into document form state
  useEffect(() => {
    if (rider) {
      setDocDlNumber(rider.drivingLicence || '');
      setDocRcNumber(rider.rcNumber || '');
      setDocAadhaarNumber(rider.aadhaarCard || '');
      setDocPanNumber(rider.panCard || '');
      setDocImages({
        dl: rider.drivingLicenceImg || '',
        rc: rider.rcImg || '',
        aadhaar: rider.aadhaarImg || '',
        pan: rider.panImg || '',
      });
    }
  }, [rider?.id, rider?.kycStatus, rider?.drivingLicence, rider?.rcNumber, rider?.aadhaarCard, rider?.panCard, rider?.drivingLicenceImg, rider?.rcImg, rider?.aadhaarImg, rider?.panImg]);

  const handleDocUpload = async (docKey: 'dl' | 'rc' | 'aadhaar' | 'pan', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Selected file size exceeds 10MB limit. Please choose a smaller file.');
        return;
      }
      try {
        const fileUrl = await uploadQuickDropFile(file, `rider-kyc-${docKey}`);
        if (fileUrl) {
          setDocImages((prev) => ({
            ...prev,
            [docKey]: fileUrl,
          }));
        }
      } catch (err) {
        console.warn('Failed to upload document to Supabase storage:', err);
      }
    }
  };

  const handleReSubmitVerification = () => {
    if (onUpdateRiderKyc) {
      onUpdateRiderKyc(rider.id, 'pending', 'Submitted for review by delivery partner', {
        drivingLicence: docDlNumber,
        drivingLicenceImg: docImages.dl,
        rcNumber: docRcNumber,
        rcImg: docImages.rc,
        aadhaarCard: docAadhaarNumber,
        aadhaarImg: docImages.aadhaar,
        panCard: docPanNumber,
        panImg: docImages.pan,
      });
      setSubmitFeedback('Documents submitted successfully! QuickDrop Admin will review and verify your account shortly.');
      setTimeout(() => setSubmitFeedback(null), 8000);
    }
  };

  const scrollToCustomerChat = (orderId: string) => {
    const el = document.getElementById(`customer-chat-${orderId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const [riderChatInputs, setRiderChatInputs] = useState<Record<string, string>>({});

  const handleSendCustomerChat = (orderId: string) => {
    const text = (riderChatInputs[orderId] || '').trim();
    if (!text) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: 'rider' as const,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedMessages = [...(targetOrder.customerChatMessages || []), newMsg];
    const updatedOrder = {
      ...targetOrder,
      customerChatMessages: updatedMessages,
    };
    setRiderChatInputs((prev) => ({ ...prev, [orderId]: '' }));
    if (onUpdateOrder) {
      onUpdateOrder(updatedOrder);
    }
  };

  // Filter Orders for Rider Feeds
  const pendingRequests = orders.filter((o) => o.status === 'pending');
  const runningOrders = orders.filter(
    (o) => o.status === 'running' && (o.riderId === rider.id || !o.riderId)
  );
  const finishedOrders = orders.filter(
    (o) => o.status === 'finished' && o.riderId === rider.id
  );

  const openNavigationMap = (lat?: number, lng?: number, address?: string) => {
    let url = '';
    if (lat && lng) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (address) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    } else {
      url = `https://www.google.com/maps`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleVerifyDelivery = (order: Order) => {
    const entered = otpInput[order.id] || '';
    if (entered.trim() === order.otpCode) {
      onUpdateOrderStatus(order.id, 'delivered', true);
      setOtpError((prev) => ({ ...prev, [order.id]: '' }));
    } else {
      setOtpError((prev) => ({
        ...prev,
        [order.id]: `Invalid OTP code. Ask customer for 4-digit PIN (${order.otpCode}).`,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Rider Top Status Banner */}
      <div className="bg-slate-900 text-white p-6 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={rider.photo}
                alt={rider.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                  isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              ></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading">{rider.name}</h1>
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-md">
                  ★ {rider.rating}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {rider.vehicle} • <span className="text-slate-300">{rider.plateNumber}</span>
              </p>
            </div>
          </div>

          {/* Stats & Duty Switch */}
          <div className="flex items-center gap-4">
            <div 
              onClick={() => setIsEarningsModalOpen(true)}
              className="bg-slate-800 px-4 py-2 rounded-xl text-center border border-slate-700 cursor-pointer hover:bg-slate-700/80 transition-all shadow-xs"
              title="Click to view Today's Earnings & History"
            >
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Today's Earnings</span>
              <span className="text-lg font-black text-emerald-400 font-heading">
                {formatCurrency(earningsSummary.todayEarnings)}
              </span>
              <span className="text-[9px] text-slate-400 block font-medium">
                {earningsSummary.todayCount} completed rides
              </span>
            </div>

            <div className="bg-slate-800 px-4 py-2 rounded-xl text-center border border-slate-700 hidden sm:block">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Completed</span>
              <span className="text-lg font-bold text-white font-heading">{finishedOrders.length} Trips</span>
            </div>

            <button
              onClick={() => handleToggleOnline(!isOnline)}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm ${
                isOnline
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>{isOnline ? 'ONLINE & READY' : 'OFFLINE'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Header */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto py-2.5">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors relative ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending Requests Feed</span>
              {pendingRequests.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full font-extrabold text-[11px] ${
                    activeTab === 'pending'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('running')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors relative ${
                activeTab === 'running'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Running Orders ({runningOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('finished')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'finished'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finished ({finishedOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Partner Profile & Account</span>
              {rider.kycStatus === 'approved' ? (
                <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center gap-1 shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                  <span>Verified</span>
                </span>
              ) : rider.kycStatus === 'rejected' ? (
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full border border-rose-300">
                  Action Needed
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-300">
                  Pending
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ========================================================
            RIDER TAB 1: "Pending Requests Feed" (Orders waiting to be accepted)
        ======================================================== */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
        {/* Wallet Balance Zero or Low Notification Banner (Shown only when balance is ₹0 or low: ₹20 only) */}
        {rider.kycStatus === 'approved' && (rider.walletBalance || 0) <= 0 && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-950 font-heading">
                  Wallet Balance is ₹0 (Zero Balance)
                </h3>
                <p className="text-xs font-medium text-amber-800 mt-0.5">
                  Please recharge wallet to accept pending order requests.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setProfileSubTab('overview');
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              Tap to add money
            </button>
          </div>
        )}

        {rider.kycStatus === 'approved' && (rider.walletBalance || 0) > 0 && (rider.walletBalance || 0) <= 20 && (
          <div className="bg-orange-50 border border-orange-300 text-orange-900 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 text-orange-800 rounded-xl shrink-0 mt-0.5">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-orange-950 font-heading">
                  Low Wallet Balance
                </h3>
                <p className="text-xs font-medium text-orange-800 mt-0.5">
                  Your wallet has only ₹{rider.walletBalance} remaining.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setProfileSubTab('overview');
              }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              Tap to add money
            </button>
          </div>
        )}

            <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold font-heading text-amber-900">
                    Available Pending Order Requests ({pendingRequests.length})
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Live Multi-Device Sync</span>
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Orders placed on customer mobile phones appear here instantly in real-time.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  fetch('/api/orders', { cache: 'no-store' })
                    .then((r) => r.json())
                    .then((j) => {
                      if (j.success && Array.isArray(j.orders)) {
                        // Triggers bulk sync refresh
                        window.dispatchEvent(new CustomEvent('quickdrop_manual_sync'));
                      }
                    })
                    .catch(() => {});
                }}
                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                title="Tap to force sync with server"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Now</span>
              </button>
            </div>

            {/* KYC Document Verification Block Alert Banner */}
            {rider.kycStatus !== 'approved' && (
              <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl shadow-xs border border-amber-600 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-950 text-amber-400 rounded-xl shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-xs uppercase tracking-wider text-slate-950 font-heading">
                        Partner Document Verification Required
                      </h3>
                      <span className="px-2 py-0.5 bg-slate-950 text-white font-black text-[9px] rounded-md uppercase">
                        {rider.kycStatus === 'rejected' ? 'Action Required' : 'Pending Verification'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      Only verified delivery partners with approved KYC documents can accept pending requests.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-amber-400 font-extrabold text-xs rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  View Partner Profile &rarr;
                </button>
              </div>
            )}

            {/* Offline Alert Banner if rider is offline */}
            {!isOnline && (
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shrink-0"></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400 font-heading">
                      You are currently Offline
                    </p>
                    <p className="text-xs text-slate-300">
                      Pending delivery requests are shown below. Switch to Online to accept them.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleOnline(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  Go Online Now
                </button>
              </div>
            )}

            {pendingRequests.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Pending Requests Right Now</h3>
                <p className="text-xs text-slate-500">
                  New orders created by customers will appear in this vertical feed automatically in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-amber-400 transition-all p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{ord.orderNumber}</span>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-md uppercase">
                            📦 {ord.deliveryType.replace('_', ' ')}
                          </span>
                        </div>
                        {/* Delivery booking day and time & customer selected pickup slot */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <div className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                            📅 Booking Day & Time: {ord.bookingDayAndTime}
                          </div>
                          <div className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-indigo-200/80">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>Customer Selected Pickup Slot: <strong className="text-indigo-950 font-bold">{ord.scheduledDateTime || 'Immediate Pickup'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black text-emerald-600 font-heading">
                          {formatCurrency(ord.fare)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">
                          {ord.distanceKm} km • {ord.paymentMethod}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      {/* Pickup Sender Details Box */}
                      <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-2 flex flex-col justify-between">
                        <div>
                          {/* Small Capsule Navigate Tab on Left Side */}
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() => openNavigationMap(ord.pickup.lat, ord.pickup.lng, ord.pickup.address)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-full shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-105"
                              title="Open Google Maps Navigation for Pickup"
                            >
                              <Navigation className="w-3 h-3 text-white shrink-0" />
                              <span>Navigate</span>
                            </button>
                          </div>

                          <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1">
                            📍 Pickup Location & Sender
                          </div>
                          <p className="font-semibold text-slate-800">{ord.pickup.address}</p>
                          <div className="text-[11px] text-slate-700 font-medium pt-1">
                            Sender: <b className="text-slate-900">{ord.sender?.name || ord.customerName}</b> ({ord.sender?.phone || ord.customerPhone})
                          </div>
                        </div>
                        {ord.sender?.notes && (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100 font-medium mt-2">
                            💬 <b>Sender Msg:</b> {ord.sender.notes}
                          </div>
                        )}
                      </div>

                      {/* Drop Recipient Details Box */}
                      <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs space-y-2 flex flex-col justify-between">
                        <div>
                          {/* Small Capsule Navigate Tab on Left Side */}
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() => openNavigationMap(ord.destination.lat, ord.destination.lng, ord.destination.address)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] rounded-full shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-105"
                              title="Open Google Maps Navigation for Dropoff"
                            >
                              <Navigation className="w-3 h-3 text-white shrink-0" />
                              <span>Navigate</span>
                            </button>
                          </div>

                          <div className="text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1">
                            🏁 Drop Location & Recipient
                          </div>
                          <p className="font-semibold text-slate-800">{ord.destination.address}</p>
                          <div className="text-[11px] text-slate-700 font-medium pt-1">
                            Recipient: <b className="text-slate-900">{ord.recipient.name}</b> ({ord.recipient.phone})
                          </div>
                        </div>
                        {ord.recipient.notes && (
                          <div className="text-[11px] text-indigo-800 bg-indigo-50 p-2 rounded-lg border border-indigo-100 font-medium mt-2">
                            💬 <b>Recipient Msg:</b> {ord.recipient.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        Customer: <b>{ord.customerName}</b> ({ord.customerPhone})
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onDeclineOrder) {
                              onDeclineOrder(ord.id);
                            } else {
                              alert(`Order ${ord.orderNumber} declined.`);
                            }
                          }}
                          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>Decline Order</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (rider.kycStatus !== 'approved') {
                              setShowKycBlockModal(true);
                              return;
                            }
                            if ((rider.walletBalance || 0) <= 0) {
                              setShowWalletQrModal(true);
                              return;
                            }
                            onAcceptOrder(ord.id, rider);
                            setActiveTab('running');
                          }}
                          className={`px-5 py-2 font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                            rider.kycStatus === 'approved' && (rider.walletBalance || 0) > 0
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                          }`}
                        >
                          {rider.kycStatus !== 'approved' ? (
                            <>
                              <Lock className="w-4 h-4 text-amber-800" />
                              <span>Accept Order (KYC Required)</span>
                            </>
                          ) : (rider.walletBalance || 0) <= 0 ? (
                            <>
                              <CreditCard className="w-4 h-4 text-amber-800" />
                              <span>Recharge Wallet (Balance ₹0)</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              <span>Accept Order</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            RIDER TAB 2: "Running Feed" (In-transit order execution)
        ======================================================== */}
        {activeTab === 'running' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 font-heading">
              Active Running Deliveries ({runningOrders.length})
            </h2>

            {runningOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Running Orders</h3>
                <p className="text-xs text-slate-500">Accept an order from Pending Requests to get started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {runningOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base">{ord.orderNumber}</span>
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded-full uppercase">
                            {ord.trackingStep?.replace('_', ' ') || 'Accepted'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <div className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                            📅 Booking Day & Time: {ord.bookingDayAndTime}
                          </div>
                          <div className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-indigo-200/80">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>Customer Selected Pickup Slot: <strong className="text-indigo-950 font-bold">{ord.scheduledDateTime || 'Immediate Pickup'}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-emerald-600 font-heading">
                          {formatCurrency(ord.fare)}
                        </span>
                      </div>
                    </div>

                    {/* Pickup & Dropoff Contact Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      {/* Pickup Sender Box */}
                      <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-2 flex flex-col justify-between">
                        <div>
                          {/* Small Capsule Navigate Tab on Left Side */}
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() => openNavigationMap(ord.pickup.lat, ord.pickup.lng, ord.pickup.address)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-full shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-105"
                              title="Open Google Maps Navigation for Pickup"
                            >
                              <Navigation className="w-3 h-3 text-white shrink-0" />
                              <span>Navigate</span>
                            </button>
                          </div>

                          <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1">
                            📍 Pickup Location & Sender
                          </div>
                          <p className="font-semibold text-slate-800">{ord.pickup.address}</p>
                          <div className="text-[11px] text-slate-700 font-medium pt-1">
                            <span>Sender: <b className="text-slate-900">{ord.sender?.name || ord.customerName}</b> ({ord.sender?.phone || ord.customerPhone})</span>
                          </div>
                          {/* Message icon with call button left side in pickup location & sender */}
                          <div className="pt-2 flex items-center justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => scrollToCustomerChat(ord.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Message customer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Message</span>
                            </button>
                            <a
                              href={`tel:${ord.sender?.phone || ord.customerPhone}`}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              title="Call sender"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </a>
                          </div>
                        </div>
                        {ord.sender?.notes && (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100 font-medium mt-2">
                            💬 <b>Sender Note:</b> {ord.sender.notes}
                          </div>
                        )}
                      </div>

                      {/* Drop Recipient Box */}
                      <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs space-y-2 flex flex-col justify-between">
                        <div>
                          {/* Small Capsule Navigate Tab on Left Side */}
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() => openNavigationMap(ord.destination.lat, ord.destination.lng, ord.destination.address)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] rounded-full shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-105"
                              title="Open Google Maps Navigation for Dropoff"
                            >
                              <Navigation className="w-3 h-3 text-white shrink-0" />
                              <span>Navigate</span>
                            </button>
                          </div>

                          <div className="text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1">
                            🏁 Dropoff Location & Recipient
                          </div>
                          <p className="font-semibold text-slate-800">{ord.destination.address}</p>
                          <div className="text-[11px] text-slate-700 font-medium pt-1">
                            <span>Recipient: <b className="text-slate-900">{ord.recipient.name}</b> ({ord.recipient.phone})</span>
                          </div>
                          {/* Call button right side of dropoff location & recipient */}
                          <div className="pt-2 flex items-center justify-end">
                            <a
                              href={`tel:${ord.recipient.phone}`}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              title="Call recipient"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </a>
                          </div>
                        </div>
                        {ord.recipient.notes && (
                          <div className="text-[11px] text-indigo-800 bg-indigo-50 p-2 rounded-lg border border-indigo-100 font-medium mt-2">
                            💬 <b>Recipient Note:</b> {ord.recipient.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Customer Chat */}
                    <div id={`customer-chat-${ord.id}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 uppercase flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-indigo-600" />
                          <span>Customer Chat ({ord.customerName})</span>
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                          Live Messaging
                        </span>
                      </div>

                      {/* Messages container */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto space-y-2">
                        {(!ord.customerChatMessages || ord.customerChatMessages.length === 0) ? (
                          <div className="text-center py-6 text-slate-400 text-xs font-medium">
                            No chat messages from customer yet. Messages sent by customer will appear here in real-time.
                          </div>
                        ) : (
                          ord.customerChatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${msg.sender === 'rider' ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs ${
                                  msg.sender === 'rider'
                                    ? 'bg-indigo-600 text-white rounded-br-xs'
                                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs font-medium'
                                }`}
                              >
                                {msg.text}
                              </div>
                              <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Send reply form */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={riderChatInputs[ord.id] || ''}
                          onChange={(e) =>
                            setRiderChatInputs((prev) => ({ ...prev, [ord.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendCustomerChat(ord.id);
                          }}
                          placeholder="Type reply to customer..."
                          className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendCustomerChat(ord.id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress Action Pipeline */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-700 block uppercase">
                        Rider Action Stepper:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => onUpdateOrderStatus(ord.id, 'arrived_pickup')}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            ord.trackingStep === 'arrived_pickup'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          1. Arrived Pickup
                        </button>
                        <button
                          onClick={() => onUpdateOrderStatus(ord.id, 'picked_up')}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            ord.trackingStep === 'picked_up'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          2. Picked Up
                        </button>
                        <button
                          onClick={() => onUpdateOrderStatus(ord.id, 'in_transit')}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            ord.trackingStep === 'in_transit'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          3. In Transit
                        </button>
                        <button
                          onClick={() => onUpdateOrderStatus(ord.id, 'arrived_drop')}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            ord.trackingStep === 'arrived_drop'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          4. Arrived Drop
                        </button>
                      </div>
                    </div>

                    {/* Verification Box for Final Delivery */}
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                        <Key className="w-4 h-4 text-emerald-600" />
                        <span>Complete Delivery with Customer OTP Verification</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={otpInput[ord.id] || ''}
                          onChange={(e) =>
                            setOtpInput((prev) => ({ ...prev, [ord.id]: e.target.value }))
                          }
                          placeholder="Enter 4-digit OTP"
                          className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-center w-36"
                        />
                        <button
                          onClick={() => handleVerifyDelivery(ord)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm"
                        >
                          Confirm Delivery & Collect {formatCurrency(ord.fare)}
                        </button>
                      </div>
                      {otpError[ord.id] && (
                        <p className="text-xs text-rose-600 font-medium">{otpError[ord.id]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            RIDER TAB 3: "Finished Feed"
        ======================================================== */}
        {activeTab === 'finished' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 font-heading">
                Your Completed Deliveries ({finishedOrders.length})
              </h2>

              {finishedOrders.length > 0 && (
                <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFinishedViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      finishedViewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    All List
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinishedViewMode('datewise')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      finishedViewMode === 'datewise'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Date Wise 📅
                  </button>
                </div>
              )}
            </div>

            {finishedOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">0 Completed Trips</h3>
                <p className="text-xs text-slate-400">You have completed 0 rides so far.</p>
              </div>
            ) : finishedViewMode === 'list' ? (
              <div className="space-y-3">
                {finishedOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">#{ord.orderNumber || ord.id.slice(-6).toUpperCase()}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                          {new Date(ord.deliveredAt || ord.createdAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <span className="text-slate-500 mt-1 block truncate max-w-sm">
                        {ord.destination?.address || 'Drop-off Location'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-600 text-sm block">
                        +{formatCurrency(ord.fare)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ord.deliveredAt || ord.createdAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {earningsSummary.history.map((day) => {
                  const isExpanded = expandedFinishedDateKey === day.dateKey;
                  return (
                    <div key={day.dateKey} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      <div
                        onClick={() => setExpandedFinishedDateKey(isExpanded ? null : day.dateKey)}
                        className="p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {day.rideCount}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 font-heading">{day.formattedDate}</h4>
                            <p className="text-[11px] text-slate-500">{day.rideCount} completed deliveries</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <div className="text-sm font-black text-emerald-600 font-heading">
                              +{formatCurrency(day.captainEarning)}
                            </div>
                            <div className="text-[10px] text-slate-400">Total Fare: {formatCurrency(day.totalFare)}</div>
                          </div>
                          <span className="text-xs text-slate-400 font-bold">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-slate-100 space-y-2.5 bg-white">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Deliveries on {day.formattedDate}
                          </div>
                          {day.rides.map((ride) => (
                            <div key={ride.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-indigo-600">#{ride.orderNumber}</span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {new Date(ride.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="text-slate-700 text-[11px]">
                                <div className="truncate"><strong className="text-slate-400">To:</strong> {ride.dropAddress}</div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs font-bold">
                                <span className="text-slate-500">Fare: {formatCurrency(ride.fare)}</span>
                                <span className="text-emerald-600">Net Earning: {formatCurrency(ride.captainEarning)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            RIDER TAB 4: "Partner Profile & Account Settings"
        ======================================================== */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {riderPhotoSuccessToast && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-between shadow-xs animate-fade-in">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Delivery Partner profile picture updated successfully!</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRiderPhotoSuccessToast(false)}
                  className="text-emerald-700 font-black hover:text-emerald-950 cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {profileSaveSuccessToast && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-between shadow-xs animate-fade-in">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Delivery Partner profile updated successfully!</span>
                </span>
                <button
                  type="button"
                  onClick={() => setProfileSaveSuccessToast(false)}
                  className="text-emerald-700 font-black hover:text-emerald-950 cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  {/* Photo with Overlay Camera Button */}
                  <div className="relative group shrink-0">
                    <img
                      src={rider.photo}
                      alt={rider.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-md group-hover:opacity-90 transition-opacity"
                    />
                    <button
                      type="button"
                      onClick={() => riderPhotoInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1.5 rounded-xl shadow-md border-2 border-white transition-transform flex items-center justify-center bg-amber-400 hover:bg-amber-500 text-slate-950 cursor-pointer hover:scale-110"
                      title="Upload new partner profile picture"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-950" />
                    </button>
                    <input
                      ref={riderPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleRiderPhotoChange}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold font-heading text-slate-900">{rider.name}</h2>
                      <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-md">
                        ★ {rider.rating}
                      </span>
                      {rider.kycStatus === 'approved' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>DOCUMENT VERIFIED</span>
                        </span>
                      ) : rider.kycStatus === 'rejected' ? (
                        <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-white" />
                          <span>ACTION NEEDED</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>VERIFICATION PENDING</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vehicle: <span className="font-semibold text-slate-800">{rider.vehicle}</span> ({rider.plateNumber})
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Phone: {rider.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Actions (Edit Profile) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileSubTab('edit_profile')}
                    className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-950" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>

              {/* Sub-Tab Navigation inside Profile */}
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setProfileSubTab('overview')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    profileSubTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Overview</span>
                  {rider.kycStatus === 'approved' && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md border border-emerald-200">
                      Verified
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setProfileSubTab('submit_docs')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    profileSubTab === 'submit_docs'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Submit Docs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileSubTab('resubmit_docs')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    profileSubTab === 'resubmit_docs'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-900" />
                  <span>Resubmit Docs</span>
                  {rider.kycStatus === 'rejected' && (
                    <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-black rounded-full animate-pulse">
                      Action Needed
                    </span>
                  )}
                </button>
              </div>

              {profileSubTab === 'overview' && (
                <>
                  {/* Rider Stats & Wallet Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div 
                      onClick={() => setIsEarningsModalOpen(true)}
                      className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center cursor-pointer hover:bg-slate-100 transition-all shadow-xs"
                    >
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Today's Earnings</span>
                      <span className="text-xl font-black text-emerald-600 font-heading">
                        {formatCurrency(earningsSummary.todayEarnings)}
                      </span>
                      <span className="text-[11px] text-slate-600 block mt-1 font-semibold">
                        {earningsSummary.todayCount} Completed Rides • <span className="text-indigo-600 underline">View Earnings</span>
                      </span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Completed Trips</span>
                      <span className="text-xl font-black text-slate-900 font-heading">
                        {rider.totalDeliveries + finishedOrders.length} Trips
                      </span>
                    </div>
                    <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-amber-900 uppercase block">App Wallet Balance</span>
                        <span className={`text-xl font-black font-heading ${(rider.walletBalance || 0) > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {formatCurrency(rider.walletBalance || 0)}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-1 rounded-lg">
                        {(rider.walletBalance || 0) <= 0 ? 'Zero Balance - Recharge below' : 'Active Wallet'}
                      </div>
                    </div>
                  </div>

                  {/* 10% Commission Deduction Policy Option Card */}
                  <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 flex items-center justify-between gap-4 my-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                        <Percent className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-indigo-950 font-heading">10% Order Commission Deduction Policy</h5>
                        <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">
                          10% of each order fare is automatically deducted from your rider wallet balance upon finishing and delivering an order.
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-indigo-600 text-white font-extrabold text-[10px] rounded-xl shrink-0 shadow-xs">
                      10% Commission
                    </span>
                  </div>

                  {/* QuickDrop Support Chat & Recharge Screenshot Box */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 my-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black font-heading text-slate-900">QuickDrop support</h4>
                          <p className="text-[10px] text-slate-500">Chat with Admin & Upload Recharge Screenshot</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                        {rider.name}
                      </span>
                    </div>

                    {/* QR Code & Recharge Instructions Box */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-300 shadow-xs flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                        {platformQrImage ? (
                          <img src={platformQrImage} alt="UPI QR" className="w-full h-full object-contain rounded-lg" />
                        ) : (
                          <div className="w-full h-full bg-emerald-600 rounded-lg p-1 grid grid-cols-5 gap-1">
                            {Array.from({ length: 25 }).map((_, i) => (
                              <div key={i} className={`rounded-xs ${i % 2 === 0 ? 'bg-white' : 'bg-emerald-800'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 text-left flex-1">
                        <h5 className="text-xs font-bold text-slate-900">Wallet Recharge via QR Scan</h5>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Scan the UPI QR Code using GPay, PhonePe, Paytm or UPI. Select minimum <b className="text-slate-900">Rs 100</b> (or ₹200 / ₹500). Once scanned or confirmed, upload your payment screenshot in the message box below. QuickDrop Support will verify and instantly credit your rider wallet so you can resume accepting delivery requests.
                        </p>
                      </div>
                    </div>

                    {/* Chat messages list */}
                    <div className="h-48 overflow-y-auto space-y-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                      {supportChatMessages.filter(m => m.riderId === rider.id).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                          <MessageSquare className="w-8 h-8 mb-1 opacity-40" />
                          <p className="text-[11px] font-bold">No support messages yet.</p>
                          <p className="text-[10px]">Scan QR, upload payment screenshot, and chat with admin here!</p>
                        </div>
                      ) : (
                        supportChatMessages.filter(m => m.riderId === rider.id).map(msg => (
                          <div key={msg.id} className={`flex flex-col ${msg.sender === 'rider' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] p-2.5 rounded-xl shadow-xs ${msg.sender === 'rider' ? 'bg-indigo-600 text-white rounded-br-xs' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'}`}>
                              <p className="text-[11px] font-medium leading-relaxed">{msg.text}</p>
                              {msg.screenshotUrl && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-white/30 max-h-32 bg-black/10">
                                  <img src={msg.screenshotUrl} alt="Recharge Screenshot" className="w-full h-full object-cover" />
                                </div>
                              )}
                              {msg.amount && (
                                <span className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-black rounded ${msg.sender === 'rider' ? 'bg-indigo-700 text-indigo-100' : 'bg-emerald-100 text-emerald-800'}`}>
                                  Amount: ₹{msg.amount}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Send message & recharge upload form */}
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!supportMessageText.trim() && !supportScreenshot) return;
                      if (onSendSupportMessage) {
                        onSendSupportMessage({
                          riderId: rider.id,
                          sender: 'rider',
                          text: supportMessageText || `Recharge payment screenshot (₹${supportRechargeAmount})`,
                          screenshotUrl: supportScreenshot || undefined,
                          amount: supportScreenshot ? supportRechargeAmount : undefined,
                        });
                      }
                      if (supportScreenshot && onCreateRechargeRequest) {
                        onCreateRechargeRequest({
                          riderId: rider.id,
                          riderName: rider.name,
                          riderPhone: rider.phone,
                          amount: supportRechargeAmount,
                          screenshotUrl: supportScreenshot,
                        });
                      }
                      setSupportMessageText('');
                      setSupportScreenshot('');
                    }} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={supportRechargeAmount}
                          onChange={(e) => setSupportRechargeAmount(Number(e.target.value))}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                        >
                          <option value={100}>₹100 Recharge</option>
                          <option value={200}>₹200 Recharge</option>
                          <option value={500}>₹500 Recharge</option>
                        </select>
                        <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1 transition-colors">
                          <Camera className="w-3.5 h-3.5 text-slate-600" />
                          <span>{supportScreenshot ? 'Screenshot Added ✓' : 'Upload Screenshot'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setSupportScreenshot(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>

                      {supportScreenshot && (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 shadow-xs">
                          <img src={supportScreenshot} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSupportScreenshot('')}
                            className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type support message or QR payment txn ID..."
                          value={supportMessageText}
                          onChange={(e) => setSupportMessageText(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Overview Partner Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Partner Full Name</span>
                        <span className="text-xs font-bold text-slate-900 truncate block">{rider.name}</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Registered Phone</span>
                        <span className="text-xs font-bold text-slate-900 truncate block">{rider.phone}</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Email Address</span>
                        <span className="text-xs font-bold text-slate-900 truncate block">
                          {rider.email || `${rider.name.toLowerCase().replace(/\s+/g, '.')}@quickdrop.in`}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Vehicle Registration</span>
                        <span className="text-xs font-bold text-slate-900 truncate block">{rider.plateNumber}</span>
                        <span className="text-[10px] text-slate-500 block">{rider.vehicle}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Sign Out Section */}
                  <div className="mt-4 pt-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Session & Security</h4>
                      <p className="text-[11px] text-slate-500">Sign out of your partner account on this device securely.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 border border-rose-200/80 shadow-xs"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}

              {/* EDIT PROFILE TAB FORM - PREMIUM PROFESSIONAL FORMAT */}
              {profileSubTab === 'edit_profile' && (
                <form onSubmit={handleSaveRiderProfile} className="space-y-6 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/90 shadow-lg relative overflow-hidden">
                  {/* Premium Header Banner */}
                  <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-500 to-indigo-600" />
                  
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-xs">
                        <Edit className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold font-heading text-slate-900">Professional Partner Profile Settings</h3>
                        <p className="text-xs text-slate-500">Update your verified rider credentials, contact info & vehicle details anytime.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfileSubTab('overview')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {profileEditError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-xs animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                      <span>{profileEditError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center gap-4">
                      <img
                        src={rider.photo}
                        alt={rider.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                      />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-900">Partner Profile Photo</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Click camera icon on your overview card to update photo anytime.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => riderPhotoInputRef.current?.click()}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Change Photo</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Enter your full legal name"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 shadow-xs"
                          required
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                        Your professional display name as shown to customers.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 shadow-xs"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="partner@quickdrop.in"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 shadow-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Vehicle Name / Model
                      </label>
                      <div className="relative">
                        <Bike className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={editVehicle}
                          onChange={(e) => setEditVehicle(e.target.value)}
                          placeholder="e.g. Honda Activa EV, Bajaj Pulsar"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Vehicle Registration / License Plate Number
                      </label>
                      <div className="relative">
                        <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={editPlateNumber}
                          onChange={(e) => setEditPlateNumber(e.target.value)}
                          placeholder="e.g. MH-12-AB-1234"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase text-slate-900 shadow-xs tracking-wider"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setProfileSubTab('overview')}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black rounded-2xl cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-slate-950" />
                          <span>Save Professional Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: SUBMIT DOCUMENTS */}
              {profileSubTab === 'submit_docs' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-heading">
                        Initial Document Submission Form
                      </h4>
                      <p className="text-xs text-indigo-900 mt-0.5">
                        Upload clear photos of your Driving Licence, Vehicle RC, Aadhaar Card, and PAN Card to request partner verification.
                      </p>
                    </div>
                  </div>

                  {submitFeedback && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{submitFeedback}</span>
                    </div>
                  )}

                  {/* Document Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. Driving Licence */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <span>1. Driving Licence (DL)</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">DL Record</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Licence Number</label>
                        <input
                          type="text"
                          value={docDlNumber}
                          onChange={(e) => setDocDlNumber(e.target.value)}
                          placeholder="DL-0420190089123"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.dl ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.dl} alt="Driving Licence" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'Driving Licence (DL)', url: docImages.dl! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-purple-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.dl ? 'Replace Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('dl', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 2. RC Certificate */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                          <BadgeCheck className="w-4 h-4 text-teal-600" />
                          <span>2. Vehicle RC Certificate</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">RC Record</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">RC Number</label>
                        <input
                          type="text"
                          value={docRcNumber}
                          onChange={(e) => setDocRcNumber(e.target.value)}
                          placeholder="RC-CH01EV8821-2022"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.rc ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.rc} alt="RC Certificate" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'RC Certificate', url: docImages.rc! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-teal-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.rc ? 'Replace Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('rc', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 3. Aadhaar Card */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-rose-600" />
                          <span>3. Aadhaar Card</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">ID Proof</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Aadhaar Card Number</label>
                        <input
                          type="text"
                          value={docAadhaarNumber}
                          onChange={(e) => setDocAadhaarNumber(e.target.value)}
                          placeholder="4819 2019 4912"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.aadhaar ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.aadhaar} alt="Aadhaar Card" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'Aadhaar Card', url: docImages.aadhaar! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-rose-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.aadhaar ? 'Replace Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('aadhaar', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 4. PAN Card */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-orange-600" />
                          <span>4. PAN Card</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">Tax ID</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">PAN Card Number</label>
                        <input
                          type="text"
                          value={docPanNumber}
                          onChange={(e) => setDocPanNumber(e.target.value)}
                          placeholder="ABCDE1234F"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.pan ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.pan} alt="PAN Card" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'PAN Card', url: docImages.pan! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-orange-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.pan ? 'Replace Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('pan', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleReSubmitVerification}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Submit Documents for Admin Verification</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: RESUBMIT DOCUMENTS FOR ADMIN VERIFICATION */}
              {profileSubTab === 'resubmit_docs' && (
                <div className="space-y-4 pt-1">
                  {/* Status & Feedback Card */}
                  {rider.kycStatus === 'rejected' ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider font-heading">
                          Admin Feedback / Resubmission Required
                        </h4>
                        <p className="text-xs text-rose-900 font-bold mt-0.5">
                          Admin Remark: {rider.kycRemarks || 'Some document photos were unreadable. Please upload clearer images.'}
                        </p>
                        <p className="text-[11px] text-rose-800 mt-1">
                          Please re-upload missing or corrected images below, then click "Resubmit Documents to Admin".
                        </p>
                      </div>
                    </div>
                  ) : rider.kycStatus === 'approved' ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider font-heading">
                          Official Status: Verified & Approved
                        </h4>
                        <p className="text-xs text-emerald-900 mt-0.5">
                          Your documents are fully verified. You may resubmit updated photos if your licence or vehicle RC details change in future.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shrink-0 mt-0.5">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider font-heading">
                          Pending Admin Verification Queue
                        </h4>
                        <p className="text-xs text-amber-900 mt-0.5">
                          Your uploaded documents are currently queued for Admin review. You can make updates and re-submit anytime below.
                        </p>
                      </div>
                    </div>
                  )}

                  {submitFeedback && (
                    <div className="p-3 bg-amber-100 border border-amber-300 text-amber-950 rounded-xl text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-800 shrink-0" />
                      <span>{submitFeedback}</span>
                    </div>
                  )}

                  {/* Document Grid for Resubmission */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. Driving Licence */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <span>1. Driving Licence (DL)</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">DL Record</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Licence Number</label>
                        <input
                          type="text"
                          value={docDlNumber}
                          onChange={(e) => setDocDlNumber(e.target.value)}
                          placeholder="DL-0420190089123"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.dl ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.dl} alt="Driving Licence" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'Driving Licence (DL)', url: docImages.dl! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-purple-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.dl ? 'Re-upload Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('dl', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 2. RC Certificate */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                          <BadgeCheck className="w-4 h-4 text-teal-600" />
                          <span>2. Vehicle RC Certificate</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">RC Record</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">RC Number</label>
                        <input
                          type="text"
                          value={docRcNumber}
                          onChange={(e) => setDocRcNumber(e.target.value)}
                          placeholder="RC-CH01EV8821-2022"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.rc ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.rc} alt="RC Certificate" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'RC Certificate', url: docImages.rc! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-teal-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.rc ? 'Re-upload Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('rc', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 3. Aadhaar Card */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-rose-600" />
                          <span>3. Aadhaar Card</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">ID Proof</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Aadhaar Card Number</label>
                        <input
                          type="text"
                          value={docAadhaarNumber}
                          onChange={(e) => setDocAadhaarNumber(e.target.value)}
                          placeholder="4819 2019 4912"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.aadhaar ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.aadhaar} alt="Aadhaar Card" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'Aadhaar Card', url: docImages.aadhaar! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-rose-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.aadhaar ? 'Re-upload Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('aadhaar', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 4. PAN Card */}
                    <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-orange-600" />
                          <span>4. PAN Card</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">Tax ID</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">PAN Card Number</label>
                        <input
                          type="text"
                          value={docPanNumber}
                          onChange={(e) => setDocPanNumber(e.target.value)}
                          placeholder="ABCDE1234F"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {docImages.pan ? (
                          <div className="relative group w-20 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                            <img src={docImages.pan} alt="PAN Card" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'PAN Card', url: docImages.pan! })}
                              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="View full image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-orange-200 flex items-center justify-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{docImages.pan ? 'Re-upload Photo' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocUpload('pan', e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleReSubmitVerification}
                      className="w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-950" />
                      <span>Resubmit Updated Documents for Admin Verification</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Full Document Image View Modal */}
            {selectedDocPreview && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
                  <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-bold text-sm">{selectedDocPreview.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDocPreview(null)}
                      className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
                    <img
                      src={selectedDocPreview.url}
                      alt={selectedDocPreview.title}
                      className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Official Verified Document Photo</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocPreview(null)}
                      className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* KYC Verification Required Block Modal */}
            {showKycBlockModal && (
              <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto border border-amber-300 shadow-xs">
                    <Lock className="w-7 h-7 text-amber-800" />
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-extrabold text-slate-900 font-heading">
                      Partner Document Verification Required
                    </h3>
                    <p className="text-xs text-slate-600 max-w-xs mx-auto">
                      Only verified delivery partners can accept pending customer requests. Your current KYC document status is{' '}
                      <b className="text-slate-900 font-extrabold uppercase">
                        {rider.kycStatus === 'rejected' ? 'REJECTED / ACTION NEEDED' : 'PENDING ADMIN REVIEW'}
                      </b>.
                    </p>
                  </div>

                  {rider.kycRemarks && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1">
                      <span className="font-extrabold text-[10px] uppercase block tracking-wider text-rose-700">
                        Admin Feedback / Remark:
                      </span>
                      <p className="font-medium">{rider.kycRemarks}</p>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-slate-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Required Documents for Verification:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-600">
                      <li>Driving Licence (DL)</li>
                      <li>RC Registration Certificate</li>
                      <li>Aadhaar Card Photo</li>
                      <li>PAN Card Photo</li>
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowKycBlockModal(false)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                    {onUpdateRiderKyc && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateRiderKyc(rider.id, 'approved');
                          setShowKycBlockModal(false);
                        }}
                        className="w-full sm:flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>Instant Approve & Verify Partner</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowKycBlockModal(false);
                        setActiveTab('profile');
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Upload Documents</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Earnings & History Modal */}
      {isEarningsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black font-heading text-slate-900">Captain Earnings & History</h3>
                  <p className="text-xs text-slate-500">Real-time earnings calculated from completed rides</p>
                </div>
              </div>
              <button
                onClick={() => setIsEarningsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 space-y-6">
              {/* Today's Earnings Card */}
              <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-emerald-500/30">
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">Today's Total Earnings</span>
                <div className="text-3xl font-black font-heading text-emerald-400 mt-1">
                  {formatCurrency(earningsSummary.todayEarnings)}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-emerald-800/60 text-xs text-emerald-200">
                  <span>Completed Today: <strong className="text-white">{earningsSummary.todayCount} Rides</strong></span>
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono text-[10px]">
                    Timezone: Asia/Kolkata
                  </span>
                </div>
              </div>

              {/* Earnings History Section */}
              <div>
                <h4 className="text-sm font-black font-heading text-slate-900 mb-3">Earnings History by Date</h4>
                {earningsSummary.history.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                    No completed rides earnings recorded yet. Complete trips to build history.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {earningsSummary.history.map((day) => {
                      const isExpanded = expandedEarningsDateKey === day.dateKey;
                      return (
                        <div key={day.dateKey} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          <div
                            onClick={() => setExpandedEarningsDateKey(isExpanded ? null : day.dateKey)}
                            className="p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                {day.rideCount}
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-slate-900 font-heading">{day.formattedDate}</h5>
                                <p className="text-[11px] text-slate-500">{day.rideCount} completed rides</p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div>
                                <div className="text-sm font-black text-emerald-600 font-heading">
                                  {formatCurrency(day.captainEarning)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Fare: {formatCurrency(day.totalFare)}
                                </div>
                              </div>
                              <span className="text-xs text-slate-400 font-bold">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Rides List for this Date */}
                          {isExpanded && (
                            <div className="p-4 border-t border-slate-100 space-y-3 bg-white">
                              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Completed Rides on {day.formattedDate}
                              </div>
                              {day.rides.map((ride) => (
                                <div key={ride.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-indigo-600">#{ride.orderNumber}</span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      {new Date(ride.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="text-slate-700 space-y-0.5">
                                    <div className="truncate"><strong className="text-slate-500">Pickup:</strong> {ride.pickupAddress}</div>
                                    <div className="truncate"><strong className="text-slate-500">Drop:</strong> {ride.dropAddress}</div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center text-[11px]">
                                    <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                                      <span className="text-slate-400 block text-[9px]">Fare</span>
                                      <strong className="text-slate-900">{formatCurrency(ride.fare)}</strong>
                                    </div>
                                    <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                                      <span className="text-slate-400 block text-[9px]">Commission (10%)</span>
                                      <strong className="text-rose-600">-{formatCurrency(ride.platformCommission)}</strong>
                                    </div>
                                    <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                                      <span className="text-emerald-800 block text-[9px]">Net Earning</span>
                                      <strong className="text-emerald-700">{formatCurrency(ride.netEarning)}</strong>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsEarningsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Earnings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
