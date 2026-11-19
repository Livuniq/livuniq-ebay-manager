import { NextResponse } from 'next/server';
import {
  ensureStoreAsync,
  getAccountForEnvironment,
  getActiveAccountId,
  getStore,
} from '@/lib/ebay/server-store';
import { ensureFreshAccessToken, isAccountSandbox } from '@/lib/ebay/live-sync';

// Cache aspects in memory for 1 hour to make UI instant
const aspectsCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    await ensureStoreAsync();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') || '261975';
    const accountId = searchParams.get('accountId') || getActiveAccountId();

    const account = getAccountForEnvironment(accountId);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'No active connected eBay account found' },
        { status: 400 }
      );
    }

    const cacheKey = `${account.marketplace || 'EBAY_US'}_${categoryId}`;
    const cached = aspectsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        cached: true,
        ...cached.data,
      });
    }

    const accessToken = await ensureFreshAccessToken(account);
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Could not obtain eBay access token' },
        { status: 401 }
      );
    }

    const store = getStore();
    const isSandbox = isAccountSandbox(account, store.masterConfig);
    const host = isSandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

    // eBay category tree ID: US=0, UK=3, DE=77, AU=15
    const treeId =
      account.marketplace === 'EBAY_GB'
        ? '3'
        : account.marketplace === 'EBAY_DE'
        ? '77'
        : account.marketplace === 'EBAY_AU'
        ? '15'
        : '0';

    const url = `${host}/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(
      categoryId
    )}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Accept-Language': 'en-US',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        {
          success: false,
          error: `eBay Taxonomy API error (${res.status}): ${errText.slice(0, 300)}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const rawAspects = Array.isArray(data.aspects) ? data.aspects : [];

    const formattedAspects = rawAspects.map((asp: any) => {
      const name = asp.localizedAspectName || '';
      const isRequired = Boolean(asp.aspectConstraint?.aspectRequired);
      const usage = asp.aspectConstraint?.aspectUsage || 'OPTIONAL';
      const dataType = asp.aspectConstraint?.aspectDataType || 'STRING';
      const mode = asp.aspectConstraint?.aspectMode || 'FREE_TEXT';
      const rawValues = Array.isArray(asp.aspectValues) ? asp.aspectValues : [];
      const values = rawValues.map((v: any) => v.localizedValue).filter(Boolean);

      // Intelligent Group Assignment
      let group = 'Brand, Certification & Details';
      const lower = name.toLowerCase();
      if (
        lower.includes('metal') ||
        lower.includes('gold') ||
        lower.includes('size') ||
        lower.includes('band') ||
        lower.includes('width') ||
        lower.includes('length')
      ) {
        group = 'Metal & Ring Sizing';
      } else if (
        lower.includes('stone') ||
        lower.includes('diamond') ||
        lower.includes('carat') ||
        lower.includes('tcw') ||
        lower.includes('color') ||
        lower.includes('clarity') ||
        lower.includes('cut') ||
        lower.includes('shape') ||
        lower.includes('gemstone')
      ) {
        group = 'Diamond & Gemstone';
      }

      // Intelligent Suggested Default
      let suggestedType: 'static' | 'dynamic' = 'static';
      let suggestedValue = '';

      if (lower === 'brand') {
        suggestedType = 'static';
        suggestedValue = 'Livuniq';
      } else if (lower === 'ring size') {
        suggestedType = 'dynamic';
        suggestedValue = 'RING_SIZE';
      } else if (lower === 'metal') {
        suggestedType = 'dynamic';
        suggestedValue = 'GOLD_COLOR';
      } else if (lower === 'metal purity') {
        suggestedType = 'dynamic';
        suggestedValue = 'GOLD_KT';
      } else if (lower === 'main stone') {
        suggestedType = 'static';
        suggestedValue = 'Diamond';
      } else if (lower === 'main stone creation') {
        suggestedType = 'static';
        suggestedValue = 'Lab-Created';
      } else if (lower === 'main stone treatment') {
        suggestedType = 'static';
        suggestedValue = 'Not Enhanced';
      } else if (lower === 'total carat weight') {
        suggestedType = 'dynamic';
        suggestedValue = 'TCW';
      } else if (lower === 'main stone shape') {
        suggestedType = 'dynamic';
        suggestedValue = 'CENTER_STONE_SHAPE';
      } else if (lower === 'diamond color grade') {
        suggestedType = 'dynamic';
        suggestedValue = 'CENTER_DIAMOND_COLOR';
      } else if (lower === 'diamond clarity grade') {
        suggestedType = 'dynamic';
        suggestedValue = 'CENTER_DIAMOND_CLARITY';
      } else if (lower === 'cut grade') {
        suggestedType = 'static';
        suggestedValue = 'Excellent';
      } else if (lower === 'certification') {
        suggestedType = 'static';
        suggestedValue = 'IGI';
      } else if (lower === 'sizable') {
        suggestedType = 'static';
        suggestedValue = 'Yes';
      } else if (lower === 'base metal') {
        suggestedType = 'static';
        suggestedValue = 'Gold';
      } else if (lower === 'department') {
        suggestedType = 'static';
        suggestedValue = 'Women';
      } else if (lower === 'country of origin') {
        suggestedType = 'static';
        suggestedValue = 'United States';
      } else if (lower === 'type') {
        suggestedType = 'static';
        suggestedValue = 'Engagement Ring';
      }

      return {
        name,
        isRequired,
        usage,
        dataType,
        mode,
        values: values.slice(0, 30),
        group,
        suggestedType,
        suggestedValue,
      };
    });

    const requiredAspects = formattedAspects.filter((a: any) => a.isRequired);
    const recommendedAspects = formattedAspects.filter(
      (a: any) => !a.isRequired && a.usage === 'RECOMMENDED'
    );
    const optionalAspects = formattedAspects.filter(
      (a: any) => !a.isRequired && a.usage !== 'RECOMMENDED'
    );

    const payload = {
      categoryId,
      treeId,
      totalCount: formattedAspects.length,
      requiredCount: requiredAspects.length,
      recommendedCount: recommendedAspects.length,
      requiredAspects,
      recommendedAspects,
      optionalAspects,
      allAspects: formattedAspects,
    };

    aspectsCache.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json({
      success: true,
      ...payload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
