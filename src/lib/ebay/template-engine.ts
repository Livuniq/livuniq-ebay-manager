import { isEbayItemSpecific } from './specifics-rules';

export function isVideoMedia(urlOrName?: string | null): boolean {
  if (!urlOrName || typeof urlOrName !== 'string') return false;
  const clean = urlOrName.trim();
  return (
    /\.(mp4|mov|webm|avi|mkv|m4v)(\?.*)?$/i.test(clean) ||
    clean.includes('/uploads/videos/')
  );
}

export interface ListingTemplateData {
  title: string;
  price: number | string;
  currency?: string;
  sku?: string;
  quantity?: number | string;
  condition?: string;
  conditionDescription?: string;
  category?: string;
  images: string[];
  videoUrl?: string;
  itemSpecifics?: Record<string, string>;
  templateAttributes?: Record<string, any>;
  storeName?: string;
  customDescription?: string;
}

export interface DescriptionTemplate {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  html: string;
  createdAt: string;
  mappedCategories?: string[];
}

// Generate styled HTML Table of all legitimate eBay item specifics
export function generateSpecificsTableHtml(specifics: Record<string, string> = {}): string {
  const entries = Object.entries(specifics).filter(([k, v]) => isEbayItemSpecific(k) && Boolean(v && v.trim()));
  if (entries.length === 0) return '';

  const rows = entries
    .map(([key, val], idx) => {
      const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      return `<tr style="background-color: ${bg};">
        <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; width: 35%; font-size: 13px;">${escapeHtml(key)}</td>
        <td style="padding: 10px 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${escapeHtml(val)}</td>
      </tr>`;
    })
    .join('');

  return `<div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
  <div style="background-color: #631726; color: #ffffff; padding: 10px 16px; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">ITEM SPECIFICS & PRODUCT DETAILS</div>
  <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
    <tbody>
      ${rows}
    </tbody>
  </table>
</div>`;
}

