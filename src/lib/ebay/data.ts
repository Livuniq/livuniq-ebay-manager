import { ConnectedAccount, EbayListing, EbayOrder, EbayMessageThread, MasterAppConfig } from './types';

export const initialMasterConfig: MasterAppConfig = {
  masterAppId: process.env.EBAY_MASTER_APP_ID || '',
  masterCertId: process.env.EBAY_MASTER_CERT_ID || '',
  masterRuName: process.env.EBAY_MASTER_RU_NAME || '',
  environment: 'sandbox',
  isLiveConfigured: Boolean(process.env.EBAY_MASTER_APP_ID),
};

// Clean initial state (no dummy demo stores by default)
export const initialAccounts: ConnectedAccount[] = [];

export const initialListings: EbayListing[] = [];

export const initialOrders: EbayOrder[] = [];

export const initialThreads: EbayMessageThread[] = [];
