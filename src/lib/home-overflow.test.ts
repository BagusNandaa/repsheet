import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const widths = [320, 360, 768];

type PageReport = {
  path: string;
  width: number;
  client: number;
  scroll: number;
  overlap: number;
  themeInHeader: boolean;
  themeOnPage: boolean;
  text: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function serverIsUp(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function startServer() {
  const port = 44721;
  const url = `http://127.0.0.1:${port}`;
  if (await serverIsUp("http://127.0.0.1:43123")) {
    return { url: "http://127.0.0.1:43123", stop: async () => {} };
  }
  const child = spawn(
    join(appRoot, "node_modules/.bin/next"),
    ["dev", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: appRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  child.stdout?.on("data", (chunk) => {
    log += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    log += chunk.toString();
  });
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (await serverIsUp(url)) return { url, stop: () => stopProcess(child) };
    if (child.exitCode !== null) break;
    await sleep(250);
  }
  await stopProcess(child);
  throw new Error(`Next did not start.\n${log.slice(-2000)}`);
}

function stopProcess(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 2000).unref();
  });
}

test("seeded home routes do not scroll sideways at phone and desktop widths", async () => {
  const server = await startServer();
  const chromeDir = mkdtempSync(join(tmpdir(), "repsheet-chrome-"));
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${chromeDir}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let chromeLog = "";
  chrome.stderr?.on("data", (chunk) => {
    chromeLog += chunk.toString();
  });
  try {
    const port = await waitForDebugPort(chromeLog, () => chromeLog);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = pages.find((page: { type: string }) => page.type === "page");
    assert.ok(target, "Chrome did not open a page");
    const browser = await connect(target.webSocketDebuggerUrl as string);
    await browser.send("Page.enable");
    await browser.send("Page.navigate", { url: server.url });
    await sleep(600);

    const routes = [
      { user: "user-jordan", path: "/home", week: true, themeOnPage: false },
      { user: "user-alex", path: "/coach", week: false, themeOnPage: false },
      { user: "user-jordan", path: "/account", week: false, themeOnPage: true },
      { user: "user-alex", path: "/coach/clients/client-jordan", week: false, themeOnPage: false },
    ];

    for (const route of routes) {
      await browser.evaluate(`localStorage.setItem("repsheet.user", ${JSON.stringify(route.user)});
        localStorage.setItem("repsheet.theme", "dark");
        localStorage.setItem("repsheet.accent", "green");`);
      await browser.send("Page.navigate", { url: `${server.url}${route.path}` });
      const readyAt = Date.now();
      let ready = false;
      let lastText = "";
      while (Date.now() - readyAt < 20000) {
        lastText = String(
          await browser.evaluate(
            `JSON.stringify({ href: location.href, text: document.body ? document.body.innerText.replace(/\\s+/g, " ").slice(0, 160) : "" })`,
          ),
        );
        if (/repsheet/i.test(lastText) && !/opening your sheet/i.test(lastText)) {
          ready = true;
          break;
        }
        await sleep(200);
      }
      assert.equal(ready, true, `${route.path} did not finish opening. Last: ${lastText}`);
      for (const width of widths) {
        await browser.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: width < 800,
        });
        await sleep(120);
        const report = (await browser.evaluate(`(() => {
          const days = [...document.querySelectorAll(".week-day")].map((node) => node.getBoundingClientRect());
          let overlap = 0;
          for (let index = 1; index < days.length; index += 1) {
            if (days[index].left < days[index - 1].right - 1) overlap += 1;
          }
          return {
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            overlap,
            themeInHeader: Boolean(document.querySelector("header [aria-label='Theme']")),
            themeOnPage: Boolean(document.querySelector("main [aria-label='Theme']")),
            text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 80),
          };
        })()`)) as Omit<PageReport, "path" | "width">;
        const page: PageReport = { path: route.path, width, ...report };
        assert.equal(
          page.scroll <= page.client + 1,
          true,
          `${route.path} at ${width}px scrolls sideways (${page.scroll} > ${page.client}). ${page.text}`,
        );
        assert.equal(page.themeInHeader, false, `${route.path} still shows theme controls in the header`);
        if (route.themeOnPage) {
          assert.equal(page.themeOnPage, true, "You is missing the theme control");
        }
        if (route.week) {
          assert.equal(page.overlap, 0, `Week strip days overlap at ${width}px`);
        }
      }
    }
  } finally {
    chrome.kill("SIGKILL");
    await server.stop();
  }
});

async function waitForDebugPort(initial: string, read: () => string) {
  const started = Date.now();
  let log = initial;
  while (Date.now() - started < 15000) {
    const match = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
    if (match?.[1]) return match[1];
    await sleep(100);
    log = read();
  }
  throw new Error(`Chrome debug port missing.\n${log.slice(-1000)}`);
}

function connect(url: string) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map<number, (message: { result?: unknown; error?: { message: string } }) => void>();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  });
  const browser = {
    send(method: string, params: object = {}) {
      const messageId = ++id;
      ws.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise<unknown>((done, fail) => {
        pending.set(messageId, (message) => {
          if (message.error) fail(new Error(message.error.message));
          else done(message.result);
        });
      });
    },
    async evaluate(expression: string) {
      const result = (await browser.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
      })) as { result?: { value: unknown }; exceptionDetails?: { text: string } };
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "eval failed");
      return result.result?.value;
    },
  };
  return new Promise<typeof browser>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(browser));
    ws.addEventListener("error", () => reject(new Error("Chrome socket failed")));
  });
}
