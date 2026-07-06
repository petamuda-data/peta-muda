// Parquet helpers built on hyparquet (+ compressors for ZSTD/BROTLI files).
import { parquetMetadataAsync, parquetReadObjects, asyncBufferFromUrl } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { fetchBuffer } from './fetch.mjs'

// Read a whole (small) remote parquet into objects.
export async function readParquetUrl(url, { columns } = {}) {
  const file = await asyncBufferFromUrl({ url })
  const metadata = await parquetMetadataAsync(file)
  return parquetReadObjects({ file, metadata, compressors, columns })
}

// Read a parquet fully into memory first (cached on disk), then stream row
// groups through a filter/map callback to keep the JS heap small.
export async function scanParquetUrl(url, onRow, { columns } = {}) {
  const buf = await fetchBuffer(url)
  const file = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const metadata = await parquetMetadataAsync(file)
  const total = Number(metadata.num_rows)
  const CHUNK = 250_000
  for (let start = 0; start < total; start += CHUNK) {
    const rows = await parquetReadObjects({
      file, metadata, compressors, columns,
      rowStart: start, rowEnd: Math.min(start + CHUNK, total),
    })
    for (const row of rows) onRow(row)
  }
  return total
}

export const asIsoDate = (v) => {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

export const asNum = (v) => (typeof v === 'bigint' ? Number(v) : v == null ? null : Number(v))
