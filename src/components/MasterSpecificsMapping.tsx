'use client';

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle,
  Search,
  Sparkles,
  Database,
  Lock,
  ArrowRight,
  Info,
  Layers,
  Filter,
  FileCode,
  Tag,
  FolderOpen,
  Copy,
  ExternalLink,
} from 'lucide-react';
import {
  DEFAULT_SPECIFICS_MAPPINGS,
  DEFAULT_CATEGORY_PROFILES,
  type SpecificMappingRule,
  type MasterCategoryProfile,
} from '@/lib/ebay/specifics-rules';
import { EBAY_JEWELRY_CATEGORIES } from '@/lib/ebay/constants';
import { DEFAULT_TEMPLATES, type DescriptionTemplate } from '@/lib/ebay/template-engine';

const EXCEL_COLUMNS_CATALOG = [
  'LOT',
  'CATEGORY',
  'SKU',
  'Certified',
  'GOLD_KT',
  'GOLD_COLOR',
  'GOLD_WEIGHT',
  'CENTER_DIAMOND_CLARITY',
  'CENTER_DIAMOND_COLOR',
  'CENTER_STONE_SHAPE',
  'CENTER_STONE_WEIGHT',
  'SIDE_STONE_SHAPE',
  'SIDE_STONE_WEIGHT',
  'SIDE_STONE_COLOR_CLARITY',
  'SETTING',
  'TOTAL_DIAMOND_PCS',
  'COST_USD',
  'SELLING_PRICE_USD',
  'TCW',
  'RING_SIZE',
  'CHAIN_LENGTH',
  'LENGTH',
  'STYLE',
];

