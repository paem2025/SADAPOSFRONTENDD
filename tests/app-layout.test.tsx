import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AppLayout from "@/app/(app)/layout"

type TestUser = { id: number; nombre: string; rol: "admin" | "empleado" }

const { replaceMock, authState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  authState: {
    loading: true,
    user: null as TestUser | null,
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}))

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}))

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.loading = true
    authState.user = null
  })

  it("muestra estado de carga", () => {
    render(
      <AppLayout>
        <div>contenido</div>
      </AppLayout>
    )

    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("redirige al login cuando no hay usuario autenticado", async () => {
    authState.loading = false
    authState.user = null

    const { container } = render(
      <AppLayout>
        <div>contenido</div>
      </AppLayout>
    )

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("renderiza la app cuando el usuario esta autenticado", () => {
    authState.loading = false
    authState.user = { id: 1, nombre: "Admin", rol: "admin" }

    render(
      <AppLayout>
        <div>contenido</div>
      </AppLayout>
    )

    expect(screen.getByTestId("app-shell")).toBeInTheDocument()
    expect(screen.getByText("contenido")).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
