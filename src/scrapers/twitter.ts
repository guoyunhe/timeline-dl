import fse from 'fs-extra';
import { launch } from 'puppeteer-core';
import sanitize from 'sanitize-filename';
import { download } from '../utils/download';

const { readJson, writeJson } = fse;

const tweetSelector = 'article[data-testid="tweet"]';

declare const location: any;
declare const document: any;
declare const window: any;

export interface TwitterOptions {
  headless: boolean;
  imageFormat: string;
}

export async function twitter(username: string | null, { headless, imageFormat }: TwitterOptions) {
  let config: any = {};
  try {
    config = await readJson('twitter.json', { throws: false });
  } catch (e) {
    //
  }
  const browser = await launch({
    executablePath: '/usr/bin/chromium',
    userDataDir: '/tmp/pichub-puppeteer',
    headless,
    defaultViewport: {
      width: 1280,
      height: 2560,
    },
  });

  if (!username) return;

  console.log(`Fetch @${username} https://twitter.com/${username}/`);

  const startTime = new Date();
  const page = await browser.newPage();

  try {
    await page.setCookie({
      name: 'auth_token',
      value: process.env?.['TWITTER_AUTH_TOKEN'] || '',
      domain: '.twitter.com',
      path: '/',
      expires: 1712538612.671163,
      httpOnly: false,
      secure: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443,
    });

    await page.goto(`https://twitter.com/${username}/?lang=en`, {
      waitUntil: 'load',
      timeout: 10 * 1000,
    });

    const doneList = new Set<string>();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await page.waitForNetworkIdle({ timeout: 0 });

      const tweets = await page.$$eval(tweetSelector, (es) => {
        const username = location.pathname.split('/')[1];
        return es.map((e) => {
          const tweetText = e.querySelector('[data-testid="tweetText"]');
          // replace emoji image with emoji text
          Array.from(tweetText?.querySelectorAll('img') || []).forEach((img: any) => {
            const span = document.createElement('span');
            span.textContent = img.alt;
            img?.replaceWith(span);
          });
          const result = {
            link: e
              .querySelector(`a[href*="${username}/status/"]`)
              ?.href?.replace('/analytics', ''),
            text: tweetText?.textContent,
            dateTime: e.querySelector('time').dateTime,
            images: Array.from(e.querySelectorAll('img') || [])
              .map((img: any) => img.src)
              .filter((src) => src.startsWith('https://pbs.twimg.com/media/')),
          };
          return result;
        });
      });

      await Promise.all(
        tweets
          .filter(
            (tweet) =>
              tweet.images.length > 0 &&
              tweet.link &&
              !doneList.has(tweet.link) &&
              (!config.updatedAt ||
                new Date(config.updatedAt).getTime() < new Date(tweet.dateTime).getTime())
          )
          .map(async (tweet) => {
            if (tweet.images.length > 0) {
              await Promise.all(
                tweet.images.map(async (img, index) => {
                  const imgUrl =
                    img.substring(0, img.indexOf('?')) + `?format=${imageFormat}&name=4096x4096`;
                  const imgFileName = sanitize(
                    `${tweet.dateTime.substring(0, 10)} ${tweet.text} (${index + 1}).${imageFormat}`
                  );
                  try {
                    await download(imgUrl, imgFileName);
                  } catch (e) {
                    //
                  }
                })
              );
            }
          })
      );

      const lastTweet = tweets.pop();

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
    await writeJson('twitter.json', config, { spaces: 2 });
  } catch (e) {
    console.error(e);
  }

  await browser.close();
}
