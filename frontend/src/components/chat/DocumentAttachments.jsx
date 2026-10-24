import { Alert, Box, Button, CircularProgress, IconButton, LinearProgress, Typography } from "@mui/material";
import { MdCheckCircle, MdClose, MdPictureAsPdf } from "react-icons/md";

const labels = { queued: "Waiting to upload", uploading: "Uploading", uploaded: "Processing", processing: "Processing", checking: "Checking status", ready: "Ready", failed: "Failed", "status-error": "Status unavailable" };

export default function DocumentAttachments({ attachments, disabled }) {
  return <Box aria-live="polite" sx={{ mb: attachments.records.length ? 1 : 0 }}>
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", maxHeight: 190, overflowY: "auto" }}>
      {attachments.records.map((record) => <Box key={record.key} sx={{ width: { xs: "100%", sm: 270 }, border: "1px solid", borderColor: record.status === "failed" ? "error.main" : "divider", borderRadius: 2, p: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <MdPictureAsPdf size={24} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap title={record.originalFilename}>{record.originalFilename}</Typography>
            <Typography variant="caption" color="text.secondary">
              {record.fileSize > 0 && (record.fileSize / 1048576).toFixed(2) + " MB · "}
              {labels[record.status] || record.status}{record.status === "uploading" ? " " + (record.progress || 0) + "%" : ""}
            </Typography>
          </Box>
          {record.status === "ready" ? <MdCheckCircle color="#22d3ee" /> : !["failed", "status-error", "queued"].includes(record.status) && <CircularProgress size={16} />}
          <IconButton size="small" disabled={disabled} aria-label={"Remove " + record.originalFilename + " attachment"} onClick={() => attachments.remove(record.key)}><MdClose /></IconButton>
        </Box>
        {record.status === "uploading" && <LinearProgress sx={{ mt: 0.5 }} variant="determinate" value={record.progress || 0} />}
        {record.processingError && <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>{record.processingError}</Typography>}
        {record.status === "failed" && record.file && <Button size="small" disabled={disabled} onClick={() => attachments.retry(record.key)}>Retry upload</Button>}
        {record.status === "failed" && !record.file && <Typography variant="caption" display="block">Choose the original PDF again using +, or remove this attachment.</Typography>}
        {record.status === "status-error" && <Button size="small" disabled={disabled} onClick={attachments.refresh}>Refresh status</Button>}
      </Box>)}
    </Box>
    {attachments.error && <Alert severity="error" sx={{ mt: 1 }}>{attachments.error}</Alert>}
    {attachments.message && <Box sx={{ mt: 0.75 }}>
      <Typography variant="caption" color={attachments.blocked ? "warning.main" : "text.secondary"}>{attachments.message}</Typography>
      {attachments.blocked && !attachments.records.length && <Button size="small" onClick={attachments.refresh}>Retry status check</Button>}
    </Box>}
  </Box>;
}
