import { render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

// A composed button (asChild) is cloned by Radix Slot, which accepts exactly
// one child. The loading spinner node used to be injected there and crashed
// every page that links through a Button (e.g. the library game page).
describe("Button asChild", () => {
  it("renders the child link with its own href", () => {
    render(
      <MemoryRouter>
        <Button asChild>
          <Link to="/jogo/abc#prints-comunidade">Ver prints da comunidade</Link>
        </Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Ver prints da comunidade" });
    expect(link.getAttribute("href")).toBe("/jogo/abc#prints-comunidade");
    expect(link.className).toContain("inline-flex");
  });

  it("never puts the spinner or a disabled attribute on the child link", () => {
    const { container } = render(
      <MemoryRouter>
        <Button asChild isLoading disabled>
          <Link to="/jogo/abc">Ver prints da comunidade</Link>
        </Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Ver prints da comunidade" });
    expect(link.hasAttribute("disabled")).toBe(false);
    expect(container.querySelector("svg.lucide-loader-circle")).toBeNull();
  });

  it("still shows the spinner and disables a regular button while loading", () => {
    const { container } = render(<Button isLoading>Salvar</Button>);

    expect(container.querySelector("svg.lucide-loader-circle")).not.toBeNull();
    expect(container.querySelector("button")).toBeDisabled();
  });
});
