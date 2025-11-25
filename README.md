# ChatGPT Apps UI Template Gallery

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

This repository contains ready-to-use UI template to run an own ChatGPT app. It contains the following useful data:
1. React template of the ChatGPT app
2. Utils to interact with window.openai
3. Examples of all required MCP requests and responses.

## Requirements

You have to run own [MCP server](https://modelcontextprotocol.io/specification/2025-06-18), which supports the following methods:

1. **initialize** – description of your server, with capabilities. Set `{ "scope": "project", "modes": ["chat"] }`
2. **notifications/initialized** – just response with http code = 200
3. **tools/list** – declare your tools, with detailed "inputSchema" and "outputSchema". Set `{"_meta": {"openai/widgetAccessible": true}}` for all tools, and `{"_meta": {"openai/outputTemplate": "ui://widget/my_app.html"}}` for the main tool.
1. **tools/call** – process a tool call. All data for UI should be sent in `{"structuredContent": {...}}`
2. **resources/list** – declare your app. Set `{ "uri": "ui://widget/my_app.html", "mimeType": "text/html+skybridge" }`
3. **resources/templates/list** – the same as in resource/list
4. **resources/read** - response with a simple HTML which loads .css and .js file from your resource. Declare all your domains with static data (js, images, etc) in `{"_meta": {"openai/widgetCSP": {"resource_domains": [...]}}}`

Examples on requests and responses are in `mcp_request/`


## Repository structure

- `src/` – Template source, with utils to manage window.openai
- `mcp_request/` – Examples of requests and responses for MCP server
- `build-all.mts` – Vite build orchestrator that produces hashed bundles for every widget entrypoint.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn

## Install dependencies

Clone the repository and install the workspace dependencies:

```bash
pnpm install
```

## Setup the environment

- `build_all.mts` – set correct "base" value in createConfig(). Assign it to your server with .js & .css files
- `src/index.jsx` – set your app name in `getElementById("<your-app-name>")`

## Build code

Add any business-logic in src/app.jsx and any additional files.

## Build the components gallery

The components are bundled into standalone assets appbuild/main.js and appbuild/main.css.

```bash
pnpm run build
```

Copy main.js and main.css to your server with **public https:// access**.


## Run app in ChatGPT

1. Enable [developer mode](https://platform.openai.com/docs/guides/developer-mode)
2. Add your app in Settings > Connectors: specify name of your app and endpoint to your MCP server
3. Create a new Project, and add the app via "+" button.

## Next steps

- Create your own components and add them to the gallery: drop new entries into `src/` and they will be picked up automatically by the build script.
- Expand business-logic on MCP server


## Useful functions in src/openai_utils.jsx
1. `useOpenAiGlobal (<key name>)` - read any key from window.openai.globals. Supported keys:
```
 theme: dark | light
 userAgent: { "device': "mobile" | "tablet" | "desktop" }
 locale: <5-letters>
 maxHeight: number
 displayMode: "pip" | "inline" | "fullscreen"
 safeArea: SafeArea
 toolInput: {}
 toolOutput: {}
 toolResponseMetadata: {}
 widgetState: {}
```
2. `setOpenAiGlobal (<key name>, <value>)` - update any key in window.openai.globals.
3. `callTool (<tool name>, <json params>)` - run an MCP tool, and store response in globals.toolOutput
4. `sendMessage(<message>)` - send a message to chatGPT chatbot
5. `setDisplayMode("pip" | "inline" | "fullscreen")`
6. `openExternalURL(<url>)` - open an external URL in a new tab

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
