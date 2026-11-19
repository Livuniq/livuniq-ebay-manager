import fs from 'fs';
import path from 'path';
import { initialMasterConfig, initialAccounts, initialListings, initialOrders, initialThreads } from './data';
import { ConnectedAccount, EbayListing, EbayOrder, EbayMessageThread, MasterAppConfig } from './types';
import { DescriptionTemplate, DEFAULT_TEMPLATES, isJunkMessageOrCss } from './template-engine';
import { isDbConfigured, fetchDbState, persistDbState } from './db';
import {
  DEFAULT_SPECIFICS_MAPPINGS,
  isEbayItemSpecific,
  DEFAULT_CATEGORY_PROFILES,
  findMatchingCategoryProfile,
  type SpecificMappingRule,
  type MasterCategoryProfile,
} from './specifics-rules';
export {
  DEFAULT_SPECIFICS_MAPPINGS,
  isEbayItemSpecific,
  DEFAULT_CATEGORY_PROFILES,
  findMatchingCategoryProfile,
  type SpecificMappingRule,
  type MasterCategoryProfile,
};

interface AppStore {
  masterConfig: MasterAppConfig;
  activeAccountId: string;
  accounts: ConnectedAccount[];
  listings: EbayListing[];
  orders: EbayOrder[];
  threads: EbayMessageThread[];
  templates?: DescriptionTemplate[];
  specificsMapping?: SpecificMappingRule[];
  categoryProfiles?: MasterCategoryProfile[];
}

const isVercel = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION
);
export const DATA_DIR = isVercel ? path.join('/tmp', '.data') : path.join(process.cwd(), '.data');
export const DATA_FILE = path.join(DATA_DIR, 'ebay_state.json');

let memoryStore: AppStore | null = null;
let lastDbFetchTime = 0;
const DB_CACHE_TTL_MS = 5000;

export async function ensureStoreAsync(): Promise<AppStore> {
  const now = Date.now();
  if (isDbConfigured()) {
    if (!memoryStore || now - lastDbFetchTime > DB_CACHE_TTL_MS) {
      try {
        const dbData = await fetchDbState();
        if (dbData && typeof dbData === 'object' && Array.isArray(dbData.accounts)) {
          if (!dbData.masterConfig?.masterAppId && process.env.EBAY_MASTER_APP_ID) {
            dbData.masterConfig = {
              ...dbData.masterConfig,
              masterAppId: process.env.EBAY_MASTER_APP_ID,
              masterCertId: process.env.EBAY_MASTER_CERT_ID || '',
              masterRuName: process.env.EBAY_MASTER_RU_NAME || '',
              isLiveConfigured: true,
            };
          }
          if (!dbData.masterConfig?.googleDriveApiKey && process.env.GOOGLE_DRIVE_API_KEY) {
            dbData.masterConfig = {
              ...dbData.masterConfig,
              googleDriveApiKey: process.env.GOOGLE_DRIVE_API_KEY,
            };
          }
          if (!dbData.masterConfig?.geminiApiKey && process.env.GEMINI_API_KEY) {
            dbData.masterConfig = {
              ...dbData.masterConfig,
              geminiApiKey: process.env.GEMINI_API_KEY,
            };
          }
          memoryStore = dbData as AppStore;
          normalizeAccountEnvironments(memoryStore);
          lastDbFetchTime = now;
          return memoryStore;
        } else if (!dbData && memoryStore) {
          await persistDbState(memoryStore);
        }
      } catch (err) {
        console.error('[Neon DB] Error in ensureStoreAsync:', err);
      }
    }
  }
  return ensureDataFile();
}

export async function saveStoreAsync(store: AppStore): Promise<void> {
  saveStore(store);
  if (isDbConfigured()) {
    try {
      await persistDbState(store);
      lastDbFetchTime = Date.now();
    } catch (err) {
      console.error('[Neon DB] Error in saveStoreAsync:', err);
    }
  }
}

