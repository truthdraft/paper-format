# TruthDraft IEEE A4 Paper Formatter

A client-side paper formatter for compiling IEEE conference paper JSON into a two-column A4 preview and an editable Word document. It runs locally in your browser; paper content is not uploaded by this app.

## Run locally

Requires Node.js 18 or newer. No package installation or build step is needed.

```sh
npm start
```

Open <http://localhost:4173>. Download `ieee-a4-format.json`, add your paper content to `sourceContent`, and give the JSON plus your paper and formatting instructions to an AI assistant. The template's `$comment` field contains directions for the assistant and is excluded from the rendered paper. Ask it to return the completed JSON object, paste that response into the editor, and select **Compile paper**. Review the preview before downloading a DOCX or printing.

## Format support

The template describes A4 page dimensions, paper title, authors and affiliations, abstract, Index Terms, sections, acknowledgment, funding, and references. Sections support paragraphs and structured equation, figure, and table blocks. Embedded figure images can use PNG or JPEG base64 data URIs. The compiler checks JSON syntax and required fields, then reports common review notes such as an overlong abstract or citations without reference entries.

The renderer follows the IEEE conference template structure and uses A4 (210 × 297 mm). IEEE and conference-specific submission requirements can differ; review the output against the target conference's current instructions before submission. The on-screen page estimate is approximate.

## Development

```sh
npm test
```

The tests cover template metadata omission, structured paper content, A4 DOCX generation, and local HTTP serving. The project uses browser-native JavaScript modules and Node's built-in test runner; it has no third-party runtime dependencies.

## References

- [IEEE Author Center: Structure Your Paper](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/structure-your-paper/)
- [IEEE Author Center: Authoring Tools and Templates](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/authoring-tools-and-templates/)
