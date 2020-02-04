import * as exec from "@actions/exec";

const githubActionName = "merge-pr-to-branch";
const githubWorkspaceEnvVarName = "GITHUB_WORKSPACE";

export const execCmd = async (...commands: string[]) => {
  const cwd = process.env[githubWorkspaceEnvVarName];
  if (!cwd) {
    throw new Error(`Missing environment variable: '${githubWorkspaceEnvVarName}'.`);
  }
  return await exec.exec(commands.join("/n"), undefined, { cwd });
};

export const createCommitMessage = (message: string) => `${message} by ${githubActionName}`;
export const createCommentMessage = (message: string) => `${githubActionName}:\n${message}`;
