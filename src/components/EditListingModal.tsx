'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Video,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Tag,
  FileText,
  DollarSign,
  Save,
  UploadCloud,
  Clock,
  Calendar,
  FolderUp,
  MapPin,
} from 'lucide-react';
import { ConnectedAccount, EbayListing } from '@/lib/ebay/types';
import { EBAY_JEWELRY_CATEGORIES, EBAY_FILE_EXCHANGE_CONDITIONS } from '@/lib/ebay/constants';
import { isEbayItemSpecific } from '@/lib/ebay/specifics-rules';
import { isVideoMedia, updateDescriptionImages } from '@/lib/ebay/template-engine';
import HtmlTemplateSection from './HtmlTemplateSection';
import BusinessPoliciesSelector from './BusinessPoliciesSelector';

interface EditListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount?: ConnectedAccount | null;
  listing: EbayListing | null;
  onListingUpdated: (listing: EbayListing) => void;
}

const DEFAULT_SPECIFICS: Record<string, string> = {
  'Brand': 'Livuniq®',
  'Type': 'Engagement Ring',
  'Main Stone': 'Diamond',
  'Main Stone Shape': 'Oval',
  'Total Carat Weight': '1 carat',
  'Main Stone Color': 'White',
  'Diamond Color Grade': 'F or higher',
  'Diamond Clarity Grade': 'VS1 or higher',
  'Cut Grade': 'Excellent',
  'Metal': 'Yellow Gold',
  'Metal Purity': '14k',
  'Base Metal': 'Gold',
  'Ring Size': '7',
  'Sizable': 'Yes',
  'Setting Style': 'Prong',
  'Material': '14k Solid Gold, Lab-Grown Diamond',
  'Main Stone Creation': 'Lab-Created',
  'Main Stone Treatment': 'Not Enhanced',
  'Gemstone Clarity Grade': 'Eye Clean',
  'Number of Diamonds': '1',
  'Secondary Stone': 'Diamond',
  'Colored Diamond Intensity': 'Very Light',
  'Certification': 'IGI',
  'MPN': '15410',
  'Features': 'Engraved, Nickel-Free, CVD Diamond',
  'Department': 'Women',
  'Handmade': 'Yes',
  'Signed': 'Yes',
  'Customized': 'Yes',
  'Bespoke': 'Yes',
  'Wholesale': 'Yes',
  'Era': 'Retro (1935-1950)',
  'Vintage': 'No',
  'Antique': 'No',
  'Collection': 'Engagement & Proposal Diamond Ring',
  'Theme': 'Beauty, Love & Angels',
  'Country of Origin': 'United States',
  'Materials sourced from': 'India',
  'Personalize': 'Yes',
  'Personalization Instructions':
    'Message us your desired size. We will customize it accordingly. Thank you for your cooperation.',
};

