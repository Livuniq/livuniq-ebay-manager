import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAccounts, getActiveAccountId, getMasterConfig } from '@/lib/ebay/server-store';
import { processVideoForEbay } from '@/lib/video-processor';
import { ensureFreshAccessToken } from '@/lib/ebay/live-sync';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const relativePaths = formData.getAll('relativePaths') as string[];
    const reqAccountId = (formData.get('accountId') as string) || getActiveAccountId();

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    const accounts = getAccounts();
    const account = accounts.find((a) => a.id === reqAccountId) || accounts.find((a) => a.accessToken);
    if (account) {
      await ensureFreshAccessToken(account);
    }
    const accessToken = account?.accessToken;

    const isVercel = Boolean(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NOW_REGION
    );

    const publicDir = isVercel ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'public');
    const imagesDir = isVercel ? path.join(publicDir, 'images') : path.join(publicDir, 'uploads', 'images');
    const videosDir = isVercel ? path.join(publicDir, 'videos') : path.join(publicDir, 'uploads', 'videos');

    try {
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
    } catch {
      // non-fatal on serverless
    }

    const masterConfig = getMasterConfig();
    const mediaEndpoint =
      masterConfig.environment === 'sandbox'
        ? 'https://apim.sandbox.ebay.com/commerce/media/v1_beta/image/create_image_from_file'
        : 'https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_file';

    const uploadedFiles: Array<{
      url: string;
      videoId?: string;
      name: string;
      originalName?: string;
      relativePath?: string;
      folderName?: string;
      type: 'image' | 'video';
      size: number;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = relativePaths[i] || file.name;
      const dirParts = relPath.replace(/\\/g, '/').split('/');
      const folderName = dirParts.length > 1 ? dirParts[dirParts.length - 2] : '';
      const buffer = Buffer.from(await file.arrayBuffer());
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
      const targetDir = isVideo ? videosDir : imagesDir;
      const subFolder = isVideo ? 'videos' : 'images';

      // 1. Clean file name & save locally if disk is writable
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${Date.now()}-${cleanName}`;
      const filePath = path.join(targetDir, uniqueName);
      let finalUrl = isVideo
        ? `/uploads/videos/${uniqueName}`
        : `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

      try {
        fs.writeFileSync(filePath, buffer);
        if (!isVercel) {
          finalUrl = `/uploads/${subFolder}/${uniqueName}`;
        }
      } catch (wErr) {
        // Disk write not permitted on serverless readonly
      }

      let activeBuffer = buffer;

      // 1b. If it's a video, automatically downscale and transcode to 1080p MP4 (H.264 / AAC) for eBay compliance!
      if (isVideo) {
        try {
          const optimizedName = `opt-${uniqueName.replace(/\.[^.]+$/, '')}.mp4`;
          const optimizedPath = path.join(videosDir, optimizedName);
          const processResult = await processVideoForEbay(filePath, optimizedPath);
          if (processResult.success && fs.existsSync(optimizedPath)) {
            finalUrl = `/uploads/videos/${optimizedName}`;
            activeBuffer = fs.readFileSync(optimizedPath);
          }
        } catch (procErr) {
          console.warn('Auto video processing non-fatal error:', procErr);
        }
      }

      // 2. If it's an image and we have an eBay Access Token, upload directly to eBay Picture Services (EPS)!
      if (!isVideo && accessToken) {
        try {
          const ebayForm = new FormData();
          ebayForm.append(
            'image',
            new Blob([buffer], { type: file.type || 'image/jpeg' }),
            cleanName
          );

          const epsRes = await fetch(
            mediaEndpoint,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              body: ebayForm,
            }
          );

          if (epsRes.status === 201) {
            const epsData = await epsRes.json();
            const epsUrl = epsData.maxDimensionImageUrl || epsData.imageUrl;
            if (epsUrl) {
              console.log('Successfully uploaded to eBay EPS:', epsUrl);
              finalUrl = epsUrl;
            }
          } else {
            const errTxt = await epsRes.text();
            console.warn('eBay EPS upload status not 201:', epsRes.status, errTxt);
          }
        } catch (epsErr) {
          console.error('eBay EPS upload error:', epsErr);
        }
      }

      let videoId: string | undefined = undefined;

      // 2b. If it's a video and we have an eBay Access Token, upload directly to eBay Media API!
      if (isVideo && accessToken) {
        try {
          const videoBaseUrl =
            masterConfig.environment === 'sandbox'
              ? 'https://api.sandbox.ebay.com/commerce/media/v1/video'
              : 'https://api.ebay.com/commerce/media/v1/video';

          console.log('Registering video with eBay Media API:', cleanName, activeBuffer.length, 'bytes');
          const createRes = await fetch(videoBaseUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              title: cleanName.slice(0, 50),
              size: activeBuffer.length,
              classification: ['ITEM'],
              description: 'Product Video',
            }),
          });

          let vidId: string | undefined = undefined;
          const locationHeader = createRes.headers.get('location');
          if (locationHeader) {
            vidId = locationHeader.split('/').pop()?.trim();
          }
          if (!vidId) {
            try {
              const cJson = await createRes.clone().json();
              vidId = cJson.videoId || cJson.id;
            } catch {}
          }

          if (vidId) {
            console.log('Uploading binary video content to eBay Media API for VideoID:', vidId);
            const uploadRes = await fetch(`${videoBaseUrl}/${vidId}/upload`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': activeBuffer.length.toString(),
                'Content-Range': `bytes 0-${activeBuffer.length - 1}/${activeBuffer.length}`,
              },
              body: activeBuffer,
            });

            if (uploadRes.status >= 200 && uploadRes.status < 300) {
              console.log('Successfully uploaded video binary to eBay! VideoID:', vidId, '(Status', uploadRes.status, ')');
              videoId = vidId;
            } else {
              console.warn('eBay video upload status non-2xx:', uploadRes.status, await uploadRes.text());
            }
          } else {
            console.warn('eBay createVideo returned no location header or videoId:', createRes.status, await createRes.text());
          }
        } catch (vidErr) {
          console.error('eBay video upload error:', vidErr);
        }
      }

      // 3. Fallback: If still local relative URL, upload to public image host (Catbox) so eBay Trading API can access it!
      if (!isVideo && finalUrl.startsWith('/uploads/')) {
        try {
          const catForm = new FormData();
          catForm.append('reqtype', 'fileupload');
          catForm.append(
            'fileToUpload',
            new Blob([buffer], { type: file.type || 'image/jpeg' }),
            cleanName
          );

          const catRes = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: catForm,
          });

          if (catRes.ok) {
            const catUrl = (await catRes.text()).trim();
            if (catUrl.startsWith('http')) {
              console.log('Uploaded to public image host:', catUrl);
              finalUrl = catUrl;
            }
          }
        } catch (catErr) {
          console.warn('Fallback public host error:', catErr);
        }
      }

      uploadedFiles.push({
        url: finalUrl,
        videoId,
        name: file.name,
        originalName: file.name,
        relativePath: relPath,
        folderName: folderName,
        type: isVideo ? 'video' : 'image',
        size: activeBuffer.length,
      });
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (err) {
    console.error('File upload error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
