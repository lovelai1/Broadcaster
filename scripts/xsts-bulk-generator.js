#!/usr/bin/env node
"use strict";

const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const LOGIN_URL =
  "https://login.live.com/oauth20_authorize.srf" +
  "?client_id=0000000048093EE3" +
  "&response_type=token" +
  "&redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf" +
  "&scope=XboxLive.signin%20offline_access";

const ACCOUNTS_PATH = path.resolve(process.cwd(), "accounts.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "valid_tokens.json");

const randomBetween = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = async (minMs = 2000, maxMs = 5000) => {
  await delay(randomBetween(minMs, maxMs));
};

const humanType = async (page, selector, text) => {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, text, { delay: randomBetween(60, 140) });
};

const extractAccessToken = (url) => {
  if (!url || !url.includes("access_token=")) {
    return null;
  }

  const hash = new URL(url).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("access_token");
};

const getXboxLiveToken = async (accessToken) => {
  const response = await axios.post(
    "https://user.auth.xboxlive.com/user/authenticate",
    {
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${accessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data?.Token;
};

const getXstsToken = async (xboxLiveToken) => {
  const response = await axios.post(
    "https://xsts.auth.xboxlive.com/xsts/authorize",
    {
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xboxLiveToken],
      },
      RelyingParty: "http://xboxlive.com",
      TokenType: "JWT",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const xuid = response.data?.DisplayClaims?.xui?.[0]?.uhs;

  return { xsts: response.data?.Token, xuid };
};

const appendValidToken = async (entry) => {
  let existing = [];

  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf8");
    existing = JSON.parse(raw);
    if (!Array.isArray(existing)) {
      existing = [];
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  existing.push(entry);
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(existing, null, 2));
};

const handleStaySignedIn = async (page) => {
  const staySignedSelector = "#idBtn_Back";
  const yesSelector = "#idSIButton9";

  try {
    await page.waitForSelector(`${staySignedSelector}, ${yesSelector}`, {
      visible: true,
      timeout: 8000,
    });
  } catch (error) {
    return;
  }

  if (await page.$(staySignedSelector)) {
    await randomDelay(800, 1600);
    await page.click(staySignedSelector);
    return;
  }

  if (await page.$(yesSelector)) {
    await randomDelay(800, 1600);
    await page.click(yesSelector);
  }
};

const loginAndFetchToken = async (browser, { email, password }) => {
  const page = await browser.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await randomDelay();

    await humanType(page, "input[type='email']", email);
    await randomDelay(600, 1400);
    await page.click("input[type='submit']");

    await randomDelay();
    await humanType(page, "input[type='password']", password);
    await randomDelay(600, 1400);
    await page.click("input[type='submit']");

    await handleStaySignedIn(page);

    await page.waitForFunction(
      () =>
        window.location.href.includes("access_token=") ||
        window.location.href.includes("code="),
      { timeout: 120000 }
    );

    const accessToken = extractAccessToken(page.url());

    if (!accessToken) {
      throw new Error("Access token not found in redirect URL.");
    }

    return accessToken;
  } finally {
    await page.close();
  }
};

const run = async () => {
  const raw = await fs.readFile(ACCOUNTS_PATH, "utf8");
  const accounts = JSON.parse(raw);

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("accounts.json must contain a non-empty array.");
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const account of accounts) {
      const label = account?.email ?? "unknown";

      try {
        console.log(`\n[INFO] Logging in as ${label}`);
        const accessToken = await loginAndFetchToken(browser, account);

        const xboxLiveToken = await getXboxLiveToken(accessToken);
        if (!xboxLiveToken) {
          throw new Error("Xbox Live token request failed.");
        }

        const { xsts, xuid } = await getXstsToken(xboxLiveToken);
        if (!xsts || !xuid) {
          throw new Error("XSTS token request failed.");
        }

        const entry = {
          email: account.email,
          xuid,
          xsts,
        };

        await appendValidToken(entry);
        console.log(`[SUCCESS] XSTS token generated for ${label}`);
      } catch (error) {
        console.error(`[ERROR] ${label}: ${error.message}`);
      }

      await randomDelay();
    }
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(`[FATAL] ${error.message}`);
  process.exit(1);
});
