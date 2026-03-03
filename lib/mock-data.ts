// ============================================================
// Interfaces y helpers para el sistema de kiosco
// Los datos se guardan en /data/datos.json
// ============================================================

export interface Lote {
  id: number
  cantidad: number
  fechaVencimiento: string // formato "2026-05-15"
  fechaIngreso: string     // formato ISO
}

export interface Producto {
  id: number
  nombre: string
  codigoBarras: string
  precioCosto: number
  precioVenta: number
  stock: number
  stockMinimo: number
  categoria: string
  lotes: Lote[]
}

export type MedioPago = "efectivo" | "debito" | "credito" | "transferencia"

export interface Venta {
  id: number
  fecha: string
  items: VentaItem[]
  subtotal: number
  recargo: number
  total: number
  costoTotal: number
  ganancia: number
  medioPago: MedioPago
  montoRecibido?: number
  vuelto?: number
  cajaId?: number
}

export interface VentaItem {
  productoId: number
  nombre: string
  cantidad: number
  precioUnitario: number
  precioCosto: number
  subtotal: number
  gananciaItem: number
}

// ============================================================
// Usuarios y Roles
// ============================================================

export type Rol = "admin" | "empleado"

export interface Usuario {
  id: number
  nombre: string
  usuario: string // login username
  password: string // plain text (para archivo local, no produccion)
  rol: Rol
  activo: boolean
}

export interface Sesion {
  token: string
  usuarioId: number
  nombre: string
  rol: Rol
  creadaEn: string
}

// ============================================================
// Sistema de Caja
// ============================================================

export interface Caja {
  id: number
  usuarioId: number
  nombreUsuario: string
  fechaApertura: string
  fechaCierre?: string
  montoInicial: number
  totalVendido: number
  totalGanancia: number
  cantidadVentas: number
  montoCierre?: number
  diferencia?: number
  estado: "abierta" | "cerrada"
  ventasIds: number[]
}

// Helper: formatear precio argentino
export function formatPrecio(precio: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(precio)
}

// Helper: formatear fecha
export function formatFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha))
}

// Helper: formatear solo fecha (sin hora)
export function formatFechaCorta(fecha: string): string {
  const d = new Date(fecha + "T00:00:00")
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

// Helper: dias hasta vencimiento
export function diasHastaVencimiento(fecha: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fecha + "T00:00:00")
  const diff = venc.getTime() - hoy.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// Helper: calcular margen de ganancia
export function calcularMargen(costo: number, venta: number): number {
  if (costo === 0) return 100
  return Math.round(((venta - costo) / costo) * 100)
}
