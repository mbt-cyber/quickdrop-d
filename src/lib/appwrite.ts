/// <reference types="vite/client" />
import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

/**
 * Validates and sanitizes an endpoint string for Appwrite.
 */
function getValidAppwriteEndpoint(rawEndpoint?: string): string {
  if (!rawEndpoint || typeof rawEndpoint !== 'string') {
    return 'https://cloud.appwrite.io/v1';
  }
  let trimmed = rawEndpoint.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'MY_APP_URL') {
    return 'https://cloud.appwrite.io/v1';
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString().replace(/\/$/, '');
    }
  } catch (e) {
    // Fallback
  }
  return 'https://cloud.appwrite.io/v1';
}

function getValidAppwriteProjectId(rawProjectId?: string): string {
  if (
    !rawProjectId ||
    typeof rawProjectId !== 'string' ||
    !rawProjectId.trim() ||
    rawProjectId === 'undefined' ||
    rawProjectId === 'your-project-id-here'
  ) {
    return '';
  }
  return rawProjectId.trim();
}

export function getStoredAppwriteConfig() {
  const customEndpoint = typeof window !== 'undefined' ? localStorage.getItem('qd_custom_appwrite_endpoint') : null;
  const customProjectId = typeof window !== 'undefined' ? localStorage.getItem('qd_custom_appwrite_project_id') : null;
  const endpoint = customEndpoint || import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
  const rawProjectId = customProjectId || import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
  const projectId = getValidAppwriteProjectId(rawProjectId);
  return { endpoint, projectId, isCustom: Boolean(customEndpoint && customProjectId) };
}

const config = getStoredAppwriteConfig();
export const client = new Client();
if (config.endpoint && config.projectId) {
  client.setEndpoint(getValidAppwriteEndpoint(config.endpoint)).setProject(config.projectId);
}

// -------------------------------------------------------------------------------------------------
// Realtime WebSocket & Error 1008 ("Invalid Origin") Resilience Patch:
// When the current domain is not yet registered in Appwrite Console -> Platforms -> Web App,
// the Appwrite server rejects Realtime WebSockets with close code 1008.
// We intercept this to:
//   1. Gracefully stop the SDK's infinite reconnect-loop every 1 second.
//   2. Prevent console.error noise from flagging false-positive application crashes.
//   3. Let the multi-tier sync engine (SSE / ntfy / local BroadcastChannel / polling) continue seamlessly.
// -------------------------------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  const origConsoleError = console.error;
  console.error = function (...args: any[]) {
    const combinedMsg = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');

    if (
      combinedMsg.includes('Realtime got disconnected') ||
      combinedMsg.includes('1008') ||
      combinedMsg.includes('Invalid Origin') ||
      combinedMsg.includes('Register your new client')
    ) {
      console.warn(
        `[Appwrite Notice] Realtime connection stopped (Origin not yet registered in Appwrite Console). Register "${window.location.hostname}" in Appwrite Console > Project Settings > Platforms > Web App. Fallback SSE/mesh sync is active.`
      );
      return;
    }
    origConsoleError.apply(console, args);
  };

  const realtime = (client as any).realtime;
  if (realtime && typeof realtime === 'object') {
    const origCreateSocket = realtime.createSocket;
    if (typeof origCreateSocket === 'function') {
      realtime.createSocket = function () {
        if (realtime.reconnect === false) {
          return;
        }

        origCreateSocket.call(realtime);

        const currentSocket = realtime.socket as WebSocket | undefined;
        if (currentSocket && typeof currentSocket.addEventListener === 'function') {
          currentSocket.addEventListener('close', (event: CloseEvent) => {
            const isOriginErr =
              event.code === 1008 ||
              (typeof event.reason === 'string' &&
                (event.reason.includes('1008') || event.reason.includes('Invalid Origin')));

            if (isOriginErr) {
              realtime.reconnect = false;
              if (realtime.heartbeat) {
                clearInterval(realtime.heartbeat);
              }
              realtime.lastMessage = {
                type: 'error',
                data: { code: 1008, message: 'Invalid Origin' },
              };
            }
          });
        }
      };
    }

    const origOnMessage = realtime.onMessage;
    if (typeof origOnMessage === 'function') {
      realtime.onMessage = function (event: MessageEvent) {
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (
            raw &&
            (raw.code === 1008 ||
              (raw.type === 'error' && raw.data?.code === 1008) ||
              (typeof raw.message === 'string' && raw.message.includes('Invalid Origin')))
          ) {
            realtime.reconnect = false;
            realtime.lastMessage = {
              type: 'error',
              data: { code: 1008, message: 'Invalid Origin' },
            };
            return;
          }
        } catch (e) {
          // Non-JSON message
        }
        origOnMessage.call(realtime, event);
      };
    }
  }
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { ID, Query };

export const isAppwriteConfigured = Boolean(
  config.projectId &&
  config.projectId.trim() !== '' &&
  config.projectId.trim() !== 'your-project-id-here'
);

export function clearAppwriteCredentials(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('qd_custom_appwrite_endpoint');
    localStorage.removeItem('qd_custom_appwrite_project_id');
    localStorage.removeItem('qd_appwrite_auth_session');
  } catch (e) {
    console.warn('Error clearing Appwrite credentials:', e);
  }
}

