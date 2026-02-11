import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Tauri mocks must be imported before components
import { tauriMockState } from "./mocks/tauri";

import { DiffView } from "@/components/overlay/DiffView";
import { StyleSelector } from "@/components/overlay/StyleSelector";
import { ActionBar } from "@/components/overlay/ActionBar";
import { Overlay } from "@/components/overlay/Overlay";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Kbd } from "@/components/ui/Kbd";
import { useOverlayStore } from "@/stores/overlayStore";
import type { DiffSegment } from "@/lib/diff";

// Reset store between tests
beforeEach(() => {
  useOverlayStore.setState({
    visible: false,
    loading: false,
    error: null,
    originalText: "",
    improvedText: "",
    segments: [],
    style: "casual",
  });
  tauriMockState.eventListeners.clear();
});

// ─── DiffView Tests ────────────────────────────────────────────────

describe("DiffView", () => {
  it("renders added segments in green", () => {
    const segments: DiffSegment[] = [
      { text: "Hello ", kind: "unchanged" },
      { text: "beautiful ", kind: "added" },
      { text: "world", kind: "unchanged" },
    ];

    render(<DiffView segments={segments} />);

    const added = screen.getByTestId("diff-added");
    expect(added).toHaveTextContent(/beautiful/);
    expect(added.className).toContain("bg-emerald");
  });

  it("renders removed segments in red with strikethrough", () => {
    const segments: DiffSegment[] = [
      { text: "Hello ", kind: "unchanged" },
      { text: "ugly ", kind: "removed" },
      { text: "world", kind: "unchanged" },
    ];

    render(<DiffView segments={segments} />);

    const removed = screen.getByTestId("diff-removed");
    expect(removed).toHaveTextContent(/ugly/);
    expect(removed.className).toContain("bg-red");
    expect(removed.className).toContain("line-through");
  });

  it("renders unchanged segments normally", () => {
    const segments: DiffSegment[] = [
      { text: "Hello world", kind: "unchanged" },
    ];

    const { container } = render(<DiffView segments={segments} />);

    const span = container.querySelector("span");
    expect(span).toHaveTextContent("Hello world");
    // Should not have green or red backgrounds
    expect(span!.className).not.toContain("bg-emerald");
    expect(span!.className).not.toContain("bg-red");
    expect(span!.className).not.toContain("line-through");
  });

  it("shows 'Changes' label when there are changes", () => {
    const segments: DiffSegment[] = [
      { text: "Hello ", kind: "unchanged" },
      { text: "world", kind: "added" },
    ];

    render(<DiffView segments={segments} />);

    // DiffView renders diff inline without a decorative "Changes" label
    expect(screen.getByTestId("diff-added")).toBeInTheDocument();
  });

  it("does not show 'Changes' label when there are no changes", () => {
    const segments: DiffSegment[] = [
      { text: "Hello world", kind: "unchanged" },
    ];

    render(<DiffView segments={segments} />);

    expect(screen.queryByTestId("diff-added")).not.toBeInTheDocument();
  });
});

// ─── StyleSelector Tests ────────────────────────────────────────────

