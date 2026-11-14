import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export async function POST(request: Request) {
  try {
    const { folderPath } = await request.json();

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json({ success: false, error: 'Folder path is required' }, { status: 400 });
    }

    const cleanPath = folderPath.trim().replace(/^["']|["']$/g, '');

    if (!fs.existsSync(cleanPath)) {
      return NextResponse.json(
        { success: false, error: `Folder does not exist on computer: ${cleanPath}` },
        { status: 404 }
      );
    }

    const stat = fs.statSync(cleanPath);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { success: false, error: `Path is not a directory: ${cleanPath}` },
        { status: 400 }
      );
    }

    // Ensure staging directory exists
    const stagingDir = path.join(process.cwd(), 'public', 'uploads', 'bulk_staged');
    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    const scannedImages: Array<{
      filename: string;
      folderName: string;
      relativePath: string;
      size: number;
      url: string;
    }> = [];

    // Recursive directory scanner to find images inside SKU subfolders
    function scanDirRecursive(dirPath: string, parentFolderName = '') {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch (readErr) {
        console.error(`Cannot read dir ${dirPath}:`, readErr);
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          // Recursive scan into subfolder (e.g. subfolder named after SKU)
          scanDirRecursive(fullPath, entry.name);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_IMAGE_EXTS.has(ext)) {
            // If parentFolderName is empty, fallback to the current directory basename
            const currentFolder = parentFolderName || (dirPath !== cleanPath ? path.basename(dirPath) : '');
            const relativePath = path.relative(cleanPath, fullPath).replace(/\\/g, '/');
            const safePrefix = currentFolder ? `${currentFolder.replace(/[^a-zA-Z0-9._-]/g, '_')}_` : '';
            const safeName = `${safePrefix}${entry.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const destFilePath = path.join(stagingDir, safeName);

            try {
              const srcStat = fs.statSync(fullPath);
              if (!fs.existsSync(destFilePath) || fs.statSync(destFilePath).size !== srcStat.size) {
                fs.copyFileSync(fullPath, destFilePath);
              }

              scannedImages.push({
                filename: entry.name,
                folderName: currentFolder,
                relativePath,
                size: srcStat.size,
                url: `/uploads/bulk_staged/${encodeURIComponent(safeName)}`,
              });
            } catch (copyErr) {
              console.error(`Error copying image ${entry.name}:`, copyErr);
            }
          }
        }
      }
    }

    scanDirRecursive(cleanPath);

    return NextResponse.json({
      success: true,
      folder: cleanPath,
      totalImages: scannedImages.length,
      images: scannedImages,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
