// Named starting points. A user config may name a preset and override any field.

export const PRESETS = {
  minimal: {
    summary: "One quiet line: model, directory, git, context",
    config: { lines: [["model", "dir", "git", "context"]] },
  },
  balanced: {
    summary: "The everyday line: model, dir, git, context, cost, 5h usage (default)",
    config: { lines: [["model", "dir", "git", "context", "cost", "rate_5h"]] },
  },
  full: {
    summary: "Everything useful on one line, trimmed by priority when narrow",
    config: {
      lines: [["model", "effort", "fast", "vim", "dir", "git", "worktree", "pr", "context", "cache", "cost", "lines", "rate_5h", "rate_7d", "spend"]],
    },
  },
  dashboard: {
    summary: "Two lines: where you are, then what it costs",
    config: {
      lines: [
        ["model", "effort", "agent", "vim", "dir", "git", "worktree", "pr"],
        ["context", "cache", "cost", "duration", "lines", "rate_5h", "rate_7d", "spend"],
      ],
    },
  },
  budget: {
    summary: "Spend-focused: cost against a budget, limits, cache warmth",
    config: {
      lines: [["model", "dir", { id: "cost", options: { budget: 10 } }, "spend", "rate_5h", "rate_7d", "cache", "context"]],
      thresholds: { warn: 50, hot: 80 },
    },
  },
};
