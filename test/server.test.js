import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { app, buildReport, functions, inngest, reports } from "../src/server.js";

let server;
let baseUrl;
const originalSend = inngest.send;
const sentEvents = [];

before(async () => {
  inngest.send = async (event) => {
    sentEvents.push(event);
    return { ids: ["test-event"] };
  };

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  inngest.send = originalSend;
  reports.clear();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("health check returns the expected status", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("home page displays the developer attribution", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const page = await response.text();
  assert.match(page, /Designed &amp; developed by <strong>K M Amith Keshav<\/strong>/);
  assert.match(page, /id="report-form"/);
  assert.match(page, /id="how-it-works"/);
  assert.match(page, /@media \(max-width: 560px\)/);
  assert.match(page, /textContent = "Read full report"/);
  assert.match(page, /id="report-dialog"/);
  assert.match(page, /dialog\.showModal\(\)/);
});

test("generated report includes readable sections and useful next steps", () => {
  const report = buildReport("ocean life");
  assert.equal(report.title, "Report about ocean life");
  assert.ok(report.summary.includes("ocean life"));
  assert.deepEqual(
    report.sections.map((section) => section.heading),
    ["Overview", "Key considerations", "Suggested next steps"],
  );
  assert.equal(typeof report.sections[0].content, "string");
  assert.ok(Array.isArray(report.sections[1].content));
  assert.ok(Array.isArray(report.sections[2].content));
  assert.ok(report.generatedAt);
});

test("missing or blank topic is rejected without sending an event", async () => {
  for (const body of [{}, { topic: "  " }, { topic: 42 }]) {
    const response = await fetch(`${baseUrl}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }

  assert.equal(sentEvents.length, 0);
});

test("valid topic is accepted and remains pollable as pending", async () => {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/reports`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: "  cats  " }),
  });
  const elapsedMs = performance.now() - startedAt;
  const accepted = await response.json();

  assert.equal(response.status, 202);
  assert.ok(elapsedMs < 1000, `Request took ${elapsedMs}ms`);
  assert.equal(accepted.status, "pending");
  assert.match(accepted.id, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(sentEvents[0], {
    name: "report/requested",
    data: { id: accepted.id, topic: "cats" },
  });

  const poll = await fetch(`${baseUrl}/reports/${accepted.id}`);
  assert.equal(poll.status, 200);
  assert.equal((await poll.json()).status, "pending");

  const list = await fetch(`${baseUrl}/reports`);
  assert.equal((await list.json()).length, 1);
});

test("unknown report returns 404", async () => {
  const response = await fetch(`${baseUrl}/reports/not-a-report`);
  assert.equal(response.status, 404);
});

test("all three Inngest functions are registered", () => {
  assert.deepEqual(
    functions.map((fn) => fn.opts.id),
    ["say-hello", "make-report", "heartbeat"],
  );
});
