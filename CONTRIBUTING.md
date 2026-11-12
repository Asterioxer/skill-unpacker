# Contributing to Skill Unpacker

Thank you for your interest in contributing to Skill Unpacker! This document provides guidelines for contributing to both the reusable Core library and the Electron desktop application.

---

## Code of Conduct

By participating in this project, you agree to abide by our standards of respectful, collaborative behavior.

---

## Repository Structure

Skill Unpacker is structured as an npm workspaces monorepo:

- `packages/core/`: The reusable Node.js library (`skill-unpacker`) and CLI.
- `apps/desktop/`: The Electron desktop application.
- `docs/`: Technical and architecture documentation.
- `examples/`: End-to-end example scripts.

---

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Asterioxer/skill-unpacker.git
   cd skill-unpacker
   ```

2. **Install core dependencies**:
   ```bash
   cd packages/core
   npm install
   ```

3. **Run the test suite**:
   ```bash
   npm test
   ```

4. **Run the Electron desktop app**:
   ```bash
   cd ../../apps/desktop
   npm install
   npm start
   ```

---

## Coding Standards

- **Zero runtime bloat**: Keep `packages/core` lean. Avoid adding heavy runtime dependencies unless strictly necessary.
- **Security-first**: Any change involving archive extraction, file paths, or system interaction must include rigorous test cases for path traversal, symlink handling, and boundary enforcement.
- **Node.js Compatibility**: The core package supports Node.js 20.x, 22.x, and 24.x LTS releases.
- **No filesystem in renderer**: The Electron renderer must remain strictly isolated. All filesystem logic lives in `packages/core` and is invoked through trusted IPC channels.

---

## Submitting Pull Requests

1. Fork the repository and create a new feature branch (`git checkout -b feature/my-feature`).
2. Ensure all tests pass (`npm test` in `packages/core`).
3. Add new unit tests for any bug fixes or new features.
4. Commit your changes with clear, descriptive commit messages.
5. Push to your branch and open a Pull Request against `main`.
