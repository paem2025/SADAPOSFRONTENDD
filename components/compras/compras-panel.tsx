"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Plus, Trash2, Loader2, Receipt, Building2 } from "lucide-react"

import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Proveedor = {
  id: number
  nombre: string
  activo: boolean
}

type Producto = {
  id: number
  nombre: string
  codigoBarras: string | null
  precioCosto: number
  stock: number
}

type PageResponse<T> = {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type CompraItem = {
  id: number
  productoId: number
  loteId: number | null
  nombreProducto: string
  cantidad: number
  costoUnitario: number
  subtotal: number
  fechaVencimiento: string | null
}

type Compra = {
  id: number
  proveedorId: number
  proveedorNombre: string
  usuarioId: number
  usuarioNombre: string
  fecha: string
  numeroComprobante: string | null
  observacion: string | null
  subtotal: number
  total: number
  items: CompraItem[]
}

type ItemDraft = {
  productoId: number
  nombreProducto: string
  cantidad: number
  costoUnitario: number
  fechaVencimiento: string | null
}

const fetcher = (url: string) => api.get(url).then((r) => r.data)

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n || 0)
}

function formatFecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

function getErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return apiErr.response?.data?.message || apiErr.response?.data?.error || apiErr.message || fallback
}

export function ComprasPanel() {
  const { user } = useAuth()
  const esAdmin = user?.rol === "admin"

  const [proveedorId, setProveedorId] = useState<number | null>(null)
  const [numeroComprobante, setNumeroComprobante] = useState("")
  const [observacion, setObservacion] = useState("")
  const [guardando, setGuardando] = useState(false)

  const [productoIdDraft, setProductoIdDraft] = useState<number | null>(null)
  const [cantidadDraft, setCantidadDraft] = useState("1")
  const [costoDraft, setCostoDraft] = useState("")
  const [vencimientoDraft, setVencimientoDraft] = useState("")
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[]>([])

  const [filtroProveedor, setFiltroProveedor] = useState<number | "">("")
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("")
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("")

  const { data: proveedoresActivos = [] } = useSWR<Proveedor[]>("/api/proveedores?soloActivos=true", fetcher)
  const { data: proveedoresTodos = [] } = useSWR<Proveedor[]>("/api/proveedores?soloActivos=false", fetcher)
  const { data: productosPage } = useSWR<PageResponse<Producto>>(
    "/api/productos/paginado?page=0&size=200&sortBy=nombre&sortDir=asc",
    fetcher
  )

  const comprasUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (filtroProveedor !== "") params.set("proveedorId", String(filtroProveedor))
    if (filtroFechaDesde) params.set("fechaDesde", filtroFechaDesde)
    if (filtroFechaHasta) params.set("fechaHasta", filtroFechaHasta)
    const query = params.toString()
    return query ? `/api/compras?${query}` : "/api/compras"
  }, [filtroProveedor, filtroFechaDesde, filtroFechaHasta])

  const { data: compras = [], mutate: mutateCompras, isLoading: loadingCompras } = useSWR<Compra[]>(comprasUrl, fetcher)

  const productos = productosPage?.items ?? []
  const proveedorSeleccionado = proveedoresActivos.find((p) => p.id === proveedorId) ?? null
  const productoSeleccionado = productos.find((p) => p.id === productoIdDraft) ?? null
  const totalDraft = itemsDraft.reduce((acc, it) => acc + it.costoUnitario * it.cantidad, 0)

  function agregarItem() {
    if (!productoSeleccionado) {
      toast.error("Selecciona un producto")
      return
    }

    const cantidad = Number(cantidadDraft)
    const costoUnitario = Number(costoDraft)

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      toast.error("La cantidad debe ser un entero mayor a 0")
      return
    }

    if (!Number.isFinite(costoUnitario) || costoUnitario <= 0) {
      toast.error("El costo unitario debe ser mayor a 0")
      return
    }

    const existente = itemsDraft.find((i) => i.productoId === productoSeleccionado.id && i.fechaVencimiento === (vencimientoDraft || null))
    if (existente) {
      setItemsDraft((prev) =>
        prev.map((it) =>
          it === existente
            ? {
                ...it,
                cantidad: it.cantidad + cantidad,
                costoUnitario,
              }
            : it
        )
      )
    } else {
      setItemsDraft((prev) => [
        ...prev,
        {
          productoId: productoSeleccionado.id,
          nombreProducto: productoSeleccionado.nombre,
          cantidad,
          costoUnitario,
          fechaVencimiento: vencimientoDraft || null,
        },
      ])
    }

    setCantidadDraft("1")
    setCostoDraft(productoSeleccionado.precioCosto > 0 ? String(productoSeleccionado.precioCosto) : "")
    setVencimientoDraft("")
  }

  function eliminarItem(index: number) {
    setItemsDraft((prev) => prev.filter((_, i) => i !== index))
  }

  async function crearCompra() {
    if (!proveedorId) {
      toast.error("Selecciona un proveedor")
      return
    }
    if (itemsDraft.length === 0) {
      toast.error("Agrega al menos un item")
      return
    }

    setGuardando(true)
    try {
      await api.post("/api/compras", {
        proveedorId,
        numeroComprobante: numeroComprobante.trim() || null,
        observacion: observacion.trim() || null,
        items: itemsDraft.map((it) => ({
          productoId: it.productoId,
          cantidad: it.cantidad,
          costoUnitario: it.costoUnitario,
          fechaVencimiento: it.fechaVencimiento,
        })),
      })

      toast.success("Compra registrada")
      setNumeroComprobante("")
      setObservacion("")
      setItemsDraft([])
      setProveedorId(null)
      await mutateCompras()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo registrar la compra"))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Compras</h1>
          <p className="text-sm text-muted-foreground">Ingreso de mercaderia con costo y lote</p>
        </div>
        {esAdmin && (
          <Button asChild variant="outline">
            <Link href="/proveedores">
              <Building2 className="mr-2 h-4 w-4" />
              Gestionar proveedores
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Proveedor *</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={proveedorId ?? ""}
                onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Seleccionar proveedor</option>
                {proveedoresActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {proveedorSeleccionado && <p className="text-xs text-muted-foreground">Proveedor: {proveedorSeleccionado.nombre}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Numero comprobante</Label>
                <Input
                  value={numeroComprobante}
                  onChange={(e) => setNumeroComprobante(e.target.value)}
                  placeholder="Factura / remito"
                />
              </div>
              <div className="grid gap-2">
                <Label>Observacion</Label>
                <Input
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">Agregar item</p>
              <div className="grid gap-3 md:grid-cols-5">
                <div className="md:col-span-2">
                  <Label>Producto</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={productoIdDraft ?? ""}
                    onChange={(e) => setProductoIdDraft(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.codigoBarras ? `(${p.codigoBarras})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Cantidad</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={cantidadDraft}
                    onChange={(e) => setCantidadDraft(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Costo unitario</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    step="0.01"
                    value={costoDraft}
                    onChange={(e) => setCostoDraft(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Vencimiento</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={vencimientoDraft}
                    onChange={(e) => setVencimientoDraft(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <Button type="button" variant="secondary" onClick={agregarItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar item
                </Button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead>Venc</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsDraft.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Sin items cargados.
                        </TableCell>
                      </TableRow>
                    )}
                    {itemsDraft.map((it, idx) => (
                      <TableRow key={`${it.productoId}-${idx}`}>
                        <TableCell>{it.nombreProducto}</TableCell>
                        <TableCell className="text-right">{it.cantidad}</TableCell>
                        <TableCell className="text-right">{formatPrecio(it.costoUnitario)}</TableCell>
                        <TableCell className="text-right">{formatPrecio(it.costoUnitario * it.cantidad)}</TableCell>
                        <TableCell>{it.fechaVencimiento || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => eliminarItem(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm text-muted-foreground">
                Items: <span className="font-medium text-foreground">{itemsDraft.length}</span>
              </div>
              <div className="text-lg font-bold">{formatPrecio(totalDraft)}</div>
            </div>

            <div className="flex justify-end">
              <Button onClick={crearCompra} disabled={guardando}>
                {guardando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Registrar compra"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Proveedor</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={filtroProveedor}
                onChange={(e) => setFiltroProveedor(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Todos</option>
                {proveedoresTodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Fecha desde</Label>
              <Input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Fecha hasta</Label>
              <Input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Historial de compras ({compras.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Comprobante</TableHead>
                  <TableHead className="hidden lg:table-cell">Usuario</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCompras && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Cargando compras...
                    </TableCell>
                  </TableRow>
                )}

                {!loadingCompras && compras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay compras registradas para los filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}

                {!loadingCompras &&
                  compras.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">#{c.id}</TableCell>
                      <TableCell>{formatFecha(c.fecha)}</TableCell>
                      <TableCell>{c.proveedorNombre}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.numeroComprobante || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{c.usuarioNombre}</TableCell>
                      <TableCell className="text-right">{c.items.length}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPrecio(c.total)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">Rol actual: {user?.rol === "admin" ? "Administrador" : "Empleado"}</Badge>
            <Badge variant="outline">Proveedores activos: {proveedoresActivos.length}</Badge>
            <Badge variant="outline">Productos cargados: {productos.length}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

