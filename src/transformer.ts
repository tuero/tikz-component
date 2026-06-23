import type { Element, Properties, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import { h } from "hastscript";
import type { Code, Root } from "mdast";
import { dvi2svg, load, tex } from "node-tikzjax";
import { visit } from "unist-util-visit";
import type { QuartzTransformerPlugin } from "@quartz-community/types";
import type { TikzOptions } from "./types";

const TIKZ_TIMEOUT = 30_000;

async function tex2svg(
  input: string,
  opts: { showConsole: boolean; disableSanitize: boolean; disableOptimize: boolean },
): Promise<string> {
  await load();
  const dvi = await tex(input, {
    texPackages: { pgfplots: "", amsmath: "intlimits" },
    tikzLibraries: "arrows.meta,calc,positioning",
    addToPreamble: "% comment",
    showConsole: opts.showConsole,
  });

  return dvi2svg(dvi, {
    disableSanitize: opts.disableSanitize,
    disableOptimize: opts.disableOptimize,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`tikz: ${label} timed out after ${ms}ms`)), ms);
      timer.unref();
    }),
  ]);
}

interface TikzNode {
  index: number;
  value: string;
  parent: Root;
  base64?: string;
  disableSanitize: boolean;
}

function parseStyle(meta: string | null | undefined): string {
  if (!meta) {
    return "";
  }

  const styleMatch = meta.match(/style\s*=\s*["']([^"']+)["']/);
  return styleMatch?.[1] ?? "";
}

function docs(node: Code): string {
  return JSON.stringify(node.value);
}

function closeDanglingSvgTags(svg: string): string {
  const stack: string[] = [];
  const tags = svg.matchAll(/<\/?([A-Za-z][\w:.-]*)(?:\s[^<>]*)?>/g);

  for (const tag of tags) {
    const source = tag[0];
    const name = tag[1];
    if (!name) {
      continue;
    }

    if (source.startsWith("</")) {
      for (let i = stack.length - 1; i >= 0; i--) {
        const open = stack.pop();
        if (open === name) {
          break;
        }
      }
    } else if (!source.endsWith("/>")) {
      stack.push(name);
    }
  }

  return `${svg}${stack
    .reverse()
    .map((name) => `</${name}>`)
    .join("")}`;
}

function prepareSvgForImage(svg: string): string {
  return closeDanglingSvgTags(svg);
}

function makeTikzGraph(node: Code, svg: string, style?: string): Element {
  const mathMl = h(
    "span.tikz-mathml",
    { hidden: true, ariaHidden: "true" },
    h(
      "math",
      { xmlns: "http://www.w3.org/1998/Math/MathML" },
      h(
        "semantics",
        h("annotation", { encoding: "application/x-tex" }, { type: "text", value: docs(node) }),
      ),
    ),
  );

  const properties: Properties = { "data-remark-tikz": true, style: "" };
  if (style) {
    properties.style = style;
  }

  const svgNode = {
    type: "raw",
    value: `<div class="tikz-svg">${prepareSvgForImage(svg)}</div>`,
  } as unknown as RootContent;

  return h("figure.tikz", properties, [mathMl, svgNode]) as Element;
}

const defaultOptions: Required<TikzOptions> = {
  showConsole: false,
  disableOptimize: true,
};

export const TikzJax: QuartzTransformerPlugin<TikzOptions> = (opts?: TikzOptions) => {
  const options = { ...defaultOptions, ...opts };
  return {
    name: "TikzJax",
    markdownPlugins() {
      return [
        () => async (tree: Root) => {
          const nodes: TikzNode[] = [];

          visit(tree, "code", (node: Code, index, parent) => {
            if (node.lang !== "tikz" || index === undefined || !parent) {
              return;
            }

            const base64Match = node.meta?.match(/alt\s*=\s*"data:image\/svg\+xml;base64,([^"]+)"/);
            const encodedSvg = base64Match?.[1];
            const base64String = encodedSvg ? Buffer.from(encodedSvg, "base64").toString() : undefined;

            nodes.push({
              index,
              parent: parent as Root,
              value: node.value,
              base64: base64String,
              disableSanitize: /disableSanitize\s*=\s*true/.test(node.meta ?? ""),
            });
          });

          for (let i = 0; i < nodes.length; i++) {
            const tikzNode = nodes[i];
            if (!tikzNode) {
              continue;
            }

            const { index, parent, value, base64, disableSanitize } = tikzNode;

            let svg = base64;
            if (svg === undefined) {
              try {
                svg = await withTimeout(
                  tex2svg(value, { disableSanitize, ...options }),
                  TIKZ_TIMEOUT,
                  `node ${i + 1}/${nodes.length}`,
                );
              } catch (error) {
                console.warn(`[tikz] skipping node ${i + 1}: ${error}`);
                continue;
              }
            }

            const node = parent.children[index] as Code;
            parent.children.splice(index, 1, {
              type: "html",
              value: toHtml(makeTikzGraph(node, svg, parseStyle(node.meta)), {
                allowDangerousHtml: true,
              }),
            });
          }
        },
      ];
    },
    externalResources() {
      return {
        css: [
          { content: "https://cdn.jsdelivr.net/npm/node-tikzjax@latest/css/fonts.css" },
          {
            content: `figure.tikz {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 0;
  margin-right: 0;
}

figure.tikz .tikz-svg {
  max-width: 100%;
  display: flex;
  justify-content: center;
}

figure.tikz .tikz-svg svg {
  zoom: 2;
}

figure.tikz .tikz-svg svg text {
  fill: inherit;
}

:root[saved-theme="dark"] figure.tikz .tikz-svg svg {
  color: var(--darkgray);
}

:root[saved-theme="dark"] figure.tikz .tikz-svg svg [stroke="black"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [stroke="#000"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [stroke="#000000"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [stroke="rgb(0,0,0)"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [stroke="rgba(0,0,0,1)"] {
  stroke: currentColor;
}

:root[saved-theme="dark"] figure.tikz .tikz-svg svg [fill="black"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [fill="#000"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [fill="#000000"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [fill="rgb(0,0,0)"],
:root[saved-theme="dark"] figure.tikz .tikz-svg svg [fill="rgba(0,0,0,1)"] {
  fill: currentColor;
}

@media (max-width: 800px) {
  figure.tikz {
    width: 100%;
  }

  figure.tikz .tikz-svg {
    width: 100%;
  }

  figure.tikz .tikz-svg svg {
    zoom: 1;
    width: auto;
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
  }
}`,
            inline: true,
          },
        ],
        js: [],
        additionalHead: [],
      };
    },
  };
};
