import React, { useState, useEffect } from 'react';
import { Role, Order, UserProfile, RiderProfile, WalletRechargeRequest, SupportChatMessage } from './types';
import { INITIAL_USER, INITIAL_RIDERS, INITIAL_ORDERS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { CustomerApp } from './components/CustomerApp';
import { RiderApp } from './components/RiderApp';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { AppwriteConfigModal } from './components/AppwriteConfigModal';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { isAppwriteConfigured, syncOrderToAppwrite } from './lib/appwrite';
import { initSyncEngine, broadcastSyncEvent, playNewOrderChime } from './lib/syncEngine';

export default function App() {
  const { user: authUser } = useAuth();

  // Parse role and login modal state from URL path/query/hash
  const getInitialRouteState = () => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    let role: Role = 'customer';
    if (path.includes('/rider') || search.includes('role=rider') || hash.includes('rider')) {
      role = 'rider';
    } else if (path.includes('/admin') || search.includes('role=admin') || hash.includes('admin')) {
      role = 'admin';
    } else {
      role = 'customer';
    }

    const openLogin = false;

    const mode: 'login' = 'login';

    return { role, openLogin, mode };
  };

  const initialRoute = getInitialRouteState();
  const [currentRole, setCurrentRole] = useState<Role>(initialRoute.role);
  const [authRole, setAuthRole] = useState<Role>(initialRoute.role);
  const [authMode, setAuthMode] = useState<'login'>(initialRoute.mode);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(initialRoute.openLogin);
  const [isAppwriteModalOpen, setIsAppwriteModalOpen] = useState(false);

  // Helper to handle navigation and sync browser URL
  const handleNavigateTo = (
    path: string,
    role: Role,
    openLogin = false,
    mode: 'login' = 'login'
  ) => {
    setCurrentRole(role);
    setAuthRole(role);
    setAuthMode(mode);

    if (openLogin) {
      setIsAuthModalOpen(true);
    } else {
      setIsAuthModalOpen(false);
    }

    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', path);
    }
  };

  // Sync role changes to address bar
  const handleRoleChange = (role: Role) => {
    handleNavigateTo(`/${role}`, role, false);
  };



  // Listen for back/forward browser button navigation
  useEffect(() => {
    const handlePopState = () => {
      const state = getInitialRouteState();
      setCurrentRole(state.role);
      setAuthRole(state.role);
      setAuthMode(state.mode);
      setIsAuthModalOpen(state.openLogin);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Active User Profile
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('qd_user_v5');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  // Customers Signups List (New & Old)
  const [customers, setCustomers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('qd_customers_v1');
    return saved ? JSON.parse(saved) : [
      {
        id: 'cust_1',
        name: 'Aarav Sharma',
        phone: '+91 98765 43210',
        email: 'aarav.sharma@gmail.com',
        photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        savedAddresses: [],
        createdAt: '2026-06-10', // Old signup
        isBlocked: false,
      },
      {
        id: 'cust_2',
        name: 'Priya Verma',
        phone: '+91 91234 56789',
        email: 'priya.verma@yahoo.com',
        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
        savedAddresses: [],
        createdAt: '2026-08-02', // New signup
        isBlocked: false,
      },
      {
        id: 'cust_3',
        name: 'Rahul Mehta',
        phone: '+91 99887 76655',
        email: 'rahul.mehta@outlook.com',
        photo: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
        savedAddresses: [],
        createdAt: '2026-08-04', // New signup
        isBlocked: false,
      }
    ];
  });

  // Riders
  const [riders, setRiders] = useState<RiderProfile[]>(() => {
    const saved = localStorage.getItem('qd_riders_v5');
    return saved ? JSON.parse(saved) : INITIAL_RIDERS;
  });

  // Global Orders list across feeds
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('qd_orders_v5');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  // Helper to sync order to Appwrite cloud
  const syncOrderToCloud = async (order: Order) => {
    if (!isAppwriteConfigured) return;
    try {
      await syncOrderToAppwrite(order);
    } catch (e) {
      console.warn('Failed to sync order to Appwrite:', e);
    }
  };

  // Global Real-Time Multi-Device Sync Engine (works seamlessly across separate mobile phones and browsers)
  useEffect(() => {
    const unsubscribe = initSyncEngine({
      onOrderCreated: (newOrder) => {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === newOrder.id);
          if (exists) {
            return prev.map((o) => (o.id === newOrder.id ? { ...o, ...newOrder } : o));
          }
          return [newOrder, ...prev];
        });
      },
      onOrderUpdated: (updatedOrder) => {
        if (!updatedOrder) return;
        if (updatedOrder.status === 'running') {
          // Immediately switch customer view to running tab and chime
          setCustomerFeedTab('running');
          try {
            playNewOrderChime();
          } catch (e) {}
        }
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === updatedOrder.id);
          if (exists) {
            return prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
          }
          return [updatedOrder, ...prev];
        });
      },
      onOrderDeleted: (orderId) => {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      },
      onOrdersBulkSync: (syncedOrders) => {
        if (!syncedOrders || !Array.isArray(syncedOrders)) return;
        const hasRunningOrder = syncedOrders.some((s) => s && s.status === 'running');
        if (hasRunningOrder) {
          setCustomerFeedTab('running');
        }
        setOrders((prev) => {
          const map = new Map<string, Order>();
          syncedOrders.forEach((o) => {
            if (o && o.id) map.set(o.id, o);
          });
          prev.forEach((o) => {
            if (o && o.id && !map.has(o.id)) map.set(o.id, o);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
        });
      },
      onRiderStatusUpdated: (riderId, isOnline) => {
        setRiders((prev) =>
          prev.map((r) => (r.id === riderId ? { ...r, isOnline } : r))
        );
      },
      onRiderLocationUpdated: (riderId, lat, lng) => {
        setRiders((prev) =>
          prev.map((r) => (r.id === riderId ? { ...r, currentLat: lat, currentLng: lng } : r))
        );
      },
      onRiderKycUpdated: (riderId, status, remarks) => {
        setRiders((prev) =>
          prev.map((r) => (r.id === riderId ? { ...r, kycStatus: status, kycRemarks: remarks || r.kycRemarks } : r))
        );
      },
      onWalletRechargeRequest: (req) => {
        setWalletRechargeRequests((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [req, ...prev];
        });
      },
      onWalletRechargeStatus: (requestId, status, amount, riderId) => {
        setWalletRechargeRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status } : r))
        );
        if (status === 'approved' && amount && riderId) {
          setRiders((prev) =>
            prev.map((r) =>
              r.id === riderId ? { ...r, walletBalance: (r.walletBalance || 0) + amount } : r
            )
          );
        }
      },
      onSupportMessage: (msg) => {
        setSupportChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Appwrite initial database hydration check
  useEffect(() => {
    if (!isAppwriteConfigured) return;
  }, []);

  // Cross-browser & cross-tab orders synchronization via localStorage event and polling
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'qd_orders_v5' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const hasRunning = parsed.some((o: Order) => o.status === 'running');
            if (hasRunning) {
              setCustomerFeedTab('running');
            }
            setOrders(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Platform Recharge QR code managed by admin
  const [platformQrImage, setPlatformQrImage] = useState<string>(() => {
    return localStorage.getItem('qd_platform_qr_v1') || '';
  });

  const [walletRechargeRequests, setWalletRechargeRequests] = useState<WalletRechargeRequest[]>(() => {
    const saved = localStorage.getItem('qd_wallet_recharge_requests_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [supportChatMessages, setSupportChatMessages] = useState<SupportChatMessage[]>(() => {
    const saved = localStorage.getItem('qd_support_chat_v1');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('qd_platform_qr_v1', platformQrImage);
  }, [platformQrImage]);

  useEffect(() => {
    localStorage.setItem('qd_wallet_recharge_requests_v1', JSON.stringify(walletRechargeRequests));
  }, [walletRechargeRequests]);

  useEffect(() => {
    localStorage.setItem('qd_support_chat_v1', JSON.stringify(supportChatMessages));
  }, [supportChatMessages]);

  const handleCreateRechargeRequest = (req: { riderId: string; riderName: string; riderPhone: string; amount: number; screenshotUrl: string }) => {
    const newReq: WalletRechargeRequest = {
      id: 'req_' + Date.now(),
      riderId: req.riderId,
      riderName: req.riderName,
      riderPhone: req.riderPhone,
      amount: req.amount,
      screenshotUrl: req.screenshotUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setWalletRechargeRequests(prev => [newReq, ...prev]);
    broadcastSyncEvent({ type: 'WALLET_RECHARGE_REQUEST', rechargeRequest: newReq });

    const chatMsg: SupportChatMessage = {
      id: 'msg_' + Date.now(),
      riderId: req.riderId,
      sender: 'rider',
      text: `Wallet recharge request of ₹${req.amount} submitted via QR scan.`,
      screenshotUrl: req.screenshotUrl,
      amount: req.amount,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSupportChatMessages(prev => [...prev, chatMsg]);
    broadcastSyncEvent({ type: 'SUPPORT_MESSAGE', supportMessage: chatMsg });
  };

  const handleApproveRechargeRequest = (requestId: string, amount: number, riderId: string) => {
    setWalletRechargeRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'approved' } : r));
    setRiders(prev => prev.map(r => r.id === riderId ? { ...r, walletBalance: (r.walletBalance || 0) + amount } : r));
    broadcastSyncEvent({ type: 'WALLET_RECHARGE_STATUS', requestId, rechargeStatus: 'approved', rechargeAmount: amount, riderId });

    const chatMsg: SupportChatMessage = {
      id: 'msg_' + Date.now(),
      riderId: riderId,
      sender: 'admin',
      text: `Your wallet recharge of ₹${amount} has been approved and credited successfully!`,
      amount: amount,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSupportChatMessages(prev => [...prev, chatMsg]);
    broadcastSyncEvent({ type: 'SUPPORT_MESSAGE', supportMessage: chatMsg });
  };

  const handleRejectRechargeRequest = (requestId: string, riderId: string) => {
    setWalletRechargeRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
    broadcastSyncEvent({ type: 'WALLET_RECHARGE_STATUS', requestId, rechargeStatus: 'rejected', riderId });
    const chatMsg: SupportChatMessage = {
      id: 'msg_' + Date.now(),
      riderId: riderId,
      sender: 'admin',
      text: `Your wallet recharge request was rejected or payment screenshot was invalid. Please re-upload valid screenshot.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSupportChatMessages(prev => [...prev, chatMsg]);
    broadcastSyncEvent({ type: 'SUPPORT_MESSAGE', supportMessage: chatMsg });
  };

  const handleSendSupportMessage = (msg: { riderId: string; sender: 'rider' | 'admin'; text: string; screenshotUrl?: string; amount?: number }) => {
    const newMsg: SupportChatMessage = {
      id: 'msg_' + Date.now(),
      riderId: msg.riderId,
      sender: msg.sender,
      text: msg.text,
      screenshotUrl: msg.screenshotUrl,
      amount: msg.amount,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSupportChatMessages(prev => [...prev, newMsg]);
    broadcastSyncEvent({ type: 'SUPPORT_MESSAGE', supportMessage: newMsg });
  };

  // Active Feed tab for Customer view
  const [customerFeedTab, setCustomerFeedTab] = useState<'book' | 'pending' | 'running' | 'finished' | 'profile'>('book');

  // Persist State
  useEffect(() => {
    localStorage.setItem('qd_user_v5', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('qd_customers_v1', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (currentUser && currentUser.name) {
      setCustomers(prev => {
        const exists = prev.some(c => c.id === currentUser.id || c.email === currentUser.email);
        if (!exists) {
          return [{ ...currentUser, createdAt: '2026-08-04', isBlocked: false }, ...prev];
        }
        return prev.map(c => c.id === currentUser.id ? { ...c, name: currentUser.name, phone: currentUser.phone, email: currentUser.email, photo: currentUser.photo } : c);
      });
    }
  }, [currentUser]);

  const handleToggleBlockCustomer = (customerId: string, block: boolean, reason?: string) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, isBlocked: block, blockReason: reason || (block ? 'Misbehavior / Policy Violation' : undefined) } : c));
  };

  const handleToggleBlockRider = (riderId: string, block: boolean, reason?: string) => {
    setRiders(prev => prev.map(r => r.id === riderId ? { ...r, isBlocked: block, blockReason: reason || (block ? 'Misbehavior / Policy Violation' : undefined) } : r));
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers(prev => prev.filter(c => c.id !== customerId));
  };

  const handleDeleteRider = (riderId: string) => {
    setRiders(prev => prev.filter(r => r.id !== riderId));
  };

  useEffect(() => {
    localStorage.setItem('qd_riders_v5', JSON.stringify(riders));
    if (isAppwriteConfigured) {
      // Appwrite backend sync active
    }
  }, [riders]);

  // Sync authUser if logged in as rider into riders list and Supabase rider_profiles table
  useEffect(() => {
    if (authUser && authUser.role === 'rider') {
      setRiders((prev) => {
        const existingIndex = prev.findIndex(r => r.id === authUser.id || r.email === authUser.email);
        if (existingIndex >= 0) {
          const updated = [...prev];
          // Do NOT overwrite rider's custom name or uploaded photo with authUser defaults
          updated[existingIndex] = {
            ...updated[existingIndex],
            email: authUser.email || updated[existingIndex].email,
            phone: authUser.phone || updated[existingIndex].phone,
          };
          return updated;
        } else {
          const newRider: RiderProfile = {
            id: authUser.id,
            name: authUser.full_name && authUser.full_name !== 'User' ? authUser.full_name : 'Rider Partner',
            phone: authUser.phone || '',
            email: authUser.email || '',
            photo: authUser.avatar_url && !authUser.avatar_url.includes('default') ? authUser.avatar_url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
            rating: 5.0,
            vehicle: 'Honda Activa EV',
            plateNumber: 'PB65-EV-9911',
            kycStatus: 'approved',
            walletBalance: 250,
            currentLat: 30.7333,
            currentLng: 76.7794,
            isOnline: true,
            totalDeliveries: 0,
            todayEarnings: 0,
          };
          return [newRider, ...prev];
        }
      });
    }
  }, [authUser]);

  useEffect(() => {
    localStorage.setItem('qd_orders_v5', JSON.stringify(orders));
  }, [orders]);

  // Create Order Handler
  const handleCreateOrder = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    syncOrderToCloud(newOrder);
    broadcastSyncEvent({ type: 'ORDER_CREATED', order: newOrder });
  };

  // Accept Order Handler (Rider or Customer/Admin accepts a pending request)
  const handleAcceptOrder = (orderId: string, rider?: RiderProfile) => {
    const assignedRider = rider || riders[0];
    if (rider && rider.kycStatus !== 'approved') {
      alert('Verification Required: Only verified delivery partners with approved KYC documents can accept pending requests.');
      return;
    }
    // Automatically trigger Customer feed to switch to Running tab immediately
    setCustomerFeedTab('running');
    try {
      playNewOrderChime();
    } catch (e) {}

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const updated = {
            ...ord,
            status: 'running' as const,
            riderId: assignedRider.id,
            riderName: assignedRider.name,
            riderPhone: assignedRider.phone,
            riderPhoto: assignedRider.photo,
            riderVehicle: `${assignedRider.vehicle} (${assignedRider.plateNumber})`,
            trackingStep: 'accepted' as const,
            acceptedAt: new Date().toISOString(),
          };
          syncOrderToCloud(updated);
          broadcastSyncEvent({ type: 'ORDER_UPDATED', order: updated });
          return updated;
        }
        return ord;
      })
    );
  };

  // Decline Order Handler (Declines / cancels pending request)
  const handleDeclineOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const updated = { ...ord, status: 'cancelled' as const };
          syncOrderToCloud(updated);
          broadcastSyncEvent({ type: 'ORDER_UPDATED', order: updated });
          return updated;
        }
        return ord;
      })
    );
  };

  // Rider Updates Order Tracking Step or Delivery Completion
  const handleUpdateOrderStatus = (orderId: string, trackingStep: any, isFinished = false) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const isDone = isFinished || trackingStep === 'delivered';
          const updated = {
            ...ord,
            status: isDone ? ('finished' as const) : ('running' as const),
            trackingStep: trackingStep,
            deliveredAt: isDone ? new Date().toISOString() : ord.deliveredAt,
            paymentStatus: isDone ? ('completed' as const) : ord.paymentStatus,
          };
          syncOrderToCloud(updated);
          broadcastSyncEvent({ type: 'ORDER_UPDATED', order: updated });
          return updated;
        }
        return ord;
      })
    );

    // Update Rider Earnings & 10% wallet deduction if finished
    if (isFinished || trackingStep === 'delivered') {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (targetOrder && targetOrder.riderId) {
        const commissionDeduction = targetOrder.fare * 0.10;
        setRiders((prevRiders) =>
          prevRiders.map((r) =>
            r.id === targetOrder.riderId
              ? {
                  ...r,
                  todayEarnings: r.todayEarnings + targetOrder.fare,
                  totalDeliveries: r.totalDeliveries + 1,
                  walletBalance: Math.max(0, (r.walletBalance || 0) - commissionDeduction),
                }
              : r
          )
        );
      }
    }
  };

  // Admin Manual Assign Rider
  const handleAdminAssignRider = (orderId: string, riderId: string) => {
    const selectedRider = riders.find((r) => r.id === riderId) || riders[0];
    handleAcceptOrder(orderId, selectedRider);
  };

  // Admin Cancel Order
  const handleAdminCancelOrder = (orderId: string) => {
    handleDeclineOrder(orderId);
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders((prev) => prev.map((ord) => ord.id === updatedOrder.id ? updatedOrder : ord));
    syncOrderToCloud(updatedOrder);
    broadcastSyncEvent({ type: 'ORDER_UPDATED', order: updatedOrder });
  };

  // Admin Jump to Customer Feed Tab
  const handleOpenCustomerFeedWithTab = (tab: 'pending' | 'running' | 'finished') => {
    setCurrentRole('customer');
    setCustomerFeedTab(tab);
  };

  // Update Rider KYC Verification Status and Documents
  const handleUpdateRiderKyc = (
    riderId: string,
    status: 'approved' | 'pending' | 'rejected',
    remarks?: string,
    updatedDocs?: {
      drivingLicence?: string;
      drivingLicenceImg?: string;
      rcNumber?: string;
      rcImg?: string;
      aadhaarCard?: string;
      aadhaarImg?: string;
      panCard?: string;
      panImg?: string;
    }
  ) => {
    setRiders((prev) =>
      prev.map((r) => {
        if (r.id === riderId) {
          return {
            ...r,
            kycStatus: status,
            kycRemarks: remarks !== undefined ? remarks : r.kycRemarks,
            ...(updatedDocs || {}),
          };
        }
        return r;
      })
    );
    broadcastSyncEvent({ type: 'RIDER_KYC_UPDATED', riderId, kycStatus: status, kycRemarks: remarks });
  };

  // Logout Handlers
  const handleLogoutCustomer = () => {
    localStorage.removeItem('qd_user_v5');
    setCurrentUser(INITIAL_USER);
    handleNavigateTo('/customer', 'customer', false);
  };

  const handleDeleteCustomerAccount = () => {
    localStorage.removeItem('qd_user_v5');
    setCurrentUser({
      id: `usr_${Date.now()}`,
      name: '',
      phone: '',
      email: '',
      photo: '',
      savedAddresses: [],
    });
    handleNavigateTo('/customer', 'customer', false);
  };

  const handleToggleRiderOnline = (riderId: string, status?: boolean) => {
    setRiders((prev) => {
      const nextRiders = prev.map((r) =>
        r.id === riderId ? { ...r, isOnline: status !== undefined ? status : !r.isOnline } : r
      );
      const target = nextRiders.find((r) => r.id === riderId);
      if (target) {
        broadcastSyncEvent({ type: 'RIDER_STATUS_UPDATED', riderId, isOnline: target.isOnline });
      }
      return nextRiders;
    });
  };

  const handleUpdateCustomerPhoto = (photoUrl: string) => {
    setCurrentUser((prev) => ({
      ...prev,
      photo: photoUrl,
    }));
  };

  const handleUpdateRiderPhoto = (riderId: string, photoUrl: string) => {
    setRiders((prev) =>
      prev.map((r) => {
        if (r.id === riderId) {
          return { ...r, photo: photoUrl };
        }
        return r;
      })
    );
    setOrders((prev) =>
      prev.map((ord) => (ord.riderId === riderId ? { ...ord, riderPhoto: photoUrl } : ord))
    );
  };

  const handleUpdateRiderProfile = (riderId: string, updatedFields: Partial<RiderProfile>) => {
    setRiders((prev) =>
      prev.map((r) => {
        if (r.id === riderId) {
          return {
            ...r,
            ...updatedFields,
          };
        }
        return r;
      })
    );
    // Also update any orders assigned to this rider with new rider details
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.riderId === riderId) {
          return {
            ...ord,
            ...(updatedFields.name ? { riderName: updatedFields.name } : {}),
            ...(updatedFields.phone ? { riderPhone: updatedFields.phone } : {}),
            ...(updatedFields.vehicle ? { riderVehicle: updatedFields.vehicle } : {}),
            ...(updatedFields.photo ? { riderPhoto: updatedFields.photo } : {}),
          };
        }
        return ord;
      })
    );
  };

  const handleLogoutRider = () => {
    setRiders((prev) =>
      prev.map((r, i) => (i === 0 ? { ...r, isOnline: false } : r))
    );
    handleNavigateTo('/rider', 'rider', false);
  };

  const handleDeleteRiderAccount = () => {
    localStorage.removeItem('qd_riders_v5');
    setRiders(INITIAL_RIDERS);
    handleNavigateTo('/rider', 'rider', false);
  };

  const currentRider = ((authUser && authUser.role === 'rider')
    ? riders.find(r => r.id === authUser.id || r.email === authUser.email)
    : null) || riders[0] || INITIAL_RIDERS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Navbar with Role Switcher & Phone Auth Status */}
      <Navbar
        currentRole={currentRole}
        onChangeRole={handleRoleChange}
        currentUser={currentUser}
        rider={currentRider}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAppwriteModal={() => setIsAppwriteModalOpen(true)}
      />

      {/* Main View Area with Protected Routes for Each Role */}
      <main className="flex-1">
        {currentRole === 'customer' && (
          <ProtectedRoute allowedRole="customer" onRedirectRole={handleRoleChange}>
            <CustomerApp
              currentUser={currentUser}
              orders={orders}
              onCreateOrder={handleCreateOrder}
              activeFeedTab={customerFeedTab}
              setActiveFeedTab={setCustomerFeedTab}
              onAcceptOrder={(id) => handleAcceptOrder(id)}
              onDeclineOrder={handleDeclineOrder}
              onUpdatePhoto={handleUpdateCustomerPhoto}
              onUpdateProfile={(updatedUser) => setCurrentUser(updatedUser)}
              onUpdateOrder={handleUpdateOrder}
            />
          </ProtectedRoute>
        )}

        {currentRole === 'rider' && (
          <ProtectedRoute allowedRole="rider" onRedirectRole={handleRoleChange}>
            <RiderApp
              rider={currentRider}
              orders={orders}
              platformQrImage={platformQrImage}
              supportChatMessages={supportChatMessages}
              walletRechargeRequests={walletRechargeRequests}
              onAcceptOrder={(id, r) => handleAcceptOrder(id, r)}
              onDeclineOrder={handleDeclineOrder}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateRiderKyc={handleUpdateRiderKyc}
              onToggleOnline={(status) => handleToggleRiderOnline(currentRider?.id || 'rdr_1', status)}
              onUpdatePhoto={(photo) => handleUpdateRiderPhoto(currentRider?.id || 'rdr_1', photo)}
              onUpdateRiderProfile={(fields) => handleUpdateRiderProfile(currentRider?.id || 'rdr_1', fields)}
              onUpdateOrder={handleUpdateOrder}
              onSendSupportMessage={handleSendSupportMessage}
              onCreateRechargeRequest={handleCreateRechargeRequest}
            />
          </ProtectedRoute>
        )}

        {currentRole === 'admin' && (
          <ProtectedRoute allowedRole="admin" onRedirectRole={handleRoleChange}>
            <AdminDashboard
              orders={orders}
              riders={riders}
              customers={customers}
              platformQrImage={platformQrImage}
              supportChatMessages={supportChatMessages}
              walletRechargeRequests={walletRechargeRequests}
              onUpdatePlatformQrImage={setPlatformQrImage}
              onAssignRider={handleAdminAssignRider}
              onCancelOrder={handleAdminCancelOrder}
              onAcceptOrder={(id) => handleAcceptOrder(id)}
              onOpenCustomerFeedWithTab={handleOpenCustomerFeedWithTab}
              onUpdateRiderKyc={handleUpdateRiderKyc}
              onToggleBlockCustomer={handleToggleBlockCustomer}
              onToggleBlockRider={handleToggleBlockRider}
              onDeleteCustomer={handleDeleteCustomer}
              onDeleteRider={handleDeleteRider}
              onApproveRechargeRequest={handleApproveRechargeRequest}
              onRejectRechargeRequest={handleRejectRechargeRequest}
              onSendSupportMessage={handleSendSupportMessage}
            />
          </ProtectedRoute>
        )}
      </main>

      {/* Supabase Email Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          if (window.history && window.history.pushState) {
            window.history.pushState({}, '', `/${currentRole}`);
          }
        }}
        initialRole={authRole}
        onRoleSelect={(role) => handleRoleChange(role)}
        onLoginSuccess={(targetRole) => {
          setIsAuthModalOpen(false);
          const roleToNavigate = targetRole || authUser?.role || currentRole;
          handleNavigateTo(`/${roleToNavigate}`, roleToNavigate, false);
        }}
      />

      {/* Appwrite Backend Credential & Sync Manager Modal */}
      <AppwriteConfigModal
        isOpen={isAppwriteModalOpen}
        onClose={() => setIsAppwriteModalOpen(false)}
      />
    </div>
  );
}
