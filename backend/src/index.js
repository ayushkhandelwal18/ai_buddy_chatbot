import app from "./app.js";
import { connectToDatabase } from "./db/connection.js";
import { startPdfCleanup } from "./services/pdf-storage.service.js";

//connections and listners

const PORT = process.env.PORT || 3000;
await startPdfCleanup();
connectToDatabase()
  .then(() => {
    app.listen(PORT, () => console.log("Server started & Connected To Database "));
  })
  .catch((err) => console.log(err));
