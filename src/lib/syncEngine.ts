import { Order, RiderProfile, SupportChatMessage, WalletRechargeRequest } from '../types';
import {
  client,
  databases,
  isAppwriteConfigured,
  syncOrderToAppwrite,
  deleteOrderFromAppwrite,
} from './appwrite';

const SYNC_TOPIC = 'quickdrop_orders_sync_v5';
const NTFY_SYNC_URL = `https://ntfy.sh/${SYNC_TOPIC}`;
const DEVICE_ID = `dev_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

export type SyncEventType =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_DELETED'
  | 'RIDER_STATUS_UPDATED'
  | 'RIDER_LOCATION_UPDATED'
  | 'RIDER_KYC_UPDATED'
  | 'WALLET_RECHARGE_REQUEST'
  | 'WALLET_RECHARGE_STATUS'
  | 'SUPPORT_MESSAGE'
  | 'INITIAL_SYNC';

export interface SyncEvent {
  type: SyncEventType;
  senderDeviceId: string;
  timestamp: string;
  order?: Order;
  orderId?: string;
  orders?: Order[];
  riderId?: string;
  rider?: RiderProfile;
  lat?: number;
  lng?: number;
  heading?: number;
  speed?: number;
  isOnline?: boolean;
  kycStatus?: 'approved' | 'pending' | 'rejected';
  kycRemarks?: string;
  rechargeRequest?: WalletRechargeRequest;
  requestId?: string;
  rechargeStatus?: 'approved' | 'rejected';
  rechargeAmount?: number;
  supportMessage?: SupportChatMessage;
}

export interface SyncCallbacks {
  onOrderCreated?: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
  onOrderDeleted?: (orderId: string) => void;
  onOrdersBulkSync?: (orders: Order[]) => void;
  onRiderStatusUpdated?: (riderId: string, isOnline: boolean) => void;
  onRiderLocationUpdated?: (riderId: string, lat: number, lng: number, heading?: number, speed?: number, orderId?: string) => void;
  onRiderKycUpdated?: (riderId: string, status: 'approved' | 'pending' | 'rejected', remarks?: string) => void;
  onWalletRechargeRequest?: (req: WalletRechargeRequest) => void;
  onWalletRechargeStatus?: (requestId: string, status: 'approved' | 'rejected', amount?: number, riderId?: string) => void;
  onSupportMessage?: (msg: SupportChatMessage) => void;
}

// Local BroadcastChannel for same-browser multi-tab sync
let localChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localChannel = new BroadcastChannel('quickdrop_local_sync_v5');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported:', e);
}

// Global active Appwrite Realtime unsubscribe handle
let activeAppwriteUnsubscribe: (() => void) | null = null;

// Memory cache of processed message IDs to avoid duplicate processing loops
const processedMessageIds = new Set<string>();

/**
 * Broadcast an event across all mobile phones, browsers, and devices in real-time
 */
export async function broadcastSyncEvent(partialEvent: Omit<SyncEvent, 'senderDeviceId' | 'timestamp'>) {
  const fullEvent: SyncEvent = {
    ...partialEvent,
    senderDeviceId: DEVICE_ID,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(fullEvent);

  // 1. Broadcast locally to all open tabs in this browser
  try {
    localChannel?.postMessage(fullEvent);
  } catch (e) {
    console.warn('Local broadcast error:', e);
  }

  // 2. Direct server API dispatch (Instant SSE broadcast to all connected mobile phones)
  try {
    if (fullEvent.type === 'ORDER_CREATED' && fullEvent.order) {
      fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': DEVICE_ID,
        },
        body: JSON.stringify(fullEvent.order),
      }).catch(() => {});
    } else if (fullEvent.type === 'ORDER_UPDATED' && fullEvent.order) {
      fetch(`/api/orders/${encodeURIComponent(fullEvent.order.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': DEVICE_ID,
        },
        body: JSON.stringify(fullEvent.order),
      }).catch(() => {});
    } else if (fullEvent.type === 'ORDER_DELETED' && fullEvent.orderId) {
      fetch(`/api/orders/${encodeURIComponent(fullEvent.orderId)}`, {
        method: 'DELETE',
        headers: {
          'x-device-id': DEVICE_ID,
        },
      }).catch(() => {});
    } else if (fullEvent.type === 'RIDER_LOCATION_UPDATED' && fullEvent.riderId && fullEvent.lat !== undefined && fullEvent.lng !== undefined) {
      fetch('/api/riders/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': DEVICE_ID,
        },
        body: JSON.stringify({
          riderId: fullEvent.riderId,
          lat: fullEvent.lat,
          lng: fullEvent.lng,
          heading: fullEvent.heading || 0,
          speed: fullEvent.speed || 0,
          orderId: fullEvent.orderId,
        }),
      }).catch(() => {});
    } else {
      fetch('/api/sync/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': DEVICE_ID,
        },
        body: payloadString,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Internal server event dispatch error:', e);
  }

  // 3. Global ntfy HTTP relay fallback for cross-network & multi-device sync
  try {
    fetch(`https://ntfy.sh/${SYNC_TOPIC}`, {
      method: 'POST',
      body: payloadString,
      headers: {
        'Title': `QD:${fullEvent.type}`,
      },
    }).catch(() => {});
  } catch (err) {}

  // 4. Parallel write to Appwrite Database if configured
  if (isAppwriteConfigured) {
    try {
      if (fullEvent.order) {
        syncOrderToAppwrite(fullEvent.order);
      } else if (fullEvent.orderId && fullEvent.type === 'ORDER_DELETED') {
        deleteOrderFromAppwrite(fullEvent.orderId);
      }
    } catch (e) {
      console.warn('Appwrite database write caught:', e);
    }
  }
}

