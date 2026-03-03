"use client"

import { AlertTriangle, Clock3, Skull } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type ProductoAlerta = {
  id: number
  nombre: string
  categoria: string | null
  stock: number
  stockMinimo: number
  fechaVencimiento: string | null
  diasParaVencer: number | null
}

interface StockAlertasProps {
  diasVentana: number
  stockBajo: ProductoAlerta[]
  vencimientosProximos: ProductoAlerta[]
  vencidos: ProductoAlerta[]
}

function chipFecha(item: ProductoAlerta) {
  if (!item.fechaVencimiento) return "Sin fecha"
  if (item.diasParaVencer == null) return item.fechaVencimiento
  if (item.diasParaVencer < 0) return `Vencio hace ${Math.abs(item.diasParaVencer)}d`
  if (item.diasParaVencer === 0) return "Vence hoy"
  return `Vence en ${item.diasParaVencer}d`
}

export function StockAlertas({ diasVentana, stockBajo, vencimientosProximos, vencidos }: StockAlertasProps) {
  const totalAlertas = stockBajo.length + vencimientosProximos.length + vencidos.length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Alertas operativas</CardTitle>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${totalAlertas > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <Badge variant={totalAlertas > 0 ? "destructive" : "secondary"}>{totalAlertas}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={stockBajo.length > 0 ? "destructive" : "secondary"}>Stock bajo: {stockBajo.length}</Badge>
          <Badge variant={vencidos.length > 0 ? "destructive" : "secondary"}>Vencidos: {vencidos.length}</Badge>
          <Badge variant={vencimientosProximos.length > 0 ? "outline" : "secondary"}>
            Por vencer ({diasVentana}d): {vencimientosProximos.length}
          </Badge>
        </div>

        {totalAlertas === 0 && <p className="text-sm text-muted-foreground">Todo en orden. No hay alertas activas.</p>}

        {totalAlertas > 0 && (
          <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
            {stockBajo.slice(0, 8).map((item) => (
              <div key={`s-${item.id}`} className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">{item.categoria || "General"}</p>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold text-destructive">{item.stock} / {item.stockMinimo}</div>
                  <div className="text-muted-foreground">stock/min</div>
                </div>
              </div>
            ))}

            {vencidos.slice(0, 8).map((item) => (
              <div key={`v-${item.id}`} className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">{item.categoria || "General"}</p>
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-destructive">
                  <Skull className="h-3.5 w-3.5" />
                  {chipFecha(item)}
                </div>
              </div>
            ))}

            {vencimientosProximos.slice(0, 8).map((item) => (
              <div key={`p-${item.id}`} className="flex items-center justify-between rounded-md border border-amber-300/40 bg-amber-100/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">{item.categoria || "General"}</p>
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  {chipFecha(item)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
