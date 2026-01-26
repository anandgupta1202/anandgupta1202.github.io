# Anand Gupta - Personal Portfolio

<p align="center">
  <a href="https://anandgupta1202.github.io">
    <img src="https://img.shields.io/badge/Visit-My%20Portfolio-blue?style=for-the-badge&logo=materialformkdocs&logoColor=white" alt="Portfolio">
  </a>
</p>

<p align="center">
  <a href="https://linkedin.com/in/anand-gupta-1202">
    <img src="https://img.shields.io/badge/LinkedIn-%230077B5.svg?logo=linkedin&logoColor=white" alt="LinkedIn">
  </a>
  <a href="https://medium.com/@anand.gupta1202">
    <img src="https://img.shields.io/badge/Medium-12100E?logo=medium&logoColor=white" alt="Medium">
  </a>
  <a href="https://x.com/AnandGupta1202">
    <img src="https://img.shields.io/badge/X-black.svg?logo=X&logoColor=white" alt="X">
  </a>
  <a href="https://instagram.com/habitcodes">
    <img src="https://img.shields.io/badge/Instagram-%23E4405F.svg?logo=Instagram&logoColor=white" alt="Instagram">
  </a>
</p>

---

Personal portfolio and blog built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/).

## 🚀 Quick Start (using UV)

[UV](https://docs.astral.sh/uv/) is an extremely fast Python package installer and resolver.

### Prerequisites

Install UV if you haven't already:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with Homebrew
brew install uv

# Or with pip
pip install uv
```

### Setup & Run

```bash
# Clone the repository
git clone https://github.com/anandgupta1202/anandgupta1202.github.io.git
cd anandgupta1202.github.io

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # Linux/macOS
# or .venv\Scripts\activate  # Windows

# Install dependencies
uv pip install -r requirements.txt

# Run development server
mkdocs serve
```

The site will be available at `http://127.0.0.1:8000` with live reload.

### Alternative: One-liner with UV

```bash
# Run without creating a persistent virtual environment
uv run --with "mkdocs-material[imaging]" mkdocs serve
```

## 📦 Available Commands

| Command | Description |
|---------|-------------|
| `mkdocs serve` | Start dev server with live reload |
| `mkdocs serve --strict` | Dev server with strict mode (catches warnings) |
| `mkdocs build` | Build static site to `site/` directory |
| `mkdocs build --strict` | Build with strict mode |

## 🏗️ Project Structure

```
.
├── docs/
│   ├── index.md              # Home page
│   ├── blog/
│   │   ├── index.md          # Blog landing page
│   │   ├── posts/            # Blog posts
│   │   └── images/           # Blog images
│   └── stylesheets/
│       └── extra.css         # Custom styles
├── includes/
│   └── abbreviations.md      # Abbreviation definitions
├── mkdocs.yml                # MkDocs configuration
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## 🚢 Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions on push to `main` branch.

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for the CI/CD configuration.

👉 **[Full Deployment Guide](DEPLOYMENT.md)** — How deployments work, troubleshooting, and manual deployment

## ✍️ Writing Blog Posts

Want to publish a new article?

👉 **[Blog Writing Guide](WRITING_GUIDE.md)** — Complete guide including:
- Frontmatter reference
- Adding images with captions
- Mermaid diagrams (flowcharts, sequence diagrams, etc.)
- Code blocks with syntax highlighting
- Admonitions (callout boxes)
- Publishing workflow

## 📝 License

© Anand Gupta
