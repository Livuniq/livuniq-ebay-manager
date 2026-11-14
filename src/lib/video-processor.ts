import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

function getFfmpegPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'ffmpeg', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    'ffmpeg',
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function processVideoForEbay(
  inputPath: string,
  outputPath: string
): Promise<{ success: boolean; outputPath: string; size: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const ffmpegPath = getFfmpegPath();
      if (!ffmpegPath) {
        console.warn('ffmpeg binary not available, skipping auto-processing');
        const stats = fs.statSync(inputPath);
        return resolve({ success: false, outputPath: inputPath, size: stats.size, error: 'ffmpeg not installed' });
      }

      // eBay Specs:
      // - Max 1080p resolution (scale preserving aspect ratio, even dimensions)
      // - Video codec: libx264 (H.264)
      // - Audio codec: aac
      // - Pixel format: yuv420p
      // - Web FastStart
      const args = [
        '-y',
        '-i', inputPath,
        '-vf', "scale='min(1080,iw)':-2",
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath,
      ];

      console.log('Auto-processing video for eBay with ffmpeg at:', ffmpegPath);
      const proc = spawn(/*turbopackIgnore: true*/ ffmpegPath, args);

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`Video auto-processed successfully! New size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
          resolve({ success: true, outputPath, size: stats.size });
        } else {
          console.warn('ffmpeg exited with code:', code, 'falling back to original');
          const origStats = fs.statSync(inputPath);
          resolve({ success: false, outputPath: inputPath, size: origStats.size, error: `ffmpeg exit code ${code}` });
        }
      });

      proc.on('error', (err) => {
        console.error('ffmpeg process error:', err);
        const origStats = fs.statSync(inputPath);
        resolve({ success: false, outputPath: inputPath, size: origStats.size, error: err.message });
      });
    } catch (err) {
      console.error('Error starting video processor:', err);
      const origStats = fs.statSync(inputPath);
      resolve({ success: false, outputPath: inputPath, size: origStats.size, error: (err as Error).message });
    }
  });
}
