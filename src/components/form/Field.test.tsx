import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./Field";

describe("Field", () => {
  it("renders a single-line input by default, associated to its label", () => {
    render(<Field label="Titolo" name="title" required />);
    const input = screen.getByLabelText("Titolo");
    expect(input.tagName).toBe("INPUT");
    expect(input).toBeRequired();
  });

  it("renders a textarea when multiline", () => {
    render(<Field label="Descrizione" name="description" multiline />);
    const control = screen.getByLabelText("Descrizione");
    expect(control.tagName).toBe("TEXTAREA");
    expect(control).not.toBeRequired();
  });
});
