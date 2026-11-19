export interface ConnectedAccount {
  id: string;
  ebayUsername: string;
  storeName: string;
  marketplace: 'EBAY_US' | 'EBAY_GB' | 'EBAY_DE' | 'EBAY_AU' | 'EBAY_IN';
  currency: string;
  sellerLevel: 'Top Rated Plus' | 'Above Standard' | 'Standard';
  status: 'ACTIVE' | 'SYNCING' | 'DISCONNECTED';
  environment?: 'sandbox' | 'production' | 'demo';
  avatarUrl?: string;
  connectedAt: string;
  lastSyncedAt: string;
  tokenExpiresAt: string;
  accessToken?: string;
  refreshToken?: string;
  shippingPolicyId?: string;
  shippingPolicyName?: string;
  returnPolicyId?: string;
  returnPolicyName?: string;
  paymentPolicyId?: string;
  paymentPolicyName?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationCityState?: string;
  templates?: any[];
  specificsMapping?: any[];
  categoryProfiles?: any[];
  deletedThreadIds?: string[];
}

export interface EbayListing {
  id: string;
  accountId: string;
  sku: string;
  title: string;
  price: number;
  currency: string;
  quantity: number;
  sold: number;
  views?: number;
  watchers?: number;
  category: string;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
  imageUrl: string;
  images?: string[];
  videoUrl?: string;
  videoId?: string;
  description?: string;
  itemSpecifics?: Record<string, string>;
  templateAttributes?: Record<string, any>;
  sellerNotes?: string;
  categoryId?: string;
  conditionId?: string;
  shippingPolicyId?: string;
  shippingPolicyName?: string;
  returnPolicyId?: string;
  returnPolicyName?: string;
  paymentPolicyId?: string;
  paymentPolicyName?: string;
  personalization?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationCityState?: string;
  status: 'ACTIVE' | 'OUT_OF_STOCK' | 'ENDED' | 'DRAFT';
  ebayListingId?: string;
  hasUnpublishedChanges?: boolean;
  scheduledTime?: string;
  publishMode?: 'NOW' | 'DRAFT' | 'SCHEDULE';
  lastSyncedWithEbayAt?: string;
  lastUpdated: string;
}

export interface EbayOrder {
  id: string;
  accountId: string;
  orderNumber: string;
  buyer: {
    username: string;
    name: string;
    email: string;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  items: Array<{
    listingId: string;
    title: string;
    sku: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }>;
  totalAmount: number;
  currency: string;
  orderDate: string;
  status: 'PAID_AWAITING_SHIPMENT' | 'SHIPPED' | 'AWAITING_PAYMENT' | 'CANCELLED';
  trackingNumber?: string;
  carrier?: string;
  shippedDate?: string;
}

export interface EbayMessage {
  id: string;
  sender: string;
  senderRole: 'BUYER' | 'SELLER';
  timestamp: string;
  body: string;
  isAiGenerated?: boolean;
}

export interface EbayMessageThread {
  id: string;
  accountId: string;
  buyerUsername: string;
  buyerName: string;
  itemTitle?: string;
  listingId?: string;
  subject: string;
  lastMessageSnippet: string;
  lastUpdated: string;
  unread: boolean;
  messages: EbayMessage[];
  aiDraftReply?: string;
  aiAutoRepliedAt?: string;
}

export interface MasterAppConfig {
  masterAppId: string;
  masterCertId: string;
  masterRuName: string;
  environment: 'sandbox' | 'production' | 'demo';
  isLiveConfigured: boolean;
  sandboxAppId?: string;
  sandboxCertId?: string;
  sandboxRuName?: string;
  productionAppId?: string;
  productionCertId?: string;
  productionRuName?: string;
  googleDriveApiKey?: string;
  geminiApiKey?: string;
  aiAutoReplyEnabled?: boolean;
  aiAutoReplyMode?: 'auto' | 'draft';
  aiCustomInstructions?: string;
}
