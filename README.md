<p align="center">
  <img src="assets/truthdraft-mark.svg" alt="TruthDraft" width="76" height="76">
</p>

<h1 align="center">TruthDraft IEEE A4 Paper Formatter</h1>

<p align="center">
  Turn structured IEEE paper JSON into a two-column A4 preview and an editable Word document.
  <br>
  <a href="https://truthdraft.com/formatter"><strong>Open the formatter »</strong></a>
</p>

<p align="center">
  <a href="https://github.com/truthdraft/paper-formatter"><img src="https://img.shields.io/badge/TruthDraft-Paper%20Tools-1C2B3A?style=for-the-badge" alt="TruthDraft Paper Tools"></a>
  <img src="https://img.shields.io/badge/Page%20size-A4-BD5B3A?style=for-the-badge" alt="A4 page size">
  <img src="https://img.shields.io/badge/Format-IEEE%20Conference-9E4B2C?style=for-the-badge" alt="IEEE conference format">
</p>

---

## Contents

- [About the project](#about-the-project)
- [Features](#features)
- [Getting started](#getting-started)
- [How to use it](#how-to-use-it)
- [Paper JSON](#paper-json)
- [Privacy and limitations](#privacy-and-limitations)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## About the project

**TruthDraft IEEE A4 Paper Formatter** is a browser-based tool for researchers preparing IEEE-style conference papers. Give an AI assistant the included JSON format and your manuscript; paste its completed JSON into the formatter to review the paper beside the input and export it as DOCX.

The page size is **A4 (210 × 297 mm)**. The formatter does not convert US Letter pages.

## Features

- Two-column IEEE conference paper preview on an A4 page
- JSON template with AI instructions in a `$comment` field
- Paper sections with paragraphs, equations, figures, and tables
- Author names, affiliations, emails, and ORCID fields
- Abstract, Index Terms, funding, acknowledgment, and references
- JSON validation and review notes for common paper issues
- Editable DOCX download and print-to-PDF through the browser
- Browser-local editing; manuscript content is not sent to a server by this app
- No third-party runtime packages or build step

## Getting started

### Requirements

- Node.js 18 or newer

### Run locally

```sh
git clone https://github.com/truthdraft/paper-formatter.git
cd paper-formatter
npm start
```

Open [http://localhost:4173](http://localhost:4173). No `npm install` step is needed.

## How to use it

1. Select **Download** to get [`ieee-a4-format.json`](ieee-a4-format.json), or use **Copy** or **Load into editor** in the formatter.
2. Add the manuscript to `sourceContent` and share the JSON, paper content, and any conference-specific instructions with ChatGPT, Gemini, or another AI assistant.
3. Ask the assistant to return a complete JSON object that follows the template. The `$comment` field contains instructions for the assistant; it is not rendered in the paper.
4. Paste the completed JSON into the formatter and select **Compile paper**.
5. Review the A4 preview and any validation notes. Download the DOCX or print the paper when it is ready.

## Paper JSON

The template describes page settings, title, authors and affiliations, abstract, Index Terms, ordered sections, acknowledgment, funding, and references. Sections can include structured equations, figures, and tables; figures may embed PNG or JPEG data URIs. Optional fields are documented in [`ieee-a4-format.json`](ieee-a4-format.json).

The compiler checks JSON syntax and required paper fields before rendering. It also flags selected items for review, such as an abstract over 250 words, an unusual Index Terms count, missing references, and citations without a matching reference entry. These checks are aids for review, not a conference submission validator.

## Privacy and limitations

Paper JSON is processed in the browser. The app saves the current draft in browser local storage so it can be restored on the same device. Clearing browser storage removes that saved draft. Do not use a shared device if you do not want the paper retained in its local browser storage.

The preview and page estimate are approximations. IEEE templates and conference rules can vary, so compare the exported document with the current instructions for your target conference before submitting it.

## Development

Start the local server:

```sh
npm start
```

Run the test suite:

```sh
npm test
```

Tests use Node's built-in test runner and cover JSON compilation, metadata omission, structured paper content, A4 DOCX generation, and local HTTP serving.

## Contributing

Issues and pull requests are welcome. Please include a clear description of the change and steps to reproduce any bug. For layout changes, include the JSON input and a screenshot of the expected and actual output when possible.

## License

No license has been added to this repository yet. Until a license is chosen and included, reuse and redistribution are not granted by this project.

## Acknowledgments

- [IEEE Author Center: Structure Your Paper](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/structure-your-paper/)
- [IEEE Author Center: Authoring Tools and Templates](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/authoring-tools-and-templates/)
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) for the README structure inspiration

<p align="center"><a href="#truthdraft-ieee-a4-paper-formatter">Back to top ↑</a></p>
