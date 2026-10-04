(() => {
  "use strict";

  const API_ROOT = "https://api.github.com";
  const ACCEPT = "application/vnd.github+json";

  function repositoryId(settings) {
    return `${settings.owner}/${settings.repository}@${settings.branch}`;
  }

  function validateSettings(settings) {
    for (const field of ["owner", "repository", "branch"]) {
      if (typeof settings[field] !== "string" || !settings[field].trim()) {
        throw new Error(`Enter a repository ${field}.`);
      }
    }
  }

  async function request(url, token) {
    const response = await fetch(url, {
      headers: {
        Accept: ACCEPT,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("GitHub rejected the token or access to this repository.");
      }
      if (response.status === 404) {
        throw new Error("Repository or branch not found. Check the settings and token access.");
      }
      throw new Error(`GitHub request failed (${response.status}).`);
    }
    return response.json();
  }

  function repoPath(settings, suffix) {
    return `${API_ROOT}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repository)}/${suffix}`;
  }

  async function validate(settings) {
    validateSettings(settings);
    await request(repoPath(settings, `branches/${encodeURIComponent(settings.branch)}`), settings.token);
    return true;
  }

  function decodeBase64(value) {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function sync(settings, previousSnapshot) {
    validateSettings(settings);
    const token = settings.token;
    const treeResponse = await request(
      repoPath(settings, `git/trees/${encodeURIComponent(settings.branch)}?recursive=1`), token,
    );
    if (treeResponse.truncated) {
      throw new Error("GitHub returned a truncated repository tree. No data was changed.");
    }

    const previousFiles = new Map((previousSnapshot?.files ?? []).map((file) => [file.path, file]));
    const targets = treeResponse.tree.filter((entry) =>
      entry.type === "blob" && (entry.path.toLowerCase() === "tasks.json" || /\.md$/i.test(entry.path)),
    );
    const files = await Promise.all(targets.map(async (entry) => {
      const cached = previousFiles.get(entry.path);
      if (cached?.sha === entry.sha) return cached;
      const blob = await request(repoPath(settings, `git/blobs/${encodeURIComponent(entry.sha)}`), token);
      if (blob.encoding !== "base64") throw new Error(`Unsupported encoding for ${entry.path}.`);
      return { path: entry.path, sha: entry.sha, content: decodeBase64(blob.content) };
    }));

    const taskFile = files.find((file) => file.path.toLowerCase() === "tasks.json");
    let tasks = [];
    if (taskFile) {
      const parsed = JSON.parse(taskFile.content);
      tasks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.tasks) ? parsed.tasks : []);
      if (!Array.isArray(parsed) && !Array.isArray(parsed.tasks)) {
        throw new Error("tasks.json must contain an array or an object with a tasks array.");
      }
    }
    return {
      id: repositoryId(settings),
      owner: settings.owner,
      repository: settings.repository,
      branch: settings.branch,
      commit: treeResponse.sha,
      tasks,
      files: files.filter((file) => file !== taskFile),
    };
  }

  window.worktreeGitHub = Object.freeze({ validate, sync, repositoryId });
})();
