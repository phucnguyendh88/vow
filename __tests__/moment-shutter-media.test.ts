import {
  isMediaRecorderSupported,
  getSupportedVideoMimeType,
  getVideoExtension,
  RECORDING_HOLD_THRESHOLD_MS,
  MAX_VIDEO_RECORDING_MS,
  MIN_VIDEO_RECORDING_MS,
  MIN_TOTAL_HOLD_DURATION_MS,
  CANCEL_DRAG_DISTANCE_PX,
} from '@/lib/media/momentMedia'

describe('momentMedia helper tests', () => {
  const originalMediaRecorder = (global as any).MediaRecorder

  afterEach(() => {
    ;(global as any).MediaRecorder = originalMediaRecorder
  })

  test('constants have expected boundary values', () => {
    expect(RECORDING_HOLD_THRESHOLD_MS).toBe(300)
    expect(MAX_VIDEO_RECORDING_MS).toBe(2000)
    expect(MIN_VIDEO_RECORDING_MS).toBe(200)
    expect(MIN_TOTAL_HOLD_DURATION_MS).toBe(500)
    expect(CANCEL_DRAG_DISTANCE_PX).toBe(50)
  })

  test('isMediaRecorderSupported returns true when window.MediaRecorder exists', () => {
    ;(global as any).MediaRecorder = class {}
    expect(isMediaRecorderSupported()).toBe(true)
  })

  test('isMediaRecorderSupported returns false when MediaRecorder is undefined', () => {
    ;(global as any).MediaRecorder = undefined
    expect(isMediaRecorderSupported()).toBe(false)
  })

  test('getSupportedVideoMimeType returns undefined when MediaRecorder is not supported', () => {
    ;(global as any).MediaRecorder = undefined
    expect(getSupportedVideoMimeType()).toBeUndefined()
  })

  test('getSupportedVideoMimeType picks mp4 AVC1 for iOS Safari if supported', () => {
    ;(global as any).MediaRecorder = class {
      static isTypeSupported(mime: string) {
        return mime.includes('mp4')
      }
    }
    expect(getSupportedVideoMimeType()).toBe('video/mp4;codecs=avc1')
  })

  test('getSupportedVideoMimeType falls back to basic mp4 if avc1 is unsupported', () => {
    ;(global as any).MediaRecorder = class {
      static isTypeSupported(mime: string) {
        return mime === 'video/mp4'
      }
    }
    expect(getSupportedVideoMimeType()).toBe('video/mp4')
  })

  test('getSupportedVideoMimeType picks WebM VP9 for Android Chrome when mp4 is not supported', () => {
    ;(global as any).MediaRecorder = class {
      static isTypeSupported(mime: string) {
        return mime.includes('webm')
      }
    }
    expect(getSupportedVideoMimeType()).toBe('video/webm;codecs=vp9,opus')
  })

  test('getSupportedVideoMimeType handles isTypeSupported throwing exception gracefully', () => {
    let callCount = 0
    ;(global as any).MediaRecorder = class {
      static isTypeSupported(mime: string) {
        callCount++
        if (mime.includes('mp4')) {
          throw new Error('Not implemented')
        }
        return mime === 'video/webm'
      }
    }
    expect(getSupportedVideoMimeType()).toBe('video/webm')
    expect(callCount).toBeGreaterThan(1)
  })

  test('getSupportedVideoMimeType returns undefined when no candidate mime types are supported', () => {
    ;(global as any).MediaRecorder = class {
      static isTypeSupported() {
        return false
      }
    }
    expect(getSupportedVideoMimeType()).toBeUndefined()
  })

  test('getVideoExtension detects mp4 or webm correctly for strings and Blobs', () => {
    expect(getVideoExtension('video/mp4')).toBe('mp4')
    expect(getVideoExtension('video/mp4;codecs=avc1')).toBe('mp4')
    expect(getVideoExtension('video/MP4; codecs=hvc1')).toBe('mp4')
    expect(getVideoExtension('video/webm')).toBe('webm')
    expect(getVideoExtension('video/webm;codecs=vp8')).toBe('webm')
    expect(getVideoExtension('video/quicktime')).toBe('webm') // fallback to webm

    const mp4Blob = new Blob([], { type: 'video/mp4' })
    const webmBlob = new Blob([], { type: 'video/webm' })
    const untypedBlob = new Blob([], { type: '' })
    expect(getVideoExtension(mp4Blob)).toBe('mp4')
    expect(getVideoExtension(webmBlob)).toBe('webm')
    expect(getVideoExtension(untypedBlob)).toBe('webm')
  })
})
