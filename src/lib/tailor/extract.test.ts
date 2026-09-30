import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { extractOutline } from "./extract";
import type { Block, BlockKind, Layout, Outline } from "./types";

const block = (id: string, kind: BlockKind, text: string, section: string | null = null): Block => ({
  id,
  kind,
  text,
  section,
  style: null,
  lines: 1,
  has_bold: false,
  runs: [{ text, bold: false, italic: false, size: null, color: null }],
  size: 11,
  space_before: 0,
});

const layout = (): Layout => ({
  format: "pdf",
  pages: 1,
  fonts: [],
  warnings: [],
  blocks: [
    block("0", "name", "Jami Yashwanth"),
    block("1", "contact", "jami@example.com | Hyderabad"),
    block("2", "heading", "EXPERIENCE"),
    block("3", "role", "Google\tJun 2022 – Present", "EXPERIENCE"),
    block("4", "role", "Software Engineer", "EXPERIENCE"),
    block("5", "heading", "Built the search backend.", "EXPERIENCE"),
    block("6", "heading", "EDUCATION"),
    block("7", "role", "Vignan's Institute", "EDUCATION"),
    block("8", "heading", "CGPA: 8.38"),
    block("9", "bullet", "• Deployed on AWS.", "EDUCATION"),
  ],
});

const ref = (block: string, text: string) => ({ block, text });
const good = (): Outline => ({
  name: "0",
  contact: ["1"],
  sections: [
    {
      heading: "2",
      kind: "experience",
      entries: [
        {
          org: ref("3", "Google"),
          title: ref("4", "Software Engineer"),
          dates: ref("3", "Jun 2022 – Present"),
          place: null,
          bullets: [],
          lines: ["5"],
        },
      ],
      skills: [],
      lines: [],
    },
    {
      heading: "6",
      kind: "education",
      entries: [
        { org: ref("7", "Vignan's Institute"), title: null, dates: null, place: null, bullets: ["9"], lines: ["8"] },
      ],
      skills: [],
      lines: [],
    },
  ],
});
const withoutBlock8 = (): Outline => {
  const o = good();
  o.sections[1].entries[0].lines = [];
  return o;
};

const reply = (input: unknown, id = "t1") => ({
  content: [{ type: "tool_use", id, name: "extract_outline", input }],
  stop_reason: "tool_use",
  usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0 },
});

function fakeClient(...responses: unknown[]) {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

describe("extractOutline", () => {
  it("applies a verified outline and relabels the layout", async () => {
    const { client, create } = fakeClient(reply(good()));
    const result = await extractOutline(client, layout());
    expect(result.source).toBe("claude");
    expect(result.attempts).toBe(1);
    expect(result.layout.blocks.find((b) => b.id === "5")!.kind).toBe("paragraph");
    expect(result.layout.blocks.find((b) => b.id === "9")!.kind).toBe("bullet");
    expect(result.outline!.sections[0].entries[0].dates!.text).toBe("Jun 2022 – Present");
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: "auto" });
  });

  it("relabels a header line as role", async () => {
    const { client } = fakeClient(reply(good()));
    const result = await extractOutline(client, layout());
    expect(result.layout.blocks.find((b) => b.id === "4")!.kind).toBe("role");
  });

  it("retries once with the missing ids and accepts the second answer", async () => {
    const { client, create } = fakeClient(reply(withoutBlock8(), "t1"), reply(good(), "t2"));
    const result = await extractOutline(client, layout());
    expect(result.attempts).toBe(2);
    expect(result.source).toBe("claude");
    const messages = create.mock.calls[1][0].messages;
    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content[0].type).toBe("tool_result");
    expect(last.content[0].tool_use_id).toBe("t1");
    expect(last.content[0].content).toContain("Missing: 8");
    expect(messages[1].role).toBe("assistant");
  });

  it("keeps the parser's labels after two rejections", async () => {
    const { client } = fakeClient(reply(withoutBlock8()), reply(withoutBlock8()));
    const result = await extractOutline(client, layout());
    expect(result.source).toBe("parser");
    expect(result.outline).toBeNull();
    expect(result.attempts).toBe(2);
    expect(result.layout).toEqual(layout());
    expect(result.usage.input).toBe(2400);
  });

  it("treats an answer that does not match the schema as a rejection and retries", async () => {
    const { client, create } = fakeClient(reply({ nope: true }), reply(good(), "t2"));
    const result = await extractOutline(client, layout());
    expect(result.source).toBe("claude");
    const last = create.mock.calls[1][0].messages.at(-1);
    expect(last.content[0].content).toContain("answer did not match the schema");
    expect(last.content[0].content).toContain("Missing: none");
  });

  it("keeps the parser's labels when Claude declines or answers in prose", async () => {
    const refused = await extractOutline(
      fakeClient({ content: [], stop_reason: "refusal", usage: { input_tokens: 5, output_tokens: 1 } }).client,
      layout(),
    );
    expect(refused.source).toBe("parser");
    expect(refused.layout).toEqual(layout());
    const prose = await extractOutline(
      fakeClient({ content: [{ type: "text", text: "Sure!" }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 1 } }).client,
      layout(),
    );
    expect(prose.source).toBe("parser");
  });

  it("keeps the parser's labels when the call fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("overloaded"));
    const result = await extractOutline({ messages: { create } } as unknown as Anthropic, layout());
    expect(result.source).toBe("parser");
    expect(result.outline).toBeNull();
  });

  it("makes no call for an empty layout", async () => {
    const { client, create } = fakeClient();
    const result = await extractOutline(client, { ...layout(), blocks: [] });
    expect(result.attempts).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
