'use client';

import React, { useState, useEffect } from 'react';
import { Truck, RotateCcw, CreditCard, RefreshCw, CheckCircle, ShieldCheck, Edit3 } from 'lucide-react';

export interface PolicyOption {
  id: string;
  name: string;
  type: 'SHIPPING' | 'RETURN' | 'PAYMENT';
  description?: string;
}

interface BusinessPoliciesSelectorProps {
  accountId?: string;
  shippingPolicyId: string;
  setShippingPolicyId: (val: string) => void;
  shippingPolicyName: string;
  setShippingPolicyName: (val: string) => void;
  returnPolicyId: string;
  setReturnPolicyId: (val: string) => void;
  returnPolicyName: string;
  setReturnPolicyName: (val: string) => void;
  paymentPolicyId: string;
  setPaymentPolicyId: (val: string) => void;
  paymentPolicyName: string;
  setPaymentPolicyName: (val: string) => void;
}

export default function BusinessPoliciesSelector({
  accountId,
  shippingPolicyId,
  setShippingPolicyId,
  shippingPolicyName,
  setShippingPolicyName,
  returnPolicyId,
  setReturnPolicyId,
  returnPolicyName,
  setReturnPolicyName,
  paymentPolicyId,
  setPaymentPolicyId,
  paymentPolicyName,
  setPaymentPolicyName,
}: BusinessPoliciesSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [shippingList, setShippingList] = useState<PolicyOption[]>([]);
  const [returnList, setReturnList] = useState<PolicyOption[]>([]);
  const [paymentList, setPaymentList] = useState<PolicyOption[]>([]);
  const [customMode, setCustomMode] = useState<{ shipping: boolean; return: boolean; payment: boolean }>({
    shipping: false,
    return: false,
    payment: false,
  });
  const [saveStatus, setSaveStatus] = useState<string>('');

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const url = accountId ? `/api/ebay/policies?accountId=${accountId}` : '/api/ebay/policies';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setShippingList(data.shippingPolicies || []);
        setReturnList(data.returnPolicies || []);
        setPaymentList(data.paymentPolicies || []);

        // If not set yet, populate from account defaults or first discovered policy
        if (!shippingPolicyId && !shippingPolicyName && data.defaults?.shippingPolicyId) {
          setShippingPolicyId(data.defaults.shippingPolicyId);
          setShippingPolicyName(data.defaults.shippingPolicyName || '');
        }
        if (!returnPolicyId && !returnPolicyName && data.defaults?.returnPolicyId) {
          setReturnPolicyId(data.defaults.returnPolicyId);
          setReturnPolicyName(data.defaults.returnPolicyName || '');
        }
        if (!paymentPolicyId && !paymentPolicyName && data.defaults?.paymentPolicyId) {
          setPaymentPolicyId(data.defaults.paymentPolicyId);
          setPaymentPolicyName(data.defaults.paymentPolicyName || '');
        }
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [accountId]);

  // Save as store defaults
  const handleSaveDefaults = async () => {
    setSaveStatus('Saving...');
    try {
      const res = await fetch('/api/ebay/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          shippingPolicyId,
          shippingPolicyName,
          returnPolicyId,
          returnPolicyName,
          paymentPolicyId,
          paymentPolicyName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('Saved as store default!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Failed to save');
      }
    } catch {
      setSaveStatus('Failed to save');
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3.5">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h4 className="font-bold text-slate-800 text-xs">
            eBay Business Policies <span className="text-slate-500 font-normal">(Shipping, Return & Payment)</span>
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {saveStatus}
            </span>
          )}
          <button
            type="button"
            onClick={fetchPolicies}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded bg-blue-50 border border-blue-200"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh from eBay'}
          </button>
          <button
            type="button"
            onClick={handleSaveDefaults}
            className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded bg-white border border-slate-300"
          >
            Save as Store Default
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. SHIPPING POLICY */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-600" /> Shipping Policy
            </label>
            <button
              type="button"
              onClick={() => setCustomMode((p) => ({ ...p, shipping: !p.shipping }))}
              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <Edit3 className="w-3 h-3" />
              {customMode.shipping ? 'Select from list' : 'Type name'}
            </button>
          </div>

          {!customMode.shipping ? (
            <div>
              <select
                value={shippingPolicyId || (shippingList.find((p) => p.name === shippingPolicyName)?.id ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setCustomMode((p) => ({ ...p, shipping: true }));
                  } else {
                    setShippingPolicyId(val);
                    const found = shippingList.find((p) => p.id === val);
                    if (found) setShippingPolicyName(found.name);
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {shippingList.length === 0 && <option value="">No shipping policies found</option>}
                {shippingList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="CUSTOM">+ Type custom policy name...</option>
              </select>
              {shippingPolicyId && (
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  ID: {shippingPolicyId} {shippingPolicyName ? `(${shippingPolicyName})` : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                value={shippingPolicyName}
                onChange={(e) => {
                  const nameVal = e.target.value;
                  setShippingPolicyName(nameVal);
                  const matched = shippingList.find(
                    (p) => p.name.toLowerCase() === nameVal.trim().toLowerCase()
                  );
                  if (matched) {
                    setShippingPolicyId(matched.id);
                  }
                }}
                placeholder="Policy Name (e.g. s1 or Standard)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={shippingPolicyId}
                onChange={(e) => setShippingPolicyId(e.target.value)}
                placeholder="Optional Policy ID (e.g. 243859887017)"
                className="w-full px-2.5 py-1 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
              />
            </div>
          )}
        </div>

        {/* 2. RETURN POLICY */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Return Policy
            </label>
            <button
              type="button"
              onClick={() => setCustomMode((p) => ({ ...p, return: !p.return }))}
              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <Edit3 className="w-3 h-3" />
              {customMode.return ? 'Select from list' : 'Type name'}
            </button>
          </div>

          {!customMode.return ? (
            <div>
              <select
                value={returnPolicyId || (returnList.find((p) => p.name === returnPolicyName)?.id ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setCustomMode((p) => ({ ...p, return: true }));
                  } else {
                    setReturnPolicyId(val);
                    const found = returnList.find((p) => p.id === val);
                    if (found) setReturnPolicyName(found.name);
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {returnList.length === 0 && <option value="">No return policies found</option>}
                {returnList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="CUSTOM">+ Type custom policy name...</option>
              </select>
              {returnPolicyId && (
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  ID: {returnPolicyId} {returnPolicyName ? `(${returnPolicyName})` : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                value={returnPolicyName}
                onChange={(e) => {
                  const nameVal = e.target.value;
                  setReturnPolicyName(nameVal);
                  const matched = returnList.find(
                    (p) => p.name.toLowerCase() === nameVal.trim().toLowerCase()
                  );
                  if (matched) {
                    setReturnPolicyId(matched.id);
                  }
                }}
                placeholder="Policy Name (e.g. r1 or 30-day)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={returnPolicyId}
                onChange={(e) => setReturnPolicyId(e.target.value)}
                placeholder="Optional Policy ID (e.g. 245514669017)"
                className="w-full px-2.5 py-1 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
              />
            </div>
          )}
        </div>

        {/* 3. PAYMENT POLICY */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Payment Policy
            </label>
            <button
              type="button"
              onClick={() => setCustomMode((p) => ({ ...p, payment: !p.payment }))}
              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <Edit3 className="w-3 h-3" />
              {customMode.payment ? 'Select from list' : 'Type name'}
            </button>
          </div>

          {!customMode.payment ? (
            <div>
              <select
                value={paymentPolicyId || (paymentList.find((p) => p.name === paymentPolicyName)?.id ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setCustomMode((p) => ({ ...p, payment: true }));
                  } else {
                    setPaymentPolicyId(val);
                    const found = paymentList.find((p) => p.id === val);
                    if (found) setPaymentPolicyName(found.name);
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {paymentList.length === 0 && <option value="">No payment policies found</option>}
                {paymentList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="CUSTOM">+ Type custom policy name...</option>
              </select>
              {paymentPolicyId && (
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  ID: {paymentPolicyId} {paymentPolicyName ? `(${paymentPolicyName})` : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                value={paymentPolicyName}
                onChange={(e) => {
                  const nameVal = e.target.value;
                  setPaymentPolicyName(nameVal);
                  const matched = paymentList.find(
                    (p) => p.name.toLowerCase() === nameVal.trim().toLowerCase()
                  );
                  if (matched) {
                    setPaymentPolicyId(matched.id);
                  }
                }}
                placeholder="Policy Name (e.g. p1 or Managed Payments)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={paymentPolicyId}
                onChange={(e) => setPaymentPolicyId(e.target.value)}
                placeholder="Optional Policy ID (e.g. 243859890017)"
                className="w-full px-2.5 py-1 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
