import React, { useEffect, useState } from "react";
import { Btn, Checkbox, H1, Note, Row, RowText, Toolbar, cx, textField } from "./components/ui.jsx";

const REPO = "nocapscripts/openwinpatcher-source";

export default function Report({ lastStatus }) {
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [steps, setSteps] = useState("");
  const [includeSys, setIncludeSys] = useState(true);
  const [sys, setSys] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    window.api?.sysInfo?.().then(setSys);
  }, []);

  const isBug = type === "bug";
  const valid = title.trim() && details.trim();

  const body = () =>
    [
      `**Type:** ${isBug ? "Bug / debug problem" : "Feature request"}`,
      `**Details:**\n${details}`,
      isBug && steps.trim() ? `**Steps to reproduce:**\n${steps}` : "",
      isBug && lastStatus ? `**Last status message:** ${lastStatus}` : "",
      includeSys && sys ? `**System:** ${sys.os} | App ${sys.app} | Electron ${sys.electron}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

  const send = async () => {
    const url =
      `https://github.com/${REPO}/issues/new?labels=${isBug ? "bug" : "enhancement"}` +
      `&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body())}`;
    const ok = await window.api?.openExternal?.(url);
    setMsg(
      ok
        ? "Opened in your browser. Review it and press Submit new issue."
        : "Could not open the browser. Use Copy report instead."
    );
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${body()}`);
    setMsg("Report copied to the clipboard.");
  };

  const segBtn = (on) =>
    cx(
      "h-8 rounded-md border-0 px-4 font-medium transition",
      on ? "bg-accent-strong text-ink" : "bg-transparent text-muted hover:bg-panel-2 hover:text-text"
    );

  return (
    <div className="flex-1 overflow-y-auto">
      <H1>Report</H1>
      <Note>Report a problem or suggest a feature. Reports are sent as GitHub issues.</Note>

      <div className="mt-3 flex max-w-[640px] flex-col gap-2.5 pb-4">
        <div className="inline-flex w-fit gap-0.5 rounded-lg border border-line-2 bg-panel p-[3px]">
          <button className={segBtn(isBug)} onClick={() => setType("bug")}>Bug / problem</button>
          <button className={segBtn(!isBug)} onClick={() => setType("feature")}>Feature request</button>
        </div>

        <input
          type="text"
          className={textField}
          placeholder="Short title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={cx(textField, "min-h-24 resize-y")}
          placeholder={isBug ? "What went wrong?" : "What would you like added, and why?"}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        {isBug && (
          <textarea
            className={cx(textField, "min-h-24 resize-y")}
            placeholder="Steps to reproduce (optional)"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        )}

        <Row>
          <Checkbox checked={includeSys} onChange={(e) => setIncludeSys(e.target.checked)} />
          <RowText
            title="Include system info"
            desc={sys ? `${sys.os}, app ${sys.app}` : "Windows version and app version"}
          />
        </Row>

        <Toolbar>
          <Btn variant="primary" disabled={!valid} onClick={send}>Send via GitHub</Btn>
          <Btn disabled={!valid} onClick={copy}>Copy report</Btn>
        </Toolbar>

        {msg && <Note>{msg}</Note>}
      </div>
    </div>
  );
}
