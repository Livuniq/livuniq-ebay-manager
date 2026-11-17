'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  FolderOpen,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Eye,
  FileText,
  SlidersHorizontal,
  Settings2,
  Plus,
  Trash2,
  HelpCircle,
  Video,
  Clock,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConnectedAccount, EbayListing } from '@/lib/ebay/types';
import BusinessPoliciesSelector from './BusinessPoliciesSelector';
import { EBAY_JEWELRY_CATEGORIES } from '@/lib/ebay/constants';
import { renderDescriptionTemplate, DEFAULT_TEMPLATES, isVideoMedia } from '@/lib/ebay/template-engine';
import {
  DEFAULT_SPECIFICS_MAPPINGS,
  DEFAULT_CATEGORY_PROFILES,
  findMatchingCategoryProfile,
  isEbayItemSpecific,
  type SpecificMappingRule,
  type MasterCategoryProfile,
} from '@/lib/ebay/specifics-rules';

interface BulkListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount?: ConnectedAccount | null;
  onBulkCompleted: (newListings: EbayListing[]) => void;
}

// Format float numbers with 2 decimal places (e.g. 0.5 -> 0.50, 1.5 -> 1.50, 0.3 -> 0.30)
export function formatFloat2Decimals(val: any, forceWeight = false): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  const num = parseFloat(str);
  if (isNaN(num)) return str;

  // If forceWeight is true, or if original string/number is a float (contains '.' or is non-integer):
  if (forceWeight || str.includes('.') || !Number.isInteger(num)) {
    return num.toFixed(2);
  }
  return str;
}

// Clean and normalize titles to ensure carat floats have 2 decimals (0.5 ct -> 0.50 ct, 1.5ct -> 1.50 ct)
export function normalizeCaratInTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\b(\d+\.\d)\s*ct\b/gi, (_, n) => `${parseFloat(n).toFixed(2)} ct`)
    .replace(/\b(\d+\.\d)\s*carat\b/gi, (_, n) => `${parseFloat(n).toFixed(2)} carat`);
}

interface ParsedListingRow {
  index: number;
  sku: string;
  originalSku?: string;
  title: string;
  price: number;
  quantity: number;
  categoryId: string;
  categoryName: string;
  conditionId: string;
  sellerNotes: string;
  imageNames: string[];
  matchedImageUrls: string[];
  matchedFolderName?: string;
  videoUrl?: string;
  categoryProfileId?: string;
  templateId?: string;
  itemSpecifics: Record<string, string>;
  templateAttributes?: Record<string, string>;
  status: 'READY' | 'WARNING' | 'ERROR';
  statusMessage?: string;
}

interface StagedImage {
  filename: string;
  folderName?: string;
  relativePath?: string;
  url: string;
  size?: number;
}

interface StagedVideo {
  filename: string;
  folderName?: string;
  relativePath?: string;
  url: string;
}

export interface ColumnMappingConfig {
  priceCol: string;
  skuCol: string;
  categoryCol: string;
  quantityCol: string;
  titleCol: string;
  conditionCol: string;
  tcwCol: string;
}

export interface AttributeMappingItem {
  attribute: string;
  column: string;
}

const DEFAULT_COLUMN_MAPPING: ColumnMappingConfig = {
  priceCol: 'SELLING_PRICE_USD',
  skuCol: 'SKU',
  categoryCol: 'CATEGORY',
  quantityCol: '',
  titleCol: '',
  conditionCol: '',
  tcwCol: 'AUTO_SUM',
};

const DEFAULT_ATTRIBUTE_MAPPINGS: AttributeMappingItem[] = [
  { attribute: 'GOLD_KT', column: 'GOLD_KT' },
  { attribute: 'GOLD_COLOR', column: 'GOLD_COLOR' },
  { attribute: 'GOLD_WEIGHT', column: 'GOLD_WEIGHT' },
  { attribute: 'CENTER_STONE_SHAPE', column: 'CENTER_STONE_SHAPE' },
  { attribute: 'CENTER_STONE_WEIGHT', column: 'CENTER_STONE_WEIGHT' },
  { attribute: 'CENTER_DIAMOND_COLOR', column: 'CENTER_DIAMOND_COLOR' },
  { attribute: 'CENTER_DIAMOND_CLARITY', column: 'CENTER_DIAMOND_CLARITY' },
  { attribute: 'SIDE_STONE_SHAPE', column: 'SIDE_STONE_SHAPE' },
  { attribute: 'SIDE_STONE_WEIGHT', column: 'SIDE_STONE_WEIGHT' },
  { attribute: 'SIDE_STONE_COLOR_CLARITY', column: 'SIDE_STONE_COLOR_CLARITY' },
  { attribute: 'SETTING', column: 'SETTING' },
  { attribute: 'TOTAL_DIAMOND_PCS', column: 'TOTAL_DIAMOND_PCS' },
  { attribute: 'Certified', column: 'Certified' },
  { attribute: 'COST_USD', column: 'COST_USD' },
  { attribute: 'LOT', column: 'LOT' },
];

const DEFAULT_EXCEL_HEADERS: string[] = [
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
];

