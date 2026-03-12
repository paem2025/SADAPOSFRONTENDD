import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginPage from "@/app/login/page"

const { loginMock, pushMock, refreshMock, toastSuccessMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}))

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}))

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirige al home cuando el login es exitoso", async () => {
    loginMock.mockResolvedValue({ ok: true })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "admin" } })
    fireEvent.change(screen.getByLabelText("Contrasena"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("admin", "123456")
      expect(pushMock).toHaveBeenCalledWith("/")
      expect(refreshMock).toHaveBeenCalled()
    })
  })

  it("muestra error cuando el login falla", async () => {
    loginMock.mockResolvedValue({ ok: false, error: "Credenciales invalidas" })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "admin" } })
    fireEvent.change(screen.getByLabelText("Contrasena"), { target: { value: "mala" } })
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }))

    expect(await screen.findByText("Credenciales invalidas")).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
