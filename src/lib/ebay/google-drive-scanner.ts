import { deduplicateImageUrls, isVideoMedia } from './template-engine';

export interface DriveScannedFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  size?: number;
}

export interface DriveSkuGroup {
  sku: string;
  folderName: string;
  images: string[];
  videoUrl?: string;
  fileCount: number;
}

/**
 * Extracts Google Drive Folder ID or File ID from various URL formats
 */
export function extractGoogleDriveId(url: string): { id: string | null; isFolder: boolean } {
  if (!url || typeof url !== 'string') return { id: null, isFolder: false };
  const trimmed = url.trim();

  // Folder URLs:
  // https://drive.google.com/drive/folders/1abc123...
  // https://drive.google.com/drive/u/0/folders/1abc123...
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return { id: folderMatch[1], isFolder: true };

  // ID param: ?id=1abc123...
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return { id: idParamMatch[1], isFolder: trimmed.includes('folder') };

  // File URLs:
  // https://drive.google.com/file/d/1abc123...
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return { id: fileMatch[1], isFolder: false };

  // Direct ID string if user simply pasted the ID
  if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed)) {
    return { id: trimmed, isFolder: true };
  }

  return { id: null, isFolder: false };
}

/**
 * Normalizes any Google Drive link to a direct usable streaming/display URL
 */
export function normalizeGoogleDriveUrl(url: string, isVideo = false): string {
  if (!url) return '';
  const { id } = extractGoogleDriveId(url);
  if (id) {
    if (isVideo) {
      // Direct stream/download for video playback & eBay media API
      return `https://drive.google.com/uc?export=download&id=${id}`;
    }
    // High-speed CDN direct image format for eBay & browsers
    return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return url;
}

/**
 * Natural filename sorting helper (e.g. 1.jpg, 2.jpg, 10.jpg)
 */
function naturalSortFiles<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Scan a Google Drive folder using the Google Drive v3 REST API
 */
export async function scanGoogleDriveViaApi(
  folderId: string,
  apiKey: string
): Promise<{ success: boolean; groups: DriveSkuGroup[]; totalFiles: number; error?: string }> {
  try {
    const rootUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType,size)&pageSize=1000`;
    const res = await fetch(rootUrl);

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `Google Drive API error (${res.status})`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error?.message || errorMsg;
      } catch {
        // ignore
      }
      return { success: false, groups: [], totalFiles: 0, error: errorMsg };
    }

    const data = await res.json();
    const rootItems: Array<{ id: string; name: string; mimeType: string; size?: string }> = data.files || [];

    const subfolders = rootItems.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
    const directFiles = rootItems.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');

    const skuMap: Record<string, { folderName: string; files: DriveScannedFile[] }> = {};
    let totalFiles = 0;

    // 1. Process Subfolders (Each subfolder name = SKU)
    for (const sub of subfolders) {
      const sku = sub.name.trim();
      if (!sku) continue;
      const skuKey = sku.toLowerCase();

      // Fetch files inside subfolder
      const subUrl = `https://www.googleapis.com/drive/v3/files?q='${sub.id}'+in+parents+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType,size)&pageSize=1000`;
      try {
        const subRes = await fetch(subUrl);
        if (subRes.ok) {
          const subData = await subRes.json();
          const items: Array<{ id: string; name: string; mimeType: string; size?: string }> = subData.files || [];
          for (const f of items) {
            const isVid = f.mimeType.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(f.name);
            const isImg = f.mimeType.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif)$/i.test(f.name);
            if (!isVid && !isImg) continue;

            if (!skuMap[skuKey]) {
              skuMap[skuKey] = { folderName: sku, files: [] };
            }

            skuMap[skuKey].files.push({
              id: f.id,
              name: f.name,
              url: normalizeGoogleDriveUrl(f.id, isVid),
              type: isVid ? 'video' : 'image',
              size: f.size ? parseInt(f.size) : undefined,
            });
            totalFiles++;
          }
        }
      } catch (subErr) {
        console.warn(`Error scanning subfolder ${sku}:`, subErr);
      }
    }

    // 2. Process Direct Files in Root Folder (Files named with SKU prefix, e.g. "SLR02845_1.jpg")
    for (const f of directFiles) {
      const isVid = f.mimeType.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(f.name);
      const isImg = f.mimeType.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif)$/i.test(f.name);
      if (!isVid && !isImg) continue;

      const match = f.name.match(/^([A-Za-z0-9_-]+?)[\s_-]/);
      const extractedSku = match ? match[1].trim() : f.name.split('.')[0].trim();
      if (!extractedSku) continue;

      const skuKey = extractedSku.toLowerCase();
      if (!skuMap[skuKey]) {
        skuMap[skuKey] = { folderName: extractedSku, files: [] };
      }

      skuMap[skuKey].files.push({
        id: f.id,
        name: f.name,
        url: normalizeGoogleDriveUrl(f.id, isVid),
        type: isVid ? 'video' : 'image',
        size: f.size ? parseInt(f.size) : undefined,
      });
      totalFiles++;
    }

    // Build finalized DriveSkuGroups
    const groups: DriveSkuGroup[] = Object.keys(skuMap).map((key) => {
      const groupData = skuMap[key];
      const sortedFiles = naturalSortFiles(groupData.files);
      const imageFiles = sortedFiles.filter((f) => f.type === 'image');
      const videoFiles = sortedFiles.filter((f) => f.type === 'video');

      return {
        sku: groupData.folderName,
        folderName: groupData.folderName,
        images: deduplicateImageUrls(imageFiles.map((f) => f.url)),
        videoUrl: videoFiles[0]?.url,
        fileCount: sortedFiles.length,
      };
    });

    return {
      success: true,
      groups,
      totalFiles,
    };
  } catch (err: any) {
    return { success: false, groups: [], totalFiles: 0, error: err.message };
  }
}

