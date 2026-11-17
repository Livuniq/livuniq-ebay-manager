'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  Search,
  Replace,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  FileCode,
} from 'lucide-react';
import { EbayListing } from '@/lib/ebay/types';

interface MasterDescriptionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  listings: EbayListing[];
  onComplete: () => Promise<void>;
}

export default function MasterDescriptionEditorModal({
  isOpen,
  onClose,
  accountId,
  listings,
  onComplete,
}: MasterDescriptionEditorModalProps) {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [pushToEbay, setPushToEbay] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [dryRunData, setDryRunData] = useState<{
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
  } | null>(null);
  const [showPreviewList, setShowPreviewList] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Debounced dry-run preview check whenever fromText or caseSensitive changes
  useEffect(() => {
    if (!isOpen) return;
    if (!fromText.trim()) {
      setDryRunData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ebay/listings/bulk-replace-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            fromText,
            toText,
            caseSensitive,
            dryRun: true,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setDryRunData({
            matchedCount: data.matchedCount,
            totalChecked: data.totalChecked,
            updatedListings: data.updatedListings || [],
          });
        }
      } catch (err) {
        console.error('Error during dry run preview:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [fromText, toText, caseSensitive, accountId, isOpen]);

  if (!isOpen) return null;

  const handleApplyReplace = async () => {
    if (!fromText) {
      alert('Kripya "From" field me dhundhne wala text ya HTML dalein.');
      return;
    }

    setIsApplying(true);
    setResultMessage(null);

    try {
      const res = await fetch('/api/ebay/listings/bulk-replace-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          fromText,
          toText,
          caseSensitive,
          dryRun: false,
          pushToEbay,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResultMessage({
          type: 'success',
          text: data.message || `Successfully updated ${data.updatedCount} listings!`,
        });
        await onComplete();
        setTimeout(() => {
          // Keep notification visible for a moment
        }, 1500);
      } else {
        setResultMessage({
          type: 'error',
          text: data.error || 'Replace operation failed.',
        });
      }
    } catch (err) {
      setResultMessage({
        type: 'error',
        text: (err as Error).message,
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <Replace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Description Master Editor</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono">
                  From ➔ To Find & Replace
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Sabhi listings ke description me se koi bhi line, link ya HTML snippet dhundh kar replace karein.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Scope Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>
                Target Store Scope:{' '}
                <strong className="text-slate-800 font-semibold">
                  All Active Listings ({listings.length} items)
                </strong>
              </span>
            </div>
            {dryRunData && (
              <div
                className={`font-semibold px-2.5 py-1 rounded-lg text-[11px] flex items-center space-x-1.5 ${
                  dryRunData.matchedCount > 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                <span>
                  {dryRunData.matchedCount > 0
                    ? `✓ Matches found in ${dryRunData.matchedCount} of ${dryRunData.totalChecked} listings`
                    : `No listings match this "From" text`}
                </span>
              </div>
            )}
          </div>

          {/* TWO MAIN BOXES: 1. FROM and 2. TO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BOX 1: FROM */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 text-blue-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>Find in Description (FROM) *</span>
                </label>
                <span className="text-[10px] text-slate-400 font-normal font-mono">
                  {fromText.length} chars
                </span>
              </div>
              <textarea
                rows={7}
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
                placeholder="Description se jo part replace karna hai wo yahan paste ya type karein (text ya HTML)...&#10;&#10;e.g. Free FedEx Shipping ya purani warranty line..."
                className="w-full border-2 border-blue-200 focus:border-blue-500 rounded-xl p-3 text-xs font-mono text-slate-800 bg-white placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-[11px] text-slate-500 italic">
                System exact yeh text har listing ke description me search karega.
              </p>
            </div>

            {/* BOX 2: TO */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>Replace With (TO)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-normal font-mono">
                  {toText.length} chars
                </span>
              </div>
              <textarea
                rows={7}
                value={toText}
                onChange={(e) => setToText(e.target.value)}
                placeholder="Uske badle jo naya text ya HTML chahiye wo yahan dalein...&#10;&#10;(Agar text ko remove/delete karna hai to ise khali chhod dein)"
                className="w-full border-2 border-emerald-200 focus:border-emerald-500 rounded-xl p-3 text-xs font-mono text-slate-800 bg-white placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <p className="text-[11px] text-slate-500 italic">
                Found text is naye content se replace ho jayega.
              </p>
            </div>
          </div>

          {/* Options & Flags */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Case Sensitive Match (Exact Upper/Lower case match)</span>
            </label>

            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pushToEbay}
                onChange={(e) => setPushToEbay(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="flex items-center gap-1 font-medium text-blue-700">
                <Globe className="w-3.5 h-3.5" />
                <span>Sync changes directly to live eBay listing</span>
              </span>
            </label>
          </div>

          {/* Real-time Match Details & Sample Preview */}
          {dryRunData && dryRunData.matchedCount > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setShowPreviewList(!showPreviewList)}
                className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <span>
                    Matched Listings Preview ({dryRunData.matchedCount} items will be updated)
                  </span>
                </div>
                {showPreviewList ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showPreviewList && (
                <div className="p-3 max-h-56 overflow-y-auto space-y-2 divide-y divide-slate-100 text-xs">
                  {dryRunData.updatedListings.map((item) => (
                    <div key={item.id} className="pt-2 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {item.title}
                        </span>
                        <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          SKU: {item.sku} ({item.replacementsCount} matches)
                        </span>
                      </div>
                      {item.sampleBefore && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2 rounded-lg">
                          <div className="text-rose-700 bg-rose-50/50 p-1 rounded border border-rose-100 truncate">
                            <span className="font-bold text-[10px] uppercase text-rose-500 block">Before:</span>
                            {item.sampleBefore}
                          </div>
                          <div className="text-emerald-700 bg-emerald-50/50 p-1 rounded border border-emerald-100 truncate">
                            <span className="font-bold text-[10px] uppercase text-emerald-500 block">After:</span>
                            {item.sampleAfter}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result Alert */}
          {resultMessage && (
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 text-xs ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {resultMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <div className="flex-1 font-medium">{resultMessage.text}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-3">
            {dryRunData && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {dryRunData.matchedCount > 0
                  ? `${dryRunData.matchedCount} of ${dryRunData.totalChecked} listings will update`
                  : 'No matches found'}
              </span>
            )}

            <button
              type="button"
              disabled={isApplying || !fromText || (dryRunData?.matchedCount === 0)}
              onClick={handleApplyReplace}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md transition cursor-pointer"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <Replace className="w-4 h-4" />
                  <span>
                    Replace in All Listings{' '}
                    {dryRunData && dryRunData.matchedCount > 0
                      ? `(${dryRunData.matchedCount})`
                      : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
