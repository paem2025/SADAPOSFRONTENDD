"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Plus, Search, Package, Pencil, Trash2, PackagePlus, Loader2, Eye } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ModoPrecioPeso = "gramo" | "cien_gramos"
type AtajoPos = "carga_virtual" | "direct_tv" | "imprimir_color" | "imprimir_normal" | "pago_proveedores"

type ProductoBackend = {
  id: number
  nombre: string
  codigoBarras: string | null
  precioCosto: number
  precioVenta: number
  stock: number
  stockMinimo: number
  categoria: string | null
  atajoPos?: AtajoPos | null
  fechaVencimiento: string | null
  esPesable?: boolean
  unidadMedida?: "unidad" | "gramo"
  modoPrecioDefault?: ModoPrecioPeso | null
}

type LoteResponse = {
  id: number
  productoId: number
  cantidad: number
  fechaVencimiento: string | null
  fechaIngreso: string | null
}

type PageResponse<T> = {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

const PAGE_SIZE = 20
const fetcher = (url: string) => api.get(url).then((r) => r.data)

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
}

function formatFechaVencimiento(fecha: string | null) {
  if (!fecha) return "-"
  const d = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
  return new Intl.DateTimeFormat("es-AR").format(d)
}

function formatFechaIngreso(fecha: string | null) {
  if (!fecha) return "-"
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return new Intl.DateTimeFormat("es-AR").format(d)
}

function estadoLote(fechaVencimiento: string | null) {
  if (!fechaVencimiento) {
    return { label: "Sin vencimiento", className: "bg-muted text-muted-foreground" }
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const venc = new Date(`${fechaVencimiento}T00:00:00`)
  if (Number.isNaN(venc.getTime())) {
    return { label: "Fecha invalida", className: "bg-muted text-muted-foreground" }
  }

  const diffDias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDias < 0) {
    return { label: `Vencido (${Math.abs(diffDias)}d)`, className: "bg-red-100 text-red-700" }
  }
  if (diffDias <= 30) {
    return { label: `Por vencer (${diffDias}d)`, className: "bg-amber-100 text-amber-700" }
  }
  return { label: `OK (${diffDias}d)`, className: "bg-emerald-100 text-emerald-700" }
}

function compareLoteFefo(a: LoteResponse, b: LoteResponse) {
  const aV = a.fechaVencimiento ? new Date(`${a.fechaVencimiento}T00:00:00`) : null
  const bV = b.fechaVencimiento ? new Date(`${b.fechaVencimiento}T00:00:00`) : null

  const aValid = aV !== null && !Number.isNaN(aV.getTime())
  const bValid = bV !== null && !Number.isNaN(bV.getTime())

  if (aValid && !bValid) return -1
  if (!aValid && bValid) return 1

  if (aValid && bValid && aV && bV) {
    const diff = aV.getTime() - bV.getTime()
    if (diff !== 0) return diff
  }

  const aI = a.fechaIngreso ? new Date(a.fechaIngreso).getTime() : 0
  const bI = b.fechaIngreso ? new Date(b.fechaIngreso).getTime() : 0
  if (aI !== bI) return aI - bI

  return a.id - b.id
}

function calcularMargen(costo: number, venta: number) {
  if (!costo || costo <= 0) return 0
  return Math.round(((venta - costo) / costo) * 100)
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function parseInteger(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null
  const n = Number(normalized)
  if (!Number.isInteger(n)) return null
  return n
}

function getApiErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { status?: number; data?: { error?: string; message?: string } }
    message?: string
  }
  const status = apiErr.response?.status
  if (status === 401) return "Sesion vencida. Inicia sesion de nuevo."
  if (status === 403) return "No tenes permisos para esta accion."
  return apiErr.response?.data?.error || apiErr.response?.data?.message || apiErr.message || fallback
}

function esAtajoSaldo(atajo: AtajoPos | null | undefined) {
  return atajo === "carga_virtual" || atajo === "direct_tv" || atajo === "pago_proveedores"
}

function etiquetaAtajo(atajo: AtajoPos | null | undefined) {
  if (!atajo) return null
  if (atajo === "carga_virtual") return "carga virtual"
  if (atajo === "direct_tv") return "direct tv"
  if (atajo === "imprimir_color") return "imprimir color"
  if (atajo === "imprimir_normal") return "imprimir normal"
  return "pago proveedores"
}