export default function EditListingModal({
  isOpen,
  onClose,
  activeAccount,
  listing,
  onListingUpdated,
}: EditListingModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'media' | 'specifics' | 'description'>('basic');

  // Form States
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sku, setSku] = useState('');
  const [sellerNotes, setSellerNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [description, setDescription] = useState('');
  const [specifics, setSpecifics] = useState<Record<string, string>>({});

  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [conditionId, setConditionId] = useState('1000');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Business Policies
  const [shippingPolicyId, setShippingPolicyId] = useState('');
  const [shippingPolicyName, setShippingPolicyName] = useState('');
  const [returnPolicyId, setReturnPolicyId] = useState('');
  const [returnPolicyName, setReturnPolicyName] = useState('');
  const [paymentPolicyId, setPaymentPolicyId] = useState('');
  const [paymentPolicyName, setPaymentPolicyName] = useState('');

  // Item Location
  const [locationCountry, setLocationCountry] = useState('US');
  const [locationPostalCode, setLocationPostalCode] = useState('');
  const [locationCityState, setLocationCityState] = useState('');

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPushingToEbay, setIsPushingToEbay] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');

  // Schedule States
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderReplaceInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listing) {
      setTitle(listing.title || '');
      setPrice(listing.price ? listing.price.toString() : '');
      setQuantity(listing.quantity ? listing.quantity.toString() : '1');
      setSku(listing.sku || '');
      setSellerNotes(listing.sellerNotes || 'New with packaging, original box & tag included.');
      setCategory(listing.category || EBAY_JEWELRY_CATEGORIES[0].path);
      setCategoryId(listing.categoryId || EBAY_JEWELRY_CATEGORIES[0].id);
      setConditionId(listing.conditionId || '1000');
      setIsCustomCategory(!EBAY_JEWELRY_CATEGORIES.some((c) => c.id === (listing.categoryId || '')));
      const rawImgs = listing.images && listing.images.length > 0 ? [...listing.images] : listing.imageUrl ? [listing.imageUrl] : [];
      const photoImgs = rawImgs.filter((u) => !isVideoMedia(u));
      const detectedVid = listing.videoUrl || rawImgs.find(isVideoMedia) || '';
      setImages(photoImgs);
      setVideoUrl(detectedVid);
      setVideoId(listing.videoId || '');
      setDescription(listing.description || '');
      setShippingPolicyId(listing.shippingPolicyId || activeAccount?.shippingPolicyId || '6269965000');
      setShippingPolicyName(listing.shippingPolicyName || activeAccount?.shippingPolicyName || '');
      setReturnPolicyId(listing.returnPolicyId || activeAccount?.returnPolicyId || '6269963000');
      setReturnPolicyName(listing.returnPolicyName || activeAccount?.returnPolicyName || '');
      setPaymentPolicyId(listing.paymentPolicyId || activeAccount?.paymentPolicyId || '6269966000');
      setPaymentPolicyName(listing.paymentPolicyName || activeAccount?.paymentPolicyName || '');
      setLocationCountry(listing.locationCountry || activeAccount?.locationCountry || 'US');
      setLocationPostalCode(listing.locationPostalCode || activeAccount?.locationPostalCode || '');
      setLocationCityState(listing.locationCityState || activeAccount?.locationCityState || '');

      const initialSpecs: Record<string, string> = { ...DEFAULT_SPECIFICS };
      if (listing.itemSpecifics) {
        for (const [k, v] of Object.entries(listing.itemSpecifics)) {
          if (isEbayItemSpecific(k) && v !== undefined && v !== null && String(v).trim()) {
            initialSpecs[k] = String(v).trim();
          }
        }
      }
      setSpecifics(initialSpecs);

      if (listing.scheduledTime) {
        try {
          const d = new Date(listing.scheduledTime);
          if (!isNaN(d.getTime())) {
            // Convert to local YYYY-MM-DDTHH:mm
            const pad = (n: number) => n.toString().padStart(2, '0');
            const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setScheduledTime(localStr);
            setIsScheduled(true);
          } else {
            setScheduledTime('');
            setIsScheduled(false);
          }
        } catch {
          setScheduledTime('');
          setIsScheduled(false);
        }
      } else {
        setScheduledTime('');
        setIsScheduled(false);
      }

      setErrorMessage('');
      setSuccessMessage('');
      setActiveTab('basic');
    }
  }, [listing]);

  if (!isOpen || !listing) return null;

  // Handle uploading photos from computer
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setErrorMessage('');
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.files) {
        const photoUrls = data.files.filter((f: any) => f.type !== 'video' && !isVideoMedia(f.url)).map((f: any) => f.url);
        const videoFiles = data.files.filter((f: any) => f.type === 'video' || isVideoMedia(f.url));
        if (photoUrls.length > 0) {
          setImages((prev) => [...prev, ...photoUrls]);
        }
        if (videoFiles.length > 0) {
          setVideoUrl(videoFiles[0].url);
          if (videoFiles[0].videoId) setVideoId(videoFiles[0].videoId);
        }
      } else {
        setErrorMessage(data.error || 'Failed to upload photos');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle folder upload to completely remove all old photos and replace with new ones
  const handleFolderReplacePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setErrorMessage('');
    try {
      const sortedFiles = Array.from(files)
        .filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      if (sortedFiles.length === 0) {
        setErrorMessage('Selected folder me koi valid photo nahi mili.');
        return;
      }

      const newUrls: string[] = [];

      for (const file of sortedFiles) {
        let fileUrl = '';
        try {
          const formData = new FormData();
          formData.append('files', file);
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.files && data.files[0]) {
              fileUrl = data.files[0].url;
            }
          }
        } catch {
          // fallback
        }

        if (!fileUrl) {
          fileUrl = URL.createObjectURL(file);
        }
        newUrls.push(fileUrl);
      }

      if (newUrls.length > 0) {
        // Remove old images completely and replace with new images from folder!
        const oldImgs = [...images];
        setImages(newUrls);
        setDescription((prev) => updateDescriptionImages(prev, newUrls, oldImgs));
        setSuccessMessage(`All old images removed! Replaced with ${newUrls.length} photos from folder, and HTML description updated.`);
      }
    } catch (err: any) {
      setErrorMessage((err as Error).message);
    } finally {
      setUploadingFiles(false);
      if (folderReplaceInputRef.current) folderReplaceInputRef.current.value = '';
    }
  };

  // Handle uploading video from computer
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setErrorMessage('');
    try {
      const formData = new FormData();
      formData.append('files', files[0]);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.files && data.files[0]) {
        setVideoUrl(data.files[0].url);
        if (data.files[0].videoId) setVideoId(data.files[0].videoId);
      } else {
        setErrorMessage(data.error || 'Failed to upload video');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setUploadingFiles(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleAddUrlPhoto = () => {
    if (imageUrlInput.trim()) {
      const url = imageUrlInput.trim();
      if (isVideoMedia(url)) {
        setVideoUrl(url);
      } else {
        setImages((prev) => [...prev, url]);
      }
      setImageUrlInput('');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateSpecific = (key: string, value: string) => {
    setSpecifics((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddCustomSpecific = () => {
    if (customKey.trim() && customVal.trim()) {
      setSpecifics((prev) => ({ ...prev, [customKey.trim()]: customVal.trim() }));
      setCustomKey('');
      setCustomVal('');
    }
  };

  // Save changes locally or push to eBay
  const handleSave = async (pushToEbay: boolean) => {
    if (!title.trim()) {
      setErrorMessage('Listing Title cannot be empty');
      return;
    }

    if (pushToEbay) {
      setIsPushingToEbay(true);
    } else {
      setIsSubmitting(true);
    }
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const cleanSpecifics: Record<string, string> = {};
      for (const [k, v] of Object.entries(specifics)) {
        if (isEbayItemSpecific(k) && v !== undefined && v !== null && String(v).trim()) {
          cleanSpecifics[k] = String(v).trim();
        }
      }

      const res = await fetch('/api/ebay/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: listing.id,
          title: title.trim(),
          price: parseFloat(price),
          quantity: parseInt(quantity) || 0,
          sku: sku.trim(),
          images,
          videoUrl,
          videoId,
          description,
          itemSpecifics: cleanSpecifics,
          conditionDescription: sellerNotes,
          categoryId,
          category,
          conditionId,
          shippingPolicyId,
          shippingPolicyName,
          returnPolicyId,
          returnPolicyName,
          paymentPolicyId,
          paymentPolicyName,
          locationCountry: locationCountry.trim().toUpperCase() || activeAccount?.locationCountry || 'US',
          locationPostalCode: locationPostalCode.trim() || activeAccount?.locationPostalCode || '',
          locationCityState: locationCityState.trim() || activeAccount?.locationCityState || '',
          scheduledTime: isScheduled && scheduledTime ? new Date(scheduledTime).toISOString() : null,
          pushToEbay,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (pushToEbay) {
          if (data.ebayLiveStatus === 'LIVE_UPDATED') {
            setSuccessMessage('Successfully published & updated live on eBay Store!');
          } else if (data.ebayLiveStatus === 'LIVE_FAILED') {
            setErrorMessage(`eBay API Notice: ${data.ebayMessage}`);
          } else {
            setSuccessMessage('Listing details updated on eBay!');
          }
        } else {
          setSuccessMessage('Changes saved locally in dashboard! (eBay live listing was NOT modified).');
        }

        onListingUpdated(data.listing);
        setTimeout(() => {
          if (data.ebayLiveStatus !== 'LIVE_FAILED') {
            onClose();
          }
        }, 1800);
      } else {
        setErrorMessage(data.error || 'Failed to update listing');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
      setIsPushingToEbay(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Edit Live eBay Listing</h2>
              {listing.ebayListingId && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 text-blue-700">
                  Item #{listing.ebayListingId}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Live Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Save locally anytime, or click <strong>Update to eBay Store</strong> to push changes live to eBay.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'basic'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>1. Pricing & Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'media'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>2. Photos & Video ({images.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('specifics')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'specifics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>3. Item Specifics ({Object.keys(specifics).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'description'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>4. Description</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1 */}
          {activeTab === 'basic' && (
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-800">Listing Title *</label>
                  <span
                    className={`font-mono text-[11px] ${
                      title.length > 80 ? 'text-rose-600 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {title.length}/80 chars (eBay limit)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Price (USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.99"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Available Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Custom Label / SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Category Dropdown from File Exchange */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-800">
                    eBay Category <span className="text-slate-400 font-normal">(File Exchange Standards)</span>
                  </label>
                  <span className="font-mono text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
                    Category ID: {categoryId}
                  </span>
                </div>

                <select
                  value={isCustomCategory ? 'custom' : categoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsCustomCategory(true);
                    } else {
                      setIsCustomCategory(false);
                      const selected = EBAY_JEWELRY_CATEGORIES.find((c) => c.id === val);
                      if (selected) {
                        setCategoryId(selected.id);
                        setCategory(selected.path);
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 cursor-pointer"
                >
                  {EBAY_JEWELRY_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.path} (ID: {cat.id})
                    </option>
                  ))}
                  <option value="custom">+ Other / Custom Category...</option>
                </select>

                {isCustomCategory && (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. /Jewelry & Watches/Fine Jewelry/Rings"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      placeholder="Cat ID"
                      className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-center"
                    />
                  </div>
                )}
              </div>

              {/* Condition & Seller Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Condition <span className="text-slate-400 font-normal">(File Exchange Code)</span>
                  </label>
                  <select
                    value={conditionId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConditionId(val);
                      const opt = EBAY_FILE_EXCHANGE_CONDITIONS.find((c) => c.id === val);
                      if (opt && (!sellerNotes || sellerNotes.startsWith('New') || sellerNotes.startsWith('Pre-owned'))) {
                        setSellerNotes(opt.label);
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {EBAY_FILE_EXCHANGE_CONDITIONS.map((cond) => (
                      <option key={cond.id} value={cond.id}>
                        {cond.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Seller Notes / Condition Details</label>
                  <input
                    type="text"
                    value={sellerNotes}
                    onChange={(e) => setSellerNotes(e.target.value)}
                    placeholder="e.g. New with packaging, includes original box & tags"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Publishing & Schedule Settings */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                      <Clock className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">
                        Publishing & Go-Live Schedule
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Set a specific date & time for this listing to go live on eBay, or keep it as a manual draft.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => {
                          setIsScheduled(e.target.checked);
                          if (e.target.checked && !scheduledTime) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            tomorrow.setHours(18, 0, 0, 0);
                            const pad = (n: number) => n.toString().padStart(2, '0');
                            setScheduledTime(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T18:00`);
                          }
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className={isScheduled ? 'text-purple-700 font-bold' : 'text-slate-600'}>
                        Schedule Go-Live
                      </span>
                    </label>
                  </div>
                </div>

                {isScheduled && (
                  <div className="bg-white border border-purple-200 rounded-lg p-3 space-y-2 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                        Scheduled Date & Time (Local):
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                      />
                    </div>
                    {scheduledTime && (
                      <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded flex items-center justify-between">
                        <span>
                          Will go live on: <strong>{new Date(scheduledTime).toLocaleString()}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsScheduled(false);
                            setScheduledTime('');
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold text-[10px] underline cursor-pointer"
                        >
                          Remove Schedule
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Business Policies (Shipping, Return, Payment) */}
              <BusinessPoliciesSelector
                accountId={activeAccount?.id}
                shippingPolicyId={shippingPolicyId}
                setShippingPolicyId={setShippingPolicyId}
                shippingPolicyName={shippingPolicyName}
                setShippingPolicyName={setShippingPolicyName}
                returnPolicyId={returnPolicyId}
                setReturnPolicyId={setReturnPolicyId}
                returnPolicyName={returnPolicyName}
                setReturnPolicyName={setReturnPolicyName}
                paymentPolicyId={paymentPolicyId}
                setPaymentPolicyId={setPaymentPolicyId}
                paymentPolicyName={paymentPolicyName}
                setPaymentPolicyName={setPaymentPolicyName}
              />

              {/* Item Location & Shipping Origin */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Item Location (eBay Trading API)</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">Origin sent to eBay for buyer shipping calculations</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Country Code</label>
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e) => setLocationCountry(e.target.value.toUpperCase())}
                      placeholder="US, IN, GB"
                      maxLength={3}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Postal / Zip Code</label>
                    <input
                      type="text"
                      value={locationPostalCode}
                      onChange={(e) => setLocationPostalCode(e.target.value)}
                      placeholder="e.g. 16701 or 395006"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">City, State / Region</label>
                    <input
                      type="text"
                      value={locationCityState}
                      onChange={(e) => setLocationCityState(e.target.value)}
                      placeholder="e.g. Bradford, PA or Surat"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PHOTOS & VIDEO */}
          {activeTab === 'media' && (
            <div className="space-y-6 text-xs">
              {/* Photo Upload from Computer */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>Upload Photos from Computer</span>
                    </h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Select photos from your computer to add to this listing.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <input
                      type="file"
                      ref={folderReplaceInputRef}
                      onChange={handleFolderReplacePhotos}
                      // @ts-ignore
                      webkitdirectory="true"
                      directory=""
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingFiles}
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition border border-slate-300 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Add Photos</span>
                    </button>

                    <button
                      type="button"
                      disabled={uploadingFiles}
                      onClick={() => folderReplaceInputRef.current?.click()}
                      className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                      title="Select photo folder to remove all old images and replace with new images"
                    >
                      {uploadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />}
                      <span>Replace All with Folder</span>
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/80 flex gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddUrlPhoto}
                    disabled={!imageUrlInput.trim()}
                    className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>
              </div>

              {/* Photos Grid */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-800">
                    Listing Photos ({images.length}/12 on eBay)
                  </span>
                  <span className="text-[11px] text-slate-500">First image is main cover photo</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-blue-600 text-white text-[9px] font-bold text-center py-0.5 shadow-xs">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        title="Remove photo"
                        className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full opacity-85 hover:opacity-100 transition shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Upload from Computer */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-purple-600" />
                      <span>Product Video (.MP4, .MOV)</span>
                    </h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Upload diamond video directly from your computer.
                    </p>
                    <div className="text-[10px] text-emerald-700 font-medium mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                      <span>⚡ Auto-Optimization Enabled:</span> 4K/3K phone videos are automatically converted to 1080p MP4 for eBay!
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={videoInputRef}
                      onChange={handleVideoUpload}
                      accept="video/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingFiles}
                      onClick={() => videoInputRef.current?.click()}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Video className="w-4 h-4" />
                      <span>{uploadingFiles ? 'Auto-Optimizing for eBay (1080p)...' : 'Upload Video'}</span>
                    </button>
                  </div>
                </div>

                {videoUrl && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col items-center">
                    <video src={videoUrl} controls className="max-h-48 rounded-lg shadow-xs border border-slate-300" />
                    {videoId && (
                      <span className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                        ✓ Connected to eBay Media ID: {videoId}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setVideoUrl('');
                        setVideoId('');
                      }}
                      className="mt-2 text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove Video
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ITEM SPECIFICS */}
          {activeTab === 'specifics' && (
            <div className="space-y-6 text-xs">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-blue-900">
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="font-semibold">
                    eBay Item Specifics ({Object.keys(specifics).length} attributes)
                  </span>
                </div>
              </div>

              {/* Group 1 */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2.5 pb-1 border-b border-slate-200 text-xs uppercase tracking-wider text-blue-700">
                  💎 Diamond & Gemstone Specifics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    'Main Stone',
                    'Main Stone Shape',
                    'Total Carat Weight',
                    'Main Stone Color',
                    'Diamond Color Grade',
                    'Diamond Clarity Grade',
                    'Cut Grade',
                    'Main Stone Creation',
                    'Main Stone Treatment',
                    'Colored Diamond Intensity',
                    'Gemstone Clarity Grade',
                    'Number of Diamonds',
                    'Secondary Stone',
                  ].map((field) => (
                    <div key={field}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">{field}</label>
                      <input
                        type="text"
                        value={specifics[field] || ''}
                        onChange={(e) => updateSpecific(field, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2 */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2.5 pb-1 border-b border-slate-200 text-xs uppercase tracking-wider text-amber-700">
                  💍 Metal & Ring Sizing
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    'Metal',
                    'Metal Purity',
                    'Base Metal',
                    'Ring Size',
                    'Sizable',
                    'Setting Style',
                    'Material',
                  ].map((field) => (
                    <div key={field}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">{field}</label>
                      <input
                        type="text"
                        value={specifics[field] || ''}
                        onChange={(e) => updateSpecific(field, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 3 */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2.5 pb-1 border-b border-slate-200 text-xs uppercase tracking-wider text-emerald-700">
                  🏷️ Brand, Certification & Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    'Brand',
                    'Certification',
                    'MPN',
                    'Features',
                    'Department',
                    'Collection',
                    'Handmade',
                    'Signed',
                    'Era',
                    'Vintage',
                    'Antique',
                    'Country of Origin',
                    'Materials sourced from',
                    'Theme',
                  ].map((field) => (
                    <div key={field}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">{field}</label>
                      <input
                        type="text"
                        value={specifics[field] || ''}
                        onChange={(e) => updateSpecific(field, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 4: Personalization */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2.5 pb-1 border-b border-slate-200 text-xs uppercase tracking-wider text-purple-700">
                  ✍️ Personalization Instructions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Personalize</label>
                    <select
                      value={specifics['Personalize'] || 'Yes'}
                      onChange={(e) => updateSpecific('Personalize', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Personalization Instructions
                    </label>
                    <input
                      type="text"
                      value={specifics['Personalization Instructions'] || ''}
                      onChange={(e) => updateSpecific('Personalization Instructions', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Add Custom Specific */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-2">➕ Add Custom Specific Attribute</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Specific Name (e.g. Occasion)"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Anniversary)"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSpecific}
                    disabled={!customKey.trim() || !customVal.trim()}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESCRIPTION & DYNAMIC HTML TEMPLATE */}
          {activeTab === 'description' && (
            <HtmlTemplateSection
              value={description}
              onChange={setDescription}
              listingData={{
                title,
                price,
                currency: activeAccount?.currency || 'USD',
                sku,
                quantity,
                condition: listing?.condition || 'New',
                conditionDescription: sellerNotes,
                category: listing?.category || 'Jewelry',
                images,
                itemSpecifics: specifics,
                storeName: activeAccount?.storeName || 'Livuniq Fine Jewelry',
              }}
            />
          )}

          {/* Status Messages */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span>eBay ID: <strong className="text-slate-800">{listing.ebayListingId}</strong></span>
              {listing.hasUnpublishedChanges && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Unpublished Local Draft
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>

              {/* Button 1: Save Locally (Draft - does not touch eBay) */}
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSubmitting || isPushingToEbay || title.length === 0}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                title="Saves in dashboard database only. Does NOT update eBay."
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    <span>Saving Draft...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-slate-600" />
                    <span>Save Locally (Draft)</span>
                  </>
                )}
              </button>

              {/* Button 2: Update to eBay Store (Live update) */}
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSubmitting || isPushingToEbay || title.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition shadow-sm cursor-pointer"
                title="Updates and publishes changes live on eBay marketplace."
              >
                {isPushingToEbay ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating eBay Store...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Update to eBay Store</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
