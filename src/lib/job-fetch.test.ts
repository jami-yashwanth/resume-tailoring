import { describe, expect, it } from "vitest";
import { jobPageToText, looksLikeUrl, validateJobUrl } from "./job-fetch";

describe("validateJobUrl", () => {
  it("accepts a public https job posting", () => {
    expect(validateJobUrl("https://www.naukri.com/job-listings-backend-123")).toBeNull();
  });

  it("accepts http", () => {
    expect(validateJobUrl("http://example.com/careers/42")).toBeNull();
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/jd.txt",
    "javascript:alert(1)",
  ])("rejects non-http schemes (%s)", (url) => {
    expect(validateJobUrl(url)).toMatch(/link/i);
  });

  it.each([
    "http://localhost:3000/admin",
    "http://127.0.0.1/latest",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/internal",
    "http://192.168.1.1/router",
    "http://172.16.0.9/x",
    "http://0.0.0.0/",
  ])("rejects private and loopback hosts (%s)", (url) => {
    expect(validateJobUrl(url)).toMatch(/link/i);
  });

  it("rejects text that is not a URL at all", () => {
    expect(validateJobUrl("Backend Engineer at Kosha")).toMatch(/link/i);
  });
});

describe("looksLikeUrl", () => {
  it("is true for a lone pasted link", () => {
    expect(looksLikeUrl("https://in.indeed.com/viewjob?jk=abc123")).toBe(true);
    expect(looksLikeUrl("  https://example.com/careers/42  ")).toBe(true);
  });

  it("is false for a pasted job description that merely contains a link", () => {
    expect(looksLikeUrl("Apply at https://example.com — requirements: Java, AWS")).toBe(false);
    expect(looksLikeUrl("Backend Engineer, 3+ years")).toBe(false);
  });
});

describe("jobPageToText", () => {
  it("drops scripts, styles, nav chrome and tags but keeps the posting text", () => {
    const html = `<html><head><style>.x{color:red}</style><script>track()</script></head>
      <body><nav>Home | Jobs</nav><header>MegaCorp</header>
      <main><h1>Backend Engineer</h1><p>3+ years of <b>Java</b> and Spring Boot.</p>
      <ul><li>Kafka</li><li>AWS</li></ul></main>
      <footer>© MegaCorp</footer></body></html>`;
    const text = jobPageToText(html);
    expect(text).toContain("Backend Engineer");
    expect(text).toContain("3+ years of Java and Spring Boot.");
    expect(text).toContain("Kafka");
    expect(text).not.toContain("track()");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Home | Jobs");
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it("decodes common entities and collapses whitespace", () => {
    const text = jobPageToText("<p>Java &amp; Spring&nbsp;Boot</p>\n\n\n<p>REST&#8211;APIs</p>");
    expect(text).toContain("Java & Spring Boot");
    expect(text.split("\n\n\n")).toHaveLength(1);
  });
});
