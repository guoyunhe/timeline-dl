import { exec } from 'child_process';
import fse from 'fs-extra';
import { launch } from 'puppeteer-core';
import { promisify } from 'util';
import { execute } from '../utils/execute';

const execPromise = promisify(exec);
const { readJson, writeJson, readdir } = fse;

const videoSelector = 'a[href^="/watch?v="]';

declare const location: any;
declare const document: any;
declare const window: any;

export interface TwitterOptions {
  headless: boolean;
  imageFormat: string;
}

export async function youtube(username: string | null, { headless, imageFormat }: TwitterOptions) {
  let config: any = {};
  try {
    config = await readJson('youtube.json', { throws: false });
  } catch (e) {
    //
  }
  const browser = await launch({
    executablePath: '/usr/bin/chromium',
    headless,
    defaultViewport: {
      width: 1280,
      height: 2560,
    },
  });

  if (!username) return;

  console.log(`Fetch @${username} https://youtube.com/${username}/`);

  const startTime = new Date();
  const page = await browser.newPage();

  const existingFiles = await readdir(process.cwd());

  try {
    await page.goto(`https://youtube.com/${username}/videos?lang=en`, {
      waitUntil: 'load',
      timeout: 10 * 1000,
    });

    const doneList = new Set<string>();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await page.waitForNetworkIdle({ timeout: 0 });

      const videos = await page.$$eval(videoSelector, (es) => {
        return es.map((e) => e.href.substring(9));
      });

      for (const video of videos) {
        if (doneList.has(video)) {
          continue;
        }
        // video was already downloaded, skip
        if (existingFiles.some((f) => f.includes(`[${video}]`) && !f.endsWith('.part'))) {
          doneList.add(video);
          continue;
        }
        execute(
          'yt-dlp --retries=infinite --retry-sleep=3 -o "%(upload_date)s %(title)s [%(id)s].%(ext)s" https://www.youtube.com/watch?v=' +
            video
        );
        doneList.add(video);
      }

      const lastTweet = videos.pop();

      if (
        config.updatedAt &&
        lastTweet &&
        new Date(config.updatedAt).getTime() > new Date(lastTweet.dateTime).getTime()
      ) {
        break;
      }

      const scrollStatus = await page.$eval('[data-testid="cellInnerDiv"]:last-child', (e) => {
        const rect = e.getBoundingClientRect();
        if (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        ) {
          return 'end';
        } else {
          return 'loading';
        }
      });

      if (scrollStatus === 'end') {
        break;
      } else {
        await page.keyboard.press('PageDown');
      }
      continue;
    }
    config.updatedAt = startTime.toISOString();
    await writeJson('youtube.json', config, { spaces: 2 });
  } catch (e) {
    console.error(e);
  }

  await browser.close();
}
