import { ConnectedAccount, EbayListing, EbayOrder, EbayMessageThread, MasterAppConfig } from './types';

const envAppId = process.env.EBAY_MASTER_APP_ID || '';
const isSbx = envAppId.includes('-SBX-');

export const initialMasterConfig: MasterAppConfig = {
  masterAppId: envAppId,
  masterCertId: process.env.EBAY_MASTER_CERT_ID || '',
  masterRuName: process.env.EBAY_MASTER_RU_NAME || '',
  environment: isSbx ? 'sandbox' : (process.env.EBAY_ENVIRONMENT as any) || 'sandbox',
  isLiveConfigured: Boolean(envAppId),
  sandboxAppId: isSbx ? envAppId : process.env.EBAY_SANDBOX_APP_ID || '',
  sandboxCertId: isSbx ? (process.env.EBAY_MASTER_CERT_ID || '') : process.env.EBAY_SANDBOX_CERT_ID || '',
  sandboxRuName: isSbx ? (process.env.EBAY_MASTER_RU_NAME || '') : process.env.EBAY_SANDBOX_RU_NAME || '',
  productionAppId: !isSbx ? envAppId : process.env.EBAY_PRODUCTION_APP_ID || '',
  productionCertId: !isSbx ? (process.env.EBAY_MASTER_CERT_ID || '') : process.env.EBAY_PRODUCTION_CERT_ID || '',
  productionRuName: !isSbx ? (process.env.EBAY_MASTER_RU_NAME || '') : process.env.EBAY_PRODUCTION_RU_NAME || '',
};

// Clean initial state (no dummy demo stores by default)
export const initialAccounts: ConnectedAccount[] = [];

export const initialListings: EbayListing[] = [];

export const initialOrders: EbayOrder[] = [];

export const initialThreads: EbayMessageThread[] = [];
