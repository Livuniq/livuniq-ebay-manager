import { ConnectedAccount, EbayListing, EbayOrder, EbayMessageThread, MasterAppConfig } from './types';

export const initialMasterConfig: MasterAppConfig = {
  masterAppId: '',
  masterCertId: '',
  masterRuName: '',
  environment: 'demo',
  isLiveConfigured: false,
};

export const initialAccounts: ConnectedAccount[] = [
  {
    id: 'acc-us-01',
    ebayUsername: 'TechVolt_Direct',
    storeName: 'TechVolt Electronics US',
    marketplace: 'EBAY_US',
    currency: 'USD',
    sellerLevel: 'Top Rated Plus',
    status: 'ACTIVE',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60',
    connectedAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    lastSyncedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    tokenExpiresAt: new Date(Date.now() + 3600000 * 24 * 500).toISOString(), // 18 months OAuth refresh token
  },
  {
    id: 'acc-uk-02',
    ebayUsername: 'RetroVault_UK',
    storeName: 'RetroVault Collectibles UK',
    marketplace: 'EBAY_GB',
    currency: 'GBP',
    sellerLevel: 'Above Standard',
    status: 'ACTIVE',
    avatarUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&auto=format&fit=crop&q=60',
    connectedAt: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
    lastSyncedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    tokenExpiresAt: new Date(Date.now() + 3600000 * 24 * 520).toISOString(),
  }
];

export const initialListings: EbayListing[] = [
  // Store 1 (US Store)
  {
    id: 'lst-101',
    accountId: 'acc-us-01',
    sku: 'EL-AUD-092',
    title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones - Midnight Black',
    price: 348.00,
    currency: 'USD',
    quantity: 14,
    sold: 86,
    category: 'Consumer Electronics > Headphones',
    condition: 'NEW',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
    status: 'ACTIVE',
    ebayListingId: '284910294811',
    lastUpdated: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'lst-102',
    accountId: 'acc-us-01',
    sku: 'AP-WCH-801',
    title: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum Case with Sport Band',
    price: 399.00,
    currency: 'USD',
    quantity: 6,
    sold: 142,
    category: 'Cell Phones & Accessories > Smart Watches',
    condition: 'NEW',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
    status: 'ACTIVE',
    ebayListingId: '284910294812',
    lastUpdated: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'lst-103',
    accountId: 'acc-us-01',
    sku: 'GM-KBD-55',
    title: 'Logitech G PRO X Wireless Mechanical Gaming Keyboard - Clicky Blue',
    price: 149.99,
    currency: 'USD',
    quantity: 2,
    sold: 34,
    category: 'Computers/Tablets & Networking > Keyboards & Mice',
    condition: 'NEW',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60',
    status: 'ACTIVE',
    ebayListingId: '284910294813',
    lastUpdated: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'lst-104',
    accountId: 'acc-us-01',
    sku: 'CAM-DSLR-03',
    title: 'Fujifilm X-T4 Mirrorless Digital Camera Body Only - Silver',
    price: 1199.00,
    currency: 'USD',
    quantity: 0,
    sold: 12,
    category: 'Cameras & Photo > Digital Cameras',
    condition: 'USED',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=60',
    status: 'OUT_OF_STOCK',
    ebayListingId: '284910294814',
    lastUpdated: new Date(Date.now() - 3600000 * 48).toISOString(),
  },

  // Store 2 (UK Store)
  {
    id: 'lst-201',
    accountId: 'acc-uk-02',
    sku: 'GB-RETRO-01',
    title: 'Vintage 1989 Nintendo Game Boy DMG-01 - Fully Restored IPS Screen',
    price: 135.00,
    currency: 'GBP',
    quantity: 4,
    sold: 28,
    category: 'Video Games & Consoles > Consoles',
    condition: 'REFURBISHED',
    imageUrl: 'https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?w=500&auto=format&fit=crop&q=60',
    status: 'ACTIVE',
    ebayListingId: '392019284711',
    lastUpdated: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'lst-202',
    accountId: 'acc-uk-02',
    sku: 'GB-VINYL-77',
    title: 'Pink Floyd - The Dark Side of the Moon Original Vinyl LP 1973 UK Pressing',
    price: 95.00,
    currency: 'GBP',
    quantity: 1,
    sold: 7,
    category: 'Music > Vinyl Records',
    condition: 'USED',
    imageUrl: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&auto=format&fit=crop&q=60',
    status: 'ACTIVE',
    ebayListingId: '392019284712',
    lastUpdated: new Date(Date.now() - 3600000 * 18).toISOString(),
  }
];

