mod diff_steps;
mod inline_diff;

use diff_steps::{diff_compare_ids, DiffStep, DiffStepType};
use inline_diff::{diff_inline_units, InlineDiffRanges};
use std::{mem, ptr, slice};

const ABI_VERSION: u32 = 1;
const INPUT_VERSION: u32 = 1;
const OUTPUT_VERSION: u32 = 1;
const INLINE_INPUT_VERSION: u32 = 1;
const INLINE_OUTPUT_VERSION: u32 = 1;
const STATUS_OK: u32 = 0;
const STATUS_ERROR: u32 = 1;
const STEP_DELETE: u32 = 0;
const STEP_INSERT: u32 = 1;
const STEP_EQUAL: u32 = 2;
const STEP_NONE: u32 = u32::MAX;

static mut LAST_RESULT_PTR: *mut u8 = ptr::null_mut();
static mut LAST_RESULT_LEN: usize = 0;
static mut LAST_ERROR_PTR: *mut u8 = ptr::null_mut();
static mut LAST_ERROR_LEN: usize = 0;

fn build_id() -> &'static str {
    match option_env!("DIFF_VIEWER_WASM_BUILD_ID") {
        Some(value) => value,
        None => "workspace",
    }
}

fn clear_result() {
    unsafe {
        if !LAST_RESULT_PTR.is_null() && LAST_RESULT_LEN > 0 {
            let _ = Vec::from_raw_parts(LAST_RESULT_PTR, 0, LAST_RESULT_LEN);
        }
        LAST_RESULT_PTR = ptr::null_mut();
        LAST_RESULT_LEN = 0;
    }
}

fn clear_error() {
    unsafe {
        if !LAST_ERROR_PTR.is_null() && LAST_ERROR_LEN > 0 {
            let _ = Vec::from_raw_parts(LAST_ERROR_PTR, 0, LAST_ERROR_LEN);
        }
        LAST_ERROR_PTR = ptr::null_mut();
        LAST_ERROR_LEN = 0;
    }
}

fn store_result(bytes: Vec<u8>) {
    clear_result();
    unsafe {
        let len = bytes.len();
        let mut boxed = bytes.into_boxed_slice();
        LAST_RESULT_PTR = boxed.as_mut_ptr();
        LAST_RESULT_LEN = len;
        mem::forget(boxed);
    }
    clear_error();
}

fn store_error(message: String) {
    clear_error();
    unsafe {
        let bytes = message.into_bytes();
        let len = bytes.len();
        let mut boxed = bytes.into_boxed_slice();
        LAST_ERROR_PTR = boxed.as_mut_ptr();
        LAST_ERROR_LEN = len;
        mem::forget(boxed);
    }
    clear_result();
}

fn take_result_ptr() -> *mut u8 {
    unsafe {
        let ptr = LAST_RESULT_PTR;
        LAST_RESULT_PTR = ptr::null_mut();
        ptr
    }
}

fn take_result_len() -> usize {
    unsafe {
        let len = LAST_RESULT_LEN;
        LAST_RESULT_LEN = 0;
        len
    }
}

fn take_error_ptr() -> *mut u8 {
    unsafe {
        let ptr = LAST_ERROR_PTR;
        LAST_ERROR_PTR = ptr::null_mut();
        ptr
    }
}

fn take_error_len() -> usize {
    unsafe {
        let len = LAST_ERROR_LEN;
        LAST_ERROR_LEN = 0;
        len
    }
}

fn read_u32(bytes: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > bytes.len() {
        return Err("embedded wasm diff input is truncated".to_string());
    }
    let chunk = [
        bytes[*offset],
        bytes[*offset + 1],
        bytes[*offset + 2],
        bytes[*offset + 3],
    ];
    *offset += 4;
    Ok(u32::from_le_bytes(chunk))
}

fn read_u16(bytes: &[u8], offset: &mut usize) -> Result<u16, String> {
    if *offset + 2 > bytes.len() {
        return Err("embedded wasm inline input is truncated".to_string());
    }
    let chunk = [bytes[*offset], bytes[*offset + 1]];
    *offset += 2;
    Ok(u16::from_le_bytes(chunk))
}

fn parse_diff_steps_input(bytes: &[u8]) -> Result<(Vec<u32>, Vec<u32>), String> {
    let mut offset = 0usize;
    let version = read_u32(bytes, &mut offset)?;
    if version != INPUT_VERSION {
        return Err("embedded wasm diff input version is unsupported".to_string());
    }
    let left_len = read_u32(bytes, &mut offset)? as usize;
    let right_len = read_u32(bytes, &mut offset)? as usize;
    let expected = (3usize + left_len + right_len) * 4;
    if bytes.len() != expected {
        return Err("embedded wasm diff input size is invalid".to_string());
    }

    let mut left = Vec::with_capacity(left_len);
    let mut right = Vec::with_capacity(right_len);
    for _ in 0..left_len {
        left.push(read_u32(bytes, &mut offset)?);
    }
    for _ in 0..right_len {
        right.push(read_u32(bytes, &mut offset)?);
    }

    Ok((left, right))
}

