'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  MapPin,
} from 'lucide-react';
import { ConnectedAccount, EbayListing } from '@/lib/ebay/types';
import { EBAY_JEWELRY_CATEGORIES, EBAY_FILE_EXCHANGE_CONDITIONS } from '@/lib/ebay/constants';
import { isVideoMedia } from '@/lib/ebay/template-engine';
import HtmlTemplateSection from './HtmlTemplateSection';
import BusinessPoliciesSelector from './BusinessPoliciesSelector';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount?: ConnectedAccount | null;
  onListingCreated: (listing: EbayListing) => void;
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

export default function CreateListingModal({
  isOpen,
  onClose,
  activeAccount,
  onListingCreated,
}: CreateListingModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'media' | 'specifics' | 'description'>('basic');

  // Basic Info
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('450.00');
  const [quantity, setQuantity] = useState('1');
  const [sku, setSku] = useState('PS09109RL_14-S-Y');
  const [conditionId, setConditionId] = useState('1000');
  const [sellerNotes, setSellerNotes] = useState('New with original packaging & tag');
  const [category, setCategory] = useState(EBAY_JEWELRY_CATEGORIES[0].path);
  const [categoryId, setCategoryId] = useState(EBAY_JEWELRY_CATEGORIES[0].id);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Business Policies
  const [shippingPolicyId, setShippingPolicyId] = useState(activeAccount?.shippingPolicyId || '6269965000');
  const [shippingPolicyName, setShippingPolicyName] = useState(activeAccount?.shippingPolicyName || '');
  const [returnPolicyId, setReturnPolicyId] = useState(activeAccount?.returnPolicyId || '6269963000');
  const [returnPolicyName, setReturnPolicyName] = useState(activeAccount?.returnPolicyName || '');
  const [paymentPolicyId, setPaymentPolicyId] = useState(activeAccount?.paymentPolicyId || '6269966000');
  const [paymentPolicyName, setPaymentPolicyName] = useState(activeAccount?.paymentPolicyName || '');

  // Item Location
  const [locationCountry, setLocationCountry] = useState(activeAccount?.locationCountry || 'US');
  const [locationPostalCode, setLocationPostalCode] = useState(activeAccount?.locationPostalCode || '');
  const [locationCityState, setLocationCityState] = useState(activeAccount?.locationCityState || '');

  useEffect(() => {
    if (activeAccount) {
      if (activeAccount.locationCountry) setLocationCountry(activeAccount.locationCountry);
      if (activeAccount.locationPostalCode) setLocationPostalCode(activeAccount.locationPostalCode);
      if (activeAccount.locationCityState) setLocationCityState(activeAccount.locationCityState);
    }
  }, [activeAccount]);

  // Media
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Specifics
  const [specifics, setSpecifics] = useState<Record<string, string>>({ ...DEFAULT_SPECIFICS });
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');

  // Description
  const [description, setDescription] = useState(
    `<div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6;">
  <h2 style="color: #631726; border-bottom: 2px solid #c5a880; padding-bottom: 8px;">Product Overview</h2>
  <p>Exquisite certified lab-grown diamond engagement ring crafted in genuine solid 14k gold. Each piece is meticulously hand-finished for unmatched brilliance and quality.</p>
  <h3 style="color: #440f1a;">Key Highlights:</h3>
  <ul>
    <li>IGI Certified Center Stone</li>
    <li>Authentic 14k Solid Gold</li>
    <li>Free Insured Express Worldwide Delivery</li>
    <li>60-Day Hassle-Free Returns</li>
  </ul>
</div>`
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishingLive, setIsPublishingLive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

      const resText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        if (res.status === 413 || resText.includes('Request Entity Too Large') || resText.includes('Payload Too Large')) {
          throw new Error('Listing payload size server limit se badi hai (Request Entity Too Large). Photos/Description size is too large.');
        }
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 100)}`);
      }
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

  // Handle uploading video from computer
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const localBlobUrl = URL.createObjectURL(file);
      setVideoUrl(localBlobUrl);
    } catch {
      // ignore
    }

    setUploadingFiles(true);
    setErrorMessage('');
    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const resText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        if (res.status === 413 || resText.includes('Request Entity Too Large') || resText.includes('Payload Too Large')) {
          setErrorMessage('Video size live server limit (4.5MB on Vercel) se badi hai. Dashboard me local preview ready hai! Live server ke liye please video ko localhost:3000 par upload karein (jahan 150MB support hai) ya niche direct Video URL / eBay Media ID paste karein.');
          return;
        }
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 100)}`);
      }

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

  // Add photo via URL
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

  // Remove photo
  const handleRemovePhoto = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update specific
  const updateSpecific = (key: string, value: string) => {
    setSpecifics((prev) => ({ ...prev, [key]: value }));
  };

  // Add custom specific
  const handleAddCustomSpecific = () => {
    if (customKey.trim() && customVal.trim()) {
      setSpecifics((prev) => ({ ...prev, [customKey.trim()]: customVal.trim() }));
      setCustomKey('');
      setCustomVal('');
    }
  };

  // Remove specific
  const handleRemoveSpecific = (key: string) => {
    setSpecifics((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Submit Listing to eBay or Save as Draft
  const handleSubmit = async (publishToEbay = false) => {
    if (!title.trim()) {
      setErrorMessage('Listing Title is required');
      setActiveTab('basic');
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      setErrorMessage('Valid Price is required');
      setActiveTab('basic');
      return;
    }

    if (publishToEbay) {
      setIsPublishingLive(true);
    } else {
      setIsSubmitting(true);
    }
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/ebay/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccount?.id,
          title: title.trim(),
          price: parseFloat(price) || 0,
          quantity: isNaN(parseInt(quantity)) ? 1 : parseInt(quantity),
          sku: sku.trim(),
          categoryId,
          category,
          conditionId,
          sellerNotes,
          images,
          videoUrl,
          videoId,
          description,
          itemSpecifics: specifics,
          shippingPolicyId,
          shippingPolicyName,
          returnPolicyId,
          returnPolicyName,
          paymentPolicyId,
          paymentPolicyName,
          locationCountry: locationCountry.trim().toUpperCase() || activeAccount?.locationCountry || 'US',
          locationPostalCode: locationPostalCode.trim() || activeAccount?.locationPostalCode || '',
          locationCityState: locationCityState.trim() || activeAccount?.locationCityState || '',
          publishToEbay,
        }),
      });

      const resText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        if (res.status === 413 || resText.includes('Request Entity Too Large') || resText.includes('Payload Too Large')) {
          throw new Error('Listing payload size server limit se badi hai (Request Entity Too Large). Photos/Description size is too large.');
        }
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 100)}`);
      }
      if (data.success) {
        if (publishToEbay) {
          if (data.ebayLiveStatus === 'LIVE_CREATED') {
            setSuccessMessage(`Success! Published live to eBay! ${data.ebayMessage}`);
          } else if (data.ebayLiveStatus === 'LIVE_FAILED') {
            setErrorMessage(`Saved locally, but eBay API notice: ${data.ebayMessage}`);
          } else {
            setSuccessMessage('Listing created and published successfully!');
          }
        } else {
          setSuccessMessage('Listing saved as Draft in dashboard! (Not published to eBay yet).');
        }

        onListingCreated(data.listing);
        setTimeout(() => {
          if (data.ebayLiveStatus !== 'LIVE_FAILED') {
            onClose();
          }
        }, 2000);
      } else {
        setErrorMessage(data.error || 'Failed to create listing');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
      setIsPublishingLive(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">Create & Publish eBay Listing</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Target Store: <strong className="text-slate-800">{activeAccount?.storeName || activeAccount?.ebayUsername}</strong> ({activeAccount?.marketplace || 'EBAY_US'})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
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
            <span>1. Basic & Pricing</span>
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

        {/* Form Body */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: BASIC & PRICING */}
          {activeTab === 'basic' && (
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-800">
                    Listing Title * <span className="text-slate-400 font-normal">(eBay Marketplace Title)</span>
                  </label>
                  <span
                    className={`font-mono text-[11px] ${
                      title.length > 80 ? 'text-rose-600 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {title.length}/80 chars
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 1 ct Oval Cut IGI Certified Lab Grown Diamond Engagement Ring 14k Yellow Gold"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Price ({activeAccount?.currency || 'USD'}) *</label>
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
                    min="1"
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
                    placeholder="e.g. PS09109RL_14-S-Y"
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

              {/* Condition & Seller Notes from File Exchange */}
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
                  <span className="text-[10px] text-slate-500">Auto-filled from connected store settings</span>
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
                      Directly choose multiple images (JPG, PNG, WEBP) from your disk. Up to 12 photos for eBay.
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
                    <button
                      type="button"
                      disabled={uploadingFiles}
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                    >
                      {uploadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>Choose Photos</span>
                    </button>
                  </div>
                </div>

                {/* Paste URL alternative */}
                <div className="mt-3 pt-3 border-t border-slate-200/80 flex gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddUrlPhoto}
                    disabled={!imageUrlInput.trim()}
                    className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>
              </div>

              {/* Photo Thumbnails */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-800">
                    Product Gallery ({images.length}/12 photos)
                  </span>
                  <span className="text-[11px] text-slate-500">First image is the main Cover Photo</span>
                </div>

                {images.length === 0 ? (
                  <div className="text-center py-8 border border-slate-200 rounded-xl bg-slate-50 text-slate-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1.5 opacity-50" />
                    <p>No photos added yet. Upload from computer or paste a URL above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-blue-400 transition"
                      >
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-blue-600 text-white text-[9px] font-bold text-center py-0.5 shadow-xs">
                            Cover Photo
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
                )}
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
                      Showcase diamond sparkle & 360° ring rotation with video.
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
                      <span>{uploadingFiles ? 'Auto-Optimizing for eBay (1080p)...' : 'Upload Video from Computer'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Video URL or eBay Media ID Inputs */}
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                    <span>Or Provide Direct Video Link / eBay Media ID:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        Video URL (Direct .MP4 / Web Link):
                      </label>
                      <input
                        type="url"
                        value={videoUrl.startsWith('blob:') ? '' : videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value.trim())}
                        placeholder="https://example.com/diamond-video.mp4"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        eBay Media ID (Connected on eBay):
                      </label>
                      <input
                        type="text"
                        value={videoId}
                        onChange={(e) => setVideoId(e.target.value.trim())}
                        placeholder="e.g. 50012345678"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>

                {(videoUrl || videoId) && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col items-center">
                    {videoUrl ? (
                      <video src={videoUrl} controls className="max-h-48 rounded-lg shadow-xs border border-slate-300" />
                    ) : (
                      <div className="flex items-center space-x-2 bg-purple-50 text-purple-900 px-4 py-3 rounded-lg border border-purple-200">
                        <Video className="w-5 h-5 text-purple-600" />
                        <div>
                          <div className="font-bold text-xs">Video Connected on eBay</div>
                          <div className="text-[10px] text-purple-700">Media ID: {videoId}</div>
                        </div>
                      </div>
                    )}
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

          {/* TAB 3: ITEM SPECIFICS (42+ Options matching user screenshot) */}
          {activeTab === 'specifics' && (
            <div className="space-y-6 text-xs">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-blue-900">
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="font-semibold">
                    eBay Item Specifics are pre-configured with <strong>Diamonds by Livuniq</strong> jewelry standards.
                  </span>
                </div>
                <span className="text-[11px] font-mono text-blue-700">42 Attributes</span>
              </div>

              {/* Group 1: Diamond & Gemstone */}
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
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2: Metal & Ring Structure */}
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
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 3: Brand, Certification & Details */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2.5 pb-1 border-b border-slate-200 text-xs uppercase tracking-wider text-emerald-700">
                  🏷️ Brand, Certification & Identification
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
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 4: Personalization */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2.5 pb-1 border-b border-slate-200 text-xs uppercase tracking-wider text-purple-700">
                  ✍️ Personalization & Ring Resizing Instructions
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
                condition: conditionId === '1000' ? 'New' : 'New with Tag',
                conditionDescription: sellerNotes,
                category,
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
            <span className="text-[11px] text-slate-500">
              Active shipping policy: <strong>FedEx Express Free</strong>.
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>

              {/* Button 1: Save as Draft (Local only) */}
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || isPublishingLive || title.length === 0}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                title="Saves in dashboard database only. Does NOT publish to eBay."
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    <span>Saving Draft...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-slate-600" />
                    <span>Save as Draft</span>
                  </>
                )}
              </button>

              {/* Button 2: Publish Live to eBay */}
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting || isPublishingLive || title.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition shadow-sm cursor-pointer"
                title="Uploads listing live to eBay Marketplace via AddFixedPriceItem."
              >
                {isPublishingLive ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing to eBay...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Publish Live to eBay</span>
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
