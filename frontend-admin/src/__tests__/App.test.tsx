import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  it("renders the admin heading", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /VenezuelaHelp Admin/i }),
    ).toBeInTheDocument();
  });
});
