import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPicker } from './MapPicker';
import { uploadQuickDropFile } from '../lib/appwrite';
import { useAuth } from '../hooks/useAuth';
import { playNewOrderChime } from '../lib/syncEngine';
import {
  Order,
  UserProfile,
  LocationPoint,
  DeliveryType,
  PaymentMethod,
  SavedAddress,
} from '../types';
import {
  calculateDistanceKm,
  calculateFare,
  getFareBreakdown,
  inferCoordinatesFromAddress,
  formatCurrency,
  formatBookingDayAndTime,
  TRICITY_POPULAR_PRESETS,
} from '../utils/geoUtils';
import {
  Package,
  FileText,
  Gift,
  Utensils,
  Pill,
  Clock,
  User,
  Phone,
  CreditCard,
  Smartphone,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Check,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Sparkles,
  ExternalLink,
  Search,
  MessageSquare,
  LogIn,
  LogOut,
  Camera,
  Upload,
  Crosshair,
  LocateFixed,
  ArrowUpDown,
} from 'lucide-react';

interface CustomerAppProps {
  currentUser: UserProfile;
  orders: Order[];
  onCreateOrder: (newOrder: Order) => void;
  onOpenAuthModal?: () => void;
  activeFeedTab?: 'book' | 'pending' | 'running' | 'finished' | 'profile';
  setActiveFeedTab?: (tab: 'book' | 'pending' | 'running' | 'finished' | 'profile') => void;
  onAcceptOrder?: (orderId: string) => void;
  onDeclineOrder?: (orderId: string) => void;
  onUpdatePhoto?: (newPhotoUrl: string) => void;
  onUpdateProfile?: (updatedUser: UserProfile) => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({
  currentUser,
  orders,
  onCreateOrder,
  onOpenAuthModal,
  activeFeedTab: externalTab,
  setActiveFeedTab: setExternalTab,
  onAcceptOrder,
  onDeclineOrder,
  onUpdatePhoto,
  onUpdateProfile,
  onUpdateOrder,
}) => {
  const { signOut } = useAuth();
  const [currentTab, setCurrentTab] = useState<'book' | 'pending' | 'running' | 'finished' | 'profile'>(
    externalTab || 'book'
  );

  // Synchronize when externalTab prop changes from parent (e.g. App.tsx order acceptance or navigation)
  useEffect(() => {
    if (externalTab) {
      setCurrentTab(externalTab);
    }
  }, [externalTab]);

  const activeTab = currentTab;
  const setActiveTab = (tab: 'book' | 'pending' | 'running' | 'finished' | 'profile') => {
    setCurrentTab(tab);
    if (setExternalTab) {
      setExternalTab(tab);
    }
  };
  const [uploadSuccessToast, setUploadSuccessToast] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  // Chat with Delivery Partner State
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [chatMessageInput, setChatMessageInput] = useState('');

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatOrder || !chatMessageInput.trim()) return;
    const text = chatMessageInput.trim();
    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: 'customer' as const,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedMessages = [...(activeChatOrder.customerChatMessages || []), newMsg];
    const updatedOrder = {
      ...activeChatOrder,
      customerChatMessages: updatedMessages,
    };
    setActiveChatOrder(updatedOrder);
    setChatMessageInput('');
    if (onUpdateOrder) {
      onUpdateOrder(updatedOrder);
    }
  };

  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentUser.name);
  const [editPhone, setEditPhone] = useState(currentUser.phone);
  const [editEmail, setEditEmail] = useState(currentUser.email || '');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateProfile) {
      onUpdateProfile({
        ...currentUser,
        name: editName,
        phone: editPhone,
        email: editEmail,
      });
    }
    setIsEditingProfile(false);
    setUploadSuccessToast(true);
    setTimeout(() => setUploadSuccessToast(false), 3500);
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Selected file size exceeds 10MB limit. Please choose a smaller file.');
        return;
      }
      try {
        const fileUrl = await uploadQuickDropFile(file, 'customer-photos');
        if (fileUrl) {
          if (onUpdatePhoto) {
            onUpdatePhoto(fileUrl);
          }
          setUploadSuccessToast(true);
          setTimeout(() => setUploadSuccessToast(false), 3500);
        }
      } catch (err) {
        console.warn('Failed to upload profile photo to Supabase storage:', err);
      }
    }
  };

  // Real-Time Notification & Auto-Transition when a Pending Order is Accepted by Rider
  const [justAcceptedOrder, setJustAcceptedOrder] = useState<Order | null>(null);
  const [recentlyMovedOrderId, setRecentlyMovedOrderId] = useState<string | null>(null);
  const prevOrdersRef = useRef<Order[]>(orders);

  useEffect(() => {
    const prevOrders = prevOrdersRef.current;
    prevOrdersRef.current = orders;

    // Check if any order moved from 'pending' to 'running' or was recently accepted
    for (const curr of orders) {
      const prev = prevOrders.find((o) => o.id === curr.id);
      const isNowRunning = curr.status === 'running';
      const wasPending = prev ? prev.status === 'pending' : false;
      const isRecentAccepted =
        curr.acceptedAt && Date.now() - new Date(curr.acceptedAt).getTime() < 30000;

      if (isNowRunning && (wasPending || isRecentAccepted)) {
        setJustAcceptedOrder(curr);
        setRecentlyMovedOrderId(curr.id);
        setRunningFilter('all'); // Ensure newly accepted order is visible regardless of sub-filter
        try {
          playNewOrderChime();
        } catch (e) {}

        // Auto-switch customer view to 'running' tab to show the running order with live tracking
        setActiveTab('running');
        break;
      }
    }
  }, [orders]);

  // Clear auto-toast after 10s
  useEffect(() => {
    if (justAcceptedOrder) {
      const timer = setTimeout(() => {
        setJustAcceptedOrder(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [justAcceptedOrder]);

  // Booking Form State - Start empty (null) as requested
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [customerGps, setCustomerGps] = useState<LocationPoint | null>(null);
  const [mapActiveMode, setMapActiveMode] = useState<'pickup' | 'destination'>('pickup');
  const [pickupSearchQuery, setPickupSearchQuery] = useState('');
  const [dropoffSearchQuery, setDropoffSearchQuery] = useState('');

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('documents');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('later');
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSlot, setSelectedSlot] = useState(
    '10:00AM To 12:00PM Zirakhpur to Chandigarh dropoff'
  );

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientNotes, setRecipientNotes] = useState('');

  const [senderName, setSenderName] = useState(currentUser.name || '');
  const [senderPhone, setSenderPhone] = useState(currentUser.phone || '');
  const [senderNotes, setSenderNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const getPaymentLabel = (method?: string) => (method === 'upi' || method === 'qr' ? 'UPI Payment' : 'Cash on Delivery');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccessOrder, setBookingSuccessOrder] = useState<Order | null>(null);
  const [runningFilter, setRunningFilter] = useState<'all' | 'arrived_starting' | 'in_transit' | 'arrived_drop'>('all');
  
  // Center Booking Form Drawer State: 'half' (top half page), 'collapsed' (bottom of main page), 'full'
  const [sheetState, setSheetState] = useState<'collapsed' | 'half' | 'full'>('half');
  const touchStartY = useRef<number>(0);

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 45) {
      // Swiped down
      if (sheetState === 'full') setSheetState('half');
      else if (sheetState === 'half') setSheetState('collapsed');
    } else if (diff < -45) {
      // Swiped up
      if (sheetState === 'collapsed') setSheetState('half');
      else if (sheetState === 'half') setSheetState('full');
    }
  };

  const navScrollRef = useRef<HTMLDivElement>(null);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      navScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Fare & Distance Calculation (Zero if no pickup or destination selected)
  const distanceKm =
    pickup && destination
      ? calculateDistanceKm(pickup.lat, pickup.lng, destination.lat, destination.lng)
      : 0;

  const fareBreakdown = getFareBreakdown(distanceKm, deliveryType);
  const calculatedFare = (pickup && destination) ? fareBreakdown.totalFare : 0;

  // Handle Order Booking Submission
  const handleBookOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !destination) {
      alert('Please select both Pickup and Dropoff locations before booking.');
      return;
    }

    setIsBooking(true);
    const nowObj = new Date();
    const dayAndTimeText = formatBookingDayAndTime(nowObj);

    const schedText = scheduledDate ? `${scheduledDate} • ${selectedSlot}` : selectedSlot;

    const random4DigitOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `QD-${Math.floor(10000 + Math.random() * 90000)}`,
      customerId: currentUser.id,
      customerName: senderName || currentUser.name,
      customerPhone: senderPhone || currentUser.phone,
      pickup,
      destination,
      distanceKm,
      fare: calculatedFare,
      deliveryType,
      scheduleType,
      scheduledDateTime: schedText,
      bookingDayAndTime: dayAndTimeText, // Store exact day and time
      sender: {
        name: senderName,
        phone: senderPhone,
        notes: senderNotes,
      },
      recipient: {
        name: recipientName,
        phone: recipientPhone,
        notes: recipientNotes,
      },
      paymentMethod,
      paymentStatus: (paymentMethod === 'qr' || paymentMethod === 'upi') ? 'completed' : 'pending',
      upiTxnId: (paymentMethod === 'qr' || paymentMethod === 'upi') ? `QR${Math.floor(100000000000 + Math.random() * 900000000000)}` : undefined,
      status: 'pending',
      createdAt: nowObj.toISOString(),
      otpCode: random4DigitOtp,
    };

    // Store booked order ID locally
    try {
      const stored = localStorage.getItem('qd_my_booked_order_ids');
      const list = stored ? JSON.parse(stored) : [];
      localStorage.setItem('qd_my_booked_order_ids', JSON.stringify([newOrder.id, ...list.slice(0, 50)]));
    } catch (e) {}

    setTimeout(() => {
      onCreateOrder(newOrder);
      setIsBooking(false);
      setBookingSuccessOrder(newOrder);
      setActiveTab('pending'); // Automatically switch to Pending Requests feed view
    }, 600);
  };

  // Filter Orders for Customer Feeds
  const myOrders = useMemo(() => {
    let savedLocalOrderIds: string[] = [];
    try {
      const stored = localStorage.getItem('qd_my_booked_order_ids');
      savedLocalOrderIds = stored ? JSON.parse(stored) : [];
    } catch (e) {
      savedLocalOrderIds = [];
    }

    return orders.filter((o) => {
      if (o.customerId && currentUser.id && o.customerId === currentUser.id) return true;
      if (savedLocalOrderIds.includes(o.id)) return true;
      if (
        currentUser.phone &&
        (o.customerPhone === currentUser.phone ||
          o.sender?.phone === currentUser.phone ||
          o.recipient?.phone === currentUser.phone)
      ) {
        return true;
      }
      if (
        !currentUser.id ||
        currentUser.id === 'usr_default' ||
        currentUser.id.startsWith('usr_') ||
        currentUser.id.startsWith('cust_')
      ) {
        return true;
      }
      return false;
    });
  }, [orders, currentUser]);

  const pendingOrders = myOrders.filter((o) => o.status === 'pending');
  const runningOrders = myOrders.filter((o) => o.status === 'running');
  const finishedOrders = myOrders.filter((o) => o.status === 'finished');

  const arrivedStartingOrders = runningOrders.filter(
    (o) => o.trackingStep === 'arrived_pickup' || o.trackingStep === 'accepted' || !o.trackingStep
  );
  const inTransitOrders = runningOrders.filter(
    (o) => o.trackingStep === 'picked_up' || o.trackingStep === 'in_transit'
  );
  const arrivedDropOrders = runningOrders.filter((o) => o.trackingStep === 'arrived_drop');

  const filteredRunningOrders = runningOrders.filter((o) => {
    if (runningFilter === 'arrived_starting') {
      return o.trackingStep === 'arrived_pickup' || o.trackingStep === 'accepted' || !o.trackingStep;
    }
    if (runningFilter === 'in_transit') {
      return o.trackingStep === 'picked_up' || o.trackingStep === 'in_transit';
    }
    if (runningFilter === 'arrived_drop') {
      return o.trackingStep === 'arrived_drop';
    }
    return true;
  });

  const deliveryTypesList: { id: DeliveryType; title: string; desc: string; icon: any }[] = [
    { id: 'documents', title: 'Documents', desc: 'Contracts, Envelopes, Files', icon: FileText },
    { id: 'small_parcel', title: 'Small Parcel', desc: 'Boxes, Electronics, Apparel', icon: Package },
    { id: 'gift', title: 'Gift', desc: 'Flowers, Cakes, Surprise items', icon: Gift },
    { id: 'food', title: 'Food', desc: 'Hot Meals, Snacks, Beverages', icon: Utensils },
    { id: 'medicine', title: 'Medicine', desc: 'Prescriptions, Healthcare', icon: Pill },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Feed Sub-Header Navigation Tabs - Mobile App Look with Slide Arrows */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs py-2 px-2 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5">
          {/* Slide Arrow Left */}
          <button
            type="button"
            onClick={() => scrollNav('left')}
            aria-label="Slide tabs left"
            title="Slide left"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 shrink-0 z-10 cursor-pointer transition-all active:scale-95 shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4 text-slate-900" />
          </button>

          {/* Horizontal Scrollable Mobile Tab Bar */}
          <nav
            ref={navScrollRef}
            className="flex space-x-2 overflow-x-auto py-1 scrollbar-none scroll-smooth flex-1 items-center"
          >
            <button
              type="button"
              onClick={() => setActiveTab('book')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'book'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Book New</span>
            </button>

            {/* TAB 1: PENDING */}
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-950" />
              <span>Pending</span>
              <span className={`px-2 py-0.5 text-[11px] font-black rounded-full ${
                activeTab === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-200 text-amber-950'
              }`}>
                {pendingOrders.length}
              </span>
            </button>

            {/* TAB 2: RUNNING */}
            <button
              type="button"
              onClick={() => setActiveTab('running')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'running'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-400'
                  : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Package className="w-4 h-4 animate-bounce" />
              <span>Running</span>
              <span className={`px-2 py-0.5 text-[11px] font-black rounded-full ${
                activeTab === 'running' ? 'bg-white text-blue-800' : 'bg-blue-200 text-blue-950'
              }`}>
                {runningOrders.length}
              </span>
            </button>

            {/* TAB 3: FINISHED */}
            <button
              type="button"
              onClick={() => setActiveTab('finished')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'finished'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finished</span>
              <span className={`px-2 py-0.5 text-[11px] font-black rounded-full ${
                activeTab === 'finished' ? 'bg-white text-emerald-800' : 'bg-emerald-200 text-emerald-950'
              }`}>
                {finishedOrders.length}
              </span>
            </button>

            {/* PROFILE TAB */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Profile</span>
            </button>
          </nav>

          {/* Slide Arrow Right */}
          <button
            type="button"
            onClick={() => scrollNav('right')}
            aria-label="Slide tabs right"
            title="Slide right"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 shrink-0 z-10 cursor-pointer transition-all active:scale-95 shadow-2xs"
          >
            <ChevronRight className="w-4 h-4 text-slate-900" />
          </button>
        </div>
      </div>

      {/* Floating Real-Time Toast: When a pending order is accepted by rider */}
      {justAcceptedOrder && (
        <div className="fixed top-20 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-500 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg shrink-0 shadow-sm animate-pulse">
              ✓
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Rider Accepted Order!</span>
                </span>
                <button
                  type="button"
                  onClick={() => setJustAcceptedOrder(null)}
                  className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
                  aria-label="Close notification"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm font-bold text-white mt-0.5 truncate">
                {justAcceptedOrder.orderNumber} • {justAcceptedOrder.riderName || 'Delivery Partner'}
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Your pending request moved to <strong>Running Orders</strong>. Partner is heading to pickup location!
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('running');
                    setJustAcceptedOrder(null);
                  }}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>View Live Running Order &rarr;</span>
                </button>
                {justAcceptedOrder.riderPhone && (
                  <a
                    href={`tel:${justAcceptedOrder.riderPhone}`}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs flex items-center justify-center transition-colors shrink-0"
                    title="Call Rider"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={activeTab === 'book' ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6'}>
        {/* ========================================================
            TAB 1: BOOK ORDER FORM - FULL-PAGE GOOGLE MAP ACROSS THE ENTIRE MAIN PAGE
        ======================================================== */}
        {activeTab === 'book' && (
          <div className="relative w-full h-[calc(100vh-7.6rem)] min-h-[640px] overflow-hidden border-b border-slate-200/90 shadow-sm bg-slate-100 flex flex-col">
            {/* FULL-BLEED MAIN VIEW: INTERACTIVE GOOGLE MAP SPANNING EDGE-TO-EDGE AND TOP-TO-BOTTOM */}
            <MapPicker
              pickup={pickup}
              destination={destination}
              onSelectPickup={(loc) => {
                setPickup(loc);
                setPickupSearchQuery('');
                if (sheetState === 'collapsed') setSheetState('half');
              }}
              onSelectDestination={(loc) => {
                setDestination(loc);
                setDropoffSearchQuery('');
                if (sheetState === 'collapsed') setSheetState('half');
              }}
              activeMode={mapActiveMode}
              setActiveMode={setMapActiveMode}
              customerGps={customerGps}
              onCustomerGpsChange={(loc) => setCustomerGps(loc)}
              className="w-full h-full"
            />

            {/* FLOATING ACTION PILL ON MAP (WHEN COLLAPSED) */}
            {sheetState === 'collapsed' && (
              <button
                type="button"
                onClick={() => setSheetState('half')}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl flex items-center gap-2.5 border-2 border-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer animate-bounce"
              >
                <Package className="w-4 h-4" />
                <span>Open Booking Form &uarr;</span>
              </button>
            )}

            {/* ========================================================
                BOOKING FORM IN THE CENTER OF THE MAIN PAGE
                WITH DROP DOWN BUTTON AND SCROLL STYLE UP AND DOWN
                OPENS FROM BOTTOM OF MAIN PAGE TO TOP HALF PAGE
            ======================================================== */}
            <div
              className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-2 sm:px-4 z-30 transition-all duration-300 ease-in-out flex flex-col ${
                sheetState === 'collapsed'
                  ? 'h-[74px]'
                  : sheetState === 'half'
                  ? 'h-[56%] sm:h-[60%]'
                  : 'h-[92%]'
              }`}
            >
              <div className="bg-white/95 backdrop-blur-md rounded-t-3xl border-t-2 border-x-2 border-indigo-500/20 shadow-2xl flex flex-col h-full overflow-hidden">
                {/* DRAWER TOP BAR & DROP-DOWN BUTTON HEADER */}
                <div
                  onTouchStart={handleSheetTouchStart}
                  onTouchEnd={handleSheetTouchEnd}
                  className="px-4 py-2.5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 shrink-0 select-none"
                >
                  {/* Center Drag Handle (Scroll / Drag Indicator) */}
                  <div
                    onClick={() => setSheetState(sheetState === 'collapsed' ? 'half' : 'collapsed')}
                    className="w-14 h-1.5 bg-slate-300 hover:bg-indigo-500 rounded-full mx-auto mb-2 cursor-pointer transition-colors"
                    title={sheetState === 'collapsed' ? 'Click or scroll up to open' : 'Click or scroll down to drop'}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div
                      onClick={() => setSheetState(sheetState === 'collapsed' ? 'half' : 'collapsed')}
                      className="flex items-center gap-2.5 cursor-pointer min-w-0"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <Package className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading truncate">
                            Courier Booking Form
                          </h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 hidden xs:inline-block">
                            {sheetState === 'half'
                              ? 'Top Half Page'
                              : sheetState === 'full'
                              ? 'Full View'
                              : 'Bottom Docked'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {pickup && destination
                            ? `${distanceKm} km route • Total ${formatCurrency(calculatedFare)}`
                            : 'Scroll up to view fields & book delivery'}
                        </p>
                      </div>
                    </div>

                    {/* DROP DOWN BUTTON & CONTROLS */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Fare Badge */}
                      {calculatedFare > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-extrabold hidden sm:inline-block">
                          {formatCurrency(calculatedFare)}
                        </span>
                      )}

                      {/* DROP DOWN BUTTON (Requested primary feature) */}
                      {sheetState !== 'collapsed' ? (
                        <button
                          type="button"
                          onClick={() => setSheetState('collapsed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold text-xs transition-colors shadow-2xs cursor-pointer border border-slate-300"
                          title="Drop down to bottom of main page"
                          aria-label="Drop down booking form"
                        >
                          <ChevronDown className="w-4 h-4 text-slate-700 animate-pulse" />
                          <span>Drop Down</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSheetState('half')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors shadow-sm cursor-pointer"
                          title="Open from bottom of main page to top half page"
                          aria-label="Open booking form"
                        >
                          <ChevronUp className="w-4 h-4 text-white animate-pulse" />
                          <span>Open Form</span>
                        </button>
                      )}

                      {/* Expand/Restore Button */}
                      {sheetState === 'half' && (
                        <button
                          type="button"
                          onClick={() => setSheetState('full')}
                          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 cursor-pointer hidden sm:flex"
                          title="Expand to Full Height"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {sheetState === 'full' && (
                        <button
                          type="button"
                          onClick={() => setSheetState('half')}
                          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 cursor-pointer"
                          title="Restore to Top Half Page"
                        >
                          <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SCROLL STYLE UP AND DOWN: SCROLLABLE FORM BODY */}
                {sheetState !== 'collapsed' ? (
                  <form
                    onSubmit={handleBookOrder}
                    className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-300 overscroll-contain"
                  >
                    {/* SECTION 1: PICKUP & DROP ROUTE */}
                    <div className="space-y-4 pb-4 border-b border-slate-200/90">
                      {/* Box-less Route Flow with Vertical Stem */}
                      <div className="relative pl-7 space-y-4">
                        {/* Vertical Route Stem connecting A and B */}
                        <div className="absolute left-2.5 top-3.5 bottom-3.5 w-0.5 bg-gradient-to-b from-emerald-500 via-slate-300 to-rose-500 -translate-x-1/2"></div>

                        {/* POINT A: PICKUP */}
                        <div className="relative space-y-1">
                          {/* Node A marker along stem */}
                          <span className="absolute -left-7 top-1 w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center ring-4 ring-white shadow-xs">
                            A
                          </span>

                          {/* Seamless Single Input for Point A with inline Actions */}
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={pickupSearchQuery !== '' ? pickupSearchQuery : (pickup?.address || '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPickupSearchQuery(val);
                                const coords = inferCoordinatesFromAddress(
                                  val,
                                  pickup?.lat || 30.6425,
                                  pickup?.lng || 76.8173
                                );
                                setPickup({
                                  address: val,
                                  lat: coords.lat,
                                  lng: coords.lng,
                                });
                              }}
                              onFocus={() => setMapActiveMode('pickup')}
                              placeholder="Enter pickup address, sector, or landmark..."
                              className="w-full py-1.5 pl-0 pr-24 text-xs text-slate-900 placeholder-slate-400 bg-transparent border-0 border-b border-slate-300 focus:border-emerald-600 focus:outline-none transition-colors font-medium"
                            />

                            <div className="absolute right-0 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (customerGps) {
                                    setPickup(customerGps);
                                    setPickupSearchQuery('');
                                  } else if (typeof window !== 'undefined' && 'geolocation' in navigator) {
                                    navigator.geolocation.getCurrentPosition(
                                      (pos) => {
                                        const loc: LocationPoint = {
                                          lat: Number(pos.coords.latitude.toFixed(5)),
                                          lng: Number(pos.coords.longitude.toFixed(5)),
                                          address: `Live GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
                                        };
                                        setCustomerGps(loc);
                                        setPickup(loc);
                                        setPickupSearchQuery('');
                                      },
                                      () => {
                                        const fallback: LocationPoint = {
                                          lat: 30.7333,
                                          lng: 76.7794,
                                          address: 'Sector 17, Chandigarh (Live GPS Hub)',
                                        };
                                        setCustomerGps(fallback);
                                        setPickup(fallback);
                                        setPickupSearchQuery('');
                                      },
                                      { enableHighAccuracy: true, timeout: 8000 }
                                    );
                                  }
                                }}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                                title="Use current live GPS location as pickup point A"
                              >
                                <Crosshair className="w-3 h-3 text-blue-600 animate-pulse" />
                                <span>Live GPS</span>
                              </button>

                              {pickup && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPickup(null);
                                    setPickupSearchQuery('');
                                  }}
                                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Clear Pickup Point A"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            {/* Autocomplete Suggestions Dropdown */}
                            {pickupSearchQuery.trim().length > 0 && (
                              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                                {TRICITY_POPULAR_PRESETS.filter(
                                  (p) =>
                                    p.name.toLowerCase().includes(pickupSearchQuery.toLowerCase()) ||
                                    p.address.toLowerCase().includes(pickupSearchQuery.toLowerCase()) ||
                                    p.city.toLowerCase().includes(pickupSearchQuery.toLowerCase())
                                ).length > 0 ? (
                                  TRICITY_POPULAR_PRESETS.filter(
                                    (p) =>
                                      p.name.toLowerCase().includes(pickupSearchQuery.toLowerCase()) ||
                                      p.address.toLowerCase().includes(pickupSearchQuery.toLowerCase()) ||
                                      p.city.toLowerCase().includes(pickupSearchQuery.toLowerCase())
                                  ).map((preset) => (
                                    <button
                                      key={preset.name}
                                      type="button"
                                      onClick={() => {
                                        setPickup({ address: preset.address, lat: preset.lat, lng: preset.lng });
                                        setPickupSearchQuery('');
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex flex-col cursor-pointer"
                                    >
                                      <span className="text-xs font-bold text-slate-900">
                                        {preset.name} ({preset.city})
                                      </span>
                                      <span className="text-[10px] text-slate-500 truncate">{preset.address}</span>
                                    </button>
                                  ))
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const coords = inferCoordinatesFromAddress(pickupSearchQuery, 30.6425, 76.8173);
                                      setPickup({ address: pickupSearchQuery, lat: coords.lat, lng: coords.lng });
                                      setPickupSearchQuery('');
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex flex-col cursor-pointer"
                                  >
                                    <span className="text-xs font-bold text-emerald-800">
                                      Use: "{pickupSearchQuery}"
                                    </span>
                                    <span className="text-[10px] text-slate-500">Click to set as Point A</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {pickup && (
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                              <span>Point A: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}</span>
                              <span className="text-emerald-700 font-bold">✓ Selected</span>
                            </div>
                          )}
                        </div>

                        {/* Route Midpoint & Swap A ⇄ B Action (Box-less) */}
                        <div className="flex items-center justify-between py-1 text-xs">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-600">
                            <span className="text-emerald-600">A</span>
                            <span>&rarr;</span>
                            <span className="text-rose-600">B</span>
                            {pickup && destination && (
                              <span className="text-indigo-600 ml-1">({distanceKm} km)</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const tempP = pickup;
                              const tempD = destination;
                              setPickup(tempD);
                              setDestination(tempP);
                              const tempQ = pickupSearchQuery;
                              setPickupSearchQuery(dropoffSearchQuery);
                              setDropoffSearchQuery(tempQ);
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Swap Pickup (A) and Drop (B) locations"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Swap A ⇄ B</span>
                          </button>
                        </div>

                        {/* POINT B: DROPOFF */}
                        <div className="relative space-y-1">
                          {/* Node B marker along stem */}
                          <span className="absolute -left-7 top-1 w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center ring-4 ring-white shadow-xs">
                            B
                          </span>

                          {/* Seamless Single Input for Point B with inline Clear action */}
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={dropoffSearchQuery !== '' ? dropoffSearchQuery : (destination?.address || '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDropoffSearchQuery(val);
                                const coords = inferCoordinatesFromAddress(
                                  val,
                                  destination?.lat || 30.7333,
                                  destination?.lng || 76.7794
                                );
                                setDestination({
                                  address: val,
                                  lat: coords.lat,
                                  lng: coords.lng,
                                });
                              }}
                              onFocus={() => setMapActiveMode('destination')}
                              placeholder="Enter drop address, sector, or landmark..."
                              className="w-full py-1.5 pl-0 pr-12 text-xs text-slate-900 placeholder-slate-400 bg-transparent border-0 border-b border-slate-300 focus:border-rose-600 focus:outline-none transition-colors font-medium"
                            />

                            {destination && (
                              <div className="absolute right-0 flex items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDestination(null);
                                    setDropoffSearchQuery('');
                                  }}
                                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Clear Drop Point B"
                                >
                                  Clear
                                </button>
                              </div>
                            )}

                            {/* Autocomplete Suggestions Dropdown */}
                            {dropoffSearchQuery.trim().length > 0 && (
                              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                                {TRICITY_POPULAR_PRESETS.filter(
                                  (p) =>
                                    p.name.toLowerCase().includes(dropoffSearchQuery.toLowerCase()) ||
                                    p.address.toLowerCase().includes(dropoffSearchQuery.toLowerCase()) ||
                                    p.city.toLowerCase().includes(dropoffSearchQuery.toLowerCase())
                                ).length > 0 ? (
                                  TRICITY_POPULAR_PRESETS.filter(
                                    (p) =>
                                      p.name.toLowerCase().includes(dropoffSearchQuery.toLowerCase()) ||
                                      p.address.toLowerCase().includes(dropoffSearchQuery.toLowerCase()) ||
                                      p.city.toLowerCase().includes(dropoffSearchQuery.toLowerCase())
                                  ).map((preset) => (
                                    <button
                                      key={preset.name}
                                      type="button"
                                      onClick={() => {
                                        setDestination({ address: preset.address, lat: preset.lat, lng: preset.lng });
                                        setDropoffSearchQuery('');
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-rose-50 transition-colors flex flex-col cursor-pointer"
                                    >
                                      <span className="text-xs font-bold text-slate-900">
                                        {preset.name} ({preset.city})
                                      </span>
                                      <span className="text-[10px] text-slate-500 truncate">{preset.address}</span>
                                    </button>
                                  ))
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const coords = inferCoordinatesFromAddress(dropoffSearchQuery, 30.7333, 76.7794);
                                      setDestination({ address: dropoffSearchQuery, lat: coords.lat, lng: coords.lng });
                                      setDropoffSearchQuery('');
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-rose-50 transition-colors flex flex-col cursor-pointer"
                                  >
                                    <span className="text-xs font-bold text-rose-800">
                                      Use: "{dropoffSearchQuery}"
                                    </span>
                                    <span className="text-[10px] text-slate-500">Click to set as Point B</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {destination && (
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                              <span>Point B: {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}</span>
                              <span className="text-rose-700 font-bold">✓ Selected</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: DELIVERY TYPE & SCHEDULE - BOX-LESS DESIGN WITH ONLY ICONS */}
                    <div className="space-y-4 pb-4 border-b border-slate-200/90">
                      <div className="flex items-center justify-between pb-1">
                        <h3 className="text-xs font-bold font-heading text-slate-900 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-indigo-600" />
                          <span>Select Delivery &amp; Schedule</span>
                          <span className="text-[11px] font-bold text-indigo-600">
                            &bull; {deliveryTypesList.find((item) => item.id === deliveryType)?.title}
                          </span>
                        </h3>
                        <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">Step 2 of 4</span>
                      </div>

                      {/* Delivery Type Icons Only - Box-less */}
                      <div className="flex items-center gap-5 sm:gap-7 py-1">
                        {deliveryTypesList.map((item) => {
                          const IconComp = item.icon;
                          const isSelected = deliveryType === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setDeliveryType(item.id)}
                              title={`${item.title}: ${item.desc}`}
                              aria-label={item.title}
                              className={`relative flex flex-col items-center justify-center transition-all cursor-pointer p-1.5 ${
                                isSelected
                                  ? 'text-indigo-600 scale-115'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              <IconComp
                                className={`w-6 h-6 transition-all ${
                                  isSelected ? 'stroke-[2.5]' : 'stroke-[1.75]'
                                }`}
                              />
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1"></span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Schedule Delivery Date & Slot */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Delivery Date
                          </label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            required
                            className="w-full py-1.5 px-0 text-xs bg-transparent border-0 border-b border-slate-300 focus:border-indigo-600 focus:outline-none font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Pickup Slot
                          </label>
                          <select
                            value={selectedSlot}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                            required
                            className="w-full py-1.5 px-0 text-xs bg-transparent border-0 border-b border-slate-300 focus:border-indigo-600 focus:outline-none font-semibold text-indigo-900 cursor-pointer"
                          >
                            <option value="10:00AM To 12:00PM Zirakhpur to Chandigarh dropoff">
                              10:00AM To 12:00PM (Zirakpur to Chd)
                            </option>
                            <option value="12:00PM To 2:00PM Chandigarh To Mohali dropoff">
                              12:00PM To 2:00PM (Chd to Mohali)
                            </option>
                            <option value="2:00PM To 4:00PM Mohali To Kharar Dropoff">
                              2:00PM To 4:00PM (Mohali to Kharar)
                            </option>
                            <option value="4:00PM To 5:30 PM Kharar To Zirakhpur Dropoff">
                              4:00PM To 5:30 PM (Kharar to Zirakpur)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: RECIPIENT & SENDER CONTACT */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <h3 className="text-xs font-bold font-heading text-slate-900 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-indigo-600" />
                          <span>3. Recipient & Sender Contact</span>
                        </h3>
                        <span className="text-[10px] text-slate-500 font-medium">Step 3 of 4</span>
                      </div>

                      {/* Recipient Details (Point B) */}
                      <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">B</span>
                            <span>Recipient Contact &bull; Drop (B) *</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            required
                            placeholder="Recipient Full Name"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                          />
                          <input
                            type="tel"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                            required
                            placeholder="Recipient Mobile (+91)"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Sender Details (Point A) */}
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">A</span>
                            <span>Sender Contact &bull; Pickup (A) *</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            required
                            placeholder="Sender Full Name"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                          />
                          <input
                            type="tel"
                            value={senderPhone}
                            onChange={(e) => setSenderPhone(e.target.value)}
                            required
                            placeholder="Sender Mobile (+91)"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: PAYMENT METHOD & FARE CONFIRMATION */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <h3 className="text-xs font-bold font-heading text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-indigo-600" />
                          <span>4. Payment Method & Fare Summary</span>
                        </h3>
                        <span className="text-[10px] text-slate-500 font-medium">Step 4 of 4</span>
                      </div>

                      {/* Payment Method Selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('upi')}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                            paymentMethod === 'upi' || paymentMethod === 'qr'
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/20'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              <span>UPI Payment</span>
                              <span className="px-1 py-0.2 text-[8px] font-extrabold bg-indigo-600 text-white rounded">UPI</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Pay via GPay, PhonePe, Paytm</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                            paymentMethod === 'cash'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Cash on Delivery</div>
                            <div className="text-[10px] text-slate-500">Pay rider directly in cash</div>
                          </div>
                        </button>
                      </div>

                      {/* Fare Breakdown Box */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Total Calculated Fare</span>
                          <span className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>{distanceKm} km route • Base ₹30 + ₹10/extra km</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-medium">Estimated Total</span>
                          <span className="text-2xl font-black text-slate-900 font-heading">
                            {formatCurrency(calculatedFare)}
                          </span>
                        </div>
                      </div>

                      {/* Submit Order Button */}
                      <button
                        type="submit"
                        disabled={isBooking}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
                      >
                        {isBooking ? (
                          <span>Dispatching Order...</span>
                        ) : (
                          <>
                            <span>Confirm & Book Order</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    onClick={() => setSheetState('half')}
                    className="px-4 py-2 flex items-center justify-between text-xs text-slate-600 cursor-pointer bg-slate-50/70 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate text-xs">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-black text-[9px] flex items-center justify-center shrink-0">A</span>
                      <span className="truncate max-w-[130px] font-semibold text-slate-800">
                        {pickup ? pickup.address : 'Pickup A not set'}
                      </span>
                      <span className="text-slate-400 font-bold">&rarr;</span>
                      <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shrink-0">B</span>
                      <span className="truncate max-w-[130px] font-semibold text-slate-800">
                        {destination ? destination.address : 'Drop B not set'}
                      </span>
                    </div>
                    <span className="text-indigo-600 font-extrabold flex items-center gap-1 shrink-0 ml-2">
                      <span>Open Form</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: "Pending Requests" PAGE (CRITICAL USER REQUIREMENT)
            Shows on top of the page: delivery booking day and time!
        ======================================================== */}
        {activeTab === 'pending' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* TOP HEADER REQUIREMENT: Show delivery booking day and time */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10">
                <Clock className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-amber-100 text-xs font-bold uppercase tracking-wider mb-1">
                  <Clock className="w-4 h-4" />
                  <span>Pending Requests Feed Overview</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading mb-2">
                  Pending Requests ({pendingOrders.length})
                </h1>

                {/* Display Current Delivery Booking Day, Time & Selected Slot at the top */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-semibold text-white border border-white/20 shadow-inner">
                    <Calendar className="w-4 h-4 text-amber-200" />
                    <span>
                      Current Booking Day & Time:{' '}
                      <strong className="text-amber-100 font-bold">
                        {pendingOrders.length > 0
                          ? pendingOrders[0].bookingDayAndTime
                          : formatBookingDayAndTime()}
                      </strong>
                    </span>
                  </div>

                  {pendingOrders.length > 0 && (
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-semibold text-white border border-white/20 shadow-inner">
                      <Clock className="w-4 h-4 text-amber-200" />
                      <span>
                        Selected Pickup Slot:{' '}
                        <strong className="text-amber-100 font-bold">
                          {pendingOrders[0].scheduledDateTime || 'Immediate Pickup'}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notification when orders are active in Running tab */}
            {runningOrders.length > 0 && (
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-2xl border border-blue-500/50 shadow-md flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold shrink-0">
                    <Package className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>{runningOrders.length} Order(s) Accepted & Active</span>
                    </div>
                    <p className="text-xs text-slate-200 mt-0.5">
                      Delivery partner is assigned. Live tracking is active in Running Orders feed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('running')}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Go to Running Feed &rarr;</span>
                </button>
              </div>
            )}

            {/* Vertical Feed List View */}
            {pendingOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 font-heading">No Pending Requests</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {runningOrders.length > 0
                    ? `Your pending requests have been accepted by riders and moved to Running Orders!`
                    : `All your booked orders have been picked up by riders or completed.`}
                </p>
                <div className="flex items-center justify-center gap-2">
                  {runningOrders.length > 0 && (
                    <button
                      onClick={() => setActiveTab('running')}
                      className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-colors shadow-xs"
                    >
                      View {runningOrders.length} Running Order(s)
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('book')}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl text-xs hover:bg-indigo-700 transition-colors"
                  >
                    Book New Order Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 space-y-4 relative"
                  >
                    {/* Header Banner inside Order Card */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm font-heading">
                            {ord.orderNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            Awaiting Rider
                          </span>
                        </div>
                        {/* Delivery Booking Day, Time & Selected Pickup Slot */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                            📅 Delivery Booking Day & Time: <strong>{ord.bookingDayAndTime}</strong>
                          </div>
                          <div className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>Selected Pickup Slot: <strong className="text-indigo-950 font-bold">{ord.scheduledDateTime || 'Immediate Pickup'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900 font-heading">
                          {formatCurrency(ord.fare)}
                        </span>
                        <span className="text-[11px] text-slate-500 block uppercase font-medium">
                          {getPaymentLabel(ord.paymentMethod)} • {ord.distanceKm} km
                        </span>
                      </div>
                    </div>

                    {/* Route Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-0.5">
                          Pickup Location
                        </span>
                        <p className="text-slate-800 font-medium">{ord.pickup.address}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-rose-700 block mb-0.5">
                          Drop Location
                        </span>
                        <p className="text-slate-800 font-medium">{ord.destination.address}</p>
                      </div>
                    </div>

                    {/* Contact & Message Drop Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-1">
                        <div className="flex items-center justify-between text-indigo-900 font-bold text-[11px]">
                          <span>Recipient Contact</span>
                          <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">Dropoff</span>
                        </div>
                        <div className="text-slate-800 font-semibold">{ord.recipient.name} • {ord.recipient.phone}</div>
                        {ord.recipient.notes && (
                          <div className="text-[11px] text-indigo-800 flex items-start gap-1 pt-0.5">
                            <MessageSquare className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                            <span><strong>Note/Msg:</strong> {ord.recipient.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 space-y-1">
                        <div className="flex items-center justify-between text-emerald-900 font-bold text-[11px]">
                          <span>Sender Contact</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Pickup</span>
                        </div>
                        <div className="text-slate-800 font-semibold">
                          {ord.sender?.name || ord.customerName} • {ord.sender?.phone || ord.customerPhone}
                        </div>
                        {ord.sender?.notes && (
                          <div className="text-[11px] text-emerald-800 flex items-start gap-1 pt-0.5">
                            <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                            <span><strong>Note/Msg:</strong> {ord.sender.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Details Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
                      <div className="flex items-center gap-4">
                        <span className="capitalize font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          📦 {ord.deliveryType.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        OTP Code for Delivery: <b className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded">{ord.otpCode}</b>
                      </span>
                    </div>

                    {/* ORDER STATUS FOOTER */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>Status: <strong className="text-amber-800">Searching for Nearby Rider...</strong></span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                        Pending Partner Assignment
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: "Running" PAGE (Vertical Feed List View)
        ======================================================== */}
        {activeTab === 'running' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg space-y-4">
              <div>
                <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">
                  <Package className="w-4 h-4" />
                  <span>Active Deliveries Feed</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading mb-1">
                  Running Orders ({runningOrders.length})
                </h1>
                <p className="text-xs text-blue-100">
                  Track rider location and delivery progress live in real time.
                </p>
              </div>

              {/* FILTER TABS FOR RUNNING ORDERS (Starting with 'Arrived') */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => setRunningFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    runningFilter === 'all'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  All Running ({runningOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setRunningFilter('arrived_starting')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    runningFilter === 'arrived_starting'
                      ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-300'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                  <span>Arrived ({arrivedStartingOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRunningFilter('in_transit')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    runningFilter === 'in_transit'
                      ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-300'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  In Transit ({inTransitOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setRunningFilter('arrived_drop')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    runningFilter === 'arrived_drop'
                      ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-300'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Arrived Drop ({arrivedDropOrders.length})
                </button>
              </div>
            </div>

            {filteredRunningOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 font-heading">
                  No Running Orders in this Tab
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no orders matching the selected filter currently.
                </p>
                {runningFilter !== 'all' && (
                  <button
                    onClick={() => setRunningFilter('all')}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Show All Running Orders
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredRunningOrders.map((ord) => {
                  const isNewlyAccepted = ord.id === recentlyMovedOrderId || ord.id === justAcceptedOrder?.id;
                  return (
                  <div
                    key={ord.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden space-y-0 transition-all ${
                      isNewlyAccepted ? 'border-emerald-500 ring-2 ring-emerald-400/50 shadow-md' : 'border-slate-200'
                    }`}
                  >
                    {/* Highlighted Banner for newly accepted orders moved from pending */}
                    {isNewlyAccepted && (
                      <div className="bg-emerald-500 text-slate-950 px-4 py-2 text-xs font-black flex flex-wrap items-center justify-between gap-2 shadow-inner">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
                          <span>✓ ACCEPTED BY RIDER • MOVED TO RUNNING</span>
                        </div>
                        <span className="bg-slate-950 text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                          LIVE TRACKING ACTIVE
                        </span>
                      </div>
                    )}

                    {/* Top Status Bar */}
                    <div className="bg-indigo-900 text-white p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm font-heading">{ord.orderNumber}</span>
                          <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            <span>{ord.trackingStep?.replace('_', ' ') || 'Arrived at Starting Point'}</span>
                          </span>
                        </div>
                        <div className="text-[11px] text-indigo-200 mt-0.5">
                          Booked: {ord.bookingDayAndTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{formatCurrency(ord.fare)}</div>
                        <div className="text-[10px] text-indigo-200 uppercase font-semibold">
                          {getPaymentLabel(ord.paymentMethod)} • {ord.distanceKm} km
                        </div>
                      </div>
                    </div>

                    {/* Rider Info Card */}
                    {ord.riderName && (
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {ord.riderPhoto ? (
                            <img
                              src={ord.riderPhoto}
                              alt={ord.riderName}
                              className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-2xs"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-indigo-100 border-2 border-indigo-500 flex items-center justify-center text-indigo-700 font-bold text-sm">
                              {ord.riderName ? ord.riderName.charAt(0).toUpperCase() : 'R'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{ord.riderName}</div>
                            <div className="text-xs text-slate-500 font-medium">{ord.riderVehicle}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveChatOrder(ord)}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                            title="Send message to delivery partner"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message</span>
                          </button>
                          <a
                            href={`tel:${ord.riderPhone}`}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call Rider</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Step Tracker with 'Arrived' as 1st Tab */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">
                          Live Order Progress Timeline
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {ord.trackingStep === 'picked_up'
                            ? 'Step 2: Pickedup'
                            : ord.trackingStep === 'in_transit'
                            ? 'Step 3: In Transit'
                            : ord.trackingStep === 'arrived_drop'
                            ? 'Step 4: Arrived Drop'
                            : 'Step 1: Arrived'}
                        </span>
                      </div>

                      {/* 4-Step Progress Cards: Arrived, Pickedup, In Transit, Arrived Drop */}
                      {(() => {
                        const step = ord.trackingStep;
                        const isArrivedActive = step === 'arrived_pickup' || step === 'accepted' || !step;
                        const isPickedUpActive = step === 'picked_up';
                        const isInTransitActive = step === 'in_transit';
                        const isArrivedDropActive = step === 'arrived_drop' || step === 'delivered';

                        const isArrivedDone = true; // First step is always triggered/done once running
                        const isPickedUpDone = ['picked_up', 'in_transit', 'arrived_drop', 'delivered'].includes(step || '');
                        const isInTransitDone = ['in_transit', 'arrived_drop', 'delivered'].includes(step || '');
                        const isArrivedDropDone = ['arrived_drop', 'delivered'].includes(step || '');

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                            {/* Tab 1: Arrived */}
                            <div
                              className={`p-2.5 rounded-xl border transition-all ${
                                isArrivedActive
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-md ring-2 ring-emerald-400'
                                  : isArrivedDone
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              <div className="font-extrabold flex items-center justify-center gap-1 text-[11px]">
                                {isArrivedActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                                <span>1. Arrived</span>
                              </div>
                              <div className={`text-[10px] line-clamp-1 mt-0.5 ${isArrivedActive ? 'text-emerald-100' : 'text-slate-600'}`}>
                                {ord.pickup.address}
                              </div>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded mt-1.5 inline-block ${
                                  isArrivedActive
                                    ? 'bg-white text-emerald-800 shadow-2xs'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                📍 Arrived
                              </span>
                            </div>

                            {/* Tab 2: Pickedup */}
                            <div
                              className={`p-2.5 rounded-xl border transition-all ${
                                isPickedUpActive
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-md ring-2 ring-emerald-400'
                                  : isPickedUpDone
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                            >
                              <div className="font-extrabold flex items-center justify-center gap-1 text-[11px]">
                                {isPickedUpActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                                <span>2. Pickedup</span>
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isPickedUpActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                                Parcel Collected
                              </div>
                              {isPickedUpDone && (
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded mt-1.5 inline-block ${
                                    isPickedUpActive
                                      ? 'bg-white text-emerald-800 shadow-2xs'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  📦 Pickedup
                                </span>
                              )}
                            </div>

                            {/* Tab 3: In Transit */}
                            <div
                              className={`p-2.5 rounded-xl border transition-all ${
                                isInTransitActive
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-md ring-2 ring-emerald-400'
                                  : isInTransitDone
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                            >
                              <div className="font-extrabold flex items-center justify-center gap-1 text-[11px]">
                                {isInTransitActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                                <span>3. In Transit</span>
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isInTransitActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                                On the way
                              </div>
                              {isInTransitDone && (
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded mt-1.5 inline-block ${
                                    isInTransitActive
                                      ? 'bg-white text-emerald-800 shadow-2xs'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  🛵 In Transit
                                </span>
                              )}
                            </div>

                            {/* Tab 4: Arrived Drop */}
                            <div
                              className={`p-2.5 rounded-xl border transition-all ${
                                isArrivedDropActive
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-md ring-2 ring-emerald-400'
                                  : isArrivedDropDone
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                            >
                              <div className="font-extrabold flex items-center justify-center gap-1 text-[11px]">
                                {isArrivedDropActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                                <span>4. Arrived Drop</span>
                              </div>
                              <div className={`text-[10px] line-clamp-1 mt-0.5 ${isArrivedDropActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                                {ord.destination.address}
                              </div>
                              {isArrivedDropDone && (
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded mt-1.5 inline-block ${
                                    isArrivedDropActive
                                      ? 'bg-white text-emerald-800 shadow-2xs'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  🏁 Arrived Drop
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Contact Info Details Box */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 space-y-1">
                          <div className="flex items-center justify-between text-emerald-900 font-bold text-[11px]">
                            <span>Sender (Starting Point)</span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                              Pickup
                            </span>
                          </div>
                          <div className="text-slate-800 font-semibold">
                            {ord.sender?.name || ord.customerName} • {ord.sender?.phone || ord.customerPhone}
                          </div>
                          {ord.sender?.notes && (
                            <div className="text-[11px] text-emerald-800 flex items-start gap-1 pt-0.5">
                              <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                              <span><strong>Note/Msg:</strong> {ord.sender.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-1">
                          <div className="flex items-center justify-between text-indigo-900 font-bold text-[11px]">
                            <span>Recipient (Dropoff)</span>
                            <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded font-bold">
                              Destination
                            </span>
                          </div>
                          <div className="text-slate-800 font-semibold">
                            {ord.recipient.name} • {ord.recipient.phone}
                          </div>
                          {ord.recipient.notes && (
                            <div className="text-[11px] text-indigo-800 flex items-start gap-1 pt-0.5">
                              <MessageSquare className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                              <span><strong>Note/Msg:</strong> {ord.recipient.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OTP Verification Notice */}
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                        <span>Share OTP with rider upon arrival at drop location:</span>
                        <span className="font-mono text-base font-black bg-white px-2.5 py-1 rounded-lg border border-amber-300">
                          {ord.otpCode}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 4: "Finished" PAGE (Vertical Feed List View)
        ======================================================== */}
        {activeTab === 'finished' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Delivered Orders Feed</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading mb-1">
                Finished Orders ({finishedOrders.length})
              </h1>
              <p className="text-xs text-emerald-100">
                History of completed deliveries with receipt and proof of delivery.
              </p>
            </div>

            {finishedOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 font-heading">No Finished Deliveries Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Completed deliveries will appear here once delivered by rider.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {finishedOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">{ord.orderNumber}</span>
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                            ✓ DELIVERED
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Booked: {ord.bookingDayAndTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">{formatCurrency(ord.fare)}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{getPaymentLabel(ord.paymentMethod)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Pickup</span>
                        <p className="text-slate-800 font-medium">{ord.pickup.address}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Delivered To</span>
                        <p className="text-slate-800 font-medium">{ord.destination.address}</p>
                      </div>
                    </div>

                    {ord.proofPhotoUrl && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Delivery Proof Photo
                        </span>
                        <img
                          src={ord.proofPhotoUrl || undefined}
                          alt="Proof of delivery"
                          className="w-32 h-20 object-cover rounded-xl border border-slate-200"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 5: MY PROFILE
        ======================================================== */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {uploadSuccessToast && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-between shadow-xs animate-fade-in">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Profile picture updated successfully!</span>
                </span>
                <button
                  type="button"
                  onClick={() => setUploadSuccessToast(false)}
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
                      src={currentUser.photo || undefined}
                      alt={currentUser.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-600 shadow-md group-hover:opacity-90 transition-opacity"
                    />
                    <button
                      type="button"
                      onClick={() => profileFileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-xl shadow-md border-2 border-white cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                      title="Upload new profile picture"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold font-heading text-slate-900">
                      {currentUser.name && currentUser.name !== 'User' ? currentUser.name : (currentUser.email ? currentUser.email.split('@')[0] : 'Customer')}
                    </h2>
                    <p className="text-xs text-slate-500">{currentUser.email || 'No email registered'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Phone: {currentUser.phone || 'Not provided'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => profileFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200/80 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3 h-3 text-indigo-600" />
                        <span>Upload Photo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold font-heading text-slate-900">Saved Delivery Addresses</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(currentUser.name);
                      setEditPhone(currentUser.phone);
                      setEditEmail(currentUser.email || '');
                      setIsEditingProfile(true);
                    }}
                    className="text-xs font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Edit Profile
                  </button>
                </div>

                <div className="space-y-3">
                  {currentUser.savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3"
                    >
                      <div className="p-2 bg-white rounded-lg border border-slate-200 shrink-0">
                        <MapPin className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{addr.title}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{addr.address}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Account Sign Out Section */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Session & Security</h4>
                  <p className="text-[11px] text-slate-500">Sign out of your account on this device securely.</p>
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
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {isEditingProfile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold font-heading text-slate-900">Edit Customer Profile</h3>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* Rider Chat / Message Modal */}
      {activeChatOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center font-bold text-white">
                  {activeChatOrder.riderName ? activeChatOrder.riderName.charAt(0).toUpperCase() : 'R'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">{activeChatOrder.riderName || 'Delivery Partner'}</h3>
                  <p className="text-[11px] text-indigo-200">Order #{activeChatOrder.orderNumber} • {activeChatOrder.riderVehicle}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveChatOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Messages List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50 min-h-[260px] max-h-[400px]">
              {(!activeChatOrder.customerChatMessages || activeChatOrder.customerChatMessages.length === 0) ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">No messages yet. Send a message to your delivery partner regarding pickup instructions, drop-off location, or call timing.</p>
                </div>
              ) : (
                activeChatOrder.customerChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'customer' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                        msg.sender === 'customer'
                          ? 'bg-indigo-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                  </div>
                ))
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={chatMessageInput}
                onChange={(e) => setChatMessageInput(e.target.value)}
                placeholder="Type message to delivery partner..."
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  </div>
   );
};
