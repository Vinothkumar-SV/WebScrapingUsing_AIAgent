import { chromium } from "playwright";

interface JobData {
  JobTitle: string;
  Company: string;
  Location: string;
  Experience: string;
  PrimarySkills: string;
  SalaryRange: string;
  JobDescription: string;
  JobPostDate: string;
  WorkType: string;
  JobLink: string;
}

class NaukriJobExtractor {
  displayName = "Naukri Job Extractor";
  description = "Extract all job details from Naukri search results";
  name = "NaukriJobExtractor";

  async scrape(url: string): Promise<{ total_jobs: number; jobs: JobData[] }> {
    const allJobs: JobData[] = [];
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      await this.delay(3000);

      const visitedLinks = new Set<string>();

      while (true) {
        const jobCards = await page.locator("a.title.fw500").all();
        const jobLinks: string[] = [];

        for (const el of jobCards) {
          const href = await el.getAttribute("href");
          if (href) {
            jobLinks.push(href);
          }
        }

        for (const link of jobLinks) {
          if (visitedLinks.has(link)) {
            continue;
          }
          visitedLinks.add(link);

          await page.goto(link);
          await page.waitForLoadState("domcontentloaded");
          await this.delay(2000);

          const jobData: JobData = {
            JobTitle: await this.getText(page, "h1"),
            Company: await this.getText(page, ".company"),
            Location: await this.getText(page, ".loc span"),
            Experience:
              (await this.getText(page, ".exp")) ||
              (await this.findRegex(
                /Experience\s*:?([^\|]+)/,
                await page.content()
              )),
            PrimarySkills:
              (await this.getText(page, ".key-skill")) ||
              (await this.findRegex(
                /Skills\s*:?([^\|]+)/,
                await page.content()
              )),
            SalaryRange: await this.getText(page, ".salary"),
            JobDescription: await this.getText(page, ".job-desc, .dang-inner-html"),
            JobPostDate: await this.getText(page, ".jd-stats span, .posted-date"),
            WorkType: await this.getText(page, ".work-mode, .work-from"),
            JobLink: link
          };
          allJobs.push(jobData);
          await this.delay(1000);
        }

        // Check next page
        const nextButton = await page.locator(
          "a[rel='next'], a[aria-label='Next']"
        );
        const isVisible = await nextButton.isVisible().catch(() => false);
        const classAttr = await nextButton
          .getAttribute("class")
          .catch(() => "");

        if (
          isVisible &&
          nextButton &&
          !classAttr?.includes("disabled")
        ) {
          await nextButton.click();
          await page.waitForLoadState("domcontentloaded");
          await this.delay(3000);
        } else {
          break;
        }
      }
    } finally {
      await browser.close();
    }

    return { total_jobs: allJobs.length, jobs: allJobs };
  }

  private async getText(page: any, selector: string): Promise<string> {
    try {
      const element = await page.locator(selector).first();
      const text = await element.innerText().catch(() => "");
      return text.trim();
    } catch {
      return "";
    }
  }

  private async findRegex(
    pattern: RegExp,
    text: string
  ): Promise<string> {
    const match = text.match(pattern);
    return match ? match[1].trim() : "";
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Main execution
(async () => {
  const extractor = new NaukriJobExtractor();
  const url = "https://www.naukri.com/automation-testing-jobs?k=automation%20testing&wfhType=0";
  
  console.log("Starting Naukri job scraper...");
  console.log(`Scraping jobs from: ${url}\n`);
  
  try {
    const result = await extractor.scrape(url);
    console.log(`\nTotal jobs scraped: ${result.total_jobs}`);
    console.log("\nJob Details:");
    console.log(JSON.stringify(result.jobs, null, 2));
  } catch (error) {
    console.error("Error during scraping:", error);
  }
})();

export default NaukriJobExtractor;
