# TikZJax

Quartz v5 transformer plugin that renders `tikz` code blocks to inline SVG using `node-tikzjax`.

## Install

```bash
npx quartz plugin add github:tuero/tikz-component
```

## Usage

Add it to `quartz.config.yaml`:

```yaml
plugins:
  - source: github:tuero/tikz-component
    enabled: true
    options:
      showConsole: false
      disableOptimize: true
```

## Options

| Option | Type | Default |
| --- | --- | --- |
| `showConsole` | `boolean` | `false` |
| `disableOptimize` | `boolean` | `true` |

## Notes

- Supports embedded pre-rendered SVG via code fence metadata like `alt="data:image/svg+xml;base64,..."`.
- Supports inline figure styling via code fence metadata like `style="max-width: 20rem"`.
- Includes the dark-mode stroke/fill overrides from the v4 implementation so black TikZ output adapts correctly in Quartz dark theme.
