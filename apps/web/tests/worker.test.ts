import { expect, test } from "bun:test";
import worker from "../src/worker";

const env = { ASSETS: { async fetch(request: Request) {
  if (new URL(request.url).pathname === "/index.md") return new Response("# tcut");
  return new Response(request.method === "HEAD" ? null : "<html>tcut</html>", { headers: { "content-type": "text/html", vary: "Accept-Encoding" } });
} } };

test("markdown negotiation honors quality weights and explicit exclusions", async () => {
  for (const accept of ["text/html;q=0.2, text/markdown;q=0.9", "text/markdown", "text/markdown, text/html"]) {
    const response = await worker.fetch(new Request("https://example.com/", { headers: { accept } }), env);
    expect(await response.text()).toBe("# tcut");
  }
  for (const accept of ["text/markdown;q=0, text/html", "text/markdown;q=0.1, text/html;q=0.9", "text/html, text/markdown", "*/*"]) {
    const response = await worker.fetch(new Request("https://example.com/", { headers: { accept } }), env);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("vary")).toBe("Accept-Encoding, Accept");
  }
});

test("HEAD negotiates markdown headers without a body", async () => {
  const response = await worker.fetch(new Request("https://example.com/", { method: "HEAD", headers: { accept: "text/markdown" } }), env);
  expect(response.headers.get("content-type")).toContain("text/markdown");
  expect(await response.text()).toBe("");
});

test("POST requests are delegated to the asset handler", async () => {
  const response = await worker.fetch(new Request("https://example.com/", { method: "POST", headers: { accept: "text/markdown" } }), env);
  expect(response.headers.get("content-type")).toBe("text/html");
});
