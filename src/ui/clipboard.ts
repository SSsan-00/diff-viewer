export async function copyText(
  value: string,
  doc: Document = document,
): Promise<boolean> {
  if (!value) {
    return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    console.warn("Clipboard API failed:", error);
  }

  try {
    const textarea = doc.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    doc.body.appendChild(textarea);
    textarea.select();
    const ok = doc.execCommand("copy");
    doc.body.removeChild(textarea);
    return ok;
  } catch (error) {
    console.warn("execCommand copy failed:", error);
    return false;
  }
}
