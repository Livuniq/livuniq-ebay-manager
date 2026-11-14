import { NextResponse } from 'next/server';
import {
  getSpecificsMappings,
  saveSpecificsMappings,
  getCategoryProfiles,
  saveCategoryProfiles,
} from '@/lib/ebay/server-store';
import {
  DEFAULT_SPECIFICS_MAPPINGS,
  DEFAULT_CATEGORY_PROFILES,
  type SpecificMappingRule,
  type MasterCategoryProfile,
} from '@/lib/ebay/specifics-rules';

export async function GET() {
  try {
    const rules = getSpecificsMappings();
    const profiles = getCategoryProfiles();
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
    const body = await request.json();

    let savedProfiles: MasterCategoryProfile[] | undefined = undefined;
    let savedRules: SpecificMappingRule[] | undefined = undefined;

    if (body.profiles && Array.isArray(body.profiles)) {
      savedProfiles = saveCategoryProfiles(body.profiles);
    }

    if (body.rules && Array.isArray(body.rules)) {
      savedRules = saveSpecificsMappings(body.rules);
    }

    return NextResponse.json({
      success: true,
      profiles: savedProfiles || getCategoryProfiles(),
      rules: savedRules || getSpecificsMappings(),
      message: 'Master Specifics & Category mappings saved successfully!',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