export default function ProductosTabla() {
  const [busqueda, setBusqueda] = useState("")
  const [page, setPage] = useState(0)

  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [stockDialogAbierto, setStockDialogAbierto] = useState(false)
  const [lotesDialogAbierto, setLotesDialogAbierto] = useState(false)

  const [productoEditando, setProductoEditando] = useState<ProductoBackend | null>(null)
  const [productoStock, setProductoStock] = useState<ProductoBackend | null>(null)
  const [productoLotes, setProductoLotes] = useState<ProductoBackend | null>(null)

  const [cantidadStock, setCantidadStock] = useState("")
  const [costoStock, setCostoStock] = useState("")
  const [stockVencimiento, setStockVencimiento] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [cargandoLotes, setCargandoLotes] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const [lotes, setLotes] = useState<LoteResponse[]>([])

  const [formNombre, setFormNombre] = useState("")
  const [formCodigo, setFormCodigo] = useState("")
  const [formPrecioCosto, setFormPrecioCosto] = useState("")
  const [formPrecio, setFormPrecio] = useState("")
  const [formStock, setFormStock] = useState("")
  const [formStockMinimo, setFormStockMinimo] = useState("")
  const [formCategoria, setFormCategoria] = useState("")
  const [formVencimiento, setFormVencimiento] = useState("")
  const [formEsPesable, setFormEsPesable] = useState(false)
  const [formModoPrecioDefault, setFormModoPrecioDefault] = useState<ModoPrecioPeso>("cien_gramos")
  const [formAtajoPos, setFormAtajoPos] = useState<AtajoPos | "">("")

  const esProductoSaldo = esAtajoSaldo(formAtajoPos || null)
  const tieneAtajoPos = Boolean(formAtajoPos)

  useEffect(() => {
    setPage(0)
  }, [busqueda])

  useEffect(() => {
    if (!esProductoSaldo) return
    setFormEsPesable(false)
    setFormModoPrecioDefault("cien_gramos")
    setFormPrecioCosto("0")
    setFormPrecio("1")
    setFormVencimiento("")
  }, [esProductoSaldo])

  useEffect(() => {
    if (!tieneAtajoPos) return
    setFormEsPesable(false)
  }, [tieneAtajoPos])

  const productosUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("size", String(PAGE_SIZE))
    params.set("sortBy", "nombre")
    params.set("sortDir", "asc")
    const q = busqueda.trim()
    if (q) params.set("q", q)
    return `/api/productos/paginado?${params.toString()}`
  }, [busqueda, page])

  const {
    data: pageData,
    mutate,
    isLoading,
  } = useSWR<PageResponse<ProductoBackend>>(productosUrl, fetcher, { keepPreviousData: true })

  const { data: stockBajo = [], mutate: mutateStockBajo } = useSWR<ProductoBackend[]>(
    "/api/productos/stock-bajo",
    fetcher
  )

  const productos = pageData?.items ?? []
  const totalElements = pageData?.totalElements ?? 0
  const totalPagesRaw = pageData?.totalPages ?? 0
  const totalPagesVisibles = Math.max(totalPagesRaw, 1)

  const lotesFefo = useMemo(
    () => [...lotes].filter((l) => (l.cantidad ?? 0) > 0).sort(compareLoteFefo),
    [lotes]
  )
  const productoStockEsSaldo = esAtajoSaldo(productoStock?.atajoPos ?? null)

  function resetFormulario() {
    setFormNombre("")
    setFormCodigo("")
    setFormPrecioCosto("")
    setFormPrecio("")
    setFormStock("")
    setFormStockMinimo("5")
    setFormCategoria("General")
    setFormVencimiento("")
    setFormEsPesable(false)
    setFormModoPrecioDefault("cien_gramos")
    setFormAtajoPos("")
  }

  function abrirFormularioNuevo() {
    setProductoEditando(null)
    resetFormulario()
    setDialogAbierto(true)
  }

  function abrirFormularioEditar(producto: ProductoBackend) {
    setProductoEditando(producto)
    setFormNombre(producto.nombre ?? "")
    setFormCodigo(producto.codigoBarras ?? "")
    setFormPrecioCosto(String(producto.precioCosto ?? 0))
    setFormPrecio(String(producto.precioVenta ?? 0))
    setFormStock(String(producto.stock ?? 0))
    setFormStockMinimo(String(producto.stockMinimo ?? 0))
    setFormCategoria(producto.categoria ?? "General")
    setFormVencimiento(producto.fechaVencimiento ?? "")
    setFormEsPesable(Boolean(producto.esPesable))
    setFormModoPrecioDefault(producto.modoPrecioDefault ?? "cien_gramos")
    setFormAtajoPos((producto.atajoPos as AtajoPos | null) ?? "")
    setDialogAbierto(true)
  }

  async function abrirLotes(producto: ProductoBackend) {
    setProductoLotes(producto)
    setLotesDialogAbierto(true)
    setCargandoLotes(true)

    try {
      const data = await api.get(`/api/productos/${producto.id}/lotes`).then((r) => r.data as LoteResponse[])
      setLotes(data ?? [])
    } catch (err: unknown) {
      setLotes([])
      toast.error(getApiErrorMessage(err, "No se pudieron cargar los lotes"))
    } finally {
      setCargandoLotes(false)
    }
  }

  async function guardarProducto() {
    const nombre = formNombre.trim()
    const stock = parseInteger(formStock) ?? 0
    const stockMinimo = parseInteger(formStockMinimo) ?? 5

    const precioVenta = esProductoSaldo ? 1 : parseNumber(formPrecio)
    const precioCosto = esProductoSaldo ? 0 : parseNumber(formPrecioCosto) ?? 0
    const fechaVencimiento = esProductoSaldo ? null : formVencimiento.trim() ? formVencimiento : null
    const esPesableFinal = tieneAtajoPos ? false : formEsPesable

    if (!nombre) {
      toast.error("Completa el nombre del producto")
      return
    }

    if (precioVenta === null) {
      toast.error("Completa el precio de venta")
      return
    }

    if (precioVenta < 0 || precioCosto < 0) {
      toast.error("Los precios no pueden ser negativos")
      return
    }

    if (stock < 0 || stockMinimo < 0) {
      toast.error(esProductoSaldo ? "Saldo y saldo minimo deben ser >= 0" : "Stock y stock minimo deben ser >= 0")
      return
    }

    setGuardando(true)
    try {
      const payload = {
        nombre,
        codigoBarras: formCodigo.trim() ? formCodigo.trim() : null,
        precioCosto,
        precioVenta,
        stock,
        stockMinimo,
        categoria: formCategoria.trim() ? formCategoria.trim() : "General",
        fechaVencimiento,
        esPesable: esPesableFinal,
        unidadMedida: esPesableFinal ? "gramo" : "unidad",
        modoPrecioDefault: esPesableFinal ? formModoPrecioDefault : null,
        atajoPos: formAtajoPos || null,
      }

      if (productoEditando) {
        await api.put(`/api/productos/${productoEditando.id}`, payload)
        toast.success("Producto actualizado")
      } else {
        await api.post("/api/productos", payload)
        toast.success("Producto creado")
        setPage(0)
      }

      await mutate()
      await mutateStockBajo()
      setDialogAbierto(false)
      setProductoEditando(null)
      resetFormulario()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Error al guardar producto"))
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarProducto(id: number) {
    const eraUltimoDePagina = productos.length === 1 && page > 0

    setGuardando(true)
    try {
      await api.delete(`/api/productos/${id}`)
      toast.success("Producto eliminado")

      await mutate()
      await mutateStockBajo()

      if (eraUltimoDePagina) {
        setPage((prev) => Math.max(0, prev - 1))
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Error al eliminar"))
    } finally {
      setGuardando(false)
      setConfirmDeleteId(null)
    }
  }

  function abrirIngresoStock(producto: ProductoBackend) {
    setProductoStock(producto)
    setCantidadStock("")
    setCostoStock(producto.precioCosto > 0 ? String(producto.precioCosto) : "")
    setStockVencimiento(producto.fechaVencimiento ?? "")
    setStockDialogAbierto(true)
  }

  async function confirmarIngresoStock() {
    if (!productoStock) {
      toast.error("Selecciona un producto")
      return
    }

    const cant = parseInteger(cantidadStock)
    if (cant === null || cant <= 0) {
      toast.error("Ingresa una cantidad valida")
      return
    }

    const costo = costoStock.trim() ? parseNumber(costoStock) : null
    if (costoStock.trim() && (costo === null || costo < 0)) {
      toast.error("El precio de costo es invalido")
      return
    }

    setGuardando(true)
    try {
      const payload: {
        cantidad: number
        precioCosto?: number | null
        fechaVencimiento?: string | null
      } = {
        cantidad: cant,
      }

      if (costo !== null) payload.precioCosto = costo
      if (stockVencimiento.trim() && !productoStock.atajoPos) payload.fechaVencimiento = stockVencimiento

      await api.patch(`/api/productos/${productoStock.id}`, payload)

      toast.success(
        productoStockEsSaldo
          ? `Saldo actualizado: +${cant}`
          : `Stock actualizado: +${cant} ${productoStock.esPesable ? "g" : "unidades"}`
      )
      await mutate()
      await mutateStockBajo()

      setStockDialogAbierto(false)
      setProductoStock(null)
      setCantidadStock("")
      setCostoStock("")
      setStockVencimiento("")
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Error al ingresar stock/saldo"))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="page-tone flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Productos</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu inventario de productos</p>
          <div className="mt-2">
            <Badge variant={stockBajo.length > 0 ? "destructive" : "secondary"}>
              Stock bajo: {stockBajo.length}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={abrirFormularioNuevo} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogAbierto}
        onOpenChange={(open) => {
          setDialogAbierto(open)
          if (!open) {
            setProductoEditando(null)
            resetFormulario()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{productoEditando ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            <DialogDescription>
              {productoEditando ? "Modifica los datos del producto" : "Completa los datos para agregar un nuevo producto"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder={formEsPesable ? "Ej: Caramelos a granel" : "Ej: Coca Cola 500ml"}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="codigo">Codigo de barras</Label>
              <Input
                id="codigo"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Escanea o escribe el codigo (opcional)"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="atajoPos">Atajo POS (opcional)</Label>
              <select
                id="atajoPos"
                value={formAtajoPos}
                onChange={(e) => setFormAtajoPos((e.target.value as AtajoPos | "") || "")}
                className="control-tone h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Sin atajo</option>
                <option value="carga_virtual">Carga virtual</option>
                <option value="direct_tv">Direct TV</option>
                <option value="imprimir_color">Imprimir color</option>
                <option value="imprimir_normal">Imprimir normal</option>
                <option value="pago_proveedores">Pago proveedores</option>
              </select>
              {esProductoSaldo && (
                <p className="text-xs text-muted-foreground">
                  Modo saldo activo: se ocultan precios y se usa saldo (precio venta fijo = 1).
                </p>
              )}
            </div>

            {!tieneAtajoPos && (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <input
                    id="formEsPesable"
                    type="checkbox"
                    checked={formEsPesable}
                    onChange={(e) => setFormEsPesable(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="formEsPesable" className="cursor-pointer">
                    Producto pesable (venta por gramos)
                  </Label>
                </div>

                {formEsPesable && (
                  <>
                    <div className="grid gap-2">
                      <Label>Modo de precio por defecto</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={formModoPrecioDefault === "cien_gramos" ? "default" : "outline"}
                          onClick={() => setFormModoPrecioDefault("cien_gramos")}
                        >
                          Precio por 100g
                        </Button>
                        <Button
                          type="button"
                          variant={formModoPrecioDefault === "gramo" ? "default" : "outline"}
                          onClick={() => setFormModoPrecioDefault("gramo")}
                        >
                          Precio por gramo
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Si es pesable, el stock se guarda en gramos. Ejemplo: 5000 = 5 kg.
                    </p>
                  </>
                )}
              </div>
            )}

            {!esProductoSaldo && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="precioCosto">Precio de costo</Label>
                  <Input
                    id="precioCosto"
                    type="number"
                    value={formPrecioCosto}
                    onChange={(e) => setFormPrecioCosto(e.target.value)}
                    placeholder="Lo que pagas vos"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="precio">
                    {formEsPesable
                      ? formModoPrecioDefault === "gramo"
                        ? "Precio base por gramo *"
                        : "Precio base cada 100g *"
                      : "Precio de venta *"}
                  </Label>
                  <Input
                    id="precio"
                    type="number"
                    value={formPrecio}
                    onChange={(e) => setFormPrecio(e.target.value)}
                    placeholder={
                      formEsPesable
                        ? formModoPrecioDefault === "gramo"
                          ? "Ej: 12.5"
                          : "Ej: 1250"
                        : "Lo que cobras"
                    }
                  />
                </div>
              </div>
            )}

            {!esProductoSaldo && formPrecioCosto && formPrecio && Number(formPrecioCosto) > 0 && (
              <div className="rounded-lg border px-3 py-2 text-sm text-foreground">
                Ganancia: {formatPrecio(Number(formPrecio) - Number(formPrecioCosto))} por{" "}
                {formEsPesable ? (formModoPrecioDefault === "gramo" ? "gramo" : "100g") : "unidad"} (
                {calcularMargen(Number(formPrecioCosto), Number(formPrecio))}% de margen)
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  placeholder="Ej: Bebidas"
                />
              </div>
              {!esProductoSaldo && (
                <div className="grid gap-2">
                  <Label htmlFor="vencimiento">Fecha de vencimiento</Label>
                  <Input
                    id="vencimiento"
                    type="date"
                    value={formVencimiento}
                    onChange={(e) => setFormVencimiento(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stock">
                  {esProductoSaldo
                    ? "Ingresar saldo *"
                    : productoEditando
                      ? formEsPesable
                        ? "Stock (gramos)"
                        : "Stock"
                      : formEsPesable
                        ? "Stock inicial (gramos)"
                        : "Stock inicial"}
                </Label>
                <Input
                  id="stock"
                  type="number"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  placeholder={formEsPesable ? "Ej: 5000" : "0"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stockMinimo">
                  {esProductoSaldo
                    ? "Stock minimo (alerta)"
                    : formEsPesable
                      ? "Stock minimo (gramos)"
                      : "Stock minimo (alerta)"}
                </Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  value={formStockMinimo}
                  onChange={(e) => setFormStockMinimo(e.target.value)}
                  placeholder={formEsPesable ? "Ej: 500" : "5"}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarProducto} className="bg-primary text-primary-foreground" disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : productoEditando ? (
                "Guardar cambios"
              ) : (
                "Crear producto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por nombre o codigo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Catalogo ({totalElements} productos)
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden lg:table-cell">Codigo</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Vencimiento</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Costo</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Margen</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando productos...
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  productos.map((p) => {
                    const margen = p.precioCosto > 0 ? calcularMargen(p.precioCosto, p.precioVenta) : null
                    const esAtajoSaldoProducto = esAtajoSaldo(p.atajoPos)
                    const atajoLabel = etiquetaAtajo(p.atajoPos)

                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {p.nombre}
                              {p.esPesable && <span className="ml-2 text-xs text-muted-foreground">(granel)</span>}
                              {atajoLabel && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({atajoLabel})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground lg:hidden">{p.codigoBarras ?? "-"}</p>
                          </div>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {p.codigoBarras ?? "-"}
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary">{p.categoria ?? "General"}</Badge>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatFechaVencimiento(p.fechaVencimiento)}
                        </TableCell>

                        <TableCell className="hidden xl:table-cell text-right text-sm text-muted-foreground">
                          {esAtajoSaldoProducto ? "-" : p.precioCosto > 0 ? formatPrecio(p.precioCosto) : "-"}
                        </TableCell>

                        <TableCell className="text-right font-medium">
                          {esAtajoSaldoProducto ? "Saldo" : formatPrecio(p.precioVenta)}
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-right">
                          {esAtajoSaldoProducto ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : margen !== null ? (
                            <Badge variant="secondary">{margen}%</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant={p.stock <= p.stockMinimo ? "destructive" : "secondary"}>
                            {p.esPesable ? `${p.stock}g` : p.stock}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => abrirLotes(p)}
                              title="Ver lotes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => abrirIngresoStock(p)}
                              title={esAtajoSaldoProducto ? "Ingresar saldo" : "Ingresar stock"}
                            >
                              <PackagePlus className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => abrirFormularioEditar(p)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeleteId(p.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                {!isLoading && productos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      Sin resultados para la busqueda actual.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {productos.length} de {totalElements} productos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0 || isLoading}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Pagina {page + 1} de {totalPagesVisibles}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={isLoading || page + 1 >= totalPagesRaw}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={stockDialogAbierto}
        onOpenChange={(open) => {
          setStockDialogAbierto(open)
          if (!open) {
            setProductoStock(null)
            setCantidadStock("")
            setCostoStock("")
            setStockVencimiento("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              {productoStockEsSaldo ? "Ingresar saldo" : "Ingresar stock"}
            </DialogTitle>
            <DialogDescription>
              {productoStock
                ? `${productoStockEsSaldo ? "Agregar saldo" : `Agregar ${productoStock.esPesable ? "gramos" : "unidades"}`} a: ${
                    productoStock.nombre
                  } (actual: ${productoStock.esPesable ? `${productoStock.stock}g` : productoStock.stock})`
                : "Selecciona un producto"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cantidadStock">
                {productoStockEsSaldo
                  ? "Saldo a ingresar *"
                  : productoStock?.esPesable
                    ? "Gramos a ingresar *"
                    : "Cantidad a ingresar *"}
              </Label>
              <Input
                id="cantidadStock"
                type="number"
                value={cantidadStock}
                onChange={(e) => setCantidadStock(e.target.value)}
                placeholder={productoStockEsSaldo ? "Ej: 100000" : productoStock?.esPesable ? "Ej: 500" : "Ej: 20"}
                min="1"
              />
            </div>

            {!productoStockEsSaldo && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="costoStock">Precio de costo (opcional)</Label>
                  <Input
                    id="costoStock"
                    type="number"
                    value={costoStock}
                    onChange={(e) => setCostoStock(e.target.value)}
                    placeholder="Dejar vacio para no cambiar"
                    min="0"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="stockVencimiento">Fecha de vencimiento (opcional)</Label>
                  <Input
                    id="stockVencimiento"
                    type="date"
                    value={stockVencimiento}
                    onChange={(e) => setStockVencimiento(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarIngresoStock} className="bg-primary text-primary-foreground" disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lotesDialogAbierto}
        onOpenChange={(open) => {
          setLotesDialogAbierto(open)
          if (!open) {
            setProductoLotes(null)
            setLotes([])
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Lotes de {productoLotes?.nombre ?? ""}</DialogTitle>
            <DialogDescription>Detalle FEFO: primero vence, primero sale</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border">
            <div className="grid grid-cols-5 gap-2 border-b px-4 py-3 text-sm font-medium">
              <div>Prioridad</div>
              <div>Ingreso</div>
              <div>Cantidad</div>
              <div>Vencimiento</div>
              <div>Estado</div>
            </div>

            {cargandoLotes ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">Cargando lotes...</div>
            ) : lotesFefo.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">No hay lotes con stock para este producto.</div>
            ) : (
              <div className="max-h-[280px] overflow-auto">
                {lotesFefo.map((l, idx) => {
                  const est = estadoLote(l.fechaVencimiento)
                  return (
                    <div key={l.id} className="grid grid-cols-5 gap-2 border-b px-4 py-3 text-sm last:border-b-0">
                      <div>
                        <Badge variant={idx === 0 ? "default" : "secondary"}>{idx + 1}°</Badge>
                      </div>
                      <div>{formatFechaIngreso(l.fechaIngreso)}</div>
                      <div>{productoLotes?.esPesable ? `${l.cantidad}g` : l.cantidad}</div>
                      <div>{formatFechaVencimiento(l.fechaVencimiento)}</div>
                      <div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${est.className}`}>
                          {est.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">FEFO activo en ventas: primero vence, primero sale.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminacion</DialogTitle>
            <DialogDescription>
              Estas seguro de eliminar el producto{" "}
              <span className="font-semibold text-foreground">
                {productos.find((p) => p.id === confirmDeleteId)?.nombre ?? ""}
              </span>
              ? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId !== null && eliminarProducto(confirmDeleteId)}
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Si, eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
