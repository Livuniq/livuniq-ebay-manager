'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Code,
  FileCode,
  Eye,
  Plus,
  Trash2,
  Edit3,
  Copy,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Save,
  RotateCcw,
  Tag,
  Laptop,
  Smartphone,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Replace,
  RefreshCw,
  Globe,
} from 'lucide-react';
import {
  DescriptionTemplate,
  ListingTemplateData,
  renderDescriptionTemplate,
  DEFAULT_TEMPLATES,
} from '@/lib/ebay/template-engine';
import { MasterCategoryProfile, DEFAULT_CATEGORY_PROFILES } from '@/lib/ebay/specifics-rules';

// Realistic sample jewelry listing data for live previews
const PREVIEW_SAMPLE_DATA: ListingTemplateData = {
  title: '3.50 ct Oval Lab-Grown Diamond Solitaire Engagement Ring 14k Yellow Gold IGI',
  price: 1850.0,
  sku: 'LIV-ER-350-OV',
  quantity: 3,
  category: 'Engagement Rings',
  condition: 'NEW',
  conditionDescription: 'Brand new with authentic IGI Certificate, luxury velvet presentation box, and warranty card.',
  images: [
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598560917505-59a3ad559071?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&auto=format&fit=crop&q=80',
  ],
  itemSpecifics: {
    'Brand': 'Livuniq®',
    'Main Stone': 'Diamond',
    'Main Stone Shape': 'Oval',
    'Main Stone Creation': 'Lab-Created',
    'Total Carat Weight': '3.50 carat',
    'Center Stone Weight': '3.00 ct',
    'Diamond Color Grade': 'E - Colorless',
    'Diamond Clarity Grade': 'VVS2 - Very Very Slightly Included',
    'Cut Grade': 'Ideal',
    'Metal': 'Yellow Gold',
    'Metal Purity': '14k',
    'Ring Size': '7',
    'Setting Style': 'Solitaire 4-Prong',
    'Certification': 'IGI Certified',
    'Country of Origin': 'United States',
  },
  templateAttributes: {
    title: '3.50 ct Oval Lab-Grown Diamond Solitaire Engagement Ring 14k Yellow Gold IGI',
    price: '1850.00',
    sku: 'LIV-ER-350-OV',
    lot: 'LOT-9921',
    cost_usd: '820.00',
    selling_price_usd: '1850.00',
    gold_kt: '14k',
    gold_color: 'Yellow',
    gold_weight: '3.80 g',
    center_stone_shape: 'Oval',
    center_stone_weight: '3.00 ct',
    center_diamond_color: 'E',
    center_diamond_clarity: 'VVS2',
    side_stone_shape: 'Round Brilliant',
    side_stone_weight: '0.50 ct',
    side_stone_color_clarity: 'E-F / VVS',
    side_color: 'E-F',
    side_clarity: 'VVS',
    setting: 'Solitaire 4-Prong',
    total_diamond_pcs: '1',
    tcw: '3.50',
    metel: 'Yellow Gold',
  },
  storeName: 'Livuniq Fine Jewelry',
};

