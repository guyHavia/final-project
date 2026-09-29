// A small line-level diff (classic LCS), used by the editor's comparison view
// to highlight what changed in an article's body. No library, per the brief.

/**
 * Returns a sequence of { type: 'same' | 'removed' | 'added', text } lines
 * turning `oldText` into `newText`. 'removed' lines are only in oldText,
 * 'added' only in newText, 'same' lines are common to both, in order.
 */
export function diffLines(oldText, newText) {
  const oldLines = String(oldText ?? '').split('\n');
  const newLines = String(newText ?? '').split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  // dp[i][j] = length of the LCS of oldLines[i..] and newLines[j..]
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'same', text: oldLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', text: oldLines[i] });
      i += 1;
    } else {
      result.push({ type: 'added', text: newLines[j] });
      j += 1;
    }
  }
  while (i < n) {
    result.push({ type: 'removed', text: oldLines[i] });
    i += 1;
  }
  while (j < m) {
    result.push({ type: 'added', text: newLines[j] });
    j += 1;
  }
  return result;
}
