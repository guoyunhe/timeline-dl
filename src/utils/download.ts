import chalk from 'chalk';
import fse from 'fs-extra';
import https from 'https';

const { writeFile } = fse;

export function download(url: string, filename: string, retry = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(url, chalk.blue('Start'));
    https
      .get(url, (res) => {
        const data: any[] = [];
        res
          .on('data', (chunk) => {
            data.push(chunk);
          })
          .on('end', () => {
            const buffer = Buffer.concat(data);
            if (buffer.byteLength > 1024) {
              console.log(url, chalk.green('Succeeded'));
              writeFile(filename, buffer);
              resolve();
            } else if (retry > 0) {
              console.log(url, chalk.yellow('Retry...'));
              download(url, filename, retry - 1)
                .then(resolve)
                .catch(reject);
            }
          });
      })
      .on('error', (err) => {
        console.log(url, 'error', err);
        if (retry > 0) {
          console.log(url, chalk.yellow('Retry...'));
          download(url, filename, retry - 1)
            .then(resolve)
            .catch(reject);
        } else {
          console.log(url, chalk.red('Failed'));
          reject();
        }
      });
  });
}
