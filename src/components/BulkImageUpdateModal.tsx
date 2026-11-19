'use client';

import React, { useState, useRef } from 'react';
import {
  Camera,
  FolderUp,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowRight,
  UploadCloud,
  Check,
  Search,
  Eye,
  Info,
  Video,
  Globe,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { EbayListing, ConnectedAccount } from '@/lib/ebay/types';
import { updateDescriptionImages, deduplicateImageUrls } from '@/lib/ebay/template-engine';

interface BulkImageUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount?: ConnectedAccount;
  listings: EbayListing[];
  onImagesUpdated: (updatedListings: EbayListing[]) => void;
}

interface SkuImageGroup {
  sku: string;
  folderName: string;
  matchedListing: EbayListing | null;
  files: Array<{
    name: string;
    url: string;
    size?: number;
  }>;
  videoUrl?: string;
  videoId?: string;
  selected: boolean;
}

// Client-side image optimizer to keep uploads lightweight (max 1200px, JPEG 0.8) and prevent HTTP 413 Payload Too Large
async function optimizeImageForUpload(file: File, maxDim = 1200, quality = 0.8): Promise<File> {
  // If file is already small (e.g. <= 150KB), return as is
  if (file.size <= 150 * 1024) return file;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
            } else {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(file);
      };
      img.src = objUrl;
    } catch {
      resolve(file);
    }
  });
}