export default function BulkListingModal({
  isOpen,
  onClose,
  activeAccount,
  onBulkCompleted,
}: BulkListingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Excel & Folder states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedListingRow[]>([]);
  const [folderPathInput, setFolderPathInput] = useState('');
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [stagedVideos, setStagedVideos] = useState<StagedVideo[]>([]);
  const [imageFetchMode, setImageFetchMode] = useState<'path' | 'picker'>('picker');
  const [scanningFolder, setScanningFolder] = useState(false);
  const [uploadingBrowserImages, setUploadingBrowserImages] = useState(false);

  // Column & Attribute Mapping states
  const [excelHeaders, setExcelHeaders] = useState<string[]>(DEFAULT_EXCEL_HEADERS);
  const [rawJsonRows, setRawJsonRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMappingConfig>(DEFAULT_COLUMN_MAPPING);
  const [attributeMappings, setAttributeMappings] = useState<AttributeMappingItem[]>(DEFAULT_ATTRIBUTE_MAPPINGS);
  const [showMappingDetails, setShowMappingDetails] = useState<boolean>(true);
  const [newCustomAttr, setNewCustomAttr] = useState<string>('');
  const [newCustomCol, setNewCustomCol] = useState<string>('');

  // Step 3: Policies & Template states
  const [shippingPolicyId, setShippingPolicyId] = useState(activeAccount?.shippingPolicyId || '6269965000');
  const [shippingPolicyName, setShippingPolicyName] = useState(activeAccount?.shippingPolicyName || '');
  const [returnPolicyId, setReturnPolicyId] = useState(activeAccount?.returnPolicyId || '6269963000');
  const [returnPolicyName, setReturnPolicyName] = useState(activeAccount?.returnPolicyName || '');
  const [paymentPolicyId, setPaymentPolicyId] = useState(activeAccount?.paymentPolicyId || '6269966000');
  const [paymentPolicyName, setPaymentPolicyName] = useState(activeAccount?.paymentPolicyName || '');

  // Template states
  const [templateList, setTemplateList] = useState<any[]>([...DEFAULT_TEMPLATES]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl-1794598343866');

  const [masterSpecifics, setMasterSpecifics] = useState<SpecificMappingRule[]>(DEFAULT_SPECIFICS_MAPPINGS);
  const [categoryProfiles, setCategoryProfiles] = useState<MasterCategoryProfile[]>(DEFAULT_CATEGORY_PROFILES);

  // Publish Mode: 'DRAFT' (Local Review), 'SCHEDULE' (Time Par Live), 'NOW' (Direct Live)
  const [publishMode, setPublishMode] = useState<'DRAFT' | 'SCHEDULE' | 'NOW'>('DRAFT');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [scheduleDirectOnEbay, setScheduleDirectOnEbay] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/ebay/templates')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.templates && d.templates.length > 0) {
          setTemplateList(d.templates);
          if (d.templates.some((t: any) => t.id === 'tpl-1794598343866')) {
            setSelectedTemplateId('tpl-1794598343866');
          } else {
            setSelectedTemplateId(d.templates[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load templates:', err));

    fetch('/api/ebay/specifics-mapping')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          if (d.rules && Array.isArray(d.rules) && d.rules.length > 0) {
            setMasterSpecifics(d.rules);
          }
          if (d.profiles && Array.isArray(d.profiles) && d.profiles.length > 0) {
            setCategoryProfiles(d.profiles);
          }
        }
      })
      .catch((err) => console.error('Failed to load specifics mapping in bulk modal:', err));
  }, []);

  // Progress & Execution
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const excelInputRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download Sample Excel Template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    window.open(`/api/ebay/bulk/sample-template?format=${format}`, '_blank');
  };

  // Core row parser using current Column & Attribute Mapping
  const parseRowsWithMapping = (
    validJsonRows: any[],
    colMap: ColumnMappingConfig,
    attrMap: AttributeMappingItem[]
  ): ParsedListingRow[] => {
    return validJsonRows.map((row, idx) => {
      const rawSku = String(
        (colMap.skuCol && row[colMap.skuCol]) ||
        row['SKU'] ||
        row['sku'] ||
        row['CustomLabel'] ||
        `SKU-${idx + 1}`
      ).trim();
      const rawSkuLower = rawSku.toLowerCase();

      // Suffix detection requested by user:
      // bbx -> Wedding Band (261977)
      // ssx -> Engagement & Wedding Ring Set (261976)
      // mmx -> Men's Ring (137856)
      let detectedCategoryType: 'BAND' | 'RING_SET' | 'MENS_RING' | null = null;
      if (rawSkuLower.endsWith('bbx') || /[-_]?bbx$/i.test(rawSku)) {
        detectedCategoryType = 'BAND';
      } else if (rawSkuLower.endsWith('ssx') || /[-_]?ssx$/i.test(rawSku)) {
        detectedCategoryType = 'RING_SET';
      } else if (rawSkuLower.endsWith('mmx') || /[-_]?mmx$/i.test(rawSku)) {
        detectedCategoryType = 'MENS_RING';
      }

      // Strip bbx / ssx / mmx from SKU so that image folder matches (e.g. P834bbx -> P834)
      let cleanSku = rawSku;
      if (detectedCategoryType) {
        cleanSku = rawSku.replace(/[-_]?(bbx|ssx|mmx)$/i, '').trim();
        if (cleanSku === rawSku) {
          cleanSku = rawSku.replace(/[-_]?(bbx|ssx|mmx)/gi, '').trim();
        }
      }
      const sku = cleanSku;

      // Price extraction (using user's mapped column, e.g. SELLING_PRICE_USD)
      const rawPrice = colMap.priceCol
        ? row[colMap.priceCol]
        : (row['SELLING_PRICE_USD'] ?? row['SellingPrice'] ?? row['Price'] ?? 0);
      const price = parseFloat(String(rawPrice ?? 0).replace(/[^0-9.]/g, '')) || 0;

      // Quantity
      const rawQty = colMap.quantityCol ? row[colMap.quantityCol] : row['Quantity'];
      const quantity = parseInt(String(rawQty || '1')) || 1;

      // Category mapping
      const rawCat = String(
        (colMap.categoryCol && row[colMap.categoryCol]) ||
        row['CATEGORY'] ||
        row['Category'] ||
        row['category'] ||
        ''
      ).trim();
      const rawCatLower = rawCat.toLowerCase();

      // Match against Master Category Profiles (handles "engagement ring", "wedding ring", "wedding ring set", "mens ring", "bracelet", "earrings", "pendant", "necklace" and any user custom categories/aliases)
      const matchedProfile = findMatchingCategoryProfile(
        { category: rawCat, sku, originalSku: rawSku, title: String(row['Title'] || row['title'] || '') },
        categoryProfiles
      );

      let categoryId = String(row['CategoryID'] || row['categoryId'] || '').trim();
      let categoryName = String(row['CategoryName'] || row['categoryName'] || '').trim();
      let productType = matchedProfile?.name || 'Engagement Ring';
      let catLabel = matchedProfile?.name || 'Engagement Ring';

      if (!categoryId && matchedProfile) {
        categoryId = matchedProfile.ebayCategoryId;
        categoryName = matchedProfile.ebayCategoryName || '';
      }

      if (detectedCategoryType === 'BAND') {
        categoryId = '261977';
        categoryName = '/Jewelry & Watches/Engagement & Wedding/Wedding & Anniversary Bands';
        productType = 'Wedding Band';
        catLabel = 'Wedding Band';
      } else if (detectedCategoryType === 'RING_SET') {
        categoryId = '261976';
        categoryName = '/Jewelry & Watches/Engagement & Wedding/Engagement & Wedding Ring Sets';
        productType = 'Engagement & Wedding Ring Set';
        catLabel = 'Wedding Ring Set';
      } else if (detectedCategoryType === 'MENS_RING') {
        categoryId = '137856';
        categoryName = "/Jewelry & Watches/Men's Jewelry/Rings";
        productType = "Men's Ring";
        catLabel = "Men's Ring";
      } else if (!categoryId) {
        if (rawCatLower.includes('engagement') || rawCatLower.includes('wedding ring')) {
          categoryId = '261975';
          categoryName = '/Jewelry & Watches/Engagement & Wedding/Engagement Rings';
          productType = 'Engagement Ring';
          catLabel = 'Engagement Ring';
        } else if (rawCatLower.includes('band') || rawCatLower.includes('anniversary')) {
          categoryId = '261977';
          categoryName = '/Jewelry & Watches/Engagement & Wedding/Wedding & Anniversary Bands';
          productType = 'Wedding Band';
          catLabel = 'Wedding Band';
        } else if (rawCatLower.includes('earring')) {
          categoryId = '261990';
          categoryName = '/Jewelry & Watches/Fine Jewelry/Earrings';
          productType = 'Earrings';
          catLabel = 'Earrings';
        } else if (rawCatLower.includes('necklace') || rawCatLower.includes('pendant')) {
          categoryId = '261993';
          categoryName = '/Jewelry & Watches/Fine Jewelry/Necklaces & Pendants';
          productType = 'Necklace & Pendant';
          catLabel = 'Pendant';
        } else if (rawCatLower.includes('bracelet')) {
          categoryId = '261988';
          categoryName = '/Jewelry & Watches/Fine Jewelry/Bracelets & Charms';
          productType = 'Bracelet';
          catLabel = 'Bracelet';
        } else {
          categoryId = '261994';
          categoryName = '/Jewelry & Watches/Fine Jewelry/Rings';
          productType = 'Ring';
          catLabel = 'Ring';
        }
      }

      // Carat weight calculation
      const centerWt = parseFloat(row['CENTER_STONE_WEIGHT']) || 0;
      const sideWt = parseFloat(row['SIDE_STONE_WEIGHT']) || 0;
      let tcwVal = '';
      if (colMap.tcwCol && colMap.tcwCol !== 'AUTO_SUM' && row[colMap.tcwCol]) {
        tcwVal = formatFloat2Decimals(row[colMap.tcwCol], true);
      } else {
        const sum = centerWt + sideWt;
        tcwVal = sum > 0 ? sum.toFixed(2) : (centerWt > 0 ? centerWt.toFixed(2) : '');
      }

      // Title generation
      let title = colMap.titleCol && row[colMap.titleCol] ? String(row[colMap.titleCol]).trim() : '';
      if (!title) {
        title = String(row['Title'] || row['title'] || '').trim();
      }
      if (!title) {
        const shape = row['CENTER_STONE_SHAPE'] || '';
        const rawCenterWt = row['CENTER_STONE_WEIGHT'];
        const wt = rawCenterWt !== undefined && rawCenterWt !== null && String(rawCenterWt).trim() !== ''
          ? formatFloat2Decimals(rawCenterWt, true)
          : '';
        const kt = row['GOLD_KT'] || '14k';
        const color = row['GOLD_COLOR'] || 'Yellow';
        const cert = row['Certified'] || '';
        const itemKind = catLabel.toLowerCase().includes('ring') || catLabel.toLowerCase().includes('band') ? catLabel : `${catLabel} Ring`;
        title = `${wt ? `${wt} ct ` : ''}${shape ? `${shape} ` : ''}Lab Grown Diamond ${itemKind} ${kt} ${color} Gold${cert ? ` ${cert}` : ''}`;
        title = title.replace(/\s+/g, ' ').trim();
        if (title.length > 80) title = title.slice(0, 80);
      } else {
        title = normalizeCaratInTitle(title);
      }

      const conditionId = colMap.conditionCol && row[colMap.conditionCol]
        ? String(row[colMap.conditionCol]).trim()
        : String(row['ConditionID'] || '1000').trim();

      const sellerNotes = String(row['SellerNotes'] || 'Brand new in original luxury packaging with certificate & tags').trim();

      // Dynamic Item Specifics strictly for legitimate eBay aspects
      const itemSpecifics: Record<string, string> = {
        'Brand': 'Livuniq®',
        'Type': productType,
        'Department': detectedCategoryType === 'MENS_RING' || productType === "Men's Ring" ? 'Men' : 'Women',
        'Main Stone': 'Diamond',
        'Main Stone Shape': String(row['CENTER_STONE_SHAPE'] || 'Oval'),
        'Total Carat Weight': tcwVal ? `${tcwVal} carat` : '1.00 carat',
        'Metal': `${row['GOLD_COLOR'] || 'Yellow'} Gold`,
        'Metal Purity': String(row['GOLD_KT'] || '14k'),
        'Base Metal': 'Gold',
        'Ring Size': '7',
        'Cut Grade': 'Excellent',
      };

      // 1. Apply Category-Specific Profile rules (or Master Specifics rules fallback)
      const activeRules = (matchedProfile && matchedProfile.rules && matchedProfile.rules.length > 0)
        ? matchedProfile.rules
        : masterSpecifics;

      for (const rule of activeRules) {
        if (!rule.field) continue;
        if (rule.type === 'static' && rule.value) {
          itemSpecifics[rule.field] = rule.value;
        } else if (rule.type === 'dynamic' && rule.value) {
          if (rule.value === 'TCW') {
            itemSpecifics[rule.field] = tcwVal ? `${tcwVal} carat` : (itemSpecifics[rule.field] || '1.00 carat');
          } else {
            const rawVal = row[rule.value];
            if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
              const isWeight = /weight|tcw|carat/i.test(rule.field) || /weight|tcw|carat/i.test(rule.value);
              itemSpecifics[rule.field] = formatFloat2Decimals(rawVal, isWeight);
            }
          }
        }
      }

      // 2. Apply user-configured attribute mappings (only if valid eBay aspect)
      for (const item of attrMap) {
        if (item.attribute && item.column && row[item.column] !== undefined && row[item.column] !== null) {
          const rawVal = row[item.column];
          const isWeightField = /weight|tcw|carat/i.test(item.attribute) || /weight|tcw|carat/i.test(item.column);
          const formattedVal = formatFloat2Decimals(rawVal, isWeightField);
          if (isEbayItemSpecific(item.attribute)) {
            itemSpecifics[item.attribute] = formattedVal;
          }
        }
      }

      // Filter itemSpecifics so strictly ONLY genuine eBay specifics are included (NO raw Excel columns!)
      const cleanItemSpecifics: Record<string, string> = {};
      for (const [k, v] of Object.entries(itemSpecifics)) {
        if (isEbayItemSpecific(k) && v !== undefined && v !== null && String(v).trim() !== '') {
          cleanItemSpecifics[k] = String(v).trim();
        }
      }

      // Build templateAttributes dictionary for HTML description template placeholders
      const sideColorClarity = String(row['SIDE_STONE_COLOR_CLARITY'] || '');
      const parts = sideColorClarity.includes('/') ? sideColorClarity.split('/') : [];
      const sideColor = parts[0]?.trim() || '';
      const sideClarity = parts[1]?.trim() || '';

      const templateAttributes: Record<string, string> = {
        title,
        price: price ? price.toFixed(2) : '',
        sku,
        quantity: quantity.toString(),
        category: categoryName,
        lot: String(row['LOT'] || ''),
        cost_usd: String(row['COST_USD'] || ''),
        selling_price_usd: price ? price.toFixed(2) : '',
        gold_kt: String(row['GOLD_KT'] || ''),
        gold_color: String(row['GOLD_COLOR'] || ''),
        gold_weight: formatFloat2Decimals(row['GOLD_WEIGHT'], true),
        center_stone_shape: String(row['CENTER_STONE_SHAPE'] || ''),
        center_stone_weight: formatFloat2Decimals(row['CENTER_STONE_WEIGHT'], true),
        center_diamond_color: String(row['CENTER_DIAMOND_COLOR'] || ''),
        center_diamond_clarity: String(row['CENTER_DIAMOND_CLARITY'] || ''),
        side_stone_shape: String(row['SIDE_STONE_SHAPE'] || ''),
        side_stone_weight: formatFloat2Decimals(row['SIDE_STONE_WEIGHT'], true),
        side_stone_color_clarity: sideColorClarity,
        side_color: sideColor,
        side_clarity: sideClarity,
        setting: String(row['SETTING'] || ''),
        total_diamond_pcs: String(row['TOTAL_DIAMOND_PCS'] || ''),
        tcw: tcwVal ? `${tcwVal}` : '',
        metel: 'Gold',
        ...cleanItemSpecifics,
      };

      // Add all raw Excel row columns for HTML template placeholders
      for (const [k, v] of Object.entries(row)) {
        if (v !== undefined && v !== null && String(v).trim()) {
          const isWeightField = /weight|tcw|carat/i.test(k);
          const formattedVal = formatFloat2Decimals(v, isWeightField);
          templateAttributes[k] = formattedVal;
          templateAttributes[k.toLowerCase()] = formattedVal;
          templateAttributes[k.toLowerCase().replace(/[\s\-_]/g, '')] = formattedVal;
        }
      }

      let status: ParsedListingRow['status'] = 'READY';
      let statusMessage = 'Valid';

      if (price <= 0) {
        status = 'ERROR';
        statusMessage = 'Price must be > 0';
      }

      return {
        index: idx + 1,
        sku,
        originalSku: rawSku,
        title,
        price,
        quantity,
        categoryId,
        categoryName,
        conditionId,
        sellerNotes,
        imageNames: [],
        matchedImageUrls: [],
        categoryProfileId: matchedProfile?.id,
        templateId: matchedProfile?.templateId || selectedTemplateId,
        itemSpecifics: cleanItemSpecifics,
        templateAttributes,
        status,
        statusMessage,
      };
    });
  };

  // 2. Parse Excel File
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });

        // Iterate through all sheets (RING, EARRINGS, PENDANT, BRACELET, etc.)
        let allJsonRows: any[] = [];
        for (const sheetName of workbook.SheetNames) {
          const lowerName = sheetName.toLowerCase();
          if (lowerName === 'backend' || lowerName.includes('summary') || lowerName.includes('calc') || lowerName.includes('fee')) {
            continue;
          }
          const sheet = workbook.Sheets[sheetName];
          const sheetRows: any[] = XLSX.utils.sheet_to_json(sheet);
          if (sheetRows && sheetRows.length > 0) {
            sheetRows.forEach((r) => {
              if (!r['CATEGORY'] && !r['Category'] && !r['category']) {
                r['CATEGORY'] = sheetName;
              }
              allJsonRows.push(r);
            });
          }
        }

        if (allJsonRows.length === 0) {
          const firstSheetName = workbook.SheetNames[0];
          allJsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
        }

        if (!allJsonRows || allJsonRows.length === 0) {
          setErrorMessage('Uploaded sheet is empty.');
          return;
        }

        // Filter out summary/discount footer rows and repeated headers
        const validJsonRows = allJsonRows.filter((r) => {
          const sku = String(r['SKU'] || r['sku'] || r['CustomLabel'] || '').trim();
          const lot = String(r['LOT'] || '').toLowerCase();
          const cat = String(r['CATEGORY'] || '').toLowerCase();
          if (!sku || sku.toUpperCase() === 'SKU' || sku.toUpperCase() === 'CATEGORY') return false;
          if (lot.includes('discount') || lot.includes('portal') || lot.includes('fee')) return false;
          if (cat.includes('discount') || cat.includes('portal') || cat.includes('fee')) return false;
          return true;
        });

        // Discover all unique column headers across all rows
        const headersSet = new Set<string>();
        validJsonRows.forEach((r) => {
          Object.keys(r).forEach((k) => headersSet.add(k));
        });
        const headersList = Array.from(headersSet);
        setExcelHeaders(headersList);
        setRawJsonRows(validJsonRows);

        // Auto-detect optimal mappings from discovered headers
        const autoColMap: ColumnMappingConfig = {
          priceCol: headersList.find((h) => /selling_?price/i.test(h)) || headersList.find((h) => /price/i.test(h)) || 'SELLING_PRICE_USD',
          skuCol: headersList.find((h) => /^sku$/i.test(h)) || 'SKU',
          categoryCol: headersList.find((h) => /^category$/i.test(h)) || 'CATEGORY',
          quantityCol: headersList.find((h) => /^quantity$/i.test(h)) || '',
          titleCol: headersList.find((h) => /^title$/i.test(h)) || '',
          conditionCol: headersList.find((h) => /^condition/i.test(h)) || '',
          tcwCol: 'AUTO_SUM',
        };
        setColumnMapping(autoColMap);

        // Auto-match default attributes
        const autoAttrMap = DEFAULT_ATTRIBUTE_MAPPINGS.map((item) => {
          const matchedHeader = headersList.find((h) => h.toLowerCase() === item.attribute.toLowerCase()) || item.column;
          return { attribute: item.attribute, column: matchedHeader };
        });
        setAttributeMappings(autoAttrMap);

        const rows = parseRowsWithMapping(validJsonRows, autoColMap, autoAttrMap);
        setParsedRows(rows);
        rematchImages(rows, stagedImages);
      } catch (err) {
        setErrorMessage(`Failed to parse Excel file: ${(err as Error).message}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Handlers for manual column & attribute mapping updates
  const handleUpdateColMapping = (key: keyof ColumnMappingConfig, val: string) => {
    const updated = { ...columnMapping, [key]: val };
    setColumnMapping(updated);
    if (rawJsonRows.length > 0) {
      const rows = parseRowsWithMapping(rawJsonRows, updated, attributeMappings);
      setParsedRows(rows);
      rematchImages(rows, stagedImages);
    }
  };

  const handleUpdateAttrMapping = (index: number, newColumn: string) => {
    const updated = [...attributeMappings];
    updated[index].column = newColumn;
    setAttributeMappings(updated);
    if (rawJsonRows.length > 0) {
      const rows = parseRowsWithMapping(rawJsonRows, columnMapping, updated);
      setParsedRows(rows);
      rematchImages(rows, stagedImages);
    }
  };

  const handleAddCustomAttr = () => {
    if (!newCustomAttr.trim() || !newCustomCol) return;
    const cleanTag = newCustomAttr.trim().replace(/[{}]/g, '');
    const updated = [...attributeMappings, { attribute: cleanTag, column: newCustomCol }];
    setAttributeMappings(updated);
    setNewCustomAttr('');
    setNewCustomCol('');
    if (rawJsonRows.length > 0) {
      const rows = parseRowsWithMapping(rawJsonRows, columnMapping, updated);
      setParsedRows(rows);
      rematchImages(rows, stagedImages);
    }
  };

  const handleRemoveAttrMapping = (index: number) => {
    const updated = attributeMappings.filter((_, i) => i !== index);
    setAttributeMappings(updated);
    if (rawJsonRows.length > 0) {
      const rows = parseRowsWithMapping(rawJsonRows, columnMapping, updated);
      setParsedRows(rows);
      rematchImages(rows, stagedImages);
    }
  };

  const handleResetMapping = () => {
    if (rawJsonRows.length === 0) return;
    const autoColMap: ColumnMappingConfig = {
      priceCol: excelHeaders.find((h) => /selling_?price/i.test(h)) || excelHeaders.find((h) => /price/i.test(h)) || 'SELLING_PRICE_USD',
      skuCol: excelHeaders.find((h) => /^sku$/i.test(h)) || 'SKU',
      categoryCol: excelHeaders.find((h) => /^category$/i.test(h)) || 'CATEGORY',
      quantityCol: '',
      titleCol: '',
      conditionCol: '',
      tcwCol: 'AUTO_SUM',
    };
    setColumnMapping(autoColMap);
    const autoAttrMap = DEFAULT_ATTRIBUTE_MAPPINGS.map((item) => {
      const matchedHeader = excelHeaders.find((h) => h.toLowerCase() === item.attribute.toLowerCase()) || item.column;
      return { attribute: item.attribute, column: matchedHeader };
    });
    setAttributeMappings(autoAttrMap);
    const rows = parseRowsWithMapping(rawJsonRows, autoColMap, autoAttrMap);
    setParsedRows(rows);
    rematchImages(rows, stagedImages);
  };

  // 3. Scan Local Folder Path on Server
  const handleScanFolderPath = async () => {
    if (!folderPathInput.trim()) {
      setErrorMessage('Please enter a valid folder path on your computer');
      return;
    }

    setScanningFolder(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/ebay/bulk/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: folderPathInput.trim() }),
      });

      const data = await res.json();
      if (data.success && data.images) {
        const photos: StagedImage[] = [];
        const vids: StagedVideo[] = [];
        for (const item of data.images) {
          if (isVideoMedia(item.filename) || isVideoMedia(item.url)) {
            vids.push({
              filename: item.filename,
              folderName: item.folderName,
              relativePath: item.relativePath,
              url: item.url,
            });
          } else {
            photos.push(item);
          }
        }
        setStagedImages(photos);
        setStagedVideos(vids);
        rematchImages(parsedRows, photos, vids);
      } else {
        setErrorMessage(data.error || 'Failed to scan folder');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setScanningFolder(false);
    }
  };

  // 4. Handle Browser Folder Picker
  const handleBrowserFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingBrowserImages(true);
    setErrorMessage('');

    const newImages: StagedImage[] = [];
    const newVideos: StagedVideo[] = [];

    try {
      // Upload files individually to safely stay well under Vercel's 4.5 MB serverless payload limit
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const rel = (file as any).webkitRelativePath || file.name;
        const dirParts = rel.replace(/\\/g, '/').split('/');
        const folderName = dirParts.length > 1 ? dirParts[dirParts.length - 2] : '';
        const isVid = file.type.startsWith('video/') || isVideoMedia(file.name);

        const formData = new FormData();
        formData.append('files', file);
        formData.append('relativePaths', rel);

        let uploadSucceeded = false;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.files && data.files.length > 0) {
              const f = data.files[0];
              if (isVid) {
                newVideos.push({
                  filename: f.originalName || f.name || file.name,
                  folderName,
                  relativePath: rel,
                  url: f.url,
                });
              } else {
                newImages.push({
                  filename: f.originalName || f.name || file.name,
                  folderName,
                  relativePath: rel,
                  url: f.url,
                  size: f.size || file.size,
                });
              }
              uploadSucceeded = true;
            }
          }
        } catch {
          // If upload fails or payload too large on serverless, fallback to local object URL
        }

        if (!uploadSucceeded) {
          // Fallback: Instant client-side blob URL preview
          const clientUrl = URL.createObjectURL(file);
          if (isVid) {
            newVideos.push({
              filename: file.name,
              folderName,
              relativePath: rel,
              url: clientUrl,
            });
          } else {
            newImages.push({
              filename: file.name,
              folderName,
              relativePath: rel,
              url: clientUrl,
              size: file.size,
            });
          }
        }
      }

      const updatedImages = [...stagedImages, ...newImages];
      const updatedVideos = [...stagedVideos, ...newVideos];
      setStagedImages(updatedImages);
      setStagedVideos(updatedVideos);
      rematchImages(parsedRows, updatedImages, updatedVideos);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setUploadingBrowserImages(false);
      if (folderPickerRef.current) folderPickerRef.current.value = '';
    }
  };

  // 5. Intelligent Image-to-Row Matcher (Folder Name == SKU Matcher)
  const rematchImages = (
    rows: ParsedListingRow[],
    images: StagedImage[],
    videos: StagedVideo[] = stagedVideos
  ) => {
    if (rows.length === 0) return;

    // Filter strictly to non-video photos
    const photoImages = images.filter((img) => !isVideoMedia(img.filename) && !isVideoMedia(img.url));

    const updated = rows.map((row) => {
      const rowSku = row.sku.trim();
      const cleanSku = rowSku.toLowerCase();
      const origSku = (row.originalSku || row.sku).trim().toLowerCase();
      const alphaNumSku = cleanSku.replace(/[^a-z0-9]/g, '');
      const alphaNumOrig = origSku.replace(/[^a-z0-9]/g, '');
      const explicitNames = new Set(row.imageNames.map((n) => n.toLowerCase()));

      const matched: string[] = [];
      let matchedFolderName = '';
      let matchedVideoUrl = row.videoUrl || '';

      // RULE 1: EXACT SKU FOLDER MATCH (User request: matches cleaned SKU "P834" or original "P834bbx")
      for (const img of photoImages) {
        if (img.folderName) {
          const cleanFolder = img.folderName.trim().toLowerCase();
          const alphaNumFolder = cleanFolder.replace(/[^a-z0-9]/g, '');

          // Direct match if folder name equals SKU (or clean alphanumeric equals)
          const isFolderMatch =
            cleanFolder === cleanSku ||
            cleanFolder === origSku ||
            alphaNumFolder === alphaNumSku ||
            alphaNumFolder === alphaNumOrig ||
            (alphaNumSku.length >= 3 && alphaNumFolder === alphaNumSku) ||
            (alphaNumOrig.length >= 3 && alphaNumFolder === alphaNumOrig);

          if (isFolderMatch) {
            matchedFolderName = img.folderName;
            if (!matched.includes(img.url)) {
              matched.push(img.url);
            }
          }
        }
      }

      // Check matching video in folder or by SKU name
      for (const vid of videos) {
        if (vid.folderName) {
          const cleanFolder = vid.folderName.trim().toLowerCase();
          const alphaNumFolder = cleanFolder.replace(/[^a-z0-9]/g, '');
          const isFolderMatch =
            cleanFolder === cleanSku ||
            cleanFolder === origSku ||
            alphaNumFolder === alphaNumSku ||
            alphaNumFolder === alphaNumOrig ||
            (alphaNumSku.length >= 3 && alphaNumFolder === alphaNumSku) ||
            (alphaNumOrig.length >= 3 && alphaNumFolder === alphaNumOrig);

          if (isFolderMatch) {
            matchedVideoUrl = vid.url;
            break;
          }
        }
        const vidBase = vid.filename.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          (alphaNumSku && (vidBase.startsWith(alphaNumSku) || vidBase.includes(alphaNumSku))) ||
          (alphaNumOrig && (vidBase.startsWith(alphaNumOrig) || vidBase.includes(alphaNumOrig)))
        ) {
          matchedVideoUrl = vid.url;
          break;
        }
      }

      // RULE 2: If no folder match found, check explicit image filenames in Excel
      if (matched.length === 0 && explicitNames.size > 0) {
        for (const img of photoImages) {
          const baseName = img.filename.toLowerCase();
          if (explicitNames.has(baseName)) {
            if (!matched.includes(img.url)) {
              matched.push(img.url);
            }
          }
        }
      }

      // RULE 3: If still no match, fallback to image filename starting with or containing clean SKU or original SKU
      if (matched.length === 0 && (alphaNumSku || alphaNumOrig)) {
        for (const img of photoImages) {
          const imgBase = img.filename.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            (alphaNumSku && (imgBase.startsWith(alphaNumSku) || imgBase.includes(alphaNumSku))) ||
            (alphaNumOrig && (imgBase.startsWith(alphaNumOrig) || imgBase.includes(alphaNumOrig)))
          ) {
            if (!matched.includes(img.url)) {
              matched.push(img.url);
            }
          }
        }
      }

      let status = row.status;
      let statusMessage = row.statusMessage;

      if (matched.length === 0 && status === 'READY') {
        status = 'WARNING';
        statusMessage = 'No image matched (will use default)';
      } else if (matched.length > 0 && status === 'WARNING') {
        status = 'READY';
        statusMessage = 'Valid';
      }

      return {
        ...row,
        matchedImageUrls: matched.filter((u) => !isVideoMedia(u)),
        matchedFolderName,
        videoUrl: matchedVideoUrl,
        status,
        statusMessage,
      };
    });

    setParsedRows(updated);
  };

  // 6. Execute Bulk Import / Publish / Schedule
  const handleExecuteBulk = async (modeParam?: 'DRAFT' | 'SCHEDULE' | 'NOW') => {
    const targetMode = modeParam || publishMode;

    if (parsedRows.length === 0) {
      setErrorMessage('No listings available to process');
      return;
    }

    if (targetMode === 'SCHEDULE' && !scheduledDateTime) {
      setErrorMessage('Please select a scheduled Date & Time for items to go live');
      return;
    }

    const invalidItems = parsedRows.filter((r) => r.status === 'ERROR');
    if (invalidItems.length > 0) {
      setErrorMessage(`Please fix the ${invalidItems.length} invalid rows before proceeding.`);
      setStep(2);
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);
    if (targetMode === 'NOW') {
      setProgressMsg('Connecting to eBay servers and publishing live...');
    } else if (targetMode === 'SCHEDULE') {
      setProgressMsg(`Scheduling listings for ${new Date(scheduledDateTime).toLocaleString()}...`);
    } else {
      setProgressMsg('Saving listings as drafts locally in dashboard...');
    }
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Build items payload with category-specific compiled HTML templates
      const itemsPayload = parsedRows.map((row) => {
        const rowTemplate =
          (row.templateId ? templateList.find((t) => t.id === row.templateId) : null) ||
          templateList.find((t) => t.id === selectedTemplateId) ||
          templateList[0] ||
          DEFAULT_TEMPLATES[0];

        const finalImages = (row.matchedImageUrls.length > 0
          ? row.matchedImageUrls
          : ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&auto=format&fit=crop&q=60']
        ).filter((u) => !isVideoMedia(u));

        const descriptionHtml = renderDescriptionTemplate(rowTemplate.html, {
          title: row.title,
          price: row.price,
          sku: row.sku,
          quantity: row.quantity,
          category: row.categoryName,
          condition: row.conditionId === '1000' ? 'NEW' : 'USED',
          conditionDescription: row.sellerNotes,
          images: finalImages,
          videoUrl: row.videoUrl,
          itemSpecifics: row.itemSpecifics,
          templateAttributes: row.templateAttributes,
          storeName: activeAccount?.storeName || 'Livuniq Fine Jewelry',
        });

        return {
          sku: row.sku,
          title: row.title,
          price: row.price,
          quantity: row.quantity,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          conditionId: row.conditionId,
          sellerNotes: row.sellerNotes,
          images: finalImages,
          videoUrl: row.videoUrl,
          description: descriptionHtml,
          itemSpecifics: row.itemSpecifics,
          templateAttributes: row.templateAttributes,
          shippingPolicyId,
          shippingPolicyName,
          returnPolicyId,
          returnPolicyName,
          paymentPolicyId,
          paymentPolicyName,
        };
      });

      setProgressPercent(30);
      setProgressMsg(`Processing batch of ${itemsPayload.length} items...`);

      const res = await fetch('/api/ebay/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccount?.id,
          items: itemsPayload,
          publishMode: targetMode,
          publishToEbay: targetMode === 'NOW' || (targetMode === 'SCHEDULE' && scheduleDirectOnEbay),
          scheduledTime: targetMode === 'SCHEDULE' ? new Date(scheduledDateTime).toISOString() : undefined,
          scheduleDirectOnEbay: targetMode === 'SCHEDULE' && scheduleDirectOnEbay,
        }),
      });

      const data = await res.json();
      setProgressPercent(100);

      if (data.success) {
        const createdListings = (data.results || [])
          .map((r: any) => r.listing)
          .filter(Boolean);

        if (targetMode === 'NOW') {
          setSuccessMessage(
            `Bulk Publish Complete! Successfully published ${data.successCount} of ${data.total} listings live to eBay!`
          );
        } else if (targetMode === 'SCHEDULE') {
          setSuccessMessage(
            `Scheduled Successfully! ${data.total} listings are scheduled to go live on ${new Date(scheduledDateTime).toLocaleString()}.`
          );
        } else {
          setSuccessMessage(
            `Bulk Drafts Saved! Successfully imported ${data.total} listings into dashboard for manual review.`
          );
        }

        onBulkCompleted(createdListings);
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setErrorMessage(data.error || 'Bulk processing failed');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const readyCount = parsedRows.filter((r) => r.status === 'READY').length;
  const warningCount = parsedRows.filter((r) => r.status === 'WARNING').length;
  const errorCount = parsedRows.filter((r) => r.status === 'ERROR').length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Bulk Listing Wizard
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  Excel & Folder Auto-Matcher
                </span>
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Upload your Excel/CSV sheet and match product images automatically from your local PC folder
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-white px-6 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center space-x-2 font-bold cursor-pointer ${
                step === 1 ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                1
              </span>
              <span>Upload Excel & Folder</span>
            </button>

            <ChevronRight className="w-4 h-4 text-slate-300" />

            <button
              onClick={() => parsedRows.length > 0 && setStep(2)}
              disabled={parsedRows.length === 0}
              className={`flex items-center space-x-2 font-bold cursor-pointer ${
                step === 2 ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
              <span>Review & Auto-Match ({parsedRows.length} items)</span>
            </button>

            <ChevronRight className="w-4 h-4 text-slate-300" />

            <button
              onClick={() => parsedRows.length > 0 && setStep(3)}
              disabled={parsedRows.length === 0}
              className={`flex items-center space-x-2 font-bold cursor-pointer ${
                step === 3 ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
              <span>Policies & Import Mode</span>
            </button>
          </div>

          {/* Quick Stats Pill */}
          {parsedRows.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 text-[11px]">
                {readyCount} Ready
              </span>
              {warningCount > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 text-[11px]">
                  {warningCount} No Image
                </span>
              )}
              {errorCount > 0 && (
                <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200 text-[11px]">
                  {errorCount} Invalid
                </span>
              )}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: EXCEL & FOLDER SELECTION */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Quick Jump Bar to Mapping Option */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                      <span>Excel Column & Attribute Mapping Active</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                        {excelHeaders.length} Columns Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Aap <strong>SELLING_PRICE_USD &rarr; Price</strong>, <strong>SKU &rarr; SKU</strong>, aur <strong>HTML template tags</strong> ko niche manual map kar sakte hain.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('column-mapping-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-xs bg-white text-blue-700 hover:text-blue-900 font-bold px-3 py-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Go to Column Mapping &darr;
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Card: Excel Spreadsheet */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-slate-800 text-sm">1. Excel / CSV File</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate('xlsx')}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 bg-white border border-blue-200 px-2.5 py-1 rounded shadow-2xs hover:bg-blue-50"
                      >
                        <Download className="w-3 h-3" />
                        Download Template (data.xlsx)
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-500 text-xs">
                    Upload your spreadsheet (e.g. <code>data.xlsx</code>). Supports sheets: <code>RING</code>, <code>EARRINGS</code>, <code>PENDANT</code>, <code>BRACELET</code> with columns <code>SKU</code>, <code>GOLD_KT</code>, <code>SELLING_PRICE_USD</code>, etc.
                  </p>

                  <div
                    onClick={() => excelInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white rounded-xl p-6 text-center cursor-pointer transition"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <span className="font-bold text-slate-700 text-xs block">
                      {excelFile ? excelFile.name : 'Click to select Excel file (.xlsx, .csv)'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-1">
                      {parsedRows.length > 0
                        ? `✓ ${parsedRows.length} listings parsed successfully`
                        : 'Supports all standard eBay File Exchange and custom formats'}
                    </span>
                  </div>

                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </div>

                {/* Right Card: Folder Image Fetcher */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-slate-800 text-sm">2. Product Photos Folder</h4>
                    </div>
                    <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                      {stagedImages.length} images staged
                    </span>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex bg-slate-200 p-1 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setImageFetchMode('picker')}
                      className={`flex-1 py-1.5 rounded-md transition ${
                        imageFetchMode === 'picker' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Browse Folder on PC
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageFetchMode('path')}
                      className={`flex-1 py-1.5 rounded-md transition ${
                        imageFetchMode === 'path' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Paste Folder Path
                    </button>
                  </div>

                  {imageFetchMode === 'picker' ? (
                    <div>
                      <p className="text-slate-500 text-xs mb-3">
                        Click below to pick the folder on your computer that contains all your product images:
                      </p>
                      <button
                        type="button"
                        onClick={() => folderPickerRef.current?.click()}
                        disabled={uploadingBrowserImages}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-xl p-6 text-center cursor-pointer transition font-bold text-slate-700 text-xs"
                      >
                        {uploadingBrowserImages ? (
                          <>
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                            Reading images from folder...
                          </>
                        ) : (
                          <>
                            <FolderOpen className="w-6 h-6 text-blue-600" />
                            Select Images Folder from Computer
                          </>
                        )}
                      </button>
                      {/* @ts-ignore */}
                      <input
                        ref={folderPickerRef}
                        type="file"
                        // @ts-ignore
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        onChange={handleBrowserFolderUpload}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-slate-500 text-xs">
                        Enter the full directory path on your PC (e.g. <code>C:\Photos\Jewelry</code>):
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={folderPathInput}
                          onChange={(e) => setFolderPathInput(e.target.value)}
                          placeholder="e.g. C:\Users\Jil\Pictures\eBay_Listings"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleScanFolderPath}
                          disabled={scanningFolder}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                        >
                          {scanningFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Scan Folder
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[11px] text-emerald-950 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <FolderOpen className="w-3.5 h-3.5" /> SKU Subfolder Matching Active
                    </div>
                    <div>
                      Excel sheet me jo <strong>SKU</strong> hai, usi naam ke folder me se <strong>sabhi images</strong> automatically listing me add ho jayengi — chahe photo ka naam koi bhi ho!
                    </div>
                  </div>
                </div>
              </div>

              {/* INTERACTIVE COLUMN & ATTRIBUTE MAPPING SECTION */}
              <div id="column-mapping-section" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 scroll-mt-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-slate-800 text-sm">
                        Column & Attribute Mapping
                      </h4>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                        {excelFile ? `${excelHeaders.length} Columns in ${excelFile.name}` : `${excelHeaders.length} Columns from data.xlsx`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Aap manually set kar sakte hain ki Excel ka kaun sa column Price, SKU, ya HTML template attributes me map ho.
                    </p>
                  </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetMapping}
                        className="text-[11px] text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        Reset Defaults
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMappingDetails(!showMappingDetails)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        {showMappingDetails ? 'Collapse Mapping' : 'Expand & Customize Mapping'}
                      </button>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Price Column</span>
                      <span className="font-bold text-emerald-700 font-mono text-[11px] truncate block">
                        {columnMapping.priceCol || 'SELLING_PRICE_USD'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">SKU Column</span>
                      <span className="font-bold text-blue-700 font-mono text-[11px] truncate block">
                        {columnMapping.skuCol || 'SKU'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Category Column</span>
                      <span className="font-bold text-indigo-700 font-mono text-[11px] truncate block">
                        {columnMapping.categoryCol || 'CATEGORY'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Template Attributes</span>
                      <span className="font-bold text-slate-800 text-[11px] block">
                        {attributeMappings.length} Attributes Active
                      </span>
                    </div>
                  </div>

                  {/* Expandable Detailed Mapping Controls */}
                  {showMappingDetails && (
                    <div className="space-y-5 pt-1">
                      {/* 1. Core Fields Mapping */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                          1. Core Listing Fields (Excel Column → Listing Field)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Price */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Price (USD) <span className="text-emerald-600 font-mono">*</span>
                            </label>
                            <select
                              value={columnMapping.priceCol}
                              onChange={(e) => handleUpdateColMapping('priceCol', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              {excelHeaders.map((h) => (
                                <option key={h} value={h}>
                                  {h} {h === 'SELLING_PRICE_USD' ? '(Recommended)' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Sample: ${rawJsonRows[0]?.[columnMapping.priceCol] ? parseFloat(String(rawJsonRows[0][columnMapping.priceCol])).toFixed(2) : '0.00'}
                            </span>
                          </div>

                          {/* SKU */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              SKU / Custom Label <span className="text-blue-600 font-mono">*</span>
                            </label>
                            <select
                              value={columnMapping.skuCol}
                              onChange={(e) => handleUpdateColMapping('skuCol', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              {excelHeaders.map((h) => (
                                <option key={h} value={h}>
                                  {h} {h === 'SKU' ? '(Recommended)' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Sample: {String(rawJsonRows[0]?.[columnMapping.skuCol] || 'N/A')}
                            </span>
                          </div>

                          {/* Category */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Category Column
                            </label>
                            <select
                              value={columnMapping.categoryCol}
                              onChange={(e) => handleUpdateColMapping('categoryCol', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              {excelHeaders.map((h) => (
                                <option key={h} value={h}>
                                  {h} {h === 'CATEGORY' ? '(Recommended)' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Sample: {String(rawJsonRows[0]?.[columnMapping.categoryCol] || 'N/A')}
                            </span>
                          </div>

                          {/* Title */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Listing Title
                            </label>
                            <select
                              value={columnMapping.titleCol}
                              onChange={(e) => handleUpdateColMapping('titleCol', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="">Auto-Generate SEO Title (Recommended)</option>
                              {excelHeaders.map((h) => (
                                <option key={h} value={h}>
                                  Use column: {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Quantity
                            </label>
                            <select
                              value={columnMapping.quantityCol}
                              onChange={(e) => handleUpdateColMapping('quantityCol', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="">Fixed Quantity: 1 (Default)</option>
                              {excelHeaders.map((h) => (
                                <option key={h} value={h}>
                                  Use column: {h}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Total Carat Weight (TCW) */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Total Carat Weight (&#123;TCW&#125;)
                            </label>
                            <select
                              value={columnMapping.tcwCol}
                              onChange={(e) => handleUpdateColMapping('tcwCol', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="AUTO_SUM">Auto-Sum: Center + Side Stone Weight</option>
                              {excelHeaders.map((h) => (
                                <option key={h} value={h}>
                                  Use column: {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* 2. Template Attributes & Specifics Mapping */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            2. Template Attributes Mapping (&#123;ATTRIBUTE&#125; ← Excel Column)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Ye attributes HTML templates me dynamically fill honge
                          </span>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-slate-50/50">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100/90 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10 text-[11px]">
                              <tr>
                                <th className="py-2 px-3 w-1/3">Template Attribute Tag</th>
                                <th className="py-2 px-3 w-1/3">Mapped Excel Column</th>
                                <th className="py-2 px-3">Sample Value (Row 1)</th>
                                <th className="py-2 px-2 w-10 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {attributeMappings.map((attrItem, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition">
                                  <td className="py-2 px-3 font-mono font-bold text-blue-700 text-[11px]">
                                    &#123;{attrItem.attribute}&#125;
                                  </td>
                                  <td className="py-1.5 px-3">
                                    <select
                                      value={attrItem.column}
                                      onChange={(e) => handleUpdateAttrMapping(idx, e.target.value)}
                                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-900 font-semibold focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                    >
                                      {excelHeaders.map((h) => (
                                        <option key={h} value={h}>
                                          {h}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 font-mono text-[11px] truncate max-w-xs">
                                    {String(rawJsonRows[0]?.[attrItem.column] ?? '—')}
                                  </td>
                                  <td className="py-1.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAttrMapping(idx)}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                                      title="Remove attribute mapping"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Add Custom Attribute Row */}
                        <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-300">
                          <input
                            type="text"
                            value={newCustomAttr}
                            onChange={(e) => setNewCustomAttr(e.target.value)}
                            placeholder="New Tag Name (e.g. CHAIN_LENGTH or METAL)"
                            className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 font-mono"
                          />
                          <span className="text-slate-400 text-xs">←</span>
                          <select
                            value={newCustomCol}
                            onChange={(e) => setNewCustomCol(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 font-medium cursor-pointer"
                          >
                            <option value="">Select Excel Column...</option>
                            {excelHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddCustomAttr}
                            disabled={!newCustomAttr.trim() || !newCustomCol}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Attribute
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              {parsedRows.length > 0 && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition"
                  >
                    <span>Proceed to Review ({parsedRows.length} items)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: REVIEW & AUTO-MATCH TABLE */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-700">
                  Showing <strong>{parsedRows.length}</strong> items parsed from Excel. Review matched images and pricing.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[11px] text-slate-700 hover:text-blue-700 font-bold flex items-center gap-1 bg-white border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-blue-600" />
                    Adjust Column Mapping
                  </button>
                  <button
                    type="button"
                    onClick={() => rematchImages(parsedRows, stagedImages)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-white border border-slate-300 px-2.5 py-1 rounded cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Re-match Images
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 w-28">Status</th>
                      <th className="py-2.5 px-3 w-32">SKU</th>
                      <th className="py-2.5 px-3 w-48">Matched Photos</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3 w-24">Price</th>
                      <th className="py-2.5 px-3 w-16">Qty</th>
                      <th className="py-2.5 px-3 w-40">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr key={row.index} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {row.index}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.status === 'READY' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              <CheckCircle className="w-3 h-3" /> Ready
                            </span>
                          )}
                          {row.status === 'WARNING' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold" title={row.statusMessage}>
                              <AlertCircle className="w-3 h-3" /> No Image
                            </span>
                          )}
                          {row.status === 'ERROR' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold" title={row.statusMessage}>
                              <AlertCircle className="w-3 h-3" /> {row.statusMessage}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-[11px]">
                          <div>{row.sku}</div>
                          {row.originalSku && row.originalSku !== row.sku && (
                            <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1 inline-block mt-0.5 font-normal">
                              Excel: {row.originalSku}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap mb-1">
                            {row.matchedFolderName && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1 font-semibold">
                                <FolderOpen className="w-3 h-3 text-emerald-600" />
                                {row.matchedFolderName} ({row.matchedImageUrls.length})
                              </span>
                            )}
                            {row.videoUrl && (
                              <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1 font-semibold" title="Video matched for eBay listing">
                                <Video className="w-3 h-3 text-purple-600" />
                                Video
                              </span>
                            )}
                          </div>
                          {row.matchedImageUrls.length > 0 ? (
                            <div className="flex items-center gap-1 overflow-x-auto max-w-[190px] py-0.5">
                              {row.matchedImageUrls.slice(0, 4).map((imgUrl, i) => (
                                <img
                                  key={i}
                                  src={imgUrl}
                                  alt=""
                                  className="w-7 h-7 object-cover rounded border border-slate-200 shadow-2xs"
                                />
                              ))}
                              {row.matchedImageUrls.length > 4 && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1 py-0.5 rounded">
                                  +{row.matchedImageUrls.length - 4}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No images</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 truncate max-w-xs" title={row.title}>
                          {row.title}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          ${row.price.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {row.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-700 max-w-[160px]" title={row.categoryName}>
                          <span className="font-semibold text-blue-700 block truncate">
                            {row.itemSpecifics['Type'] || row.categoryName.split('/').pop()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            ID: {row.categoryId}
                          </span>
                          {row.templateId && (
                            <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded font-medium inline-block mt-0.5 truncate max-w-[150px]" title={`Assigned Template: ${templateList.find((t) => t.id === row.templateId)?.name || row.templateId}`}>
                              Tpl: {templateList.find((t) => t.id === row.templateId)?.name || 'Category'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-50 transition"
                >
                  ← Back to Upload
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition"
                >
                  <span>Proceed to Policies & Import</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: POLICIES & EXECUTION */}
          {step === 3 && (
            <div className="space-y-6">
              {/* HTML Description Template Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    HTML Description Template
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Auto-interpolates Excel columns like &#123;TCW&#125;, &#123;GOLD_KT&#125;, &#123;GOLD_COLOR&#125;, &#123;METEL&#125;
                  </span>
                </div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  {templateList.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.id === 'tpl-1794598343866' ? '★ (Cali Trove Jewelry Template)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Policies Selector */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs">
                  Apply eBay Business Policies to this Bulk Batch:
                </h4>
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
              </div>

              {/* Progress bar when processing */}
              {isProcessing && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      {progressMsg}
                    </span>
                    <span className="font-mono font-bold text-blue-600">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* PUBLISH MODE SELECTION (DRAFT / SCHEDULE / LIVE NOW) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Publishing Mode & Scheduling
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Aap decide kar sakte hain ki items direct live na ho kar draft ban kar save hon, scheduled time par auto-live hon, ya abhi live publish hon.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Mode 1: Drafts */}
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                      publishMode === 'DRAFT'
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        1. Save as Drafts (Manual Live)
                      </span>
                      <input
                        type="radio"
                        name="publishMode"
                        value="DRAFT"
                        checked={publishMode === 'DRAFT'}
                        onChange={() => setPublishMode('DRAFT')}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Dashboard me draft save hoga. eBay par direct live nahi hoga. Baad me jab chaho ek-ek ya bulk me manually live kar sakte ho.
                    </p>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md w-fit">
                      Safest / Recommended
                    </span>
                  </label>

                  {/* Mode 2: Scheduled */}
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                      publishMode === 'SCHEDULE'
                        ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        2. Schedule Go-Live Time
                      </span>
                      <input
                        type="radio"
                        name="publishMode"
                        value="SCHEDULE"
                        checked={publishMode === 'SCHEDULE'}
                        onChange={() => setPublishMode('SCHEDULE')}
                        className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Future date aur time set karein. Us time par listings automatically eBay live store par publish ho jayengi.
                    </p>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md w-fit">
                      Auto-Pilot Schedule
                    </span>
                  </label>

                  {/* Mode 3: Immediate Live */}
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                      publishMode === 'NOW'
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        3. Publish Live Now
                      </span>
                      <input
                        type="radio"
                        name="publishMode"
                        value="NOW"
                        checked={publishMode === 'NOW'}
                        onChange={() => setPublishMode('NOW')}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Excel ke saare listings abhi turant live eBay store par publish ho jayenge.
                    </p>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md w-fit">
                      Direct Live
                    </span>
                  </label>
                </div>

                {/* If Mode 2 (SCHEDULE) selected: show Date & Time Picker */}
                {publishMode === 'SCHEDULE' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-purple-900 block flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          Select Scheduled Date & Time for eBay Live:
                        </label>
                        <span className="text-[11px] text-purple-700">
                          Set the date and time when items will go live on eBay.
                        </span>
                      </div>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        min={new Date().toISOString().slice(0, 16)}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="px-3 py-2 border border-purple-300 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Ready to Process {parsedRows.length} Items</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {publishMode === 'SCHEDULE' && scheduledDateTime
                      ? `Items will be scheduled to go live on ${new Date(scheduledDateTime).toLocaleString()}`
                      : publishMode === 'NOW'
                      ? 'Items will be uploaded directly to live eBay store'
                      : 'Items will be stored safely as local drafts in dashboard'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleExecuteBulk('DRAFT')}
                    disabled={isProcessing}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    Save as Drafts
                  </button>

                  {publishMode === 'SCHEDULE' ? (
                    <button
                      type="button"
                      onClick={() => handleExecuteBulk('SCHEDULE')}
                      disabled={isProcessing || !scheduledDateTime}
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                      Schedule {parsedRows.length} Items for Live
                    </button>
                  ) : publishMode === 'NOW' ? (
                    <button
                      type="button"
                      onClick={() => handleExecuteBulk('NOW')}
                      disabled={isProcessing}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Publish {parsedRows.length} Items Live Now
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleExecuteBulk('DRAFT')}
                      disabled={isProcessing}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Save {parsedRows.length} Drafts (Review Later)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-semibold">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
