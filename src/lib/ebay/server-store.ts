import fs from 'fs';
import path from 'path';
import { initialMasterConfig, initialAccounts, initialListings, initialOrders, initialThreads } from './data';
import { ConnectedAccount, EbayListing, EbayOrder, EbayMessageThread, MasterAppConfig } from './types';
import { DescriptionTemplate, DEFAULT_TEMPLATES } from './template-engine';
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
    console.error('Failed to save eBay store:', err);
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
  store.masterConfig = {
    ...store.masterConfig,
    ...updates,
    isLiveConfigured: Boolean(updates.masterAppId || store.masterConfig.masterAppId),
  };
  saveStore(store);
  return store.masterConfig;
}

// Multi-Account Operations
export function getAccounts(): ConnectedAccount[] {
  return getStore().accounts;
}

export function getActiveAccountId(): string {
  const store = getStore();
  if (!store.accounts || store.accounts.length === 0) return '';
  const currentExists = store.accounts.some((a) => a.id === store.activeAccountId);
  if (!currentExists) {
    store.activeAccountId = store.accounts[0].id;
    saveStore(store);
  }
  return store.activeAccountId;
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
}): ConnectedAccount {
  const store = getStore();
  const id = `acc-${Date.now().toString().slice(-6)}`;
  const marketplace = params.marketplace || 'EBAY_US';
  const currency = marketplace === 'EBAY_GB' ? 'GBP' : marketplace === 'EBAY_DE' ? 'EUR' : 'USD';

  const newAccount: ConnectedAccount = {
    id,
    ebayUsername: params.ebayUsername,
    storeName: params.storeName || `${params.ebayUsername} Store`,
    marketplace,
    currency,
    sellerLevel: 'Above Standard',
    status: 'ACTIVE',
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
  return store.listings.filter((l) => l.accountId === targetAccount);
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
  return store.threads.filter((t) => t.accountId === targetAccount);
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

// Description HTML Template operations
export function getTemplates(): DescriptionTemplate[] {
  const store = getStore();
  if (!store.templates || store.templates.length === 0) {
    store.templates = [...DEFAULT_TEMPLATES];
    saveStore(store);
  }
  return store.templates;
}

export function saveTemplate(tpl: Partial<DescriptionTemplate> & { name: string; html: string }): DescriptionTemplate {
  const store = getStore();
  if (!store.templates) store.templates = [...DEFAULT_TEMPLATES];

  if (tpl.id) {
    const idx = store.templates.findIndex((t) => t.id === tpl.id);
    if (idx !== -1) {
      store.templates[idx] = {
        ...store.templates[idx],
        ...tpl,
      };
      saveStore(store);
      return store.templates[idx];
    }
  }

  const newTpl: DescriptionTemplate = {
    id: `tpl-${Date.now()}`,
    name: tpl.name,
    description: tpl.description || 'Custom HTML Template',
    html: tpl.html,
    createdAt: new Date().toISOString(),
  };

  store.templates.push(newTpl);
  saveStore(store);
  return newTpl;
}

export function deleteTemplate(id: string): boolean {
  const store = getStore();
  if (!store.templates) return false;
  const initialLen = store.templates.length;
  store.templates = store.templates.filter((t) => t.id !== id);
  if (store.templates.length !== initialLen) {
    saveStore(store);
    return true;
  }
  return false;
}

// Master Item Specifics Mappings (Static & Dynamic rules)
export function getSpecificsMappings(): SpecificMappingRule[] {
  const store = getStore();
  if (store.specificsMapping && Array.isArray(store.specificsMapping) && store.specificsMapping.length > 0) {
    return store.specificsMapping;
  }
  return DEFAULT_SPECIFICS_MAPPINGS;
}

export function saveSpecificsMappings(rules: SpecificMappingRule[]): SpecificMappingRule[] {
  const store = getStore();
  store.specificsMapping = rules;
  saveStore(store);
  return store.specificsMapping;
}

// Master Category Profiles (Item Specifics & Template mappings per category)
export function getCategoryProfiles(): MasterCategoryProfile[] {
  const store = getStore();
  if (store.categoryProfiles && Array.isArray(store.categoryProfiles) && store.categoryProfiles.length > 0) {
    return store.categoryProfiles;
  }
  return DEFAULT_CATEGORY_PROFILES;
}

export function saveCategoryProfiles(profiles: MasterCategoryProfile[]): MasterCategoryProfile[] {
  const store = getStore();
  store.categoryProfiles = profiles;
  saveStore(store);
  return store.categoryProfiles;
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
