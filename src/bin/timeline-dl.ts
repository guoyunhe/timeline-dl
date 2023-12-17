#!/usr/bin/env node

import { Command } from 'commander';
import { twitter } from '../scrapers/twitter';

const program = new Command('timeline-dl');

program
  .command('twitter')
  .description('Download Twitter timeline images and videos')
  .argument(
    '[username]',
    'Username of the timeline you want to download. You can also set it in twitter.json file'
  )
  .option('--image-format <format>', 'Image save format. Support: jpg, png, webp', 'jpg')
  .option('--no-headless', 'Do not show the browser window.')
  .action(twitter);

program.helpOption('-h, --help', 'Show full help');

program.version(PACKAGE_VERSION, '-v, --version', 'Show version number');

program.parse();
