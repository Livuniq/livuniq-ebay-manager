export interface SpecificMappingRule {
  field: string;
  type: 'static' | 'dynamic';
  value: string;
  category?: string;
}

export interface MasterCategoryProfile {
  id: string;
  name: string;
  ebayCategoryId: string;
  ebayCategoryName?: string;
  aliases: string[];
  templateId: string;
  rules: SpecificMappingRule[];
  isDefault?: boolean;
}

export const RAW_EXCEL_BLACKLIST = new Set([
  'lot',
  'cost_usd',
  'costusd',
  'selling_price_usd',
  'sellingpriceusd',
  'sell_price',
  'sellprice',
  'gold_kt',
  'goldkt',
  'gold_color',
  'goldcolor',
  'gold_weight',
  'goldweight',
  'center_stone_shape',
  'centerstoneshape',
  'center_stone_weight',
  'centerstoneweight',
  'center_diamond_color',
  'centerdiamondcolor',
  'center_diamond_clarity',
  'centerdiamondclarity',
  'side_stone_shape',
  'sidestoneshape',
  'side_stone_weight',
  'sidestoneweight',
  'side_stone_color_clarity',
  'sidestonecolorclarity',
  'setting',
  'total_diamond_pcs',
  'totaldiamondpcs',
  'tcw',
  'metel',
  'diamond_color',
  'diamondcolor',
  'diamond_clarity',
  'diamondclarity',
  'certificate',
  'side_color',
  'sidecolor',
  'side_clarity',
  'sideclarity',
  'sku',
  'title',
  'price',
  'quantity',
  'seller_notes',
  'sellernotes',
  'category',
  'category_id',
  'categoryid',
  'category_name',
  'categoryname',
  'condition',
  'condition_id',
  'conditionid',
  'images',
  'image_names',
  'imagenames',
  'matched_image_urls',
  'matchedimageurls',
  'original_sku',
  'originalsku',
  'index',
  'status',
  'status_message',
  'statusmessage',
  'certified',
  'chain_length',
  'length',
  'description',
  'url',
]);

export function isEbayItemSpecific(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const normalized = lower.replace(/[\s\-_]/g, '');

  if (RAW_EXCEL_BLACKLIST.has(lower) || RAW_EXCEL_BLACKLIST.has(normalized)) {
    return false;
  }
  // Reject keys with underscores (e.g. GOLD_KT, CENTER_STONE_SHAPE)
  if (trimmed.includes('_')) {
    return false;
  }
  // Reject all-caps words without spaces with length >= 3 (e.g. METEL, LOT, TCW)
  if (/^[A-Z0-9]{3,}$/.test(trimmed)) {
    return false;
  }
  return true;
}

