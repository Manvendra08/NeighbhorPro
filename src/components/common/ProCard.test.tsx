import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProCard from "./ProCard";

const basePro = {
  uid: "pro-1",
  displayName: "Rahul Sharma",
  residentVerificationStatus: "verified",
  society: "Green Meadows",
  locality: "Pune",
  skills: ["Electrician", "Repairs"],
};

describe("ProCard", () => {
  it("shows verified resident tooltip text exactly and supports tap/click", async () => {
    const user = userEvent.setup();
    render(
      <ProCard
        pro={basePro}
        onBook={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Verified resident proof" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "This professional has uploaded a valid society residency proof verified by ProNeighbor.",
    );
  });

  it("never shows 0 (0) when reviews exist but rating is stale/zero", () => {
    render(
      <ProCard
        pro={{ ...basePro, rating: 0, reviewCount: 3 }}
        onBook={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );

    expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    expect(screen.queryByText("★ 0.0")).not.toBeInTheDocument();
  });

  it("shows No reviews yet when there are no reviews", () => {
    render(
      <ProCard
        pro={{ ...basePro, residentVerificationStatus: "none", rating: 0, reviewCount: 0 }}
        onBook={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );

    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("shows society first and hides fee details in list view", () => {
    render(
      <ProCard
        pro={{ ...basePro, priceAfterQuote: true, hourlyRate: 250 }}
        onBook={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );

    expect(screen.getByText(/Green Meadows/)).toBeInTheDocument();
    expect(screen.queryByText(/Pune/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Free|Quote-based|₹250\/hr/)).not.toBeInTheDocument();
  });

  it("renders mobile variant with same rating fallback behavior", () => {
    render(
      <ProCard
        pro={{ ...basePro, rating: 0, reviewCount: 1 }}
        mobile
        onBook={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );

    expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
  });
});
