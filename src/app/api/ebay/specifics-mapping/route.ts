import { NextResponse } from 'next/server';
import {
  getSpecificsMappings,
  saveSpecificsMappings,
  getCategoryProfiles,
  saveCategoryProfiles,
  ensureStoreAsync,
  getStore,
  saveStoreAsync,
} from '@/lib/ebay/server-store';
import {
  DEFAULT_SPECIFICS_MAPPINGS,
  DEFAULT_CATEGORY_PROFILES,
  type SpecificMappingRule,
  type MasterCategoryProfile,
} from '@/lib/ebay/specifics-rules';

export async function GET(request: Request) {
  try {
    await ensureStoreAsync();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || undefined;
    const rules = getSpecificsMappings(accountId);
    const profiles = getCategoryProfiles(accountId);
    return NextResponse.json({
      success: true,
      rules,
      profiles,
      defaultRules: DEFAULT_SPECIFICS_MAPPINGS,
      defaultProfiles: DEFAULT_CATEGORY_PROFILES,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    const accountId = body.accountId || undefined;

    let savedProfiles: MasterCategoryProfile[] | undefined = undefined;
    let savedRules: SpecificMappingRule[] | undefined = undefined;

    if (body.profiles && Array.isArray(body.profiles)) {
      savedProfiles = saveCategoryProfiles(body.profiles, accountId);
    }

    if (body.rules && Array.isArray(body.rules)) {
      savedRules = saveSpecificsMappings(body.rules, accountId);
    }

    await saveStoreAsync(getStore());

    return NextResponse.json({
      success: true,
      profiles: savedProfiles || getCategoryProfiles(accountId),
      rules: savedRules || getSpecificsMappings(accountId),
      message: 'Master Specifics & Category mappings saved successfully!',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