function ensureDataFile(): AppStore {
  if (memoryStore) {
    return memoryStore;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.accounts && Array.isArray(parsed.accounts)) {
        if (!parsed.masterConfig?.masterAppId && process.env.EBAY_MASTER_APP_ID) {
          parsed.masterConfig = {
            ...parsed.masterConfig,
            masterAppId: process.env.EBAY_MASTER_APP_ID,
            masterCertId: process.env.EBAY_MASTER_CERT_ID || '',
            masterRuName: process.env.EBAY_MASTER_RU_NAME || '',
            isLiveConfigured: true,
          };
        }
        memoryStore = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading eBay store file, using defaults', err);
  }

  const defaultStore: AppStore = {
    masterConfig: initialMasterConfig,
    activeAccountId: initialAccounts.length > 0 ? initialAccounts[0].id : '',
    accounts: initialAccounts,
    listings: initialListings,
    orders: initialOrders,
    threads: initialThreads,
  };

  memoryStore = defaultStore;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultStore, null, 2), 'utf-8');
  } catch (err) {
    // ignore on read-only environments
  }

  return defaultStore;
}

export function saveStore(store: AppStore) {
  memoryStore = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    // console.error('Failed to save eBay store to disk:', err);
  }

  if (isDbConfigured()) {
    persistDbState(store).catch((err) =>
      console.error('[Neon DB] Background persist error:', err)
    );
  }
}

export function getStore(): AppStore {
  return ensureDataFile();
}

// Master Config operations
export function getMasterConfig(): MasterAppConfig {
  return getStore().masterConfig;
}

export function updateMasterConfig(updates: Partial<MasterAppConfig>): MasterAppConfig {
  const store = getStore();
  const prev = store.masterConfig || {};
  const env = updates.environment || prev.environment || 'sandbox';

  // Extract or preserve Sandbox keys
  let sandboxAppId = updates.sandboxAppId !== undefined ? updates.sandboxAppId : prev.sandboxAppId;
  let sandboxCertId = updates.sandboxCertId !== undefined ? updates.sandboxCertId : prev.sandboxCertId;
  let sandboxRuName = updates.sandboxRuName !== undefined ? updates.sandboxRuName : prev.sandboxRuName;

  // Extract or preserve Production keys
  let productionAppId = updates.productionAppId !== undefined ? updates.productionAppId : prev.productionAppId;
  let productionCertId = updates.productionCertId !== undefined ? updates.productionCertId : prev.productionCertId;
  let productionRuName = updates.productionRuName !== undefined ? updates.productionRuName : prev.productionRuName;

  // If updates passed masterAppId directly, assign to the appropriate environment
  if (updates.masterAppId) {
    if (updates.masterAppId.includes('-SBX-')) {
      if (!sandboxAppId) sandboxAppId = updates.masterAppId;
      if (!sandboxCertId && updates.masterCertId) sandboxCertId = updates.masterCertId;
      if (!sandboxRuName && updates.masterRuName) sandboxRuName = updates.masterRuName;
    } else {
      if (!productionAppId) productionAppId = updates.masterAppId;
      if (!productionCertId && updates.masterCertId) productionCertId = updates.masterCertId;
      if (!productionRuName && updates.masterRuName) productionRuName = updates.masterRuName;
    }
  }

  // Active keys resolved based on selected environment
  let activeAppId = updates.masterAppId;
  let activeCertId = updates.masterCertId;
  let activeRuName = updates.masterRuName;

  if (env === 'production') {
    activeAppId = productionAppId || updates.masterAppId || '';
    activeCertId = productionCertId || updates.masterCertId || '';
    activeRuName = productionRuName || updates.masterRuName || '';
  } else if (env === 'sandbox') {
    activeAppId = sandboxAppId || updates.masterAppId || '';
    activeCertId = sandboxCertId || updates.masterCertId || '';
    activeRuName = sandboxRuName || updates.masterRuName || '';
  }

  // When environment changes, auto-switch activeAccountId to an account that matches the new environment!
  if (updates.environment) {
    const isProd = updates.environment === 'production';
    const matchingAcc = isProd
      ? store.accounts.find((a) => (a as any).environment === 'production' || a.ebayUsername.toLowerCase() === 'livuniq' || !a.ebayUsername.toLowerCase().startsWith('testuser_'))
      : store.accounts.find((a) => (a as any).environment === 'sandbox' || a.ebayUsername.toLowerCase().startsWith('testuser_'));
    if (matchingAcc) {
      store.activeAccountId = matchingAcc.id;
    }
  }

  store.masterConfig = {
    ...prev,
    ...updates,
    environment: env,
    sandboxAppId: sandboxAppId || '',
    sandboxCertId: sandboxCertId || '',
    sandboxRuName: sandboxRuName || '',
    productionAppId: productionAppId || '',
    productionCertId: productionCertId || '',
    productionRuName: productionRuName || '',
    googleDriveApiKey: updates.googleDriveApiKey !== undefined ? updates.googleDriveApiKey : (prev.googleDriveApiKey || ''),
    masterAppId: activeAppId || '',
    masterCertId: activeCertId || '',
    masterRuName: activeRuName || '',
    isLiveConfigured: Boolean((activeAppId && activeRuName) || (sandboxAppId && sandboxRuName) || (productionAppId && productionRuName)),
  };
  normalizeAccountEnvironments(store);
  saveStore(store);
  return store.masterConfig;
}

