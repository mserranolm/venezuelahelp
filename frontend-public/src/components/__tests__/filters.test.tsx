import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterBar from "@/components/FilterBar";
import SummaryBar from "@/components/SummaryBar";
import { CATEGORY_META, CATEGORY_ORDER } from "@/data/categories";
import type { Category } from "@/types";

const counts: Record<Category, number> = {
  reportes: 10,
  desaparecidos: 5,
  acopios: 8,
  edificios: 3,
  solicitudes: 7,
};

// --------------- FilterBar ---------------

describe("FilterBar", () => {
  it("renders a search input with aria-label 'Buscar'", () => {
    render(
      <FilterBar
        query=""
        onQuery={() => {}}
        active={new Set()}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByRole("searchbox", { name: "Buscar" }),
    ).toBeInTheDocument();
  });

  it("calls onQuery when the user types in the search input", async () => {
    const onQuery = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterBar
        query=""
        onQuery={onQuery}
        active={new Set()}
        onToggle={() => {}}
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Buscar" });
    await user.type(input, "r");
    expect(onQuery).toHaveBeenCalledWith("r");
  });

  it("renders a chip button for every category in CATEGORY_ORDER", () => {
    render(
      <FilterBar
        query=""
        onQuery={() => {}}
        active={new Set()}
        onToggle={() => {}}
      />,
    );
    for (const cat of CATEGORY_ORDER) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(CATEGORY_META[cat].label, "i"),
        }),
      ).toBeInTheDocument();
    }
  });

  it("clicking a category chip calls onToggle with that category", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterBar
        query=""
        onQuery={() => {}}
        active={new Set()}
        onToggle={onToggle}
      />,
    );
    const btn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["reportes"].label, "i"),
    });
    await user.click(btn);
    expect(onToggle).toHaveBeenCalledWith("reportes");
  });

  it("inactive chip has aria-pressed='false'", () => {
    render(
      <FilterBar
        query=""
        onQuery={() => {}}
        active={new Set()}
        onToggle={() => {}}
      />,
    );
    const btn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["reportes"].label, "i"),
    });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("active chip has aria-pressed='true'", () => {
    render(
      <FilterBar
        query=""
        onQuery={() => {}}
        active={new Set<Category>(["reportes"])}
        onToggle={() => {}}
      />,
    );
    const btn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["reportes"].label, "i"),
    });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});

// --------------- SummaryBar ---------------

describe("SummaryBar", () => {
  it("renders a button for every category showing its label", () => {
    render(
      <SummaryBar counts={counts} active={new Set()} onToggle={() => {}} />,
    );
    for (const cat of CATEGORY_ORDER) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(CATEGORY_META[cat].label, "i"),
        }),
      ).toBeInTheDocument();
    }
  });

  it("each category button shows its count", () => {
    render(
      <SummaryBar counts={counts} active={new Set()} onToggle={() => {}} />,
    );
    const reportesBtn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["reportes"].label, "i"),
    });
    expect(reportesBtn).toHaveTextContent("10");
  });

  it("clicking a category entry calls onToggle with that category", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <SummaryBar counts={counts} active={new Set()} onToggle={onToggle} />,
    );
    const btn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["acopios"].label, "i"),
    });
    await user.click(btn);
    expect(onToggle).toHaveBeenCalledWith("acopios");
  });

  it("inactive entry has aria-pressed='false'", () => {
    render(
      <SummaryBar counts={counts} active={new Set()} onToggle={() => {}} />,
    );
    const btn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["desaparecidos"].label, "i"),
    });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("active entry has aria-pressed='true'", () => {
    render(
      <SummaryBar
        counts={counts}
        active={new Set<Category>(["desaparecidos"])}
        onToggle={() => {}}
      />,
    );
    const btn = screen.getByRole("button", {
      name: new RegExp(CATEGORY_META["desaparecidos"].label, "i"),
    });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
