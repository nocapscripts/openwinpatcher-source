import React, { useEffect, useState } from "react";

const REPO = "nocapscripts/openwinpatcher-source";

export default function Report({ lastStatus }) {
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [steps, setSteps] = useState("");
  const [includeSys, setIncludeSys] = useState(true);
  const [sys, setSys] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { window.api?.sysInfo?.().then(setSys); }, []);

  const isBug = type === "bug";
  const valid = title.trim() && details.trim();

  const body = () => [
    `**Type:** ${isBug ? "Bug / debug problem" : "Feature request"}`,
    `**Details:**\n${details}`,
    isBug && steps.trim() ? `**Steps to reproduce:**\n${steps}` : "",
    isBug && lastStatus ? `**Last status message:** ${lastStatus}` : "",
    includeSys && sys ? `**System:** ${sys.os} | App ${sys.app} | Electron ${sys.electron}` : "",
  ].filter(Boolean).join("\n\n");

  const send = async () => {
    const url = `https://github.com/${REPO}/issues/new?labels=${isBug ? "bug" : "enhancement"}` +
      `&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body())}`;
    const ok = await window.api?.openExternal?.(url);
    setMsg(ok ? "Opened in your browser. Review it and press Submit new issue." : "Could not open the browser. Use Copy report instead.");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${body()}`);
    setMsg("Report copied to the clipboard.");
  };

  return (
    <>
      <h1>Report</h1>
      <p className="note">Report a problem or suggest a feature. Reports are sent as GitHub issues.</p>
      <div className="form">
        <div className="seg">
          <button className={"btn" + (isBug ? " on" : "")} onClick={() => setType("bug")}>Bug / problem</button>
          <button className={"btn" + (!isBug ? " on" : "")} onClick={() => setType("feature")}>Feature request</button>
        </div>
        <input type="text" placeholder="Short title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder={isBug ? "What went wrong?" : "What would you like added, and why?"}
          value={details} onChange={(e) => setDetails(e.target.value)} />
        {isBug && <textarea placeholder="Steps to reproduce (optional)" value={steps} onChange={(e) => setSteps(e.target.value)} />}
        <label className="row">
          <input type="checkbox" checked={includeSys} onChange={(e) => setIncludeSys(e.target.checked)} />
          <span><b>Include system info</b><small>{sys ? `${sys.os}, app ${sys.app}` : "Windows version and app version"}</small></span>
        </label>
        <div className="toolbar">
          <button className="btn danger" disabled={!valid} onClick={send}>Send via GitHub</button>
          <button className="btn" disabled={!valid} onClick={copy}>Copy report</button>
        </div>
        {msg && <p className="note">{msg}</p>}
      </div>
    </>
  );
}
