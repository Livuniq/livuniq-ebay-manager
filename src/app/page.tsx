'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  ShoppingCart,
  MessageSquare,
  Settings,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  Truck,
  ExternalLink,
  Send,
  AlertCircle,
  TrendingUp,
  Tag,
  DollarSign,
  User,
  MapPin,
  Clock,
  Calendar,
  ShieldCheck,
  Check,
  Store,
  ChevronDown,
  Layers,
  ArrowRight,
  Globe,
  Trash2,
  Key,
  UploadCloud,
  Save,
  Eye,
  EyeOff,
  Heart,
} from 'lucide-react';
import { isJunkMessageOrCss } from '@/lib/ebay/template-engine';
import {
  ConnectedAccount,
  EbayListing,
  EbayOrder,
  EbayMessageThread,
  MasterAppConfig,
} from '@/lib/ebay/types';
import CreateListingModal from '@/components/CreateListingModal';
import EditListingModal from '@/components/EditListingModal';
import BulkListingModal from '@/components/BulkListingModal';
import MasterSpecificsMapping from '@/components/MasterSpecificsMapping';
import MasterHtmlTemplates from '@/components/MasterHtmlTemplates';
import MasterDescriptionEditorModal from '@/components/MasterDescriptionEditorModal';
import BulkImageUpdateModal from '@/components/BulkImageUpdateModal';
import { FileSpreadsheet, SlidersHorizontal, FileCode, Replace, Camera } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'orders' | 'messages' | 'stores' | 'settings' | 'specifics-mapping' | 'templates-master'>('overview');

  // Multi-Account state
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [masterConfig, setMasterConfig] = useState<MasterAppConfig | null>(null);

  // Store data state
  const [listings, setListings] = useState<EbayListing[]>([]);
  const [orders, setOrders] = useState<EbayOrder[]>([]);
  const [threads, setThreads] = useState<EbayMessageThread[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Selected thread for messaging
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Search & Filter states
  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'OUT_OF_STOCK'>('ALL');
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'PAID_AWAITING_SHIPMENT' | 'SHIPPED'>('ALL');

  // Modals
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAddListingModal, setShowAddListingModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showMasterDescModal, setShowMasterDescModal] = useState(false);
  const [showBulkImageModal, setShowBulkImageModal] = useState(false);
  const [showEditListingModal, setShowEditListingModal] = useState<EbayListing | null>(null);
  const [showFulfillModal, setShowFulfillModal] = useState<EbayOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('USPS Priority Mail');

  // Edit Listing Form state
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState('');
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [updatingListing, setUpdatingListing] = useState(false);
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState('');
  const [updateErrorMsg, setUpdateErrorMsg] = useState('');

  // Connect Store Form state
  const [connectUsername, setConnectUsername] = useState('');
  const [connectStoreName, setConnectStoreName] = useState('');
  const [connectMarketplace, setConnectMarketplace] = useState<'EBAY_US' | 'EBAY_GB' | 'EBAY_DE' | 'EBAY_AU' | 'EBAY_IN'>('EBAY_US');
  const [connectingAccount, setConnectingAccount] = useState(false);

  // New Listing Form state
  const [newTitle, setNewTitle] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('5');
  const [newCategory, setNewCategory] = useState('Consumer Electronics');
  const [newCondition, setNewCondition] = useState<'NEW' | 'USED'>('NEW');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [submittingListing, setSubmittingListing] = useState(false);

  // Master Settings dual-credential form state (Developer Sandbox + Production Live)
  const [masterAppId, setMasterAppId] = useState('');
  const [masterCertId, setMasterCertId] = useState('');
  const [masterRuName, setMasterRuName] = useState('');
  const [sandboxAppId, setSandboxAppId] = useState('');
  const [sandboxCertId, setSandboxCertId] = useState('');
  const [sandboxRuName, setSandboxRuName] = useState('');
  const [productionAppId, setProductionAppId] = useState('');
  const [productionCertId, setProductionCertId] = useState('');
  const [productionRuName, setProductionRuName] = useState('');
  const [googleDriveApiKey, setGoogleDriveApiKey] = useState('');
  const [showGdriveKey, setShowGdriveKey] = useState(false);
  const [testingGdriveKey, setTestingGdriveKey] = useState(false);
  const [gdriveKeyTestResult, setGdriveKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [credActiveTab, setCredActiveTab] = useState<'sandbox' | 'production'>('sandbox');
  const [connectEnv, setConnectEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [masterEnv, setMasterEnv] = useState<'demo' | 'sandbox' | 'production'>('sandbox');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Sync Diagnostics Modal & State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    message: string;
    syncedListings: number;
    syncedOrders: number;
    syncedMessages: number;
    mode: string;
    timestamp: string;
  } | null>(null);
  const [userAuthTokenInput, setUserAuthTokenInput] = useState('');

  // Remove All Listings State
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingListings, setClearingListings] = useState(false);
  const [clearEndOnEbay, setClearEndOnEbay] = useState(true);
  const [clearScope, setClearScope] = useState<'current'>('current');

  // Reschedule Listing Modal State
  const [rescheduleModalItem, setRescheduleModalItem] = useState<EbayListing | null>(null);
  const [newScheduleDateTime, setNewScheduleDateTime] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Fetch Accounts list
  const fetchAccountsAndData = async (targetAccId?: string) => {
    try {
      setRefreshing(true);
      const accRes = await fetch('/api/ebay/accounts');
      const accData = await accRes.json();

      let currentAccId = targetAccId || activeAccountId;
      if (accData.success) {
        setAccounts(accData.accounts);
        if (accData.accounts.length === 0) {
          currentAccId = '';
          setActiveAccountId('');
          setListings([]);
          setOrders([]);
          setThreads([]);
          setSelectedThreadId(null);
        } else if (!currentAccId || !accData.accounts.some((a: any) => a.id === currentAccId)) {
          currentAccId = accData.activeAccountId || accData.accounts[0].id;
          setActiveAccountId(currentAccId);
        }
      }

      const [cfgRes, listRes, ordRes, msgRes] = await Promise.all([
        fetch('/api/ebay/config'),
        fetch(`/api/ebay/listings?accountId=${currentAccId || ''}`),
        fetch(`/api/ebay/orders?accountId=${currentAccId || ''}`),
        fetch(`/api/ebay/messages?accountId=${currentAccId || ''}`),
      ]);

      const [cfgData, listData, ordData, msgData] = await Promise.all([
        cfgRes.json(),
        listRes.json(),
        ordRes.json(),
        msgRes.json(),
      ]);

      if (cfgData.success) {
        let localCfg: any = null;
        try {
          const cached = localStorage.getItem('ebay_master_config');
          if (cached) localCfg = JSON.parse(cached);
        } catch (e) {}

        const finalEnv =
          cfgData.config.environment ||
          localCfg?.environment ||
          (cfgData.config.masterAppId?.includes('-SBX-') ? 'sandbox' : 'sandbox');

        // Sandbox keys
        const sbxApp = cfgData.config.sandboxAppId || localCfg?.sandboxAppId || (cfgData.config.masterAppId?.includes('-SBX-') ? cfgData.config.masterAppId : '');
        const sbxCert = cfgData.config.sandboxCertId || localCfg?.sandboxCertId || (cfgData.config.masterAppId?.includes('-SBX-') ? cfgData.config.masterCertId : '');
        const sbxRu = cfgData.config.sandboxRuName || localCfg?.sandboxRuName || (cfgData.config.masterAppId?.includes('-SBX-') ? cfgData.config.masterRuName : '');

        // Production keys
        const prdApp = cfgData.config.productionAppId || localCfg?.productionAppId || (!cfgData.config.masterAppId?.includes('-SBX-') ? cfgData.config.masterAppId : '');
        const prdCert = cfgData.config.productionCertId || localCfg?.productionCertId || (!cfgData.config.masterAppId?.includes('-SBX-') ? cfgData.config.masterCertId : '');
        const prdRu = cfgData.config.productionRuName || localCfg?.productionRuName || (!cfgData.config.masterAppId?.includes('-SBX-') ? cfgData.config.masterRuName : '');

        const activeApp = finalEnv === 'production' ? (prdApp || sbxApp) : (sbxApp || prdApp);
        const activeCert = finalEnv === 'production' ? (prdCert || sbxCert) : (sbxCert || prdCert);
        const activeRu = finalEnv === 'production' ? (prdRu || sbxRu) : (sbxRu || prdRu);

        const gdriveKey = cfgData.config.googleDriveApiKey || localCfg?.googleDriveApiKey || '';

        const resolvedConfig = {
          ...cfgData.config,
          environment: finalEnv,
          masterAppId: activeApp,
          masterCertId: activeCert,
          masterRuName: activeRu,
          sandboxAppId: sbxApp,
          sandboxCertId: sbxCert,
          sandboxRuName: sbxRu,
          productionAppId: prdApp,
          productionCertId: prdCert,
          productionRuName: prdRu,
          googleDriveApiKey: gdriveKey,
          isLiveConfigured: Boolean((sbxApp && sbxRu) || (prdApp && prdRu) || (activeApp && activeRu)),
        };

        setMasterConfig(resolvedConfig);
        setMasterAppId(activeApp);
        setMasterCertId(activeCert);
        setMasterRuName(activeRu);
        setSandboxAppId(sbxApp);
        setSandboxCertId(sbxCert);
        setSandboxRuName(sbxRu);
        setProductionAppId(prdApp);
        setProductionCertId(prdCert);
        setProductionRuName(prdRu);
        setGoogleDriveApiKey(gdriveKey);
        setMasterEnv(finalEnv);
        setCredActiveTab(finalEnv === 'production' ? 'production' : 'sandbox');
        setConnectEnv(finalEnv === 'production' ? 'production' : 'sandbox');

        // Auto sync to backend if backend was empty but client had keys
        if (!cfgData.config.masterAppId && activeApp) {
          fetch('/api/ebay/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resolvedConfig),
          }).catch(console.error);
        }
      }

      if (listData.success) setListings(listData.listings);
      if (ordData.success) setOrders(ordData.orders);
      if (msgData.success) {
        setThreads(msgData.threads);
        if (msgData.threads.length > 0) {
          setSelectedThreadId(msgData.threads[0].id);
        } else {
          setSelectedThreadId(null);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Instant client-side restore from localStorage before network completes
  useEffect(() => {
    try {
      const cached = localStorage.getItem('ebay_master_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.masterAppId) setMasterAppId(parsed.masterAppId);
        if (parsed.masterCertId) setMasterCertId(parsed.masterCertId);
        if (parsed.masterRuName) setMasterRuName(parsed.masterRuName);
        if (parsed.environment) setMasterEnv(parsed.environment);
        setMasterConfig((prev) => ({
          masterAppId: parsed.masterAppId,
          masterCertId: parsed.masterCertId || '',
          masterRuName: parsed.masterRuName || '',
          environment: parsed.environment || 'sandbox',
          isLiveConfigured: Boolean(parsed.masterAppId && parsed.masterRuName),
          ...prev,
        }));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchAccountsAndData();
  }, []);

  // Switch Active Account
  const handleSwitchAccount = async (accId: string) => {
    try {
      setActiveAccountId(accId);
      await fetch('/api/ebay/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', accountId: accId }),
      });
      fetchAccountsAndData(accId);
    } catch (err) {
      console.error('Error switching account:', err);
    }
  };

  // Connect new eBay account (Sellbrite 1-Click OAuth flow)
  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectUsername.trim()) return;
    setConnectingAccount(true);

    try {
      const res = await fetch('/api/ebay/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          ebayUsername: connectUsername.trim(),
          storeName: connectStoreName.trim() || `${connectUsername.trim()} Store`,
          marketplace: connectMarketplace,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowConnectModal(false);
        setConnectUsername('');
        setConnectStoreName('');
        setActiveAccountId(data.account.id);
        await fetchAccountsAndData(data.account.id);
      }
    } catch (err) {
      console.error('Failed to connect account:', err);
    } finally {
      setConnectingAccount(false);
    }
  };

  // Disconnect Account
  const handleDisconnect = async (accId: string) => {
    if (!confirm('Are you sure you want to disconnect this eBay store from your service?')) return;
    try {
      const res = await fetch(`/api/ebay/accounts?id=${accId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts);
        setActiveAccountId(data.activeAccountId || '');
        if (!data.activeAccountId || data.accounts.length === 0) {
          setListings([]);
          setOrders([]);
          setThreads([]);
          setSelectedThreadId(null);
        } else {
          fetchAccountsAndData(data.activeAccountId);
        }
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // Per-Store Location Configuration
  const [storeLocations, setStoreLocations] = useState<Record<string, { country: string; postalCode: string; cityState: string }>>({});
  const [storeLocationSaving, setStoreLocationSaving] = useState<Record<string, boolean>>({});
  const [storeLocationSaved, setStoreLocationSaved] = useState<Record<string, boolean>>({});

  const handleStoreLocationChange = (accountId: string, field: 'country' | 'postalCode' | 'cityState', value: string) => {
    setStoreLocations((prev) => {
      const current = prev[accountId] || {
        country: accounts.find((a) => a.id === accountId)?.locationCountry || 'US',
        postalCode: accounts.find((a) => a.id === accountId)?.locationPostalCode || '',
        cityState: accounts.find((a) => a.id === accountId)?.locationCityState || '',
      };
      return {
        ...prev,
        [accountId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleSaveStoreLocation = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    const target = storeLocations[accountId] || {
      country: acc?.locationCountry || 'US',
      postalCode: acc?.locationPostalCode || '',
      cityState: acc?.locationCityState || '',
    };
    setStoreLocationSaving((prev) => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch('/api/ebay/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          accountId,
          locationCountry: target.country.trim().toUpperCase(),
          locationPostalCode: target.postalCode.trim(),
          locationCityState: target.cityState.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        setAccounts((prev) => prev.map((a) => (a.id === accountId ? data.account : a)));
        setStoreLocationSaved((prev) => ({ ...prev, [accountId]: true }));
        setTimeout(() => {
          setStoreLocationSaved((prev) => ({ ...prev, [accountId]: false }));
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to save store location:', err);
    } finally {
      setStoreLocationSaving((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  // Trigger Sync with eBay API / Sync Engine
  const handleTriggerSync = async (withToken?: string) => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/ebay/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          userAuthToken: withToken || userAuthTokenInput || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult({
          message: data.message,
          syncedListings: data.syncedListings,
          syncedOrders: data.syncedOrders,
          syncedMessages: data.syncedMessages,
          mode: data.mode,
          timestamp: data.timestamp,
        });
        setShowSyncModal(true);
        await fetchAccountsAndData(activeAccountId);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const [quickSavingId, setQuickSavingId] = useState<string | null>(null);
  const [pushingListingId, setPushingListingId] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Quick edit listing price / stock (saves locally only, does NOT modify eBay)
  const handleQuickUpdateListing = async (id: string, updates: Partial<EbayListing>) => {
    try {
      setQuickSavingId(id);
      const res = await fetch('/api/ebay/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pushToEbay: false, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setListings((prev) => prev.map((item) => (item.id === id ? data.listing : item)));
      }
    } catch (err) {
      console.error('Failed to update listing', err);
    } finally {
      setTimeout(() => setQuickSavingId(null), 1200);
    }
  };

  // Delete an individual listing completely
  const handleDeleteSingleListing = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this listing? (If active on eBay, it will be ended)')) {
      return;
    }
    try {
      const res = await fetch(`/api/ebay/listings?id=${id}&endOnEbay=true&accountId=${activeAccountId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setListings((prev) => prev.filter((l) => l.id !== id));
      } else {
        alert(data.error || 'Failed to delete listing');
      }
    } catch (err: any) {
      alert(`Error deleting listing: ${err.message}`);
    }
  };

  // Clear/Remove all listings for active store only
  const handleClearAllListings = async () => {
    if (!activeAccountId) {
      alert('Koi active store select nahi hai!');
      return;
    }
    setClearingListings(true);
    try {
      const res = await fetch(
        `/api/ebay/listings?all=true&scope=current&accountId=${activeAccountId}&endOnEbay=${clearEndOnEbay}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setListings((prev) => prev.filter((l) => l.accountId !== activeAccountId));
        setShowClearAllModal(false);
        alert(data.message || `Store "${activeAccount?.storeName || 'Active Store'}" ke saare listings remove ho gaye!`);
        await fetchAccountsAndData(activeAccountId);
      } else {
        alert(data.error || 'Failed to clear listings');
      }
    } catch (err: any) {
      alert(`Error clearing listings: ${err.message}`);
    } finally {
      setClearingListings(false);
    }
  };

  const isListingLive = (l: EbayListing) =>
    l.status === 'ACTIVE' ||
    Boolean(l.ebayListingId && l.ebayListingId !== 'Pending' && /^\d+$/.test(l.ebayListingId.replace(/^#/, '').trim()));

  const isListingDraft = (l: EbayListing) => {
    const live = isListingLive(l);
    return l.hasUnpublishedChanges || (!live && (l.status === 'DRAFT' || !l.ebayListingId || l.ebayListingId === 'Pending'));
  };

  // Publish All Drafts in Bulk to live eBay
  const [publishingDrafts, setPublishingDrafts] = useState(false);

  const handlePublishAllDrafts = async () => {
    const drafts = listings.filter((l) => isListingDraft(l));
    if (drafts.length === 0) {
      alert('Koi unpublished draft nahi mila. Saare listings pehle se eBay par live hain!');
      return;
    }

    if (!confirm(`Kya aap sabhi ${drafts.length} drafts ko eBay store (${activeAccount?.storeName || 'Active Store'}) par LIVE publish karna chahte hain?`)) {
      return;
    }

    setPublishingDrafts(true);
    try {
      const res = await fetch('/api/ebay/listings/publish-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAccountId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `Successfully published ${data.publishedCount} drafts to live eBay!`);
        await fetchAccountsAndData();
      } else {
        alert(data.error || 'Failed to publish drafts');
      }
    } catch (err: any) {
      alert(`Error publishing drafts: ${err.message}`);
    } finally {
      setPublishingDrafts(false);
    }
  };

  // Open Reschedule Dialog
  const openRescheduleModal = (item: EbayListing) => {
    setRescheduleModalItem(item);
    if (item.scheduledTime) {
      try {
        const d = new Date(item.scheduledTime);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => n.toString().padStart(2, '0');
          setNewScheduleDateTime(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        } else {
          setNewScheduleDateTime('');
        }
      } catch {
        setNewScheduleDateTime('');
      }
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setNewScheduleDateTime(
        `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T18:00`
      );
    }
  };

  // Save new schedule date & time or clear schedule
  const handleSaveReschedule = async (clearSchedule = false) => {
    if (!rescheduleModalItem) return;
    setSavingSchedule(true);
    try {
      const scheduledTimePayload = clearSchedule || !newScheduleDateTime
        ? null
        : new Date(newScheduleDateTime).toISOString();

      const res = await fetch('/api/ebay/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rescheduleModalItem.id,
          scheduledTime: scheduledTimePayload,
          publishMode: clearSchedule ? 'DRAFT' : 'SCHEDULE',
          pushToEbay: Boolean(rescheduleModalItem.ebayListingId),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setListings((prev) =>
          prev.map((l) =>
            l.id === rescheduleModalItem.id
              ? {
                  ...l,
                  scheduledTime: scheduledTimePayload || undefined,
                  hasUnpublishedChanges: data.ebayLiveStatus === 'LIVE_UPDATED' ? false : l.hasUnpublishedChanges,
                }
              : l
          )
        );
        setRescheduleModalItem(null);
        if (data.ebayLiveStatus === 'LIVE_FAILED') {
          alert(`Schedule updated locally, but eBay returned a note: ${data.ebayMessage}`);
        } else {
          alert(
            clearSchedule
              ? 'Schedule removed. Listing is now a standard draft.'
              : `Schedule updated and synced with eBay! Listing will go live on ${new Date(scheduledTimePayload!).toLocaleString()}`
          );
        }
      } else {
        alert(data.error || 'Failed to update schedule');
      }
    } catch (err: any) {
      alert(`Error updating schedule: ${err.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  // Push an individual listing to live eBay store
  const handlePushListingToEbay = async (item: EbayListing) => {
    try {
      setPushingListingId(item.id);
      setPushNotice(null);
      const res = await fetch('/api/ebay/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          pushToEbay: true,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku,
          description: item.description,
          images: item.images,
          itemSpecifics: item.itemSpecifics,
          conditionDescription: item.sellerNotes,
          videoId: item.videoId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setListings((prev) => prev.map((l) => (l.id === item.id ? data.listing : l)));
        if (data.ebayLiveStatus === 'LIVE_UPDATED') {
          setPushNotice({ id: item.id, success: true, message: 'Updated live to eBay store!' });
        } else {
          setPushNotice({ id: item.id, success: false, message: data.ebayMessage || 'Notice from eBay' });
        }
      } else {
        setPushNotice({ id: item.id, success: false, message: data.error || 'Failed to update' });
      }
    } catch (err) {
      setPushNotice({ id: item.id, success: false, message: (err as Error).message });
    } finally {
      setPushingListingId(null);
      setTimeout(() => setPushNotice(null), 4000);
    }
  };

  // Open Full Edit Modal
  const openEditModal = (item: EbayListing) => {
    setShowEditListingModal(item);
    setEditTitle(item.title);
    setEditPrice(item.price.toString());
    setEditQuantity((item.quantity !== undefined && item.quantity !== null ? item.quantity : 0).toString());
    setEditSku(item.sku);
    setEditImages(
      item.images && item.images.length > 0
        ? [...item.images]
        : item.imageUrl
        ? [item.imageUrl]
        : []
    );
    setEditDescription(item.description || '');
    setNewImageUrlInput('');
    setUpdateSuccessMsg('');
    setUpdateErrorMsg('');
  };

  const handleAddImage = () => {
    if (newImageUrlInput.trim()) {
      setEditImages((prev) => [...prev, newImageUrlInput.trim()]);
      setNewImageUrlInput('');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setEditImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Save Full Listing Edit to eBay
  const handleSaveListingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditListingModal) return;
    setUpdatingListing(true);
    setUpdateSuccessMsg('');
    setUpdateErrorMsg('');
    try {
      const res = await fetch('/api/ebay/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: showEditListingModal.id,
          title: editTitle,
          price: parseFloat(editPrice) || 0,
          quantity: isNaN(parseInt(editQuantity)) ? 0 : parseInt(editQuantity),
          sku: editSku,
          description: editDescription,
          images: editImages,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setListings((prev) =>
          prev.map((l) => (l.id === showEditListingModal.id ? data.listing : l))
        );
        if (data.ebayLiveStatus === 'LIVE_UPDATED') {
          setUpdateSuccessMsg('Successfully revised live on eBay Marketplace!');
        } else if (data.ebayLiveStatus === 'LIVE_FAILED') {
          setUpdateErrorMsg(`eBay API Notice: ${data.ebayMessage}`);
        } else {
          setUpdateSuccessMsg('Listing details saved!');
        }
        setTimeout(() => {
          if (data.ebayLiveStatus !== 'LIVE_FAILED') {
            setShowEditListingModal(null);
            setUpdateSuccessMsg('');
          }
        }, 2000);
      } else {
        setUpdateErrorMsg(data.error || 'Failed to update listing');
      }
    } catch (err) {
      console.error('Failed to update listing:', err);
      setUpdateErrorMsg((err as Error).message);
    } finally {
      setUpdatingListing(false);
    }
  };

  // Submit new listing
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newPrice) return;
    setSubmittingListing(true);
    try {
      const res = await fetch('/api/ebay/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          title: newTitle,
          sku: newSku,
          price: parseFloat(newPrice),
          quantity: parseInt(newQuantity) || 1,
          category: newCategory,
          condition: newCondition,
          currency: activeAccount?.currency || 'USD',
          imageUrl: newImageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=60',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setListings((prev) => [data.listing, ...prev]);
        setShowAddListingModal(false);
        setNewTitle('');
        setNewSku('');
        setNewPrice('');
        setNewImageUrl('');
      }
    } catch (err) {
      console.error('Create listing error:', err);
    } finally {
      setSubmittingListing(false);
    }
  };

  // Fulfill order
  const handleFulfillOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFulfillModal || !trackingNumber) return;
    try {
      const res = await fetch('/api/ebay/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: showFulfillModal.id,
          trackingNumber,
          carrier,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((ord) => (ord.id === showFulfillModal.id ? data.order : ord)));
        setShowFulfillModal(null);
        setTrackingNumber('');
      }
    } catch (err) {
      console.error('Order fulfill error:', err);
    }
  };

  // Send message reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch('/api/ebay/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedThreadId,
          reply: replyText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setThreads((prev) => prev.map((t) => (t.id === selectedThreadId ? data.thread : t)));
        setReplyText('');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  // Select Thread & Mark Read
  const handleSelectThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    const target = threads.find((t) => t.id === threadId);
    if (target?.unread) {
      await fetch('/api/ebay/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      });
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t)));
    }
  };

  // Live message sync from eBay
  const [isSyncingMessages, setIsSyncingMessages] = useState(false);
  const [msgSyncStatus, setMsgSyncStatus] = useState<string | null>(null);

  const handleSyncMessages = async (forceSync = true, days = 365) => {
    setIsSyncingMessages(true);
    setMsgSyncStatus(null);
    try {
      const res = await fetch(`/api/ebay/messages?accountId=${activeAccountId || ''}&sync=${forceSync ? 'true' : 'false'}&days=${days}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.threads)) {
        setThreads(data.threads);
        if (data.threads.length > 0 && !selectedThreadId) {
          setSelectedThreadId(data.threads[0].id);
        }
        if (data.liveSyncedCount !== undefined) {
          setMsgSyncStatus(
            data.liveSyncedCount > 0
              ? `✅ ${data.liveSyncedCount} conversations synchronized from past 1 year!`
              : '✅ Inbox synchronized: all historical eBay conversations up-to-date.'
          );
          setTimeout(() => setMsgSyncStatus(null), 5000);
        }
      }
    } catch (err) {
      console.error('Failed to sync messages:', err);
      setMsgSyncStatus('❌ Sync failed. Please verify store connection.');
      setTimeout(() => setMsgSyncStatus(null), 5000);
    } finally {
      setIsSyncingMessages(false);
    }
  };

  // Load messages when opening the messages tab without forcing a deep live re-pull
  useEffect(() => {
    if (activeTab === 'messages') {
      handleSyncMessages(false);
    }
  }, [activeTab, activeAccountId]);

  // Delete single message thread
  const handleDeleteThread = async (threadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this message thread from your dashboard?')) {
      return;
    }
    try {
      const res = await fetch(
        `/api/ebay/messages?threadId=${encodeURIComponent(threadId)}&accountId=${encodeURIComponent(activeAccountId || '')}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.threads)) {
        setThreads(data.threads);
        if (selectedThreadId === threadId) {
          setSelectedThreadId(data.threads.length > 0 ? data.threads[0].id : null);
        }
      }
    } catch (err) {
      console.error('Failed to delete message thread:', err);
    }
  };

  // Clear all messages from inbox
  const handleClearAllMessages = async () => {
    if (!window.confirm('Are you sure you want to clear all messages from your dashboard inbox?')) {
      return;
    }
    try {
      const res = await fetch(
        `/api/ebay/messages?clearAll=true&accountId=${encodeURIComponent(activeAccountId || '')}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setThreads([]);
        setSelectedThreadId(null);
        setMsgSyncStatus('✅ All messages cleared from dashboard.');
        setTimeout(() => setMsgSyncStatus(null), 4000);
      }
    } catch (err) {
      console.error('Failed to clear messages:', err);
    }
  };

  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [threads, selectedThreadId]);

  // Simulate an incoming buyer message for testing
  const [isSimulatingMessage, setIsSimulatingMessage] = useState(false);
  const handleSimulateMessage = async () => {
    setIsSimulatingMessage(true);
    try {
      const res = await fetch('/api/ebay/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', accountId: activeAccount?.id }),
      });
      const data = await res.json();
      if (data.success && data.thread) {
        setThreads((prev) => [data.thread, ...prev]);
        setSelectedThreadId(data.thread.id);
      }
    } catch (err) {
      console.error('Failed to simulate message:', err);
    } finally {
      setIsSimulatingMessage(false);
    }
  };

  // Switch Active Environment (Production Live vs Developer Sandbox vs Demo Simulator)
  const handleSwitchEnvironment = async (newEnv: 'production' | 'sandbox' | 'demo') => {
    setMasterEnv(newEnv);
    if (newEnv === 'production' || newEnv === 'sandbox') {
      setCredActiveTab(newEnv);
    }
    try {
      const res = await fetch('/api/ebay/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: newEnv }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setMasterConfig(data.config);
        if (data.activeAccountId) {
          setActiveAccountId(data.activeAccountId);
          await fetchAccountsAndData(data.activeAccountId);
        }
        if (data.accounts) {
          setAccounts(data.accounts);
        }
      }
    } catch (e) {
      console.error('Quick switch environment error:', e);
    }
  };

  // Save Master Settings (Dual-Credential: Developer Sandbox + Production Live)
  const handleSaveMasterSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);

    // Compute active master credentials based on current selected environment
    const activeApp = masterEnv === 'production' ? (productionAppId || masterAppId) : (sandboxAppId || masterAppId);
    const activeCert = masterEnv === 'production' ? (productionCertId || masterCertId) : (sandboxCertId || masterCertId);
    const activeRu = masterEnv === 'production' ? (productionRuName || masterRuName) : (sandboxRuName || masterRuName);

    const payload = {
      environment: masterEnv,
      masterAppId: activeApp,
      masterCertId: activeCert,
      masterRuName: activeRu,
      sandboxAppId,
      sandboxCertId,
      sandboxRuName,
      productionAppId,
      productionCertId,
      productionRuName,
      googleDriveApiKey: googleDriveApiKey.trim(),
    };

    try {
      localStorage.setItem('ebay_master_config', JSON.stringify(payload));
    } catch (e) {}

    try {
      const res = await fetch('/api/ebay/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setMasterConfig(data.config);
        setMasterAppId(data.config.masterAppId || activeApp);
        setMasterCertId(data.config.masterCertId || activeCert);
        setMasterRuName(data.config.masterRuName || activeRu);
        setSandboxAppId(data.config.sandboxAppId || sandboxAppId);
        setSandboxCertId(data.config.sandboxCertId || sandboxCertId);
        setSandboxRuName(data.config.sandboxRuName || sandboxRuName);
        setProductionAppId(data.config.productionAppId || productionAppId);
        setProductionCertId(data.config.productionCertId || productionCertId);
        setProductionRuName(data.config.productionRuName || productionRuName);
        if (data.config.googleDriveApiKey !== undefined) {
          setGoogleDriveApiKey(data.config.googleDriveApiKey);
        }
        if (data.activeAccountId) {
          setActiveAccountId(data.activeAccountId);
          await fetchAccountsAndData(data.activeAccountId);
        }
        if (data.accounts) {
          setAccounts(data.accounts);
        }
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Save master settings error:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Test Google Drive API Key Validity & Google Drive API activation
  const handleTestGoogleDriveKey = async () => {
    const keyToTest = googleDriveApiKey.trim();
    if (!keyToTest) {
      setGdriveKeyTestResult({ success: false, message: 'Kripya pehle Google Drive API Key enter karein.' });
      return;
    }
    setTestingGdriveKey(true);
    setGdriveKeyTestResult(null);
    try {
      const res = await fetch('/api/ebay/config/test-gdrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      const data = await res.json();
      if (data.success) {
        setGdriveKeyTestResult({ success: true, message: '✓ Google Drive API Key valid & active hai! Drive scanning aur Video fetch ready hai.' });
      } else {
        setGdriveKeyTestResult({ success: false, message: `❌ Error: ${data.error}` });
      }
    } catch (err: any) {
      setGdriveKeyTestResult({ success: false, message: `❌ Connection error: ${err.message}` });
    } finally {
      setTestingGdriveKey(false);
    }
  };

  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) ||
    (masterEnv === 'production'
      ? accounts.find((a) => (a as any).environment === 'production' || a.ebayUsername.toLowerCase() === 'livuniq' || !a.ebayUsername.toLowerCase().startsWith('testuser_'))
      : accounts.find((a) => (a as any).environment === 'sandbox' || a.ebayUsername.toLowerCase().startsWith('testuser_'))) ||
    accounts[0];

  // Active Store Metrics
  const activeListingsCount = listings.filter((l) => isListingLive(l)).length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PAID_AWAITING_SHIPMENT').length;
  const unreadMessagesCount = threads.filter((t) => t.unread).length;
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Filtered views
  const filteredListings = listings.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(listingSearch.toLowerCase());
    const isLive = isListingLive(item);
    const effectiveStatus = isLive ? 'ACTIVE' : item.status === 'DRAFT' ? 'DRAFT' : 'OUT_OF_STOCK';
    const matchesFilter =
      listingFilter === 'ALL' ? true : effectiveStatus === listingFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredOrders = orders.filter((order) => {
    if (orderFilter === 'ALL') return true;
    return order.status === orderFilter;
  });

  const activeThread = threads.find((t) => t.id === selectedThreadId);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-2xl tracking-tighter">
                <span className="text-red-500">e</span>
                <span className="text-blue-500">b</span>
                <span className="text-yellow-400">a</span>
                <span className="text-green-500">y</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-2 py-0.5 rounded shadow-xs">
                SaaS Multi-Store
              </span>
            </div>
            <button
              onClick={() => handleTriggerSync()}
              title="Sync Store with eBay"
              className={`p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ${
                refreshing ? 'animate-spin text-blue-400' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Active Store Switcher Widget */}
          <div className="p-3 border-b border-slate-800/90">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Active eBay Store
            </label>
            <div className="relative">
              <select
                value={activeAccountId}
                onChange={(e) => handleSwitchAccount(e.target.value)}
                className="w-full bg-slate-800 hover:bg-slate-700/80 text-slate-100 font-semibold text-xs rounded-lg py-2 pl-3 pr-8 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition appearance-none"
              >
                {accounts.map((acc) => {
                  const isSbx = Boolean((acc as any).environment === 'sandbox' || acc.ebayUsername.toLowerCase().startsWith('testuser_'));
                  const badge = isSbx ? '🧪 Sandbox' : '🚀 Live';
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.storeName || acc.ebayUsername} ({badge})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] px-1 text-slate-400">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300 font-medium truncate max-w-[120px]">
                  {activeAccount?.ebayUsername || 'No Store'}
                </span>
              </span>
              <span className="text-emerald-400 font-mono text-[10px]">OAuth Active</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('listings')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'listings'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Package className="w-4 h-4" />
                <span>Listings & Stock</span>
              </div>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                {listings.length}
              </span>
            </button>

            {/* MASTER ITEM SPECIFICS MAPPING TAB (STATIC & DYNAMIC) */}
            <button
              onClick={() => setActiveTab('specifics-mapping')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'specifics-mapping'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <span>Item Specifics Mapping</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-bold">
                Master
              </span>
            </button>

            {/* MASTER HTML DESCRIPTION TEMPLATES TAB */}
            <button
              onClick={() => setActiveTab('templates-master')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'templates-master'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FileCode className="w-4 h-4 text-purple-400" />
                <span>HTML Templates Master</span>
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-bold">
                Design
              </span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ShoppingCart className="w-4 h-4" />
                <span>Orders</span>
              </div>
              {pendingOrdersCount > 0 && (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-4 h-4" />
                <span>Customer Inbox</span>
              </div>
              {unreadMessagesCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('stores')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'stores'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Store className="w-4 h-4" />
                <span>Connected Stores</span>
              </div>
              <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-semibold">
                {accounts.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Master Developer Setup Link */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Master API Setup</span>
          </button>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-800 capitalize">
                {activeTab === 'overview' && `${activeAccount?.storeName || 'Store'} Overview`}
                {activeTab === 'listings' && 'Inventory & Listing Manager'}
                {activeTab === 'orders' && 'Order Fulfillment & Shipping'}
                {activeTab === 'messages' && 'Buyer Messages & Customer Inbox'}
                {activeTab === 'stores' && 'Multi-Tenant Connected eBay Accounts'}
                {activeTab === 'settings' && 'Master eBay Developer Platform Keys'}
              </h1>
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {activeAccount?.marketplace || 'EBAY_US'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Operating as Service Provider for seller: <strong className="text-slate-700">{activeAccount?.ebayUsername}</strong>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* 1-Click Connect Button */}
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect eBay Account</span>
            </button>

            {activeTab === 'listings' && (
              <>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                  title="Google Drive link ya Local Excel se sabhi SKU folders bulk me upload karein"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Bulk Upload (GDrive / Excel)</span>
                </button>

                <button
                  onClick={() => setShowAddListingModal(true)}
                  className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Listing</span>
                </button>
              </>
            )}

            <button
              onClick={() => handleTriggerSync()}
              disabled={refreshing}
              className="flex items-center space-x-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{refreshing ? 'Syncing eBay...' : 'Sync Store'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Store Revenue
                    </span>
                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <DollarSign className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {activeAccount?.currency === 'GBP' ? '£' : '$'}
                    {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    <span>Real-time from {activeAccount?.ebayUsername}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Pending Dispatch
                    </span>
                    <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <Truck className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {pendingOrdersCount}
                  </div>
                  <div className="mt-1 text-xs text-amber-600 font-medium">
                    Action required to ship
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Active Listings
                    </span>
                    <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Tag className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {activeListingsCount} / {listings.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Live on {activeAccount?.marketplace}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer Messages
                    </span>
                    <span className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                      <MessageSquare className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {unreadMessagesCount} Unread
                  </div>
                  <div className="mt-1 text-xs text-rose-600 font-medium">
                    {unreadMessagesCount > 0 ? 'Requires seller response' : 'All inquiries answered'}
                  </div>
                </div>
              </div>

              {/* Connected Stores Quick Switch bar */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-blue-300">
                    SaaS Aggregator Mode (Sellbrite Model)
                  </div>
                  <div className="text-base font-bold mt-1">
                    You have {accounts.length} eBay stores connected to your platform
                  </div>
                  <p className="text-xs text-blue-200 mt-1 max-w-xl">
                    Any seller can connect their store without dealing with API keys. OAuth 2.0 refresh tokens run automatically in the background.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab('stores')}
                    className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/20 transition cursor-pointer"
                  >
                    Manage All Stores
                  </button>
                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="bg-white text-blue-900 hover:bg-blue-50 px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    + Connect Another Store
                  </button>
                </div>
              </div>

              {/* Recent Orders and Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800">
                      Recent Orders ({activeAccount?.storeName})
                    </h2>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>View All Orders</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {orders.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No orders recorded yet for this connected store.
                      </div>
                    ) : (
                      orders.slice(0, 3).map((ord) => (
                        <div key={ord.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition">
                          <div className="flex items-center space-x-3">
                            <img
                              src={ord.items[0]?.imageUrl}
                              alt=""
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                            />
                            <div>
                              <div className="text-xs font-semibold text-slate-800">
                                Order #{ord.orderNumber}
                              </div>
                              <div className="text-xs text-slate-500 truncate max-w-sm">
                                {ord.items[0]?.title}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Buyer: <span className="text-slate-600 font-medium">{ord.buyer.username}</span> • {new Date(ord.orderDate).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-800">
                              {ord.currency === 'GBP' ? '£' : '$'}{ord.totalAmount.toFixed(2)}
                            </div>
                            <span
                              className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                ord.status === 'PAID_AWAITING_SHIPMENT'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {ord.status === 'PAID_AWAITING_SHIPMENT' ? 'Ready to Ship' : 'Shipped'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Seller Store Info */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Store Status ({activeAccount?.ebayUsername})</span>
                  </h2>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500">Seller Level:</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {activeAccount?.sellerLevel || 'Top Rated'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500">Marketplace:</span>
                      <span className="font-semibold text-slate-700">{activeAccount?.marketplace}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500">Currency:</span>
                      <span className="font-semibold text-slate-700">{activeAccount?.currency}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500">Connected via:</span>
                      <span className="font-semibold text-blue-600">eBay OAuth 2.0</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setShowAddListingModal(true)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Listing for this Store</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LISTINGS */}
          {activeTab === 'listings' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    placeholder={`Search listings in ${activeAccount?.storeName}...`}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setListingFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      listingFilter === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({listings.length})
                  </button>
                  <button
                    onClick={() => setListingFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      listingFilter === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Active ({activeListingsCount})
                  </button>
                  <button
                    onClick={() => setListingFilter('DRAFT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      listingFilter === 'DRAFT'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Drafts ({listings.filter((l) => isListingDraft(l)).length})
                  </button>
                  <button
                    onClick={() => setListingFilter('OUT_OF_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      listingFilter === 'OUT_OF_STOCK'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Out of Stock ({listings.filter((l) => !isListingDraft(l) && l.status === 'OUT_OF_STOCK').length})
                  </button>

                  <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

                  {/* Publish All Drafts Button */}
                  {listings.some((l) => isListingDraft(l)) && (
                    <button
                      onClick={handlePublishAllDrafts}
                      disabled={publishingDrafts}
                      className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                      title="Publish all local drafts and unpublished changes live to eBay store"
                    >
                      {publishingDrafts ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Publish All Drafts ({listings.filter((l) => isListingDraft(l)).length})
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Bulk Upload</span>
                  </button>

                  <button
                    onClick={() => setShowBulkImageModal(true)}
                    className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                    title="Folder ya Google Drive link se SKU match karke images & video replace karein"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Update Media / GDrive (by SKU)</span>
                  </button>

                  <button
                    onClick={() => setShowMasterDescModal(true)}
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                    title="Find and replace text or HTML snippets across all descriptions (From ➔ To Editor)"
                  >
                    <Replace className="w-3.5 h-3.5" />
                    <span>Master Description Editor</span>
                  </button>

                  <button
                    onClick={() => setShowAddListingModal(true)}
                    className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Listing</span>
                  </button>

                  <button
                    onClick={() => setShowClearAllModal(true)}
                    className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                    title={`Remove all listings from active store (${activeAccount?.storeName || 'Active Store'})`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Remove All Listings</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Item & Details</th>
                        <th className="py-3 px-4">eBay Item ID / SKU</th>
                        <th className="py-3 px-4">Price ({activeAccount?.currency})</th>
                        <th className="py-3 px-4">Stock / Sold / Views</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Quick Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredListings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No listings found for this store. Click "New Listing" to add one!
                          </td>
                        </tr>
                      ) : (
                        filteredListings.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 max-w-sm">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                                />
                                <div>
                                  <div className="font-semibold text-slate-800 line-clamp-1">
                                    {item.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {item.category} • Condition: <span className="font-medium text-slate-700">{item.condition}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {item.ebayListingId && item.ebayListingId !== 'Pending' && /^\d+$/.test(item.ebayListingId.replace(/^#/, '').trim()) ? (
                                <a
                                  href={`https://www.ebay.com/itm/${item.ebayListingId.replace(/^#/, '').trim()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-semibold inline-flex items-center gap-1"
                                  title="View live listing on eBay"
                                >
                                  #{item.ebayListingId.replace(/^#/, '').trim()}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <div>#{item.ebayListingId || 'Pending'}</div>
                              )}
                              <div className="text-slate-400">SKU: {item.sku}</div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1.5">
                                <span>{item.currency === 'GBP' ? '£' : '$'}</span>
                                <input
                                  type="number"
                                  defaultValue={item.price}
                                  step="0.01"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val !== item.price) {
                                      handleQuickUpdateListing(item.id, { price: val });
                                    }
                                  }}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {quickSavingId === item.id && (
                                  <span className="text-[10px] text-emerald-600 font-bold animate-pulse">
                                    Saved!
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  key={`${item.id}-${item.quantity}`}
                                  type="number"
                                  defaultValue={item.quantity !== undefined && item.quantity !== null ? item.quantity : 0}
                                  min="0"
                                  onBlur={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val !== item.quantity) {
                                      handleQuickUpdateListing(item.id, { quantity: val });
                                    }
                                  }}
                                  className="w-16 px-2 py-1 border border-slate-200 rounded font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <span className="text-slate-400 text-[11px]">
                                  ({item.sold} sold)
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                                  title="Product Page Views on eBay"
                                >
                                  <Eye className="w-3 h-3 text-blue-500" />
                                  <span>{item.views !== undefined ? item.views : 0} views</span>
                                </span>
                                {Boolean(item.watchers) && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                                    title="Watchers on eBay"
                                  >
                                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                                    <span>{item.watchers}</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                {(() => {
                                  const isLive = isListingLive(item);
                                  return (
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                        isLive
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : item.status === 'DRAFT'
                                          ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                                      }`}
                                    >
                                      {isLive ? 'Live on eBay' : item.status === 'DRAFT' ? 'Draft' : 'Out of Stock'}
                                    </span>
                                  );
                                })()}
                                {item.scheduledTime && (
                                  <button
                                    type="button"
                                    onClick={() => openRescheduleModal(item)}
                                    className="text-[10px] text-purple-800 font-bold bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-pointer transition shadow-2xs group"
                                    title={`Click to Change Schedule. Current: ${new Date(item.scheduledTime).toLocaleString()}`}
                                  >
                                    <Clock className="w-3 h-3 text-purple-600 group-hover:rotate-45 transition-transform" />
                                    <span>
                                      {new Date(item.scheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-[9px] text-purple-600 underline ml-0.5">Edit</span>
                                  </button>
                                )}
                                {item.hasUnpublishedChanges && (
                                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    Local Draft
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              {/* Push to eBay live store button */}
                              <button
                                onClick={() => handlePushListingToEbay(item)}
                                disabled={pushingListingId === item.id}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer inline-flex items-center space-x-1 ${
                                  item.hasUnpublishedChanges
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                }`}
                                title={item.hasUnpublishedChanges ? 'Local changes are not on eBay yet. Click to update live eBay store!' : 'Push current details to live eBay store'}
                              >
                                {pushingListingId === item.id ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Updating...</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-3 h-3" />
                                    <span>Update to Store</span>
                                  </>
                                )}
                              </button>

                              {/* Reschedule Button - Only show for draft/unpublished items, never for active eBay live listings */}
                              {!isListingLive(item) && (
                                <button
                                  onClick={() => openRescheduleModal(item)}
                                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-2.5 py-1 rounded text-[11px] font-semibold border border-purple-200 transition cursor-pointer inline-flex items-center gap-1"
                                  title="Change scheduled go-live date & time"
                                >
                                  <Clock className="w-3 h-3 text-purple-600" />
                                  <span>{item.scheduledTime ? 'Change Schedule' : 'Schedule'}</span>
                                </button>
                              )}

                              <button
                                onClick={() => openEditModal(item)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-[11px] font-semibold border border-blue-200 transition cursor-pointer"
                              >
                                Edit Details
                              </button>
                              <button
                                onClick={() => {
                                  const newQty = item.quantity === 0 ? 5 : 0;
                                  handleQuickUpdateListing(item.id, { quantity: newQty });
                                }}
                                className="text-[11px] text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
                              >
                                {item.quantity === 0 ? 'Restock (5)' : 'End Listing'}
                              </button>

                              <button
                                onClick={() => handleDeleteSingleListing(item.id)}
                                className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer px-1 py-0.5 rounded hover:bg-rose-50 transition"
                                title="Permanently delete from Dashboard and end on eBay"
                              >
                                Delete
                              </button>

                              {pushNotice && pushNotice.id === item.id && (
                                <div className={`text-[10px] mt-1 font-bold ${pushNotice.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {pushNotice.message}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-200">
                <button
                  onClick={() => setOrderFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    orderFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Orders ({orders.length})
                </button>
                <button
                  onClick={() => setOrderFilter('PAID_AWAITING_SHIPMENT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    orderFilter === 'PAID_AWAITING_SHIPMENT'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Awaiting Shipment ({pendingOrdersCount})
                </button>
                <button
                  onClick={() => setOrderFilter('SHIPPED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    orderFilter === 'SHIPPED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Dispatched / Shipped ({orders.filter((o) => o.status === 'SHIPPED').length})
                </button>
              </div>

              {/* Order Cards */}
              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                    No orders match your filter for this store.
                  </div>
                ) : (
                  filteredOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            Order #{ord.orderNumber}
                          </span>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                              ord.status === 'PAID_AWAITING_SHIPMENT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {ord.status === 'PAID_AWAITING_SHIPMENT' ? 'Paid - Ship Now' : 'Shipped'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Placed on: {new Date(ord.orderDate).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 space-y-2">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex items-center space-x-3">
                              <img
                                src={it.imageUrl}
                                alt=""
                                className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                              />
                              <div>
                                <div className="text-xs font-semibold text-slate-800">
                                  {it.title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  SKU: {it.sku} • Qty: <span className="font-semibold text-slate-700">{it.quantity}</span> • Price: {ord.currency === 'GBP' ? '£' : '$'}{it.price.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>{ord.buyer.name} ({ord.buyer.username})</span>
                          </div>
                          <div className="flex items-start space-x-1.5 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span>
                              {ord.buyer.shippingAddress.street}, {ord.buyer.shippingAddress.city},{' '}
                              {ord.buyer.shippingAddress.state} {ord.buyer.shippingAddress.postalCode},{' '}
                              {ord.buyer.shippingAddress.country}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-100 gap-2">
                        <div className="text-sm font-bold text-slate-900">
                          Total Paid: {ord.currency === 'GBP' ? '£' : '$'}{ord.totalAmount.toFixed(2)} {ord.currency}
                        </div>

                        <div>
                          {ord.status === 'PAID_AWAITING_SHIPMENT' ? (
                            <button
                              onClick={() => setShowFulfillModal(ord)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
                            >
                              <Truck className="w-4 h-4" />
                              <span>Add Tracking & Mark Shipped</span>
                            </button>
                          ) : (
                            <div className="text-xs text-slate-600 flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span>
                                Dispatched via <strong>{ord.carrier}</strong> (Tracking:{' '}
                                <span className="font-mono text-blue-600 font-semibold">{ord.trackingNumber}</span>)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MESSAGES */}
          {activeTab === 'messages' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-185px)] min-h-[520px] max-h-[780px] overflow-hidden">
              <div className="border-r border-slate-200 flex flex-col h-full min-h-0">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50 font-semibold text-xs text-slate-700 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <span>Buyer Inquiries ({threads.length})</span>
                    {unreadMessagesCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {unreadMessagesCount} unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleSyncMessages(true, 365)}
                      disabled={isSyncingMessages}
                      className="text-[11px] font-medium bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-md shadow-xs transition cursor-pointer flex items-center space-x-1"
                      title="Sync all historical messages from past 1 year"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingMessages ? 'animate-spin' : ''}`} />
                      <span>{isSyncingMessages ? 'Syncing...' : 'Sync eBay Inbox (Full 1 Yr)'}</span>
                    </button>
                    <button
                      onClick={handleSimulateMessage}
                      disabled={isSimulatingMessage}
                      className="text-[11px] font-medium bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-md shadow-xs transition cursor-pointer flex items-center space-x-1"
                      title="Generate a test incoming buyer inquiry"
                    >
                      <span>{isSimulatingMessage ? 'Creating...' : '+ Test'}</span>
                    </button>
                    <button
                      onClick={handleClearAllMessages}
                      disabled={threads.length === 0}
                      className="text-[11px] font-medium bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-slate-200 hover:border-red-300 px-2 py-1 rounded-md shadow-xs transition cursor-pointer flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Clear all messages from dashboard inbox"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>

                {msgSyncStatus && (
                  <div className="bg-emerald-50 text-emerald-800 text-[11px] font-medium px-3.5 py-2 border-b border-emerald-200 flex items-center justify-between">
                    <span>{msgSyncStatus}</span>
                    <button
                      onClick={() => setMsgSyncStatus(null)}
                      className="text-emerald-600 hover:text-emerald-900 font-bold text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-slate-100">
                  {threads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No buyer messages for this store.
                    </div>
                  ) : (
                    threads.map((thr) => {
                      const thrListing =
                        listings.find((l) => l.id === thr.listingId) ||
                        listings.find((l) => l.ebayListingId === thr.listingId) ||
                        listings.find((l) => l.title?.toLowerCase().includes(thr.itemTitle?.toLowerCase() || '---'));

                      return (
                        <div
                          key={thr.id}
                          onClick={() => handleSelectThread(thr.id)}
                          className={`p-3 cursor-pointer transition flex items-start space-x-2.5 ${
                            selectedThreadId === thr.id
                              ? 'bg-blue-50/80 border-l-4 border-blue-600'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {thrListing?.imageUrl ? (
                            <img
                              src={thrListing.imageUrl}
                              alt={thrListing.title}
                              className="w-10 h-10 object-cover rounded border border-slate-200 flex-shrink-0 mt-0.5 bg-white"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs flex-shrink-0 mt-0.5">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 truncate">
                                {thr.unread && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                                )}
                                <span className="truncate">{thr.buyerUsername}</span>
                              </span>
                              <div className="flex items-center space-x-1 flex-shrink-0 ml-1">
                                <span className="text-[10px] text-slate-400">
                                  {new Date(thr.lastUpdated).toLocaleDateString()}
                                </span>
                                <button
                                  onClick={(e) => handleDeleteThread(thr.id, e)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                  title="Delete conversation"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {thrListing?.sku && (
                              <div className="text-[10px] font-semibold text-indigo-600 mb-0.5 flex items-center gap-1">
                                <span className="bg-indigo-50 border border-indigo-200 px-1 rounded">SKU: {thrListing.sku}</span>
                              </div>
                            )}
                            <div className="text-xs font-medium text-slate-700 truncate">
                              {thr.subject}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {thr.lastMessageSnippet}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chat View */}
              <div className="md:col-span-2 flex flex-col h-full bg-slate-50/40 min-h-0">
                {activeThread ? (
                  (() => {
                    const matchedListing =
                      listings.find((l) => l.id === activeThread.listingId) ||
                      listings.find((l) => l.ebayListingId === activeThread.listingId) ||
                      listings.find((l) => l.title?.toLowerCase().includes(activeThread.itemTitle?.toLowerCase() || '---')) ||
                      (activeThread.listingId ? listings[0] : null);

                    return (
                      <>
                        {/* Conversation Header & Product Card */}
                        <div className="p-3.5 bg-white border-b border-slate-200 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-bold text-slate-800 truncate">{activeThread.subject}</h3>
                              {activeThread.unread && (
                                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-semibold flex-shrink-0">
                                  Unread
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                              <span>Buyer: <strong className="text-slate-700">{activeThread.buyerName}</strong> ({activeThread.buyerUsername})</span>
                              <button
                                onClick={() => handleDeleteThread(activeThread.id)}
                                className="text-[11px] text-red-500 hover:text-red-700 hover:underline flex items-center gap-1 ml-2 transition cursor-pointer"
                                title="Delete this conversation"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete Thread</span>
                              </button>
                            </div>
                          </div>

                          {/* Prominent Matched Listing Card */}
                          {(matchedListing || activeThread.itemTitle) && (
                            <div className="flex items-center space-x-2.5 bg-slate-50 hover:bg-slate-100/90 p-2 rounded-lg border border-slate-200 max-w-sm transition flex-shrink-0">
                              {matchedListing?.imageUrl && (
                                <img
                                  src={matchedListing.imageUrl}
                                  alt={matchedListing.title}
                                  className="w-11 h-11 object-cover rounded border border-slate-200 flex-shrink-0 bg-white"
                                />
                              )}
                              <div className="min-w-0 text-left">
                                <div className="text-[11px] font-bold text-slate-800 truncate" title={matchedListing?.title || activeThread.itemTitle}>
                                  {matchedListing?.title || activeThread.itemTitle}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                  {matchedListing?.sku && (
                                    <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                                      SKU: {matchedListing.sku}
                                    </span>
                                  )}
                                  {matchedListing?.price && (
                                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      ${matchedListing.price.toFixed(2)}
                                    </span>
                                  )}
                                  {matchedListing?.ebayListingId && (
                                    <a
                                      href={`https://www.sandbox.ebay.com/itm/${matchedListing.ebayListingId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-0.5 font-medium"
                                      title="Open live listing on eBay Sandbox"
                                    >
                                      <span>#{matchedListing.ebayListingId}</span>
                                      <ExternalLink className="w-2.5 h-2.5 inline ml-0.5" />
                                    </a>
                                  )}
                                  {matchedListing && (
                                    <button
                                      type="button"
                                      onClick={() => setShowEditListingModal(matchedListing)}
                                      className="text-slate-600 hover:text-blue-600 font-semibold underline ml-1 cursor-pointer"
                                    >
                                      Edit Listing
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Messages Thread Scrollable Area */}
                        <div ref={chatScrollRef} className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3.5">
                          {(() => {
                            const sortedMsgs = [...activeThread.messages]
                              .filter((m) => !isJunkMessageOrCss(m.body))
                              .sort(
                                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                              );

                            return sortedMsgs.map((msg, idx) => {
                              const isSeller = msg.senderRole === 'SELLER';
                              return (
                                <div
                                  key={msg.id || idx}
                                  className={`flex flex-col ${isSeller ? 'items-end' : 'items-start'}`}
                                >
                                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mb-1 px-1">
                                    <span className={`font-bold ${isSeller ? 'text-blue-700' : 'text-slate-700'}`}>
                                      {isSeller ? `${msg.sender} (You)` : msg.sender}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      {new Date(msg.timestamp).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <div
                                    className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                                      isSeller
                                        ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                                    }`}
                                  >
                                    {msg.body}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Permanent Sticky Reply Form at Bottom */}
                        <form onSubmit={handleSendReply} className="flex-shrink-0 p-3 bg-white border-t border-slate-200 flex gap-2 shadow-sm">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${activeThread.buyerName || activeThread.buyerUsername} as ${activeAccount?.ebayUsername}...`}
                            className="flex-1 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                          />
                          <button
                            type="submit"
                            disabled={sendingReply || !replyText.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-sm flex-shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                          </button>
                        </form>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                    Select a conversation from the left to read & reply
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: CONNECTED STORES (SELLBRITE MULTI-TENANT VIEW) */}
          {activeTab === 'stores' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Connected eBay Seller Accounts</h2>
                  <p className="text-xs text-slate-500">
                    Each seller connects their account through official eBay OAuth 2.0 without ever needing API keys.
                  </p>
                </div>

                <button
                  onClick={() => setShowConnectModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect Another eBay Account</span>
                </button>
              </div>

              {/* Stores Grid */}
              {accounts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Store className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">No eBay Stores Connected</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Aapka koi eBay store connected nahi hai. Naya official eBay account jodne ke liye button par click karein.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center space-x-2 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Connect Official eBay Account</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`bg-white rounded-xl border p-5 shadow-sm space-y-4 transition ${
                        acc.id === activeAccountId
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            src={acc.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${acc.ebayUsername}`}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-slate-900">{acc.storeName}</span>
                              {acc.id === activeAccountId && (
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  Active Store
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Username: <span className="font-semibold text-slate-700">{acc.ebayUsername}</span> • {acc.marketplace}
                            </div>
                          </div>
                        </div>

                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Connected</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Seller Level</span>
                          <span className="font-semibold text-slate-800">{acc.sellerLevel}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Currency</span>
                          <span className="font-semibold text-slate-800">{acc.currency}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">OAuth Token Life</span>
                          <span className="font-semibold text-emerald-600">Valid (18 Months)</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Last Synced</span>
                          <span className="font-semibold text-slate-700">{new Date(acc.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Item Location & Shipping Origin for this Store */}
                      <div className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            <span>Default Item Location (eBay Trading API)</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">Used for new & revised listings</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Country Code</label>
                            <input
                              type="text"
                              value={storeLocations[acc.id]?.country ?? (acc.locationCountry || (acc.marketplace === 'EBAY_IN' ? 'IN' : acc.marketplace === 'EBAY_GB' ? 'GB' : 'US'))}
                              onChange={(e) => handleStoreLocationChange(acc.id, 'country', e.target.value.toUpperCase())}
                              placeholder="e.g. US, IN, GB"
                              maxLength={3}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Postal / Zip Code</label>
                            <input
                              type="text"
                              value={storeLocations[acc.id]?.postalCode ?? (acc.locationPostalCode || '')}
                              onChange={(e) => handleStoreLocationChange(acc.id, 'postalCode', e.target.value)}
                              placeholder="e.g. 16701 or 395006"
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">City / State / Region</label>
                            <input
                              type="text"
                              value={storeLocations[acc.id]?.cityState ?? (acc.locationCityState || '')}
                              onChange={(e) => handleStoreLocationChange(acc.id, 'cityState', e.target.value)}
                              placeholder="e.g. Bradford, PA or Surat"
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveStoreLocation(acc.id)}
                            disabled={storeLocationSaving[acc.id]}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition shadow-xs cursor-pointer"
                          >
                            {storeLocationSaved[acc.id] ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Location Saved!</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>{storeLocationSaving[acc.id] ? 'Saving...' : 'Save Item Location'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        {acc.id !== activeAccountId ? (
                          <button
                            onClick={() => handleSwitchAccount(acc.id)}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Switch To This Store
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-medium">Currently viewing this store</span>
                        )}

                        <button
                          onClick={() => handleDisconnect(acc.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: MASTER DEVELOPER SETUP (DUAL CREDENTIAL: DEVELOPER SANDBOX + PRODUCTION LIVE) */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <Key className="w-5 h-5 text-blue-600" />
                    <span>Master SaaS Platform API Credentials</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Yahan aap <strong>Developer Sandbox (Testing)</strong> aur <strong>Production (Real Live)</strong> dono ke credentials alag-alag save karke rakh sakte hain. Jab testing karni ho toh Developer chunein, aur real eBay par live bechna ho toh Production!
                  </p>
                </div>
              </div>

              {settingsSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs flex items-center space-x-2 animate-fadeIn">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Master platform keys updated! Dono Developer & Production credentials safely saved.</span>
                </div>
              )}

              <form onSubmit={handleSaveMasterSettings} className="space-y-6 text-xs">
                {/* Active Environment Mode Selector */}
                <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>Active System Mode</span>
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      masterEnv === 'production'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : masterEnv === 'sandbox'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-purple-100 text-purple-800 border-purple-300'
                    }`}>
                      {masterEnv === 'production' ? '🚀 Production Live Mode Active' : masterEnv === 'sandbox' ? '🧪 Developer Sandbox (Testing) Active' : '⚡ Demo Simulator Mode Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Sandbox Option */}
                    <button
                      type="button"
                      onClick={() => handleSwitchEnvironment('sandbox')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        masterEnv === 'sandbox'
                          ? 'bg-white border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                          : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900">🧪 Developer Sandbox</span>
                        {masterEnv === 'sandbox' && <CheckCircle className="w-4 h-4 text-amber-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">Testing aur trial upload ke liye safe environment.</p>
                    </button>

                    {/* Production Option */}
                    <button
                      type="button"
                      onClick={() => handleSwitchEnvironment('production')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        masterEnv === 'production'
                          ? 'bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                          : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900">🚀 Production Live</span>
                        {masterEnv === 'production' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">Asli eBay marketplace aur live buyers ke liye.</p>
                    </button>

                    {/* Demo Option */}
                    <button
                      type="button"
                      onClick={() => handleSwitchEnvironment('demo')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        masterEnv === 'demo'
                          ? 'bg-white border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                          : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900">⚡ Demo Simulator</span>
                        {masterEnv === 'demo' && <CheckCircle className="w-4 h-4 text-purple-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">Bina kisi eBay keys ke offline simulated testing.</p>
                    </button>
                  </div>
                </div>

                {/* Dual Credentials Tab Bar */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="flex border-b border-slate-200 bg-white px-2 pt-2 space-x-1">
                    <button
                      type="button"
                      onClick={() => setCredActiveTab('sandbox')}
                      className={`px-4 py-2.5 text-xs font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
                        credActiveTab === 'sandbox'
                          ? 'border-amber-500 text-amber-700 bg-amber-50/30'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>🧪 1. Developer Sandbox Credentials</span>
                      {sandboxAppId ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Configured</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">Not set</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCredActiveTab('production')}
                      className={`px-4 py-2.5 text-xs font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
                        credActiveTab === 'production'
                          ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>🚀 2. Production Live Credentials</span>
                      {productionAppId ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Configured</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">Not set</span>
                      )}
                    </button>
                  </div>

                  <div className="p-5 space-y-4 bg-white">
                    {/* TAB CONTENT: SANDBOX CREDENTIALS */}
                    {credActiveTab === 'sandbox' && (
                      <div className="space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                          <strong>Developer Sandbox Keys:</strong> Ye keys <a href="https://developer.ebay.com" target="_blank" rel="noreferrer" className="underline font-bold">developer.ebay.com</a> ke <em>"Sandbox Keys"</em> tab se milti hain (App ID me <code>-SBX-</code> hota hai). Isse sandbox test sellers connect hote hain.
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Developer Sandbox App ID (Client ID)
                          </label>
                          <input
                            type="text"
                            value={sandboxAppId}
                            onChange={(e) => setSandboxAppId(e.target.value)}
                            placeholder="e.g. YourCompany-App-SBX-xxxxxxxx-xxxxxxxx"
                            className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Developer Sandbox Cert ID (Client Secret)
                          </label>
                          <input
                            type="password"
                            value={sandboxCertId}
                            onChange={(e) => setSandboxCertId(e.target.value)}
                            placeholder="e.g. SBX-xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Developer Sandbox RuName (Redirect URL Name)
                          </label>
                          <input
                            type="text"
                            value={sandboxRuName}
                            onChange={(e) => setSandboxRuName(e.target.value)}
                            placeholder="e.g. YourCompany-YourApp-SBX-xxxxxx"
                            className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB CONTENT: PRODUCTION CREDENTIALS */}
                    {credActiveTab === 'production' && (
                      <div className="space-y-4">
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] leading-relaxed">
                          <strong>Production Live Keys:</strong> Ye keys <a href="https://developer.ebay.com" target="_blank" rel="noreferrer" className="underline font-bold">developer.ebay.com</a> ke <em>"Production Keys"</em> tab se milti hain (App ID me <code>-PRD-</code> hota hai). Isse real live eBay sellers connect hote hain.
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Production Live App ID (Client ID)
                          </label>
                          <input
                            type="text"
                            value={productionAppId}
                            onChange={(e) => setProductionAppId(e.target.value)}
                            placeholder="e.g. YourName-YourApp-PRD-10928374..."
                            className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Production Live Cert ID (Client Secret)
                          </label>
                          <input
                            type="password"
                            value={productionCertId}
                            onChange={(e) => setProductionCertId(e.target.value)}
                            placeholder="PRD-client-secret-key"
                            className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Production Live RuName (Redirect URL Name)
                          </label>
                          <input
                            type="text"
                            value={productionRuName}
                            onChange={(e) => setProductionRuName(e.target.value)}
                            placeholder="e.g. YourName-YourApp-PRD-ru-name"
                            className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION: GOOGLE DRIVE & CLOUD API SETUP */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 bg-gradient-to-r from-blue-50/70 via-slate-50 to-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                          <span>Google Drive & Cloud API Key Setup</span>
                          <span className="text-[10px] font-normal text-slate-500">(Auto-Fetch Media & Bulk Excel)</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Google Drive se SKU photos/videos bulk scan karne, Excel data auto-read karne, aur listings me video direct upload karne ke liye.
                        </p>
                      </div>
                    </div>
                    {googleDriveApiKey ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3 mr-1" />
                        Configured & Saved
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        Not Configured
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-lg text-slate-700 text-[11px] leading-relaxed flex items-start space-x-2.5">
                      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Universal Auto-Fetch:</strong> Yahan API key save karne ke baad <strong>Bulk Listing</strong>, <strong>Single Edit</strong>, aur <strong>Media Fetcher</strong> automatically yahi key use karenge (bar-bar key enter nahi karni padegi). Developer Sandbox aur Production Live dono modes me ye key universally kaam karegi.
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Google Cloud API Key (Drive API Enabled)
                        </label>
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1"
                        >
                          <span>Google Cloud Console se Free Key lein</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={showGdriveKey ? 'text' : 'password'}
                          value={googleDriveApiKey}
                          onChange={(e) => {
                            setGoogleDriveApiKey(e.target.value);
                            setGdriveKeyTestResult(null);
                          }}
                          placeholder="Enter Google Cloud API Key (e.g. from Cloud Console)"
                          className="w-full border border-slate-300 rounded-lg p-2.5 pr-12 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGdriveKey(!showGdriveKey)}
                          className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 transition rounded"
                          title={showGdriveKey ? 'Hide Key' : 'Show Key'}
                        >
                          {showGdriveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-slate-500">
                          <strong>Zaroori:</strong> Google Cloud me <strong>Google Drive API</strong> enable karein aur Drive folders ko <strong>"Anyone with the link (Viewer)"</strong> par share karein.
                        </p>
                        <button
                          type="button"
                          onClick={handleTestGoogleDriveKey}
                          disabled={testingGdriveKey || !googleDriveApiKey.trim()}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded border border-slate-300 font-semibold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                        >
                          {testingGdriveKey ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Test API Key</span>
                            </>
                          )}
                        </button>
                      </div>

                      {gdriveKeyTestResult && (
                        <div
                          className={`mt-2.5 p-2.5 rounded-lg text-[11px] flex items-start space-x-2 border ${
                            gdriveKeyTestResult.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-red-50 border-red-200 text-red-900'
                          }`}
                        >
                          {gdriveKeyTestResult.success ? (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 leading-relaxed">
                            {gdriveKeyTestResult.message}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-semibold flex items-center space-x-2 transition cursor-pointer shadow-sm text-xs"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{savingSettings ? 'Saving...' : 'Save Master Platform Keys (Both Saved)'}</span>
                  </button>

                  <span className="text-[11px] text-slate-500 font-medium">
                    Active key used: {masterEnv === 'production' ? (productionAppId ? '🚀 Production' : '⚠️ Production not set') : (sandboxAppId ? '🧪 Sandbox' : '⚠️ Sandbox not set')}
                  </span>
                </div>
              </form>
            </div>
          )}

          {/* TAB 7: MASTER ITEM SPECIFICS MAPPING (STATIC & DYNAMIC) */}
          {activeTab === 'specifics-mapping' && (
            <MasterSpecificsMapping
              activeAccountId={activeAccountId}
              accounts={accounts}
              onSwitchAccount={handleSwitchAccount}
            />
          )}

          {/* TAB 8: MASTER HTML DESCRIPTION TEMPLATES */}
          {activeTab === 'templates-master' && (
            <MasterHtmlTemplates
              activeAccountId={activeAccountId}
              accounts={accounts}
              onSwitchAccount={handleSwitchAccount}
            />
          )}
        </div>
      </main>

      {/* MODAL 1: 1-CLICK CONNECT NEW EBAY ACCOUNT (SELLBRITE STYLE - ZERO TOKENS) */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-2xl tracking-tighter">
                  <span className="text-red-500">e</span>
                  <span className="text-blue-500">b</span>
                  <span className="text-yellow-400">a</span>
                  <span className="text-green-500">y</span>
                </span>
                <span className="font-bold text-slate-800 text-sm">OAuth 2.0 Web Authorization</span>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Environment Toggle for Connection */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target eBay Environment:
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setConnectEnv('sandbox')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    connectEnv === 'sandbox'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <span>🧪</span>
                  <span>Developer Sandbox</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectEnv('production')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    connectEnv === 'production'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <span>🚀</span>
                  <span>Production Live</span>
                </button>
              </div>
            </div>

            {/* Marketplace Region Selector */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marketplace Region
              </label>
              <select
                value={connectMarketplace}
                onChange={(e) => setConnectMarketplace(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="EBAY_US">eBay United States (USD $)</option>
                <option value="EBAY_GB">eBay United Kingdom (GBP £)</option>
                <option value="EBAY_DE">eBay Germany (EUR €)</option>
                <option value="EBAY_AU">eBay Australia (AUD $)</option>
                <option value="EBAY_IN">eBay India (INR ₹ / USD)</option>
              </select>
            </div>

            {/* Official eBay Flow Explanation */}
            <div className="mb-4 bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>1-Click eBay Authorization (OAuth 2.0)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Jaise hi aap <strong>"Sign in to eBay & Allow Access"</strong> par click karenge, eBay ka official {connectEnv === 'sandbox' ? 'Sandbox' : 'Production'} login page khulega jahan seller ko sirf <strong>"I Agree / Allow"</strong> dabana hota hai.
              </p>
            </div>

            {/* Live eBay Redirect vs Simulator */}
            {(() => {
              const hasEnvKeys = connectEnv === 'sandbox'
                ? Boolean(sandboxAppId?.trim() || masterConfig?.sandboxAppId?.trim() || (masterConfig?.masterAppId && masterConfig.masterAppId.includes('-SBX-')))
                : Boolean(productionAppId?.trim() || masterConfig?.productionAppId?.trim() || (masterConfig?.masterAppId && !masterConfig.masterAppId.includes('-SBX-')));

              if (hasEnvKeys) {
                return (
                  <div className="space-y-4">
                    <div className={`p-3 text-xs rounded-xl flex items-center space-x-2 ${
                      connectEnv === 'sandbox'
                        ? 'bg-amber-50 border border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    }`}>
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {connectEnv === 'sandbox' ? 'Developer Sandbox Keys Active (auth.sandbox.ebay.com)' : 'Production Live Keys Active (auth.ebay.com)'}
                      </span>
                    </div>

                    <a
                      href={`/api/ebay/oauth/login?marketplace=${connectMarketplace}&env=${connectEnv}`}
                      className={`w-full text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition ${
                        connectEnv === 'sandbox'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#0064D2] hover:bg-blue-700'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      <span>
                        Sign in to Official eBay & Allow Access ({connectEnv === 'sandbox' ? 'Sandbox Testing' : 'Production Real Store'})
                      </span>
                    </a>

                    <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowConnectModal(false);
                          setActiveTab('settings');
                        }}
                        className="text-[11px] text-blue-600 hover:underline font-semibold"
                      >
                        Manage Master API Keys &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConnectModal(false)}
                        className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                    <p className="font-bold">
                      {connectEnv === 'sandbox' ? 'Developer Sandbox Keys Missing' : 'Production Live Keys Missing'}
                    </p>
                    <p className="text-[11px] mt-1 text-rose-700">
                      Aapne abhi is environment ki API credentials save nahi ki hain. Master API Setup me jaakar keys enter karein, ya fir neeche Developer Simulator use karein.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConnectModal(false);
                        setActiveTab('settings');
                        setCredActiveTab(connectEnv);
                      }}
                      className="mt-2 text-xs font-bold text-rose-900 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition"
                    >
                      Configure {connectEnv === 'sandbox' ? 'Sandbox' : 'Production'} Keys Now &rarr;
                    </button>
                  </div>

                  {/* Simulator Form */}
                  <form onSubmit={handleConnectAccount} className="space-y-3.5 text-xs pt-2 border-t border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Or Connect via Local Test Simulator
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        eBay Seller Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={connectUsername}
                        onChange={(e) => setConnectUsername(e.target.value)}
                        placeholder="e.g. MyStore_Official"
                        className="w-full border border-slate-300 rounded-lg p-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Store Display Name
                      </label>
                      <input
                        type="text"
                        value={connectStoreName}
                        onChange={(e) => setConnectStoreName(e.target.value)}
                        placeholder="e.g. MyStore Global Outlet"
                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowConnectModal(false);
                          setActiveTab('settings');
                        }}
                        className="text-[11px] text-blue-600 hover:underline font-semibold"
                      >
                        Add Live Master API Keys &rarr;
                      </button>

                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowConnectModal(false)}
                          className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={connectingAccount || !connectUsername.trim()}
                          className="bg-[#0064D2] hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold flex items-center space-x-2 transition shadow-sm cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{connectingAccount ? 'Connecting...' : 'Connect Simulated Store'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ADVANCED MODAL: CREATE NEW LISTING WITH DIRECT COMPUTER UPLOADS & 42+ SPECIFICS */}
      <CreateListingModal
        isOpen={showAddListingModal}
        onClose={() => setShowAddListingModal(false)}
        activeAccount={activeAccount}
        onListingCreated={(newListing) => {
          setListings((prev) => [newListing, ...prev]);
        }}
      />

      {/* BULK LISTING WIZARD: EXCEL IMPORT + IMAGE FOLDER AUTO-MATCHER */}
      <BulkListingModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        activeAccount={activeAccount}
        onBulkCompleted={(newListings) => {
          setListings((prev) => [...newListings, ...prev]);
        }}
      />

      {/* ADVANCED MODAL: EDIT LISTING WITH DIRECT COMPUTER UPLOADS, VIDEO & 42+ SPECIFICS */}
      <EditListingModal
        isOpen={Boolean(showEditListingModal)}
        listing={showEditListingModal}
        onClose={() => setShowEditListingModal(null)}
        activeAccount={activeAccount}
        onListingUpdated={(updated) => {
          setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        }}
      />

      {/* MASTER DESCRIPTION EDITOR (FROM -> TO FIND & REPLACE) */}
      <MasterDescriptionEditorModal
        isOpen={showMasterDescModal}
        onClose={() => setShowMasterDescModal(false)}
        accountId={activeAccountId}
        listings={listings}
        onComplete={async () => {
          await fetchAccountsAndData(activeAccountId);
        }}
      />

      {/* BULK IMAGE UPDATE MODAL (FOLDER NAME WITH SKU MATCH & REPLACE) */}
      <BulkImageUpdateModal
        isOpen={showBulkImageModal}
        onClose={() => setShowBulkImageModal(false)}
        activeAccount={activeAccount}
        listings={listings}
        onImagesUpdated={async (updatedListings) => {
          const map = new Map(updatedListings.map((l) => [l.id, l]));
          setListings((prev) => prev.map((l) => map.get(l.id) || l));
          await fetchAccountsAndData(activeAccountId);
        }}
      />

      {/* MODAL 3: FULFILL ORDER & ADD TRACKING */}
      {showFulfillModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">Ship eBay Order</h3>
              <button
                onClick={() => setShowFulfillModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
              <div className="font-semibold text-slate-800">
                Order #{showFulfillModal.orderNumber}
              </div>
              <div className="text-slate-500 mt-0.5">
                Buyer: {showFulfillModal.buyer.name} • Total: {showFulfillModal.currency === 'GBP' ? '£' : '$'}{showFulfillModal.totalAmount.toFixed(2)}
              </div>
            </div>

            <form onSubmit={handleFulfillOrder} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shipping Carrier *
                </label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USPS Priority Mail">USPS Priority Mail</option>
                  <option value="USPS Ground Advantage">USPS Ground Advantage</option>
                  <option value="FedEx Home Delivery">FedEx Home Delivery</option>
                  <option value="UPS Ground">UPS Ground</option>
                  <option value="DHL Express">DHL Express</option>
                  <option value="Royal Mail Tracked 24">Royal Mail Tracked 24</option>
                  <option value="Blue Dart / India Post">Blue Dart / India Post</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tracking Number *
                </label>
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. 9400109205568019283719"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFulfillModal(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!trackingNumber.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Confirm Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 4: SYNC DIAGNOSTICS & STATUS */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">eBay Store Synchronized</h3>
                  <p className="text-xs text-slate-500">Store: <strong>{activeAccount?.storeName}</strong> ({activeAccount?.ebayUsername})</p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Sync Summary Cards */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-xs">
                  <div className="text-lg font-bold text-blue-600">{syncResult?.syncedListings ?? 0}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Listings Synced</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-xs">
                  <div className="text-lg font-bold text-amber-600">{syncResult?.syncedOrders ?? 0}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Pending Orders</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-xs">
                  <div className="text-lg font-bold text-rose-600">{syncResult?.syncedMessages ?? 0}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Buyer Messages</div>
                </div>
              </div>

              {/* Status explanation */}
              <div className="bg-blue-50/70 border border-blue-200/80 p-3.5 rounded-xl text-blue-900 space-y-1.5">
                <div className="font-bold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Sync Status: Success ({syncResult?.mode === 'LIVE' ? 'Live eBay Production API' : 'Real-time Synchronized'})</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Aapke store <strong>{activeAccount?.storeName} ({activeAccount?.ebayUsername})</strong> ka inventory catalog, pricing, pending orders aur buyer inquiries ab successfully synchronized hain.
                </p>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  OK, Great
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REMOVE ALL LISTINGS FOR ACTIVE STORE */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Remove All Listings from Store?
                </h3>
                <p className="text-xs text-slate-500">
                  Sirf active store ke listings remove honge
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 leading-relaxed">
              ⚠️ <strong>Warning:</strong> Ye action sirf active store{' '}
              <strong>({activeAccount?.storeName || activeAccount?.ebayUsername || 'Active Store'})</strong> ke listings
              ko database aur eBay live store se permanently remove / end karega. Baki connected stores bilkul safe rahenge.
            </div>

            {/* Target Active Store Badge */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Target Active Store:
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-900">
                    {activeAccount?.storeName || activeAccount?.ebayUsername || 'Active Store'}
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                    {activeAccount?.marketplace || 'EBAY_US'}
                  </span>
                </div>
                <span className="text-xs font-bold text-rose-600">
                  {listings.filter((l) => l.accountId === activeAccountId).length} listings
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={clearEndOnEbay}
                  onChange={(e) => setClearEndOnEbay(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <span>
                  <strong>Also End Live Listings on eBay (EndItem)</strong>
                  <span className="text-[11px] text-slate-500 block">
                    Active listings on eBay will be ended immediately so buyers cannot purchase them.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                disabled={clearingListings}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllListings}
                disabled={clearingListings}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {clearingListings ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing Listings...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Remove All ({listings.filter((l) => l.accountId === activeAccountId).length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: RESCHEDULE GO-LIVE TIME */}
      {rescheduleModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Change Listing Schedule
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    SKU: {rescheduleModalItem.sku}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRescheduleModalItem(null)}
                className="text-slate-400 hover:text-slate-700 text-sm p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 block truncate" title={rescheduleModalItem.title}>
                {rescheduleModalItem.title}
              </span>
              <p className="text-[11px] text-slate-500">
                {rescheduleModalItem.scheduledTime ? (
                  <span>
                    Current Schedule: <strong className="text-purple-700">{new Date(rescheduleModalItem.scheduledTime).toLocaleString()}</strong>
                  </span>
                ) : (
                  <span>Item is currently saved as a manual draft.</span>
                )}
              </p>
            </div>

            {/* Date & Time Picker */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold text-purple-900 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                New Scheduled Date & Time:
              </label>
              <input
                type="datetime-local"
                value={newScheduleDateTime}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setNewScheduleDateTime(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
              />
              <span className="text-[10px] text-slate-500 block">
                Listing will automatically go live on eBay when this date & time arrives.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {rescheduleModalItem.scheduledTime ? (
                <button
                  type="button"
                  disabled={savingSchedule}
                  onClick={() => handleSaveReschedule(true)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition cursor-pointer"
                >
                  Cancel Schedule (Keep Draft)
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalItem(null)}
                  disabled={savingSchedule}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReschedule(false)}
                  disabled={savingSchedule || !newScheduleDateTime}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {savingSchedule ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" />
                      <span>Save New Time</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
