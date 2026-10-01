import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RequirementRow } from "@/lib/tailor/requirement-rows";
import { SummaryPanel } from "./SummaryPanel";

const row = (over: Partial<RequirementRow> = {}): RequirementRow => ({
  requirement: { id: "r1", label: "Kafka", wording: "Kafka", kind: "skill", importance: "must", knockout: false },
  group: "covered", added: false, pointsTo: ["b6"], reason: null, opId: null, ...over,
});

describe("SummaryPanel", () => {
  it("shows the edited-evidence note under a row the user retyped", () => {
    const html = renderToStaticMarkup(
      <SummaryPanel
        rows={[row({ group: "to_decide", opId: "d1", editedNote: "You edited this line; tailor again to re-check" })]}
        coverage={{ covered: 1, total: 1, originalCovered: 1 }}
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("You edited this line; tailor again to re-check");
  });
});