fn parse_inline_diff_input(bytes: &[u8]) -> Result<(Vec<u16>, Vec<u16>), String> {
    let mut offset = 0usize;
    let version = read_u32(bytes, &mut offset)?;
    if version != INLINE_INPUT_VERSION {
        return Err("embedded wasm inline input version is unsupported".to_string());
    }
    let left_len = read_u32(bytes, &mut offset)? as usize;
    let right_len = read_u32(bytes, &mut offset)? as usize;
    let expected = 12usize + (left_len + right_len) * 2;
    if bytes.len() != expected {
        return Err("embedded wasm inline input size is invalid".to_string());
    }

    let mut left = Vec::with_capacity(left_len);
    let mut right = Vec::with_capacity(right_len);
    for _ in 0..left_len {
        left.push(read_u16(bytes, &mut offset)?);
    }
    for _ in 0..right_len {
        right.push(read_u16(bytes, &mut offset)?);
    }

    Ok((left, right))
}

fn step_type_code(step_type: DiffStepType) -> u32 {
    match step_type {
        DiffStepType::Delete => STEP_DELETE,
        DiffStepType::Equal => STEP_EQUAL,
        DiffStepType::Insert => STEP_INSERT,
    }
}

fn push_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn encode_range_ranges_output(ranges: &InlineDiffRanges) -> Result<Vec<u8>, String> {
    let left_count = u32::try_from(ranges.left_ranges.len())
        .map_err(|_| "embedded wasm inline left range count exceeds the wire format".to_string())?;
    let right_count = u32::try_from(ranges.right_ranges.len())
        .map_err(|_| "embedded wasm inline right range count exceeds the wire format".to_string())?;
    let mut bytes =
        Vec::with_capacity(12 + (ranges.left_ranges.len() + ranges.right_ranges.len()) * 8);
    push_u32(&mut bytes, INLINE_OUTPUT_VERSION);
    push_u32(&mut bytes, left_count);
    push_u32(&mut bytes, right_count);

    for range in ranges.left_ranges.iter().chain(ranges.right_ranges.iter()) {
        push_u32(
            &mut bytes,
            u32::try_from(range.start)
                .map_err(|_| "embedded wasm inline range start exceeds the wire format".to_string())?,
        );
        push_u32(
            &mut bytes,
            u32::try_from(range.end)
                .map_err(|_| "embedded wasm inline range end exceeds the wire format".to_string())?,
        );
    }

    Ok(bytes)
}

fn encode_diff_steps_output(steps: &[DiffStep]) -> Result<Vec<u8>, String> {
    let step_count = u32::try_from(steps.len())
        .map_err(|_| "embedded wasm diff step count exceeds the wire format".to_string())?;
    let mut bytes = Vec::with_capacity(8 + steps.len() * 12);
    push_u32(&mut bytes, OUTPUT_VERSION);
    push_u32(&mut bytes, step_count);

    for step in steps {
        push_u32(&mut bytes, step_type_code(step.step_type));
        push_u32(
            &mut bytes,
            match step.left_index {
                Some(value) => u32::try_from(value)
                    .map_err(|_| "embedded wasm left index exceeds the wire format".to_string())?,
                None => STEP_NONE,
            },
        );
        push_u32(
            &mut bytes,
            match step.right_index {
                Some(value) => u32::try_from(value)
                    .map_err(|_| "embedded wasm right index exceeds the wire format".to_string())?,
                None => STEP_NONE,
            },
        );
    }

    Ok(bytes)
}

fn diff_steps_impl(ptr: *const u8, len: usize) -> Result<(), String> {
    if ptr.is_null() && len > 0 {
        return Err("embedded wasm diff input pointer is null".to_string());
    }
    let bytes = unsafe { slice::from_raw_parts(ptr, len) };
    let (left, right) = parse_diff_steps_input(bytes)?;
    let steps = diff_compare_ids(&left, &right);
    let output = encode_diff_steps_output(&steps)?;
    store_result(output);
    Ok(())
}

fn diff_inline_impl(ptr: *const u8, len: usize) -> Result<(), String> {
    if ptr.is_null() && len > 0 {
        return Err("embedded wasm inline input pointer is null".to_string());
    }
    let bytes = unsafe { slice::from_raw_parts(ptr, len) };
    let (left, right) = parse_inline_diff_input(bytes)?;
    let output = encode_range_ranges_output(&diff_inline_units(&left, &right))?;
    store_result(output);
    Ok(())
}