// Environment & Account Utilities
export function normalizeAccountEnvironments(store: AppStore) {
  if (!store || !Array.isArray(store.accounts)) return;
  for (const acc of store.accounts) {
    if (!acc.environment) {
      if (acc.ebayUsername.toLowerCase().startsWith('testuser_')) {
        acc.environment = 'sandbox';
      } else if (acc.ebayUsername.toLowerCase() === 'livuniq') {
        acc.environment = 'production';
      } else {
        acc.environment = store.masterConfig?.environment === 'sandbox' ? 'sandbox' : 'production';
      }
    }
  }
}

export function isProductionEnvironment(): boolean {
  const store = getStore();
  return store.masterConfig?.environment === 'production';
}

export function isAccountForCurrentEnvironment(account: ConnectedAccount): boolean {
  const isProd = isProductionEnvironment();
  const accIsSandbox = Boolean(
    account.environment === 'sandbox' ||
    account.ebayUsername.toLowerCase().startsWith('testuser_')
  );
  return isProd ? !accIsSandbox : accIsSandbox;
}

export function getAccountForEnvironment(accountId?: string): ConnectedAccount | null {
  const store = getStore();
  const isProd = isProductionEnvironment();

  // 1. If explicit accountId provided, always honor it directly
  if (accountId) {
    const acc = store.accounts.find((a) => a.id === accountId);
    if (acc) {
      return acc;
    }
  }

  // 2. Otherwise find account matching current environment
  if (isProd) {
    const prodAcc =
      store.accounts.find((a) => a.environment === 'production') ||
      store.accounts.find((a) => a.ebayUsername.toLowerCase() === 'livuniq') ||
      store.accounts.find((a) => !a.ebayUsername.toLowerCase().startsWith('testuser_'));
    if (prodAcc) return prodAcc;
  } else {
    const sbxAcc =
      store.accounts.find((a) => a.environment === 'sandbox') ||
      store.accounts.find((a) => a.ebayUsername.toLowerCase().startsWith('testuser_'));
    if (sbxAcc) return sbxAcc;
  }

  // 3. Fallback to activeAccountId if valid, or first account
  const activeAcc = store.accounts.find((a) => a.id === store.activeAccountId);
  return activeAcc || store.accounts[0] || null;
}

// Multi-Account Operations
export function getAccounts(): ConnectedAccount[] {
  const store = getStore();
  normalizeAccountEnvironments(store);
  return store.accounts;
}

export function getActiveAccountId(): string {
  const store = getStore();
  if (!store.accounts || store.accounts.length === 0) return '';
  normalizeAccountEnvironments(store);

  const current = store.accounts.find((a) => a.id === store.activeAccountId);
  if (current && isAccountForCurrentEnvironment(current)) {
    return store.activeAccountId;
  }

  const matched = getAccountForEnvironment();
  if (matched) {
    store.activeAccountId = matched.id;
    saveStore(store);
    return matched.id;
  }

  return store.accounts[0]?.id || '';
}

