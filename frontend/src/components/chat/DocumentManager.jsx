import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { deletePdfDocument, listPdfDocuments } from "../../helpers/api";

export default function DocumentManager({ open, onClose, onChange }) {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    listPdfDocuments(controller.signal).then((data) => { if (!controller.signal.aborted) { setDocuments(data.documents); setError(""); } })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [open, refresh]);
  const remove = async (id) => {
    setBusy(true); setError("");
    try {
      await deletePdfDocument(id);
      setDocuments((current) => current.filter((doc) => doc.id !== id));
      onChange();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Manage PDFs</DialogTitle>
    <DialogContent>
      {error && <Alert severity="error">{error}</Alert>}
      {!documents.length && !error && <Typography>No uploaded PDFs.</Typography>}
      {documents.map((doc) => <Box key={doc.id} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography sx={{ overflowWrap: "anywhere" }}>{doc.originalFilename}</Typography>
        <Typography variant="caption">{(doc.fileSize / 1048576).toFixed(2)} MB · {doc.status}</Typography>
        {doc.processingError && <Typography variant="caption" color="error" display="block">{doc.processingError}</Typography>}
        <Button size="small" color="error" disabled={busy || ["uploaded", "processing"].includes(doc.status)} onClick={() => remove(doc.id)}>Delete PDF</Button>
      </Box>)}
      <Typography variant="caption" color="text.secondary">Removing an attachment from a question does not delete its uploaded file. Delete files here when no longer needed.</Typography>
    </DialogContent>
    <DialogActions><Button onClick={() => setRefresh((value) => value + 1)}>Refresh</Button><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