export default function MasterSpecificsMapping() {
  const [profiles, setProfiles] = useState<MasterCategoryProfile[]>(DEFAULT_CATEGORY_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>('engagement_ring');
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([...DEFAULT_TEMPLATES]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');

  // Alias adder
  const [newAliasInput, setNewAliasInput] = useState('');

  // New specific adder state
  const [newField, setNewField] = useState('');
  const [newType, setNewType] = useState<'static' | 'dynamic'>('static');
  const [newValue, setNewValue] = useState('');
  const [newGroup, setNewGroup] = useState('Diamond & Gemstone');

  // Add new category profile modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEbayId, setNewCatEbayId] = useState('261975');
  const [newCatAliases, setNewCatAliases] = useState('');

  // Fetch profiles and templates on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/ebay/specifics-mapping').then((r) => r.json()),
      fetch('/api/ebay/templates').then((r) => r.json()).catch(() => ({ templates: [] })),
    ])
      .then(([mapData, tplData]) => {
        if (mapData.success && mapData.profiles && Array.isArray(mapData.profiles) && mapData.profiles.length > 0) {
          setProfiles(mapData.profiles);
          setActiveProfileId(mapData.profiles[0].id);
        }
        if (tplData.success && tplData.templates && Array.isArray(tplData.templates) && tplData.templates.length > 0) {
          setTemplates(tplData.templates);
        }
      })
      .catch((err) => console.error('Failed to load specifics mappings:', err))
      .finally(() => setLoading(false));
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  // Update active profile helper
  const updateActiveProfile = (updater: (prev: MasterCategoryProfile) => MasterCategoryProfile) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === activeProfile.id ? updater(p) : p))
    );
  };

  // Add Alias to active profile
  const handleAddAlias = () => {
    const clean = newAliasInput.trim();
    if (!clean) return;
    if (activeProfile.aliases.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      setNewAliasInput('');
      return;
    }
    updateActiveProfile((p) => ({
      ...p,
      aliases: [...p.aliases, clean],
    }));
    setNewAliasInput('');
  };

  // Remove Alias
  const handleRemoveAlias = (aliasToRemove: string) => {
    updateActiveProfile((p) => ({
      ...p,
      aliases: p.aliases.filter((a) => a !== aliasToRemove),
    }));
  };

  // Change Template for active category
  const handleTemplateChange = (templateId: string) => {
    updateActiveProfile((p) => ({
      ...p,
      templateId,
    }));
  };

  // Change eBay Category
  const handleEbayCategoryChange = (catId: string) => {
    const found = EBAY_JEWELRY_CATEGORIES.find((c) => c.id === catId);
    updateActiveProfile((p) => ({
      ...p,
      ebayCategoryId: catId,
      ebayCategoryName: found ? found.name : p.ebayCategoryName,
    }));
  };

  // Toggle Rule Type
  const handleToggleRuleType = (fieldIndex: number) => {
    updateActiveProfile((p) => {
      const updatedRules = [...p.rules];
      const current = updatedRules[fieldIndex];
      const newType = current.type === 'static' ? 'dynamic' : 'static';
      updatedRules[fieldIndex] = {
        ...current,
        type: newType,
        value: newType === 'dynamic' ? 'CENTER_DIAMOND_CLARITY' : '',
      };
      return { ...p, rules: updatedRules };
    });
  };

  // Update Rule Value
  const handleUpdateRuleValue = (fieldIndex: number, value: string) => {
    updateActiveProfile((p) => {
      const updatedRules = [...p.rules];
      updatedRules[fieldIndex] = {
        ...updatedRules[fieldIndex],
        value,
      };
      return { ...p, rules: updatedRules };
    });
  };

  // Delete Rule
  const handleDeleteRule = (fieldIndex: number) => {
    updateActiveProfile((p) => ({
      ...p,
      rules: p.rules.filter((_, idx) => idx !== fieldIndex),
    }));
  };

  // Add New Rule to active category
  const handleAddRule = () => {
    if (!newField.trim() || !newValue.trim()) {
      alert('Please enter both the Specific Aspect Name and Value/Column');
      return;
    }
    if (activeProfile.rules.some((r) => r.field.toLowerCase() === newField.trim().toLowerCase())) {
      alert(`The attribute "${newField.trim()}" is already defined for this category.`);
      return;
    }

    updateActiveProfile((p) => ({
      ...p,
      rules: [
        ...p.rules,
        {
          field: newField.trim(),
          type: newType,
          value: newValue.trim(),
          category: newGroup,
        },
      ],
    }));

    setNewField('');
    setNewValue('');
  };

  // Create New Category Profile
  const handleCreateCategory = () => {
    if (!newCatName.trim()) {
      alert('Please enter a Category Name');
      return;
    }

    const id = newCatName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (profiles.some((p) => p.id === id)) {
      alert('A category with this identifier already exists');
      return;
    }

    const parsedAliases = newCatAliases
      .split(/[,;\n]/)
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);

    if (!parsedAliases.includes(newCatName.toLowerCase().trim())) {
      parsedAliases.unshift(newCatName.toLowerCase().trim());
    }

    const foundEbay = EBAY_JEWELRY_CATEGORIES.find((c) => c.id === newCatEbayId);

    const newProfile: MasterCategoryProfile = {
      id,
      name: newCatName.trim(),
      ebayCategoryId: newCatEbayId,
      ebayCategoryName: foundEbay ? foundEbay.name : newCatName.trim(),
      aliases: parsedAliases,
      templateId: 'tpl-livuniq-luxury',
      rules: [...DEFAULT_SPECIFICS_MAPPINGS],
      isDefault: false,
    };

    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(id);
    setShowAddCategoryModal(false);
    setNewCatName('');
    setNewCatAliases('');
  };

  // Delete Category Profile
  const handleDeleteCategory = (catId: string) => {
    if (profiles.length <= 1) {
      alert('At least one category profile must remain.');
      return;
    }
    const cat = profiles.find((p) => p.id === catId);
    if (!confirm(`Are you sure you want to delete category "${cat?.name || catId}"?`)) return;

    const remaining = profiles.filter((p) => p.id !== catId);
    setProfiles(remaining);
    setActiveProfileId(remaining[0].id);
  };

  // Save All Profiles to backend
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      const res = await fetch('/api/ebay/specifics-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('✅ All Category Item Specifics & Templates saved successfully!');
        setTimeout(() => setSaveStatus(''), 4500);
      } else {
        alert(data.error || 'Failed to save mappings');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    if (
      confirm(
        'Are you sure you want to reset all 8 category profiles (Engagement Ring, Wedding Ring, Wedding Ring Set, Mens Ring, Bracelet, Earrings, Pendant, Necklace) to default settings?'
      )
    ) {
      setProfiles(DEFAULT_CATEGORY_PROFILES);
      setActiveProfileId('engagement_ring');
      setSaveStatus('Reset to standard recommended defaults (Click "Save All Changes" to persist)');
      setTimeout(() => setSaveStatus(''), 4500);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-sm font-medium">Loading Category Master Mappings...</p>
      </div>
    );
  }

  // Filter rules for active category
  const filteredRules = activeProfile.rules.filter((r) => {
    const matchesSearch =
      r.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'All' || r.category === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const availableGroups = Array.from(
    new Set(activeProfile.rules.map((r) => r.category || 'General Specifics'))
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Category Master
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                Item Specifics & Template Master Mapping
              </h1>
            </div>
            <p className="text-xs text-slate-500 max-w-3xl">
              Har product type (Engagement Ring, Wedding Band, Wedding Ring Set, Men&apos;s Ring, Bracelet, Earrings, Pendant, Necklace) ke liye alag-alag item specifics rules, category keywords mapping, aur HTML description templates configure karein.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-fade-in font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{saveStatus}</span>
          </div>
        )}
      </div>

      {/* Category Tabs Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Select Product Category Profile ({profiles.length})</span>
          </div>
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Add New Category
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {profiles.map((p) => {
            const isActive = p.id === activeProfile.id;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProfileId(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{p.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.rules.length} specs
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Category Configuration Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Category Aliases & HTML Template Setup */}
        <div className="space-y-6">
          {/* 1. Category Profile Identity */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Category Identity</h3>
              </div>
              {profiles.length > 1 && (
                <button
                  onClick={() => handleDeleteCategory(activeProfile.id)}
                  className="text-[11px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 p-1 hover:bg-red-50 rounded transition cursor-pointer"
                  title="Delete this category profile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={activeProfile.name}
                onChange={(e) => updateActiveProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                eBay Jewelry Category ID
              </label>
              <select
                value={activeProfile.ebayCategoryId}
                onChange={(e) => handleEbayCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white"
              >
                {EBAY_JEWELRY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Category Keyword / Alias Mapping */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Excel &amp; SKU Aliases</h3>
                <p className="text-[11px] text-slate-500">
                  Excel me CATEGORY ya SKU me ye text aane par auto ye Category apply hogi.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {activeProfile.aliases.map((alias) => (
                <span
                  key={alias}
                  className="bg-white border border-purple-200 text-purple-900 text-xs px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono shadow-2xs"
                >
                  <span>{alias}</span>
                  <button
                    onClick={() => handleRemoveAlias(alias)}
                    className="hover:text-red-600 text-slate-400 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
              {activeProfile.aliases.length === 0 && (
                <span className="text-xs text-slate-400 italic">No aliases defined</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Ring, bbx, wedding band"
                value={newAliasInput}
                onChange={(e) => setNewAliasInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white"
              />
              <button
                type="button"
                onClick={handleAddAlias}
                disabled={!newAliasInput.trim()}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Add Alias
              </button>
            </div>
            <div className="text-[10px] text-slate-500 bg-purple-50 p-2 rounded-lg border border-purple-100">
              💡 <strong>Example:</strong> Excel column me <code>Ring</code> ya <code>wedding ring</code> ho to yahi category select hogi: <code>Ring = {activeProfile.name}</code>.
            </div>
          </div>

          {/* 3. HTML Description Template for this Category */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileCode className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">HTML Description Template</h3>
                <p className="text-[11px] text-slate-500">
                  Is category ke listings ke liye dedicated HTML layout.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Assigned HTML Template
              </label>
              <select
                value={activeProfile.templateId || templates[0]?.id}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const currentTpl =
                templates.find((t) => t.id === activeProfile.templateId) || templates[0];
              return (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Active Template: {currentTpl?.name}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">{currentTpl?.description}</p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right 2 Cols: Item Specifics Rules Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>💎 Item Specifics for {activeProfile.name}</span>
                <span className="text-[11px] bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded-full font-bold">
                  {activeProfile.rules.length} attributes
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                eBay ko bheje jane wale attributes: 1-click me Static (fixed value) ya Dynamic (Excel column) switch karein.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter attributes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white w-44"
                />
              </div>

              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
              >
                <option value="All">All Groups</option>
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Specifics Rules Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">eBay Specific Name</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Mapped Value / Excel Column</th>
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-2 text-center w-10">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((rule, idx) => {
                  const originalIndex = activeProfile.rules.findIndex((r) => r.field === rule.field);
                  const isStatic = rule.type === 'static';

                  return (
                    <tr key={rule.field} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {rule.field}
                      </td>

                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleType(originalIndex)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            isStatic
                              ? 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200'
                          }`}
                          title="Click to toggle between Static and Dynamic"
                        >
                          {isStatic ? (
                            <>
                              <Lock className="w-2.5 h-2.5" /> Static
                            </>
                          ) : (
                            <>
                              <Database className="w-2.5 h-2.5" /> Dynamic
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-2 px-3">
                        {isStatic ? (
                          <input
                            type="text"
                            value={rule.value}
                            onChange={(e) => handleUpdateRuleValue(originalIndex, e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                            placeholder="Enter static text..."
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={rule.value}
                              onChange={(e) => handleUpdateRuleValue(originalIndex, e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-purple-300 rounded-lg bg-purple-50/50 font-mono text-purple-900 font-semibold"
                            >
                              <option value="">-- Select Excel Header --</option>
                              {EXCEL_COLUMNS_CATALOG.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {rule.category || 'General'}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(originalIndex)}
                          className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
                          title="Delete attribute"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredRules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No attributes matching your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Add Custom Specific Row */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                Add New Specific to {activeProfile.name}
              </span>
              <span className="text-[10px] text-slate-500">
                Custom specific attribute eBay par transmit hoga.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Specific Name (e.g. Closure)"
                value={newField}
                onChange={(e) => setNewField(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              />

              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
              >
                <option value="static">Static Value</option>
                <option value="dynamic">Dynamic (Excel Column)</option>
              </select>

              {newType === 'static' ? (
                <input
                  type="text"
                  placeholder="Static Value (e.g. Lobster)"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              ) : (
                <select
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-xs bg-white font-mono font-semibold text-purple-900"
                >
                  <option value="">-- Select Excel Column --</option>
                  {EXCEL_COLUMNS_CATALOG.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleAddRule}
                disabled={!newField.trim() || !newValue.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                + Add Attribute
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Add New Product Category Profile
              </h3>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Category Name (Display Name)
              </label>
              <input
                type="text"
                placeholder="e.g. Brooch, Anklet, Tennis Necklace"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                eBay Jewelry Category
              </label>
              <select
                value={newCatEbayId}
                onChange={(e) => setNewCatEbayId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-medium"
              >
                {EBAY_JEWELRY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Excel CATEGORY / SKU Aliases (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g. brooch, pin, brx"
                value={newCatAliases}
                onChange={(e) => setNewCatAliases(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Excel me inme se koi bhi word aane par ye category apply ho jayegi.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCatName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Create Category Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
