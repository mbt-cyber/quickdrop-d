import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// In-memory synced state store (persisted in server memory across all connected phones & browsers)
interface ServerOrder {
  id: string;
  payload: any;
  createdAt: string;
  updatedAt: string;
}

const ordersStore = new Map<string, any>();
const ridersStore = new Map<string, any>();
const rechargeRequestsStore = new Map<string, any>();
const supportMessagesStore = new Map<string, any>();

const SYNC_TOPIC = 'quickdrop_orders_sync_v5';
const NTFY_URL = `https://ntfy.sh/${SYNC_TOPIC}`;

// Forward server events to global ntfy mesh so multi-container deployments stay in 100% sync
async function publishToGlobalMesh(event: any) {
  try {
    const rawPayload = JSON.stringify(event);
    await fetch(`https://ntfy.sh/${SYNC_TOPIC}`, {
      method: 'POST',
      body: rawPayload,
      headers: {
        'Title': `QD:${event.type || 'SYNC'}`,
      },
    });
  } catch (e) {
    // Network fallback
  }
}

// Connected Server-Sent Events (SSE) clients for real-time pushing
type SSEClient = {
  id: string;
  res: express.Response;
};
let sseClients: SSEClient[] = [];

function broadcastSSE(eventType: string, data: any) {
  const payload = JSON.stringify({ type: eventType, ...data });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${payload}\n\n`);
      (client.res as any).flush?.();
    } catch (e) {
      // Client may have disconnected
    }
  });
}

// Global ntfy listener on server to sync events across different Cloud Run containers
function initServerGlobalMeshListener() {
  try {
    // Poll recent events on boot
    fetch(`https://ntfy.sh/${SYNC_TOPIC}/json?poll=1&since=24h`)
      .then((res) => res.text())
      .then((text) => {
        const lines = text.trim().split('\n');
        for (const line of lines) {
          if (!line) continue;
          try {
            const envelope = JSON.parse(line);
            const rawMsg = envelope.message || envelope.data;
            if (rawMsg) {
              const event = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
              if (event.order && (event.type === 'ORDER_CREATED' || event.type === 'ORDER_UPDATED')) {
                ordersStore.set(event.order.id, event.order);
              } else if (event.orderId && event.type === 'ORDER_DELETED') {
                ordersStore.delete(event.orderId);
              }
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
  } catch (e) {}
}

initServerGlobalMeshListener();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // CORS headers for flexibility
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeOrders: ordersStore.size,
      connectedClients: sseClients.length,
      timestamp: new Date().toISOString(),
    });
  });

  // ==========================================
  // REAL-TIME SSE (Server-Sent Events) STREAM
  // ==========================================
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newClient: SSEClient = { id: clientId, res };
    sseClients.push(newClient);

    // Initial connection confirmation with current orders
    const initialOrders = Array.from(ordersStore.values());
    res.write(
      `data: ${JSON.stringify({
        type: 'CONNECTED',
        clientId,
        ordersCount: initialOrders.length,
        orders: initialOrders,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
    (res as any).flush?.();

    // Keep connection alive with ping every 15s
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch (err) {
        clearInterval(heartbeatTimer);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      sseClients = sseClients.filter((c) => c.id !== clientId);
    });
  });

  // ==========================================
  // ORDERS API (Full Real-time Synchronization)
  // ==========================================
  app.get('/api/orders', (req, res) => {
    const list = Array.from(ordersStore.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    res.json({ success: true, orders: list });
  });

  // Customer places new order on mobile phone
  app.post('/api/orders', (req, res) => {
    const order = req.body;
    if (!order || !order.id) {
      return res.status(400).json({ error: 'Order payload with valid ID is required' });
    }

    const timestamp = order.createdAt || new Date().toISOString();
    const orderData = {
      ...order,
      createdAt: timestamp,
      updatedAt: new Date().toISOString(),
    };

    ordersStore.set(order.id, orderData);

    // Broadcast in real-time to all connected rider mobile phones and admin dashboards!
    const createEvent = {
      type: 'ORDER_CREATED',
      order: orderData,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE('ORDER_CREATED', createEvent);
    publishToGlobalMesh(createEvent);

    res.status(201).json({ success: true, order: orderData });
  });

  // Rider accepts / updates order status / OTP verification
  app.put('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    const updates = req.body;

    const existing = ordersStore.get(orderId) || {};
    const updatedOrder = {
      ...existing,
      ...updates,
      id: orderId,
      updatedAt: new Date().toISOString(),
    };

    ordersStore.set(orderId, updatedOrder);

    // Broadcast in real-time to all connected mobile phones!
    const updateEvent = {
      type: 'ORDER_UPDATED',
      order: updatedOrder,
      orderId,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE('ORDER_UPDATED', updateEvent);
    publishToGlobalMesh(updateEvent);

    res.json({ success: true, order: updatedOrder });
  });

  // Delete / cancel order
  app.delete('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    ordersStore.delete(orderId);

    const deleteEvent = {
      type: 'ORDER_DELETED',
      orderId,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE('ORDER_DELETED', deleteEvent);
    publishToGlobalMesh(deleteEvent);

    res.json({ success: true, orderId });
  });

  // ==========================================
  // RIDERS & LIVE LOCATION API
  // ==========================================
  app.get('/api/riders', (req, res) => {
    const list = Array.from(ridersStore.values());
    res.json({ success: true, riders: list });
  });

  // Rider updates profile / registration
  app.post('/api/riders', (req, res) => {
    const rider = req.body;
    if (!rider || !rider.id) {
      return res.status(400).json({ error: 'Rider payload with valid ID is required' });
    }
    const existing = ridersStore.get(rider.id) || {};
    const updated = { ...existing, ...rider, updatedAt: new Date().toISOString() };
    ridersStore.set(rider.id, updated);

    const event = {
      type: 'RIDER_STATUS_UPDATED',
      riderId: rider.id,
      isOnline: rider.isOnline ?? true,
      rider: updated,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE('RIDER_STATUS_UPDATED', event);
    publishToGlobalMesh(event);

    res.json({ success: true, rider: updated });
  });

  // Rider live GPS location update (broadcasts directly to passenger tracking screen)
  app.post('/api/riders/location', (req, res) => {
    const { riderId, lat, lng, heading, speed, orderId } = req.body;
    if (!riderId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'riderId, lat, and lng are required' });
    }

    const existingRider = ridersStore.get(riderId) || { id: riderId };
    const updatedRider = {
      ...existingRider,
      currentLat: lat,
      currentLng: lng,
      heading: heading || 0,
      speed: speed || 0,
      lastLocationUpdate: new Date().toISOString(),
    };
    ridersStore.set(riderId, updatedRider);

    const locationEvent = {
      type: 'RIDER_LOCATION_UPDATED',
      riderId,
      lat,
      lng,
      heading: heading || 0,
      speed: speed || 0,
      orderId,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };

    broadcastSSE('RIDER_LOCATION_UPDATED', locationEvent);
    publishToGlobalMesh(locationEvent);

    res.json({ success: true, location: { lat, lng, heading, speed } });
  });

  // Direct Order In-App Chat Endpoint
  app.post('/api/orders/:id/chat', (req, res) => {
    const orderId = req.params.id;
    const { sender, text } = req.body;
    if (!text || !sender) {
      return res.status(400).json({ error: 'text and sender (customer|rider) are required' });
    }

    const existing = ordersStore.get(orderId);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const chatMessages = [...(existing.customerChatMessages || []), newMsg];
    const updatedOrder = {
      ...existing,
      customerChatMessages: chatMessages,
      updatedAt: new Date().toISOString(),
    };

    ordersStore.set(orderId, updatedOrder);

    const updateEvent = {
      type: 'ORDER_UPDATED',
      order: updatedOrder,
      orderId,
      chatMessage: newMsg,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE('ORDER_UPDATED', updateEvent);
    publishToGlobalMesh(updateEvent);

    res.json({ success: true, message: newMsg, order: updatedOrder });
  });

  // Verify OTP for delivery completion
  app.post('/api/orders/:id/verify-otp', (req, res) => {
    const orderId = req.params.id;
    const { otpCode, riderId } = req.body;

    const existing = ordersStore.get(orderId);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (String(existing.otpCode).trim() !== String(otpCode).trim()) {
      return res.status(400).json({ success: false, error: 'Invalid OTP code' });
    }

    const updatedOrder = {
      ...existing,
      status: 'finished',
      trackingStep: 'delivered',
      paymentStatus: 'completed',
      deliveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ordersStore.set(orderId, updatedOrder);

    const updateEvent = {
      type: 'ORDER_UPDATED',
      order: updatedOrder,
      orderId,
      senderDeviceId: req.headers['x-device-id'] || 'server',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE('ORDER_UPDATED', updateEvent);
    publishToGlobalMesh(updateEvent);

    res.json({ success: true, order: updatedOrder });
  });

  // Generic real-time event dispatcher (for rider online status, KYC, wallet, support chat)
  app.post('/api/sync/event', (req, res) => {
    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Valid event with type is required' });
    }

    // Persist relevant items
    if (event.order && (event.type === 'ORDER_CREATED' || event.type === 'ORDER_UPDATED')) {
      ordersStore.set(event.order.id, event.order);
    } else if (event.orderId && event.type === 'ORDER_DELETED') {
      ordersStore.delete(event.orderId);
    } else if (event.rechargeRequest) {
      rechargeRequestsStore.set(event.rechargeRequest.id, event.rechargeRequest);
    } else if (event.supportMessage) {
      supportMessagesStore.set(event.supportMessage.id, event.supportMessage);
    } else if (event.rider) {
      ridersStore.set(event.rider.id, event.rider);
    }

    // Broadcast to all other phones immediately
    broadcastSSE(event.type, event);
    publishToGlobalMesh(event);

    res.json({ success: true });
  });

  // ==========================================
  // VITE MIDDLEWARE / STATIC FILES
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ QuickDrop Real-time Sync Server active on port ${PORT}`);
  });
}

startServer();
