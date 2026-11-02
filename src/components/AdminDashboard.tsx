import React, { useState } from 'react';
import { Order, RiderProfile, UserProfile, WalletRechargeRequest, SupportChatMessage } from '../types';
import { formatCurrency } from '../utils/geoUtils';
import { calculateAdminEarningsSummary, DayEarningsSummary, CompletedRideRecord } from '../utils/earningsUtils';
import { useAuth } from '../hooks/useAuth';
import {
  isAppwriteConfigured,
  getStoredAppwriteConfig,
  clearAppwriteCredentials,
  saveAppwriteCredentials,
  testAppwriteConnection,
  APPWRITE_SETUP_GUIDE,
} from '../lib/appwrite';
import {
  LayoutDashboard,
  Clock,
  Package,
  CheckCircle2,
  XCircle,
  Check,
  DollarSign,
  Users,
  Search,
  Filter,
  RefreshCw,
  Bike,
  Plus,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CreditCard,
  BadgeCheck,
  Eye,
  User,
  Mail,
  Phone,
  AlertCircle,
  MessageSquare,
  X,
  LogOut,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  QrCode,
  Send,
  Cloud,
  Database,
  Trash2,
  Key,
  EyeOff,
  Zap,
  Code2,
} from 'lucide-react';

interface AdminDashboardProps {
  orders: Order[];
  riders: RiderProfile[];
  customers?: UserProfile[];
  platformQrImage?: string;
  onUpdatePlatformQrImage?: (qr: string) => void;
  onAssignRider: (orderId: string, riderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onAcceptOrder?: (orderId: string) => void;
  onOpenCustomerFeedWithTab: (tab: 'pending' | 'running' | 'finished') => void;
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
  onToggleBlockCustomer?: (customerId: string, block: boolean, reason?: string) => void;
  onToggleBlockRider?: (riderId: string, block: boolean, reason?: string) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onDeleteRider?: (riderId: string) => void;
  supportChatMessages?: SupportChatMessage[];
  walletRechargeRequests?: WalletRechargeRequest[];
  onApproveRechargeRequest?: (requestId: string, amount: number, riderId: string) => void;
  onRejectRechargeRequest?: (requestId: string, riderId: string) => void;
  onSendSupportMessage?: (msg: { riderId: string; sender: 'rider' | 'admin'; text: string; screenshotUrl?: string; amount?: number }) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  riders,
  customers = [],
  platformQrImage,
  supportChatMessages = [],
  walletRechargeRequests = [],
  onUpdatePlatformQrImage,
  onAssignRider,
  onCancelOrder,
  onAcceptOrder,
  onOpenCustomerFeedWithTab,
  onUpdateRiderKyc,
  onToggleBlockCustomer,
  onToggleBlockRider,
  onDeleteCustomer,
  onDeleteRider,
  onApproveRechargeRequest,
  onRejectRechargeRequest,
  onSendSupportMessage,
}) => {
  const { signOut } = useAuth();
  const [adminTab, setAdminTab] = useState<'orders' | 'kyc' | 'customers' | 'riders' | 'wallet-qr' | 'wallet-process' | 'support-chat' | 'earnings' | 'settings'>('orders');
  const [customEndpointInput, setCustomEndpointInput] = useState(() => {
    const { endpoint } = getStoredAppwriteConfig();
    return endpoint || 'https://cloud.appwrite.io/v1';
  });
  const [customProjectIdInput, setCustomProjectIdInput] = useState(() => {
    const { projectId } = getStoredAppwriteConfig();
    return projectId || '';
  });
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [appwriteSaveSuccess, setAppwriteSaveSuccess] = useState(false);
  const [appwriteErrorMessage, setAppwriteErrorMessage] = useState<string | null>(null);
  const [isTestingAppwrite, setIsTestingAppwrite] = useState(false);
  const [appwriteTestResult, setAppwriteTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [copiedAppwriteGuide, setCopiedAppwriteGuide] = useState(false);

  const handleSaveAppwriteSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setAppwriteErrorMessage(null);
    const res = saveAppwriteCredentials(customEndpointInput, customProjectIdInput);
    if (!res.success) {
      setAppwriteErrorMessage(res.error || 'Failed to save Appwrite credentials.');
      return;
    }
    setAppwriteSaveSuccess(true);
    setTimeout(() => {
      setAppwriteSaveSuccess(false);
      window.location.reload();
    }, 1000);
  };

  const handleRemoveAppwriteDatabase = () => {
    if (window.confirm('Are you sure you want to remove current Appwrite credentials? This will disconnect the backend and switch to local offline storage.')) {
      clearAppwriteCredentials();
      setCustomEndpointInput('https://cloud.appwrite.io/v1');
      setCustomProjectIdInput('');
      setAppwriteTestResult(null);
      setAppwriteSaveSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const handleTestAppwriteSettings = async () => {
    if (!customProjectIdInput.trim()) {
      setAppwriteErrorMessage('Please enter your Appwrite Project ID before testing.');
      return;
    }
    setIsTestingAppwrite(true);
    setAppwriteErrorMessage(null);
    setAppwriteTestResult(null);
    try {
      const result = await testAppwriteConnection(customEndpointInput.trim(), customProjectIdInput.trim());
      setAppwriteTestResult(result);
    } catch (err: any) {
      setAppwriteTestResult({
        success: false,
        message: err?.message || 'Connection test failed.',
      });
    } finally {
      setIsTestingAppwrite(false);
    }
  };

  const handleCopyAppwriteGuide = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(APPWRITE_SETUP_GUIDE);
      setCopiedAppwriteGuide(true);
      setTimeout(() => setCopiedAppwriteGuide(false), 2500);
    }
  };
  const [selectedSupportRiderId, setSelectedSupportRiderId] = useState<string>(riders[0]?.id || '');
  const [adminChatInput, setAdminChatInput] = useState('');
  const [activeFeedFilter, setActiveFeedFilter] = useState<'all' | 'pending' | 'running' | 'finished'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAdminUrl, setCopiedAdminUrl] = useState(false);
  const [adminExpandedDateKey, setAdminExpandedDateKey] = useState<string | null>(null);

  const adminEarnings = calculateAdminEarningsSummary(orders, riders);

  const adminPageUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : '';

  const handleCopyAdminUrl = () => {
    if (navigator.clipboard && adminPageUrl) {
      navigator.clipboard.writeText(adminPageUrl);
      setCopiedAdminUrl(true);
      setTimeout(() => setCopiedAdminUrl(false), 2500);
    }
  };

  // Customer & Rider Signups Tab states
  const [customerFilter, setCustomerFilter] = useState<'all' | 'new' | 'old' | 'blocked'>('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [riderFilter, setRiderFilter] = useState<'all' | 'new' | 'old' | 'blocked'>('all');
  const [riderSearch, setRiderSearch] = useState('');
  const [blockingTarget, setBlockingTarget] = useState<{ type: 'customer' | 'rider'; id: string; name: string } | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  // KYC Verification States
  const [kycFilter, setKycFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [kycSearchQuery, setKycSearchQuery] = useState('');
  const [selectedZoomDoc, setSelectedZoomDoc] = useState<{ title: string; url: string; riderName: string } | null>(null);
  const [rejectingRiderId, setRejectingRiderId] = useState<string | null>(null);
  const [rejectRemarkInput, setRejectRemarkInput] = useState('');

  const pendingKycCount = riders.filter((r) => !r.kycStatus || r.kycStatus === 'pending').length;
  const approvedKycCount = riders.filter((r) => r.kycStatus === 'approved').length;
  const rejectedKycCount = riders.filter((r) => r.kycStatus === 'rejected').length;

  // Metrics
  const totalRevenue = orders
    .filter((o) => o.status === 'finished' || o.paymentStatus === 'completed')
    .reduce((acc, o) => acc + o.fare, 0);

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const runningOrders = orders.filter((o) => o.status === 'running');
  const finishedOrders = orders.filter((o) => o.status === 'finished');

  const filteredOrders = orders.filter((o) => {
    if (activeFeedFilter !== 'all' && o.status !== activeFeedFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.recipient.name.toLowerCase().includes(q) ||
        o.pickup.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredRiders = riders.filter((r) => {
    const kyc = r.kycStatus || 'pending';
    if (kycFilter !== 'all' && kyc !== kycFilter) return false;
    if (kycSearchQuery.trim()) {
      const q = kycSearchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.plateNumber.toLowerCase().includes(q) ||
        (r.drivingLicence && r.drivingLicence.toLowerCase().includes(q)) ||
        (r.rcNumber && r.rcNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 rounded-xl">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight">
                QuickDrop Admin Operations
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live Logistics Control Room • Customer Feed & Fleet KYC Document Verification
            </p>
          </div>

          {/* Navigation Bar Tabs */}
          <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700 flex-wrap">
            <button
              onClick={() => setAdminTab('orders')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                adminTab === 'orders'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Master Orders</span>
            </button>

            <button
              onClick={() => setAdminTab('kyc')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer relative ${
                adminTab === 'kyc'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>KYC Approval</span>
              {pendingKycCount > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full animate-pulse">
                  {pendingKycCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setAdminTab('customers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                adminTab === 'customers'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customer Signups</span>
            </button>

            <button
              onClick={() => setAdminTab('riders')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                adminTab === 'riders'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>Rider Signups</span>
            </button>

            <button
              onClick={() => setAdminTab('wallet-qr')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                adminTab === 'wallet-qr'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Wallet QR Setup</span>
            </button>

            <button
              onClick={() => setAdminTab('wallet-process')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer relative ${
                adminTab === 'wallet-process'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Money under process</span>
              {walletRechargeRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full animate-pulse">
                  {walletRechargeRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setAdminTab('earnings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                adminTab === 'earnings'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Earnings</span>
            </button>

            <button
              onClick={() => setAdminTab('support-chat')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer relative ${
                adminTab === 'support-chat'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>QuickDrop support</span>
            </button>

            <button
              onClick={() => setAdminTab('settings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                adminTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Cloud Sync</span>
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              className="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 shadow-sm"
              title="Sign out of Admin Dashboard"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <>
          {adminTab === 'orders' ? (
          <>
            {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider block">
              Total Revenue
            </span>
            <div className="text-2xl font-black text-slate-900 font-heading mt-1">
              {formatCurrency(totalRevenue)}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
              From completed & UPI bookings
            </span>
          </div>

          <button
            onClick={() => onOpenCustomerFeedWithTab('pending')}
            className="bg-white p-4 rounded-2xl border border-amber-200 hover:border-amber-400 shadow-xs text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-800 font-extrabold uppercase tracking-wider">
                Pending Requests
              </span>
              <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-amber-600 font-heading mt-1">
              {pendingOrders.length}
            </div>
            <span className="text-[10px] text-amber-700 font-semibold mt-1 block underline">
              View Feed Page →
            </span>
          </button>

          <button
            onClick={() => onOpenCustomerFeedWithTab('running')}
            className="bg-white p-4 rounded-2xl border border-blue-200 hover:border-blue-400 shadow-xs text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-blue-800 font-extrabold uppercase tracking-wider">
                Running Orders
              </span>
              <Package className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-blue-600 font-heading mt-1">
              {runningOrders.length}
            </div>
            <span className="text-[10px] text-blue-700 font-semibold mt-1 block underline">
              View Feed Page →
            </span>
          </button>

          <button
            onClick={() => onOpenCustomerFeedWithTab('finished')}
            className="bg-white p-4 rounded-2xl border border-emerald-200 hover:border-emerald-400 shadow-xs text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-800 font-extrabold uppercase tracking-wider">
                Finished Orders
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black text-emerald-600 font-heading mt-1">
              {finishedOrders.length}
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold mt-1 block underline">
              View Feed Page →
            </span>
          </button>
        </div>

        {/* Master Orders Table / Feed View */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm font-heading text-slate-900">Logistics Master Feed</span>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {filteredOrders.length} Orders
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Pills */}
              <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setActiveFeedFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    activeFeedFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFeedFilter('pending')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    activeFeedFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Pending ({pendingOrders.length})
                </button>
                <button
                  onClick={() => setActiveFeedFilter('running')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    activeFeedFilter === 'running' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Running ({runningOrders.length})
                </button>
                <button
                  onClick={() => setActiveFeedFilter('finished')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    activeFeedFilter === 'finished' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Finished ({finishedOrders.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order ID or customer..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No orders matching the selected filter or search.
              </div>
            ) : (
              filteredOrders.map((ord) => (
                <div key={ord.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 font-heading">{ord.orderNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          ord.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : ord.status === 'running'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {ord.status}
                      </span>
                      <span className="text-slate-500">
                        <b>{ord.deliveryType}</b> • {ord.distanceKm} km
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">{formatCurrency(ord.fare)}</span>
                      {ord.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500">Assign Rider:</span>
                          <select
                            onChange={(e) => {
                              if (e.target.value) onAssignRider(ord.id, e.target.value);
                            }}
                            className="bg-white border border-slate-300 rounded-lg text-xs py-1 px-1.5 font-medium"
                          >
                            <option value="">Select Rider...</option>
                            {riders.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.vehicle})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 uppercase block">
                        Booking Day & Time
                      </span>
                      <span className="font-semibold text-slate-800 block">{ord.bookingDayAndTime}</span>
                      <span className="text-[10px] font-bold text-indigo-800 uppercase block mt-1">
                        Pickup Slot
                      </span>
                      <span className="font-bold text-indigo-950 text-[11px] block">{ord.scheduledDateTime || 'Immediate Pickup'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Pickup & Sender</span>
                      <span className="line-clamp-1">{ord.pickup.address}</span>
                      <div className="text-[11px] font-medium text-slate-700 mt-0.5">
                        Sender: {ord.sender?.name || ord.customerName} ({ord.sender?.phone || ord.customerPhone})
                      </div>
                      {ord.sender?.notes && (
                        <div className="text-[10px] text-emerald-700 font-semibold line-clamp-1">
                          Msg: {ord.sender.notes}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Drop & Recipient</span>
                      <span className="line-clamp-1">{ord.destination.address}</span>
                      <div className="text-[11px] font-medium text-slate-700 mt-0.5">
                        Recipient: {ord.recipient.name} ({ord.recipient.phone})
                      </div>
                      {ord.recipient.notes && (
                        <div className="text-[10px] text-indigo-700 font-semibold line-clamp-1">
                          Msg: {ord.recipient.notes}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Assigned Rider</span>
                      <span className="font-semibold text-slate-800">
                        {ord.riderName ? `${ord.riderName} (${ord.riderPhone})` : 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Accept / Decline Action Row below Order */}
                  {ord.status === 'pending' && (
                    <div className="pt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">Order Action:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onCancelOrder(ord.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Decline Order</span>
                        </button>
                        <button
                          onClick={() => {
                            if (onAcceptOrder) {
                              onAcceptOrder(ord.id);
                            } else {
                              onAssignRider(ord.id, riders[0].id);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>Accept Order</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </>
    ) : adminTab === 'kyc' ? (
      /* ========================================================
          ADMIN TAB 2: "Partner Document Verification Approval"
      ======================================================== */
      <div className="space-y-6">
        {/* KYC Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider block">
              Total Fleet Partners
            </span>
            <div className="text-2xl font-black text-slate-900 font-heading mt-1">
              {riders.length}
            </div>
            <span className="text-[10px] text-slate-500 font-semibold mt-1 block">
              Registered Riders
            </span>
          </div>

          <button
            type="button"
            onClick={() => setKycFilter('pending')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              kycFilter === 'pending'
                ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                : 'bg-white border-amber-200 hover:border-amber-400 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                kycFilter === 'pending' ? 'text-amber-100' : 'text-amber-800'
              }`}>
                Pending Approval
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-heading mt-1">
              {pendingKycCount}
            </div>
            <span className={`text-[10px] font-semibold mt-1 block ${
              kycFilter === 'pending' ? 'text-amber-100' : 'text-amber-700'
            }`}>
              Requires Document Review
            </span>
          </button>

          <button
            type="button"
            onClick={() => setKycFilter('approved')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              kycFilter === 'approved'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                : 'bg-white border-emerald-200 hover:border-emerald-400 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                kycFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-800'
              }`}>
                Approved Partners
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black font-heading mt-1">
              {approvedKycCount}
            </div>
            <span className={`text-[10px] font-semibold mt-1 block ${
              kycFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-700'
            }`}>
              Active Verified Riders
            </span>
          </button>

          <button
            type="button"
            onClick={() => setKycFilter('rejected')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              kycFilter === 'rejected'
                ? 'bg-rose-600 text-white border-rose-700 shadow-md'
                : 'bg-white border-rose-200 hover:border-rose-400 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                kycFilter === 'rejected' ? 'text-rose-100' : 'text-rose-800'
              }`}>
                Action Needed / Rejected
              </span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black font-heading mt-1">
              {rejectedKycCount}
            </div>
            <span className={`text-[10px] font-semibold mt-1 block ${
              kycFilter === 'rejected' ? 'text-rose-100' : 'text-rose-700'
            }`}>
              Resubmission Pending
            </span>
          </button>
        </div>

        {/* KYC Filter Header & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h2 className="font-extrabold text-sm text-slate-900 font-heading">
              Delivery Partner Document Verification Feed
            </h2>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-black rounded-full">
              {filteredRiders.length} Partners
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
              <button
                type="button"
                onClick={() => setKycFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  kycFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                All Fleet ({riders.length})
              </button>
              <button
                type="button"
                onClick={() => setKycFilter('pending')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  kycFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                Pending ({pendingKycCount})
              </button>
              <button
                type="button"
                onClick={() => setKycFilter('approved')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  kycFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                Approved ({approvedKycCount})
              </button>
              <button
                type="button"
                onClick={() => setKycFilter('rejected')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  kycFilter === 'rejected' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-600'
                }`}
              >
                Rejected ({rejectedKycCount})
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={kycSearchQuery}
                onChange={(e) => setKycSearchQuery(e.target.value)}
                placeholder="Search partner name, DL, RC..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 w-56"
              />
            </div>
          </div>
        </div>

        {/* Fleet Partner Cards */}
        <div className="space-y-4">
          {filteredRiders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No delivery partners found matching the selected verification filter.
            </div>
          ) : (
            filteredRiders.map((r) => {
              const status = r.kycStatus || 'pending';
              const dlNumber = r.drivingLicence || 'Not Provided';
              const dlImg = r.drivingLicenceImg || '';
              const rcNumber = r.rcNumber || 'Not Provided';
              const rcImg = r.rcImg || '';
              const aadhaarNumber = r.aadhaarCard || 'Not Provided';
              const aadhaarImg = r.aadhaarImg || '';
              const panNumber = r.panCard || 'Not Provided';
              const panImg = r.panImg || '';

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                >
                  {/* Partner Header & Status Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      {r.photo ? (
                        <img
                          src={r.photo}
                          alt={r.name || 'Partner'}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-amber-800 font-extrabold text-lg">
                          {r.name ? r.name.charAt(0).toUpperCase() : 'R'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-900 font-heading">{r.name || 'Unnamed Partner'}</h3>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-black text-[10px] rounded-md">
                            ★ {r.rating}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1 font-bold text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{r.phone}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-blue-600" />
                            <span>{r.email || `${r.name.toLowerCase().replace(/\s+/g, '.')}@quickdrop.in`}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-900 font-semibold">
                            <Bike className="w-3.5 h-3.5 text-amber-600" />
                            <span>{r.vehicle} ({r.plateNumber})</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {status === 'approved' && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>KYC Approved & Verified</span>
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-amber-300">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Pending Review</span>
                        </span>
                      )}
                      {status === 'rejected' && (
                        <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-rose-200">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>Action Needed / Rejected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remarks callout if any */}
                  {r.kycRemarks && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-slate-900 block text-[10px] uppercase tracking-wider">
                          Admin Remarks & Verification Notes:
                        </span>
                        <span className="font-medium">{r.kycRemarks}</span>
                      </div>
                    </div>
                  )}

                  {/* Document Grid (4 Official Credentials) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. DL */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>1. Driving Licence</span>
                        </span>
                        <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded-md">DL</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 block truncate">{dlNumber}</span>
                      <div className="relative group h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-200 shadow-xs">
                        <img src={dlImg} alt="Driving Licence" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSelectedZoomDoc({ title: 'Driving Licence (DL)', url: dlImg, riderName: r.name })}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Zoom</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. RC */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider flex items-center gap-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>2. RC Certificate</span>
                        </span>
                        <span className="text-[9px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded-md">RC</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 block truncate">{rcNumber}</span>
                      <div className="relative group h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-200 shadow-xs">
                        <img src={rcImg} alt="RC Certificate" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSelectedZoomDoc({ title: 'RC Certificate', url: rcImg, riderName: r.name })}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Zoom</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. Aadhaar */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                          <span>3. Aadhaar Card</span>
                        </span>
                        <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded-md">ID</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 block truncate">{aadhaarNumber}</span>
                      <div className="relative group h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-200 shadow-xs">
                        <img src={aadhaarImg} alt="Aadhaar Card" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSelectedZoomDoc({ title: 'Aadhaar Card', url: aadhaarImg, riderName: r.name })}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Zoom</span>
                        </button>
                      </div>
                    </div>

                    {/* 4. PAN */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-orange-900 uppercase tracking-wider flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-orange-600" />
                          <span>4. PAN Card</span>
                        </span>
                        <span className="text-[9px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded-md">TAX</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 block truncate">{panNumber}</span>
                      <div className="relative group h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-200 shadow-xs">
                        <img src={panImg} alt="PAN Card" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSelectedZoomDoc({ title: 'PAN Card', url: panImg, riderName: r.name })}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Zoom</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Admin Approval Control Row */}
                  <div className="pt-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingRiderId(r.id);
                        setRejectRemarkInput(r.kycRemarks || '');
                      }}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Reject / Request Re-upload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateRiderKyc) {
                          onUpdateRiderKyc(r.id, 'approved', 'Documents verified & approved by QuickDrop Admin');
                        }
                      }}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Approve KYC Documents</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    ) : adminTab === 'customers' ? (
      /* ========================================================
          ADMIN TAB 3: "Customer Signups (New & Old)"
      ======================================================== */
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black font-heading text-slate-900">Customer Signups (New & Old)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage customer accounts, review signups, and block or terminate accounts for misbehavior.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer name, email, phone..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button onClick={() => setCustomerFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${customerFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}>All</button>
              <button onClick={() => setCustomerFilter('new')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${customerFilter === 'new' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}>New Signups</button>
              <button onClick={() => setCustomerFilter('old')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${customerFilter === 'old' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}>Old Signups</button>
              <button onClick={() => setCustomerFilter('blocked')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${customerFilter === 'blocked' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'}`}>Blocked / Terminated</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(!customers || customers.length === 0) ? (
            <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm">No customer accounts found.</p>
            </div>
          ) : (
            customers
              .filter(c => {
                if (customerFilter === 'blocked') return c.isBlocked;
                if (customerFilter === 'new') return (c.createdAt || '').startsWith('2026-08');
                if (customerFilter === 'old') return !(c.createdAt || '').startsWith('2026-08');
                return true;
              })
              .filter(c => {
                if (!customerSearch.trim()) return true;
                const q = customerSearch.toLowerCase();
                return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
              })
              .map(c => {
                const isNew = (c.createdAt || '').startsWith('2026-08');
                return (
                  <div key={c.id} className={`bg-white p-5 rounded-3xl border shadow-xs space-y-4 transition-all ${c.isBlocked ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm uppercase overflow-hidden shrink-0 border border-indigo-200">
                          {c.photo ? (
                            <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            (c.name ? c.name.charAt(0) : 'C')
                          )}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900">{c.name || 'Customer Account'}</h3>
                          <span className="text-[10px] text-slate-500 font-medium block">{c.email || 'No email'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md ${isNew ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                          {isNew ? 'New Signup' : 'Old Signup'}
                        </span>
                        {c.isBlocked && (
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md animate-pulse">
                            Blocked / Terminated
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Phone:</span>
                        <span className="font-bold text-slate-900">{c.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Signup Date:</span>
                        <span className="font-bold text-slate-900">{c.createdAt || '2026-06-01'}</span>
                      </div>
                      {c.isBlocked && c.blockReason && (
                        <div className="pt-1 border-t border-rose-200 text-rose-700 font-semibold text-[11px]">
                          Reason: {c.blockReason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {c.isBlocked ? (
                        <button
                          type="button"
                          onClick={() => onToggleBlockCustomer && onToggleBlockCustomer(c.id, false)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Unblock Account</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBlockingTarget({ type: 'customer', id: c.id, name: c.name || 'Customer' });
                            setBlockReasonInput('Misbehavior / Violation of Terms');
                          }}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Block / Terminate</span>
                        </button>
                      )}
                      {onDeleteCustomer && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomer(c.id)}
                          className="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Delete Account"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    ) : adminTab === 'riders' ? (
      /* ========================================================
          ADMIN TAB 4: "Rider Signups (New & Old)"
      ======================================================== */
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black font-heading text-slate-900">Rider Signups (New & Old)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage delivery partner accounts, review signups, and block or terminate accounts for misbehavior.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                placeholder="Search rider name, vehicle, phone..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button onClick={() => setRiderFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${riderFilter === 'all' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'}`}>All</button>
              <button onClick={() => setRiderFilter('new')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${riderFilter === 'new' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'}`}>New Signups</button>
              <button onClick={() => setRiderFilter('old')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${riderFilter === 'old' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'}`}>Old Signups</button>
              <button onClick={() => setRiderFilter('blocked')} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${riderFilter === 'blocked' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'}`}>Blocked / Terminated</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(!riders || riders.length === 0) ? (
            <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500">
              <Bike className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm">No rider partner signups found.</p>
            </div>
          ) : (
            riders
              .filter(r => {
                if (riderFilter === 'blocked') return r.isBlocked;
                if (riderFilter === 'new') return (r.createdAt || '').startsWith('2026-08');
                if (riderFilter === 'old') return !(r.createdAt || '').startsWith('2026-08');
                return true;
              })
              .filter(r => {
                if (!riderSearch.trim()) return true;
                const q = riderSearch.toLowerCase();
                return (r.name || '').toLowerCase().includes(q) || (r.vehicle || '').toLowerCase().includes(q) || (r.phone || '').toLowerCase().includes(q) || (r.plateNumber || '').toLowerCase().includes(q);
              })
              .map(r => {
                const isNew = (r.createdAt || '').startsWith('2026-08');
                return (
                  <div key={r.id} className={`bg-white p-5 rounded-3xl border shadow-xs space-y-4 transition-all ${r.isBlocked ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 hover:border-amber-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm uppercase overflow-hidden shrink-0 border border-amber-200">
                          {r.photo ? (
                            <img src={r.photo} alt={r.name} className="w-full h-full object-cover" />
                          ) : (
                            <Bike className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900">{r.name || 'Rider Partner'}</h3>
                          <span className="text-[10px] text-slate-500 font-medium block">{r.vehicle || 'EV Bike'} • {r.plateNumber || 'PB65'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md ${isNew ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                          {isNew ? 'New Signup' : 'Old Signup'}
                        </span>
                        {r.isBlocked && (
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md animate-pulse">
                            Blocked / Terminated
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Phone:</span>
                        <span className="font-bold text-slate-900">{r.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">KYC Status:</span>
                        <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-md ${r.kycStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {r.kycStatus || 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">Signup Date:</span>
                        <span className="font-bold text-slate-900">{r.createdAt || '2026-06-15'}</span>
                      </div>
                      {r.isBlocked && r.blockReason && (
                        <div className="pt-1 border-t border-rose-200 text-rose-700 font-semibold text-[11px]">
                          Reason: {r.blockReason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {r.isBlocked ? (
                        <button
                          type="button"
                          onClick={() => onToggleBlockRider && onToggleBlockRider(r.id, false)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Unblock Account</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBlockingTarget({ type: 'rider', id: r.id, name: r.name || 'Rider Partner' });
                            setBlockReasonInput('Misbehavior / Policy Violation');
                          }}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Block / Terminate</span>
                        </button>
                      )}
                      {onDeleteRider && (
                        <button
                          type="button"
                          onClick={() => onDeleteRider(r.id)}
                          className="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Delete Account"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    ) : adminTab === 'wallet-qr' ? (
      /* ========================================================
          ADMIN TAB 5: "Wallet QR Setup"
      ======================================================== */
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black font-heading text-slate-900">Wallet Recharge QR Code Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload or update the official platform UPI QR code that delivery partners scan to recharge their app wallet when balance is zero.</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-6 text-center">
          <div className="w-48 h-48 mx-auto bg-slate-50 p-3 rounded-2xl border-2 border-slate-300 shadow-md flex items-center justify-center relative group">
            {platformQrImage ? (
              <img
                src={platformQrImage}
                alt="Platform UPI QR Code"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="w-full h-full relative bg-emerald-50 rounded-xl p-1.5 flex flex-col items-center justify-center border border-emerald-300">
                <div className="w-full h-full grid grid-cols-6 gap-1 p-1 bg-emerald-600 rounded-lg">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-xs ${i === 0 || i === 5 || i === 30 || i === 35 || i % 3 === 0 ? 'bg-white' : 'bg-emerald-800'}`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-orange-500 border-2 border-white shadow-md flex items-center justify-center text-white font-black text-xs">
                    ₹
                  </div>
                </div>
              </div>
            )}
            <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer p-2 text-xs font-bold rounded-2xl">
              <QrCode className="w-6 h-6 mb-1" />
              <span>Change QR Code</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onUpdatePlatformQrImage) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      onUpdatePlatformQrImage(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-sm text-slate-900">Official Platform UPI QR Code</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Delivery partners with zero wallet balance scan this QR code to recharge their app wallet with ₹100 instant points.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <label className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer inline-flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              <span>Upload New QR Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onUpdatePlatformQrImage) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      onUpdatePlatformQrImage(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
            {platformQrImage && (
              <button
                type="button"
                onClick={() => {
                  if (onUpdatePlatformQrImage) {
                    onUpdatePlatformQrImage('');
                  }
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Reset Default
              </button>
            )}
          </div>
        </div>
      </div>
    ) : adminTab === 'wallet-process' ? (
      /* ========================================================
          ADMIN TAB: "Money under process"
      ======================================================== */
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black font-heading text-slate-900">Money under process (Wallet Recharge Requests)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Review payment screenshots submitted by delivery partners and approve to credit wallet instantly.</p>
          </div>
          <div className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold">
            Pending Requests: {walletRechargeRequests.filter(r => r.status === 'pending').length}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {walletRechargeRequests.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-2">
              <CreditCard className="w-12 h-12 mx-auto opacity-40 text-slate-400" />
              <p className="font-bold text-sm">No wallet recharge requests under process.</p>
              <p className="text-xs">When delivery partners scan QR code and upload screenshot, they will appear here.</p>
            </div>
          ) : (
            walletRechargeRequests.map(req => {
              const riderObj = riders.find(r => r.id === req.riderId);
              return (
                <div key={req.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div className="p-5 border-b border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {req.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center">
                        {req.riderName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{req.riderName}</h4>
                        <p className="text-xs text-slate-500">{req.riderPhone}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Requested Amount:</span>
                      <span className="text-base font-black text-emerald-700 font-heading">₹{req.amount}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Screenshot</span>
                      {req.screenshotUrl ? (
                        <div className="h-40 rounded-xl overflow-hidden border border-slate-300 bg-black/5 cursor-pointer" onClick={() => setSelectedZoomDoc({ title: 'Recharge Payment Screenshot', url: req.screenshotUrl, riderName: req.riderName })}>
                          <img src={req.screenshotUrl} alt="Screenshot" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No screenshot attached</p>
                      )}
                    </div>

                    <div className="text-xs text-slate-600">
                      Current Rider Wallet Balance: <b className="text-slate-900">{formatCurrency(riderObj?.walletBalance || 0)}</b>
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block text-center">Quick Trigger Approval</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onApproveRechargeRequest) onApproveRechargeRequest(req.id, 100, req.riderId);
                          }}
                          className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve ₹100</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onApproveRechargeRequest) onApproveRechargeRequest(req.id, 200, req.riderId);
                          }}
                          className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve ₹200</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onApproveRechargeRequest) onApproveRechargeRequest(req.id, req.amount, req.riderId);
                          }}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          Approve ₹{req.amount}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onRejectRechargeRequest) onRejectRechargeRequest(req.id, req.riderId);
                          }}
                          className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    ) : adminTab === 'earnings' ? (
      /* ========================================================
          ADMIN TAB: "Earnings" (Platform Financial Intelligence)
      ======================================================== */
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black font-heading text-slate-900">Platform Financial & Earnings Intelligence</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time tracking of captain earnings, platform commissions, and completed trip history.</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Timezone: Asia/Kolkata</span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today's Platform Rides</span>
            <div className="text-2xl font-black font-heading text-slate-900 mt-1">
              {adminEarnings.todayPlatformRides} Trips
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
              Active Today in Asia/Kolkata
            </span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today's Captain Earnings</span>
            <div className="text-2xl font-black font-heading text-emerald-600 mt-1">
              {formatCurrency(adminEarnings.todayCaptainEarnings)}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Gross payout to all captains today
            </span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today's Platform Commission (10%)</span>
            <div className="text-2xl font-black font-heading text-indigo-600 mt-1">
              {formatCurrency(adminEarnings.todayPlatformCommission)}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Platform earnings today
            </span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Completed Trips</span>
            <div className="text-2xl font-black font-heading text-slate-900 mt-1">
              {adminEarnings.totalCompletedRides} Trips
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              All-time completed orders
            </span>
          </div>
        </div>

        {/* Individual Captain Breakdown Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-black font-heading text-slate-900">Individual Captain Earnings Breakdown</h3>
          {adminEarnings.captainBreakdown.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No captain earnings recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-black text-[10px]">
                    <th className="pb-3 px-3">Captain Name</th>
                    <th className="pb-3 px-3 text-center">Completed Rides</th>
                    <th className="pb-3 px-3 text-right">Total Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminEarnings.captainBreakdown.map((cap) => (
                    <tr key={cap.riderId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-bold text-slate-900">{cap.riderName}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">{cap.count}</td>
                      <td className="py-3 px-3 text-right font-black font-heading text-emerald-600">{formatCurrency(cap.earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Earnings History & Completed Rides Log */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-black font-heading text-slate-900">Earnings History & Completed Rides Audit Log</h3>
          {adminEarnings.history.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">No completed rides history available.</div>
          ) : (
            <div className="space-y-4">
              {adminEarnings.history.map((day) => {
                const isExpanded = adminExpandedDateKey === day.dateKey;
                return (
                  <div key={day.dateKey} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                    <div
                      onClick={() => setAdminExpandedDateKey(isExpanded ? null : day.dateKey)}
                      className="p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {day.rideCount}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 font-heading">{day.formattedDate}</h4>
                          <p className="text-[11px] text-slate-500">{day.rideCount} rides • Commission: {formatCurrency(day.platformCommission)}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-sm font-black text-emerald-600 font-heading">
                            {formatCurrency(day.captainEarning)}
                          </div>
                          <div className="text-[10px] text-slate-400">Total Fare: {formatCurrency(day.totalFare)}</div>
                        </div>
                        <span className="text-xs text-slate-400 font-bold">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Detailed Completed Rides for {day.formattedDate}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 uppercase font-black text-[10px]">
                                <th className="pb-2.5 px-3">Ride ID</th>
                                <th className="pb-2.5 px-3">Captain</th>
                                <th className="pb-2.5 px-3">Customer</th>
                                <th className="pb-2.5 px-3">Route</th>
                                <th className="pb-2.5 px-3 text-right">Fare</th>
                                <th className="pb-2.5 px-3 text-right">Captain Earning</th>
                                <th className="pb-2.5 px-3 text-right">Commission</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {day.rides.map((ride) => (
                                <tr key={ride.id} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">#{ride.orderNumber}</td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900">{ride.riderName}</td>
                                  <td className="py-2.5 px-3">{ride.customerName}</td>
                                  <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs truncate">
                                    <div className="truncate">From: {ride.pickupAddress}</div>
                                    <div className="truncate">To: {ride.dropAddress}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(ride.fare)}</td>
                                  <td className="py-2.5 px-3 text-right font-black text-emerald-600">{formatCurrency(ride.captainEarning)}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-rose-600">{formatCurrency(ride.platformCommission)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    ) : adminTab === 'settings' ? (
      /* ========================================================
          ADMIN TAB: "Cloud Sync Settings" (Supabase Connection)
      ======================================================== */
      <div className="max-w-4xl mx-auto px-4 py-2 space-y-6">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black font-heading text-slate-900">Supabase Cloud Database & Sync</h2>
                <p className="text-xs text-slate-500 mt-0.5">Manage live database credentials, remove current database, or connect a fresh Supabase project.</p>
              </div>
            </div>

          {/* Current status pill */}
            <div>
              {isAppwriteConfigured ? (
                <span className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Appwrite Connected</span>
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Local Storage Mode</span>
                </span>
              )}
            </div>
          </div>

          {/* Database Status Card with Remove Database Option */}
          <div className={`p-4 sm:p-5 rounded-2xl border text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isAppwriteConfigured ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-amber-50/70 border-amber-200 text-amber-950'}`}>
            <div className="flex items-start gap-3">
              {isAppwriteConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-extrabold text-sm uppercase tracking-wide">
                  {isAppwriteConfigured ? 'Live Appwrite Sync Active' : 'Local Storage Only (Appwrite Disconnected)'}
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {isAppwriteConfigured
                    ? 'Orders, KYC files, recharge approvals, and rider chats are syncing instantly across all connected devices via Appwrite.'
                    : 'No external Appwrite backend is connected. All orders and profiles reside in your local browser cache.'}
                </p>
              </div>
            </div>

            {/* Remove / Disconnect Button */}
            {isAppwriteConfigured && (
              <button
                type="button"
                onClick={handleRemoveAppwriteDatabase}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs self-start sm:self-auto hover:scale-102"
                title="Disconnect and remove current Appwrite credentials"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Remove Appwrite Credentials</span>
              </button>
            )}
          </div>

          {/* Form to enter or update Appwrite credentials */}
          <form onSubmit={handleSaveAppwriteSettings} className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Key className="w-4 h-4 text-pink-600" />
                <span>Enter Appwrite Credentials</span>
              </h3>
              <a
                href="https://cloud.appwrite.io/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-pink-600 hover:text-pink-800 flex items-center gap-1 hover:underline"
              >
                <span>Appwrite Cloud</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Endpoint */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Appwrite Endpoint <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={customEndpointInput}
                  onChange={e => setCustomEndpointInput(e.target.value)}
                  placeholder="https://cloud.appwrite.io/v1"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Project ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Appwrite Project ID <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={customProjectIdInput}
                  onChange={e => setCustomProjectIdInput(e.target.value)}
                  placeholder="e.g. 64aef290b00123456789"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Error Message */}
            {appwriteErrorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{appwriteErrorMessage}</span>
              </div>
            )}

            {/* Test Result Feedback */}
            {appwriteTestResult && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                  appwriteTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {appwriteTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-extrabold text-sm">
                    {appwriteTestResult.success ? 'Connection Verified' : 'Connection Failed'}
                  </div>
                  <p className="mt-0.5 text-slate-700">{appwriteTestResult.message}</p>
                </div>
              </div>
            )}

            {/* Save Success Alert */}
            {appwriteSaveSuccess && (
              <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Appwrite credentials saved successfully! Reloading to activate backend sync...</span>
              </div>
            )}

            {/* Button Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Zap className="w-4 h-4" />
                <span>Save & Connect Appwrite</span>
              </button>

              <button
                type="button"
                onClick={handleTestAppwriteSettings}
                disabled={isTestingAppwrite}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTestingAppwrite ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-pink-600" />
                ) : (
                  <Zap className="w-4 h-4 text-pink-600" />
                )}
                <span>{isTestingAppwrite ? 'Testing Connection...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomEndpointInput('https://cloud.appwrite.io/v1');
                  setCustomProjectIdInput('');
                  setAppwriteTestResult(null);
                  setAppwriteErrorMessage(null);
                }}
                className="px-4 py-3 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors ml-auto cursor-pointer"
              >
                Clear Inputs
              </button>
            </div>
          </form>

          {/* Setup Guide Section */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-pink-600" />
                <span>Appwrite Setup Guide & Collections</span>
              </span>
              <button
                type="button"
                onClick={handleCopyAppwriteGuide}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copiedAppwriteGuide ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAppwriteGuide ? 'Copied Guide!' : 'Copy Instructions'}</span>
              </button>
            </div>
            <div className="p-4 bg-slate-900 rounded-2xl text-slate-200 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-60 border border-slate-800 shadow-inner">
              {APPWRITE_SETUP_GUIDE}
            </div>
          </div>

        </div>
      </div>
    ) : adminTab === 'support-chat' ? (
      /* ========================================================
          ADMIN TAB: "QuickDrop support" (Admin Chat with Riders)
      ======================================================== */
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black font-heading text-slate-900">QuickDrop support Control Room</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chat with delivery partners, answer support queries, and review recharge proof screenshots.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
          {/* Riders list sidebar */}
          <div className="border-r border-slate-200 p-4 space-y-2 bg-slate-50/50">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Delivery Partners</h3>
            {riders.map(r => {
              const unreadCount = supportChatMessages.filter(m => m.riderId === r.id && m.sender === 'rider').length;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedSupportRiderId(r.id)}
                  className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-colors ${selectedSupportRiderId === r.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80'}`}
                >
                  <div className="flex items-center gap-3">
                    <img src={r.photo} alt={r.name} className="w-10 h-10 rounded-xl object-cover" />
                    <div>
                      <h4 className="text-xs font-bold truncate">{r.name}</h4>
                      <p className={`text-[10px] ${selectedSupportRiderId === r.id ? 'text-indigo-200' : 'text-slate-500'}`}>{r.phone}</p>
                    </div>
                  </div>
                  {unreadCount > 0 && selectedSupportRiderId !== r.id && (
                    <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chat main area */}
          <div className="md:col-span-2 flex flex-col justify-between p-6">
            {(() => {
              const targetRider = riders.find(r => r.id === selectedSupportRiderId) || riders[0];
              if (!targetRider) {
                return <div className="text-center text-slate-400 py-20">Select a rider to start support chat.</div>;
              }
              const riderMessages = supportChatMessages.filter(m => m.riderId === targetRider.id);

              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <img src={targetRider.photo} alt={targetRider.name} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{targetRider.name}</h4>
                        <p className="text-xs text-slate-500">Wallet: {formatCurrency(targetRider.walletBalance || 0)} • {targetRider.vehicle}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/85 max-h-[360px]">
                    {riderMessages.length === 0 ? (
                      <div className="text-center text-slate-400 py-16 text-xs">
                        No messages in support chat with {targetRider.name}.
                      </div>
                    ) : (
                      riderMessages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-2xl shadow-xs ${msg.sender === 'admin' ? 'bg-indigo-600 text-white rounded-br-xs' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'}`}>
                            <p className="text-xs leading-relaxed">{msg.text}</p>
                            {msg.screenshotUrl && (
                              <div className="mt-2 rounded-xl overflow-hidden border border-white/30 max-h-40 bg-black/10">
                                <img src={msg.screenshotUrl} alt="Recharge Proof" className="w-full h-full object-cover" />
                              </div>
                            )}
                            {msg.amount && (
                              <span className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-black rounded ${msg.sender === 'admin' ? 'bg-indigo-700 text-indigo-100' : 'bg-emerald-100 text-emerald-800'}`}>
                                Recharge Amount: ₹{msg.amount}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.time}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!adminChatInput.trim()) return;
                    if (onSendSupportMessage) {
                      onSendSupportMessage({
                        riderId: targetRider.id,
                        sender: 'admin',
                        text: adminChatInput,
                      });
                    }
                    setAdminChatInput('');
                  }} className="mt-4 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Reply to ${targetRider.name} via QuickDrop support...`}
                      value={adminChatInput}
                      onChange={(e) => setAdminChatInput(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Reply</span>
                    </button>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    ) : null}
        </>

    {/* Admin Block / Terminate Reason Modal */}
    {blockingTarget && (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900 font-heading">
              Block or Terminate Account for Misbehavior
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              You are about to block or terminate account for <b className="text-slate-900">{blockingTarget.name}</b> due to misbehavior or policy violation.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
              Reason for Blocking / Termination
            </label>
            <textarea
              rows={3}
              value={blockReasonInput}
              onChange={(e) => setBlockReasonInput(e.target.value)}
              placeholder="e.g. Inappropriate behavior during ride, fraudulent booking, harassment..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setBlockingTarget(null);
                setBlockReasonInput('');
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (blockingTarget.type === 'customer' && onToggleBlockCustomer) {
                  onToggleBlockCustomer(blockingTarget.id, true, blockReasonInput.trim() || 'Misbehavior / Policy Violation');
                } else if (blockingTarget.type === 'rider' && onToggleBlockRider) {
                  onToggleBlockRider(blockingTarget.id, true, blockReasonInput.trim() || 'Misbehavior / Policy Violation');
                }
                setBlockingTarget(null);
                setBlockReasonInput('');
              }}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Confirm Block / Terminate</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Admin Reject / Resubmission Reason Modal */}
    {rejectingRiderId && (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900 font-heading">
              Reject / Request Document Resubmission
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Please specify feedback or reason for rejecting the partner's KYC documents so they can re-upload clear photos.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
              Admin Feedback / Remark
            </label>
            <textarea
              rows={3}
              value={rejectRemarkInput}
              onChange={(e) => setRejectRemarkInput(e.target.value)}
              placeholder="e.g. Driving Licence image is blurry. Please upload a clear photo of your licence."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setRejectingRiderId(null);
                setRejectRemarkInput('');
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (onUpdateRiderKyc && rejectingRiderId) {
                  onUpdateRiderKyc(
                    rejectingRiderId,
                    'rejected',
                    rejectRemarkInput.trim() || 'Document photos are unreadable. Please upload clearer images.'
                  );
                }
                setRejectingRiderId(null);
                setRejectRemarkInput('');
              }}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>Submit Rejection</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Admin Full Document Image Zoom Modal */}
    {selectedZoomDoc && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm">{selectedZoomDoc.title}</h3>
                <span className="text-[10px] text-slate-400 block">Partner: {selectedZoomDoc.riderName}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedZoomDoc(null)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 bg-slate-100 flex items-center justify-center max-h-[75vh] overflow-auto">
            <img
              src={selectedZoomDoc.url}
              alt={selectedZoomDoc.title}
              className="max-w-full max-h-[65vh] object-contain rounded-2xl shadow-lg border border-slate-200 bg-white"
            />
          </div>
          <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">
              Official KYC Document Photo submitted by delivery partner
            </span>
            <button
              type="button"
              onClick={() => setSelectedZoomDoc(null)}
              className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
            >
              Close Zoom View
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
);
};
