# StudyMind — AI Study Assistant

An AI-powered study tool that helps students understand complex material
through explanations, summaries, and follow-up conversation.

Originally built at **CatHacks 2026**. Significantly expanded post-hackathon.

🔗 **[Live Demo](https://salas-son-programming.github.io/AI-STUDENT-ASSISTANT/)**
📋 **[Hackathon Submission](https://devpost.com/software/ai-student-assistant-0iogqe)**

## What it does

- **Explain** — breaks down any concept or passage in plain language
- **Summarize** — extracts the key points concisely
- **Key Concepts** — identifies and defines the core terms
- **PDF Upload** — drag-and-drop any PDF and analyze it directly
- **Follow-up Chat** — ask questions about the result in context
- **Session History** — all sessions saved locally and accessible from the sidebar

## Post-hackathon improvements

- Added PDF parsing (PDF.js) — no backend required
- Added contextual follow-up chat with full conversation memory
- Added named study sessions with persistent localStorage history
- Added Key Concepts action
- Rebuilt UI from scratch — responsive, mobile-friendly sidebar layout
- Improved AI prompts per action for more structured, useful output

## Tech stack

- Vanilla JavaScript, HTML, CSS
- OpenAI API (gpt-4o-mini)
- PDF.js for client-side PDF text extraction
- Marked.js for markdown rendering

## Run locally

1. Clone the repo
2. Add your OpenAI API key to `index.js` (line 10)
3. Open `index.html` in a browser — no build step needed
