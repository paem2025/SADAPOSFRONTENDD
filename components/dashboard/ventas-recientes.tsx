"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type VentaItem = {
  id: number
  productoId: number
  nombre: string
  cantidad: number
  precioUnitario: number | string
  precioCosto: number | string
  subtotal: number | string
  gananciaItem: number | string
}

type Venta = {
  id: number
  fecha: string
  cajaId: number | null
  subtotal: number | string
  recargo: number | string
  total: number | string
  costoTotal: number | string
  ganancia: number | string
  medioPago: "efectivo" | "debito" | "credito" | "transferencia"
  montoRecibido: number | string | null
  vuelto: number | string | null
  items: VentaItem[]
}

interface VentasRecientesProps {
  ventas: Venta[]
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function formatPrecio(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(toNumber(value))
}

function formatFecha(fechaIso: string) {
  const d = new Date(fechaIso)
  if (Number.isNaN(d.getTime())) return "-"
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d)
}

export function VentasRecientes({ ventas }: VentasRecientesProps) {
  const ultimasVentas = [...ventas]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ultimas Ventas</CardTitle>
      </CardHeader>
      <CardContent>
        {ultimasVentas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavia no hay ventas registradas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {ultimasVentas.map((venta) => (
              <div
                key={venta.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">Venta #{venta.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFecha(venta.fecha)} - {venta.items.length}{" "}
                    {venta.items.length === 1 ? "producto" : "productos"}
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground">{formatPrecio(venta.total)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