// Generate styled HTML Gallery of product photos (strictly photos, NO videos)
export function generateGalleryHtml(images: string[] = []): string {
  const validImages = images
    .filter((img) => Boolean(img && img.trim()))
    .filter((img) => !isVideoMedia(img));
  if (validImages.length === 0) return '';

  const items = validImages
    .map(
      (img) => `<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <img src="${img}" alt="Product Image" style="max-width: 100%; height: auto; max-height: 280px; object-fit: contain; border-radius: 4px;" />
      </div>`
    )
    .join('');

  return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin: 20px 0;">
    ${items}
  </div>`;
}

// Generate dynamic pure-CSS radio gallery matching the exact user structure (#gallBlock) (strictly photos, NO videos)
export function generateRadioGalleryHtml(images: string[] = []): string {
  const validImages = images
    .filter((img) => Boolean(img && img.trim()))
    .filter((img) => !isVideoMedia(img));
  if (validImages.length === 0) return '';

  const radios = validImages
    .map((_, idx) => {
      const num = idx + 1;
      const checked = idx === 0 ? ' checked="checked"' : '';
      return `      <input name="imgallery" id="img${num}" type="radio"${checked} />`;
    })
    .join('\n');

  const largeImages = validImages
    .map((imgUrl, idx) => {
      const num = idx + 1;
      const itemProp = idx === 0 ? ' itemprop="photo"' : '';
      return `      <div class="lrgImg" id="imgblock${num}">
        <div class="imgLgIn">
          <img alt="image-${num}"${itemProp} src="${imgUrl}" />
        </div>
      </div>`;
    })
    .join('\n');

  const thumbs = validImages.map((imgUrl, idx) => {
    const num = idx + 1;
    return `        <label for="img${num}"><div class="imgSmIn"><img alt="thumb-${num}" src="${imgUrl}" /></div></label>`;
  });

  const columnsCount = Math.min(5, Math.max(1, validImages.length));
  const activeSelectors = validImages.map((_, idx) => `#gallBlock #img${idx + 1}:checked ~ #imgblock${idx + 1}`).join(',\n');
  const activeThumbSelectors = validImages.map((_, idx) => `#gallBlock #img${idx + 1}:checked ~ #gallThumbs label[for="img${idx + 1}"]`).join(',\n');

  return `<style>
#gallBlock { position: relative; max-width: 100%; margin: 15px auto; text-align: center; }
#gallBlock input[type="radio"] { display: none !important; }
#gallBlock .lrgImg { display: none; width: 100%; text-align: center; }
${activeSelectors} { display: block !important; }
#gallBlock .imgLgIn img { max-width: 100%; max-height: 480px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

/* Suppress any inherited ::before / ::after pseudo-elements (e.g. from .clearfix) on both gallBlock and gallThumbs so they never create ghost blocks */
#tmpShell #gallBlock::before,
#tmpShell #gallBlock::after,
#tmpShell #gallBlock:before,
#tmpShell #gallBlock:after,
#gallBlock::before,
#gallBlock::after,
#gallBlock:before,
#gallBlock:after,
#tmpShell #gallBlock #gallThumbs::before,
#tmpShell #gallBlock #gallThumbs::after,
#tmpShell #gallBlock #gallThumbs:before,
#tmpShell #gallBlock #gallThumbs:after,
#gallBlock #gallThumbs::before,
#gallBlock #gallThumbs::after,
#gallBlock #gallThumbs:before,
#gallBlock #gallThumbs:after,
#gallThumbs::before,
#gallThumbs::after,
#gallThumbs:before,
#gallThumbs:after {
  content: none !important;
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}

/* Clean 5-per-row grid layout that flawlessly wraps 6-12 images into neat rows */
#tmpShell #gallBlock #gallThumbs,
#gallBlock #gallThumbs,
#gallBlock #gallThumbs.gallThumbsGrid,
#gallThumbs.gallThumbsGrid,
#gallThumbs {
  display: grid !important;
  grid-template-columns: repeat(${columnsCount}, 1fr) !important;
  gap: 8px !important;
  margin-top: 12px !important;
  width: 100% !important;
  max-width: 500px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-sizing: border-box !important;
}

#tmpShell #gallBlock #gallThumbs label,
#gallBlock #gallThumbs label,
#gallBlock #gallThumbs.gallThumbsGrid label,
#gallThumbs label {
  flex: none !important;
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 1 / 1 !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  cursor: pointer !important;
  overflow: hidden !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
}

#tmpShell #gallBlock #gallThumbs label:hover,
#gallBlock #gallThumbs label:hover,
#gallThumbs label:hover {
  border-color: #631726 !important;
  box-shadow: 0 0 0 1px #631726, 0 3px 8px rgba(99, 23, 38, 0.2) !important;
  transform: translateY(-2px);
}

#tmpShell #gallBlock #gallThumbs label .imgSmIn,
#gallBlock #gallThumbs label .imgSmIn,
#gallThumbs .imgSmIn {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 3px !important;
  box-sizing: border-box !important;
}

#tmpShell #gallBlock #gallThumbs label .imgSmIn img,
#gallBlock #gallThumbs label .imgSmIn img,
#gallThumbs .imgSmIn img {
  max-width: 100% !important;
  max-height: 100% !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  display: block !important;
  border-radius: 5px !important;
}

${activeThumbSelectors} {
  border-color: #631726 !important;
  box-shadow: 0 0 0 1.5px #631726, 0 3px 8px rgba(99, 23, 38, 0.22) !important;
}
</style>
<div id="gallBlock">
${radios}
${largeImages}
      <div class="clear"><br /></div>
      <div class="gallThumbsGrid" id="gallThumbs">
${thumbs.join('\n')}
      </div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format float numbers with 2 decimal places (e.g. 0.5 -> 0.50, 1.5 -> 1.50, 0.3 -> 0.30)
function formatFloat2Decimals(val: any, forceWeight = false): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  const num = parseFloat(str);
  if (isNaN(num)) return str;

  if (forceWeight || str.includes('.') || !Number.isInteger(num)) {
    return num.toFixed(2);
  }
  return str;
}

// Sanitize HTML by permanently stripping any legacy .clearfix classes from gallery containers
export function sanitizeGalleryHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  let cleaned = html;

  // 1. Remove class="clearfix" or clearfix from #gallBlock
  cleaned = cleaned.replace(/<div([^>]*id=["']gallBlock["'][^>]*)class=["'][^"']*clearfix[^"']*["']([^>]*)>/gi, '<div$1$2>');
  cleaned = cleaned.replace(/<div\s+class=["'][^"']*clearfix[^"']*["']([^>]*id=["']gallBlock["'][^>]*)>/gi, '<div$1>');

  // 2. Remove class="clearfix" or clearfix from #gallThumbs
  cleaned = cleaned.replace(/<div([^>]*id=["']gallThumbs["'][^>]*)class=["'][^"']*clearfix[^"']*["']([^>]*)>/gi, '<div$1 class="gallThumbsGrid"$2>');
  cleaned = cleaned.replace(/<div\s+class=["'][^"']*clearfix[^"']*["']([^>]*id=["']gallThumbs["'][^>]*)>/gi, '<div class="gallThumbsGrid"$1>');

  // 3. Clean up any empty class attributes or double spaces
  cleaned = cleaned.replace(/<div\s+id=["']gallBlock["']\s+class=["']\s*["']([^>]*)>/gi, '<div id="gallBlock"$1>');
  cleaned = cleaned.replace(/<div\s+class=["']\s*["']\s+id=["']gallBlock["']([^>]*)>/gi, '<div id="gallBlock"$1>');
  cleaned = cleaned.replace(/<div\s+id=["']gallBlock["']\s*>/gi, '<div id="gallBlock">');

  return cleaned;
}

export function cleanAndDecodeDescription(rawDesc?: string | null): string {
  if (!rawDesc || typeof rawDesc !== 'string') return '';
  let str = rawDesc.trim();
  if (str.startsWith('<![CDATA[')) {
    str = str.substring(9, str.length - 3).trim();
  }

  // Strip leading placeholder garbage like pppppppppppppppppppp
  str = str.replace(/^p{5,}\s*/i, '');

  // Strip trailing markers like |x|
  str = str.replace(/\|x\|$/i, '').trim();

  // Decode XML / HTML entities
  if (str.includes('&lt;') || str.includes('&gt;') || str.includes('&quot;') || str.includes('&amp;')) {
    str = str
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  return sanitizeGalleryHtml(str.trim());
}

// Main Template Interpolation Engine
export function renderDescriptionTemplate(templateHtml: string, data: ListingTemplateData): string {
  if (!templateHtml) return '';

  let output = cleanAndDecodeDescription(templateHtml);

  const currencySymbol = data.currency === 'GBP' ? '£' : data.currency === 'EUR' ? '€' : '$';
  const priceFormatted =
    data.price !== undefined && data.price !== ''
      ? `${currencySymbol}${parseFloat(data.price.toString()).toFixed(2)}`
      : '';

  // 1. Basic Placeholders
  output = output.replace(/\{\{\s*title\s*\}\}/gi, data.title || '');
  output = output.replace(/\{\{\s*price\s*\}\}/gi, priceFormatted);
  output = output.replace(/\{\{\s*sku\s*\}\}/gi, data.sku || '');
  output = output.replace(/\{\{\s*quantity\s*\}\}/gi, data.quantity ? data.quantity.toString() : '1');
  output = output.replace(/\{\{\s*condition\s*\}\}/gi, data.condition || 'New');
  output = output.replace(/\{\{\s*(condition_description|seller_notes)\s*\}\}/gi, data.conditionDescription || '');
  output = output.replace(/\{\{\s*category\s*\}\}/gi, data.category || 'Jewelry');
  output = output.replace(/\{\{\s*store_name\s*\}\}/gi, data.storeName || 'Livuniq Fine Jewelry');
  output = output.replace(/\{\{\s*description\s*\}\}/gi, data.customDescription || '');

  // 2. Images (Filter out any video files so videos never render as broken photos/thumbnails)
  const photoOnlyImages = (data.images || []).filter((img) => Boolean(img && img.trim()) && !isVideoMedia(img));
  const mainImg = photoOnlyImages[0] || '';
  output = output.replace(/\{\{\s*(main_image|image_1)\s*\}\}/gi, mainImg);

  for (let i = 1; i <= 12; i++) {
    const imgUrl = photoOnlyImages[i - 1] || '';
    output = output.replace(new RegExp(`\\{\\{\\s*image_${i}\\s*\\}\\}`, 'gi'), imgUrl);
  }

  // 3. Automated Blocks
  if (output.includes('{{SPECIFICS_TABLE}}') || output.includes('{{specifics_table}}')) {
    const tableHtml = generateSpecificsTableHtml(data.itemSpecifics || {});
    output = output.replace(/\{\{\s*specifics_table\s*\}\}/gi, tableHtml);
  }

  if (output.includes('{{IMAGES_GALLERY}}') || output.includes('{{images_gallery}}')) {
    const galleryHtml = generateGalleryHtml(photoOnlyImages);
    output = output.replace(/\{\{\s*images_gallery\s*\}\}/gi, galleryHtml);
  }

  // 3b. Interactive Radio Gallery (#gallBlock matching user's exact structure)
  const radioGalleryTagRegex = /\{\{\s*(dynamic_gallery|gallblock|gallery_block|radio_gallery)\s*\}\}/gi;
  if (radioGalleryTagRegex.test(output)) {
    const radioGalleryHtml = generateRadioGalleryHtml(photoOnlyImages);
    output = output.replace(radioGalleryTagRegex, radioGalleryHtml);
  }

  // 3c. If user pasted raw static #gallBlock in their template, dynamically replace it so count matches uploaded images!
  const rawGallBlockRegex = /<div[^>]*id=["']gallBlock["'][^>]*>[\s\S]*?id=["']gallThumbs["'][\s\S]*?<\/div>\s*<\/div>/i;
  if (rawGallBlockRegex.test(output)) {
    const dynamicRadioHtml = generateRadioGalleryHtml(photoOnlyImages);
    output = output.replace(rawGallBlockRegex, dynamicRadioHtml);
  }

  // 3d. Literal IMG_1..12 and THUMB_1..12 replacement
  for (let i = 1; i <= 12; i++) {
    const imgUrl = photoOnlyImages[i - 1] || '';
    output = output.replace(new RegExp(`IMG_${i}`, 'g'), imgUrl);
    output = output.replace(new RegExp(`THUMB_${i}`, 'g'), imgUrl);
  }

  // Video placeholders
  if (data.videoUrl) {
    output = output.replace(/\{\{\s*(video_url|video)\s*\}\}/gi, data.videoUrl);
  }

  // 4. Specific Attribute Placeholders like {{specific.Metal}}, {{specific.Total Carat Weight}}
  const specifics = data.itemSpecifics || {};
  const specificTagRegex = /\{\{\s*specific\.([^\}]+)\s*\}\}/gi;
  output = output.replace(specificTagRegex, (_, key) => {
    const trimmedKey = key.trim();
    if (specifics[trimmedKey] !== undefined) return specifics[trimmedKey];
    const foundKey = Object.keys(specifics).find((k) => k.toLowerCase() === trimmedKey.toLowerCase());
    return foundKey ? specifics[foundKey] : '';
  });

  // 5. Excel Column Dynamic Attributes & Tags (Supports both {TAG} and {{TAG}})
  const templateAttrs = data.templateAttributes || {};
  const combinedLookup: Record<string, any> = { ...specifics, ...templateAttrs };

  const sideColorClarity = String(combinedLookup['SIDE_STONE_COLOR_CLARITY'] || combinedLookup['side_stone_color_clarity'] || '');
  const parsedSideColor = sideColorClarity.includes('/') ? sideColorClarity.split('/')[0].trim() : '';
  const parsedSideClarity = sideColorClarity.includes('/') ? sideColorClarity.split('/')[1].trim() : '';

  const tcwRaw = combinedLookup['TCW'] || combinedLookup['tcw'] || combinedLookup['Total Carat Weight'];
  const tcwClean = tcwRaw ? String(tcwRaw).replace(/[^0-9.]/g, '') : '';

  const dynamicDict: Record<string, string> = {
    title: data.title || '',
    price: priceFormatted,
    sku: data.sku || '',
    quantity: data.quantity ? data.quantity.toString() : '1',
    condition: data.condition || 'New',
    category: data.category || 'Jewelry',
    store_name: data.storeName || 'Livuniq Fine Jewelry',
    description: data.customDescription || '',
    tcw: tcwClean ? formatFloat2Decimals(tcwClean, true) : '',
    gold_color: combinedLookup['GOLD_COLOR'] || combinedLookup['gold_color'] || '',
    gold_kt: combinedLookup['GOLD_KT'] || combinedLookup['gold_kt'] || combinedLookup['Metal Purity'] || '14k',
    gold_weight: formatFloat2Decimals(combinedLookup['GOLD_WEIGHT'] || combinedLookup['gold_weight'], true),
    metel: combinedLookup['METEL'] || combinedLookup['metel'] || combinedLookup['Base Metal'] || 'Gold',
    metal: combinedLookup['Metal'] || (combinedLookup['GOLD_COLOR'] ? `${combinedLookup['GOLD_COLOR']} Gold` : '14k Gold'),
    certificate: combinedLookup['CERTIFICATE'] || combinedLookup['certificate'] || combinedLookup['Certified'] || combinedLookup['Certification'] || 'IGI',
    certified: combinedLookup['Certified'] || combinedLookup['CERTIFICATE'] || combinedLookup['certificate'] || 'IGI',
    center_stone_shape: combinedLookup['CENTER_STONE_SHAPE'] || combinedLookup['center_stone_shape'] || combinedLookup['Main Stone Shape'] || '',
    diamond_color: combinedLookup['DIAMOND_COLOR'] || combinedLookup['diamond_color'] || combinedLookup['CENTER_DIAMOND_COLOR'] || combinedLookup['Diamond Color Grade'] || '',
    center_diamond_color: combinedLookup['CENTER_DIAMOND_COLOR'] || combinedLookup['center_diamond_color'] || combinedLookup['DIAMOND_COLOR'] || '',
    diamond_clarity: combinedLookup['DIAMOND_CLARITY'] || combinedLookup['diamond_clarity'] || combinedLookup['CENTER_DIAMOND_CLARITY'] || combinedLookup['Diamond Clarity Grade'] || '',
    center_diamond_clarity: combinedLookup['CENTER_DIAMOND_CLARITY'] || combinedLookup['center_diamond_clarity'] || combinedLookup['DIAMOND_CLARITY'] || '',
    center_stone_weight: formatFloat2Decimals(combinedLookup['CENTER_STONE_WEIGHT'] || combinedLookup['center_stone_weight'], true),
    side_stone_shape: combinedLookup['SIDE_STONE_SHAPE'] || combinedLookup['side_stone_shape'] || '',
    side_stone_weight: formatFloat2Decimals(combinedLookup['SIDE_STONE_WEIGHT'] || combinedLookup['side_stone_weight'], true),
    side_stone_color_clarity: sideColorClarity,
    side_color: combinedLookup['SIDE_COLOR'] || combinedLookup['side_color'] || parsedSideColor,
    side_clarity: combinedLookup['SIDE_CLARITY'] || combinedLookup['side_clarity'] || parsedSideClarity,
    setting: combinedLookup['SETTING'] || combinedLookup['setting'] || combinedLookup['Setting Style'] || 'Prong',
    total_diamond_pcs: combinedLookup['TOTAL_DIAMOND_PCS'] || combinedLookup['total_diamond_pcs'] || combinedLookup['Number of Diamonds'] || '',
    cost_usd: combinedLookup['COST_USD'] || combinedLookup['cost_usd'] || '',
    selling_price_usd: combinedLookup['SELLING_PRICE_USD'] || combinedLookup['selling_price_usd'] || (data.price !== undefined ? parseFloat(data.price.toString()).toFixed(2) : ''),
    chain_length: combinedLookup['CHAIN_LENGTH'] || combinedLookup['chain_length'] || '',
    length: combinedLookup['LENGTH'] || combinedLookup['length'] || '',
    lot: combinedLookup['LOT'] || combinedLookup['lot'] || '',
  };

  // Add all combined lookup keys into the lookup dictionary
  for (const [k, v] of Object.entries(combinedLookup)) {
    if (v === undefined || v === null) continue;
    const isWeight = /weight|tcw|carat/i.test(k);
    const formattedVal = formatFloat2Decimals(v, isWeight);
    dynamicDict[k.toLowerCase()] = formattedVal;
    dynamicDict[k.toLowerCase().replace(/[\s\-_]/g, '')] = formattedVal;
  }

  // Replace all {TAG} and {{TAG}} matching our dynamic dictionary
  output = output.replace(/\{{1,2}\s*([a-zA-Z0-9_\-]+)\s*\}{1,2}/g, (match, rawKey) => {
    const cleanKey = rawKey.toLowerCase();
    const compactKey = cleanKey.replace(/[\s\-_]/g, '');

    if (dynamicDict[cleanKey] !== undefined && dynamicDict[cleanKey] !== '') {
      return dynamicDict[cleanKey];
    }
    if (dynamicDict[compactKey] !== undefined && dynamicDict[compactKey] !== '') {
      return dynamicDict[compactKey];
    }

    // If tag starts with img or thumb, let previous handlers manage it, else return match or blank if recognized
    return match;
  });

  return sanitizeGalleryHtml(output);
}

// Built-in Luxury Jewelry Presets
export const DEFAULT_TEMPLATES: DescriptionTemplate[] = [
  {
    id: 'tpl-livuniq-luxury',
    name: '💎 Livuniq Luxury Jewelry Master Template',
    description: 'Exclusive branded design with burgundy & gold accents, dynamic specs table, IGI certification guarantee, and photo gallery.',
    isDefault: true,
    createdAt: new Date().toISOString(),
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 960px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
  
  <!-- Header Branding -->
  <div style="background: linear-gradient(135deg, #4a0e19 0%, #631726 100%); padding: 24px 30px; text-align: center; border-bottom: 4px solid #c5a880;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase;">LIVUNIQ® FINE JEWELRY</h1>
    <p style="color: #f1dfc8; margin: 6px 0 0 0; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;">Certified Lab-Grown & Natural Diamonds</p>
  </div>

  <!-- Product Title & Highlights Banner -->
  <div style="padding: 24px 30px 16px 30px; border-bottom: 1px solid #f1f5f9; background: #fafaf9;">
    <h2 style="color: #631726; font-size: 20px; font-weight: 600; line-height: 1.4; margin: 0 0 12px 0;">{{title}}</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #64748b;">
      <span style="background: #f5ece8; color: #631726; padding: 4px 10px; border-radius: 6px; font-weight: 600;">SKU: {{sku}}</span>
      <span style="background: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 6px; font-weight: 600;">Condition: {{condition}}</span>
      <span style="background: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 6px; font-weight: 600;">Certification: {{specific.Certification}}</span>
      <span style="background: #ecfdf5; color: #047857; padding: 4px 10px; border-radius: 6px; font-weight: 600;">Metal: {{specific.Metal Purity}} {{specific.Metal}}</span>
    </div>
  </div>

  <!-- Main Hero Image Showcase -->
  <div style="padding: 24px 30px; text-align: center; background: #ffffff;">
    <img src="{{main_image}}" alt="{{title}}" style="max-width: 100%; max-height: 480px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" />
  </div>

  <!-- Key Diamond Specs Cards -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; padding: 0 30px 20px 30px;">
    <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 11px; color: #78716c; text-transform: uppercase;">Carat Weight</div>
      <div style="font-size: 16px; font-weight: bold; color: #631726; margin-top: 4px;">{{specific.Total Carat Weight}}</div>
    </div>
    <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 11px; color: #78716c; text-transform: uppercase;">Diamond Shape</div>
      <div style="font-size: 16px; font-weight: bold; color: #631726; margin-top: 4px;">{{specific.Main Stone Shape}}</div>
    </div>
    <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 11px; color: #78716c; text-transform: uppercase;">Color Grade</div>
      <div style="font-size: 16px; font-weight: bold; color: #631726; margin-top: 4px;">{{specific.Diamond Color Grade}}</div>
    </div>
    <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 11px; color: #78716c; text-transform: uppercase;">Clarity Grade</div>
      <div style="font-size: 16px; font-weight: bold; color: #631726; margin-top: 4px;">{{specific.Diamond Clarity Grade}}</div>
    </div>
    <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 11px; color: #78716c; text-transform: uppercase;">Ring Size</div>
      <div style="font-size: 16px; font-weight: bold; color: #631726; margin-top: 4px;">Size {{specific.Ring Size}} (Sizable)</div>
    </div>
  </div>

  <!-- Dynamic Item Specifics Table -->
  <div style="padding: 0 30px;">
    {{SPECIFICS_TABLE}}
  </div>

  <!-- Interactive Photo Gallery (Matches exact uploaded photos count) -->
  <div style="padding: 0 30px;">
    <h3 style="color: #631726; border-bottom: 2px solid #c5a880; padding-bottom: 6px; font-size: 16px; margin: 24px 0 12px 0;">INTERACTIVE PRODUCT GALLERY</h3>
    {{DYNAMIC_GALLERY}}
  </div>

  <!-- Quality Guarantee & Policies -->
  <div style="margin: 30px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px;">
    <h3 style="color: #631726; margin-top: 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">THE LIVUNIQ® COMMITMENT</h3>
    <ul style="padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 0;">
      <li><strong>100% Conflict-Free Diamond:</strong> Eco-friendly, sustainable lab-grown diamond crafted with perfection.</li>
      <li><strong>Custom Ring Sizing:</strong> Need a different size? Message us your desired ring size upon ordering, and our master jewelers will size it at no extra charge!</li>
      <li><strong>Fast, Insured Shipping:</strong> Secure tamper-proof luxury gift packaging delivered right to your door with full tracking.</li>
      <li><strong>Authenticity Guaranteed:</strong> Official certification report included with every piece.</li>
    </ul>
  </div>

  <!-- Footer -->
  <div style="background: #292524; color: #a8a29e; padding: 18px 30px; text-align: center; font-size: 12px; letter-spacing: 0.5px;">
    © {{store_name}} • Authenticity & Quality Guaranteed • Thank you for supporting our craft!
  </div>

</div>`,
  },
  {
    id: 'tpl-modern-minimal',
    name: '✨ Modern Minimalist Showcase',
    description: 'Clean modern grid layout with bold hero visual and automated specifications list.',
    createdAt: new Date().toISOString(),
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; color: #0f172a; padding: 20px; line-height: 1.6;">
  
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0f172a;">
    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 10px 0;">{{title}}</h1>
    <div style="font-size: 14px; color: #64748b;">SKU: {{sku}} | Condition: {{condition}} | {{store_name}}</div>
  </div>

  <div style="text-align: center; margin: 25px 0;">
    <img src="{{main_image}}" alt="{{title}}" style="max-width: 100%; max-height: 450px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);" />
  </div>

  <div style="margin: 30px 0;">
    <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Detailed Specifications</h2>
    {{SPECIFICS_TABLE}}
  </div>

  <div style="margin: 30px 0;">
    <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Product Photos</h2>
    {{IMAGES_GALLERY}}
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-top: 30px; font-size: 13px; color: #475569;">
    <h3 style="color: #0f172a; margin-top: 0;">Shipping & Returns</h3>
    <p>Orders are dispatched securely with signature confirmation. 30-day return policy for complete peace of mind.</p>
  </div>

</div>`,
  },
];

// Update all images embedded in an HTML description (including #gallBlock, gallery grids, and <img> tags)
export function updateDescriptionImages(
  description?: string | null,
  newImages: string[] = [],
  oldImages: string[] = []
): string {
  if (!description || typeof description !== 'string') return '';
  let updated = description;

  const validNew = newImages
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => Boolean(u) && !isVideoMedia(u));

  if (validNew.length === 0) return updated;

  // 1. Replace #gallBlock pure-CSS gallery (with preceding <style> if present, or standalone #gallBlock)
  const fullGallBlockRegex = /<style>[\s\S]*?#gallBlock[\s\S]*?<\/style>\s*<div[^>]*id=["']gallBlock["'][^>]*>[\s\S]*?id=["']gallThumbs["'][\s\S]*?<\/div>\s*<\/div>/i;
  const bareGallBlockRegex = /<div[^>]*id=["']gallBlock["'][^>]*>[\s\S]*?id=["']gallThumbs["'][\s\S]*?<\/div>\s*<\/div>/i;

  const newGallHtml = generateRadioGalleryHtml(validNew);

  if (fullGallBlockRegex.test(updated)) {
    updated = updated.replace(fullGallBlockRegex, newGallHtml);
  } else if (bareGallBlockRegex.test(updated)) {
    updated = updated.replace(bareGallBlockRegex, newGallHtml);
  }

  // 2. Direct replacement of any known old images in the HTML description
  const validOld = oldImages
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => Boolean(u) && !isVideoMedia(u));

  for (let i = 0; i < validOld.length; i++) {
    const oldUrl = validOld[i];
    if (!oldUrl) continue;
    const replacement = validNew[i] || validNew[0];
    updated = updated.split(oldUrl).join(replacement);
  }

  // 3. Replace any IMG_1..12 or THUMB_1..12 or {{IMAGE_1}} / {{MAIN_IMAGE}}
  updated = updated.replace(/\{\{\s*(main_image|image_1)\s*\}\}/gi, validNew[0]);
  for (let i = 1; i <= 12; i++) {
    const replacement = validNew[i - 1] || validNew[0];
    updated = updated.replace(new RegExp(`IMG_${i}`, 'g'), replacement);
    updated = updated.replace(new RegExp(`THUMB_${i}`, 'g'), replacement);
    updated = updated.replace(new RegExp(`\\{\\{\\s*image_${i}\\s*\\}\\}`, 'gi'), replacement);
  }

  return sanitizeGalleryHtml(updated);
}