export const initialOrders: EbayOrder[] = [
  // Store 1 Orders
  {
    id: 'ord-901',
    accountId: 'acc-us-01',
    orderNumber: '24-10928-84729',
    buyer: {
      username: 'tech_collector99',
      name: 'Michael Henderson',
      email: 'm.henderson99@example.com',
      shippingAddress: {
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        country: 'United States',
      },
    },
    items: [
      {
        listingId: 'lst-101',
        title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones - Midnight Black',
        sku: 'EL-AUD-092',
        price: 348.00,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
      }
    ],
    totalAmount: 348.00,
    currency: 'USD',
    orderDate: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'PAID_AWAITING_SHIPMENT',
  },
  {
    id: 'ord-902',
    accountId: 'acc-us-01',
    orderNumber: '19-48201-94812',
    buyer: {
      username: 'sarah_designer',
      name: 'Sarah Jenkins',
      email: 'sjenkins_design@example.com',
      shippingAddress: {
        street: '120 Market Street, Apt 4B',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94103',
        country: 'United States',
      },
    },
    items: [
      {
        listingId: 'lst-102',
        title: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum Case with Sport Band',
        sku: 'AP-WCH-801',
        price: 399.00,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
      }
    ],
    totalAmount: 399.00,
    currency: 'USD',
    orderDate: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'PAID_AWAITING_SHIPMENT',
  },

  // Store 2 Orders
  {
    id: 'ord-801',
    accountId: 'acc-uk-02',
    orderNumber: '44-90218-11293',
    buyer: {
      username: 'oliver_london',
      name: 'Oliver Wright',
      email: 'oliver.wright@example.co.uk',
      shippingAddress: {
        street: '14 Baker Street',
        city: 'London',
        state: 'Greater London',
        postalCode: 'NW1 6XE',
        country: 'United Kingdom',
      },
    },
    items: [
      {
        listingId: 'lst-201',
        title: 'Vintage 1989 Nintendo Game Boy DMG-01 - Fully Restored IPS Screen',
        sku: 'GB-RETRO-01',
        price: 135.00,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?w=500&auto=format&fit=crop&q=60',
      }
    ],
    totalAmount: 135.00,
    currency: 'GBP',
    orderDate: new Date(Date.now() - 3600000 * 3).toISOString(),
    status: 'PAID_AWAITING_SHIPMENT',
  }
];

export const initialThreads: EbayMessageThread[] = [
  // Store 1 Messages
  {
    id: 'thr-301',
    accountId: 'acc-us-01',
    buyerUsername: 'tech_collector99',
    buyerName: 'Michael Henderson',
    itemTitle: 'Sony WH-1000XM5 Wireless Headphones',
    listingId: 'lst-101',
    subject: 'Question regarding expedited shipping',
    lastMessageSnippet: 'Can you ship this via USPS Priority Express? I need it by Friday.',
    lastUpdated: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    unread: true,
    messages: [
      {
        id: 'msg-1',
        sender: 'tech_collector99',
        senderRole: 'BUYER',
        timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        body: 'Hello! I just placed an order for the Sony WH-1000XM5 headphones. Can you please ship this via USPS Priority Express? I am traveling this weekend and need it delivered by Friday if possible.',
      }
    ]
  },

  // Store 2 Messages
  {
    id: 'thr-201',
    accountId: 'acc-uk-02',
    buyerUsername: 'vintage_collector_uk',
    buyerName: 'George Harrison',
    itemTitle: 'Pink Floyd - The Dark Side of the Moon Original Vinyl',
    listingId: 'lst-202',
    subject: 'Condition of vinyl sleeve and posters?',
    lastMessageSnippet: 'Are both original posters and stickers included inside the gatefold?',
    lastUpdated: new Date(Date.now() - 3600000 * 5).toISOString(),
    unread: true,
    messages: [
      {
        id: 'msg-201',
        sender: 'vintage_collector_uk',
        senderRole: 'BUYER',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        body: 'Hi there! Are both original posters and stickers included inside the gatefold for this Pink Floyd pressing? Interested in purchasing right away.',
      }
    ]
  }
];