// Available tags cheat-sheet for rapid insertion
const AVAILABLE_TAGS = [
  { tag: '{TITLE}', label: 'Title', desc: 'Product Title' },
  { tag: '{PRICE}', label: 'Price', desc: 'Formatted Selling Price ($)' },
  { tag: '{TCW}', label: 'TCW', desc: 'Total Carat Weight' },
  { tag: '{GOLD_KT}', label: 'Gold Kt', desc: 'e.g. 14k, 18k' },
  { tag: '{GOLD_COLOR}', label: 'Gold Color', desc: 'e.g. Yellow, White, Rose' },
  { tag: '{GOLD_WEIGHT}', label: 'Gold Wt', desc: 'Weight in grams' },
  { tag: '{CENTER_STONE_SHAPE}', label: 'Center Shape', desc: 'Oval, Round, etc.' },
  { tag: '{CENTER_STONE_WEIGHT}', label: 'Center Wt', desc: 'Center stone carat' },
  { tag: '{CENTER_DIAMOND_COLOR}', label: 'Center Color', desc: 'D, E, F, etc.' },
  { tag: '{CENTER_DIAMOND_CLARITY}', label: 'Center Clarity', desc: 'VVS1, VS1, etc.' },
  { tag: '{SETTING}', label: 'Setting', desc: 'Prong, Bezel, Halo' },
  { tag: '{SIDE_STONE_SHAPE}', label: 'Side Shape', desc: 'Side diamond shape' },
  { tag: '{SIDE_STONE_WEIGHT}', label: 'Side Wt', desc: 'Side stone carat' },
  { tag: '{SIDE_COLOR}', label: 'Side Color', desc: 'Side stone color' },
  { tag: '{SIDE_CLARITY}', label: 'Side Clarity', desc: 'Side stone clarity' },
  { tag: '{TOTAL_DIAMOND_PCS}', label: 'Diamond Pcs', desc: 'Total piece count' },
  { tag: '{GALLERY}', label: 'Gallery', desc: 'Auto-rendered responsive image slider' },
  { tag: '{SPECIFICS_TABLE}', label: 'Specs Table', desc: 'Clean 2-column specifications table' },
  { tag: '{SKU}', label: 'SKU', desc: 'Inventory Item SKU' },
  { tag: '{CATEGORY}', label: 'Category', desc: 'Category Name' },
  { tag: '{STORE_NAME}', label: 'Store Name', desc: 'Seller Store Brand' },
];

interface MasterHtmlTemplatesProps {
  activeAccountId?: string;
  accounts?: Array<{ id: string; storeName: string; ebayUsername: string; marketplace: string }>;
  onSwitchAccount?: (accountId: string) => void;
}