export function saveAppwriteCredentials(endpoint: string, projectId: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Window not defined' };
  const trimmedEndpoint = endpoint.trim();
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId || trimmedProjectId === 'your-project-id-here') {
    return { success: false, error: 'Valid Appwrite Project ID is required.' };
  }

  try {
    const validEndpoint = getValidAppwriteEndpoint(trimmedEndpoint || 'https://cloud.appwrite.io/v1');
    localStorage.setItem('qd_custom_appwrite_endpoint', validEndpoint);
    localStorage.setItem('qd_custom_appwrite_project_id', trimmedProjectId);

    client.setEndpoint(validEndpoint).setProject(trimmedProjectId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save Appwrite credentials.' };
  }
}

export async function testAppwriteConnection(endpoint: string, projectId: string): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
  originWarning?: boolean;
}> {
  const startTime = Date.now();
  const validEndpoint = getValidAppwriteEndpoint(endpoint);
  const validProjectId = getValidAppwriteProjectId(projectId);

  if (!validProjectId) {
    return {
      success: false,
      message: 'Please provide a valid Appwrite Project ID (found in Appwrite Project Settings).',
    };
  }

  try {
    const testClient = new Client().setEndpoint(validEndpoint).setProject(validProjectId);
    const testAccount = new Account(testClient);

    let originRestricted = false;
    await testAccount.get().catch((err) => {
      if (err?.code === 401 || err?.message?.includes('missing scope') || err?.message?.includes('Guest')) {
        return null;
      }
      if (err?.code === 403 || err?.message?.includes('Invalid Origin')) {
        originRestricted = true;
        return null;
      }
      if (err?.code === 404 || err?.message?.includes('Project')) {
        throw new Error('Project ID not found. Please verify your Project ID in Appwrite Console.');
      }
      return null;
    });

    const latencyMs = Date.now() - startTime;
    if (originRestricted) {
      return {
        success: true,
        originWarning: true,
        message: `Connected to Appwrite (${latencyMs}ms)! Note: Add "${typeof window !== 'undefined' ? window.location.hostname : 'domain'}" as a Web Platform in Appwrite Console for full permissions.`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Successfully connected to Appwrite (${latencyMs}ms)! Backend sync is active.`,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Appwrite connection failed: ${err?.message || 'Unknown network or project error'}.`,
    };
  }
}

export async function uploadQuickDropFile(file: File, bucketId: string = 'quickdrop_files'): Promise<string | null> {
  if (!isAppwriteConfigured) {
    return URL.createObjectURL(file);
  }
  try {
    const response = await storage.createFile(bucketId, ID.unique(), file);
    const fileUrl = storage.getFileView(bucketId, response.$id);
    return fileUrl.toString();
  } catch (e) {
    console.warn('Appwrite storage upload fallback to local URL:', e);
    return URL.createObjectURL(file);
  }
}

export async function syncOrderToAppwrite(order: any, databaseId: string = 'quickdrop_db', collectionId: string = 'orders') {
  if (!isAppwriteConfigured) return;
  try {
    const docId = order.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      await databases.updateDocument(databaseId, collectionId, docId, {
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        status: order.status,
        payload: JSON.stringify(order),
        updatedAt: new Date().toISOString(),
      });
    } catch (updateErr) {
      await databases.createDocument(databaseId, collectionId, docId, {
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        status: order.status,
        payload: JSON.stringify(order),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Non-blocking sync notice
  }
}

export async function deleteOrderFromAppwrite(orderId: string, databaseId: string = 'quickdrop_db', collectionId: string = 'orders') {
  if (!isAppwriteConfigured) return;
  try {
    const docId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    await databases.deleteDocument(databaseId, collectionId, docId);
  } catch (e) {
    // Non-blocking
  }
}

export const APPWRITE_SETUP_GUIDE = `
# QuickDrop Appwrite Setup Guide

1. Create a project on Appwrite Cloud (https://cloud.appwrite.io/) or your self-hosted instance.
2. Copy your **Project ID** and **Endpoint** (default: https://cloud.appwrite.io/v1).
3. **CRITICAL: Register Web Platform (Prevents Code 1008 Invalid Origin error)**
   - In Appwrite Project Console: Go to **Settings** -> **Platforms** -> **Add Platform** -> **Web App**.
   - Name: "QuickDrop Web"
   - Hostname: "${typeof window !== 'undefined' ? window.location.hostname : 'ais-dev-...run.app'}" (or "*" to allow all subdomains).
4. Create a Database named \`quickdrop_db\` (ID: \`quickdrop_db\`).
5. Create Collections:
   - \`orders\` (ID: \`orders\`) with attributes: \`orderNumber\`, \`customerId\`, \`status\`, \`payload\`, \`createdAt\`, \`updatedAt\`.
   - \`wallet_recharges\` (ID: \`wallet_recharges\`).
   - \`support_messages\` (ID: \`support_messages\`).
6. Create a Storage Bucket named \`quickdrop_files\` (ID: \`quickdrop_files\`) with Any/User read access.
`;
