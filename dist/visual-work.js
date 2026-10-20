// Keep WebGL setup out of wheel/touch scrolling and in-page navigation.
const QUIET_MS = 180;
let lastScroll = -Infinity;
let navigationUntil = 0;
const activity = () => { lastScroll = performance.now(); };
addEventListener("scroll", activity, { passive: true });
addEventListener("wheel", activity, { passive: true });
addEventListener("touchmove", activity, { passive: true });

export function holdVisualWork(milliseconds = 1200) {
  navigationUntil = Math.max(navigationUntil, performance.now() + milliseconds);
}
export function isScrollBusy() {
  return performance.now() < Math.max(lastScroll + QUIET_MS, navigationUntil);
}
function delay(milliseconds, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function waitForScrollIdle(signal) {
  do {
    // A task boundary also lets input run between individual mesh preparations.
    const remaining = Math.max(lastScroll + QUIET_MS, navigationUntil) - performance.now();
    await delay(Math.max(0, remaining), signal);
    signal?.throwIfAborted();
  } while (isScrollBusy());
}

const jobs = [];
let running = false;
export function scheduleVisualWork(work, { signal, priority = () => 0 } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const job = { work, signal, priority, resolve, reject };
    const abort = () => {
      const index = jobs.indexOf(job);
      if (index !== -1) {
        jobs.splice(index, 1);
        reject(signal.reason);
      }
    };
    job.detach = () => signal?.removeEventListener("abort", abort);
    signal?.addEventListener("abort", abort, { once: true });
    jobs.push(job);
    pump();
  });
}
async function pump() {
  if (running) return;
  running = true;
  try {
    while (jobs.length) {
      await waitForScrollIdle();
      jobs.sort((a, b) => a.priority() - b.priority());
      const job = jobs.shift();
      if (!job) continue;
      job.detach();
      try {
        job.signal?.throwIfAborted();
        job.resolve(await job.work());
      } catch (error) {
        job.reject(error);
      }
    }
  } finally {
    running = false;
  }
}