export default function MasterHtmlTemplates({
  activeAccountId,
  accounts = [],
  onSwitchAccount,
}: MasterHtmlTemplatesProps = {}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(activeAccountId || (accounts[0]?.id || ''));
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([...DEFAULT_TEMPLATES]);
  const [categoryProfiles, setCategoryProfiles] = useState<MasterCategoryProfile[]>([...DEFAULT_CATEGORY_PROFILES]);
  const [loading, setLoading] = useState(true);

  // Active view tab: 'templates' | 'category-mapping' | 'find-replace'
  const [subTab, setSubTab] = useState<'templates' | 'category-mapping' | 'find-replace'>('templates');

  // Master Find & Replace (From -> To) state
  const [frFromText, setFrFromText] = useState('');
  const [frToText, setFrToText] = useState('');
  const [frCaseSensitive, setFrCaseSensitive] = useState(false);
  const [frPushToEbay, setFrPushToEbay] = useState(false);
  const [frApplying, setFrApplying] = useState(false);
  const [frDryRunData, setFrDryRunData] = useState<any>(null);

  // Editor Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formHtml, setFormHtml] = useState('');
  const [formMappedCategories, setFormMappedCategories] = useState<string[]>([]);
  const [editorTab, setEditorTab] = useState<'code' | 'preview' | 'split'>('split');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Delete Confirmation Modal
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Status feedback toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeAccountId && activeAccountId !== selectedAccountId) {
      setSelectedAccountId(activeAccountId);
    }
  }, [activeAccountId]);

  // Debounced dry run check for Find & Replace
  useEffect(() => {
    if (subTab !== 'find-replace' || !frFromText.trim()) {
      setFrDryRunData(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ebay/listings/bulk-replace-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccountId,
            fromText: frFromText,
            toText: frToText,
            caseSensitive: frCaseSensitive,
            dryRun: true,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setFrDryRunData(data);
        }
      } catch (err) {
        console.error('Dry run error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [subTab, frFromText, frToText, frCaseSensitive, selectedAccountId]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load Templates & Category Profiles for selected store
  const loadData = async (accId = selectedAccountId) => {
    setLoading(true);
    try {
      const [tplRes, specRes] = await Promise.all([
        fetch(`/api/ebay/templates?accountId=${accId || ''}`),
        fetch(`/api/ebay/specifics-mapping?accountId=${accId || ''}`),
      ]);

      const [tplData, specData] = await Promise.all([
        tplRes.json(),
        specRes.json(),
      ]);

      if (tplData.success && tplData.templates && tplData.templates.length > 0) {
        setTemplates(tplData.templates);
      } else {
        setTemplates([...DEFAULT_TEMPLATES]);
      }
      if (specData.success && specData.profiles && specData.profiles.length > 0) {
        setCategoryProfiles(specData.profiles);
      }
    } catch (err) {
      console.error('Failed to load templates or categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedAccountId);
  }, [selectedAccountId]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Open Editor for Creating New Template
  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setFormName('');
    setFormDescription('');
    setFormHtml(DEFAULT_TEMPLATES[0].html);
    setFormMappedCategories([]);
    setEditorTab('split');
    setEditorOpen(true);
  };

  // Open Editor for Editing Existing Template
  const handleOpenEdit = (tpl: DescriptionTemplate) => {
    setEditingTemplateId(tpl.id);
    setFormName(tpl.name);
    setFormDescription(tpl.description || '');
    setFormHtml(tpl.html);

    // Find which categories are assigned to this template
    const mappedCats = (tpl.mappedCategories && tpl.mappedCategories.length > 0)
      ? tpl.mappedCategories
      : categoryProfiles
          .filter((p) => p.templateId === tpl.id)
          .map((p) => p.id);
    setFormMappedCategories(mappedCats);

    setEditorTab('split');
    setEditorOpen(true);
  };

  // Duplicate template
  const handleDuplicate = (tpl: DescriptionTemplate) => {
    setEditingTemplateId(null);
    setFormName(`${tpl.name} (Copy)`);
    setFormDescription(tpl.description || '');
    setFormHtml(tpl.html);
    const mappedCats = (tpl.mappedCategories && tpl.mappedCategories.length > 0)
      ? tpl.mappedCategories
      : categoryProfiles
          .filter((p) => p.templateId === tpl.id)
          .map((p) => p.id);
    setFormMappedCategories(mappedCats);
    setEditorTab('split');
    setEditorOpen(true);
  };

  // Insert tag at cursor in editor textarea
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormHtml((prev) => prev + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formHtml;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const updated = before + tag + after;

    setFormHtml(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Save Template (Create or Update) + Sync Category Mappings
  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      alert('Please enter a Template Name');
      return;
    }
    if (!formHtml.trim()) {
      alert('Template HTML cannot be empty');
      return;
    }

    setSaveStatus('Saving template...');
    try {
      const payload: any = {
        accountId: selectedAccountId,
        name: formName.trim(),
        description: formDescription.trim(),
        html: formHtml,
        mappedCategories: formMappedCategories,
      };
      if (editingTemplateId) {
        payload.id = editingTemplateId;
      }

      const res = await fetch('/api/ebay/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save template');
      }

      const savedTpl: DescriptionTemplate = data.template;

      // Update category profiles with the selected mapped categories
      const updatedProfiles = categoryProfiles.map((p) => {
        const isMapped = formMappedCategories.includes(p.id);
        if (isMapped) {
          return { ...p, templateId: savedTpl.id };
        } else if (p.templateId === savedTpl.id && !isMapped) {
          // If was previously mapped to this template and unchecked, fallback to default
          return { ...p, templateId: DEFAULT_TEMPLATES[0].id };
        }
        return p;
      });

      // Save updated category profiles to API for this store
      await fetch('/api/ebay/specifics-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId, profiles: updatedProfiles }),
      });

      setCategoryProfiles(updatedProfiles);
      await loadData(selectedAccountId);

      setEditorOpen(false);
      showToast(editingTemplateId ? 'Template updated successfully!' : 'New template created successfully!');
    } catch (err: any) {
      alert(`Error saving template: ${err.message}`);
    } finally {
      setSaveStatus('');
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/ebay/templates?id=${id}&accountId=${selectedAccountId || ''}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        // Fallback any categories mapped to this deleted template to the first available template
        const fallbackId = templates.find((t) => t.id !== id)?.id || DEFAULT_TEMPLATES[0].id;
        const updatedProfiles = categoryProfiles.map((p) =>
          p.templateId === id ? { ...p, templateId: fallbackId } : p
        );

        await fetch('/api/ebay/specifics-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: selectedAccountId, profiles: updatedProfiles }),
        });

        setCategoryProfiles(updatedProfiles);
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        setDeleteId(null);
        showToast('Template removed successfully!');
      } else {
        alert(data.error || 'Failed to delete template');
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Direct Category Mapping Change from the Matrix
  const handleAssignCategoryTemplate = async (profileId: string, targetTemplateId: string) => {
    const updated = categoryProfiles.map((p) =>
      p.id === profileId ? { ...p, templateId: targetTemplateId } : p
    );
    setCategoryProfiles(updated);

    try {
      const res = await fetch('/api/ebay/specifics-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId, profiles: updated }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Category template mapping saved!');
      }
    } catch (err) {
      console.error('Failed to update category template:', err);
      showToast('Failed to save mapping', 'error');
    }
  };

  // Helper: Get list of categories mapped to a template
  const getCategoriesForTemplate = (tpl: DescriptionTemplate) => {
    if (tpl.mappedCategories && tpl.mappedCategories.length > 0) {
      return categoryProfiles.filter((p) =>
        tpl.mappedCategories!.includes(p.id) ||
        tpl.mappedCategories!.includes(p.name) ||
        p.templateId === tpl.id
      );
    }
    return categoryProfiles.filter((p) => p.templateId === tpl.id);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold transition-all transform animate-bounce ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Store Context Switcher */}
      {accounts.length > 0 && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm border border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg">
              🎨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configuring Templates For:</span>
                <span className="text-xs font-bold text-purple-400 bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-700/50">
                  {accounts.find((a) => a.id === selectedAccountId)?.storeName || 'Active Store'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Har eBay store ke liye HTML templates, custom designs aur category template mappings alag-alag save hoti hain.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-300 font-semibold">Switch Store:</label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                if (onSwitchAccount) onSwitchAccount(e.target.value);
              }}
              className="bg-slate-800 hover:bg-slate-700/80 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.storeName} ({acc.marketplace})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FileCode className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              HTML Description Templates Master
            </h1>
            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              eBay Design Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Design, edit, and organize luxury eBay HTML description templates. Assign dedicated templates to each category (e.g. Engagement Ring, Wedding Ring, Men's Ring, Bracelet, Pendant, etc.) so bulk Excel uploads auto-apply the perfect design.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Template</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setSubTab('templates')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            subTab === 'templates'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Templates ({templates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('category-mapping')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            subTab === 'category-mapping'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Category Template Mapping Matrix ({categoryProfiles.length} Categories)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('find-replace')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            subTab === 'find-replace'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Replace className="w-4 h-4 text-indigo-600" />
          <span>Description Master Editor (From ➔ To Replace)</span>
        </button>
      </div>

      {/* VIEW 1: ALL TEMPLATES GRID */}
      {subTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((tpl) => {
              const mappedCats = getCategoriesForTemplate(tpl);
              return (
                <div
                  key={tpl.id}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 shadow-2xs hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition flex items-center gap-1.5">
                          {tpl.name}
                        </h3>
                        <span className="font-mono text-[10px] text-slate-400 block">
                          ID: {tpl.id}
                        </span>
                      </div>
                      {tpl.isDefault && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                          Default
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {tpl.description || 'Custom HTML listing template for luxury jewelry.'}
                    </p>

                    {/* Mapped Categories Chips */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Mapped Categories ({mappedCats.length})
                      </span>
                      {mappedCats.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {mappedCats.map((cat) => (
                            <span
                              key={cat.id}
                              className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-semibold"
                            >
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          No category mapped directly (can be chosen manually in bulk review)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Template Card Action Buttons */}
                  <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(tpl)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                        title="Edit Template HTML & Details"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(tpl)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                        title="Duplicate as new template"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy</span>
                      </button>
                    </div>

                    {!tpl.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDeleteId(tpl.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Remove Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: CATEGORY TO TEMPLATE MAPPING MATRIX */}
      {subTab === 'category-mapping' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Per-Category HTML Template Routing Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select which HTML template each category automatically uses when importing from Excel. For example, Engagement Ring can use Template 1, Wedding Ring can use Template 2, etc.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-48">Category Name</th>
                  <th className="py-3 px-4 w-36">eBay Category ID</th>
                  <th className="py-3 px-4">Category & SKU Aliases</th>
                  <th className="py-3 px-4 w-72">Assigned HTML Template</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryProfiles.map((cat) => {
                  const assignedTpl = templates.find((t) => t.id === cat.templateId);
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          <span>{cat.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                        {cat.ebayCategoryId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {cat.aliases && cat.aliases.length > 0 ? (
                            cat.aliases.slice(0, 4).map((alias, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono"
                              >
                                {alias}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No aliases</span>
                          )}
                          {cat.aliases && cat.aliases.length > 4 && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              +{cat.aliases.length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={cat.templateId || templates[0]?.id}
                          onChange={(e) => handleAssignCategoryTemplate(cat.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: FROM -> TO MASTER DESCRIPTION FIND & REPLACE EDITOR */}
      {subTab === 'find-replace' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Replace className="w-5 h-5 text-indigo-600" />
                <span>Description Master Editor (From ➔ To Replace)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Sabhi listings ke descriptions me se koi bhi content, phone number, policy text ya HTML tag dhundh kar replace karein. Agar text kisi listing me na mile to wo listing bilkul safe aur same rahegi.
              </p>
            </div>
            {frDryRunData && (
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  frDryRunData.matchedCount > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {frDryRunData.matchedCount > 0
                  ? `✓ Found in ${frDryRunData.matchedCount} of ${frDryRunData.totalChecked} listings`
                  : 'No matching listings found'}
              </span>
            )}
          </div>

          {/* TWO MAIN BOXES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2 text-indigo-700">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>1. Find in Description (FROM) *</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  {frFromText.length} chars
                </span>
              </label>
              <textarea
                rows={9}
                value={frFromText}
                onChange={(e) => setFrFromText(e.target.value)}
                placeholder="Description se jo part replace karna hai wo yahan dalein...&#10;&#10;e.g. Free FedEx Shipping ya koi custom line..."
                className="w-full border-2 border-indigo-200 focus:border-indigo-500 rounded-xl p-3.5 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 shadow-2xs"
              />
              <p className="text-[11px] text-slate-500">
                System exact yeh text sabhi live/active listing descriptions me search karega.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2 text-emerald-700">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>2. Replace With (TO)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  {frToText.length} chars
                </span>
              </label>
              <textarea
                rows={9}
                value={frToText}
                onChange={(e) => setFrToText(e.target.value)}
                placeholder="Uske badle jo naya text ya HTML chahiye wo yahan dalein...&#10;&#10;(Khali chhodne par dhundha hua text remove/delete ho jayega)"
                className="w-full border-2 border-emerald-200 focus:border-emerald-500 rounded-xl p-3.5 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 shadow-2xs"
              />
              <p className="text-[11px] text-slate-500">
                Found text is naye content se replace ho jayega.
              </p>
            </div>
          </div>

          {/* Options & Action Bar */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={frCaseSensitive}
                  onChange={(e) => setFrCaseSensitive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Case Sensitive Match</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={frPushToEbay}
                  onChange={(e) => setFrPushToEbay(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="flex items-center gap-1 font-semibold text-blue-700">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Sync changes directly to live eBay listings</span>
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={frApplying || !frFromText || frDryRunData?.matchedCount === 0}
              onClick={async () => {
                setFrApplying(true);
                try {
                  const res = await fetch('/api/ebay/listings/bulk-replace-description', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      accountId: selectedAccountId,
                      fromText: frFromText,
                      toText: frToText,
                      caseSensitive: frCaseSensitive,
                      dryRun: false,
                      pushToEbay: frPushToEbay,
                    }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    showToast(data.message || `Replaced in ${data.updatedCount} listings!`);
                  } else {
                    showToast(data.error || 'Failed', 'error');
                  }
                } catch (err: any) {
                  showToast(err.message, 'error');
                } finally {
                  setFrApplying(false);
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md transition cursor-pointer"
            >
              {frApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <Replace className="w-4 h-4" />
                  <span>
                    Replace in All Listings{' '}
                    {frDryRunData && frDryRunData.matchedCount > 0
                      ? `(${frDryRunData.matchedCount})`
                      : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-purple-600" />
                  <span>{editingTemplateId ? 'Edit HTML Description Template' : 'Create New HTML Template'}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Customizes the eBay listing body HTML. Tags like &#123;TCW&#125;, &#123;GOLD_KT&#125;, &#123;GALLERY&#125; are automatically replaced with product values.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Switcher */}
                <div className="bg-white border border-slate-200 p-0.5 rounded-lg flex items-center shadow-2xs text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setEditorTab('code')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      editorTab === 'code' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    HTML Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('split')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer hidden md:block ${
                      editorTab === 'split' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Split View
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      editorTab === 'preview' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Live Preview
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Template Metadata (Name, Description, Category Checkboxes) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Template Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. 💍 Engagement Ring Luxury Gold Design"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Short Description / Notes
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Burgundy & Gold branding tailored for solitaires and engagement bands."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Direct Category Assignment Checklist */}
                <div className="md:col-span-2 pt-2 border-t border-slate-200/60">
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Assign This Template to Categories (Auto-Selected in Bulk Upload):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categoryProfiles.map((cat) => {
                      const isChecked = formMappedCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition ${
                            isChecked
                              ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormMappedCategories((prev) => [...prev, cat.id]);
                              } else {
                                setFormMappedCategories((prev) => prev.filter((id) => id !== cat.id));
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <span>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Clickable Quick Tags Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-purple-600" />
                    Click to Insert Dynamic Placeholder Tags:
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Inserts at cursor position in HTML editor
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-24 overflow-y-auto">
                  {AVAILABLE_TAGS.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => insertTag(t.tag)}
                      className="px-2 py-1 bg-white hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded text-[11px] font-mono text-purple-700 font-bold shadow-2xs transition cursor-pointer"
                      title={t.desc}
                    >
                      {t.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor & Preview Panes */}
              <div
                className={`grid gap-4 ${
                  editorTab === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {/* CODE PANE */}
                {(editorTab === 'code' || editorTab === 'split') && (
                  <div className="space-y-1.5 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Code className="w-3.5 h-3.5 text-purple-600" />
                        HTML Source Code
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formHtml.length} chars
                      </span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={formHtml}
                      onChange={(e) => setFormHtml(e.target.value)}
                      rows={22}
                      className="w-full p-3 font-mono text-[11px] leading-relaxed bg-slate-900 text-emerald-300 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none shadow-inner"
                      placeholder="Type or paste eBay listing HTML..."
                      spellCheck={false}
                    />
                  </div>
                )}

                {/* PREVIEW PANE */}
                {(editorTab === 'preview' || editorTab === 'split') && (
                  <div className="space-y-1.5 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        Live Preview (Rendered Sample)
                      </span>

                      {/* Device Mode Switcher */}
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('desktop')}
                          className={`p-1 rounded cursor-pointer ${
                            previewDevice === 'desktop' ? 'bg-white shadow-2xs text-purple-700 font-bold' : 'text-slate-400'
                          }`}
                          title="Desktop View (100% width)"
                        >
                          <Laptop className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('mobile')}
                          className={`p-1 rounded cursor-pointer ${
                            previewDevice === 'mobile' ? 'bg-white shadow-2xs text-purple-700 font-bold' : 'text-slate-400'
                          }`}
                          title="Mobile Device View (375px)"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div
                      className={`border border-slate-300 rounded-xl overflow-y-auto bg-white p-3 shadow-inner h-[480px] ${
                        previewDevice === 'mobile' ? 'max-w-[390px] mx-auto border-2 border-slate-700' : 'w-full'
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderDescriptionTemplate(formHtml, PREVIEW_SAMPLE_DATA),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={Boolean(saveStatus)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saveStatus || (editingTemplateId ? 'Save Changes' : 'Create Template')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-5 rounded-2xl shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-slate-900 text-sm">
                Delete HTML Template?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this template? Any category currently mapped to this template will be automatically reassigned to the default luxury template.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(deleteId)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