/**
 * Parses raw text input containing Google Drive file links mapped to SKUs
 * Example formats:
 * SKU1: https://drive.google.com/file/d/123/view, https://drive.google.com/file/d/456/view
 * OR
 * https://drive.google.com/file/d/123/view (with SKU in filename or metadata)
 */
export function parseRawDriveLinksList(rawText: string): DriveSkuGroup[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split('\n');
  const skuMap: Record<string, { folderName: string; images: string[]; videoUrl?: string }> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check if line format is "SKU: URL1, URL2"
    if (trimmed.includes(':') && (trimmed.includes('drive.google') || trimmed.includes('http'))) {
      const colonIdx = trimmed.indexOf(':');
      const sku = trimmed.slice(0, colonIdx).trim();
      const urlsStr = trimmed.slice(colonIdx + 1).trim();
      const urls = urlsStr.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);

      if (sku && urls.length > 0) {
        const skuKey = sku.toLowerCase();
        if (!skuMap[skuKey]) {
          skuMap[skuKey] = { folderName: sku, images: [] };
        }

        for (const rawUrl of urls) {
          const isExplicitVideo = /(?:^video:|^vid:|\(video\)|\[video\]|video=|_video|video_)/i.test(rawUrl);
          const cleanUrl = rawUrl.replace(/^(?:video:|vid:|video=)/i, '').replace(/\((?:video|vid)\)/i, '').trim();
          const isVid = isExplicitVideo || isVideoMedia(cleanUrl) || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(cleanUrl);
          const normalized = normalizeGoogleDriveUrl(cleanUrl, isVid);
          if (isVid) {
            if (!skuMap[skuKey].videoUrl) skuMap[skuKey].videoUrl = normalized;
          } else {
            skuMap[skuKey].images.push(normalized);
          }
        }
      }
    } else {
      // Just a URL line, see if we can find an ID
      const isExplicitVideo = /(?:^video:|^vid:|\(video\)|\[video\]|video=|_video|video_)/i.test(trimmed);
      const cleanUrl = trimmed.replace(/^(?:video:|vid:|video=)/i, '').replace(/\((?:video|vid)\)/i, '').trim();
      const { id } = extractGoogleDriveId(cleanUrl);
      if (id) {
        const isVid = isExplicitVideo || isVideoMedia(cleanUrl) || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(cleanUrl);
        const normalized = normalizeGoogleDriveUrl(cleanUrl, isVid);
        const fallbackSku = `ITEM-${id.slice(0, 6).toUpperCase()}`;
        const skuKey = fallbackSku.toLowerCase();
        if (!skuMap[skuKey]) {
          skuMap[skuKey] = { folderName: fallbackSku, images: [] };
        }
        if (isVid) {
          if (!skuMap[skuKey].videoUrl) skuMap[skuKey].videoUrl = normalized;
        } else {
          skuMap[skuKey].images.push(normalized);
        }
      }
    }
  }

  return Object.keys(skuMap).map((key) => {
    const g = skuMap[key];
    const cleanImgs = deduplicateImageUrls(g.images);
    return {
      sku: g.folderName,
      folderName: g.folderName,
      images: cleanImgs,
      videoUrl: g.videoUrl,
      fileCount: cleanImgs.length + (g.videoUrl ? 1 : 0),
    };
  });
}
