import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubmitButton } from "./SubmitButton";

describe("SubmitButton", () => {
  it("is enabled and shows its label by default", () => {
    render(<SubmitButton>Crea proposta</SubmitButton>);
    expect(screen.getByRole("button", { name: "Crea proposta" })).toBeEnabled();
  });

  it("is disabled while pending", () => {
    render(<SubmitButton pending>Crea proposta</SubmitButton>);
    expect(screen.getByRole("button", { name: "Crea proposta" })).toBeDisabled();
  });
});
