// Icon sets. `unicode` needs no special font; `nerd` needs a Nerd Font; `ascii` is safe everywhere.
// An empty string means "no icon" for that set.

export const ICON_SETS = {
  unicode: {
    model: "◆", effort: "", thinking: "", fast: "", dir: "", project: "", git: "", dirty: "●", staged: "+",
    ahead: "↑", behind: "↓", worktree: "⑂", pr: "", context: "", exceeds: "⚠", cost: "", duration: "",
    lines: "", rate_5h: "", rate_7d: "", spend: "", reset: "↻", cache: "", vim: "", agent: "@",
    style: "", session: "", version: "", time: "",
  },
  nerd: {
    model: "\u{f06a9}", effort: "\u{f0e4}", thinking: "\u{f09d1}", fast: "\u{f0e7}", dir: "\u{f07b}", project: "\u{f09b}",
    git: "\u{e725}", dirty: "●", staged: "+", ahead: "↑", behind: "↓", worktree: "\u{f126}", pr: "\u{f407}",
    context: "\u{f035b}", exceeds: "\u{f071}", cost: "\u{f155}", duration: "\u{f017}", lines: "\u{f440}",
    rate_5h: "\u{f0150}", rate_7d: "\u{f073}", spend: "\u{f0d6}", reset: "\u{f021}", cache: "\u{f1c0}",
    vim: "\u{e62b}", agent: "\u{f21b}", style: "\u{f1fc}", session: "\u{f0c9}", version: "\u{f02b}", time: "\u{f017}",
  },
  ascii: {
    model: ">", effort: "", thinking: "", fast: "", dir: "", project: "", git: "", dirty: "*", staged: "+",
    ahead: "^", behind: "v", worktree: "wt:", pr: "", context: "", exceeds: "!", cost: "", duration: "",
    lines: "", rate_5h: "", rate_7d: "", spend: "", reset: "@", cache: "", vim: "", agent: "@",
    style: "", session: "", version: "", time: "",
  },
};

export const BAR_STYLES = {
  line: ["━", "─"],
  block: ["█", "░"],
  dots: ["●", "○"],
  ascii: ["#", "-"],
};
