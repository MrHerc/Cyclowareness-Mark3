/**
 * The player's reports of an attempt to the server: its start, then the furthest scene reached. A start lost on
 * the way (a network blip, a deploy restart) is sent again before the next scene report, not only after Finish is
 * refused, so the learner does not wait out the minimum time twice. Sending it again is safe: the server keeps a
 * start that is still valid.
 */
export function attemptReports(start: () => Promise<unknown>, reach: (scene: number) => Promise<unknown>) {
  let lost = false;
  const failed = () => {
    lost = true;
  };
  return {
    begin: (scene: number) =>
      start()
        .then(() => (scene > 0 ? reach(scene) : undefined))
        .catch(failed),
    reach: (scene: number) =>
      (lost ? start().then(() => void (lost = false)) : Promise.resolve())
        .then(() => reach(scene))
        .catch(failed),
  };
}
