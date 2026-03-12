"use client"

import { BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type PatrimonioCategoria = {
  categoria: string
  totalCostoStock: number | string
  cantidadProductosConStock: number
}

interface PatrimonioCategoriasProps {
  categorias: PatrimonioCategoria[]
  totalCostoStockFiltrado: number | string
  cantidadProductosConStockFiltrado: number
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function formatPrecio(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value)
}

export function PatrimonioCategorias({
  categorias,
  totalCostoStockFiltrado,
  cantidadProductosConStockFiltrado,
}: PatrimonioCategoriasProps) {
  const total = toNumber(totalCostoStockFiltrado)

  const categoriasOrdenadas = [...categorias]
    .map((categoria) => ({
      ...categoria,
      totalCostoStockNumero: toNumber(categoria.totalCostoStock),
    }))
    .sort((a, b) => b.totalCostoStockNumero - a.totalCostoStockNumero)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Patrimonio por categoria</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">{cantidadProductosConStockFiltrado} productos con stock</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {categoriasOrdenadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay productos con stock para mostrar.</p>
        ) : (
          categoriasOrdenadas.map((categoria) => {
            const porcentaje = total > 0 ? (categoria.totalCostoStockNumero / total) * 100 : 0
            const porcentajeClamped = Math.max(0, Math.min(100, porcentaje))
            return (
              <div key={categoria.categoria} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{categoria.categoria}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoria.cantidadProductosConStock}{" "}
                      {categoria.cantidadProductosConStock === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrecio(categoria.totalCostoStockNumero)}</p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-300 ease-out"
                    style={{ width: `${porcentajeClamped.toFixed(2)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}

        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Total categorias principales</p>
          <p className="text-sm font-semibold">{formatPrecio(total)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
