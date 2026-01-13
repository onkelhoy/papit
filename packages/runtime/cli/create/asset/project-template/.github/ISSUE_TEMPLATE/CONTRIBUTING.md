# Git Workflow Guide

This document outlines the recommended workflow for handling tasks within our projects, emphasizing the use of git for version control. To ensure clarity, maintainability, and a clean project history, we adhere to specific practices for branching, committing, and merging changes.

## Branch Management

For every task, whether it involves fixing bugs, adding features, or making minor updates, a new branch should be created. This approach keeps our project organized and ensures that each change is easily traceable to a specific task or issue.

### Branch Creation Process

Follow these steps to start working on a new task:

1. Open a new issue in the project's GitHub repository to document the task or bug.
2. Create a branch for the task. Utilizing the GitHub GUI for both steps is recommended for convenience and consistency.

## Commit Guidelines

Commit messages should clearly describe the changes made, following a structured prefix syntax to facilitate quick understanding and categorization of the commit's purpose.

### Standard Commit Syntax

For general changes:

```bash
git commit -m "prefix: description"
```

For changes specific to a component:

```bash
git commit -m "prefix: [component-name] description"
```

For example:

```bash
git commit -m "fix: [button] trigger click on enter press"
```

### Commit Prefixes

While the following prefixes are recommended, they are not exhaustive. Feel free to introduce new prefixes as needed, but aim for consistency and clarity across the project.

- **fix**: For fixes that correct bugs or issues.
- **bug**: Specifically for bug fixes.
- **chore**: For maintenance tasks that do not alter functionality.
- **add**: When adding new features or elements.
- **clean**: For clean-up tasks that improve the code without changing functionality.
- **style**: For changes related to styling and appearance.
- **react**: For changes specific to React components or functionality.
- **release**: For version releases and related tasks.
- **gen**: For auto-generated content or files.
- **resolve**: To indicate that an issue has been resolved, useful for final commits related to fixing a problem.

## Merging Changes

Once your branch's task is completed, ensure it is integrated seamlessly with the main branch. This process involves updating your branch with the latest changes from the main branch and consolidating your work into a well-documented commit.

### Finalizing Your Branch for Merge

1. Update the main branch with the latest changes:

    ```bash
    git checkout main
    git pull
    ```

2. Switch back to your task branch:

    ```bash
    git checkout your-branch-name
    ```

3. Start the rebase process interactively:

    ```bash
    git rebase -i main
    ```

    During the rebase, squash your commits into a single commit that captures the essence of your branch's work.

4. Craft a comprehensive commit message that includes a changelog listing all significant changes. Ensure the branch's purpose is clear, and link the issue ticket using GitHub's syntax to automatically close the related issue upon merging.

#### Commit Message Example

```
resolve: [button] Ensure click is triggered on enter press
closes: #888
changelog:
- fix: Corrected event handling
- clean: Optimized button click logic
```

### Tips for Effective Rebasing

Utilize Vim commands to streamline the rebase process:

- To squash all commits: `%s/pick /s /g`
- To format commit messages as a list during the rebase: `:%s/\([^:]\+\): /- \1: /g`

Adhering to these guidelines will help maintain a clean, understandable, and navigable project history, facilitating collaboration and review processes.
