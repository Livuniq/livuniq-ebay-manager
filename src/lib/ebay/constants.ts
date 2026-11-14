export interface EbayCategoryOption {
  id: string;
  name: string;
  path: string;
}

export interface EbayConditionOption {
  id: string;
  name: string;
  label: string;
}

// Official eBay Categories from File Exchange / Merchant Integration Platform
export const EBAY_JEWELRY_CATEGORIES: EbayCategoryOption[] = [
  {
    id: '261975',
    name: 'Engagement Rings',
    path: '/Jewelry & Watches/Engagement & Wedding/Engagement Rings',
  },
  {
    id: '261976',
    name: 'Engagement & Wedding Ring Sets',
    path: '/Jewelry & Watches/Engagement & Wedding/Engagement & Wedding Ring Sets',
  },
  {
    id: '261977',
    name: 'Wedding & Anniversary Bands',
    path: '/Jewelry & Watches/Engagement & Wedding/Wedding & Anniversary Bands',
  },
  {
    id: '261994',
    name: 'Fine Rings',
    path: '/Jewelry & Watches/Fine Jewelry/Rings',
  },
  {
    id: '261990',
    name: 'Fine Earrings',
    path: '/Jewelry & Watches/Fine Jewelry/Earrings',
  },
  {
    id: '261993',
    name: 'Fine Necklaces & Pendants',
    path: '/Jewelry & Watches/Fine Jewelry/Necklaces & Pendants',
  },
  {
    id: '261988',
    name: 'Fine Bracelets & Charms',
    path: '/Jewelry & Watches/Fine Jewelry/Bracelets & Charms',
  },
  {
    id: '137856',
    name: "Men's Rings",
    path: "/Jewelry & Watches/Men's Jewelry/Rings",
  },
  {
    id: '261999',
    name: "Men's Bracelets & Charms",
    path: "/Jewelry & Watches/Men's Jewelry/Bracelets & Charms",
  },
  {
    id: '14085',
    name: "Men's Earrings",
    path: "/Jewelry & Watches/Men's Jewelry/Earrings",
  },
];

// Official eBay Condition IDs from File Exchange
export const EBAY_FILE_EXCHANGE_CONDITIONS: EbayConditionOption[] = [
  {
    id: '1000',
    name: '1000 - New with packaging',
    label: 'Brand New (with packaging/box/tags)',
  },
  {
    id: '1500',
    name: '1500 - New without packaging',
    label: 'New (without packaging/tags)',
  },
  {
    id: '1750',
    name: '1750 - New with imperfections',
    label: 'New with imperfections',
  },
  {
    id: '2990',
    name: '2990 - Pre-owned - Excellent',
    label: 'Pre-owned - Excellent condition',
  },
  {
    id: '3000',
    name: '3000 - Pre-owned - Good',
    label: 'Pre-owned - Good condition',
  },
  {
    id: '3010',
    name: '3010 - Pre-owned - Fair',
    label: 'Pre-owned - Fair condition',
  },
];
