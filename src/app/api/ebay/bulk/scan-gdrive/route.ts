import { NextResponse } from 'next/server';
import { getStore, ensureStoreAsync, getActiveAccountId, saveStoreAsync } from '@/lib/ebay/server-store';
import {
  extractGoogleDriveId,
  scanGoogleDriveViaApi,
  parseRawDriveLinksList,
  DriveSkuGroup,
} from '@/lib/ebay/google-drive-scanner';
import { EbayListing } from '@/lib/ebay/types';

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json().catch(() => ({}));
    const driveUrl = (body.driveUrl || '').trim();
    const rawList = (body.rawList || '').trim();
    const targetAccountId = body.accountId || getActiveAccountId();

    // Check if Google API Key was sent or configured in store / env
    const store = getStore();
    const apiKey = (body.apiKey || '').trim() ||
      process.env.GOOGLE_DRIVE_API_KEY ||
      store.masterConfig.googleDriveApiKey ||
      '';

    // Auto-persist valid API key to store masterConfig so user never has to re-enter it
    if ((body.apiKey || '').trim() && store.masterConfig.googleDriveApiKey !== (body.apiKey || '').trim()) {
      store.masterConfig.googleDriveApiKey = (body.apiKey || '').trim();
      await saveStoreAsync(store);
    }

    let detectedGroups: DriveSkuGroup[] = [];
    let scanError = '';

    // 1. If user supplied a Google Drive Folder Link and API Key
    if (driveUrl) {
      const { id: folderId } = extractGoogleDriveId(driveUrl);
      if (!folderId) {
        return NextResponse.json(
          { success: false, error: 'Invalid Google Drive link. Please enter a valid Google Drive folder or file URL.' },
          { status: 400 }
        );
      }

      if (!apiKey) {
        return NextResponse.json({
          success: false,
          needsApiKey: true,
          error: 'Google Drive folder scan ke liye Google API Key zaroori hai (Google Cloud Console se free milti hai). Kripya niche "+ Enter Google Cloud API Key" me apni key dalein, ya Computer Folder option use karein.',
        });
      }

      const scanResult = await scanGoogleDriveViaApi(folderId, apiKey);
      if (!scanResult.success) {
        let userFriendlyError = scanResult.error || 'Google Drive folder scan failed.';
        if (userFriendlyError.includes('404') || userFriendlyError.toLowerCase().includes('not found')) {
          userFriendlyError = `Google Drive folder access nahi ho pa raha (404 Not Found). Kripya Google Drive me folder par Right Click ➔ Share ➔ 'Anyone with the link' (Viewer) select karein.`;
        }
        return NextResponse.json({
          success: false,
          error: userFriendlyError,
        });
      }

      detectedGroups = scanResult.groups;
    } else if (rawList) {
      // 2. If user pasted raw text / list of Drive links mapped to SKUs
      detectedGroups = parseRawDriveLinksList(rawList);
    } else {
      return NextResponse.json(
        { success: false, error: 'Please provide either a Google Drive folder link or a list of SKU-mapped Drive links.' },
        { status: 400 }
      );
    }

    if (detectedGroups.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Koi valid images ya videos nahi mili. Please check karein ki folder public ho aur usme images/videos hon.',
      });
    }

    // Match with current store listings by SKU
    const storeListings = store.listings.filter((l) => !targetAccountId || l.accountId === targetAccountId);

    const matchedGroups = detectedGroups.map((g) => {
      const cleanGKey = g.sku.trim().toLowerCase();
      const alphaNumGKey = cleanGKey.replace(/[^a-z0-9]/g, '');

      const matchedListing = storeListings.find((l) => {
        const lSku = (l.sku || '').trim().toLowerCase();
        const lAlpha = lSku.replace(/[^a-z0-9]/g, '');
        return lSku === cleanGKey || (alphaNumGKey.length >= 3 && lAlpha === alphaNumGKey);
      }) || null;

      return {
        ...g,
        matchedListing,
        selected: Boolean(matchedListing),
      };
    });

    const matchedCount = matchedGroups.filter((g) => g.matchedListing).length;
    const unmatchedCount = matchedGroups.filter((g) => !g.matchedListing).length;

    return NextResponse.json({
      success: true,
      groups: matchedGroups,
      matchedCount,
      unmatchedCount,
      totalGroups: matchedGroups.length,
    });
  } catch (err: any) {
    console.error('scan-gdrive error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while scanning Google Drive' },
      { status: 500 }
    );
  }
}

export async function GET() {
  await ensureStoreAsync();
  const store = getStore();
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY || store.masterConfig.googleDriveApiKey || '';
  return NextResponse.json({
    hasApiKey: Boolean(apiKey),
    configured: Boolean(apiKey),
  });
}
