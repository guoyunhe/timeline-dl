import { spawn } from 'child_process';

export function execute(command: string) {
  return new Promise<void>(function (resolve, reject) {
    const ls = spawn(command, { shell: true });
    ls.stdout.on('data', function (data) {
      console.log('stdout: ' + data.toString());
    });

    ls.stderr.on('data', function (data) {
      console.log('stderr: ' + data.toString());
    });

    ls.on('exit', function (code) {
      console.log('child process exited with code ' + code);
      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
}
