#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Range {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, PartialEq, Eq)]
pub struct InlineDiffRanges {
    pub left_ranges: Vec<Range>,
    pub right_ranges: Vec<Range>,
}

const MAX_INLINE_LCS_CELLS: usize = 1_000_000;

#[derive(Clone, Copy)]
struct MatchPair {
    left_index: usize,
    right_index: usize,
}

fn build_lcs_table(left: &[u16], right: &[u16]) -> (Vec<u32>, usize) {
    let rows = left.len() + 1;
    let cols = right.len() + 1;
    let mut table = vec![0u32; rows * cols];

    for i in 1..rows {
        for j in 1..cols {
            let index = i * cols + j;
            if left[i - 1] == right[j - 1] {
                table[index] = table[(i - 1) * cols + (j - 1)] + 1;
            } else {
                let up = table[(i - 1) * cols + j];
                let left_value = table[i * cols + (j - 1)];
                table[index] = up.max(left_value);
            }
        }
    }

    (table, cols)
}

fn backtrack_matches(left: &[u16], right: &[u16], table: &[u32], cols: usize) -> Vec<MatchPair> {
    let mut matches = Vec::new();
    let mut i = left.len();
    let mut j = right.len();

    while i > 0 && j > 0 {
        if left[i - 1] == right[j - 1] {
            matches.push(MatchPair {
                left_index: i - 1,
                right_index: j - 1,
            });
            i -= 1;
            j -= 1;
        } else if table[(i - 1) * cols + j] >= table[i * cols + (j - 1)] {
            i -= 1;
        } else {
            j -= 1;
        }
    }

    matches.reverse();
    matches
}

fn build_unmatched_flags(length: usize, matches: &[MatchPair], is_left: bool) -> Vec<bool> {
    let mut flags = vec![false; length];
    for pair in matches {
        let index = if is_left {
            pair.left_index
        } else {
            pair.right_index
        };
        flags[index] = true;
    }
    flags
}

fn build_ranges_from_flags(flags: &[bool]) -> Vec<Range> {
    let mut ranges = Vec::new();
    let mut start = None;

    for (index, is_matched) in flags.iter().enumerate() {
        if !is_matched {
            if start.is_none() {
                start = Some(index);
            }
        } else if let Some(range_start) = start.take() {
            ranges.push(Range {
                start: range_start,
                end: index,
            });
        }
    }

    if let Some(range_start) = start {
        ranges.push(Range {
            start: range_start,
            end: flags.len(),
        });
    }

    ranges
}

fn merge_ranges(ranges: &[Range], max_gap: usize) -> Vec<Range> {
    if ranges.is_empty() {
        return Vec::new();
    }

    let mut merged = Vec::with_capacity(ranges.len());
    let mut current = ranges[0];

    for range in &ranges[1..] {
        let gap = range.start.saturating_sub(current.end);
        if gap <= max_gap {
            current.end = range.end;
        } else {
            merged.push(current);
            current = *range;
        }
    }

    merged.push(current);
    merged
}

fn find_common_edges(left: &[u16], right: &[u16]) -> (usize, usize, usize) {
    let mut prefix = 0;
    let max_prefix = left.len().min(right.len());
    while prefix < max_prefix && left[prefix] == right[prefix] {
        prefix += 1;
    }

    let mut left_end = left.len();
    let mut right_end = right.len();
    while left_end > prefix && right_end > prefix && left[left_end - 1] == right[right_end - 1] {
        left_end -= 1;
        right_end -= 1;
    }
    (prefix, left_end, right_end)
}

fn exceeds_lcs_cell_budget(left_length: usize, right_length: usize) -> bool {
    left_length > 0 && right_length > 0 && left_length > MAX_INLINE_LCS_CELLS / right_length
}

fn offset_ranges(ranges: &mut [Range], offset: usize) {
    for range in ranges {
        range.start += offset;
        range.end += offset;
    }
}

