/*
 * The server actions in the SCORM bundle (scripts/build-scorm-player.ts resolves every "@/server/..." import
 * here): the offline player calls none of them, its onComplete prop replaces them, so reaching one is a bug.
 */
const offline = async (): Promise<never> => {
  throw new Error("No server in the SCORM package");
};

export const attestModuleAction = offline;
export const completeLessonAction = offline;
export const reachSceneAction = offline;
export const startLessonAction = offline;
export const reportProblemAction = offline;
export const setPreferencesAction = offline;
