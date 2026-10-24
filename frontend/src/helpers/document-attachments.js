export const attachmentReadiness = (records, contextLoading = false, contextError = "") => {
  if (contextError) return { blocked: true, message: contextError };
  if (contextLoading) return { blocked: true, message: "Checking conversation PDFs…" };
  if (records.some((record) => record.status === "failed" || record.status === "status-error")) {
    return { blocked: true, message: "A PDF needs attention. Retry, refresh its status, or remove it before sending." };
  }
  if (records.some((record) => record.status !== "ready" || !record.id)) {
    return { blocked: true, message: "Wait for your attached PDFs to finish uploading and processing." };
  }
  return { blocked: false, message: records.length ? "Questions will use only the PDFs attached to this conversation." : "" };
};
