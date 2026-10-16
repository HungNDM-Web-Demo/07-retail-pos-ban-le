'use client'

import { storageKey } from '@/lib/storage'

/**
 * Âm báo màn bán hàng (07 §4.2 mục 4): Web Audio, bíp 880 Hz 80 ms khi thêm dòng, hai tiếng trầm 220 Hz khi lỗi.
 * Bật/tắt lưu `retail-pos-ban-le:pos-sound` (mặc định bật).
 */

export const SOUND_KEY = storageKey('pos-sound')
let context: AudioContext | null = null

export function isSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // bỏ qua
  }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  if (context.state === 'suspended') void context.resume().catch(() => undefined)
  return context
}

function tone(frequency: number, start: number, duration: number) {
  const c = audio()
  if (!c) return
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  const t = c.currentTime + start
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(0.08, t + 0.005)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(amp).connect(c.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** Bíp ngắn khi thêm dòng */
export function beepOk() {
  if (isSoundOn()) tone(880, 0, 0.08)
}

/** Hai tiếng trầm khi lỗi */
export function beepError() {
  if (!isSoundOn()) return
  tone(220, 0, 0.12)
  tone(220, 0.18, 0.12)
}
