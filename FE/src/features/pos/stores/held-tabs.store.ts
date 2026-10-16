'use client'

import { create } from 'zustand'
import { posRules } from '@/config/pos-rules'
import { readJson, storageKey, writeJson } from '@/lib/storage'
import type { ApprovalReasonCode, DiscountInput } from '@/types/retail-pos'

/**
 * Hóa đơn chờ (BR-11, FR-12, 07 §4.3): tối đa 5 tab, lưu `localStorage` theo tài khoản
 * `retail-pos-ban-le:held:{userId}`; tải lại trang giữ nguyên (TC-18). BE không biết hóa đơn chờ
 * (quyết định 9), nên chốt ca kiểm BR-11 ở FE bằng `readHeldTabs(userId)`.
 * Dòng chỉ lưu mã hàng, đơn vị, số lượng, giảm dòng; giá, tên đọc từ danh mục lúc hiển thị.
 */

export type CartLine = {
  key: string
  productId: string
  unitId: string
  quantity: number
  discount?: DiscountInput
}

export type HeldApproval = { token: string; approvedByName: string; reasonCodes: ApprovalReasonCode[] }

export type HeldTab = {
  id: string
  name: string
  lines: CartLine[]
  orderDiscount?: DiscountInput
  approval?: HeldApproval
  customer?: { id: string; phone: string; name: string }
  updatedAt: string
}

export type HeldState = { activeId: string; tabs: HeldTab[] }

const keyOf = (userId: string) => storageKey(`held:${userId}`)
const rid = () => Math.random().toString(36).slice(2, 10)

function newTab(existing: HeldTab[]): HeldTab {
  const used = new Set(existing.map((t) => t.name))
  let n = 1
  while (used.has(`Hóa đơn ${n}`)) n++
  return { id: rid(), name: `Hóa đơn ${n}`, lines: [], updatedAt: new Date().toISOString() }
}

function freshState(): HeldState {
  const tab = newTab([])
  return { activeId: tab.id, tabs: [tab] }
}

/** Đọc hóa đơn chờ đã lưu của tài khoản (chốt ca kiểm TC-10) */
export function readHeldTabs(userId: string): HeldState {
  const stored = readJson<HeldState>('local', keyOf(userId))
  if (!stored?.tabs?.length) return freshState()
  const activeId = stored.tabs.some((t) => t.id === stored.activeId) ? stored.activeId : stored.tabs[0].id
  return { activeId, tabs: stored.tabs }
}

/** Xóa mọi tab chờ trống sau khi chốt ca (07 §4.5) */
export function clearEmptyHeldTabs(userId: string) {
  const state = readHeldTabs(userId)
  const tabs = state.tabs.filter((t) => t.lines.length > 0)
  writeJson('local', keyOf(userId), tabs.length ? { activeId: tabs[0].id, tabs } : freshState())
  useHeldTabs.getState().reload()
}

type HeldStore = HeldState & {
  userId: string | null
  /** Gắn store với tài khoản đang đăng nhập (đọc localStorage) */
  init: (userId: string) => void
  reload: () => void
  /** F6: tab mới; false khi đã đủ 5 */
  addTab: () => boolean
  selectTab: (id: string) => void
  /** F7: tab kế tiếp */
  nextTab: () => void
  /** Xóa tab; hết tab thì tạo "Hóa đơn 1" trống */
  removeTab: (id: string) => void
  /** Sửa tab đang mở */
  updateActive: (fn: (tab: HeldTab) => HeldTab) => void
}

function persist(userId: string | null, state: HeldState) {
  if (userId) writeJson('local', keyOf(userId), { activeId: state.activeId, tabs: state.tabs })
}

export const useHeldTabs = create<HeldStore>()((set, get) => {
  const commit = (next: HeldState) => {
    set(next)
    persist(get().userId, next)
  }
  return {
    ...freshState(),
    userId: null,
    init: (userId) => {
      if (get().userId === userId) return
      set({ userId, ...readHeldTabs(userId) })
    },
    reload: () => {
      const { userId } = get()
      if (userId) set(readHeldTabs(userId))
    },
    addTab: () => {
      const { tabs } = get()
      if (tabs.length >= posRules.maxHeldTabs) return false
      const tab = newTab(tabs)
      commit({ activeId: tab.id, tabs: [...tabs, tab] })
      return true
    },
    selectTab: (id) => {
      const { tabs } = get()
      if (tabs.some((t) => t.id === id)) commit({ activeId: id, tabs })
    },
    nextTab: () => {
      const { tabs, activeId } = get()
      const i = tabs.findIndex((t) => t.id === activeId)
      commit({ activeId: tabs[(i + 1) % tabs.length].id, tabs })
    },
    removeTab: (id) => {
      const { tabs, activeId } = get()
      const rest = tabs.filter((t) => t.id !== id)
      if (!rest.length) {
        commit(freshState())
        return
      }
      const i = tabs.findIndex((t) => t.id === id)
      const nextActive = activeId === id ? rest[Math.min(i, rest.length - 1)].id : activeId
      commit({ activeId: nextActive, tabs: rest })
    },
    updateActive: (fn) => {
      const { tabs, activeId } = get()
      commit({
        activeId,
        tabs: tabs.map((t) => (t.id === activeId ? { ...fn(t), updatedAt: new Date().toISOString() } : t)),
      })
    },
  }
})

/** Tab đang mở */
export const useActiveTab = () => useHeldTabs((s) => s.tabs.find((t) => t.id === s.activeId) ?? s.tabs[0])

/** Khóa dòng mới */
export const newLineKey = rid