/**
 * Play a clear audio chime when a new order arrives on the Rider's phone
 */
export function playNewOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.2, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };

    playTone(587.33, 0, 0.15); // D5
    playTone(880, 0.15, 0.25); // A5
  } catch (e) {}
}

/**
 * Initialize real-time cross-device synchronization engine
 */
export function initSyncEngine(callbacks: SyncCallbacks): () => void {
  let isSubscribed = true;
  let serverSSE: EventSource | null = null;
  let ntfySSE: EventSource | null = null;
  let pollTimer: any = null;

  const handleIncomingEvent = (event: SyncEvent, isHistorical = false) => {
    if (!isSubscribed) return;
    if (!event || !event.type) return;

    const eventUniqueKey = `${event.type}_${event.timestamp}_${event.order?.id || event.orderId || event.riderId || ''}`;
    if (!isHistorical && processedMessageIds.has(eventUniqueKey)) return;
    processedMessageIds.add(eventUniqueKey);
    if (processedMessageIds.size > 500) {
      const firstKey = processedMessageIds.values().next().value;
      if (firstKey) processedMessageIds.delete(firstKey);
    }

    switch (event.type) {
      case 'ORDER_CREATED':
      case 'INITIAL_SYNC':
        if (event.order && callbacks.onOrderCreated) {
          callbacks.onOrderCreated(event.order);
        }
        if (event.orders && callbacks.onOrdersBulkSync) {
          callbacks.onOrdersBulkSync(event.orders);
        }
        break;

      case 'ORDER_UPDATED':
        if (event.order && callbacks.onOrderUpdated) {
          callbacks.onOrderUpdated(event.order);
        }
        break;

      case 'ORDER_DELETED':
        if (event.orderId && callbacks.onOrderDeleted) {
          callbacks.onOrderDeleted(event.orderId);
        }
        break;

      case 'RIDER_STATUS_UPDATED':
        if (event.riderId && event.isOnline !== undefined && callbacks.onRiderStatusUpdated) {
          callbacks.onRiderStatusUpdated(event.riderId, event.isOnline);
        }
        break;

      case 'RIDER_LOCATION_UPDATED':
        if (event.riderId && event.lat !== undefined && event.lng !== undefined && callbacks.onRiderLocationUpdated) {
          callbacks.onRiderLocationUpdated(event.riderId, event.lat, event.lng, event.heading, event.speed, event.orderId);
        }
        break;

      case 'RIDER_KYC_UPDATED':
        if (event.riderId && event.kycStatus && callbacks.onRiderKycUpdated) {
          callbacks.onRiderKycUpdated(event.riderId, event.kycStatus, event.kycRemarks);
        }
        break;

      case 'WALLET_RECHARGE_REQUEST':
        if (event.rechargeRequest && callbacks.onWalletRechargeRequest) {
          callbacks.onWalletRechargeRequest(event.rechargeRequest);
        }
        break;

      case 'WALLET_RECHARGE_STATUS':
        if (event.requestId && event.rechargeStatus && callbacks.onWalletRechargeStatus) {
          callbacks.onWalletRechargeStatus(event.requestId, event.rechargeStatus, event.rechargeAmount, event.riderId);
        }
        break;

      case 'SUPPORT_MESSAGE':
        if (event.supportMessage && callbacks.onSupportMessage) {
          callbacks.onSupportMessage(event.supportMessage);
        }
        break;
    }
  };

  // 1. Local browser tabs sync
  const handleLocalMessage = (msgEvent: MessageEvent) => {
    if (msgEvent.data) {
      handleIncomingEvent(msgEvent.data);
    }
  };
  localChannel?.addEventListener('message', handleLocalMessage);

  // 2. Direct Appwrite Realtime Channel
  const setupAppwriteRealtime = () => {
    if (!isAppwriteConfigured) return;
    try {
      const unsubscribe = client.subscribe('databases.quickdrop_db.collections.orders.documents', (response: any) => {
        try {
          if (response.payload && response.payload.payload) {
            const orderData = JSON.parse(response.payload.payload);
            if (response.events.some((e: string) => e.includes('.create'))) {
              handleIncomingEvent({ type: 'ORDER_CREATED', senderDeviceId: 'appwrite_db', timestamp: new Date().toISOString(), order: orderData });
            } else if (response.events.some((e: string) => e.includes('.update'))) {
              handleIncomingEvent({ type: 'ORDER_UPDATED', senderDeviceId: 'appwrite_db', timestamp: new Date().toISOString(), order: orderData });
            } else if (response.events.some((e: string) => e.includes('.delete'))) {
              handleIncomingEvent({ type: 'ORDER_DELETED', senderDeviceId: 'appwrite_db', timestamp: new Date().toISOString(), orderId: orderData.id });
            }
          }
        } catch (e) {}
      });
      activeAppwriteUnsubscribe = unsubscribe;
    } catch (e: any) {
      if (e?.code === 1008 || e?.message?.includes('Invalid Origin') || (typeof e === 'string' && e.includes('1008'))) {
        console.warn('Appwrite Realtime note: Please register this app URL as a Web Platform in your Appwrite Project Console dashboard.');
      } else {
        console.warn('Appwrite Real-Time subscription error:', e);
      }
    }
  };

  setupAppwriteRealtime();

  // 3. Direct Server-Sent Events (SSE) Stream
  const connectServerSSE = () => {
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        serverSSE = new EventSource('/api/events');

        serverSSE.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'CONNECTED') {
              if (data.orders && Array.isArray(data.orders) && data.orders.length > 0 && callbacks.onOrdersBulkSync) {
                callbacks.onOrdersBulkSync(data.orders);
              }
            } else if (data.type) {
              handleIncomingEvent(data as SyncEvent);
            }
          } catch (err) {}
        };

        serverSSE.onerror = () => {
          if (serverSSE && serverSSE.readyState === EventSource.CLOSED) {
            serverSSE.close();
            if (isSubscribed) {
              setTimeout(connectServerSSE, 2000);
            }
          }
        };
      }
    } catch (err) {}
  };

  connectServerSSE();

  // 4. ntfy SSE connection
  const connectNtfySSE = () => {
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        ntfySSE = new EventSource(`${NTFY_SYNC_URL}/sse`);

        ntfySSE.onmessage = (e) => {
          try {
            const envelope = JSON.parse(e.data);
            const rawMsg = envelope.message || envelope.data;
            if (rawMsg) {
              const event: SyncEvent = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
              handleIncomingEvent(event);
            }
          } catch (err) {}
        };

        ntfySSE.onerror = () => {
          if (ntfySSE && ntfySSE.readyState === EventSource.CLOSED) {
            ntfySSE.close();
            if (isSubscribed) {
              setTimeout(connectNtfySSE, 3000);
            }
          }
        };
      }
    } catch (err) {}
  };

  connectNtfySSE();

  // 5. Historical mesh order fetch
  const fetchHistoricalMeshOrders = async () => {
    try {
      const res = await fetch(`https://ntfy.sh/${SYNC_TOPIC}/json?poll=1&since=24h`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n');
        for (const line of lines) {
          if (!line) continue;
          try {
            const envelope = JSON.parse(line);
            const rawMsg = envelope.message || envelope.data;
            if (rawMsg) {
              const event: SyncEvent = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
              handleIncomingEvent(event, true);
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  };

  fetchHistoricalMeshOrders();

  // 6. Fast polling fallback
  const pollServerOrders = async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.orders) && callbacks.onOrdersBulkSync) {
          callbacks.onOrdersBulkSync(json.orders);
        }
      }
    } catch (e) {}
  };

  pollServerOrders();

  const handleManualSync = () => {
    pollServerOrders();
    fetchHistoricalMeshOrders();
  };
  window.addEventListener('quickdrop_manual_sync', handleManualSync);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      pollServerOrders();
      fetchHistoricalMeshOrders();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  pollTimer = setInterval(() => {
    if (isSubscribed) {
      pollServerOrders();
    }
  }, 1500);

  return () => {
    isSubscribed = false;
    window.removeEventListener('quickdrop_manual_sync', handleManualSync);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (pollTimer) clearInterval(pollTimer);
    if (serverSSE) {
      serverSSE.close();
      serverSSE = null;
    }
    if (ntfySSE) {
      ntfySSE.close();
      ntfySSE = null;
    }
    if (activeAppwriteUnsubscribe) {
      try {
        activeAppwriteUnsubscribe();
      } catch (e) {}
      activeAppwriteUnsubscribe = null;
    }
    localChannel?.removeEventListener('message', handleLocalMessage);
  };
}
