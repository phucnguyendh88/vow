/**
 * Moment Media Recording & Capabilities Helper
 * Cross-browser detection for Safari iOS, Chrome Android, and Desktop.
 */

export const RECORDING_HOLD_THRESHOLD_MS = 300
export const MAX_VIDEO_RECORDING_MS = 2000
export const MIN_VIDEO_RECORDING_MS = 200
export const MIN_TOTAL_HOLD_DURATION_MS = 500
export const CANCEL_DRAG_DISTANCE_PX = 50

const CANDIDATE_MIME_TYPES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

/**
 * Checks whether MediaRecorder API is supported in current environment.
 */
export function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
}

/**
 * Dynamically queries browser-supported video MIME types instead of hardcoding OS.
 * Priority: MP4 (best iOS Safari & modern Android support) -> WebM (broad Android/Chrome support)
 */
export function getSupportedVideoMimeType(): string | undefined {
  if (!isMediaRecorderSupported()) return undefined
  for (const mime of CANDIDATE_MIME_TYPES) {
    try {
      if (window.MediaRecorder.isTypeSupported(mime)) {
        return mime
      }
    } catch {
      // isTypeSupported threw or unsupported
    }
  }
  return undefined
}

/**
 * Determines file extension based on actual Blob MIME type.
 * e.g. 'video/mp4' -> 'mp4', 'video/webm' -> 'webm'
 */
export function getVideoExtension(blobOrType: Blob | string): 'mp4' | 'webm' {
  const mimeType = typeof blobOrType === 'string' ? blobOrType : blobOrType.type
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm'
}
