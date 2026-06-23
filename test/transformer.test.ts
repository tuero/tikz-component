import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import { TikzJax } from "../src/transformer";
import { createCtx } from "./helpers";

describe("TikzJax", () => {
  it("renders tikz blocks from base64-encoded SVG metadata", async () => {
    const ctx = createCtx();
    const transformer = TikzJax();
    const plugins = transformer.markdownPlugins?.(ctx) ?? [];
    const plugin = plugins[0] as () => (tree: Root) => Promise<void>;
    const svg = '<svg viewBox="0 0 10 10"><text fill="black">tikz</text></svg>';
    const encodedSvg = Buffer.from(svg).toString("base64");

    const tree: Root = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "tikz",
          meta: `alt="data:image/svg+xml;base64,${encodedSvg}" style="max-width: 12rem"`,
          value: "\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}",
        },
      ],
    };

    await plugin()(tree);

    const htmlNode = tree.children[0];
    expect(htmlNode?.type).toBe("html");
    if (htmlNode?.type !== "html") {
      throw new Error("Expected html node");
    }

    expect(htmlNode.value).toContain('class="tikz"');
    expect(htmlNode.value).toContain('class="tikz-svg"');
    expect(htmlNode.value).toContain('style="max-width: 12rem"');
    expect(htmlNode.value).toContain(svg);
    expect(htmlNode.value).toContain("tikz-mathml");
  });

  it("injects fonts and dark-mode tikz styling", () => {
    const resources = TikzJax().externalResources?.(createCtx());
    expect(resources?.css).toHaveLength(2);
    expect(resources?.css?.[0]?.content).toContain("node-tikzjax");
    expect(resources?.css?.[1]?.content).toContain(':root[saved-theme="dark"]');
    expect(resources?.css?.[1]?.content).toContain('stroke="black"');
  });
});
