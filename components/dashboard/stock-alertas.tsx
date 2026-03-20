"use client"

import { AlertTriangle, Clock3, Skull } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

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
  const hasCritical = stockBajo.length > 0 || vencidos.length > 0
  const hasWarningOnly = !hasCritical && vencimientosProximos.length > 0

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/70 bg-gradient-to-br from-card/95 to-card/75",
        hasCritical && "border-destructive/35"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Alertas operativas</CardTitle>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "rounded-full p-1.5",
                hasCritical && "bg-destructive/16 text-destructive",
                hasWarningOnly && "bg-warning/16 text-warning",
                totalAlertas === 0 && "bg-muted/55 text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <Badge
              variant={hasCritical ? "destructive" : "secondary"}
              className={cn(
                "rounded-full px-2.5",
                hasWarningOnly && "border-warning/45 text-warning",
                hasCritical && "alert-critical-blink",
                hasWarningOnly && "alert-warning-pulse"
              )}
            >
              {totalAlertas}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={stockBajo.length > 0 ? "destructive" : "secondary"} className="rounded-full">
            Stock bajo: {stockBajo.length}
          </Badge>
          <Badge variant={vencidos.length > 0 ? "destructive" : "secondary"} className="rounded-full">
            Vencidos: {vencidos.length}
          </Badge>
          <Badge
            variant={vencimientosProximos.length > 0 ? "outline" : "secondary"}
            className={cn("rounded-full", vencimientosProximos.length > 0 && "border-warning/45 text-warning")}
          >
            Por vencer ({diasVentana}d): {vencimientosProximos.length}
          </Badge>
        </div>

        {totalAlertas === 0 && (
          <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Todo en orden. No hay alertas activas.
          </div>
        )}

        {totalAlertas > 0 && (
          <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
            {stockBajo.slice(0, 8).map((item) => (
              <div
                key={`s-${item.id}`}
                className="rounded-xl border border-destructive/35 bg-gradient-to-r from-destructive/12 to-destructive/4 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">{item.categoria || "General"}</p>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold text-destructive">
                      {item.stock} / {item.stockMinimo}
                    </div>
                    <div className="text-muted-foreground">stock/min</div>
                  </div>
                </div>
              </div>
            ))}

            {vencidos.slice(0, 8).map((item) => (
              <div
                key={`v-${item.id}`}
                className="rounded-xl border border-destructive/35 bg-gradient-to-r from-destructive/12 to-destructive/4 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">{item.categoria || "General"}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs text-destructive">
                    <Skull className="h-3.5 w-3.5" />
                    {chipFecha(item)}
                  </div>
                </div>
              </div>
            ))}

            {vencimientosProximos.slice(0, 8).map((item) => (
              <div
                key={`p-${item.id}`}
                className="rounded-xl border border-warning/35 bg-gradient-to-r from-warning/12 to-warning/4 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">{item.categoria || "General"}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs text-warning">
                    <Clock3 className="h-3.5 w-3.5" />
                    {chipFecha(item)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
