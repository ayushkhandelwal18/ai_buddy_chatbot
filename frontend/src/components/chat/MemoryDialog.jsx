import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Switch, Typography } from "@mui/material";
import { clearSavedMemories, deleteSavedMemory, getSavedMemories, updateMemorySettings } from "../../helpers/api";

export default function MemoryDialog({ open, onClose }) {
  const [memories, setMemories] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(""); setBusy(false); setConfirmClear(false);
    getSavedMemories(controller.signal).then((data) => {
      if (!controller.signal.aborted) { setMemories(data.memories); setEnabled(data.enabled); }
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, refresh]);

  const mutate = async (work, apply) => {
    const controller = request.current;
    if (!controller || controller.signal.aborted || busy) return;
    setBusy(true); setError("");
    try {
      const result = await work(controller.signal);
      if (!controller.signal.aborted) apply(result);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const disabled = loading || busy;

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="memory-title">
    <DialogTitle id="memory-title">Memory</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        AI-Buddy can remember explicit personal facts and preferences across your chats. PDF contents and assistant replies are not saved as memories. Avoid sharing secrets.
      </Typography>
      <FormControlLabel label="Save and use memory" control={<Switch checked={enabled} disabled={disabled || !!error}
        onChange={(_, checked) => mutate((signal) => updateMemorySettings(checked, signal), (data) => setEnabled(data.enabled))} />} />
      {!enabled && <Alert severity="info" sx={{ mb: 1 }}>Memory is paused. Existing memories are kept but are not used or updated.</Alert>}
      {loading && <LinearProgress aria-label="Loading memories" />}
      {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
      {!loading && !error && !memories.length && <Typography sx={{ py: 2 }}>No saved memories yet. Try “My name is …” or “I study at …” in a chat.</Typography>}
      {!loading && memories.map((memory) => <Box key={memory.id} sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">{memory.category} · {memory.key.includes(".") ? memory.key.split(".")[0] : memory.key.replaceAll("_", " ")}</Typography>
        <Typography sx={{ overflowWrap: "anywhere" }}>{memory.value}</Typography>
        {memory.status === "conflict" && <Alert severity="warning" sx={{ mt: 0.5 }}>
          Needs confirmation. Also stated: {memory.alternatives.join("; ")}. Correct it in chat, for example “Actually, my college is …”.
        </Alert>}
        <Typography display="block" variant="caption" color="text.secondary">
          Updated {new Date(memory.updatedAt).toLocaleDateString()}{memory.expiresAt ? ` · Expires ${new Date(memory.expiresAt).toLocaleDateString()}` : ""}
        </Typography>
        <Button size="small" color="error" disabled={disabled} onClick={() => mutate((signal) => deleteSavedMemory(memory.id, signal), () => setMemories((current) => current.filter((item) => item.id !== memory.id)))}>Delete memory</Button>
      </Box>)}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        Correct facts with “Actually, my name is …”. Learning topics and goals expire; stable facts remain until deleted. Memory stores up to 128 facts. Deleting memory does not delete original chat messages, which can still appear in that chat’s history.
      </Typography>
      {confirmClear && <Alert severity="warning" sx={{ mt: 1 }}>
        Clear all saved memories? This cannot be undone.
        <Box><Button color="error" disabled={disabled} onClick={() => mutate(clearSavedMemories, () => { setMemories([]); setConfirmClear(false); })}>Confirm clear</Button>
          <Button disabled={disabled} onClick={() => setConfirmClear(false)}>Cancel</Button></Box>
      </Alert>}
    </DialogContent>
    <DialogActions sx={{ flexWrap: "wrap" }}>
      <Button color="error" disabled={disabled || !memories.length} onClick={() => setConfirmClear(true)}>Clear memories</Button>
      <Button disabled={disabled} onClick={() => setRefresh((value) => value + 1)}>Refresh</Button>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>;
}
