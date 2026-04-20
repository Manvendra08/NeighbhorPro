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

  it("does not show empty state for open booking in current week", () => {
    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    render(
      <MemoryRouter>
        <WeekStrip
          bookings={[
            {
              id: "b1",
              status: "confirmed",
              date: `${yyyy}-${mm}-${dd}`,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Nothing booked this week\./)).not.toBeInTheDocument();
  });
});
