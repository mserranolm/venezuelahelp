import { render, screen } from "@testing-library/react";
import ApiDocsPage from "@/components/ApiDocsPage";

describe("ApiDocsPage", () => {
  it("renders the docs heading", () => {
    render(<ApiDocsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /documentaci[oó]n.*api/i }),
    ).toBeInTheDocument();
  });

  it("documents the four GET endpoints", () => {
    render(<ApiDocsPage />);
    expect(screen.getByText("/v1/items")).toBeInTheDocument();
    expect(screen.getByText("/v1/categories")).toBeInTheDocument();
    expect(screen.getByText("/v1/sources")).toBeInTheDocument();
    expect(screen.getByText("/v1/meta")).toBeInTheDocument();
  });

  it("documents the x-api-key authentication header", () => {
    render(<ApiDocsPage />);
    expect(screen.getAllByText(/x-api-key/i).length).toBeGreaterThan(0);
  });

  it("documents the query params of /v1/items", () => {
    render(<ApiDocsPage />);
    for (const p of ["category", "q", "near", "radiusKm", "limit", "cursor"]) {
      expect(screen.getAllByText(new RegExp(p)).length).toBeGreaterThan(0);
    }
  });

  it("shows the base URL and a curl example", () => {
    render(<ApiDocsPage />);
    expect(
      screen.getAllByText(/api\.venezuelahelp\.click/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/curl/).length).toBeGreaterThan(0);
  });

  it("links to the access request page", () => {
    render(<ApiDocsPage />);
    const link = screen.getByRole("link", { name: /solicitar acceso/i });
    expect(link).toHaveAttribute("href", "#/api");
  });
});
