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

pub fn diff_inline_units(left: &[u16], right: &[u16]) -> InlineDiffRanges {
    if left == right {
        return InlineDiffRanges {
            left_ranges: Vec::new(),
            right_ranges: Vec::new(),
        };
    }

    let (table, cols) = build_lcs_table(left, right);
    let matches = backtrack_matches(left, right, &table, cols);
    let left_ranges = merge_ranges(&build_ranges_from_flags(
        &build_unmatched_flags(left.len(), &matches, true),
    ), 1);
    let right_ranges = merge_ranges(&build_ranges_from_flags(
        &build_unmatched_flags(right.len(), &matches, false),
    ), 1);

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
    fn keeps_utf16_code_unit_offsets() {
        assert_eq!(
            diff_inline_units(&units("a🙂c"), &units("a🙃c")),
            InlineDiffRanges {
                left_ranges: vec![Range { start: 2, end: 3 }],
                right_ranges: vec![Range { start: 2, end: 3 }],
            }
        );
    }
}