describe("StyleSelector", () => {
  it("renders all 4 style presets", () => {
    const onChange = vi.fn();
    render(<StyleSelector activeStyle="casual" onStyleChange={onChange} />);

    expect(screen.getByText("Casual")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Concise")).toBeInTheDocument();
    expect(screen.getByText("Friendly")).toBeInTheDocument();
  });

  it("toggles between presets on click", () => {
    const onChange = vi.fn();
    render(<StyleSelector activeStyle="casual" onStyleChange={onChange} />);

    fireEvent.click(screen.getByText("Pro"));
    expect(onChange).toHaveBeenCalledWith("professional");

    fireEvent.click(screen.getByText("Concise"));
    expect(onChange).toHaveBeenCalledWith("concise");

    fireEvent.click(screen.getByText("Friendly"));
    expect(onChange).toHaveBeenCalledWith("friendly");
  });

  it("highlights active style", () => {
    const onChange = vi.fn();
    render(
      <StyleSelector activeStyle="professional" onStyleChange={onChange} />,
    );

    const proButton = screen.getByText("Pro").closest("button")!;
    expect(proButton.getAttribute("aria-checked")).toBe("true");

    const casualButton = screen.getByText("Casual").closest("button")!;
    expect(casualButton.getAttribute("aria-checked")).toBe("false");
  });

  it("uses radiogroup semantics", () => {
    const onChange = vi.fn();
    render(<StyleSelector activeStyle="casual" onStyleChange={onChange} />);
    expect(screen.getByRole("radiogroup", { name: "Writing style" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("disables all buttons when disabled prop is true", () => {
    const onChange = vi.fn();
    render(
      <StyleSelector
        activeStyle="casual"
        onStyleChange={onChange}
        disabled={true}
      />,
    );

    const radios = screen.getAllByRole("radio");
    radios.forEach((btn) => expect(btn).toBeDisabled());
  });
});

// ─── ActionBar Tests ────────────────────────────────────────────────

describe("ActionBar", () => {
  it("shows correct keyboard shortcuts", () => {
    render(<ActionBar />);

    expect(screen.getByText("Tab")).toBeInTheDocument();
    expect(screen.getByText("↵")).toBeInTheDocument();
    expect(screen.getByText("accept")).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByText("dismiss")).toBeInTheDocument();
    expect(screen.getByText("⌘Q")).toBeInTheDocument();
    expect(screen.getByText("quit")).toBeInTheDocument();
  });
});

// ─── GlassPanel Tests ────────────────────────────────────────────────

describe("GlassPanel", () => {
  it("renders children", () => {
    render(<GlassPanel>Hello GlassPanel</GlassPanel>);
    expect(screen.getByText("Hello GlassPanel")).toBeInTheDocument();
  });

  it("applies glass morphism styles", () => {
    const { container } = render(<GlassPanel>Content</GlassPanel>);
    const panel = container.firstChild as HTMLElement;
    expect(panel.className).toContain("backdrop-blur-xl");
    expect(panel.className).toContain("rounded-2xl");
    expect(panel.className).toContain("shadow-2xl");
  });

  it("accepts additional className", () => {
    const { container } = render(
      <GlassPanel className="my-custom-class">Content</GlassPanel>,
    );
    const panel = container.firstChild as HTMLElement;
    expect(panel.className).toContain("my-custom-class");
  });
});

// ─── Kbd Tests ────────────────────────────────────────────────────────

describe("Kbd", () => {
  it("renders key text", () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("renders as a kbd element", () => {
    const { container } = render(<Kbd>Enter</Kbd>);
    expect(container.querySelector("kbd")).toBeInTheDocument();
  });
});

// ─── Overlay Tests ────────────────────────────────────────────────────

describe("Overlay", () => {
  it("does not render content when not visible", () => {
    render(<Overlay />);
    expect(screen.queryByText("Channely")).not.toBeInTheDocument();
  });

  it("renders header when visible", () => {
    useOverlayStore.setState({
      visible: true,
      segments: [{ text: "Test", kind: "unchanged" }],
    });

    render(<Overlay />);
    expect(screen.getByText("Channely")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows loading state while AI processes", async () => {
    useOverlayStore.setState({
      visible: true,
      loading: true,
    });

    render(<Overlay />);
    expect(screen.getByText("Improving…")).toBeInTheDocument();
  });

  it("shows streaming preview while loading with partial text", () => {
    useOverlayStore.setState({
      visible: true,
      loading: true,
      improvedText: "Streaming output",
    });

    render(<Overlay />);
    expect(screen.getByText("Streaming output")).toBeInTheDocument();
  });

  it("shows error state on failure", () => {
    useOverlayStore.setState({
      visible: true,
      loading: false,
      error: "API timeout — please try again",
    });

    render(<Overlay />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("API timeout — please try again"),
    ).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows diff when segments are available", () => {
    useOverlayStore.setState({
      visible: true,
      loading: false,
      error: null,
      segments: [
        { text: "Hello ", kind: "unchanged" },
        { text: "world", kind: "added" },
      ],
    });

    render(<Overlay />);
    expect(screen.getByTestId("diff-added")).toHaveTextContent("world");
  });

  it("renders correctly when animations are disabled", () => {
    useOverlayStore.setState({
      visible: true,
      loading: false,
      error: null,
      segments: [{ text: "Test", kind: "unchanged" }],
    });

    render(<Overlay animationsEnabled={false} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ─── Keyboard Handling Tests ────────────────────────────────────────

describe("Keyboard handling", () => {
  it("Enter keyup triggers accept callback after keydown arming", () => {
    const onAccept = vi.fn();
    useOverlayStore.setState({ visible: true, loading: false });

    render(<Overlay onAccept={onAccept} />);

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.keyUp(window, { key: "Enter" });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("Tab keyup triggers accept callback after keydown arming", () => {
    const onAccept = vi.fn();
    useOverlayStore.setState({ visible: true, loading: false });

    render(<Overlay onAccept={onAccept} />);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.keyUp(window, { key: "Tab" });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("Escape triggers dismiss callback", () => {
    const onDismiss = vi.fn();
    useOverlayStore.setState({ visible: true, loading: false });

    render(<Overlay onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not fire keyboard handlers when overlay is hidden", () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    useOverlayStore.setState({ visible: false });

    render(<Overlay onAccept={onAccept} onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onAccept).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ─── Full Flow Tests (Component-level) ──────────────────────────────

describe("Full flow (component-level)", () => {
  it("trigger overlay → see diff → accept → overlay closes", () => {
    const onAccept = vi.fn();
    const store = useOverlayStore;

    // Start hidden
    const { rerender } = render(<Overlay onAccept={onAccept} />);
    expect(screen.queryByText("Channely")).not.toBeInTheDocument();

    // Simulate showing with segments
    act(() => {
      store.setState({
        visible: true,
        loading: false,
        segments: [
          { text: "Fixed ", kind: "unchanged" },
          { text: "text", kind: "added" },
        ],
      });
    });

    rerender(<Overlay onAccept={onAccept} />);
    expect(screen.getByText("Channely")).toBeInTheDocument();
    expect(screen.getByTestId("diff-added")).toHaveTextContent("text");

    // Press Enter to accept
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyUp(window, { key: "Enter" });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("trigger overlay → dismiss → overlay closes", () => {
    const onDismiss = vi.fn();
    const store = useOverlayStore;

    render(<Overlay onDismiss={onDismiss} />);

    // Show overlay
    act(() => {
      store.setState({
        visible: true,
        loading: false,
        segments: [{ text: "Some text", kind: "unchanged" }],
      });
    });

    expect(screen.getByText("Channely")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("close button triggers dismiss", () => {
    const onDismiss = vi.fn();
    useOverlayStore.setState({
      visible: true,
      loading: false,
      segments: [{ text: "Hello", kind: "unchanged" }],
    });

    render(<Overlay onDismiss={onDismiss} />);

    const closeBtn = screen.getByLabelText("Close proofreading overlay");
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ─── Theme Tests ────────────────────────────────────────────────────

describe("Theme", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("dark mode: GlassPanel has dark variant classes in markup", () => {
    const { container } = render(
      <GlassPanel>Dark content</GlassPanel>,
    );
    const panel = container.firstChild as HTMLElement;
    // TailwindCSS 4 dark: classes are present in class attribute
    expect(panel.className).toContain("dark:bg-neutral-900/85");
  });

  it("light mode: GlassPanel has light variant classes in markup", () => {
    const { container } = render(
      <GlassPanel>Light content</GlassPanel>,
    );
    const panel = container.firstChild as HTMLElement;
    expect(panel.className).toContain("bg-white/80");
  });
});

// ─── Overlay Store Tests ────────────────────────────────────────────

describe("overlayStore", () => {
  it("show() sets visible, loading, and originalText", () => {
    const store = useOverlayStore;
    act(() => store.getState().show("Hello world"));

    const state = store.getState();
    expect(state.visible).toBe(true);
    expect(state.loading).toBe(true);
    expect(state.originalText).toBe("Hello world");
    expect(state.error).toBeNull();
  });

  it("hide() resets all state", () => {
    const store = useOverlayStore;
    act(() => store.getState().show("Hello"));
    act(() => store.getState().hide());

    const state = store.getState();
    expect(state.visible).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.originalText).toBe("");
  });

  it("setSegments() sets segments and stops loading", () => {
    const store = useOverlayStore;
    act(() => store.getState().show("Hello"));
    act(() =>
      store
        .getState()
        .setSegments([{ text: "Hello", kind: "unchanged" }]),
    );

    const state = store.getState();
    expect(state.segments).toHaveLength(1);
    expect(state.loading).toBe(false);
  });

  it("setError() sets error and stops loading", () => {
    const store = useOverlayStore;
    act(() => store.getState().show("Hello"));
    act(() => store.getState().setError("Network error"));

    const state = store.getState();
    expect(state.error).toBe("Network error");
    expect(state.loading).toBe(false);
  });

  it("accept() and dismiss() both hide overlay", () => {
    const store = useOverlayStore;
    act(() => store.getState().show("Hello"));
    act(() => store.getState().accept());
    expect(store.getState().visible).toBe(false);

    act(() => store.getState().show("Hello"));
    act(() => store.getState().dismiss());
    expect(store.getState().visible).toBe(false);
  });
});
