use std::collections::{HashMap, HashSet};

const MYERS_TRACE_SAFE_LENGTH_SUM: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffStep {
    pub left_index: Option<usize>,
    pub right_index: Option<usize>,
    pub step_type: DiffStepType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffStepType {
    Delete,
    Equal,
    Insert,
}

#[derive(Debug, Clone, Copy)]
struct MyersBisect {
    left_mid: usize,
    right_mid: usize,
}

#[derive(Debug, Clone, Copy)]
struct UniquePair {
    left_index: usize,
    right_index: usize,
}

type MyersTrace = Vec<Vec<isize>>;

impl DiffStep {
    fn delete(left_index: usize) -> Self {
        Self {
            left_index: Some(left_index),
            right_index: None,
            step_type: DiffStepType::Delete,
        }
    }

    fn equal(left_index: usize, right_index: usize) -> Self {
        Self {
            left_index: Some(left_index),
            right_index: Some(right_index),
            step_type: DiffStepType::Equal,
        }
    }

    fn insert(right_index: usize) -> Self {
        Self {
            left_index: None,
            right_index: Some(right_index),
            step_type: DiffStepType::Insert,
        }
    }
}

fn should_use_myers_trace(left_len: usize, right_len: usize) -> bool {
    left_len + right_len <= MYERS_TRACE_SAFE_LENGTH_SUM
}

fn build_myers_trace(left: &[u32], right: &[u32]) -> MyersTrace {
    let n = left.len() as isize;
    let m = right.len() as isize;
    let max = n + m;
    let offset = max;
    let mut v = vec![0isize; (2 * max + 1) as usize];
    let mut trace = Vec::new();
    let mut found = false;

    for d in 0..=max {
        let mut k = -d;
        while k <= d {
            let k_index = (k + offset) as usize;
            let mut x;
            if k == -d || (k != d && v[k_index - 1] < v[k_index + 1]) {
                x = v[k_index + 1];
            } else {
                x = v[k_index - 1] + 1;
            }

            let mut y = x - k;
            while x < n && y < m && left[x as usize] == right[y as usize] {
                x += 1;
                y += 1;
            }

            v[k_index] = x;
            if x >= n && y >= m {
                found = true;
                break;
            }

            k += 2;
        }

        trace.push(v.clone());
        if found {
            break;
        }
    }

    trace
}

fn backtrack_steps(
    trace: &[Vec<isize>],
    left_len: usize,
    right_len: usize,
    left_offset: usize,
    right_offset: usize,
) -> Vec<DiffStep> {
    let n = left_len as isize;
    let m = right_len as isize;
    let max = n + m;
    let offset = max;
    let mut steps = Vec::new();
    let mut x = n;
    let mut y = m;

    for d in (0..trace.len()).rev() {
        let v = &trace[d];
        let d = d as isize;
        let k = x - y;
        let k_index = (k + offset) as usize;
        let prev_k = if k == -d || (k != d && v[k_index - 1] < v[k_index + 1]) {
            k + 1
        } else {
            k - 1
        };

        let prev_x = v[(prev_k + offset) as usize];
        let prev_y = prev_x - prev_k;

        while x > prev_x && y > prev_y {
            steps.push(DiffStep::equal(
                left_offset + (x as usize) - 1,
                right_offset + (y as usize) - 1,
            ));
            x -= 1;
            y -= 1;
        }

        if d == 0 {
            break;
        }

        if x == prev_x {
            steps.push(DiffStep::insert(right_offset + (y as usize) - 1));
            y -= 1;
        } else {
            steps.push(DiffStep::delete(left_offset + (x as usize) - 1));
            x -= 1;
        }
    }

    steps.reverse();
    steps
}

fn find_myers_bisect(
    left: &[u32],
    right: &[u32],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
) -> MyersBisect {
    let left_len = left_end - left_start;
    let right_len = right_end - right_start;
    let max_d = (left_len + right_len).div_ceil(2);
    let v_offset = max_d as isize;
    let v_len = 2 * max_d + 2;
    let mut forward = vec![-1isize; v_len];
    let mut reverse = vec![-1isize; v_len];
    let delta = left_len as isize - right_len as isize;
    let front = delta % 2 != 0;

    forward[(v_offset + 1) as usize] = 0;
    reverse[(v_offset + 1) as usize] = 0;

    let mut forward_start = 0isize;
    let mut forward_end = 0isize;
    let mut reverse_start = 0isize;
    let mut reverse_end = 0isize;

    for d in 0..=max_d as isize {
        let mut k = -d + forward_start;
        while k <= d - forward_end {
            let k_offset = (v_offset + k) as usize;
            let mut x = if k == -d || (k != d && forward[k_offset - 1] < forward[k_offset + 1]) {
                forward[k_offset + 1]
            } else {
                forward[k_offset - 1] + 1
            };

            let mut y = x - k;
            while x < left_len as isize
                && y < right_len as isize
                && left[left_start + x as usize] == right[right_start + y as usize]
            {
                x += 1;
                y += 1;
            }

            forward[k_offset] = x;

            if x > left_len as isize {
                forward_end += 2;
            } else if y > right_len as isize {
                forward_start += 2;
            } else if front {
                let reverse_offset = v_offset + delta - k;
                if reverse_offset >= 0
                    && (reverse_offset as usize) < v_len
                    && reverse[reverse_offset as usize] != -1
                {
                    let reverse_x = left_len as isize - reverse[reverse_offset as usize];
                    if x >= reverse_x {
                        return MyersBisect {
                            left_mid: left_start + x as usize,
                            right_mid: right_start + y as usize,
                        };
                    }
                }
            }

            k += 2;
        }

        let mut k = -d + reverse_start;
        while k <= d - reverse_end {
            let k_offset = (v_offset + k) as usize;
            let mut x = if k == -d || (k != d && reverse[k_offset - 1] < reverse[k_offset + 1]) {
                reverse[k_offset + 1]
            } else {
                reverse[k_offset - 1] + 1
            };

            let mut y = x - k;
            while x < left_len as isize
                && y < right_len as isize
                && left[left_end - x as usize - 1] == right[right_end - y as usize - 1]
            {
                x += 1;
                y += 1;
            }

            reverse[k_offset] = x;

            if x > left_len as isize {
                reverse_end += 2;
            } else if y > right_len as isize {
                reverse_start += 2;
            } else if !front {
                let forward_offset = v_offset + delta - k;
                if forward_offset >= 0
                    && (forward_offset as usize) < v_len
                    && forward[forward_offset as usize] != -1
                {
                    let forward_x = forward[forward_offset as usize];
                    let forward_k = forward_offset - v_offset;
                    let forward_y = forward_x - forward_k;
                    let reverse_x = left_len as isize - x;
                    if forward_x >= reverse_x {
                        return MyersBisect {
                            left_mid: left_start + forward_x as usize,
                            right_mid: right_start + forward_y as usize,
                        };
                    }
                }
            }

            k += 2;
        }
    }

    MyersBisect {
        left_mid: left_start + left_len / 2,
        right_mid: right_start + right_len / 2,
    }
}

fn has_shared_compare_key(
    left: &[u32],
    right: &[u32],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
) -> bool {
    let left_len = left_end - left_start;
    let right_len = right_end - right_start;
    let (smaller, larger) = if left_len <= right_len {
        (&left[left_start..left_end], &right[right_start..right_end])
    } else {
        (&right[right_start..right_end], &left[left_start..left_end])
    };

    let mut keys = HashSet::with_capacity(smaller.len());
    keys.extend(smaller.iter().copied());
    larger.iter().any(|key| keys.contains(key))
}

fn build_unique_pairs(left: &[u32], right: &[u32]) -> Vec<UniquePair> {
    let mut left_map = HashMap::<u32, (usize, usize)>::new();
    let mut right_map = HashMap::<u32, (usize, usize)>::new();

    for (index, value) in left.iter().copied().enumerate() {
        left_map
            .entry(value)
            .and_modify(|entry| entry.1 += 1)
            .or_insert((index, 1));
    }
    for (index, value) in right.iter().copied().enumerate() {
        right_map
            .entry(value)
            .and_modify(|entry| entry.1 += 1)
            .or_insert((index, 1));
    }

    let mut pairs = Vec::new();
    for (value, (left_index, left_count)) in left_map {
        if left_count != 1 {
            continue;
        }
        if let Some((right_index, right_count)) = right_map.get(&value) {
            if *right_count == 1 {
                pairs.push(UniquePair {
                    left_index,
                    right_index: *right_index,
                });
            }
        }
    }

    pairs.sort_by_key(|pair| pair.left_index);
    pairs
}

fn longest_increasing_pairs(pairs: &[UniquePair]) -> Vec<UniquePair> {
    if pairs.is_empty() {
      return Vec::new();
    }

    let mut tail_values = Vec::<usize>::new();
    let mut tail_indices = Vec::<usize>::new();
    let mut prev_indices = vec![usize::MAX; pairs.len()];

    let lower_bound = |values: &[usize], value: usize| -> usize {
        let mut low = 0usize;
        let mut high = values.len();
        while low < high {
            let mid = (low + high) / 2;
            if values[mid] < value {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        low
    };

    for (index, pair) in pairs.iter().enumerate() {
        let pos = lower_bound(&tail_values, pair.right_index);
        if pos == tail_values.len() {
            tail_values.push(pair.right_index);
            tail_indices.push(index);
        } else {
            tail_values[pos] = pair.right_index;
            tail_indices[pos] = index;
        }
        if pos > 0 {
            prev_indices[index] = tail_indices[pos - 1];
        }
    }

    let mut sequence = Vec::new();
    let mut cursor = *tail_indices.last().unwrap_or(&usize::MAX);
    while cursor != usize::MAX {
        sequence.push(pairs[cursor]);
        cursor = prev_indices[cursor];
    }
    sequence.reverse();
    sequence
}

fn build_delete_steps(left_start: usize, left_end: usize, left_offset: usize) -> Vec<DiffStep> {
    (left_start..left_end)
        .map(|index| DiffStep::delete(left_offset + index))
        .collect()
}

fn build_insert_steps(right_start: usize, right_end: usize, right_offset: usize) -> Vec<DiffStep> {
    (right_start..right_end)
        .map(|index| DiffStep::insert(right_offset + index))
        .collect()
}

fn diff_compare_myers(
    left: &[u32],
    right: &[u32],
    left_offset: usize,
    right_offset: usize,
) -> Vec<DiffStep> {
    fn diff_range(
        left: &[u32],
        right: &[u32],
        left_start: usize,
        left_end: usize,
        right_start: usize,
        right_end: usize,
        left_offset: usize,
        right_offset: usize,
    ) -> Vec<DiffStep> {
        let mut prefix = Vec::new();
        let mut next_left_start = left_start;
        let mut next_right_start = right_start;

        while next_left_start < left_end
            && next_right_start < right_end
            && left[next_left_start] == right[next_right_start]
        {
            prefix.push(DiffStep::equal(
                left_offset + next_left_start,
                right_offset + next_right_start,
            ));
            next_left_start += 1;
            next_right_start += 1;
        }

        let mut suffix_pairs = Vec::new();
        let mut next_left_end = left_end;
        let mut next_right_end = right_end;

        while next_left_start < next_left_end
            && next_right_start < next_right_end
            && left[next_left_end - 1] == right[next_right_end - 1]
        {
            next_left_end -= 1;
            next_right_end -= 1;
            suffix_pairs.push((next_left_end, next_right_end));
        }

        let left_len = next_left_end - next_left_start;
        let right_len = next_right_end - next_right_start;

        let middle = if left_len == 0 {
            build_insert_steps(next_right_start, next_right_end, right_offset)
        } else if right_len == 0 {
            build_delete_steps(next_left_start, next_left_end, left_offset)
        } else if !has_shared_compare_key(
            left,
            right,
            next_left_start,
            next_left_end,
            next_right_start,
            next_right_end,
        ) {
            let mut steps = build_delete_steps(next_left_start, next_left_end, left_offset);
            steps.extend(build_insert_steps(
                next_right_start,
                next_right_end,
                right_offset,
            ));
            steps
        } else if should_use_myers_trace(left_len, right_len) {
            let trace = build_myers_trace(
                &left[next_left_start..next_left_end],
                &right[next_right_start..next_right_end],
            );
            backtrack_steps(
                &trace,
                left_len,
                right_len,
                left_offset + next_left_start,
                right_offset + next_right_start,
            )
        } else {
            let split = find_myers_bisect(
                left,
                right,
                next_left_start,
                next_left_end,
                next_right_start,
                next_right_end,
            );
            if split.left_mid == next_left_start && split.right_mid == next_right_start {
                if left_len >= right_len {
                    let mut steps = vec![DiffStep::delete(left_offset + next_left_start)];
                    steps.extend(diff_range(
                        left,
                        right,
                        next_left_start + 1,
                        next_left_end,
                        next_right_start,
                        next_right_end,
                        left_offset,
                        right_offset,
                    ));
                    steps
                } else {
                    let mut steps = vec![DiffStep::insert(right_offset + next_right_start)];
                    steps.extend(diff_range(
                        left,
                        right,
                        next_left_start,
                        next_left_end,
                        next_right_start + 1,
                        next_right_end,
                        left_offset,
                        right_offset,
                    ));
                    steps
                }
            } else if split.left_mid == next_left_end && split.right_mid == next_right_end {
                if left_len >= right_len {
                    let mut steps = diff_range(
                        left,
                        right,
                        next_left_start,
                        next_left_end - 1,
                        next_right_start,
                        next_right_end,
                        left_offset,
                        right_offset,
                    );
                    steps.push(DiffStep::delete(left_offset + next_left_end - 1));
                    steps
                } else {
                    let mut steps = diff_range(
                        left,
                        right,
                        next_left_start,
                        next_left_end,
                        next_right_start,
                        next_right_end - 1,
                        left_offset,
                        right_offset,
                    );
                    steps.push(DiffStep::insert(right_offset + next_right_end - 1));
                    steps
                }
            } else {
                let mut steps = diff_range(
                    left,
                    right,
                    next_left_start,
                    split.left_mid,
                    next_right_start,
                    split.right_mid,
                    left_offset,
                    right_offset,
                );
                steps.extend(diff_range(
                    left,
                    right,
                    split.left_mid,
                    next_left_end,
                    split.right_mid,
                    next_right_end,
                    left_offset,
                    right_offset,
                ));
                steps
            }
        };

        let mut suffix = Vec::new();
        for (left_index, right_index) in suffix_pairs.into_iter().rev() {
            suffix.push(DiffStep::equal(
                left_offset + left_index,
                right_offset + right_index,
            ));
        }

        prefix.into_iter().chain(middle).chain(suffix).collect()
    }

    diff_range(left, right, 0, left.len(), 0, right.len(), left_offset, right_offset)
}

fn diff_compare_patience(
    left: &[u32],
    right: &[u32],
    left_offset: usize,
    right_offset: usize,
) -> Vec<DiffStep> {
    if left.is_empty() && right.is_empty() {
        return Vec::new();
    }

    let anchors = longest_increasing_pairs(&build_unique_pairs(left, right));
    if anchors.is_empty() {
        return diff_compare_myers(left, right, left_offset, right_offset);
    }

    let mut result = Vec::new();
    let mut left_start = 0usize;
    let mut right_start = 0usize;

    for anchor in anchors {
        result.extend(diff_compare_patience(
            &left[left_start..anchor.left_index],
            &right[right_start..anchor.right_index],
            left_offset + left_start,
            right_offset + right_start,
        ));
        result.push(DiffStep::equal(
            left_offset + anchor.left_index,
            right_offset + anchor.right_index,
        ));
        left_start = anchor.left_index + 1;
        right_start = anchor.right_index + 1;
    }

    result.extend(diff_compare_patience(
        &left[left_start..],
        &right[right_start..],
        left_offset + left_start,
        right_offset + right_start,
    ));

    result
}

pub fn diff_compare_ids(left: &[u32], right: &[u32]) -> Vec<DiffStep> {
    diff_compare_patience(left, right, 0, 0)
}

#[cfg(test)]
mod tests {
    use super::{diff_compare_ids, DiffStep, DiffStepType};

    #[test]
    fn returns_equal_steps_for_identical_inputs() {
        let steps = diff_compare_ids(&[1, 2], &[1, 2]);
        assert_eq!(
            steps,
            vec![
                DiffStep {
                    left_index: Some(0),
                    right_index: Some(0),
                    step_type: DiffStepType::Equal,
                },
                DiffStep {
                    left_index: Some(1),
                    right_index: Some(1),
                    step_type: DiffStepType::Equal,
                },
            ]
        );
    }

    #[test]
    fn keeps_inserts_and_deletes_in_order() {
        let steps = diff_compare_ids(&[1, 2, 3], &[1, 4, 3]);
        assert_eq!(
            steps,
            vec![
                DiffStep {
                    left_index: Some(0),
                    right_index: Some(0),
                    step_type: DiffStepType::Equal,
                },
                DiffStep {
                    left_index: Some(1),
                    right_index: None,
                    step_type: DiffStepType::Delete,
                },
                DiffStep {
                    left_index: None,
                    right_index: Some(1),
                    step_type: DiffStepType::Insert,
                },
                DiffStep {
                    left_index: Some(2),
                    right_index: Some(2),
                    step_type: DiffStepType::Equal,
                },
            ]
        );
    }
}