export default function BulkImageUpdateModal({
  isOpen,
  onClose,
  activeAccount,
  listings,
  onImagesUpdated,
}: BulkImageUpdateModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Folder Selection, 2: Preview & Match, 3: Success
  const [sourceMode, setSourceMode] = useState<'local' | 'gdrive'>('local');
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [gdriveApiKey, setGdriveApiKey] = useState('');
  const [gdriveRawList, setGdriveRawList] = useState('');
  const [scanningGdrive, setScanningGdrive] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [skuGroups, setSkuGroups] = useState<SkuImageGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pushLiveToEbay, setPushLiveToEbay] = useState(true);
  const [updateHtmlDescription, setUpdateHtmlDescription] = useState(true);
  const [applyingUpdates, setApplyingUpdates] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState({ current: 0, total: 0, sku: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [updateResults, setUpdateResults] = useState<any[]>([]);
  const [selectedPreviewListing, setSelectedPreviewListing] = useState<SkuImageGroup | null>(null);
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    fetch('/api/ebay/bulk/scan-gdrive')
      .then((r) => r.json())
      .then((data) => {
        if (data.hasApiKey) {
          setHasStoredApiKey(true);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Natural filename sorting (e.g., 1.jpg, 2.jpg, 10.jpg)
  const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Handle Folder Selection
  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setScanning(true);
    setErrorMsg('');
    setScanProgress({ current: 0, total: files.length });

    try {
      const rawGroups: Record<
        string,
        {
          folderName: string;
          files: Array<{ file: File; relPath: string }>;
          videoFile?: { file: File; relPath: string };
        }
      > = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setScanProgress({ current: i + 1, total: files.length });

        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(file.name);
        const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif)$/i.test(file.name);
        if (!isImage && !isVideo) continue;

        const relPath = (file as any).webkitRelativePath || file.name;
        const normalized = relPath.replace(/\\/g, '/');
        const parts = normalized.split('/');

        let folderSku = '';
        if (parts.length > 2) {
          // e.g. "Photos/SLR03042/1.jpg" -> "SLR03042"
          folderSku = parts[parts.length - 2].trim();
        } else if (parts.length === 2) {
          // e.g. "SLR03042/1.jpg" -> "SLR03042"
          folderSku = parts[0].trim();
        } else {
          // e.g. "SLR03042_1.jpg" -> extract prefix before delimiter
          const match = file.name.match(/^([A-Za-z0-9_-]+?)[\s_-]/);
          folderSku = match ? match[1].trim() : file.name.split('.')[0].trim();
        }

        if (!folderSku) continue;

        const groupKey = folderSku.toLowerCase();
        if (!rawGroups[groupKey]) {
          rawGroups[groupKey] = {
            folderName: folderSku,
            files: [],
          };
        }

        if (isVideo) {
          if (!rawGroups[groupKey].videoFile) {
            rawGroups[groupKey].videoFile = { file, relPath };
          }
        } else {
          // Deduplicate within the group by filename
          const fileBaseName = file.name.toLowerCase();
          const alreadyHasFile = rawGroups[groupKey].files.some((f) => f.file.name.toLowerCase() === fileBaseName);
          if (!alreadyHasFile) {
            rawGroups[groupKey].files.push({ file, relPath });
          }
        }
      }

      const detectedKeys = Object.keys(rawGroups);
      if (detectedKeys.length === 0) {
        setErrorMsg('Selected folder me koi valid photo files nahi mili.');
        setScanning(false);
        return;
      }

      // Process and upload/stage the image files
      const builtGroups: SkuImageGroup[] = [];

      for (const key of detectedKeys) {
        const item = rawGroups[key];
        // Sort files naturally by filename
        item.files.sort((a, b) => naturalSort(a.file.name, b.file.name));

        const stagedFiles: Array<{ name: string; url: string; size?: number }> = [];

        for (const fItem of item.files) {
          const rawFile = fItem.file;
          // Auto optimize photo to <= 1600px crisp JPEG to keep upload fast & lightweight
          const file = await optimizeImageForUpload(rawFile);
          let fileUrl = '';

          // Attempt fast server upload with accountId for direct eBay EPS integration
          try {
            const formData = new FormData();
            formData.append('files', file);
            formData.append('relativePaths', fItem.relPath);
            if (activeAccount?.id) {
              formData.append('accountId', activeAccount.id);
            }

            const res = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.success && data.files && data.files.length > 0) {
                fileUrl = data.files[0].url;
              }
            }
          } catch {
            // Ignore upload failure on large payload
          }

          // Fallback to local Object URL
          if (!fileUrl) {
            fileUrl = URL.createObjectURL(file);
          }

          stagedFiles.push({
            name: file.name,
            url: fileUrl,
            size: file.size,
          });
        }

        // Match with listings in current store
        const cleanSku = item.folderName.trim().toLowerCase();
        const alphaNumSku = cleanSku.replace(/[^a-z0-9]/g, '');

        const matched = listings.find((l) => {
          const lSku = (l.sku || '').trim().toLowerCase();
          const lAlphaNum = lSku.replace(/[^a-z0-9]/g, '');
          return lSku === cleanSku || (alphaNumSku.length >= 3 && lAlphaNum === alphaNumSku);
        }) || null;

        let groupVideoUrl: string | undefined = undefined;
        let groupVideoId: string | undefined = undefined;
        if (item.videoFile) {
          try {
            const vidFormData = new FormData();
            vidFormData.append('files', item.videoFile.file);
            vidFormData.append('relativePaths', item.videoFile.relPath);
            if (activeAccount?.id) {
              vidFormData.append('accountId', activeAccount.id);
            }
            const vRes = await fetch('/api/upload', {
              method: 'POST',
              body: vidFormData,
            });
            if (vRes.ok) {
              const vData = await vRes.json();
              if (vData.success && vData.files && vData.files.length > 0) {
                groupVideoUrl = vData.files[0].url;
                groupVideoId = vData.files[0].videoId;
              }
            }
          } catch {
            // ignore
          }
        }

        builtGroups.push({
          sku: matched ? matched.sku : item.folderName,
          folderName: item.folderName,
          matchedListing: matched,
          files: stagedFiles,
          videoUrl: groupVideoUrl,
          videoId: groupVideoId,
          selected: Boolean(matched),
        });
      }

      // Sort: Matched listings first
      builtGroups.sort((a, b) => {
        if (a.matchedListing && !b.matchedListing) return -1;
        if (!a.matchedListing && b.matchedListing) return 1;
        return a.folderName.localeCompare(b.folderName);
      });

      setSkuGroups(builtGroups);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(`Error processing folder: ${err.message}`);
    } finally {
      setScanning(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Handle Google Drive Scan
  const handleScanGoogleDrive = async () => {
    if (!gdriveUrl.trim() && !gdriveRawList.trim()) {
      setErrorMsg('Kripya Google Drive folder link ya direct Drive links paste karein.');
      return;
    }

    setScanningGdrive(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/ebay/bulk/scan-gdrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveUrl: gdriveUrl.trim(),
          apiKey: gdriveApiKey.trim(),
          rawList: gdriveRawList.trim(),
          accountId: activeAccount?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.needsApiKey) {
          setShowApiKeyInput(true);
        }
        throw new Error(data.error || 'Google Drive scan failed');
      }

      const builtGroups: SkuImageGroup[] = (data.groups || []).map((g: any) => ({
        sku: g.sku,
        folderName: g.folderName,
        matchedListing: g.matchedListing,
        files: (g.images || []).map((imgUrl: string, idx: number) => ({
          name: `${g.sku}_img_${idx + 1}.jpg`,
          url: imgUrl,
        })),
        videoUrl: g.videoUrl,
        videoId: g.videoId,
        selected: Boolean(g.matchedListing),
      }));

      // Sort: Matched listings first
      builtGroups.sort((a, b) => {
        if (a.matchedListing && !b.matchedListing) return -1;
        if (!a.matchedListing && b.matchedListing) return 1;
        return a.folderName.localeCompare(b.folderName);
      });

      setSkuGroups(builtGroups);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error scanning Google Drive');
    } finally {
      setScanningGdrive(false);
    }
  };

  // Toggle Selection
  const toggleGroupSelection = (sku: string) => {
    setSkuGroups((prev) =>
      prev.map((g) => (g.sku === sku ? { ...g, selected: !g.selected } : g))
    );
  };

  const selectAllMatched = (select: boolean) => {
    setSkuGroups((prev) =>
      prev.map((g) => (g.matchedListing ? { ...g, selected: select } : g))
    );
  };

  // Execute Bulk Image Replacement
  const handleApplyImageUpdates = async () => {
    const selectedGroups = skuGroups.filter((g) => g.selected && g.matchedListing);
    if (selectedGroups.length === 0) {
      alert('Kripya kam se kam ek matched listing select karein.');
      return;
    }

    const confirmMsg = pushLiveToEbay
      ? `Kya aap in ${selectedGroups.length} listings ki purani photos hata kar nayi photos se REPLACE karna chahte hain aur live eBay store par turant sync karna chahte hain?`
      : `Kya aap in ${selectedGroups.length} listings ki purani photos hata kar nayi photos se REPLACE karna chahte hain (Dashboard me Local Draft)?`;

    if (!confirm(confirmMsg)) return;

    setApplyingUpdates(true);
    setErrorMsg('');
    setUpdatingProgress({ current: 0, total: selectedGroups.length, sku: '' });

    try {
      const allResults: any[] = [];
      const updatedListingsMap = new Map<string, EbayListing>();

      // Update listings sequentially to safely prevent any 4.5 MB request body limit on Vercel
      for (let i = 0; i < selectedGroups.length; i++) {
        const g = selectedGroups[i];
        setUpdatingProgress({ current: i + 1, total: selectedGroups.length, sku: g.sku });

        const cleanNewUrls = deduplicateImageUrls(g.files.map((f) => f.url));

        const singleUpdate = {
          listingId: g.matchedListing!.id,
          sku: g.matchedListing!.sku,
          images: cleanNewUrls,
          videoUrl: g.videoUrl,
          videoId: g.videoId,
          updateDescription: updateHtmlDescription,
        };

        const res = await fetch('/api/ebay/listings/bulk-update-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: g.matchedListing?.accountId || activeAccount?.id,
            pushLiveToEbay,
            apiKey: gdriveApiKey,
            updates: [singleUpdate],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server returned HTTP ${res.status}: ${errText.slice(0, 150)}`);
        }

        const data = await res.json();
        if (data.results && data.results.length > 0) {
          allResults.push(...data.results);
        }

        const existing = g.matchedListing!;
        const serverResult = data.results && data.results[0];
        const updatedDesc = updateHtmlDescription
          ? (serverResult?.description || updateDescriptionImages(existing.description, cleanNewUrls, existing.images))
          : existing.description;
        const updated: EbayListing = {
          ...existing,
          images: cleanNewUrls,
          imageUrl: cleanNewUrls[0] || existing.imageUrl,
          videoUrl: g.videoUrl || existing.videoUrl,
          videoId: serverResult?.videoId || g.videoId || existing.videoId,
          description: updatedDesc,
          hasUnpublishedChanges: !pushLiveToEbay,
          lastUpdated: new Date().toISOString(),
        };
        updatedListingsMap.set(updated.id, updated);
      }

      setUpdateResults(allResults);
      const updatedArray = Array.from(updatedListingsMap.values());
      onImagesUpdated(updatedArray);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(`Error during update: ${err.message}`);
    } finally {
      setApplyingUpdates(false);
    }
  };

  const matchedGroups = skuGroups.filter((g) => g.matchedListing);
  const unmatchedGroups = skuGroups.filter((g) => !g.matchedListing);

  const filteredGroups = skuGroups.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.sku.toLowerCase().includes(q) ||
      g.folderName.toLowerCase().includes(q) ||
      (g.matchedListing && g.matchedListing.title.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Update Images & Video by SKU</span>
                <span className="text-[10px] bg-sky-500/30 text-sky-300 font-semibold px-2 py-0.5 rounded-full border border-sky-400/30">
                  Folder & Google Drive
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Folder name ya Google Drive se SKU match karke images aur video replace karein.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeAccount && (
              <span className="text-[11px] bg-white/10 text-slate-200 px-2.5 py-1 rounded-lg border border-white/10 hidden sm:inline-block">
                Store: <strong>{activeAccount.storeName || activeAccount.ebayUsername || 'Active Store'}</strong>
              </span>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: SOURCE SELECTION (COMPUTER FOLDER OR GOOGLE DRIVE) */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Source Tabs */}
              <div className="flex border-b border-slate-200 gap-2">
                <button
                  type="button"
                  onClick={() => { setSourceMode('local'); setErrorMsg(''); }}
                  className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                    sourceMode === 'local'
                      ? 'border-sky-600 text-sky-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FolderUp className="w-4 h-4" />
                  <span>From Computer Folder</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceMode('gdrive'); setErrorMsg(''); }}
                  className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                    sourceMode === 'gdrive'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Globe className="w-4 h-4 text-indigo-500" />
                  <span>From Google Drive Link</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">New</span>
                </button>
              </div>

              {/* LOCAL COMPUTER FOLDER MODE */}
              {sourceMode === 'local' && (
                <div className="space-y-6">
                  {/* Instructions banner */}
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-sky-800">
                      <Info className="w-4 h-4 text-sky-600" />
                      <span>Kaise kaam karta hai? (Simple 1-Folder Step):</span>
                    </div>
                    <p className="text-sky-800 leading-relaxed">
                      Apne computer se wo Main Folder chuniye jisme har item ka SKU-named folder ho (jaise: <code>SLR03042/</code>, <code>SLR03044/</code>).
                      System automatically folder name aur SKU match karega. Matched item ki <strong>sabhi purani images remove</strong> ho jayengi aur folder ke andar ki sabhi nayi photos replace ho jayengi!
                    </p>
                  </div>

                  {/* Folder Picker Drag & Drop Box */}
                  <div
                    onClick={() => folderInputRef.current?.click()}
                    className="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50/80 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center group"
                  >
                    <input
                      type="file"
                      ref={folderInputRef}
                      onChange={handleFolderSelected}
                      // @ts-ignore
                      webkitdirectory="true"
                      directory=""
                      multiple
                      className="hidden"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition duration-200 shadow-sm">
                      <FolderUp className="w-8 h-8" />
                    </div>

                    <h4 className="font-bold text-slate-800 text-base mb-1">
                      Click to Select Photo Folder from Computer
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mb-4">
                      Root folder chuniye jisme subfolders bane hain (e.g. <code>C:\Photos\SLR03042\1.jpg, 2.jpg...</code>).
                      Aap ek single SKU ka folder bhi choose kar sakte hain.
                    </p>

                    <button
                      type="button"
                      className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer"
                    >
                      <FolderUp className="w-4 h-4" />
                      <span>Choose Folder Containing Photos</span>
                    </button>
                  </div>

                  {/* Scanning status */}
                  {scanning && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-3">
                      <RefreshCw className="w-6 h-6 text-sky-600 animate-spin mx-auto" />
                      <div className="text-sm font-bold text-slate-800">
                        Scanning & Matching Photos with Listings...
                      </div>
                      <div className="text-xs text-slate-500">
                        Processed {scanProgress.current} of {scanProgress.total} files
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 max-w-md mx-auto overflow-hidden">
                        <div
                          className="bg-sky-600 h-2 rounded-full transition-all duration-150"
                          style={{
                            width: `${scanProgress.total ? (scanProgress.current / scanProgress.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Structure Example Visual */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs">
                    <div className="font-semibold text-slate-700 mb-2">Folder Structure Example:</div>
                    <div className="font-mono text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                      📁 Products_Photos/<br />
                      &nbsp;&nbsp;├── 📁 <strong>SLR03042</strong>/ (Matches SKU: SLR03042 ➔ 4 photos)<br />
                      &nbsp;&nbsp;├── 📁 <strong>SLR03044</strong>/ (Matches SKU: SLR03044 ➔ 3 photos)<br />
                      &nbsp;&nbsp;└── 📁 <strong>SLR02845</strong>/ (Matches SKU: SLR02845 ➔ 5 photos)
                    </div>
                  </div>
                </div>
              )}

              {/* GOOGLE DRIVE MODE */}
              {sourceMode === 'gdrive' && (
                <div className="space-y-5">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Google Drive Automatic SKU & Media Match:</span>
                    </div>
                    <p className="text-indigo-900 leading-relaxed">
                      Google Drive folder ka public share link yahan paste karein. System folder ke andar se <strong>SKU match</strong> karke photos aur video ko automatic identify karega aur direct fast streaming URLs me convert karega!
                    </p>
                  </div>

                  {/* Drive URL Input Form */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        Google Drive Folder Link
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="url"
                          value={gdriveUrl}
                          onChange={(e) => setGdriveUrl(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Make sure Google Drive folder setting is: <em>"Anyone with the link can view"</em>.
                      </p>
                    </div>

                    {/* Google API Key Status / Input */}
                    <div>
                      {hasStoredApiKey ? (
                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <div className="flex items-center space-x-2 text-xs text-emerald-800 font-semibold">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span>Google Drive API Key is active and saved!</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                            className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium cursor-pointer"
                          >
                            Change Key
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{showApiKeyInput ? '− Hide' : '+ Enter'} Google Cloud API Key (Required for scanning Drive folders)</span>
                        </button>
                      )}

                      {showApiKeyInput && (
                        <div className="mt-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-bold text-slate-700">
                              Google Drive API Key (100% Free - No Billing Required)
                            </label>
                            <a
                              href="https://console.cloud.google.com/apis/credentials"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                            >
                              Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                          <input
                            type="text"
                            value={gdriveApiKey}
                            onChange={(e) => setGdriveApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            Google Cloud Console me <strong>"Google Drive API"</strong> enable karein ➔ <strong>Credentials ➔ Create API Key</strong> par click karke yahan paste karein. Ye ek bar save hone ke baad hamesha auto-use hogi.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quick Switch to Local Folder Advice */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Bina API Key ke Fast Alternative:</span> Agar aapke paas API key nahi hai, to upar pehla tab <strong>"From Computer Folder"</strong> chuniye. Usme bina kisi Google setup ke 1 second me matching aur live sync ho jata hai!
                      </div>
                    </div>

                    {/* Alternative: Raw List of Links */}
                    <div className="pt-2 border-t border-slate-100">
                      <details className="group">
                        <summary className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-800 cursor-pointer list-none flex items-center justify-between">
                          <span>Ya direct SKU-wise Google Drive File Links paste karein (Manual List)</span>
                          <span className="text-slate-400 group-open:rotate-180 transition">▼</span>
                        </summary>
                        <div className="mt-2.5 space-y-1.5">
                          <textarea
                            rows={3}
                            value={gdriveRawList}
                            onChange={(e) => setGdriveRawList(e.target.value)}
                            placeholder={'SLR03042: https://drive.google.com/file/d/1abc..., https://drive.google.com/file/d/2xyz...\nSLR02845: https://drive.google.com/file/d/3def...'}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-500">
                            Format: <code>SKU: &lt;photo link 1&gt;, &lt;video link&gt;</code> (har nayi line par naya SKU).
                          </p>
                        </div>
                      </details>
                    </div>

                    {/* Scan Drive Button */}
                    <button
                      type="button"
                      onClick={handleScanGoogleDrive}
                      disabled={scanningGdrive || (!gdriveUrl.trim() && !gdriveRawList.trim())}
                      className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {scanningGdrive ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Scanning Google Drive & Matching SKUs...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Scan Google Drive & Match Inventory Listings</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Visual Drive Structure Reference */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs">
                    <div className="font-semibold text-slate-700 mb-2">Google Drive Folder Structure:</div>
                    <div className="font-mono text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                      ☁️ Google Drive Shared Folder/<br />
                      &nbsp;&nbsp;├── 📁 <strong>SLR03042</strong>/ ➔ [1.jpg, 2.jpg, video.mp4]<br />
                      &nbsp;&nbsp;├── 📁 <strong>SLR02845</strong>/ ➔ [ring_1.jpg, ring_2.jpg]<br />
                      &nbsp;&nbsp;└── (Ya direct files): <strong>SLR03044_1.jpg</strong>, <strong>SLR03044_video.mp4</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW & MATCH RESULTS */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Summary Stats Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Matched Listings
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-0.5">
                    {matchedGroups.length} <span className="text-xs font-normal">items</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-1">
                    Ready to replace old media with new photos & video
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Total New Photos & Media
                  </div>
                  <div className="text-2xl font-black text-slate-800 mt-0.5">
                    {matchedGroups.reduce((acc, g) => acc + g.files.length, 0)} <span className="text-xs font-normal">photos</span>
                    {matchedGroups.filter((g) => g.videoUrl).length > 0 && (
                      <span className="text-sm font-bold text-purple-600 ml-2">
                        + {matchedGroups.filter((g) => g.videoUrl).length} videos
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Uploaded and staged for replacement
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Unmatched Folders / Links
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-0.5">
                    {unmatchedGroups.length} <span className="text-xs font-normal">unmatched</span>
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1">
                    SKU not found in current inventory
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search SKU or title..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs w-full sm:w-auto justify-end">
                  <button
                    onClick={() => selectAllMatched(true)}
                    className="text-sky-600 hover:text-sky-800 font-semibold px-2 py-1 rounded cursor-pointer"
                  >
                    Select All Matched
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => selectAllMatched(false)}
                    className="text-slate-600 hover:text-slate-800 font-medium px-2 py-1 rounded cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Options Checkbox: Live Push vs Local Draft */}
              <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="pushLiveToEbay"
                  checked={pushLiveToEbay}
                  onChange={(e) => setPushLiveToEbay(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 mt-0.5 cursor-pointer"
                />
                <label htmlFor="pushLiveToEbay" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold text-slate-900 block">
                    Push updated images & video directly to live eBay store now (Recommended)
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Agar check rahega toh eBay par live listings ki 24 gallery photos aur video turant eBay API se replace ho jayengi.
                  </span>
                </label>
              </div>

              {/* Options Checkbox: Update HTML Description */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="updateHtmlDescription"
                  checked={updateHtmlDescription}
                  onChange={(e) => setUpdateHtmlDescription(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                />
                <label htmlFor="updateHtmlDescription" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold text-slate-900 block">
                    Auto-detect & update product photos inside listing HTML description
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    <strong>Smart Product Photo Detection Active:</strong> HTML ke andar sirf product gallery images detect karke update hongi — aapka logo, header banners, authenticity badges aur IGI tables 100% untouched aur safe rahenge.
                  </span>
                </label>
              </div>

              {/* Matched Listings Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 font-bold text-xs text-slate-700 border-b border-slate-200 flex items-center justify-between">
                  <span>Listings to be Updated ({matchedGroups.filter((g) => g.selected).length} selected)</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Purani images remove hokar new images set hongi
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                  {filteredGroups.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Koi listing match nahi hui search query se.
                    </div>
                  ) : (
                    filteredGroups.map((group) => {
                      const isMatched = Boolean(group.matchedListing);
                      const oldImgCount = group.matchedListing
                        ? (group.matchedListing.images && group.matchedListing.images.length > 0)
                          ? group.matchedListing.images.length
                          : group.matchedListing.imageUrl
                          ? 1
                          : 0
                        : 0;

                      return (
                        <div
                          key={group.sku}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                            !isMatched
                              ? 'bg-amber-50/40 opacity-70'
                              : group.selected
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={group.selected}
                              disabled={!isMatched}
                              onChange={() => toggleGroupSelection(group.sku)}
                              className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 mt-1 cursor-pointer"
                            />

                            {/* Thumbnail of first new photo */}
                            <div className="w-14 h-14 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0 relative group/thumb">
                              {group.files[0] ? (
                                <img
                                  src={group.files[0].url}
                                  alt={group.sku}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Camera className="w-6 h-6 text-slate-400 m-auto mt-4" />
                              )}
                              <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-tl">
                                {group.files.length}
                              </span>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 font-mono">
                                  SKU: {group.sku}
                                </span>
                                {isMatched ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ Matched
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Folder in PC, but SKU not in inventory
                                  </span>
                                )}
                                {group.matchedListing?.ebayListingId && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    #{group.matchedListing.ebayListingId}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-700 font-medium line-clamp-1 mt-0.5">
                                {group.matchedListing?.title || `Folder: ${group.folderName}`}
                              </div>

                              {/* Old vs New replacement badge */}
                              {isMatched && (
                                <div className="flex items-center gap-2 mt-1.5 text-[11px] flex-wrap">
                                  {group.files.length > 0 ? (
                                    <>
                                      <span className="text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-medium">
                                        Old: {oldImgCount} replaced
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-slate-400" />
                                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                        New: {group.files.length} photos ready
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                                      Keep existing {oldImgCount} photos
                                    </span>
                                  )}
                                  {group.videoUrl && (
                                    <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                                      <Video className="w-3 h-3 text-purple-600" />
                                      Video included
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Photo Strip of New Images */}
                          <div className="flex items-center space-x-1.5 self-end sm:self-center overflow-x-auto max-w-xs py-1">
                            {group.files.slice(0, 5).map((f, fIdx) => (
                              <img
                                key={fIdx}
                                src={f.url}
                                alt={f.name}
                                title={f.name}
                                className="w-9 h-9 object-cover rounded border border-slate-200 flex-shrink-0"
                              />
                            ))}
                            {group.files.length > 5 && (
                              <span className="w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                                +{group.files.length - 5}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 3 && (
            <div className="text-center py-8 space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  Images Successfully Replaced!
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Chuni hui listings ki sabhi purani images remove kar di gayi hain aur SKU folder ki nayi photos set ho gayi hain.
                </p>
              </div>

              <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100 text-left text-xs max-h-60 overflow-y-auto">
                {updateResults.map((res, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 font-mono">
                        SKU: {res.sku}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {res.title}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {res.pushedToEbay ? 'Live on eBay' : 'Updated Locally'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {res.newImageCount} new photos
                      </div>
                      {res.videoId && (
                        <div className="text-[10px] text-purple-700 font-semibold flex items-center justify-end gap-1 mt-0.5">
                          <Video className="w-3 h-3 text-purple-600" />
                          Video Attached
                        </div>
                      )}
                      {res.videoError && (
                        <div className="text-[10px] text-amber-700 font-medium mt-0.5 max-w-[200px] text-right truncate" title={res.videoError}>
                          ⚠️ Video: {res.videoError}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <div className="text-[11px] text-slate-500">
                Folder select karte hi system automatically SKU match kar lega.
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={applyingUpdates}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ← Choose Another Folder
              </button>

              <button
                type="button"
                onClick={handleApplyImageUpdates}
                disabled={applyingUpdates || matchedGroups.filter((g) => g.selected).length === 0}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer"
              >
                {applyingUpdates ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {updatingProgress.total > 0
                        ? `Updating ${updatingProgress.current} of ${updatingProgress.total} (SKU: ${updatingProgress.sku})...`
                        : 'Replacing Images & Syncing...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      Confirm & Replace Images ({matchedGroups.filter((g) => g.selected).length} listings)
                    </span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