// Grapheme normalization belongs to the shared TypeScript layer.
pub fn diff_inline_units(left: &[u16], right: &[u16]) -> InlineDiffRanges {
    if left == right {
        return InlineDiffRanges {
            left_ranges: Vec::new(),
            right_ranges: Vec::new(),
        };
    }

    let (prefix, left_end, right_end) = find_common_edges(left, right);
    let left_middle = &left[prefix..left_end];
    let right_middle = &right[prefix..right_end];
    let (mut left_ranges, mut right_ranges) = if left_middle.is_empty() || right_middle.is_empty() {
        (
            if left_middle.is_empty() {
                Vec::new()
            } else {
                vec![Range {
                    start: 0,
                    end: left_middle.len(),
                }]
            },
            if right_middle.is_empty() {
                Vec::new()
            } else {
                vec![Range {
                    start: 0,
                    end: right_middle.len(),
                }]
            },
        )
    } else if exceeds_lcs_cell_budget(left_middle.len(), right_middle.len()) {
        (
            vec![Range {
                start: 0,
                end: left_middle.len(),
            }],
            vec![Range {
                start: 0,
                end: right_middle.len(),
            }],
        )
    } else {
        let (table, cols) = build_lcs_table(left_middle, right_middle);
        let matches = backtrack_matches(left_middle, right_middle, &table, cols);
        (
            merge_ranges(
                &build_ranges_from_flags(&build_unmatched_flags(left_middle.len(), &matches, true)),
                1,
            ),
            merge_ranges(
                &build_ranges_from_flags(&build_unmatched_flags(
                    right_middle.len(),
                    &matches,
                    false,
                )),
                1,
            ),
        )
    };
    offset_ranges(&mut left_ranges, prefix);
    offset_ranges(&mut right_ranges, prefix);

    InlineDiffRanges {
        left_ranges,
        right_ranges,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    #[test]
    fn returns_empty_ranges_for_identical_input() {
        assert_eq!(
            diff_inline_units(&units("abc"), &units("abc")),
            InlineDiffRanges {
                left_ranges: Vec::new(),
                right_ranges: Vec::new(),
            }
        );
    }

    #[test]
    fn merges_fragmented_ranges_for_readability() {
        assert_eq!(
            diff_inline_units(&units("a1b2c3"), &units("a1x2y3")),
            InlineDiffRanges {
                left_ranges: vec![Range { start: 2, end: 5 }],
                right_ranges: vec![Range { start: 2, end: 5 }],
            }
        );
    }

    #[test]
    fn returns_utf16_ranges_for_shared_grapheme_normalization() {
        assert_eq!(
            diff_inline_units(&units("a🙂c"), &units("a🙃c")),
            InlineDiffRanges {
                left_ranges: vec![Range { start: 2, end: 3 }],
                right_ranges: vec![Range { start: 2, end: 3 }],
            }
        );
    }

    #[test]
    fn returns_raw_combining_mark_changes() {
        assert_eq!(
            diff_inline_units(&units("a\u{301}b"), &units("a\u{300}b")),
            InlineDiffRanges {
                left_ranges: vec![Range { start: 1, end: 2 }],
                right_ranges: vec![Range { start: 1, end: 2 }],
            }
        );
    }

    #[test]
    fn returns_raw_zwj_emoji_changes() {
        assert_eq!(
            diff_inline_units(&units("👩‍💻"), &units("👩‍🔬")),
            InlineDiffRanges {
                left_ranges: vec![Range { start: 4, end: 5 }],
                right_ranges: vec![Range { start: 4, end: 5 }],
            }
        );
    }

    #[test]
    fn uses_a_coarse_middle_range_above_the_lcs_cell_budget() {
        let prefix = "prefix:";
        let suffix = ":suffix";
        let left = format!("{}{}{}", prefix, "a".repeat(1_100), suffix);
        let right = format!("{}{}{}", prefix, "b".repeat(1_100), suffix);

        assert_eq!(
            diff_inline_units(&units(&left), &units(&right)),
            InlineDiffRanges {
                left_ranges: vec![Range {
                    start: prefix.len(),
                    end: prefix.len() + 1_100,
                }],
                right_ranges: vec![Range {
                    start: prefix.len(),
                    end: prefix.len() + 1_100,
                }],
            }
        );
    }

    #[test]
    fn trims_very_large_common_edges_before_computing_lcs() {
        let prefix = "a".repeat(10_000);
        let suffix = "b".repeat(10_000);
        let left = format!("{}x{}", prefix, suffix);
        let right = format!("{}y{}", prefix, suffix);

        assert_eq!(
            diff_inline_units(&units(&left), &units(&right)),
            InlineDiffRanges {
                left_ranges: vec![Range {
                    start: prefix.len(),
                    end: prefix.len() + 1,
                }],
                right_ranges: vec![Range {
                    start: prefix.len(),
                    end: prefix.len() + 1,
                }],
            }
        );
    }

    #[test]
    fn handles_a_100000_unit_one_sided_change_without_an_lcs_table() {
        let left = "x".repeat(100_000);

        assert_eq!(
            diff_inline_units(&units(&left), &[]),
            InlineDiffRanges {
                left_ranges: vec![Range {
                    start: 0,
                    end: left.len(),
                }],
                right_ranges: Vec::new(),
            }
        );
    }
}
