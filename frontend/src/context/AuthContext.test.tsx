import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, authToken } from "@/api/client";
import { AuthProvider, useAuth } from "./AuthContext";
import type { Account } from "@/types";

vi.mock("@/api/client", () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    loginWithOAuth: vi.fn(),
    logout: vi.fn(),
  },
  authToken: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
}));

vi.mock("@/auth/supabase", () => ({
  supabase: null,
}));

const account: Account = {
  id: "account-1",
  email: "ada@example.com",
  displayName: "Ada",
  createdAt: 1,
};

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <output data-testid="account">{auth.account?.email ?? "signed out"}</output>
      <output data-testid="loading">{String(auth.loading)}</output>
      <output data-testid="error">{auth.error ?? "no error"}</output>
      <button onClick={() => void auth.login("ada@example.com", "password123")}>Login</button>
      <button onClick={() => void auth.loginWithProvider("google")}>Google login</button>
      <button
        onClick={() => {
          void auth.logout().catch(() => undefined);
        }}
      >
        Logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
}

describe("AuthProvider session restoration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authToken.get).mockReturnValue(null);
  });

  it("restores the account for a saved application token", async () => {
    vi.mocked(authToken.get).mockReturnValue("saved-session-token");
    vi.mocked(api.getMe).mockResolvedValue(account);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent(account.email));
    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("clears a stale application token when session restoration is rejected", async () => {
    vi.mocked(authToken.get).mockReturnValue("expired-session-token");
    vi.mocked(api.getMe).mockRejectedValue(new Error("Unauthorized"));

    renderProvider();

    await waitFor(() => expect(authToken.clear).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("account")).toHaveTextContent("signed out");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("surfaces login errors without storing a token", async () => {
    vi.mocked(api.login).mockRejectedValue(new Error("Invalid credentials"));
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Authentication failed.")
    );
    expect(screen.getByTestId("account")).toHaveTextContent("signed out");
    expect(authToken.set).not.toHaveBeenCalled();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("stores the token and account after a successful login", async () => {
    vi.mocked(api.login).mockResolvedValue({ account, token: "new-session-token" });
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent(account.email));
    expect(authToken.set).toHaveBeenCalledWith("new-session-token");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("shows the API message for credential errors", async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError(401, "Invalid credentials"));
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Invalid credentials")
    );
  });

  it("clears local auth state after logout even if the API call fails", async () => {
    vi.mocked(api.logout).mockRejectedValue(new Error("Network unavailable"));
    vi.mocked(authToken.get).mockReturnValue("active-token");
    vi.mocked(api.getMe).mockResolvedValue(account);
    renderProvider();
    await screen.findByText(account.email);

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(authToken.clear).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("account")).toHaveTextContent("signed out");
  });

  it("explains when social login is not configured", async () => {
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Google login" }));

    expect(screen.getByTestId("error")).toHaveTextContent("Social login is not configured yet.");
  });
});
