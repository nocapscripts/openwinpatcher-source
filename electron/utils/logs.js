import fs from "fs";
import path from "path";

export function CreateLog(type, msg) {
  const logDir = path.join(process.cwd(), "logs");

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const date = new Date();

  const timestamp = date.toISOString();
  const logFile = path.join(logDir, `${type}.log`);

  const logMessage = `[${timestamp}] ${msg}\n`;

  // Append log to the appropriate file
  fs.appendFileSync(logFile, logMessage, "utf8");
}
