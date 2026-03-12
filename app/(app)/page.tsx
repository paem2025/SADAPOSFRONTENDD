"use client"

import useSWR from "swr"
import api from "@/lib/api"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { PatrimonioCategorias } from "@/components/dashboard/patrimonio-categorias"
import { StockAlertas } from "@/components/dashboard/stock-alertas"
import { VentasRecientes } from "@/components/dashboard/ventas-recientes"

type ProductoBackend = {
  id: number
  nombre: string
  codigoBarras: string | null
  precioCosto: number | string
  precioVenta: number | string
  stock: number
  stockMinimo: number
  categoria: string | null
}

type ProductoAlertaBackend = {
  id: number
  nombre: string
  categoria: string | null
  stock: number
  stockMinimo: number
  fechaVencimiento: string | null
  diasParaVencer: number | null
}

type ProductoAlertasResponse = {
  diasVentana: number
  cantidadStockBajo: number
  cantidadVencimientosProximos: number
  cantidadVencidos: number
  requiereAccion: boolean
  stockBajo: ProductoAlertaBackend[]
  vencimientosProximos: ProductoAlertaBackend[]
  vencidos: ProductoAlertaBackend[]
}

type VentaItemBackend = {
  id: number
  productoId: number
  nombre: string
  cantidad: number
  precioUnitario: number | string
  precioCosto: number | string
  subtotal: number | string
  gananciaItem: number | string
}

type VentaBackend = {
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
  items: VentaItemBackend[]
}

type PageResponse<T> = {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type VentasResumenResponse = {
  cantidadVentas: number
  totalVendido: number | string
  totalGanancia: number | string
  ticketPromedio: number | string
}

type CajaResumenResponse = {
  cantidadCajas: number
  cajasAbiertas: number
  cajasCerradas: number
  totalMontoInicial: number | string
  totalVendido: number | string
  totalGanancia: number | string
  totalMontoCierre: number | string
  totalDiferencia: number | string
}

type ProductoPatrimonioResponse = {
  totalCostoStock: number | string
  cantidadProductosConStock: number
}

type ProductoPatrimonioCategoriaResponse = {
  categoria: string
  totalCostoStock: number | string
  cantidadProductosConStock: number
}

type ProductoPatrimonioCategoriasResponse = {
  categorias: ProductoPatrimonioCategoriaResponse[]
  totalCostoStockFiltrado: number | string
  cantidadProductosConStockFiltrado: number
}

const fetcher = (url: string) => api.get(url).then((r) => r.data)

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export default function DashboardPage() {
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: ventasResumen } = useSWR<VentasResumenResponse>(
    `/api/ventas/resumen?fechaDesde=${hoy}&fechaHasta=${hoy}`,
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: cajasResumen } = useSWR<CajaResumenResponse>(
    `/api/cajas/resumen?fechaDesde=${hoy}&fechaHasta=${hoy}`,
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: alertas } = useSWR<ProductoAlertasResponse>(
    "/api/productos/alertas?dias=30",
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: patrimonioStockData } = useSWR<ProductoPatrimonioResponse>(
    "/api/productos/patrimonio",
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: patrimonioCategoriasData } = useSWR<ProductoPatrimonioCategoriasResponse>(
    "/api/productos/patrimonio/categorias",
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: productosPage } = useSWR<PageResponse<ProductoBackend>>(
    "/api/productos/paginado?page=0&size=1&sortBy=nombre&sortDir=asc",
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: ventasPage } = useSWR<PageResponse<VentaBackend>>(
    "/api/ventas/paginado?page=0&size=10&sortBy=fecha&sortDir=desc",
    fetcher,
    { refreshInterval: 5000 }
  )

  const totalProductos = productosPage?.totalElements ?? 0
  const ventasHoy = Number(ventasResumen?.cantidadVentas ?? 0)

  const ingresoHoyVentas = toNumber(ventasResumen?.totalVendido)
  const gananciaHoyVentas = toNumber(ventasResumen?.totalGanancia)

  const ingresoHoyCajas = toNumber(cajasResumen?.totalVendido)
  const gananciaHoyCajas = toNumber(cajasResumen?.totalGanancia)

  const ingresoHoy = ingresoHoyVentas > 0 ? ingresoHoyVentas : ingresoHoyCajas
  const gananciaHoy = gananciaHoyVentas > 0 ? gananciaHoyVentas : gananciaHoyCajas
  const patrimonioStock = toNumber(patrimonioStockData?.totalCostoStock)

  const alertasStock = alertas?.cantidadStockBajo ?? 0
  const alertasVencimiento = (alertas?.cantidadVencidos ?? 0) + (alertas?.cantidadVencimientosProximos ?? 0)

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Administracion</h1>
        <p className="text-sm text-muted-foreground">Resumen general de tu negocio</p>
      </div>

      <StatsCards
        totalProductos={totalProductos}
        patrimonioStock={patrimonioStock}
        ventasHoy={ventasHoy}
        ingresoHoy={ingresoHoy}
        gananciaHoy={gananciaHoy}
        alertasStock={alertasStock}
        alertasVencimiento={alertasVencimiento}
      />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <PatrimonioCategorias
          categorias={patrimonioCategoriasData?.categorias ?? []}
          totalCostoStockFiltrado={patrimonioCategoriasData?.totalCostoStockFiltrado ?? 0}
          cantidadProductosConStockFiltrado={patrimonioCategoriasData?.cantidadProductosConStockFiltrado ?? 0}
        />
        <StockAlertas
          diasVentana={alertas?.diasVentana ?? 30}
          stockBajo={alertas?.stockBajo ?? []}
          vencimientosProximos={alertas?.vencimientosProximos ?? []}
          vencidos={alertas?.vencidos ?? []}
        />
        <div className="lg:col-span-2">
          <VentasRecientes ventas={ventasPage?.items ?? []} />
        </div>
      </div>
    </div>
  )
}
