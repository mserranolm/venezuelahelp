import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";
import { SourcesContext } from "@/data/sources";
import type { SourceInfo } from "@/types";

const dir: Record<string, SourceInfo> = {
  a: { nombre: "Fuente A", url: "https://fuentea.com/" },
};

describe("Footer", () => {
  it("muestra el intervalo de centralización y delega la lista en SourceGrid", () => {
    render(
      <SourcesContext.Provider value={dir}>
        <Footer
          sources={[{ sourceId: "a", count: 10, cats: ["reportes"] }]}
          generatedAt="2026-07-01T01:17:46.000Z"
        />
      </SourcesContext.Provider>,
    );
    expect(screen.getByText(/cada ~30 min/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Fuente A/ });
    expect(link).toHaveAttribute("href", "https://fuentea.com/");
    expect(screen.getByText("https://fuentea.com/")).toBeInTheDocument();
  });
});
