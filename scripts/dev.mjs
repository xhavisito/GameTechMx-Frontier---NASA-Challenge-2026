import { spawn } from 'node:child_process';

const forwarded = process.argv.slice(2);
const commands = forwarded.length
  ? [['npm',['run','dev','-w','client','--',...forwarded]]]
  : [['npm',['run','dev','-w','client']],['npm',['run','dev','-w','server']]];
const windows = process.platform === 'win32';
const children = commands.map(([command,args]) => spawn(command,args,{stdio:'inherit',shell:windows,detached:!windows}));
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  children.forEach(child => {
    if (!child.pid) return;
    try { windows ? child.kill('SIGTERM') : process.kill(-child.pid,'SIGTERM'); } catch { /* already stopped */ }
  });
};
process.once('SIGINT',stop); process.once('SIGTERM',stop);
const code = await new Promise(resolve => children.forEach(child => child.once('exit',(exit,signal)=>{stop();resolve(signal?1:(exit??0));})));
process.exitCode = code;
