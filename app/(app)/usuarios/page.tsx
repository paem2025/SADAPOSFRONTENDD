"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { UserPlus, Pencil, UserX, UserCheck, Loader2, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Rol = "admin" | "empleado"

interface UserSinPass {
  id: number
  nombre: string
  usuario: string
  rol: Rol
  activo: boolean
}

const PAGE_SIZE = 10
const fetcher = (url: string) => api.get(url).then((res) => res.data)

function getApiErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { status?: number; data?: { error?: string; message?: string } }
    message?: string
  }
  const status = apiErr.response?.status
  if (status === 401) return "Sesion vencida. Inicia sesion nuevamente."
  if (status === 403) return "No tenes permisos para esta accion."
  return apiErr.response?.data?.error || apiErr.response?.data?.message || apiErr.message || fallback
}

export default function UsuariosPage() {
  const { user: authUser } = useAuth()
  const { data: usuarios = [], mutate, isLoading } = useSWR<UserSinPass[]>("/api/usuarios", fetcher)

  const [busqueda, setBusqueda] = useState("")
  const [page, setPage] = useState(0)

  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [editando, setEditando] = useState<UserSinPass | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<UserSinPass | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserSinPass | null>(null)

  const [nombre, setNombre] = useState("")
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [rol, setRol] = useState<Rol>("empleado")

  const ordenados = useMemo(
    () => [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [usuarios]
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ordenados
    return ordenados.filter((u) => {
      const estado = u.activo ? "activo" : "inactivo"
      return (
        u.nombre.toLowerCase().includes(q) ||
        u.usuario.toLowerCase().includes(q) ||
        u.rol.toLowerCase().includes(q) ||
        estado.includes(q)
      )
    })
  }, [ordenados, busqueda])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const usuariosPagina = useMemo(() => {
    const from = page * PAGE_SIZE
    return filtrados.slice(from, from + PAGE_SIZE)
  }, [filtrados, page])

  useEffect(() => {
    setPage(0)
  }, [busqueda, usuarios.length])

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1))
  }, [page, totalPages])

  function abrirNuevo() {
    setEditando(null)
    setNombre("")
    setUsuario("")
    setPassword("")
    setRol("empleado")
    setDialogAbierto(true)
  }

  function abrirEditar(u: UserSinPass) {
    setEditando(u)
    setNombre(u.nombre)
    setUsuario(u.usuario)
    setPassword("")
    setRol(u.rol)
    setDialogAbierto(true)
  }

  async function guardar() {
    const nombreTrim = nombre.trim()
    const usuarioTrim = usuario.trim()
    const passwordTrim = password.trim()

    if (!nombreTrim || !usuarioTrim) {
      toast.error("Nombre y usuario son requeridos")
      return
    }

    if (!editando && !passwordTrim) {
      toast.error("La contrasena es requerida para nuevos usuarios")
      return
    }

    if (passwordTrim && passwordTrim.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres")
      return
    }

    setGuardando(true)
    try {
      if (editando) {
        await api.put(`/api/usuarios/${editando.id}`, {
          nombre: nombreTrim,
          usuario: usuarioTrim,
          rol,
          activo: editando.activo,
          password: passwordTrim ? passwordTrim : null,
        })
        toast.success("Usuario actualizado")
      } else {
        await api.post("/api/usuarios", {
          nombre: nombreTrim,
          usuario: usuarioTrim,
          password: passwordTrim,
          rol,
          activo: true,
        })
        toast.success("Usuario creado")
      }

      setDialogAbierto(false)
      setEditando(null)
      await mutate()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Error de conexion"))
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(u: UserSinPass) {
    if (authUser?.id === u.id && u.activo) {
      toast.error("No podes desactivarte a vos mismo")
      setConfirmToggle(null)
      return
    }

    setGuardando(true)
    try {
      await api.patch(`/api/usuarios/${u.id}/estado`, { activo: !u.activo })
      toast.success(u.activo ? "Usuario desactivado" : "Usuario activado")
      await mutate()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Error al cambiar estado"))
    } finally {
      setGuardando(false)
      setConfirmToggle(null)
    }
  }

  async function eliminarUsuario(u: UserSinPass) {
    if (authUser?.id === u.id) {
      toast.error("No podes eliminarte a vos mismo")
      setConfirmDelete(null)
      return
    }

    setGuardando(true)
    try {
      await api.delete(`/api/usuarios/${u.id}`)
      toast.success("Usuario eliminado")
      await mutate()
      setConfirmDelete(null)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Error al eliminar usuario"))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="page-tone flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestiona los usuarios del sistema</p>
        </div>
        <Button onClick={abrirNuevo} className="bg-primary text-primary-foreground">
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, usuario, rol o estado..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios Registrados ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando usuarios...
                      </span>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  usuariosPagina.map((u) => (
                    <TableRow key={u.id} className={!u.activo ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{u.usuario}</TableCell>
                      <TableCell>
                        <Badge variant={u.rol === "admin" ? "default" : "secondary"} className="capitalize">
                          {u.rol === "admin" ? "Administrador" : "Empleado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.activo ? "outline" : "destructive"} className="text-xs">
                          {u.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => abrirEditar(u)}
                            title="Editar"
                            disabled={guardando}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${u.activo ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}`}
                            onClick={() => setConfirmToggle(u)}
                            title={u.activo ? "Desactivar" : "Activar"}
                            disabled={guardando}
                          >
                            {u.activo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(u)}
                            title="Eliminar"
                            disabled={guardando || authUser?.id === u.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                {!isLoading && usuariosPagina.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay usuarios para mostrar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {usuariosPagina.length} de {filtrados.length} usuarios
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
                Pagina {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page + 1 >= totalPages || isLoading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
            <DialogDescription>
              {editando ? "Modifica los datos del usuario" : "Completa los datos del nuevo usuario"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre Completo</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Perez" />
            </div>

            <div className="grid gap-2">
              <Label>Usuario (para login)</Label>
              <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Ej: jperez" />
            </div>

            <div className="grid gap-2">
              <Label>{editando ? "Nueva Contrasena (opcional)" : "Contrasena"}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editando ? "Dejar vacio para mantener" : "Minimo 6 caracteres"}
              />
            </div>

            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={guardar} disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmToggle !== null} onOpenChange={(open) => { if (!open) setConfirmToggle(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmToggle?.activo ? "Desactivar Usuario" : "Activar Usuario"}</DialogTitle>
            <DialogDescription>
              {confirmToggle?.activo
                ? `Estas seguro de desactivar a "${confirmToggle?.nombre}"? No podra ingresar al sistema.`
                : `Estas seguro de activar a "${confirmToggle?.nombre}"? Podra ingresar al sistema nuevamente.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant={confirmToggle?.activo ? "destructive" : "default"}
              onClick={() => confirmToggle && toggleActivo(confirmToggle)}
              disabled={guardando}
            >
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirmToggle?.activo ? "Si, Desactivar" : "Si, Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Usuario</DialogTitle>
            <DialogDescription>
              Estas seguro de eliminar a &quot;{confirmDelete?.nombre}&quot;? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && eliminarUsuario(confirmDelete)}
              disabled={guardando}
            >
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Si, Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
