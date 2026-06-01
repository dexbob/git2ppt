---
name: workspace-developer
description: 작업 공간의 파일들을 효율적으로 읽고 분석하며, ripgrep(rg)을 활용해 코드를 검색하고 파일에 정밀한 차이(diff)를 직접 적용합니다. 자율적인 계획 루프 없이 신속하게 파일 검색, 읽기, 리팩토링을 수행할 때 사용합니다.
disable-model-invocation: true
---

# Workspace Developer Skill

This skill guides the agent in reading files efficiently, searching code using ripgrep (`rg`), and performing precise edits directly on files while avoiding autonomous planning loops.

## Core Capabilities

### 1. File Reading and Analysis
- Read files directly using specialized tools like `Read` instead of running terminal commands like `cat`, `head`, or `tail`.
- Read entire files for small files, or use offset and limit to read specific sections of large files.
- Locate target files using `Glob` or fast search patterns before reading them.

### 2. Searching with Ripgrep (rg)
- Use the `Grep` tool (backed by ripgrep) for searching exact symbols, function names, and pattern definitions.
- Search with case insensitivity (`-i`) or multiline matching when searching across lines.
- Always prefer `Grep` over custom terminal grep commands because it is faster and respects file ignore settings.

### 3. High-Proficiency Refactoring and Diffing
- Modify files using precise edits with tools like `StrReplace` to maintain indentation, spacing, and styles.
- Avoid rewriting entire files when only a small portion needs to change.
- Ensure that the surrounding context matches the target replacement area exactly to prevent replacement failures.

### 4. No Autonomous Planning Loops
- Solve tasks directly and efficiently. Do not engage in recursive or long-running autonomous planning scripts or subagents that generate loops of internal monologues.
- Execute actions sequentially or in parallel depending on their dependencies without unnecessary coordination overhead.

## Examples

### Efficient Code Search
When asked to find where a specific function `calculateTotal` is called:
- Do not run `grep -r calculateTotal .` via a shell.
- Instead, use the `Grep` tool with pattern `calculateTotal`.

### Precise Code Modification
When editing a function:
- Do not rewrite the entire file with `Write`.
- Instead, find the specific code block and use `StrReplace` to replace the outdated block with the updated code.
