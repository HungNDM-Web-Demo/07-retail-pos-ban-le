import type { SheetData } from 'write-excel-file/universal'

/**
 * Xuất báo cáo đang xem ra file Excel tại máy (UC-15) bằng gói `write-excel-file`.
 * Nạp gói lười khi bấm nút để không tăng kích thước trang. Một file có thể nhiều trang tính.
 */

export type ExcelColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
  /** Độ rộng cột (ký tự) */
  width?: number
  /** Định dạng số Excel, vd '#,##0' (mặc định) hoặc '0.0' */
  format?: string
}

export type ExcelSheet = {
  /** Tên trang tính (tối đa 31 ký tự) */
  name: string
  data: SheetData
  widths: number[]
}

/** Dựng một trang tính: dòng tiêu đề, dòng trống, tiêu đề cột, dữ liệu */
export function excelSheet<T>(
  name: string,
  title: string,
  columns: ExcelColumn<T>[],
  rows: T[]
): ExcelSheet {
  const header = columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const }))
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row)
      if (v === null || v === undefined) return null
      return typeof v === 'number'
        ? { value: v, type: Number, format: c.format ?? '#,##0' }
        : { value: String(v), type: String }
    })
  )
  return {
    name: name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31),
    data: [[{ value: title, fontWeight: 'bold' as const }], [], header, ...body] as SheetData,
    widths: columns.map((c) => c.width ?? 16),
  }
}

/** Tên file chuẩn: bao-cao-{loai}-{from}-{to}.xlsx */
export const reportFileName = (kind: string, from: string, to: string) =>
  `bao-cao-${kind}-${from}-${to}.xlsx`

export async function exportExcel(fileName: string, sheets: ExcelSheet[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/universal')
  const blob = await writeXlsxFile(
    sheets.map((s) => ({
      data: s.data,
      sheet: s.name,
      columns: s.widths.map((width) => ({ width })),
    }))
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
