import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button label="Submit" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses the secondary variant when requested", () => {
    render(<Button label="Cancel" variant="secondary" onClick={() => undefined} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("btn-secondary");
  });
});
