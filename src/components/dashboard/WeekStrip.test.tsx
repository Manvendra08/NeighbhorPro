import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import WeekStrip from "./WeekStrip";

describe("WeekStrip", () => {
  it("shows actionable empty state when no upcoming bookings", () => {
    render(
      <MemoryRouter>
        <WeekStrip bookings={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nothing booked this week\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Professionals →" })).toHaveAttribute("href", "/browse");
  });
});
