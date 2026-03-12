import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import VentasPage from "@/app/(app)/ventas/page"

vi.mock("@/components/ventas/punto-de-venta", () => ({
  PuntoDeVenta: () => <div data-testid="punto-de-venta">Punto de venta</div>,
}))

describe("VentasPage", () => {
  it("renderiza el modulo de punto de venta", () => {
    render(<VentasPage />)
    expect(screen.getByTestId("punto-de-venta")).toBeInTheDocument()
  })
})