export const DEFAULT_SPECIFICS_MAPPINGS: SpecificMappingRule[] = [
  // 💎 Diamond & Gemstone Specifics
  { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
  { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
  { field: 'Main Stone Treatment', type: 'static', value: 'Not Enhanced', category: 'Diamond & Gemstone' },
  { field: 'Main Stone Shape', type: 'dynamic', value: 'CENTER_STONE_SHAPE', category: 'Diamond & Gemstone' },
  { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
  { field: 'Main Stone Color', type: 'static', value: 'White', category: 'Diamond & Gemstone' },
  { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
  { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
  { field: 'Cut Grade', type: 'static', value: 'Excellent', category: 'Diamond & Gemstone' },
  { field: 'Colored Diamond Intensity', type: 'static', value: 'Very Light', category: 'Diamond & Gemstone' },
  { field: 'Gemstone Clarity Grade', type: 'static', value: 'Eye Clean', category: 'Diamond & Gemstone' },
  { field: 'Number of Diamonds', type: 'dynamic', value: 'TOTAL_DIAMOND_PCS', category: 'Diamond & Gemstone' },
  { field: 'Secondary Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
  { field: 'Side Stone Shape', type: 'dynamic', value: 'SIDE_STONE_SHAPE', category: 'Diamond & Gemstone' },
  { field: 'Side Stone Weight', type: 'dynamic', value: 'SIDE_STONE_WEIGHT', category: 'Diamond & Gemstone' },

  // 💍 Metal & Ring Sizing
  { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
  { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
  { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
  { field: 'Ring Size', type: 'static', value: '7', category: 'Metal & Ring Sizing' },
  { field: 'Sizable', type: 'static', value: 'Yes', category: 'Metal & Ring Sizing' },
  { field: 'Setting Style', type: 'dynamic', value: 'SETTING', category: 'Metal & Ring Sizing' },
  { field: 'Material', type: 'static', value: '14k Solid Gold, Lab-Grown Diamond', category: 'Metal & Ring Sizing' },

  // 🏷️ Brand, Certification & Details
  { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
  { field: 'Certification', type: 'dynamic', value: 'Certified', category: 'Brand, Certification & Details' },
  { field: 'MPN', type: 'static', value: '15410', category: 'Brand, Certification & Details' },
  { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
  { field: 'Collection', type: 'static', value: 'Engagement & Proposal Diamond Ring', category: 'Brand, Certification & Details' },
  { field: 'Features', type: 'static', value: 'Engraved, Nickel-Free, CVD Diamond', category: 'Brand, Certification & Details' },
  { field: 'Country of Origin', type: 'static', value: 'United States', category: 'Brand, Certification & Details' },
  { field: 'Theme', type: 'static', value: 'Beauty, Love & Angels', category: 'Brand, Certification & Details' },

  // ✍️ Personalization
  { field: 'Personalize', type: 'static', value: 'Yes', category: 'Personalization' },
  { field: 'Personalization Instructions', type: 'static', value: 'Message us your desired size. We will customize it accordingly. Thank you for your cooperation.', category: 'Personalization' },
];

export const DEFAULT_CATEGORY_PROFILES: MasterCategoryProfile[] = [
  // 1. Engagement Ring
  {
    id: 'engagement_ring',
    name: 'Engagement Ring',
    ebayCategoryId: '261975',
    ebayCategoryName: 'Engagement Rings',
    aliases: ['engagement ring', 'engagement', 'er', 'solitaire ring', 'diamond ring', 'ring'],
    templateId: 'tpl-livuniq-luxury',
    isDefault: true,
    rules: [
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Treatment', type: 'static', value: 'Not Enhanced', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Shape', type: 'dynamic', value: 'CENTER_STONE_SHAPE', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Color', type: 'static', value: 'White', category: 'Diamond & Gemstone' },
      { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
      { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
      { field: 'Cut Grade', type: 'static', value: 'Excellent', category: 'Diamond & Gemstone' },
      { field: 'Colored Diamond Intensity', type: 'static', value: 'Very Light', category: 'Diamond & Gemstone' },
      { field: 'Gemstone Clarity Grade', type: 'static', value: 'Eye Clean', category: 'Diamond & Gemstone' },
      { field: 'Number of Diamonds', type: 'dynamic', value: 'TOTAL_DIAMOND_PCS', category: 'Diamond & Gemstone' },
      { field: 'Secondary Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Side Stone Shape', type: 'dynamic', value: 'SIDE_STONE_SHAPE', category: 'Diamond & Gemstone' },
      { field: 'Side Stone Weight', type: 'dynamic', value: 'SIDE_STONE_WEIGHT', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Ring Size', type: 'static', value: '7', category: 'Metal & Ring Sizing' },
      { field: 'Sizable', type: 'static', value: 'Yes', category: 'Metal & Ring Sizing' },
      { field: 'Setting Style', type: 'dynamic', value: 'SETTING', category: 'Metal & Ring Sizing' },
      { field: 'Material', type: 'static', value: '14k Solid Gold, Lab-Grown Diamond', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Certification', type: 'dynamic', value: 'Certified', category: 'Brand, Certification & Details' },
      { field: 'MPN', type: 'static', value: '15410', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
      { field: 'Collection', type: 'static', value: 'Engagement & Proposal Diamond Ring', category: 'Brand, Certification & Details' },
      { field: 'Features', type: 'static', value: 'Engraved, Nickel-Free, CVD Diamond', category: 'Brand, Certification & Details' },
      { field: 'Personalize', type: 'static', value: 'Yes', category: 'Personalization' },
      { field: 'Personalization Instructions', type: 'static', value: 'Message us your desired size. We will customize it accordingly. Thank you for your cooperation.', category: 'Personalization' },
    ],
  },

  // 2. Wedding Ring / Band
  {
    id: 'wedding_ring',
    name: 'Wedding Ring',
    ebayCategoryId: '179644',
    ebayCategoryName: 'Wedding & Anniversary Bands',
    aliases: ['wedding ring', 'wedding band', 'bbx', 'band', 'eternity band', 'wedding'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: 'Band', category: 'Brand, Certification & Details' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Treatment', type: 'static', value: 'Not Enhanced', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Shape', type: 'static', value: 'Round', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
      { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
      { field: 'Cut Grade', type: 'static', value: 'Excellent', category: 'Diamond & Gemstone' },
      { field: 'Band Width', type: 'static', value: '2.0 mm', category: 'Metal & Ring Sizing' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Ring Size', type: 'static', value: '7', category: 'Metal & Ring Sizing' },
      { field: 'Sizable', type: 'static', value: 'Yes', category: 'Metal & Ring Sizing' },
      { field: 'Setting Style', type: 'dynamic', value: 'SETTING', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Certification', type: 'dynamic', value: 'Certified', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
      { field: 'Personalize', type: 'static', value: 'Yes', category: 'Personalization' },
      { field: 'Personalization Instructions', type: 'static', value: 'Message us your desired ring size upon ordering.', category: 'Personalization' },
    ],
  },

  // 3. Wedding Ring Set
  {
    id: 'wedding_ring_set',
    name: 'Wedding Ring Set',
    ebayCategoryId: '179644',
    ebayCategoryName: 'Wedding & Anniversary Sets',
    aliases: ['wedding ring set', 'wedding set', 'ring set', 'ssx', 'bridal set', 'trio set', 'his and hers set'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: 'Bridal Set', category: 'Brand, Certification & Details' },
      { field: 'Number of Rings', type: 'static', value: '2', category: 'Brand, Certification & Details' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Shape', type: 'dynamic', value: 'CENTER_STONE_SHAPE', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
      { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Ring Size', type: 'static', value: '7', category: 'Metal & Ring Sizing' },
      { field: 'Sizable', type: 'static', value: 'Yes', category: 'Metal & Ring Sizing' },
      { field: 'Setting Style', type: 'dynamic', value: 'SETTING', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
    ],
  },

  // 4. Men's Ring
  {
    id: 'mens_ring',
    name: "Men's Ring",
    ebayCategoryId: '261974',
    ebayCategoryName: "Men's Rings",
    aliases: ['mens ring', "men's ring", 'mens band', "men's band", 'mmx', 'gents ring', 'mens wedding band'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: "Men's Ring", category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Men', category: 'Brand, Certification & Details' },
      { field: 'Ring Size', type: 'static', value: '10', category: 'Metal & Ring Sizing' },
      { field: 'Band Width', type: 'static', value: '6 mm', category: 'Metal & Ring Sizing' },
      { field: 'Sizable', type: 'static', value: 'Yes', category: 'Metal & Ring Sizing' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
    ],
  },

  // 5. Bracelet
  {
    id: 'bracelet',
    name: 'Bracelet',
    ebayCategoryId: '10968',
    ebayCategoryName: 'Fine Bracelets & Charms',
    aliases: ['bracelet', 'bangle', 'tennis bracelet', 'cuff', 'chain bracelet', 'wristband'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: 'Bracelet', category: 'Brand, Certification & Details' },
      { field: 'Style', type: 'static', value: 'Tennis', category: 'Brand, Certification & Details' },
      { field: 'Closure', type: 'static', value: 'Box', category: 'Metal & Ring Sizing' },
      { field: 'Item Length', type: 'static', value: '7 in', category: 'Metal & Ring Sizing' },
      { field: 'Chain Type', type: 'static', value: 'Tennis', category: 'Metal & Ring Sizing' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Number of Diamonds', type: 'dynamic', value: 'TOTAL_DIAMOND_PCS', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
    ],
  },

  // 6. Earrings
  {
    id: 'earrings',
    name: 'Earrings',
    ebayCategoryId: '10986',
    ebayCategoryName: 'Fine Earrings',
    aliases: ['earrings', 'earring', 'studs', 'hoops', 'drop earrings', 'dangle earrings'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: 'Earrings', category: 'Brand, Certification & Details' },
      { field: 'Style', type: 'static', value: 'Stud', category: 'Brand, Certification & Details' },
      { field: 'Closure', type: 'static', value: 'Screw Back', category: 'Metal & Ring Sizing' },
      { field: 'Ear Area', type: 'static', value: 'Lobe', category: 'Metal & Ring Sizing' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Shape', type: 'dynamic', value: 'CENTER_STONE_SHAPE', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
      { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
      { field: 'Cut Grade', type: 'static', value: 'Excellent', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
    ],
  },

  // 7. Pendant
  {
    id: 'pendant',
    name: 'Pendant',
    ebayCategoryId: '11005',
    ebayCategoryName: 'Fine Necklaces & Pendants',
    aliases: ['pendant', 'solitaire pendant', 'diamond pendant', 'charm', 'locket'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: 'Pendant', category: 'Brand, Certification & Details' },
      { field: 'Style', type: 'static', value: 'Solitaire', category: 'Brand, Certification & Details' },
      { field: 'Pendant Shape', type: 'dynamic', value: 'CENTER_STONE_SHAPE', category: 'Diamond & Gemstone' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
      { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
    ],
  },

  // 8. Necklace
  {
    id: 'necklace',
    name: 'Necklace',
    ebayCategoryId: '11005',
    ebayCategoryName: 'Fine Necklaces & Pendants',
    aliases: ['necklace', 'chain', 'choker', 'tennis necklace', 'collar'],
    templateId: 'tpl-livuniq-luxury',
    rules: [
      { field: 'Type', type: 'static', value: 'Necklace', category: 'Brand, Certification & Details' },
      { field: 'Style', type: 'static', value: 'Chain & Pendant', category: 'Brand, Certification & Details' },
      { field: 'Chain Type', type: 'static', value: 'Cable', category: 'Metal & Ring Sizing' },
      { field: 'Chain Length', type: 'static', value: '18 in', category: 'Metal & Ring Sizing' },
      { field: 'Closure', type: 'static', value: 'Lobster', category: 'Metal & Ring Sizing' },
      { field: 'Main Stone', type: 'static', value: 'Diamond', category: 'Diamond & Gemstone' },
      { field: 'Main Stone Creation', type: 'static', value: 'Lab-Created', category: 'Diamond & Gemstone' },
      { field: 'Total Carat Weight', type: 'dynamic', value: 'TCW', category: 'Diamond & Gemstone' },
      { field: 'Diamond Color Grade', type: 'dynamic', value: 'CENTER_DIAMOND_COLOR', category: 'Diamond & Gemstone' },
      { field: 'Diamond Clarity Grade', type: 'dynamic', value: 'CENTER_DIAMOND_CLARITY', category: 'Diamond & Gemstone' },
      { field: 'Metal', type: 'dynamic', value: 'GOLD_COLOR', category: 'Metal & Ring Sizing' },
      { field: 'Metal Purity', type: 'dynamic', value: 'GOLD_KT', category: 'Metal & Ring Sizing' },
      { field: 'Base Metal', type: 'static', value: 'Gold', category: 'Metal & Ring Sizing' },
      { field: 'Brand', type: 'static', value: 'Livuniq®', category: 'Brand, Certification & Details' },
      { field: 'Department', type: 'static', value: 'Women', category: 'Brand, Certification & Details' },
    ],
  },
];

// Helper to match a product row to its designated Master Category Profile
export function findMatchingCategoryProfile(
  input: { category?: string; sku?: string; originalSku?: string; title?: string },
  profiles: MasterCategoryProfile[] = DEFAULT_CATEGORY_PROFILES
): MasterCategoryProfile {
  if (!profiles || profiles.length === 0) {
    return DEFAULT_CATEGORY_PROFILES[0];
  }

  const rawCat = (input.category || '').toLowerCase().trim();
  const rawSku = (input.sku || '').toLowerCase().trim();
  const rawOrigSku = (input.originalSku || '').toLowerCase().trim();
  const rawTitle = (input.title || '').toLowerCase().trim();

  // Phase 1: Exact Category match (highest priority, e.g. "wedding ring" === "wedding ring")
  if (rawCat) {
    for (const profile of profiles) {
      if (!profile.aliases || !Array.isArray(profile.aliases)) continue;
      for (const alias of profile.aliases) {
        const cleanAlias = alias.toLowerCase().trim();
        if (cleanAlias && rawCat === cleanAlias) {
          return profile;
        }
      }
    }
  }

  // Flatten all aliases sorted by length descending so "wedding ring set" / "wedding ring" match before "ring"
  const candidates: { profile: MasterCategoryProfile; alias: string }[] = [];
  for (const profile of profiles) {
    if (!profile.aliases || !Array.isArray(profile.aliases)) continue;
    for (const alias of profile.aliases) {
      const cleanAlias = alias.toLowerCase().trim();
      if (cleanAlias) {
        candidates.push({ profile, alias: cleanAlias });
      }
    }
  }
  candidates.sort((a, b) => b.alias.length - a.alias.length);

  // Phase 2: SKU prefix match (e.g. bbx, ssx, mmx)
  for (const { profile, alias } of candidates) {
    if (rawOrigSku && (rawOrigSku.startsWith(alias) || rawOrigSku.startsWith(alias + '-') || rawOrigSku.startsWith(alias + '_'))) {
      return profile;
    }
    if (rawSku && (rawSku.startsWith(alias) || rawSku.startsWith(alias + '-') || rawSku.startsWith(alias + '_'))) {
      return profile;
    }
  }

  // Phase 3: Category contains alias (longer first)
  if (rawCat) {
    for (const { profile, alias } of candidates) {
      if (rawCat.includes(alias)) {
        return profile;
      }
    }
  }

  // Phase 4: SKU contains alias (longer first)
  for (const { profile, alias } of candidates) {
    if (rawOrigSku && rawOrigSku.includes(alias)) {
      return profile;
    }
    if (rawSku && rawSku.includes(alias)) {
      return profile;
    }
  }

  // Phase 5: Title contains alias (longer first)
  if (rawTitle) {
    for (const { profile, alias } of candidates) {
      if (rawTitle.includes(alias)) {
        return profile;
      }
    }
  }

  // Fallback: Default profile or first
  return profiles.find((p) => p.isDefault) || profiles[0];
}
