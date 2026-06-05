import { chromium, type Browser, type Page } from "playwright";
import { resolveStreamProfile, type BridgeEvent, type PointerButton, type StreamProfileName } from "@vrcbb/protocol";

export interface BrowserControllerOptions {
  width: number;
  height: number;
  startUrl: string;
  headless: boolean;
}

const buttonMap: Record<PointerButton, "left" | "right" | "middle"> = {
  left: "left",
  right: "right",
  middle: "middle"
};

export class BrowserController {
  private browser: Browser | undefined;
  private page: Page | undefined;
  private currentUrl = "";
  private currentTitle = "";
  private viewportWidth: number;
  private viewportHeight: number;
  private streamProfile: StreamProfileName = "720p";

  constructor(private readonly options: BrowserControllerOptions) {
    this.viewportWidth = options.width;
    this.viewportHeight = options.height;
  }

  async start(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless
    });
    this.page = await this.browser.newPage({
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight
      }
    });
    await this.page.goto(this.options.startUrl, {
      waitUntil: "domcontentloaded"
    });
    await this.refreshPageState();
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
    this.page = undefined;
  }

  async applyEvent(event: BridgeEvent): Promise<void> {
    const page = this.requirePage();

    switch (event.type) {
      case "pointer_move": {
        const point = this.mapPoint(event.x, event.y);
        await page.mouse.move(point.x, point.y);
        break;
      }

      case "pointer_down": {
        const point = this.mapPoint(event.x, event.y);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down({ button: buttonMap[event.button] });
        break;
      }

      case "pointer_up": {
        const point = this.mapPoint(event.x, event.y);
        await page.mouse.move(point.x, point.y);
        await page.mouse.up({ button: buttonMap[event.button] });
        break;
      }

      case "wheel":
        await page.mouse.wheel(event.deltaX ?? 0, event.deltaY ?? 0);
        break;

      case "text_commit":
        await page.keyboard.insertText(event.text);
        break;

      case "key_press":
        if (event.key === "Control+L") {
          await page.keyboard.press("Control+L");
        } else {
          await page.keyboard.press(event.key);
        }
        break;

      case "url_submit":
        await page.goto(normalizeHttpUrl(event.url), {
          waitUntil: "domcontentloaded"
        });
        await this.refreshPageState();
        break;

      case "viewport_set":
        await page.setViewportSize({
          width: event.width,
          height: event.height
        });
        this.viewportWidth = event.width;
        this.viewportHeight = event.height;
        break;

      case "stream_profile": {
        const profile = resolveStreamProfile(event.profile);
        await page.setViewportSize({
          width: profile.width,
          height: profile.height
        });
        this.viewportWidth = profile.width;
        this.viewportHeight = profile.height;
        this.streamProfile = event.profile;
        break;
      }

      case "nav_back":
        await page.goBack({ waitUntil: "domcontentloaded" });
        await this.refreshPageState();
        break;

      case "nav_forward":
        await page.goForward({ waitUntil: "domcontentloaded" });
        await this.refreshPageState();
        break;

      case "reload":
        await page.reload({ waitUntil: "domcontentloaded" });
        await this.refreshPageState();
        break;

      case "lock_request":
      case "lock_release":
        break;
    }
  }

  getState(): { status: "ready" | "stopped"; url: string; title: string; viewport: { width: number; height: number }; streamProfile: StreamProfileName } {
    return {
      status: this.page ? "ready" : "stopped",
      url: this.currentUrl,
      title: this.currentTitle,
      streamProfile: this.streamProfile,
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight
      }
    };
  }

  async screenshotBase64(): Promise<string> {
    const page = this.requirePage();
    const buffer = await page.screenshot({
      type: "jpeg",
      quality: 72,
      fullPage: false
    });
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }

  private requirePage(): Page {
    if (!this.page) {
      throw new Error("BrowserController has not been started");
    }
    return this.page;
  }

  private mapPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(x * this.viewportWidth),
      y: Math.round(y * this.viewportHeight)
    };
  }

  private async refreshPageState(): Promise<void> {
    if (!this.page) {
      this.currentUrl = "";
      this.currentTitle = "";
      return;
    }

    this.currentUrl = this.page.url();
    this.currentTitle = await this.page.title().catch(() => "");
  }
}

export function normalizeHttpUrl(rawUrl: string): string {
  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = new URL(withScheme);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }

  url.username = "";
  url.password = "";
  return url.toString();
}
