'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Code,
  Eye,
  Sparkles,
  Save,
  Tag,
  Image as ImageIcon,
  CheckCircle,
  Copy,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  DescriptionTemplate,
  ListingTemplateData,
  renderDescriptionTemplate,
  cleanAndDecodeDescription,
  DEFAULT_TEMPLATES,
} from '@/lib/ebay/template-engine';

interface HtmlTemplateSectionProps {
  value: string;
  onChange: (compiledHtml: string) => void;
  listingData: ListingTemplateData;
}

export default function HtmlTemplateSection({
  value,
  onChange,
  listingData,
}: HtmlTemplateSectionProps) {
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([...DEFAULT_TEMPLATES]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl-livuniq-luxury');
  const [rawTemplate, setRawTemplate] = useState<string>(
    cleanAndDecodeDescription(value) || DEFAULT_TEMPLATES[0].html
  );
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingStatus, setSavingStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved templates from API
  useEffect(() => {
    fetch('/api/ebay/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
        }
      })
      .catch((err) => console.error('Failed to load templates:', err));
  }, []);

  // Sync initial value if empty or update when listing description value loads
  useEffect(() => {
    if (!value && rawTemplate) {
      const rendered = renderDescriptionTemplate(rawTemplate, listingData);
      onChange(rendered);
    } else if (value) {
      const cleaned = cleanAndDecodeDescription(value);
      setRawTemplate(cleaned);
      const compiled = renderDescriptionTemplate(cleaned, listingData);
      onChange(compiled);
    }
  }, [value]);

  // When raw template or listing data changes, compile to parent onChange
  const handleTemplateChange = (newRaw: string) => {
    setRawTemplate(newRaw);
    const compiled = renderDescriptionTemplate(newRaw, listingData);
    onChange(compiled);
  };

  // Select a preset template
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const found = templates.find((t) => t.id === id);
    if (found) {
      handleTemplateChange(found.html);
    }
  };

  // Insert a tag at cursor position
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleTemplateChange(rawTemplate + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = rawTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const updated = before + tag + after;

    handleTemplateChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Compile current preview
  const compiledHtml = renderDescriptionTemplate(rawTemplate, listingData);

  // Copy HTML
  const handleCopy = () => {
    navigator.clipboard.writeText(compiledHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save custom template
  const handleSaveCustomTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setSavingStatus('Saving...');
    try {
      const res = await fetch('/api/ebay/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          description: 'Custom seller HTML template',
          html: rawTemplate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => [...prev, data.template]);
        setSelectedTemplateId(data.template.id);
        setSaveModalOpen(false);
        setNewTemplateName('');
        setSavingStatus('');
      } else {
        alert(data.error || 'Failed to save template');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingStatus('');
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      const res = await fetch(`/api/ebay/templates?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (selectedTemplateId === id) {
          handleSelectTemplate(DEFAULT_TEMPLATES[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template Header & Actions */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Template Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="font-bold text-slate-700 text-xs">HTML Template:</span>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle & Save Custom Template Button */}
        <div className="flex items-center space-x-2">
          <div className="bg-slate-200 p-0.5 rounded-lg flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center space-x-1 transition cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center space-x-1 transition cursor-pointer ${
                viewMode === 'code'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>HTML Code</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSaveModalOpen(true)}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-2xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            <span>Save as New Template</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-2xs cursor-pointer"
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy HTML</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Variable Insert Bar (Visible in Code Mode) */}
      {viewMode === 'code' && (
        <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Click to Insert Dynamic Attributes & Images into your HTML:</span>
            </span>
            <span className="text-[11px] text-blue-700 font-medium">Auto-populates from listing values</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {/* Core Fields */}
            <button
              type="button"
              onClick={() => insertTag('{{title}}')}
              className="bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer"
            >
              + &#123;&#123;title&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{price}}')}
              className="bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer"
            >
              + &#123;&#123;price&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{sku}}')}
              className="bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer"
            >
              + &#123;&#123;sku&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{condition}}')}
              className="bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer"
            >
              + &#123;&#123;condition&#125;&#125;
            </button>

            {/* Images */}
            <button
              type="button"
              onClick={() => insertTag('{{main_image}}')}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer flex items-center gap-1"
            >
              <ImageIcon className="w-3 h-3 text-amber-600" />
              <span>+ &#123;&#123;main_image&#125;&#125;</span>
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{DYNAMIC_GALLERY}}')}
              className="bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-400 font-bold px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Outputs your interactive pure-CSS #gallBlock matching the exact number of uploaded images (3 if 3, 10 if 10)"
            >
              <Sparkles className="w-3 h-3 text-purple-700" />
              <span>+ &#123;&#123;DYNAMIC_GALLERY&#125;&#125; (#gallBlock)</span>
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{IMAGES_GALLERY}}')}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer flex items-center gap-1"
            >
              <ImageIcon className="w-3 h-3 text-amber-600" />
              <span>+ &#123;&#123;IMAGES_GALLERY&#125;&#125;</span>
            </button>

            {/* Specifics Table */}
            <button
              type="button"
              onClick={() => insertTag('{{SPECIFICS_TABLE}}')}
              className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1"
            >
              <Tag className="w-3 h-3 text-purple-600" />
              <span>+ &#123;&#123;SPECIFICS_TABLE&#125;&#125;</span>
            </button>

            {/* Key Jewelry Specifics */}
            <button
              type="button"
              onClick={() => insertTag('{{specific.Metal Purity}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Metal Purity&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Metal}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Metal&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Total Carat Weight}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Total Carat Weight&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Main Stone Shape}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Main Stone Shape&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Diamond Clarity Grade}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Diamond Clarity Grade&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Diamond Color Grade}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Diamond Color Grade&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Ring Size}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Ring Size&#125;&#125;
            </button>
            <button
              type="button"
              onClick={() => insertTag('{{specific.Certification}}')}
              className="bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
            >
              + &#123;&#123;specific.Certification&#125;&#125;
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      {viewMode === 'preview' ? (
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-[11px] text-slate-500 font-medium">
            <span>Rendered Live Preview (How it will display on eBay)</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Mobile & Desktop Ready
            </span>
          </div>
          <div className="p-4 max-h-[550px] overflow-y-auto">
            <div
              className="prose max-w-none text-xs"
              dangerouslySetInnerHTML={{ __html: compiledHtml }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium px-1">
            <span>Raw HTML with dynamic tags:</span>
            <span>{rawTemplate.length} characters</span>
          </div>
          <textarea
            ref={textareaRef}
            rows={16}
            value={rawTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full border border-slate-300 rounded-xl p-3.5 text-xs font-mono bg-slate-900 text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste your custom eBay HTML template here..."
            spellCheck={false}
          />
        </div>
      )}

      {/* Save Template Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Save className="w-4 h-4 text-blue-600" />
              <span>Save Custom HTML Template</span>
            </h3>
            <p className="text-xs text-slate-600">
              Give this template a name so you can instantly reuse it on all future ring listings.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g. My Custom Luxury Ring Template"
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomTemplate}
                disabled={!newTemplateName.trim() || Boolean(savingStatus)}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg cursor-pointer shadow-xs"
              >
                {savingStatus || 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
