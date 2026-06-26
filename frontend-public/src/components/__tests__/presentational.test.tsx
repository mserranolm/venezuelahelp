import { render, screen } from "@testing-library/react";
import Badge from "@/components/Badge";
import Header from "@/components/Header";

const TELEGRAM_URL = "https://t.me/VenezuelaHelpInfoBot";

// --------------- Badge ---------------

describe("Badge", () => {
  it("renders the label for 'reportes'", () => {
    render(<Badge category="reportes" />);
    expect(screen.getByText("Reportes")).toBeInTheDocument();
  });

  it("renders the label for 'desaparecidos'", () => {
    render(<Badge category="desaparecidos" />);
    expect(screen.getByText("Desaparecidos")).toBeInTheDocument();
  });

  it("renders the label for 'edificios'", () => {
    render(<Badge category="edificios" />);
    expect(screen.getByText("Edificios dañados")).toBeInTheDocument();
  });
});

// --------------- Header ---------------

describe("Header", () => {
  it("renders the wordmark 'VenezuelaHelp'", () => {
    render(<Header />);
    expect(
      screen.getByRole("link", { name: /Venezuela\s*Help/i }),
    ).toBeInTheDocument();
  });

  it("renders a link to the Telegram bot with accessible name containing 'telegram'", () => {
    render(<Header />);
    const link = screen.getByRole("link", { name: /telegram/i });
    expect(link).toHaveAttribute("href", TELEGRAM_URL);
  });

  it("Telegram link opens in a new tab safely", () => {
    render(<Header />);
    const link = screen.getByRole("link", { name: /telegram/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
