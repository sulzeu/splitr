import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";
import { useAuth } from "../context/AuthContext";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

describe("AuthScreen", () => {
  it("switches to register mode and submits the registration payload", async () => {
    const login = vi.fn();
    const register = vi.fn().mockResolvedValue(true);
    const loginWithProvider = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      account: null,
      loading: false,
      error: null,
      login,
      register,
      loginWithProvider,
      logout: vi.fn(),
    });

    render(<AuthScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Create a personal account" }));
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledWith("ada@example.com", "secret123", "Ada");
    expect(login).not.toHaveBeenCalled();
  });

  it("shows auth errors from the context", () => {
    vi.mocked(useAuth).mockReturnValue({
      account: null,
      loading: false,
      error: "Invalid credentials",
      login: vi.fn(),
      register: vi.fn(),
      loginWithProvider: vi.fn(),
      logout: vi.fn(),
    });

    render(<AuthScreen />);

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });
});
