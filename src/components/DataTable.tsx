import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  searchPlaceholder?: string
  pageSize?: number
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Cerca...',
  pageSize = 8,
}: DataTableProps<TData>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: { columnFilters, globalFilter },
    initialState: { pagination: { pageSize } },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
          <input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full bg-[#1a1a1e] border border-[#27272a] rounded-full py-2 pl-9 pr-4 text-base text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-electric transition-colors"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-zinc-700">
        <table className="w-full text-base text-left">
          <thead className="text-base text-zinc-400 uppercase font-semibold bg-[#1a1a1e]/80 border-b-2 border-zinc-700">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-700/50 hover:bg-[#1a1a1e]/50 transition-colors last:border-0"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-zinc-200 whitespace-nowrap text-base">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-zinc-400">
                  Nessun risultato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-base text-zinc-400">
          Pagina {table.getState().pagination.pageIndex + 1} di{' '}
          {Math.max(1, table.getPageCount())}
          <span className="ml-2 text-zinc-500">({data.length} totali)</span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded-md border border-[#27272a] bg-[#1a1a1e] text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#27272a]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded-md border border-[#27272a] bg-[#1a1a1e] text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#27272a]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
