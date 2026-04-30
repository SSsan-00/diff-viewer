const ABI_VERSION: u32 = 1;

fn build_id() -> &'static str {
    match option_env!("DIFF_VIEWER_WASM_BUILD_ID") {
        Some(value) => value,
        None => "workspace",
    }
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
        return core::ptr::null_mut();
    }
    let mut bytes = Vec::<u8>::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    core::mem::forget(bytes);
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
}