#[no_mangle]
pub extern "C" fn diff_engine_abi_version() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub extern "C" fn diff_engine_build_id_ptr() -> *const u8 {
    build_id().as_ptr()
}

#[no_mangle]
pub extern "C" fn diff_engine_build_id_len() -> usize {
    build_id().len()
}

#[no_mangle]
pub extern "C" fn diff_engine_alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return ptr::null_mut();
    }
    let mut bytes = Vec::<u8>::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    mem::forget(bytes);
    ptr
}

#[no_mangle]
pub extern "C" fn diff_engine_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, len);
    }
}

#[no_mangle]
pub extern "C" fn diff_engine_diff_steps(ptr: *const u8, len: usize) -> u32 {
    match diff_steps_impl(ptr, len) {
        Ok(()) => STATUS_OK,
        Err(message) => {
            store_error(message);
            STATUS_ERROR
        }
    }
}

#[no_mangle]
pub extern "C" fn diff_engine_inline_diff(ptr: *const u8, len: usize) -> u32 {
    match diff_inline_impl(ptr, len) {
        Ok(()) => STATUS_OK,
        Err(message) => {
            store_error(message);
            STATUS_ERROR
        }
    }
}

#[no_mangle]
pub extern "C" fn diff_engine_take_result_ptr() -> *mut u8 {
    take_result_ptr()
}

#[no_mangle]
pub extern "C" fn diff_engine_take_result_len() -> usize {
    take_result_len()
}

#[no_mangle]
pub extern "C" fn diff_engine_take_error_ptr() -> *mut u8 {
    take_error_ptr()
}

#[no_mangle]
pub extern "C" fn diff_engine_take_error_len() -> usize {
    take_error_len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exports_expected_abi_version() {
        assert_eq!(diff_engine_abi_version(), 1);
    }

    #[test]
    fn exports_non_empty_build_id() {
        let len = diff_engine_build_id_len();
        let ptr = diff_engine_build_id_ptr();
        assert!(!ptr.is_null());
        assert!(len > 0);
        let build_id = unsafe { core::str::from_utf8_unchecked(core::slice::from_raw_parts(ptr, len)) };
        assert!(!build_id.trim().is_empty());
    }

    #[test]
    fn allocates_and_deallocates_owned_memory() {
        let ptr = diff_engine_alloc(32);
        assert!(!ptr.is_null());
        diff_engine_dealloc(ptr, 32);
    }

    #[test]
    fn computes_diff_steps_and_exposes_the_result_buffer() {
        let mut input = Vec::new();
        push_u32(&mut input, INPUT_VERSION);
        push_u32(&mut input, 3);
        push_u32(&mut input, 3);
        push_u32(&mut input, 1);
        push_u32(&mut input, 2);
        push_u32(&mut input, 3);
        push_u32(&mut input, 1);
        push_u32(&mut input, 4);
        push_u32(&mut input, 3);

        assert_eq!(diff_engine_diff_steps(input.as_ptr(), input.len()), STATUS_OK);

        let ptr = diff_engine_take_result_ptr();
        let len = diff_engine_take_result_len();
        assert!(!ptr.is_null());
        assert!(len >= 8);
        let bytes = unsafe { Vec::from_raw_parts(ptr, len, len) };
        let mut offset = 0usize;
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), OUTPUT_VERSION);
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), 4);
    }

    #[test]
    fn computes_inline_ranges_and_exposes_the_result_buffer() {
        let left = "a1b2c3".encode_utf16().collect::<Vec<u16>>();
        let right = "a1x2y3".encode_utf16().collect::<Vec<u16>>();
        let mut input = Vec::new();
        push_u32(&mut input, INLINE_INPUT_VERSION);
        push_u32(&mut input, left.len() as u32);
        push_u32(&mut input, right.len() as u32);
        for value in &left {
            input.extend_from_slice(&value.to_le_bytes());
        }
        for value in &right {
            input.extend_from_slice(&value.to_le_bytes());
        }

        assert_eq!(diff_engine_inline_diff(input.as_ptr(), input.len()), STATUS_OK);

        let ptr = diff_engine_take_result_ptr();
        let len = diff_engine_take_result_len();
        assert!(!ptr.is_null());
        assert!(len >= 12);
        let bytes = unsafe { Vec::from_raw_parts(ptr, len, len) };
        let mut offset = 0usize;
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), INLINE_OUTPUT_VERSION);
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), 1);
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), 1);
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), 2);
        assert_eq!(read_u32(&bytes, &mut offset).unwrap(), 5);
    }
}
