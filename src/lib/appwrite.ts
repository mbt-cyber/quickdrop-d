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
  if (!rawProjectId || typeof rawProjectId !== 'string' || !rawProjectId.trim() || rawProjectId === 'undefined') {
    return '';
  }
  return rawProjectId.trim();
}

export function getStoredAppwriteConfig() {
  const customEndpoint = typeof window !== 'undefined' ? localStorage.getItem('qd_custom_appwrite_endpoint') : null;
  const customProjectId = typeof window !== 'undefined' ? localStorage.getItem('qd_custom_appwrite_project_id') : null;
  const endpoint = customEndpoint || import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
  const projectId = customProjectId || import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
  return { endpoint, projectId, isCustom: Boolean(customEndpoint && customProjectId) };
}

const config = getStoredAppwriteConfig();
export const client = new Client();
if (config.endpoint && config.projectId) {
  client.setEndpoint(getValidAppwriteEndpoint(config.endpoint)).setProject(getValidAppwriteProjectId(config.projectId));
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { ID, Query };

export const isAppwriteConfigured = Boolean(config.projectId && config.projectId.trim() !== '');

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

  if (!trimmedProjectId) {
    return { success: false, error: 'Appwrite Project ID is required.' };
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
}> {
  const startTime = Date.now();
  const validEndpoint = getValidAppwriteEndpoint(endpoint);
  const validProjectId = getValidAppwriteProjectId(projectId);

  if (!validProjectId) {
    return {
      success: false,
      message: 'Please provide a valid Appwrite Project ID.',
    };
  }

  try {
    const testClient = new Client().setEndpoint(validEndpoint).setProject(validProjectId);
    const testAccount = new Account(testClient);
    
    await testAccount.get().catch((err) => {
      if (err?.code === 401 || err?.message?.includes('missing scope') || err?.message?.includes('Guest')) {
        return null;
      }
      if (err?.code === 404 || err?.message?.includes('Project')) {
        throw new Error('Project ID not found or invalid endpoint.');
      }
      return null;
    });

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Successfully connected to Appwrite (${latencyMs}ms)! Real-time sync and backend are ready.`,
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
    console.warn('Appwrite storage upload failed, falling back to local object URL:', e);
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
    console.warn('Failed to sync order to Appwrite database:', e);
  }
}

export async function deleteOrderFromAppwrite(orderId: string, databaseId: string = 'quickdrop_db', collectionId: string = 'orders') {
  if (!isAppwriteConfigured) return;
  try {
    const docId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    await databases.deleteDocument(databaseId, collectionId, docId);
  } catch (e) {
    console.warn('Failed to delete order from Appwrite:', e);
  }
}

export const APPWRITE_SETUP_GUIDE = `
# QuickDrop Appwrite Setup Guide

1. Create a project on [Appwrite Cloud](https://cloud.appwrite.io/) or your self-hosted Appwrite instance.
2. Copy your **Project ID** and **Endpoint** (default: https://cloud.appwrite.io/v1).
3. Create a Database named \`quickdrop_db\` (ID: \`quickdrop_db\`).
4. Create Collections:
   - \`orders\` (ID: \`orders\`) with attributes: \`orderNumber\`, \`customerId\`, \`status\`, \`payload\`, \`createdAt\`, \`updatedAt\`.
   - \`wallet_recharges\` (ID: \`wallet_recharges\`).
   - \`support_messages\` (ID: \`support_messages\`).
5. Create a Storage Bucket named \`quickdrop_files\` (ID: \`quickdrop_files\`) with public read permissions.
`;
