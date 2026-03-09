import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth-context";
import { RequireAuth } from "./require-auth";

function renderWithAuth(status: "loading" | "authenticated" | "unauthenticated") {
  render(
    <AuthContext.Provider
      value={{
        user: status === "authenticated" ? { id: 1, email: "user@test.local", name: "User", role: "operador" } : null,
        status,
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route element={<div>Dashboard protegido</div>} path="/dashboard" />
          </Route>
          <Route element={<div>Tela de login</div>} path="/login" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RequireAuth", () => {
  it("redirects unauthenticated users to login", async () => {
    renderWithAuth("unauthenticated");
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", async () => {
    renderWithAuth("authenticated");
    expect(await screen.findByText("Dashboard protegido")).toBeInTheDocument();
  });
});
