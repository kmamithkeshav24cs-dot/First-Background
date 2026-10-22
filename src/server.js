import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express from "express";
import { Inngest } from "inngest";
import { serve } from "inngest/express";

export const reports = new Map();
export const inngest = new Inngest({ id: "report-api" });

export function buildReport(topic) {
  return {
    title: `Report about ${topic}`,
    summary: `This report was generated for the topic "${topic}".`,
    sections: [
      {
        heading: "Overview",
        content: `${topic} is the focus of this report. Use this overview to frame the subject, identify the audience, and decide which questions matter most.`,
      },
      {
        heading: "Key considerations",
        content: [
          `Define the scope of ${topic} so the most relevant details are easy to compare.`,
          "Look at the opportunities, challenges, and context before drawing conclusions.",
          "Check important claims against current, reliable sources when using this report for research or decisions.",
        ],
      },
      {
        heading: "Suggested next steps",
        content: [
          `Choose one specific question about ${topic} to explore in more depth.`,
          "Gather up-to-date sources and evidence for that question.",
          "Summarize what you learn and note any remaining uncertainties.",
        ],
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export const sayHello = inngest.createFunction(
  { id: "say-hello" },
  { event: "test/hello" },
  async ({ step }) => {
    await step.sleep("wait-five-seconds", "5s");
    return "Hello from the background!";
  },
);

export const makeReport = inngest.createFunction(
  {
    id: "make-report",
    retries: 2,
    concurrency: { limit: 2 },
    onFailure: async ({ event, error }) => {
      const reportId = event.data.event.data.id;
      const report = reports.get(reportId);
      if (report) {
        report.status = "failed";
        report.error = error.message;
        report.updatedAt = new Date().toISOString();
      }
    },
  },
  { event: "report/requested" },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    await step.sleep("do-the-slow-work", "8s");

    return step.run("build-report", async () => {
      const report = reports.get(id);
      if (!report) {
        throw new Error(`Report ${id} is not available in this API process.`);
      }
      if (report.status === "done") {
        return report.result;
      }
      if (topic === "fail") {
        throw new Error("The report oven is broken!");
      }

      const result = buildReport(topic);

      report.status = "done";
      report.result = result;
      report.updatedAt = result.generatedAt;
      return result;
    });
  },
);

export const heartbeat = inngest.createFunction(
  { id: "heartbeat" },
  { cron: "* * * * *" },
  async ({ step }) =>
    step.run("log-report-summary", async () => {
      const summary = {
        pending: 0,
        done: 0,
        failed: 0,
      };
      for (const report of reports.values()) {
        summary[report.status] += 1;
      }

      console.log(
        `[heartbeat] pending=${summary.pending} done=${summary.done} failed=${summary.failed}`,
      );
      return summary;
    }),
);

export const functions = [sayHello, makeReport, heartbeat];
export const app = express();

app.use(express.json());
app.get("/", (_request, response) => {
  response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#10191c">
    <meta name="description" content="A live demo of fast APIs and durable background jobs, built by K M Amith Keshav.">
    <title>Your First Background Job — K M Amith Keshav</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #fbfcfa;
        color: #172522;
        font-synthesis: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        --muted: #62716a;
        --mint: #147a56;
        --line: rgba(32, 69, 52, .13);
      }
      * { box-sizing: border-box; }
      body {
        min-width: 320px;
        min-height: 100vh;
        margin: 0;
        background:
          radial-gradient(ellipse at 82% 12%, rgba(183, 247, 216, .36), transparent 31rem),
          radial-gradient(ellipse at 6% 48%, rgba(251, 225, 196, .35), transparent 30rem),
          #fbfcfa;
      }
      a { color: inherit; text-decoration: none; }
      button, input { font: inherit; }
      .shell { width: min(1120px, calc(100% - 48px)); margin-inline: auto; }
      .topbar {
        min-height: 78px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--line);
      }
      .brand { display: flex; align-items: center; gap: 11px; font-size: 14px; font-weight: 750; letter-spacing: .02em; }
      .brand-mark {
        width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px;
        background: #d9f7e7; color: #126345; font-size: 17px; font-weight: 900;
      }
      .top-links { display: flex; gap: 25px; align-items: center; color: #53635b; font-size: 13px; }
      .top-links a:hover, .text-link:hover { color: var(--mint); }
      .hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px; align-items: center; padding-block: 86px 74px; }
      .eyebrow { display: inline-flex; align-items: center; gap: 9px; color: var(--mint); font-size: 11px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }
      .eyebrow::before { content: ""; width: 21px; height: 1px; background: var(--mint); }
      h1 { max-width: 620px; margin: 20px 0 19px; font-size: clamp(44px, 6.5vw, 76px); line-height: .99; letter-spacing: -.065em; font-weight: 700; }
      h1 span { color: #16835b; }
      .intro { max-width: 495px; color: #56665e; font-size: 16px; line-height: 1.75; }
      .byline { margin-top: 25px; color: var(--muted); font-size: 13px; }
      .byline strong { color: #172522; font-weight: 650; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 29px; }
      .button {
        min-height: 45px; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
        padding: 0 17px; border: 1px solid rgba(32,69,52,.2); border-radius: 9px; color: #25352e;
        background: rgba(255,255,255,.78); font-size: 13px; font-weight: 650; transition: .2s ease;
      }
      .button:hover { transform: translateY(-2px); border-color: rgba(20,122,86,.48); box-shadow: 0 7px 18px rgba(25,92,62,.09); }
      .button-primary { color: #fff; background: #167a56; border-color: #167a56; }
      .button-primary:hover { background: #106443; }
      .demo {
        position: relative; overflow: hidden; padding: 25px; border: 1px solid rgba(32,69,52,.13);
        border-radius: 17px; background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(246,251,247,.98));
        box-shadow: 0 24px 70px rgba(32,69,52,.10);
      }
      .demo::before { content: ""; position: absolute; width: 180px; height: 180px; top: -100px; right: -80px; border-radius: 50%; background: rgba(183,247,216,.35); filter: blur(8px); }
      .demo-head { position: relative; display: flex; justify-content: space-between; align-items: center; padding-bottom: 19px; border-bottom: 1px solid var(--line); }
      .demo-title { color: #20352b; font-size: 13px; font-weight: 700; }
      .live { display: inline-flex; align-items: center; gap: 7px; color: var(--mint); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
      .live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #34b779; box-shadow: 0 0 12px rgba(52,183,121,.35); }
      .demo-copy { margin: 18px 0 19px; color: var(--muted); font-size: 12px; line-height: 1.6; }
      .form-label { display: block; margin-bottom: 8px; color: #34463c; font-size: 11px; font-weight: 650; }
      .form-row { display: flex; gap: 9px; }
      .form-row input {
        width: 100%; min-width: 0; height: 43px; padding: 0 12px; border: 1px solid var(--line);
        border-radius: 8px; outline: none; color: #20352b; background: #fff; font-size: 13px;
      }
      .form-row input:focus { border-color: rgba(20,122,86,.62); box-shadow: 0 0 0 3px rgba(20,122,86,.11); }
      .form-row button { flex: 0 0 auto; border: 0; cursor: pointer; }
      .form-row button:disabled { opacity: .65; cursor: wait; }
      .result {
        display: none; margin-top: 15px; padding: 13px; border: 1px solid var(--line);
        border-radius: 8px; color: #30473b; background: #f5faf6;
        font: 11px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; white-space: pre-wrap;
      }
      .result[data-visible="true"] { display: block; }
      .flow { display: flex; align-items: center; gap: 8px; margin-top: 20px; color: #596b61; font-size: 10px; }
      .flow span { padding: 7px 9px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
      .flow b { color: var(--mint); font-weight: 500; }
      .section { padding-block: 29px 75px; }
      .section-heading { display: flex; justify-content: space-between; align-items: end; gap: 22px; margin-bottom: 20px; }
      .section-heading h2 { margin: 8px 0 0; font-size: 25px; letter-spacing: -.04em; }
      .section-heading p { margin: 0; color: var(--muted); font-size: 12px; }
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; }
      .card { min-height: 142px; padding: 19px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.82); box-shadow: 0 8px 26px rgba(32,69,52,.035); }
      .card-number { color: var(--mint); font: 11px ui-monospace, monospace; }
      .card h3 { margin: 17px 0 7px; color: #20352b; font-size: 14px; }
      .card p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.65; }
      .footer { display: flex; justify-content: space-between; gap: 20px; padding-block: 18px 26px; border-top: 1px solid var(--line); color: #94a29b; font-size: 11px; }
      .footer a { color: #3c6851; }
      .report-ready { display: grid; gap: 8px; }
      .report-ready strong { color: #20352b; font: 700 13px/1.4 Inter, ui-sans-serif, system-ui, sans-serif; }
      .report-ready p { margin: 0; color: #596b61; font: 12px/1.65 Inter, ui-sans-serif, system-ui, sans-serif; }
      .report-ready .button { justify-self: start; min-height: 36px; margin-top: 3px; font: 650 11px/1 Inter, ui-sans-serif, system-ui, sans-serif; }
      .report-dialog {
        width: min(620px, calc(100% - 32px)); max-height: min(80vh, 760px); padding: 0;
        border: 1px solid rgba(32,69,52,.16); border-radius: 16px; color: #172522;
        background: #fff; box-shadow: 0 28px 90px rgba(18,47,32,.23);
      }
      .report-dialog::backdrop { background: rgba(17,34,26,.48); backdrop-filter: blur(4px); }
      .report-dialog-header {
        position: sticky; top: 0; display: flex; justify-content: space-between; align-items: start;
        gap: 20px; padding: 22px 24px 17px; border-bottom: 1px solid var(--line);
        background: rgba(255,255,255,.96);
      }
      .report-dialog-kicker { margin: 0 0 7px; color: #16835b; font-size: 10px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
      .report-dialog-header h2 { margin: 0; color: #172522; font-size: clamp(20px, 4vw, 27px); letter-spacing: -.04em; }
      .report-close {
        flex: 0 0 auto; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 9px;
        color: #34463c; background: #fff; cursor: pointer; font-size: 19px;
      }
      .report-dialog-body { padding: 7px 24px 25px; }
      .report-disclaimer { margin: 13px 0 20px; padding: 11px 13px; border-radius: 8px; color: #506258; background: #f2f8f3; font-size: 11px; line-height: 1.6; }
      .report-section { padding: 15px 0; border-bottom: 1px solid var(--line); }
      .report-section:last-child { border-bottom: 0; }
      .report-section h3 { margin: 0 0 8px; color: #20352b; font-size: 14px; }
      .report-section p, .report-section li { color: #56665e; font-size: 12px; line-height: 1.75; }
      .report-section p { margin: 0; }
      .report-section ul { display: grid; gap: 7px; margin: 0; padding-left: 19px; }
      @media (max-width: 800px) {
        .hero { grid-template-columns: 1fr; gap: 36px; padding-block: 64px 50px; }
        .demo { max-width: 620px; }
      }
      @media (max-width: 560px) {
        .shell { width: min(100% - 32px, 440px); }
        .topbar { min-height: 67px; }
        .top-links { gap: 14px; font-size: 11px; }
        .hero { padding-top: 49px; }
        h1 { font-size: clamp(43px, 13vw, 62px); }
        .intro { font-size: 14px; }
        .demo { padding: 18px; }
        .flow { flex-wrap: wrap; }
        .cards { grid-template-columns: 1fr; }
        .card { min-height: 0; }
        .section-heading { align-items: start; flex-direction: column; }
        .footer { flex-direction: column; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
      }
    </style>
  </head>
  <body>
    <header class="shell topbar">
      <a class="brand" href="/" aria-label="Your First Background Job home">
        <span class="brand-mark" aria-hidden="true">B</span>
        <span>BUILD IN THE BACKGROUND</span>
      </a>
      <nav class="top-links" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="http://localhost:8288/functions">Inngest dashboard ↗</a>
      </nav>
    </header>
    <main class="shell">
      <section class="hero" aria-labelledby="hero-title">
        <div>
          <div class="eyebrow">A tiny API with a big idea</div>
          <h1 id="hero-title">Your first<br><span>background</span><br>job.</h1>
          <p class="intro">Good APIs don't make you wait. Send a report request, get a response right away, and let a background worker take care of the slow part.</p>
          <p class="byline">Designed &amp; developed by <strong>K M Amith Keshav</strong></p>
          <div class="actions">
            <a class="button button-primary" href="#try-it">Try a live report <span aria-hidden="true">↓</span></a>
            <a class="button" href="http://localhost:8288/functions">Explore the functions <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <section class="demo" id="try-it" aria-labelledby="demo-title">
          <div class="demo-head">
            <div class="demo-title" id="demo-title">Make a report</div>
            <div class="live">API is live</div>
          </div>
          <p class="demo-copy">Enter a topic. The API accepts your request instantly, then the worker builds your report in the background.</p>
          <form id="report-form">
            <label class="form-label" for="topic">Report topic</label>
            <div class="form-row">
              <input id="topic" name="topic" type="text" value="cats" placeholder="e.g. ocean life" maxlength="120" required>
              <button class="button button-primary" id="submit-report" type="submit">Start report <span aria-hidden="true">→</span></button>
            </div>
          </form>
          <div class="result" id="report-result" role="status" aria-live="polite" data-visible="false"></div>
          <div class="flow" aria-label="Report process">
            <span>Request</span><b aria-hidden="true">→</b><span>202 Accepted</span><b aria-hidden="true">→</b><span>Background work</span><b aria-hidden="true">→</b><span>Report ready</span>
          </div>
        </section>
      </section>
      <section class="section" id="how-it-works" aria-labelledby="how-title">
        <div class="section-heading">
          <div><div class="eyebrow">Fast door, slow work</div><h2 id="how-title">Three small parts. One better flow.</h2></div>
          <p>Powered by Express + Inngest</p>
        </div>
        <div class="cards">
          <article class="card"><div class="card-number">01 / ACCEPT</div><h3>Reply right away</h3><p>Your request gets an ID and a <code>202 Accepted</code>—without waiting for the report.</p></article>
          <article class="card"><div class="card-number">02 / PROCESS</div><h3>Let the worker work</h3><p>Inngest handles the slow steps, retries failures, and keeps each job visible.</p></article>
          <article class="card"><div class="card-number">03 / CHECK</div><h3>See when it's ready</h3><p>Poll the status endpoint for progress, then read the finished report.</p></article>
        </div>
      </section>
      <footer class="footer">
        <span>Built with care by <strong>K M Amith Keshav</strong></span>
        <span><a href="/health">API health</a> &nbsp;·&nbsp; <a href="http://localhost:8288/functions">Inngest functions</a></span>
      </footer>
    </main>
    <dialog class="report-dialog" id="report-dialog" aria-labelledby="report-dialog-title">
      <div class="report-dialog-header">
        <div>
          <p class="report-dialog-kicker">Your generated report</p>
          <h2 id="report-dialog-title"></h2>
        </div>
        <button class="report-close" id="close-report" type="button" aria-label="Close report">×</button>
      </div>
      <div class="report-dialog-body">
        <p class="report-disclaimer">This generated starter report provides a structure for exploration, not verified research. Check important facts against current, reliable sources.</p>
        <div id="report-content"></div>
      </div>
    </dialog>
    <script>
      const form = document.getElementById("report-form");
      const button = document.getElementById("submit-report");
      const output = document.getElementById("report-result");
      const dialog = document.getElementById("report-dialog");
      const closeReport = document.getElementById("close-report");
      const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

      function showReport(report) {
        document.getElementById("report-dialog-title").textContent = report.title;
        const content = document.getElementById("report-content");
        content.replaceChildren();
        for (const section of report.sections) {
          const article = document.createElement("section");
          article.className = "report-section";
          const heading = document.createElement("h3");
          heading.textContent = section.heading;
          article.append(heading);

          if (Array.isArray(section.content)) {
            const list = document.createElement("ul");
            for (const item of section.content) {
              const listItem = document.createElement("li");
              listItem.textContent = item;
              list.append(listItem);
            }
            article.append(list);
          } else {
            const paragraph = document.createElement("p");
            paragraph.textContent = section.content;
            article.append(paragraph);
          }
          content.append(article);
        }
        dialog.showModal();
      }

      closeReport.addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        button.disabled = true;
        output.dataset.visible = "true";
        output.textContent = "Sending request…";

        try {
          const acceptedResponse = await fetch("/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: document.getElementById("topic").value })
          });
          const accepted = await acceptedResponse.json();
          if (!acceptedResponse.ok) {
            throw new Error(accepted.error || "Could not start the report.");
          }

          output.textContent = "Accepted in the background · ID " + accepted.id + "\\nStatus: pending";
          for (let attempt = 0; attempt < 15; attempt += 1) {
            await pause(1000);
            const statusResponse = await fetch("/reports/" + encodeURIComponent(accepted.id));
            const report = await statusResponse.json();
            if (!statusResponse.ok) {
              throw new Error(report.error || "Could not check report status.");
            }
            if (report.status === "done") {
              const ready = document.createElement("div");
              ready.className = "report-ready";
              const title = document.createElement("strong");
              title.textContent = "Report ready · " + report.result.title;
              const summary = document.createElement("p");
              summary.textContent = report.result.summary;
              const viewButton = document.createElement("button");
              viewButton.className = "button button-primary";
              viewButton.type = "button";
              viewButton.textContent = "Read full report";
              viewButton.addEventListener("click", () => showReport(report.result));
              ready.append(title, summary, viewButton);
              output.replaceChildren(ready);
              return;
            }
            if (report.status === "failed") {
              throw new Error(report.error || "The report job failed.");
            }
            output.textContent = "Accepted in the background · ID " + accepted.id + "\\nStatus: " + report.status + " · checking again…";
          }
          output.textContent = "The job is still running. Check its status at /reports/" + accepted.id;
        } catch (error) {
          output.textContent = "Could not complete the request: " + error.message;
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`);
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/inngest", serve({ client: inngest, functions }));

app.post("/reports", async (request, response, next) => {
  const topic =
    typeof request.body?.topic === "string" ? request.body.topic.trim() : "";

  if (!topic) {
    return response.status(400).json({ error: "A non-empty topic is required." });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  reports.set(id, { id, topic, status: "pending", createdAt, updatedAt: createdAt });

  try {
    await inngest.send({
      name: "report/requested",
      data: { id, topic },
    });
  } catch (error) {
    reports.delete(id);
    return next(error);
  }

  return response.status(202).json({ id, status: "pending" });
});

app.get("/reports", (_request, response) => {
  response.json([...reports.values()]);
});

app.get("/reports/:id", (request, response) => {
  const report = reports.get(request.params.id);
  if (!report) {
    return response.status(404).json({ error: "Report not found." });
  }
  return response.json(report);
});

app.use((error, _request, response, _next) => {
  console.error("[api] Request failed:", error);
  response.status(500).json({ error: "The request could not be completed." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Report API listening at http://localhost:${port}`);
  });
}
