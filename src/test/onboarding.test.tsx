import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { tauriMockState } from "./mocks/tauri";
import {
  Onboarding,
  normalizePermissionStatus,
} from "@/components/onboarding/Onboarding";

describe("Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMockState.invokeHandlers.clear();
    tauriMockState.invokeHandlers.set(
      "get_accessibility_permission_status",
      () => true,
    );
    tauriMockState.invokeHandlers.set("test_connection", () => true);
  });

  it("renders onboarding steps", async () => {
    render(<Onboarding onComplete={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
    expect(screen.getByText("Accessibility")).toBeInTheDocument();
    expect(screen.getByText("API Setup")).toBeInTheDocument();
    expect(screen.getByText("Test It")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Channely")).toBeInTheDocument();
  });

  it("supports next/back navigation", async () => {
    render(<Onboarding onComplete={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Welcome to Channely")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText("Accessibility Permission")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "API Setup" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    await waitFor(() => {
      expect(screen.getByText("Accessibility Permission")).toBeInTheDocument();
    });
  });

  it("requires API verification before continuing from API setup step", async () => {
    render(<Onboarding onComplete={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Welcome to Channely")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText("Accessibility Permission")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Cerebras API key")).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Cerebras API key"), {
      target: { value: "csk-test-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByTestId("api-verified-badge")).toBeInTheDocument();
    });
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test It" })).toBeInTheDocument();
    });
  });

  it("persists API key before testing connection", async () => {
    const onSaveApiKey = vi.fn(() => Promise.resolve());
    render(<Onboarding onComplete={() => {}} onSaveApiKey={onSaveApiKey} />);

    await waitFor(() => {
      expect(screen.getByText("Welcome to Channely")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText("Accessibility Permission")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Cerebras API key")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cerebras API key"), {
      target: { value: "  csk-persist-me  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(onSaveApiKey).toHaveBeenCalledWith("csk-persist-me");
    });
  });

  it("starts window dragging from background but not from buttons", async () => {
    render(<Onboarding onComplete={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-flow")).toBeInTheDocument();
    });

    const flow = screen.getByTestId("onboarding-flow");
    fireEvent.mouseDown(flow, { button: 0 });

    await waitFor(() => {
      expect(tauriMockState.window.startDragging).toHaveBeenCalledTimes(1);
    });

    fireEvent.mouseDown(screen.getByRole("button", { name: /next/i }), {
      button: 0,
    });
    expect(tauriMockState.window.startDragging).toHaveBeenCalledTimes(1);
  });
});

describe("normalizePermissionStatus", () => {
  it("returns true only when status is boolean true", () => {
    expect(normalizePermissionStatus(true)).toBe(true);
    expect(normalizePermissionStatus(false)).toBe(false);
    expect(normalizePermissionStatus(undefined)).toBe(false);
    expect(normalizePermissionStatus("true")).toBe(false);
  });
});