export function setActiveAccountId(accountId: string): string {
  const store = getStore();
  const exists = store.accounts.some((a) => a.id === accountId);
  if (exists) {
    store.activeAccountId = accountId;
    saveStore(store);
  }
  return store.activeAccountId;
}

export function connectNewAccount(params: {
  ebayUsername: string;
  storeName?: string;
  marketplace?: 'EBAY_US' | 'EBAY_GB' | 'EBAY_DE' | 'EBAY_AU' | 'EBAY_IN';
  environment?: 'sandbox' | 'production';
}): ConnectedAccount {
  const store = getStore();
  const id = `acc-${Date.now().toString().slice(-6)}`;
  const marketplace = params.marketplace || 'EBAY_US';
  const currency = marketplace === 'EBAY_GB' ? 'GBP' : marketplace === 'EBAY_DE' ? 'EUR' : 'USD';
  const env = params.environment || (params.ebayUsername.toLowerCase().startsWith('testuser_') ? 'sandbox' : (store.masterConfig?.environment || 'production'));

  const newAccount: ConnectedAccount = {
    id,
    ebayUsername: params.ebayUsername,
    storeName: params.storeName || `${params.ebayUsername} Store`,
    marketplace,
    currency,
    sellerLevel: 'Above Standard',
    status: 'ACTIVE',
    environment: env,
    avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${params.ebayUsername}`,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    tokenExpiresAt: new Date(Date.now() + 3600000 * 24 * 547).toISOString(), // 18 months OAuth refresh token
  };

  store.accounts.push(newAccount);
  store.activeAccountId = id; // auto switch to the newly connected account

  saveStore(store);
  return newAccount;
}

export function updateConnectedAccount(accountId: string, updates: Partial<ConnectedAccount>): ConnectedAccount | null {
  const store = getStore();
  const acc = store.accounts.find((a) => a.id === accountId);
  if (!acc) return null;
  Object.assign(acc, updates);
  saveStore(store);
  return acc;
}

export function disconnectAccount(accountId: string): boolean {
  const store = getStore();
  store.accounts = store.accounts.filter((a) => a.id !== accountId);
  // Clear all listings, orders, and messages associated with this disconnected account
  store.listings = store.listings.filter((l) => l.accountId !== accountId);
  store.orders = store.orders.filter((o) => o.accountId !== accountId);
  store.threads = store.threads.filter((t) => t.accountId !== accountId);

  if (store.activeAccountId === accountId) {
    store.activeAccountId = store.accounts.length > 0 ? store.accounts[0].id : '';
  }
  saveStore(store);
  return true;
}

// Listings operations filtered by account
export function getListings(accountId?: string): EbayListing[] {
  const store = getStore();
  const targetAccount = accountId || store.activeAccountId;
  if (!targetAccount || !store.accounts.some((a) => a.id === targetAccount)) {
    return [];
  }
  return store.listings
    .filter((l) => l.accountId === targetAccount)
    .map((l) => {
      // Auto-heal status: If it has a real eBay item ID, it is live and active on eBay
      if (
        l.ebayListingId &&
        l.ebayListingId !== 'Pending' &&
        /^\d+$/.test(l.ebayListingId.trim()) &&
        l.status === 'DRAFT'
      ) {
        l.status = (l.quantity !== undefined && l.quantity !== null ? l.quantity : 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK';
      }
      return l;
    });
}

export function createListing(item: Omit<EbayListing, 'id' | 'lastUpdated' | 'sold'>): EbayListing {
  const store = getStore();
  const newListing: EbayListing = {
    ebayListingId: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
    ...item,
    id: `lst-${Date.now()}`,
    sold: 0,
    lastUpdated: new Date().toISOString(),
  };
  store.listings.unshift(newListing);
  saveStore(store);
  return newListing;
}

export function updateListing(id: string, updates: Partial<EbayListing>): EbayListing | null {
  const store = getStore();
  const index = store.listings.findIndex((l) => l.id === id);
  if (index === -1) return null;

  store.listings[index] = {
    ...store.listings[index],
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  if (updates.scheduledTime === null) {
    delete store.listings[index].scheduledTime;
  }
  saveStore(store);
  return store.listings[index];
}

export function deleteListing(id: string): boolean {
  const store = getStore();
  const beforeCount = store.listings.length;
  store.listings = store.listings.filter((l) => l.id !== id);
  if (store.listings.length !== beforeCount) {
    saveStore(store);
    return true;
  }
  return false;
}

export function clearAllListings(accountId?: string): number {
  const store = getStore();
  const beforeCount = store.listings.length;
  if (accountId) {
    store.listings = store.listings.filter((l) => l.accountId !== accountId);
  } else {
    store.listings = [];
  }
  const removed = beforeCount - store.listings.length;
  saveStore(store);
  return removed;
}

// Orders operations filtered by account
export function getOrders(accountId?: string): EbayOrder[] {
  const store = getStore();
  const targetAccount = accountId || store.activeAccountId;
  if (!targetAccount || !store.accounts.some((a) => a.id === targetAccount)) {
    return [];
  }
  return store.orders.filter((o) => o.accountId === targetAccount);
}

export function fulfillOrder(orderId: string, trackingNumber: string, carrier: string): EbayOrder | null {
  const store = getStore();
  const index = store.orders.findIndex((o) => o.id === orderId);
  if (index === -1) return null;

  store.orders[index] = {
    ...store.orders[index],
    status: 'SHIPPED',
    trackingNumber,
    carrier,
    shippedDate: new Date().toISOString(),
  };
  saveStore(store);
  return store.orders[index];
}

// Messages operations filtered by account
export function getMessageThreads(accountId?: string): EbayMessageThread[] {
  const store = getStore();
  const targetAccount = accountId || store.activeAccountId;
  if (!targetAccount || !store.accounts.some((a) => a.id === targetAccount)) {
    return [];
  }
  return store.threads
    .filter((t) => t.accountId === targetAccount)
    .map((t) => {
      const cleanMsgs = (t.messages || []).filter((m) => !isJunkMessageOrCss(m.body));
      const lastMsg = cleanMsgs[cleanMsgs.length - 1];
      const cleanSnippet = lastMsg
        ? lastMsg.body.slice(0, 120)
        : isJunkMessageOrCss(t.lastMessageSnippet)
        ? 'Buyer inquiry'
        : t.lastMessageSnippet;
      return {
        ...t,
        messages: cleanMsgs,
        lastMessageSnippet: cleanSnippet,
      };
    });
}

export function sendReply(threadId: string, body: string, senderName?: string): EbayMessageThread | null {
  const store = getStore();
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread) return null;

  const currentAccount = store.accounts.find((a) => a.id === thread.accountId);
  const actualSender = senderName || currentAccount?.ebayUsername || 'Seller';

  const newMsg = {
    id: `msg-${Date.now()}`,
    sender: actualSender,
    senderRole: 'SELLER' as const,
    timestamp: new Date().toISOString(),
    body,
  };

  thread.messages.push(newMsg);
  thread.lastMessageSnippet = body.length > 80 ? body.substring(0, 77) + '...' : body;
  thread.lastUpdated = new Date().toISOString();
  thread.unread = false;

  saveStore(store);
  return thread;
}

export function markThreadAsRead(threadId: string): boolean {
  const store = getStore();
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread) return false;
  thread.unread = false;
  saveStore(store);
  return true;
}

export function deleteMessageThread(threadId: string, accountId?: string): boolean {
  const store = getStore();
  const beforeCount = store.threads.length;
  store.threads = store.threads.filter((t) => t.id !== threadId);

  // Track in account's deletedThreadIds so live sync does not re-pull it
  const targetAccountId = accountId || store.activeAccountId;
  const acc = store.accounts.find((a) => a.id === targetAccountId);
  if (acc) {
    if (!acc.deletedThreadIds) acc.deletedThreadIds = [];
    if (!acc.deletedThreadIds.includes(threadId)) {
      acc.deletedThreadIds.push(threadId);
    }
  }

  saveStore(store);
  return store.threads.length !== beforeCount;
}

export function clearAllMessageThreads(accountId?: string): number {
  const store = getStore();
  const targetAccountId = accountId || store.activeAccountId;
  const beforeCount = store.threads.length;

  const acc = store.accounts.find((a) => a.id === targetAccountId);
  if (acc) {
    if (!acc.deletedThreadIds) acc.deletedThreadIds = [];
    const idsToClear = store.threads
      .filter((t) => !targetAccountId || t.accountId === targetAccountId)
      .map((t) => t.id);
    for (const id of idsToClear) {
      if (!acc.deletedThreadIds.includes(id)) {
        acc.deletedThreadIds.push(id);
      }
    }
  }

  if (targetAccountId) {
    store.threads = store.threads.filter((t) => t.accountId !== targetAccountId);
  } else {
    store.threads = [];
  }

  const removed = beforeCount - store.threads.length;
  saveStore(store);
  return removed;
}

// Description HTML Template operations (per-account or global)
export function getTemplates(accountId?: string): DescriptionTemplate[] {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);

  if (account) {
    if (!account.templates || account.templates.length === 0) {
      account.templates = store.templates && store.templates.length > 0
        ? JSON.parse(JSON.stringify(store.templates))
        : [...DEFAULT_TEMPLATES];
      saveStore(store);
    }
    return (account.templates || []) as DescriptionTemplate[];
  }

  if (!store.templates || store.templates.length === 0) {
    store.templates = [...DEFAULT_TEMPLATES];
    saveStore(store);
  }
  return store.templates;
}

export function saveTemplate(
  tpl: Partial<DescriptionTemplate> & { name: string; html: string },
  accountId?: string
): DescriptionTemplate {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);

  let targetList: DescriptionTemplate[] = store.templates || [];
  if (account) {
    if (!account.templates) account.templates = [...DEFAULT_TEMPLATES];
    targetList = account.templates as DescriptionTemplate[];
  } else {
    if (!store.templates) store.templates = [...DEFAULT_TEMPLATES];
    targetList = store.templates;
  }

  if (tpl.id) {
    const idx = targetList.findIndex((t) => t.id === tpl.id);
    if (idx !== -1) {
      targetList[idx] = {
        ...targetList[idx],
        ...tpl,
      };
      saveStore(store);
      return targetList[idx];
    }
  }

  const newTpl: DescriptionTemplate = {
    id: `tpl-${Date.now()}`,
    name: tpl.name,
    description: tpl.description || 'Custom HTML Template',
    html: tpl.html,
    createdAt: new Date().toISOString(),
    mappedCategories: tpl.mappedCategories || [],
  };

  targetList.push(newTpl);
  saveStore(store);
  return newTpl;
}

export function deleteTemplate(id: string, accountId?: string): boolean {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);

  let targetList: DescriptionTemplate[] | undefined =
    (account?.templates as DescriptionTemplate[]) || store.templates;

  if (!targetList) return false;
  const initialLen = targetList.length;
  const filtered = targetList.filter((t) => t.id !== id);
  if (filtered.length !== initialLen) {
    if (account) {
      account.templates = filtered;
    } else {
      store.templates = filtered;
    }
    saveStore(store);
    return true;
  }
  return false;
}

// Master Item Specifics Mappings (Static & Dynamic rules per account)
export function getSpecificsMappings(accountId?: string): SpecificMappingRule[] {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);
  if (account && account.specificsMapping && account.specificsMapping.length > 0) {
    return account.specificsMapping;
  }
  if (store.specificsMapping && Array.isArray(store.specificsMapping) && store.specificsMapping.length > 0) {
    return store.specificsMapping;
  }
  return DEFAULT_SPECIFICS_MAPPINGS;
}

export function saveSpecificsMappings(rules: SpecificMappingRule[], accountId?: string): SpecificMappingRule[] {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);
  if (account) {
    account.specificsMapping = rules;
  } else {
    store.specificsMapping = rules;
  }
  saveStore(store);
  return rules;
}

// Master Category Profiles (Item Specifics & Template mappings per category per account)
export function getCategoryProfiles(accountId?: string): MasterCategoryProfile[] {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);
  if (account && account.categoryProfiles && account.categoryProfiles.length > 0) {
    return account.categoryProfiles;
  }
  if (store.categoryProfiles && Array.isArray(store.categoryProfiles) && store.categoryProfiles.length > 0) {
    return store.categoryProfiles;
  }
  return DEFAULT_CATEGORY_PROFILES;
}

export function saveCategoryProfiles(profiles: MasterCategoryProfile[], accountId?: string): MasterCategoryProfile[] {
  const store = getStore();
  const targetId = accountId || store.activeAccountId;
  const account = store.accounts.find((a) => a.id === targetId);
  if (account) {
    account.categoryProfiles = profiles;
  } else {
    store.categoryProfiles = profiles;
  }
  saveStore(store);
  return profiles;
}

// Master Description Find & Replace (From - To Editor)
export function bulkReplaceListingDescription(params: {
  accountId?: string;
  fromText: string;
  toText: string;
  listingIds?: string[];
  caseSensitive?: boolean;
  dryRun?: boolean;
}): {
  updatedCount: number;
  matchedCount: number;
  totalChecked: number;
  updatedListings: {
    id: string;
    sku: string;
    title: string;
    replacementsCount: number;
    sampleBefore?: string;
    sampleAfter?: string;
  }[];
} {
  const store = getStore();
  const targetAccountId = params.accountId || store.activeAccountId;
  const { fromText, toText = '', listingIds, caseSensitive = false, dryRun = false } = params;

  if (!fromText) {
    return { updatedCount: 0, matchedCount: 0, totalChecked: 0, updatedListings: [] };
  }

  let candidates = store.listings;
  if (targetAccountId) {
    candidates = candidates.filter((l) => l.accountId === targetAccountId);
  }
  if (listingIds && listingIds.length > 0) {
    const idSet = new Set(listingIds);
    candidates = candidates.filter((l) => idSet.has(l.id));
  }

  let updatedCount = 0;
  let matchedCount = 0;
  const updatedListings: {
    id: string;
    sku: string;
    title: string;
    replacementsCount: number;
    sampleBefore?: string;
    sampleAfter?: string;
  }[] = [];

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(escapeRegExp(fromText), flags);

  for (const listing of candidates) {
    const originalDesc = listing.description || '';
    if (!originalDesc) continue;

    const matches = originalDesc.match(regex);
    if (matches && matches.length > 0) {
      matchedCount++;

      // Create sample snippet showing context around first match
      const firstIdx = originalDesc.search(regex);
      const startSnippet = Math.max(0, firstIdx - 40);
      const endSnippet = Math.min(originalDesc.length, firstIdx + fromText.length + 40);
      const sampleBefore = (startSnippet > 0 ? '...' : '') + originalDesc.slice(startSnippet, endSnippet) + (endSnippet < originalDesc.length ? '...' : '');

      const newDesc = originalDesc.replace(regex, toText);
      const sampleAfter = sampleBefore.replace(regex, toText);

      if (!dryRun) {
        listing.description = newDesc;
        listing.hasUnpublishedChanges = true;
        listing.lastUpdated = new Date().toISOString();
        updatedCount++;
      }

      updatedListings.push({
        id: listing.id,
        sku: listing.sku,
        title: listing.title,
        replacementsCount: matches.length,
        sampleBefore,
        sampleAfter,
      });
    }
  }

  if (!dryRun && updatedCount > 0) {
    saveStore(store);
  }

  return {
    updatedCount: dryRun ? matchedCount : updatedCount,
    matchedCount,
    totalChecked: candidates.length,
    updatedListings,
  };
}
